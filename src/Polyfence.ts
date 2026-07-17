import { NativeModules } from 'react-native';
import type {
  PolyfenceConfiguration,
  Zone,
  ZoneState,
  PolyfenceDebugInfo,
  SessionTelemetry,
  GeofenceEvent,
  HealthScoreEvent,
  PolyfenceLocation,
  PolyfenceError,
  PerformanceEventPayload,
  Subscription,
  AccuracyProfile,
  BatteryOptimizationStatus,
} from './types';
import {
  onLocationUpdate,
  onGeofenceEvent,
  onError,
  onPerformance,
  onHealthScore,
  normalizePolyfenceError,
  expandErrorTypesToNativeCodes,
  removeAllListeners as removeAllEventListeners,
} from './events';
import { normalizeConfigEnums } from './configNormalize';
import { PolyfenceAnalytics } from './analytics';
import type { AnalyticsConfig, StorageAdapter } from './analytics';
import { AppLifecycleManager } from './lifecycle';
import { POLYFENCE_PLUGIN_VERSION } from './version';

const { Polyfence: NativePolyfence } = NativeModules;

if (!NativePolyfence) {
  throw new Error(
    'polyfence-react-native: NativeModule not found. Make sure the native module is linked correctly.',
  );
}

// Keys accepted by updateConfiguration. Kept in lock-step with the
// PolyfenceConfiguration interface in ./types so a future field added
// to one needs to be added to the other.
const ALLOWED_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'accuracyProfile',
  'updateStrategy',
  'gpsAccuracyThreshold',
  'enableDebugLogging',
  'proximitySettings',
  'movementSettings',
  'batterySettings',
  'dwellSettings',
  'clusterSettings',
  'scheduleSettings',
  'activitySettings',
]);

// Pre-2.x flat properties → migration hint. Removed in this release;
// surfacing the rename keeps the upgrade path clear for anyone whose
// code still uses the old names.
const LEGACY_KEY_HINTS: Record<string, string> = {
  desiredIntervalMs:
    'use proximitySettings.farZoneUpdateIntervalMs / movementSettings.stationaryUpdateIntervalMs',
  fastestIntervalMs:
    'use proximitySettings.nearZoneUpdateIntervalMs / movementSettings.movingUpdateIntervalMs',
  smallestDisplacementM: 'use movementSettings.movementThresholdMeters',
  dwellDetectionEnabled: 'use dwellSettings: { enabled: true }',
  dwellDefaultThresholdMs: 'use dwellSettings: { dwellThresholdMs: ... }',
  clusteringEnabled: 'use clusterSettings: { enabled: true }',
  clusterRadiusM: 'use clusterSettings.activeRadiusMeters',
  falseEventProtectionEnabled:
    'no replacement — false-event protection is always on',
  activityRecognitionEnabled: 'use activitySettings: { enabled: true }',
  activityRecognitionIntervalMs:
    'use activitySettings.{still,walking,running,cycling,driving}IntervalMs',
};

function assertKnownConfigKeys(
  config: PolyfenceConfiguration,
  caller: 'initialize' | 'updateConfiguration',
): void {
  const unknown = Object.keys(config).filter(
    (k) => !ALLOWED_CONFIG_KEYS.has(k),
  );
  if (unknown.length === 0) {
    return;
  }

  const hints = unknown
    .map((k) =>
      LEGACY_KEY_HINTS[k] !== undefined
        ? `  - ${k} (removed): ${LEGACY_KEY_HINTS[k]}`
        : `  - ${k} (unknown)`,
    )
    .join('\n');

  throw new Error(
    `Polyfence.${caller}: rejecting ${unknown.length} unknown ` +
      `key${
        unknown.length === 1 ? '' : 's'
      } that the native side would silently ignore ` +
      `otherwise:\n${hints}\n` +
      `Valid keys: ${[...ALLOWED_CONFIG_KEYS].join(', ')}.`,
  );
}

export class Polyfence {
  private static _instance: Polyfence | null = null;
  private _isDisposed = false;
  private _isInitialized = false;
  private _analyticsAvailable = false;
  private _lifecycleManagerAvailable = false;

  static get instance(): Polyfence {
    if (!Polyfence._instance) {
      Polyfence._instance = new Polyfence();
    }
    return Polyfence._instance;
  }

  private constructor() {}

  private assertNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error(
        'This Polyfence instance was disposed. Access Polyfence.instance to ' +
          'get a fresh instance (e.g. on re-login) — you do not need to ' +
          'restart the app.',
      );
    }
  }

  // The Android native module silently accepts calls made before initialize(),
  // routing them through a service path that requires the core delegate +
  // PolyfenceErrorManager wired by initialize() — both are no-ops until then,
  // so events and per-zone failures are lost. iOS already rejects every
  // pre-init call via `guard let tracker = locationTracker`. Mirror that
  // guard at the bridge layer so both platforms reject loudly.
  private assertInitialized(): void {
    if (!this._isInitialized) {
      throw new Error('Polyfence: call initialize() before any other method.');
    }
  }

  /**
   * Initialize the geofencing engine and optionally analytics.
   *
   * @param config Geofencing configuration
   * @param analyticsConfig Optional analytics config. Omit to use defaults (telemetry ON).
   * @param storage Optional storage adapter for persistent retry queue (e.g. AsyncStorage).
   */
  async initialize(
    config?: PolyfenceConfiguration,
    analyticsConfig?: AnalyticsConfig,
    storage?: StorageAdapter,
  ): Promise<void> {
    this.assertNotDisposed();
    if (config) {
      assertKnownConfigKeys(config, 'initialize');
    }
    await NativePolyfence.initialize(config ? { config } : {});
    this._isInitialized = true;

    // Initialize analytics (failure-isolated — never blocks geofencing)
    try {
      const resolvedConfig: AnalyticsConfig = analyticsConfig ?? {};
      if (!resolvedConfig.disableTelemetry) {
        PolyfenceAnalytics.instance.initialize(
          resolvedConfig,
          POLYFENCE_PLUGIN_VERSION,
          () => this.getSessionTelemetry(),
          storage,
        );
        this._analyticsAvailable = true;
      }
    } catch {
      // Analytics init failed — continue without it
      this._analyticsAvailable = false;
    }

    // Initialize lifecycle manager (failure-isolated)
    try {
      if (this._analyticsAvailable) {
        AppLifecycleManager.instance.initialize();
        this._lifecycleManagerAvailable = true;
      }
    } catch {
      this._lifecycleManagerAvailable = false;
    }
  }

  async startTracking(): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.startTracking();
  }

  async stopTracking(): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.stopTracking();
  }

  /**
   * Add a zone for monitoring.
   *
   * The zone is persisted natively and starts generating entry/exit events
   * once tracking is running.
   *
   * **Duplicate IDs.** Calling `addZone` with a `zone.id` that is already
   * being monitored silently overwrites the previous zone — no error is
   * thrown. Re-adding also **resets the persisted INSIDE/OUTSIDE state**
   * for that zone (and on iOS, its confidence state). If the device is
   * currently inside the zone, the next reconciliation may fire a fresh
   * `enter` / `recoveryEnter` event — in-place metadata edits without a
   * re-enter are a known limitation. If your workflow requires unique
   * IDs across additions, track loaded IDs in application state:
   * `getZoneStates()` is only reliable after `startTracking()` (on Android
   * it returns `[]` before then — see the README's Zone State section).
   */
  async addZone(zone: Zone): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.addZone(zone);
  }

  async removeZone(zoneId: string): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.removeZone(zoneId);
  }

  async clearAllZones(): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.removeAllZones();
  }

  /**
   * Current inside/outside state per zone, joined with persisted zone names in the native bridge.
   */
  async getZoneStates(): Promise<ZoneState[]> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.getZoneStates();
  }

  async debugInfo(): Promise<PolyfenceDebugInfo> {
    this.assertNotDisposed();
    return NativePolyfence.getDebugInfo();
  }

  async getSessionTelemetry(): Promise<SessionTelemetry> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.getSessionTelemetry();
  }

  onLocationUpdate(
    callback: (location: PolyfenceLocation) => void,
  ): Subscription {
    return onLocationUpdate(callback);
  }

  onGeofenceEvent(callback: (event: GeofenceEvent) => void): Subscription {
    return onGeofenceEvent(callback);
  }

  /**
   * Subscribe to all SDK errors — GPS failures, permission revocations,
   * service issues, battery warnings, zone validation errors, etc.
   *
   * **This is the SDK's central error channel.** Several methods —
   * including `batteryOptimizationStatus()`, `addZone()`, and
   * `requestPermissions()` — can emit errors as a side effect of being
   * called. If no listener is attached at the time, the error is silently
   * dropped (no retry, no replay, no warning in the method's return
   * value). Subscribe to `onError` **before** calling any other SDK method.
   */
  onError(callback: (error: PolyfenceError) => void): Subscription {
    return onError(callback);
  }

  onPerformance(
    callback: (payload: PerformanceEventPayload) => void,
  ): Subscription {
    return onPerformance(callback);
  }

  /**
   * Subscribe to health score updates (emitted every 5 minutes).
   * Score 0-100 with a top issue description when score < 90.
   */
  onHealthScore(callback: (event: HealthScoreEvent) => void): Subscription {
    return onHealthScore(callback);
  }

  onZoneEnter(callback: (event: GeofenceEvent) => void): Subscription {
    return onGeofenceEvent((event) => {
      if (event.type === 'enter' || event.type === 'recoveryEnter') {
        callback(event);
      }
    });
  }

  onZoneExit(callback: (event: GeofenceEvent) => void): Subscription {
    return onGeofenceEvent((event) => {
      if (event.type === 'exit' || event.type === 'recoveryExit') {
        callback(event);
      }
    });
  }

  /**
   * Check the current location permission state.
   *
   * On iOS: Returns true if location access is already granted (always or while-in-use).
   * Does NOT show a permission dialog; the system dialog is shown by requestPermissions(always: true)
   * on the native side, but the JS promise resolves immediately with the current state.
   *
   * On Android: Only checks current permission state. Does NOT show a system dialog.
   * To trigger the system permission dialog, use a library like react-native-permissions,
   * then call this method to verify the result.
   *
   * @param options.always - iOS only: request "always" access (default: false, requests "while in use")
   * @returns true if all required location permissions are granted, false otherwise
   */
  async requestPermissions(options?: { always?: boolean }): Promise<boolean> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.requestPermissions(options ?? {});
  }

  async isLocationServiceEnabled(): Promise<boolean> {
    this.assertNotDisposed();
    return NativePolyfence.isLocationServiceEnabled();
  }

  async getConfiguration(): Promise<PolyfenceConfiguration> {
    this.assertNotDisposed();
    this.assertInitialized();
    // Native engine emits enum string values in UPPERCASE_SNAKE_CASE on both
    // platforms (Kotlin enum.name; Swift `case balanced = "BALANCED"` raw
    // values). Normalize to lowerCamelCase here to match the TypeScript
    // AccuracyProfile / UpdateStrategy unions in `./types`.
    const raw = (await NativePolyfence.getConfiguration()) as Record<
      string,
      unknown
    >;
    return normalizeConfigEnums(raw) as unknown as PolyfenceConfiguration;
  }

  async updateConfiguration(config: PolyfenceConfiguration): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    assertKnownConfigKeys(config, 'updateConfiguration');
    return NativePolyfence.updateConfiguration(config);
  }

  async resetConfiguration(): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.resetConfiguration();
  }

  async setAccuracyProfile(profile: AccuracyProfile): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
    return NativePolyfence.setAccuracyProfile(profile);
  }

  async batteryOptimizationStatus(): Promise<BatteryOptimizationStatus> {
    this.assertNotDisposed();
    return NativePolyfence.batteryOptimizationStatus();
  }

  /**
   * Launch the Android system dialog asking the user to exempt your app
   * from battery optimisation. **Fire-and-forget** — the Promise resolves
   * as soon as the dialog is launched, BEFORE the user has accepted or
   * denied it. The Android system has no synchronous mechanism to report
   * the user's response back to us.
   *
   * To observe the outcome: re-poll {@link batteryOptimizationStatus} after
   * the user has responded (e.g. on `AppState` → `active` once your app
   * returns to the foreground).
   *
   * ```typescript
   * await Polyfence.instance.requestBatteryOptimizationExemption();
   * // ...user is shown the dialog and responds...
   * const status = await Polyfence.instance.batteryOptimizationStatus();
   * if (status.isIgnoringOptimizations) {
   *   // user accepted
   * }
   * ```
   *
   * On iOS this is a no-op kept for cross-platform API parity (iOS has
   * no equivalent battery-optimisation exemption surface).
   *
   * Returns `Promise<void>` — resolving a boolean for "user accepted"
   * would be misleading because the bridge can't observe that.
   */
  async requestBatteryOptimizationExemption(): Promise<void> {
    this.assertNotDisposed();
    return NativePolyfence.requestBatteryOptimizationExemption();
  }

  async errorHistory(options?: {
    limit?: number;
    timeRangeMs?: number;
    errorTypes?: string[];
  }): Promise<PolyfenceError[]> {
    this.assertNotDisposed();
    // The native errorHistory filter compares each stored error's
    // snake_case `type` string (e.g. "battery_optimization_required")
    // against the incoming `errorTypes` array. Public
    // PolyfenceErrorType values are camelCase (e.g.
    // "batteryOptimizationRequired"), so without expansion the filter
    // matches nothing. Expand each camelCase filter entry to every
    // native code that maps back to it in NATIVE_CODE_TO_TYPE — a
    // single camelCase type can cover multiple native codes (e.g.
    // `serviceStartFailed` covers legacy `tracking_error` and
    // canonical `service_start_failed`).
    //
    // An explicit empty `errorTypes: []` short-circuits: the native
    // `isNotEmpty()` guard would otherwise treat it as "no filter —
    // return everything", which is user-hostile for callers who
    // computed an empty filter and expected an empty result.
    // Short-circuit here so the semantic matches the array literal
    // on either end.
    if (options?.errorTypes && options.errorTypes.length === 0) {
      return [];
    }
    const nativeOptions = options
      ? {
          ...options,
          ...(options.errorTypes
            ? { errorTypes: expandErrorTypesToNativeCodes(options.errorTypes) }
            : {}),
        }
      : {};
    const raw: unknown = await NativePolyfence.getErrorHistory(nativeOptions);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((item) =>
      normalizePolyfenceError(item as Record<string, unknown>),
    );
  }

  async dispose(): Promise<void> {
    // End session before tearing down (if analytics available)
    if (this._analyticsAvailable) {
      try {
        await PolyfenceAnalytics.instance.endSession();
      } catch {
        // Non-fatal
      }
    }

    if (this._lifecycleManagerAvailable) {
      AppLifecycleManager.instance.dispose();
      this._lifecycleManagerAvailable = false;
    }

    if (this._analyticsAvailable) {
      PolyfenceAnalytics.instance.reset();
      this._analyticsAvailable = false;
    }

    this._isDisposed = true;
    this._isInitialized = false;
    removeAllEventListeners();
    // Drop the cached singleton so the next `Polyfence.instance` access lazily
    // builds a fresh, usable instance — this is what makes the documented
    // logout -> login pattern (initialize -> dispose -> initialize) work
    // instead of permanently bricking the SDK. Native dispose() is
    // non-terminal (it only stops tracking and clears the delegate) and
    // initialize() re-runs setup idempotently, so re-initialization is fully
    // supported. Retired before awaiting native teardown so a rejecting
    // dispose() can never leave the SDK permanently unusable. This disposed
    // instance stays disposed, so a stale captured reference still throws.
    Polyfence._instance = null;
    await NativePolyfence.dispose();
  }

  removeAllListeners(): void {
    removeAllEventListeners();
  }
}
