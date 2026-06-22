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
  removeAllListeners as removeAllEventListeners,
} from './events';
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
        'Polyfence instance has been disposed. Create a new instance or restart the app.',
      );
    }
  }

  // The Android native module silently accepts calls made before initialize(),
  // routing them through a service path that requires the core delegate +
  // PolyfenceErrorManager wired by initialize() — both are no-ops until then,
  // so events and per-zone failures are lost. iOS already rejects every
  // pre-init call via `guard let tracker = locationTracker`. This mirrors
  // that guard at the bridge layer so both platforms reject loudly. (BUG-001)
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
    return NativePolyfence.getConfiguration();
  }

  async updateConfiguration(config: PolyfenceConfiguration): Promise<void> {
    this.assertNotDisposed();
    this.assertInitialized();
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

  async requestBatteryOptimizationExemption(): Promise<boolean> {
    this.assertNotDisposed();
    return NativePolyfence.requestBatteryOptimizationExemption();
  }

  async errorHistory(options?: {
    limit?: number;
    timeRangeMs?: number;
    errorTypes?: string[];
  }): Promise<PolyfenceError[]> {
    this.assertNotDisposed();
    const raw: unknown = await NativePolyfence.getErrorHistory(options ?? {});
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
    return NativePolyfence.dispose();
  }

  removeAllListeners(): void {
    removeAllEventListeners();
  }
}
