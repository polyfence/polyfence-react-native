import { DeviceEventEmitter, Platform, NativeEventEmitter, NativeModules } from 'react-native';
import type {
  GeofenceEvent,
  GeofenceEventType,
  HealthScoreEvent,
  PolyfenceLocation,
  PolyfenceError,
  PolyfenceErrorType,
  PerformanceEventPayload,
  Subscription,
} from './types';

const { Polyfence: NativePolyfence } = NativeModules;

// Android Bridgeless mode: RCTDeviceEventEmitter events don't reach NativeEventEmitter.
// Use DeviceEventEmitter directly on Android; NativeEventEmitter on iOS (required for RCTEventEmitter).
const emitter = Platform.OS === 'android'
  ? DeviceEventEmitter
  : new NativeEventEmitter(NativePolyfence);

// Valid geofence event types: enter, exit, dwell, recoveryEnter, recoveryExit
// Normalization uses the mapping in normalizeEventType() below.

/** Map native error codes/keys to the public PolyfenceErrorType union. */
const NATIVE_CODE_TO_TYPE: Record<string, PolyfenceErrorType> = {
  permission_denied: 'gpsPermissionDenied',
  location_disabled: 'gpsServiceDisabled',
  activity_recognition_unavailable: 'unknown',
  configuration_error: 'unknown',
  zone_error: 'zoneValidationFailed',
  tracking_error: 'serviceStartFailed',
  network_error: 'networkTimeout',
  gps_permission_denied: 'gpsPermissionDenied',
  gps_service_disabled: 'gpsServiceDisabled',
  permission_revoked: 'permissionRevoked',
  battery_optimization_required: 'batteryOptimizationRequired',
  battery_check_failed: 'unknown',
  gps_timeout: 'gpsTimeout',
  gps_accuracy_poor: 'gpsAccuracyPoor',
  gps_unreliable: 'gpsUnreliable',
  service_start_failed: 'serviceStartFailed',
  service_killed: 'serviceKilled',
  service_restart_failed: 'serviceRestartFailed',
  low_battery: 'lowBattery',
  zone_storage_failed: 'zoneStorageFailed',
  zone_load_failed: 'zoneLoadFailed',
  analytics_upload_failed: 'analyticsUploadFailed',
  memory_low: 'memoryLow',
};

function addListener<T>(eventName: string, callback: (data: T) => void): Subscription {
  const sub = emitter.addListener(eventName, callback);
  return {
    remove: () => {
      sub.remove();
    },
  };
}

function normalizeEventType(raw: string): GeofenceEventType {
  const mapping: Record<string, GeofenceEventType> = {
    'enter': 'enter',
    'exit': 'exit',
    'dwell': 'dwell',
    'recovery_enter': 'recoveryEnter',
    'recovery_exit': 'recoveryExit',
    // Handle uppercase from native
    'ENTER': 'enter',
    'EXIT': 'exit',
    'DWELL': 'dwell',
    'RECOVERY_ENTER': 'recoveryEnter',
    'RECOVERY_EXIT': 'recoveryExit',
  };
  return mapping[raw] ?? 'enter';
}

function normalizeGeofenceEvent(raw: Record<string, unknown>): GeofenceEvent {
  const rawType = (raw.eventType as string | undefined) ?? '';
  const type: GeofenceEventType = normalizeEventType(rawType);

  return {
    zoneId: raw.zoneId as string,
    zoneName: (raw.zoneName as string) ?? '',
    type,
    location: {
      latitude: (raw.latitude as number) ?? 0,
      longitude: (raw.longitude as number) ?? 0,
      accuracy: (raw.gpsAccuracy as number) ?? 0,
      speed: raw.speedMps as number | undefined,
      timestamp: (raw.timestamp as number) ?? Date.now(),
    },
    timestamp: (raw.timestamp as number) ?? Date.now(),
    confidence: raw.confidence as number | undefined,
    dwellDurationMs: raw.dwellDurationMs as number | undefined,
  };
}

/**
 * Normalize native error maps (`code` / `type` from core) to {@link PolyfenceError}.
 */
export function normalizePolyfenceError(raw: Record<string, unknown>): PolyfenceError {
  const message =
    typeof raw.message === 'string'
      ? raw.message
      : typeof raw.code === 'string'
        ? raw.code
        : 'Unknown error';

  const codeStr =
    typeof raw.code === 'string'
      ? raw.code
      : typeof raw.type === 'string'
        ? raw.type
        : undefined;

  // All 18 Flutter-aligned error types
  const ALLOWED_ERROR_TYPES: ReadonlySet<string> = new Set<PolyfenceErrorType>([
    'gpsTimeout', 'gpsPermissionDenied', 'gpsServiceDisabled', 'gpsAccuracyPoor', 'gpsUnreliable',
    'serviceStartFailed', 'serviceKilled', 'serviceRestartFailed',
    'batteryOptimizationRequired', 'lowBattery',
    'zoneValidationFailed', 'zoneStorageFailed', 'zoneLoadFailed',
    'networkTimeout', 'analyticsUploadFailed',
    'permissionRevoked', 'memoryLow', 'unknown',
  ]);

  let type: PolyfenceErrorType = 'unknown';
  const nativeType = typeof raw.type === 'string' ? raw.type : undefined;
  if (nativeType && ALLOWED_ERROR_TYPES.has(nativeType)) {
    type = nativeType as PolyfenceErrorType;
  }
  if (type === 'unknown' && codeStr) {
    const mapped = NATIVE_CODE_TO_TYPE[codeStr];
    if (mapped) {
      type = mapped;
    }
  }

  const skip = new Set(['type', 'message', 'code']);
  const context: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!skip.has(key)) {
      context[key] = value;
    }
  }

  return {
    type,
    message,
    context: Object.keys(context).length > 0 ? context : undefined,
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
    correlationId: typeof raw.correlationId === 'string' ? raw.correlationId : undefined,
  };
}

export function onLocationUpdate(callback: (location: PolyfenceLocation) => void): Subscription {
  return addListener('onLocation', callback);
}

export function onGeofenceEvent(callback: (event: GeofenceEvent) => void): Subscription {
  return addListener('onGeofenceEvent', (raw: Record<string, unknown>) => {
    callback(normalizeGeofenceEvent(raw));
  });
}

export function onError(callback: (error: PolyfenceError) => void): Subscription {
  return addListener('onError', (raw: Record<string, unknown>) => {
    callback(normalizePolyfenceError(raw));
  });
}

export function onPerformance(callback: (payload: PerformanceEventPayload) => void): Subscription {
  return addListener('onPerformance', callback);
}

/**
 * Subscribe to health score updates (emitted every 5 minutes by polyfence-core).
 * Filters onPerformance events for `type: "health_score"`.
 */
export function onHealthScore(callback: (event: HealthScoreEvent) => void): Subscription {
  return addListener('onPerformance', (raw: Record<string, unknown>) => {
    if (raw.type === 'health_score') {
      callback({
        score: (raw.score as number) ?? 0,
        topIssue: typeof raw.topIssue === 'string' && raw.topIssue.length > 0
          ? raw.topIssue
          : null,
        timestamp: (raw.timestamp as number) ?? Date.now(),
      });
    }
  });
}

export function removeAllListeners(): void {
  emitter.removeAllListeners('onLocation');
  emitter.removeAllListeners('onGeofenceEvent');
  emitter.removeAllListeners('onError');
  emitter.removeAllListeners('onPerformance');
}
