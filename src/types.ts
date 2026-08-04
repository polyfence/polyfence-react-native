// Zone types
export type ZoneType = 'circle' | 'polygon';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  center?: Coordinate;
  radius?: number;
  polygon?: Coordinate[];
  metadata?: Record<string, unknown>;
  dwellThresholdMs?: number;
  clusterGroupId?: string;
}

// Geofence events
export type GeofenceEventType =
  | 'enter'
  | 'exit'
  | 'dwell'
  | 'recoveryEnter'
  | 'recoveryExit'
  | 'signalLost'
  | 'signalRestored';

export interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  type: GeofenceEventType;
  location: PolyfenceLocation;
  timestamp: number;
  /**
   * Milliseconds the GeofenceEngine took to detect the transition.
   * Populated by polyfence-core on every event.
   */
  detectionTimeMs?: number;
  /**
   * Distance in metres from the event location to the zone boundary.
   * Useful for filtering edge-of-boundary jitter. Populated by polyfence-core
   * on every event.
   */
  distanceToBoundaryM?: number;
  /**
   * Milliseconds the device has been inside the zone at the moment of the
   * event. Populated only on DWELL events. For ENTER/EXIT/RECOVERY_*
   * events the field is absent — those events don't carry a meaningful
   * dwell duration.
   */
  dwellDurationMs?: number;
  /**
   * `true` when this event was drained from the durable pending-events queue
   * (persisted by polyfence-core while the JS runtime was unreachable). Live
   * events never carry this field; absent is semantically equivalent to
   * `false`. Only surfaces when `pendingEventsQueueSize > 0` is configured.
   */
  deliveredLate?: boolean;
  /**
   * Milliseconds since epoch when polyfence-core originally detected the
   * crossing. Distinct from `timestamp`, which stays anchored to the event's
   * native timestamp — for a drained event, both fields carry the same
   * captured moment; consumers wanting the delivery time can add
   * `queuedDurationMs`. Only present on drained events.
   */
  capturedTs?: number;
  /**
   * Milliseconds the event sat in the durable queue between core capture and
   * consumer delivery. Only present on drained events
   * (`deliveredLate === true`); live events leave the field `undefined`.
   */
  queuedDurationMs?: number;
}

/**
 * Activity detected by polyfence-core's activity-recognition layer at the
 * moment a location / geofence event was produced. Matches the
 * `ActivityType` enum on both native platforms — see
 * `polyfence-core/android/.../configuration/SmartGpsConfig.kt` and
 * `polyfence-core/ios/Classes/Configuration/SmartGpsConfig.swift`. Native
 * emits the enum name lowercased; this union is the closed set of values
 * the bridge will ever receive.
 *
 * Note: these are the polyfence-core ActivityType names — not Google
 * Play Service's underlying detection labels (`in_vehicle`, `on_bicycle`).
 * polyfence-core maps GMS detections to these canonical names before
 * emitting.
 */
export type ActivityAtEvent =
  | 'still'
  | 'walking'
  | 'running'
  | 'cycling'
  | 'driving'
  | 'unknown';

// Location
export interface PolyfenceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  timestamp?: number;
  activity?: ActivityAtEvent;
}

// Configuration
export type AccuracyProfile =
  | 'maxAccuracy'
  | 'balanced'
  | 'batteryOptimal'
  | 'adaptive';

export type UpdateStrategy =
  | 'continuous'
  | 'proximityBased'
  | 'movementBased'
  | 'intelligent';

// Nested settings interfaces
export interface ProximitySettings {
  nearZoneThresholdMeters?: number;
  farZoneThresholdMeters?: number;
  nearZoneUpdateIntervalMs?: number;
  farZoneUpdateIntervalMs?: number;
}

export interface MovementSettings {
  stationaryThresholdMs?: number;
  movementThresholdMeters?: number;
  stationaryUpdateIntervalMs?: number;
  movingUpdateIntervalMs?: number;
}

export interface BatterySettings {
  lowBatteryThreshold?: number;
  criticalBatteryThreshold?: number;
  lowBatteryUpdateIntervalMs?: number;
  pauseOnCriticalBattery?: boolean;
}

export interface DwellSettings {
  enabled?: boolean;
  dwellThresholdMs?: number;
}

export interface ClusterSettings {
  enabled?: boolean;
  activeRadiusMeters?: number;
  refreshDistanceMeters?: number;
}

/**
 * A single point in a 24-hour day, minute-precision. Nested inside
 * [TimeWindow] to match the shape the native `TrackingScheduler`
 * accepts on write and emits on read. A flat
 * `TimeWindow { startHour, startMinute, ... }` shape would not match
 * native's `TimeOfDay { hour, minute }` nesting and the fields would
 * be silently `undefined` at runtime coming back from
 * `getConfiguration()`.
 */
export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface TimeWindow {
  startTime: TimeOfDay;
  endTime: TimeOfDay;
  daysOfWeek?: number[];
}

export interface ScheduleSettings {
  enabled?: boolean;
  timeWindows?: TimeWindow[];
  startImmediatelyIfInWindow?: boolean;
}

export interface ActivitySettings {
  enabled?: boolean;
  confidenceThreshold?: number;
  debounceSeconds?: number;
  stillIntervalMs?: number;
  walkingIntervalMs?: number;
  runningIntervalMs?: number;
  cyclingIntervalMs?: number;
  drivingIntervalMs?: number;
}

export interface PolyfenceConfiguration {
  accuracyProfile?: AccuracyProfile;
  updateStrategy?: UpdateStrategy;
  gpsAccuracyThreshold?: number;
  /**
   * Degraded-GPS staleness watchdog, in milliseconds. `0` (default) disables it.
   * When `> 0`, a low-accuracy fix may drive an exit for a zone you're already
   * inside, and after this long with no valid fix while inside a zone a
   * `signalLost` event is emitted (resolved by `signalRestored` or `exit`).
   */
  gpsStalenessTimeoutMs?: number;
  /**
   * Cap for the durable pending-events queue that polyfence-core writes to
   * when the JS runtime is unreachable (Doze, memory pressure, RN reload).
   * `0` (default) disables persistence entirely — today's behaviour. When
   * `> 0`, the queue holds up to N events on disk with oldest-first eviction
   * on cap; drain with {@link Polyfence.drainPendingEvents} on the next
   * successful attach. A cap of ~500 is a reasonable starting point.
   */
  pendingEventsQueueSize?: number;
  /**
   * Whether queued events are delivered automatically the moment a consumer
   * starts listening. `true` (default) replays the durable queue through
   * {@link Polyfence.onGeofenceEvent} on the first subscription, so a crossing
   * captured while the app was dead arrives without the consumer asking for it.
   * `false` leaves the queue pull-only — {@link Polyfence.drainPendingEvents}
   * is then the only way to get the events out. Only meaningful when
   * `pendingEventsQueueSize > 0`.
   */
  pendingEventsAutoDrainEnabled?: boolean;
  /**
   * Registers the nearest active zones with the operating system's geofence
   * service so a crossing can still be captured after the app's process is
   * fully killed. `false` (default) registers nothing with the OS and shares no
   * zone data with it — Polyfence's own engine remains the sole detector either
   * way; this is only a wake source.
   *
   * Requires `pendingEventsQueueSize > 0` to be useful: an OS wake writes the
   * crossing into that queue and it is delivered on the next
   * {@link Polyfence.drainPendingEvents}. With the queue off, the woken
   * crossing has nowhere to go and the engine reports
   * `osGeofenceQueueDisabled`.
   *
   * Costs the stronger background-location grant: `ACCESS_BACKGROUND_LOCATION`
   * (and `RECEIVE_BOOT_COMPLETED`) on Android, "Always" authorization on iOS.
   * Without it, wake fences degrade to polling-only and the engine reports
   * `osGeofencePermissionDenied` — tracking is unaffected. Request that grant
   * only when this is on; it puts an Android app through Google Play's manual
   * background-location review.
   */
  osGeofenceWakeEnabled?: boolean;
  /**
   * How many OS geofence slots Polyfence may occupy while the app is
   * backgrounded. Omitted (default) uses the native engine's per-platform
   * default — 50 of Android's 100-per-app allocation, leaving half free for
   * geofences the consumer app registers itself, and 20 on iOS, which is
   * already Apple's hard per-app cap.
   *
   * Values outside the platform's usable range are clamped by the native
   * engine, so the effective budget is whatever `getConfiguration()` reports
   * back rather than necessarily the value passed here. Only meaningful when
   * `osGeofenceWakeEnabled` is `true`.
   */
  osGeofenceMaxRegions?: number;
  enableDebugLogging?: boolean;
  // Nested settings
  proximitySettings?: ProximitySettings;
  movementSettings?: MovementSettings;
  batterySettings?: BatterySettings;
  dwellSettings?: DwellSettings;
  clusterSettings?: ClusterSettings;
  scheduleSettings?: ScheduleSettings;
  activitySettings?: ActivitySettings;
}

/**
 * Shape of the `data` sub-object on a `runtime_status` event delivered
 * through `onPerformance`. Emitted periodically (and on change) by
 * polyfence-core's LocationTracker.
 *
 * `strategy` and `accuracyProfile` arrive as the native
 * UPPERCASE_SNAKE_CASE enum names (`'CONTINUOUS'`, `'BALANCED'`, …)
 * rather than the lowerCamelCase `UpdateStrategy` / `AccuracyProfile`
 * unions the config API uses. Normalize with the same helper the SDK
 * uses internally if you want to match those unions:
 *
 * ```ts
 * import { normalizeConfigEnums } from 'polyfence-react-native/dist/configNormalize';
 * ```
 *
 * `currentGpsAccuracy` is null until the first GPS fix lands — the
 * field is always emitted so consumers can rely on a stable key set.
 */
export interface RuntimeStatus {
  strategy: string;
  intervalMs: number;
  accuracyProfile: string;
  nearestZoneDistanceM: number;
  isStationary: boolean;
  batteryMode: string;
  gpsAccuracy: number;
  timestamp: number;
  secondsSinceLastGpsFix: number;
  gpsAvailabilityDrops5Min: number;
  currentGpsAccuracy: number | null;
}

/**
 * Payload delivered to `onPerformance` subscribers. Scoped to
 * `type: 'runtime_status'` events shaped
 * `{type: 'runtime_status', data: RuntimeStatus}` — see
 * {@link RuntimeStatus} for the fields under `payload.data`.
 * `onHealthScore` delivers `type: 'health_score'` events separately.
 */
export type PerformanceEventPayload = Record<string, unknown>;

// Battery optimization (Android)
export interface BatteryOptimizationStatus {
  isIgnoringOptimizations: boolean;
  manufacturer: string;
}

// Error
export type PolyfenceErrorType =
  | 'gpsTimeout'
  | 'gpsPermissionDenied'
  | 'gpsServiceDisabled'
  | 'gpsAccuracyPoor'
  | 'gpsUnreliable'
  | 'serviceStartFailed'
  | 'serviceKilled'
  | 'serviceRestartFailed'
  | 'batteryOptimizationRequired'
  | 'lowBattery'
  | 'zoneValidationFailed'
  | 'zoneStorageFailed'
  | 'zoneLoadFailed'
  | 'networkTimeout'
  | 'analyticsUploadFailed'
  | 'permissionRevoked'
  | 'memoryLow'
  | 'pendingEventsEvicted'
  | 'osGeofencePermissionDenied'
  | 'osGeofenceRegistrationFailed'
  | 'osGeofenceQueueDisabled'
  | 'unknown';

export interface PolyfenceError {
  type: PolyfenceErrorType;
  message: string;
  context?: Record<string, unknown>;
  timestamp?: number;
  correlationId?: string;
}

/**
 * Snapshot returned by {@link Polyfence.debugInfo}. Five flat metric groups —
 * the bridge passes the native engine's `PolyfenceDebugCollector.collectDebugInfo()`
 * response through unchanged on both platforms.
 *
 * For functional state (current tracking on/off, current configuration, zone
 * membership), prefer the focused getters: `getConfiguration()`, `getZoneStates()`,
 * and the `onPerformance` event stream. `debugInfo()` is for operational
 * diagnostics — battery, CPU, system permissions, error history.
 */
export interface PolyfenceDebugInfo {
  systemStatus: PolyfenceSystemStatus;
  performance: PolyfencePerformanceMetrics;
  battery: PolyfenceBatteryMetrics;
  zones: PolyfenceZoneStatus;
  recentErrors: PolyfenceError[];
}

export interface PolyfenceSystemStatus {
  isLocationPermissionGranted: boolean;
  isBackgroundLocationEnabled: boolean;
  /** `null` on iOS, which has no equivalent system setting to report. */
  isBatteryOptimizationDisabled: boolean | null;
  isGpsEnabled: boolean;
  /**
   * `null` on iOS, which has no wake locks, and on Android when no tracking
   * service is running — nothing could then be holding one.
   */
  isWakeLockAcquired: boolean | null;
  /** GPS accuracy of the last fix in metres. `-1` if no fix yet. */
  lastKnownAccuracy: number;
  /** Milliseconds since epoch; `0` if no fix yet. */
  lastLocationUpdate: number;
  /** OS version (e.g. Android `"15"`, iOS `"17.4"`). */
  platformVersion: string;
  /** Bridge/plugin version reported via `initialize({ pluginVersion })`. `"unknown"` if not set. */
  pluginVersion: string;
  /**
   * State of the most recent OS wake-fence registration attempt, or `null` when
   * no registration has been attempted — which is what a consumer with
   * `osGeofenceWakeEnabled` off always sees, and what distinguishes "not opted
   * in" from "opted in and failing".
   */
  osGeofenceRegistrationHealth: OsGeofenceRegistrationHealth | null;
}

/**
 * State of the most recent attempt to register zone perimeters with the
 * operating system's geofence service. Reached through
 * {@link PolyfenceSystemStatus.osGeofenceRegistrationHealth}.
 */
export interface OsGeofenceRegistrationHealth {
  /** How many zones Polyfence asked the OS to monitor. */
  requested: number;
  /**
   * How many the OS accepted. Fewer than `requested` means the platform's
   * per-app cap was reached and coverage is partial — expected on a large zone
   * set, not a failure, and `lastError` stays `null`. Zero while the app is
   * foregrounded is also deliberate: slots are released whenever the in-process
   * engine is doing the detecting.
   */
  registered: number;
  /**
   * Why the last attempt could not register everything, or `null` when nothing
   * went wrong. `"background_location_denied"` means the grant OS wake fences
   * need is missing — `ACCESS_BACKGROUND_LOCATION` on Android, "Always"
   * authorization on iOS.
   */
  lastError: string | null;
}

export interface PolyfencePerformanceMetrics {
  /** `null` on iOS, which has no foreground service to restart. */
  restartCount: number | null;
  totalLocationUpdates: number;
  /**
   * Milliseconds, averaged over the crossings that were timed. `null` until
   * at least one has been — zero is the best possible latency, so a device
   * that has measured nothing is reported as unmeasured rather than perfect.
   */
  averageDetectionLatency: number | null;
  /**
   * Whole-process resident size on iOS, Java heap only on Android. The two
   * are not comparable across platforms.
   */
  memoryUsageMB: number;
  /** Every zone crossing the consumer received, timed or not. */
  totalZoneDetections: number;
  /**
   * How many of those crossings were timed, and so how many samples
   * {@link averageDetectionLatency} covers. Lower than
   * {@link totalZoneDetections} when the engine synthesised a crossing
   * outside a timed evaluation — a degraded-GPS exit, for instance.
   */
  timedZoneDetections: number;
  /** Milliseconds since session start. */
  uptime: number;
}

export interface PolyfenceBatteryMetrics {
  /** Milliseconds the tracker has been actively listening this session. */
  totalActiveTime: number;
  /**
   * `0–100`, or `null` when the platform has not reported a level — on iOS
   * before the OS populates it, which is always the case in the Simulator.
   */
  batteryLevel: number | null;
  isCharging: boolean;
}

export interface PolyfenceZoneStatus {
  polygonZones: number;
  circleZones: number;
  /** Number of zones currently in the active set (clustering-aware). */
  activeZones: number;
}

// Zone state
export interface ZoneState {
  zoneId: string;
  zoneName: string;
  isInside: boolean;
  lastEventType?: GeofenceEventType;
  lastEventTimestamp?: number;
  dwellStartTimestamp?: number;
  distanceToBoundaryM?: number;
}

// Session telemetry (aggregated in core)
export interface SessionTelemetry {
  sessionDurationMinutes: number;
  gpsUpdateCount: number;
  avgGpsIntervalMs: number;
  zoneCount: number;
  enterEventCount: number;
  exitEventCount: number;
  dwellEventCount: number;
  falseEventCount: number;
  recoveryEventCount: number;
  zoneTransitionCount: number;
  accuracyProfile: string;
  updateStrategy: string;
  batteryDrainPercent: number;
  deviceCategory: string;
  bridgePlatform: string;
  coreVersion?: string;
  sessionStartHour: number;
  [key: string]: unknown; // future-proof for new fields
}

// Health score (emitted by polyfence-core every 5 minutes via onPerformanceEvent)
export interface HealthScoreEvent {
  score: number;
  topIssue: string | null;
  timestamp: number;
}

// Subscription
export interface Subscription {
  remove: () => void;
}
