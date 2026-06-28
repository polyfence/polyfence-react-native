export { Polyfence } from './Polyfence';
export {
  onLocationUpdate,
  onGeofenceEvent,
  onError,
  onPerformance,
  onHealthScore,
  normalizePolyfenceError,
  removeAllListeners,
} from './events';
export { PolyfenceAnalytics } from './analytics';
export type { AnalyticsConfig, StorageAdapter } from './analytics';
// DebugOverlay is not re-exported from main index to avoid StyleSheet
// initialization in non-RN test environments. It is a dev/source-only helper
// and is NOT part of the published npm package (the `src/` tree is excluded
// from the tarball), so it cannot be imported by npm consumers.
export type {
  Zone,
  ZoneType,
  Coordinate,
  GeofenceEvent,
  GeofenceEventType,
  PolyfenceLocation,
  PolyfenceConfiguration,
  AccuracyProfile,
  UpdateStrategy,
  RuntimeStatus,
  PerformanceEventPayload,
  PolyfenceError,
  PolyfenceErrorType,
  PolyfenceDebugInfo,
  PolyfenceSystemStatus,
  PolyfencePerformanceMetrics,
  PolyfenceBatteryMetrics,
  PolyfenceZoneStatus,
  ZoneState,
  SessionTelemetry,
  HealthScoreEvent,
  Subscription,
  BatteryOptimizationStatus,
  ProximitySettings,
  MovementSettings,
  BatterySettings,
  DwellSettings,
  ClusterSettings,
  ScheduleSettings,
  TimeWindow,
  ActivitySettings,
} from './types';
