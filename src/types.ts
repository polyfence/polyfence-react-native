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

// Runtime status
export interface RuntimeStatus {
  isTracking: boolean;
  activeZoneCount: number;
  currentAccuracyProfile: AccuracyProfile;
  currentUpdateStrategy: UpdateStrategy;
  currentIntervalMs: number;
  batteryLevel: number;
  lastLocationTimestamp?: number;
}

/**
 * Payloads on the performance channel vary: full {@link RuntimeStatus}-like maps,
 * `type: "status"` snapshots (`trackingEnabled`, `zonesCount`, …), `system_health`, etc.
 * Narrow at runtime (e.g. `if ('trackingEnabled' in payload)`) as needed.
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

// Debug info
export interface PolyfenceDebugInfo {
  engineVersion: string;
  bridgePlatform: string;
  isTracking: boolean;
  activeZones: number;
  totalEventsGenerated: number;
  currentAccuracyProfile: string;
  currentUpdateStrategy: string;
  currentIntervalMs: number;
  lastLocationTimestamp?: number;
  errorHistory: PolyfenceError[];
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
