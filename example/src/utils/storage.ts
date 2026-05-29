import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppGeofenceEvent } from '../types';

const KEYS = {
  events: 'polyfence_events',
  registeredZoneIds: 'registered_zone_ids',
  isTracking: 'is_tracking',
};

// Event persistence (mirrors Flutter SharedPreferences pattern)

export async function loadStoredEvents(): Promise<AppGeofenceEvent[]> {
  try {
    const json = await AsyncStorage.getItem(KEYS.events);
    if (!json) return [];
    const raw: Array<Record<string, string>> = JSON.parse(json);
    return raw.map((e) => ({
      id: e.id ?? String(Date.now()),
      timestamp: new Date(e.timestamp ?? Date.now()),
      type: (e.type as AppGeofenceEvent['type']) ?? 'enter',
      zoneName: e.zoneName ?? 'Unknown',
      zoneId: e.zoneId ?? 'unknown',
      message: e.message,
    }));
  } catch {
    return [];
  }
}

export async function saveEvents(events: AppGeofenceEvent[]): Promise<void> {
  try {
    const serializable = events.map((e) => ({
      id: e.id,
      timestamp: e.timestamp.toISOString(),
      type: e.type,
      zoneName: e.zoneName,
      zoneId: e.zoneId,
      message: e.message,
    }));
    await AsyncStorage.setItem(KEYS.events, JSON.stringify(serializable));
  } catch {
    // Silently fail — persistence is best-effort
  }
}

// Zone ID tracking (for delta sync)

export async function loadRegisteredZoneIds(): Promise<Set<string>> {
  try {
    const json = await AsyncStorage.getItem(KEYS.registeredZoneIds);
    if (!json) return new Set();
    const ids: string[] = JSON.parse(json);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

export async function saveRegisteredZoneIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(
      KEYS.registeredZoneIds,
      JSON.stringify([...ids]),
    );
  } catch {
    // Best-effort
  }
}

// Tracking state persistence

export async function loadTrackingState(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(KEYS.isTracking);
    return value === 'true';
  } catch {
    return false;
  }
}

export async function saveTrackingState(isTracking: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.isTracking, String(isTracking));
  } catch {
    // Best-effort
  }
}
