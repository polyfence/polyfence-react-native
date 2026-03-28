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
  | 'recovery_enter'
  | 'recovery_exit';

export interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  type: GeofenceEventType;
  location: PolyfenceLocation;
  timestamp: number;
  confidence?: number;
  dwellDurationMs?: number;
}

// Location
export interface PolyfenceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  timestamp: number;
}

// Configuration
export type AccuracyProfile =
  | 'maxAccuracy'
  | 'balanced'
  | 'powerSaver'
  | 'adaptive'
  | 'batteryOptimal'
  | 'custom';

export type UpdateStrategy =
  | 'fixed'
  | 'proximityBased'
  | 'activityBased'
  | 'intelligent';

export interface PolyfenceConfiguration {
  accuracyProfile?: AccuracyProfile;
  updateStrategy?: UpdateStrategy;
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
  saasApiKey?: string;
  saasBaseUrl?: string;
  analyticsEnabled?: boolean;
  industryCategory?: string;
  /** iOS bridge forwards these when present; Android may ignore until parity lands. */
  gpsAccuracyThreshold?: number;
  dwellSettings?: {
    enabled?: boolean;
    dwellThresholdMs?: number;
  };
  clusterSettings?: {
    enabled?: boolean;
    activeRadiusMeters?: number;
    refreshDistanceMeters?: number;
  };
  scheduleSettings?: Record<string, unknown>;
  activitySettings?: Record<string, unknown>;
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
  | 'permission_denied'
  | 'location_disabled'
  | 'activity_recognition_unavailable'
  | 'configuration_error'
  | 'zone_error'
  | 'tracking_error'
  | 'network_error'
  | 'unknown';

export interface PolyfenceError {
  type: PolyfenceErrorType;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
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

// Tracking schedule
export interface TrackingSchedule {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  daysOfWeek?: number[]; // 1=Monday, 7=Sunday
}

// Session telemetry (D016 — aggregated in core)
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
  sessionStartHour: number;
  [key: string]: unknown; // future-proof for new fields
}

// Health score (J19 — emitted by polyfence-core every 5 minutes via onPerformanceEvent)
export interface HealthScoreEvent {
  score: number;
  topIssue: string | null;
  timestamp: number;
}

// Subscription
export interface Subscription {
  remove: () => void;
}
