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
  | 'recoveryExit';

export interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  type: GeofenceEventType;
  location: PolyfenceLocation;
  timestamp: number;
  confidence?: number;
  dwellDurationMs?: number;
  zone?: Zone;
}

// Location
export interface PolyfenceLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  timestamp?: number;
  interval?: number;
  isFallback?: boolean;
  activity?: string;
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

export interface TimeWindow {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
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
  enableDebugLogging?: boolean;
  // Nested settings (Flutter parity)
  proximitySettings?: ProximitySettings;
  movementSettings?: MovementSettings;
  batterySettings?: BatterySettings;
  dwellSettings?: DwellSettings;
  clusterSettings?: ClusterSettings;
  scheduleSettings?: ScheduleSettings;
  activitySettings?: ActivitySettings;
  // Legacy flat properties (kept for backward compatibility during migration)
  desiredIntervalMs?: number;
  fastestIntervalMs?: number;
  smallestDisplacementM?: number;
  dwellDetectionEnabled?: boolean;
  dwellDefaultThresholdMs?: number;
  clusteringEnabled?: boolean;
  clusterRadiusM?: number;
  falseEventProtectionEnabled?: boolean;
  activityRecognitionEnabled?: boolean;
  activityRecognitionIntervalMs?: number;
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
 * `currentGpsAccuracy` is null until the first GPS fix lands
 * (stable-key contract from polyfence-core BUG-013b).
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
 * Payloads on the performance channel vary — see {@link RuntimeStatus}
 * for `type: 'runtime_status'` events (nested under `payload.data`),
 * plus `type: 'status'` snapshots (`trackingEnabled`, `zonesCount`,
 * `profile`, `lastAccuracy`, …), `system_health`, and others.
 * Discriminate on `payload.type` before reading fields.
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
  /** Android only — `true` on iOS (no equivalent system setting). */
  isBatteryOptimizationDisabled: boolean;
  isGpsEnabled: boolean;
  /** Android only — `false` on iOS (no wake locks). */
  isWakeLockAcquired: boolean;
  /** GPS accuracy of the last fix in metres. `-1` if no fix yet. */
  lastKnownAccuracy: number;
  /** Milliseconds since epoch; `0` if no fix yet. */
  lastLocationUpdate: number;
  /** OS version (e.g. Android `"15"`, iOS `"17.4"`). */
  platformVersion: string;
  /** Bridge/plugin version reported via `initialize({ pluginVersion })`. `"unknown"` if not set. */
  pluginVersion: string;
}

export interface PolyfencePerformanceMetrics {
  restartCount: number;
  cpuUsagePercent: number;
  totalLocationUpdates: number;
  /** Milliseconds. */
  averageDetectionLatency: number;
  memoryUsageMB: number;
  totalZoneDetections: number;
  /** Milliseconds since session start. */
  uptime: number;
}

export interface PolyfenceBatteryMetrics {
  /** Milliseconds the tracker has been actively listening this session. */
  totalActiveTime: number;
  gpsActiveTimePercent: number;
  /** `0–100`. */
  batteryLevel: number;
  /** Estimated battery drain attributable to tracking, percent per hour. */
  estimatedHourlyDrain: number;
  isCharging: boolean;
  /** Android only — counts CPU wake events; always `0` on iOS. */
  wakeUpCount: number;
}

export interface PolyfenceZoneStatus {
  /** Per-zone-id event counts (enter/exit/dwell aggregated). */
  zoneEventCounts: Record<string, number>;
  polygonZones: number;
  circleZones: number;
  /** Number of zones currently in the active set (clustering-aware). */
  activeZones: number;
  /** Milliseconds since epoch of the most recent zone add/remove/state change. */
  lastZoneUpdate: number;
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
