import { NativeEventEmitter, NativeModules } from 'react-native';
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
const emitter = new NativeEventEmitter(NativePolyfence);

const GEOFENCE_EVENT_TYPES: ReadonlySet<string> = new Set<GeofenceEventType>([
  'enter',
  'exit',
  'dwell',
  'recovery_enter',
  'recovery_exit',
]);

/** Map native error codes/keys to the public PolyfenceErrorType union. */
const NATIVE_CODE_TO_TYPE: Record<string, PolyfenceErrorType> = {
  permission_denied: 'permission_denied',
  location_disabled: 'location_disabled',
  activity_recognition_unavailable: 'activity_recognition_unavailable',
  configuration_error: 'configuration_error',
  zone_error: 'zone_error',
  tracking_error: 'tracking_error',
  network_error: 'network_error',
  gps_permission_denied: 'permission_denied',
  gps_service_disabled: 'location_disabled',
  permission_revoked: 'permission_denied',
  battery_optimization_required: 'tracking_error',
  battery_check_failed: 'unknown',
};

function addListener<T>(eventName: string, callback: (data: T) => void): Subscription {
  const sub = emitter.addListener(eventName, callback);
  return {
    remove: () => {
      sub.remove();
    },
  };
}

function normalizeGeofenceEvent(raw: Record<string, unknown>): GeofenceEvent {
  const rawType = (raw.eventType as string | undefined)?.toLowerCase() ?? '';
  const type: GeofenceEventType = GEOFENCE_EVENT_TYPES.has(rawType)
    ? (rawType as GeofenceEventType)
    : 'enter';

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

  const ALLOWED_ERROR_TYPES: ReadonlySet<string> = new Set<PolyfenceErrorType>([
    'permission_denied',
    'location_disabled',
    'activity_recognition_unavailable',
    'configuration_error',
    'zone_error',
    'tracking_error',
    'network_error',
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
  const details: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!skip.has(key)) {
      details[key] = value;
    }
  }

  return {
    type,
    message,
    code: codeStr,
    details: Object.keys(details).length > 0 ? details : undefined,
  };
}

export function onLocation(callback: (location: PolyfenceLocation) => void): Subscription {
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
