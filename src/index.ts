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
// initialization in non-RN test environments. Import directly:
// import { PolyfenceDebugOverlay } from 'polyfence-react-native/src/DebugOverlay';
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
