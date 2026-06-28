import { DeviceEventEmitter } from 'react-native';
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

// Both platforms emit through `RCTDeviceEventEmitter.emit` on the native
// side (Android: PolyfenceModule.kt:597-608; iOS: PolyfenceModule.swift
// `emit` helper). So we subscribe through the matching `DeviceEventEmitter`
// on the JS side regardless of platform — no NativeEventEmitter handshake,
// no RCTEventEmitter listener-count gate, no react-native#41394 fallout
// under RN 0.76+ Bridgeless / New Architecture.
const emitter = DeviceEventEmitter;

// Valid geofence event types: enter, exit, dwell, recoveryEnter, recoveryExit
// Normalization uses parseGeofenceEventType() below (unknown → dropped).

/** Map native error codes/keys to the public PolyfenceErrorType union. */
const NATIVE_CODE_TO_TYPE: Record<string, PolyfenceErrorType> = {
  permission_denied: 'gpsPermissionDenied',
  location_disabled: 'gpsServiceDisabled',
  activity_recognition_unavailable: 'unknown',
  configuration_error: 'unknown',
  zone_error: 'zoneValidationFailed',
  // polyfence-core LocationTracker.addZone surfaces zone validation
  // failures via PolyfenceErrorManager.reportError("zone_validation_failed",
  // ...) on both platforms. Without this mapping the onError event still
  // fires but JS consumers receive type: 'unknown'. BUG-006 (RN companion).
  zone_validation_failed: 'zoneValidationFailed',
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

function addListener<T>(
  eventName: string,
  callback: (data: T) => void,
): Subscription {
  const sub = emitter.addListener(eventName, callback);
  return {
    remove: () => {
      sub.remove();
    },
  };
}

/** Collapse native variants (ENTER, recovery_enter, etc.) to a single upper key. */
function canonicalGeofenceTypeKey(raw: string): string {
  return raw.trim().replace(/\s+/g, '_').toUpperCase();
}

/**
 * Parses native `eventType` strings. Unknown or empty payloads return null —
 * callers must not pretend a bogus event was an ENTER (old default masked EXIT).
 */
function parseGeofenceEventType(raw: string): GeofenceEventType | null {
  const key = canonicalGeofenceTypeKey(raw);
  const mapping: Record<string, GeofenceEventType> = {
    ENTER: 'enter',
    EXIT: 'exit',
    DWELL: 'dwell',
    RECOVERY_ENTER: 'recoveryEnter',
    RECOVERY_EXIT: 'recoveryExit',
  };
  return mapping[key] ?? null;
}

function normalizeGeofenceEvent(
  raw: Record<string, unknown>,
): GeofenceEvent | null {
  const rawType = (raw.eventType as string | undefined) ?? '';
  const type = parseGeofenceEventType(rawType);
  if (type === null || rawType.trim() === '') {
    // Visibility-over-silence: emit a __DEV__ warning when we drop a non-empty
    // unknown eventType so a future native value the bridge hasn't been updated
    // for surfaces in the console rather than disappearing. Empty strings are
    // absence, not malformedness — those stay silent.
    if (__DEV__ && rawType.trim() !== '') {
      console.warn(
        `[Polyfence] dropped geofence event with unknown eventType=${JSON.stringify(
          rawType,
        )} ` +
          `for zoneId=${JSON.stringify(raw.zoneId ?? null)}. ` +
          'Expected one of: ENTER, EXIT, DWELL, RECOVERY_ENTER, RECOVERY_EXIT.',
      );
    }
    return null;
  }

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
export function normalizePolyfenceError(
  raw: Record<string, unknown>,
): PolyfenceError {
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
    'gpsTimeout',
    'gpsPermissionDenied',
    'gpsServiceDisabled',
    'gpsAccuracyPoor',
    'gpsUnreliable',
    'serviceStartFailed',
    'serviceKilled',
    'serviceRestartFailed',
    'batteryOptimizationRequired',
    'lowBattery',
    'zoneValidationFailed',
    'zoneStorageFailed',
    'zoneLoadFailed',
    'networkTimeout',
    'analyticsUploadFailed',
    'permissionRevoked',
    'memoryLow',
    'unknown',
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
    correlationId:
      typeof raw.correlationId === 'string' ? raw.correlationId : undefined,
  };
}

export function onLocationUpdate(
  callback: (location: PolyfenceLocation) => void,
): Subscription {
  return addListener('onLocation', callback);
}

export function onGeofenceEvent(
  callback: (event: GeofenceEvent) => void,
): Subscription {
  return addListener('onGeofenceEvent', (raw: Record<string, unknown>) => {
    const event = normalizeGeofenceEvent(raw);
    if (event !== null) {
      callback(event);
    }
  });
}

export function onError(
  callback: (error: PolyfenceError) => void,
): Subscription {
  return addListener('onError', (raw: Record<string, unknown>) => {
    callback(normalizePolyfenceError(raw));
  });
}

export function onPerformance(
  callback: (payload: PerformanceEventPayload) => void,
): Subscription {
  return addListener('onPerformance', callback);
}

/**
 * Subscribe to health score updates (emitted every 5 minutes by polyfence-core).
 * Filters onPerformance events for `type: "health_score"`.
 */
export function onHealthScore(
  callback: (event: HealthScoreEvent) => void,
): Subscription {
  return addListener('onPerformance', (raw: Record<string, unknown>) => {
    if (raw.type === 'health_score') {
      callback({
        score: (raw.score as number) ?? 0,
        topIssue:
          typeof raw.topIssue === 'string' && raw.topIssue.length > 0
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
