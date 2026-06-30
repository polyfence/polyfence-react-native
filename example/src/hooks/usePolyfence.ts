import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import { Polyfence } from 'polyfence-react-native';
import type {
  Zone,
  PolyfenceLocation,
  GeofenceEvent,
  AccuracyProfile,
  Subscription,
} from 'polyfence-react-native';
import type { AppZone, AppGeofenceEvent, GpsProfile, LatLng } from '../types';
import { GPS_PROFILES } from '../types';
import { fetchActiveZones } from '../services/ZoneApiService';
import { logDebug } from '../services/logger';
import { distanceToZone } from '../utils/distance';
import {
  requestTrackingPermissions,
  checkPermissions,
  type PermissionState,
} from '../utils/permissions';
import {
  loadStoredEvents,
  saveEvents,
  loadRegisteredZoneIds,
  saveRegisteredZoneIds,
  saveTrackingState,
} from '../utils/storage';

const MAX_EVENTS = 100;

// How long tracking may run with zero native->JS signals before the event
// bridge is flagged as likely dead. A silent New-Architecture drop throws
// nothing (and onError rides the same channel), so it can only be caught by
// absence — this turns that silence into a visible banner.
const EVENT_WATCHDOG_MS = 30000;

export interface PolyfenceState {
  // Tracking
  isTracking: boolean;
  isInitialized: boolean;

  // Location
  location: LatLng | null;
  accuracy: number | null;
  speed: number;
  activity: string;
  locationStatus: string;

  // GPS profile
  gpsProfile: GpsProfile;

  // Zones
  zones: AppZone[];
  rawZones: Zone[];
  isLoadingZones: boolean;

  // Events
  events: AppGeofenceEvent[];

  // Errors
  errors: AppGeofenceEvent[];
}

export interface PolyfenceActions {
  toggleTracking: () => Promise<void>;
  setGpsProfile: (profile: GpsProfile) => Promise<void>;
  refreshZones: () => Promise<void>;
  clearEvents: () => void;
  dismissError: (id: string) => void;
  clearErrors: () => void;
}

export function usePolyfence(): [PolyfenceState, PolyfenceActions] {
  const polyfence = useRef(Polyfence.instance);
  const subscriptions = useRef<Subscription[]>([]);

  const [isTracking, setIsTracking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [location, setLocation] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);
  const [activity, setActivity] = useState('unknown');
  const [locationStatus, setLocationStatus] = useState('Waiting for GPS...');

  const [gpsProfile, setGpsProfileState] = useState<GpsProfile>('balanced');

  const [rawZones, setRawZones] = useState<Zone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(true);

  const [events, setEvents] = useState<AppGeofenceEvent[]>([]);
  const [errors, setErrors] = useState<AppGeofenceEvent[]>([]);

  // Stable ref for location (used in zone distance calc)
  const locationRef = useRef<LatLng | null>(null);
  locationRef.current = location;

  const rawZonesRef = useRef<Zone[]>([]);
  rawZonesRef.current = rawZones;

  const locationUpdateCount = useRef(0);

  // Watchdog timer + liveness flag for the native->JS event bridge.
  const eventWatchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bridgeSignalSeen = useRef(false);

  // Add error helper
  const addError = useCallback((message: string) => {
    logDebug(`Error: ${message}`, 'error');
    setErrors((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date(),
        type: 'error' as const,
        zoneName: 'System',
        zoneId: 'system',
        message,
      },
    ]);
  }, []);

  // Watchdog for a silently-dead native->JS event bridge. startTracking can
  // succeed natively while no location/geofence events ever reach JS (e.g. a
  // dropped emit under the New Architecture). Nothing throws, so detect it by
  // the absence of any signal within EVENT_WATCHDOG_MS of tracking start.
  const clearEventWatchdog = useCallback(() => {
    if (eventWatchdog.current) {
      clearTimeout(eventWatchdog.current);
      eventWatchdog.current = null;
    }
  }, []);

  // Any native->JS signal marks the bridge alive and cancels a pending warning.
  const markBridgeAlive = useCallback(() => {
    bridgeSignalSeen.current = true;
    clearEventWatchdog();
  }, [clearEventWatchdog]);

  const startEventWatchdog = useCallback(() => {
    bridgeSignalSeen.current = false;
    clearEventWatchdog();
    eventWatchdog.current = setTimeout(() => {
      if (!bridgeSignalSeen.current) {
        addError(
          `Tracking started but no location updates or geofence events arrived in ${Math.round(
            EVENT_WATCHDOG_MS / 1000,
          )}s — the SDK's native->JS event bridge may be down (events can be dropped silently under the New Architecture). Check the polyfence-react-native build.`,
        );
      }
    }, EVENT_WATCHDOG_MS);
  }, [addError, clearEventWatchdog]);

  // Surface permission gaps through the existing error banner so a silent
  // background-geofencing failure becomes a visible, actionable message.
  // Deduped per capability (a ref, not state) so foreground re-checks don't
  // re-spam the banner; resolving a gap re-arms it for future regressions.
  const permissionWarned = useRef({ background: false, notification: false });
  const surfacePermissionGaps = useCallback(
    (perms: PermissionState) => {
      if (!perms.backgroundLocation && !permissionWarned.current.background) {
        permissionWarned.current.background = true;
        addError(
          Platform.OS === 'ios'
            ? "Location is 'While Using' only — iOS will not deliver zone enter/exit events or notifications in the background. Set Location to 'Always' in Settings > Polyfence RN Example > Location, then reopen the app."
            : "Background location not granted — enter/exit events will not fire while the app is backgrounded. Choose 'Allow all the time' in Settings > Polyfence RN Example > Location, then reopen the app.",
        );
      } else if (perms.backgroundLocation) {
        permissionWarned.current.background = false;
      }

      if (!perms.notification && !permissionWarned.current.notification) {
        permissionWarned.current.notification = true;
        addError(
          'Notifications are disabled — zone enter/exit alerts will not show. Enable them in Settings > Polyfence RN Example > Notifications.',
        );
      } else if (perms.notification) {
        permissionWarned.current.notification = false;
      }
    },
    [addError],
  );

  // Add event helper
  const addEvent = useCallback(
    (event: AppGeofenceEvent) => {
      setEvents((prev) => {
        const next = [event, ...prev].slice(0, MAX_EVENTS);
        saveEvents(next);
        return next;
      });
    },
    [],
  );

  // Get zone name from ID
  const getZoneName = useCallback(
    (zoneId: string): string => {
      const zone = rawZonesRef.current.find((z) => z.id === zoneId);
      return zone?.name ?? zoneId;
    },
    [],
  );

  // Compute app zones with distances
  const computeAppZones = useCallback((): AppZone[] => {
    const loc = locationRef.current;
    return rawZonesRef.current.map((zone) => {
      let distance: number | undefined;
      if (loc) {
        distance = distanceToZone(loc, zone);
      }
      return {
        id: zone.id,
        name: zone.name,
        type: zone.type,
        center: zone.center,
        radius: zone.radius,
        polygon: zone.polygon,
        distance,
        isInside: distance === 0,
      };
    });
  }, []);

  // Load zones from API with delta sync
  const refreshZones = useCallback(async () => {
    setIsLoadingZones(true);
    try {
      const previousIds = await loadRegisteredZoneIds();
      const zones = await fetchActiveZones();
      const currentIds = new Set(zones.map((z) => z.id));

      // Remove deleted zones
      for (const zoneId of previousIds) {
        if (!currentIds.has(zoneId)) {
          try {
            await polyfence.current.removeZone(zoneId);
          } catch (e: unknown) {
            addError(`Failed to remove zone ${zoneId}: ${e}`);
          }
        }
      }

      // Add all zones (plugin handles deduplication)
      for (const zone of zones) {
        try {
          await polyfence.current.addZone(zone);
        } catch (e: unknown) {
          addError(`Failed to add zone ${zone.name}: ${e}`);
        }
      }

      await saveRegisteredZoneIds(currentIds);
      setRawZones(zones);
      logDebug(`Loaded ${zones.length} zones`, 'info');
    } catch (e: unknown) {
      addError(`Failed to load zones: ${e}`);
    } finally {
      setIsLoadingZones(false);
    }
  }, [addError]);

  // Initialize
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // Subscribe to errors FIRST — onError is the SDK's central error
        // channel. Several methods called below (initialize,
        // updateConfiguration, addZone via refreshZones) can emit errors
        // as a side effect; if no listener is attached at the time, those
        // errors are silently dropped (BUG-011). Subscribing here so the
        // listener is live before any SDK method that may emit.
        const errSub = polyfence.current.onError((error) => {
          if (!mounted) return;
          addError(error.message);
        });

        // Request permissions before initialize
        const perms = await requestTrackingPermissions();
        if (!perms.location) {
          addError(
            'Location permission denied — tracking cannot start. Grant location access in Settings, then reopen the app.',
          );
          // Don't leak the error subscription if we bail.
          errSub.remove();
          return;
        }

        // When-In-Use is enough to start, but background geofencing and
        // notifications silently no-op without "Always" + notification
        // permission. Surface exactly what is missing instead of failing quietly.
        surfacePermissionGaps(perms);

        // Initialize polyfence
        await polyfence.current.initialize();
        logDebug('Polyfence initialized', 'info');

        // Configure SmartGPS intelligent strategy
        await polyfence.current.updateConfiguration({
          updateStrategy: 'intelligent',
          clusteringEnabled: true,
          clusterSettings: {
            enabled: true,
            activeRadiusMeters: 5000,
          },
          activitySettings: {
            enabled: true,
            confidenceThreshold: 75,
            debounceSeconds: 10,
          },
        });

        // Load stored events
        const storedEvents = await loadStoredEvents();
        if (mounted) setEvents(storedEvents);

        // Load zones from API
        await refreshZones();


        // Subscribe to location updates
        const locSub = polyfence.current.onLocationUpdate(
          (loc: PolyfenceLocation) => {
            if (!mounted) return;
            markBridgeAlive();
            const latLng: LatLng = {
              latitude: loc.latitude,
              longitude: loc.longitude,
            };
            setLocation(latLng);
            setAccuracy(loc.accuracy ?? null);
            setSpeed(loc.speed ?? 0);
            if (loc.activity) {
              setActivity(loc.activity);
            }
            setLocationStatus(
              `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`,
            );

            // Log every 10th location update to avoid flooding
            locationUpdateCount.current++;
            if (locationUpdateCount.current % 10 === 0) {
              const acc = loc.accuracy != null ? Math.round(loc.accuracy) : '?';
              logDebug(
                `Location: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)} (+-${acc}m)`,
                'debug',
              );
            }
          },
        );

        // Subscribe to geofence events
        const geoSub = polyfence.current.onGeofenceEvent(
          (event: GeofenceEvent) => {
            if (!mounted) return;
            markBridgeAlive();
            const zoneName = getZoneName(event.zoneId);
            const appEvent: AppGeofenceEvent = {
              id: String(Date.now()),
              timestamp: new Date(),
              type: event.type === 'enter' || event.type === 'recoveryEnter'
                ? 'enter'
                : event.type === 'dwell'
                  ? 'dwell'
                  : 'exit',
              zoneName,
              zoneId: event.zoneId,
            };
            logDebug(`Geofence: ${event.type} ${zoneName}`, 'info');
            addEvent(appEvent);
          },
        );

        // errSub is already subscribed at the top of init — see the
        // BUG-011 comment there for the reasoning.

        // Subscribe to performance (health score, runtime status)
        const perfSub = polyfence.current.onPerformance((_payload) => {
          if (!mounted) return;
          // Activity is now extracted from onLocation events (loc.activity)
        });

        subscriptions.current = [locSub, geoSub, errSub, perfSub];

        if (mounted) setIsInitialized(true);
      } catch (e: unknown) {
        if (mounted) addError(`Failed to initialize Polyfence: ${e}`);
      }
    }

    init();

    return () => {
      mounted = false;
      subscriptions.current.forEach((s) => s.remove());
      subscriptions.current = [];
      clearEventWatchdog();
    };
  }, [
    addError,
    addEvent,
    getZoneName,
    refreshZones,
    surfacePermissionGaps,
    markBridgeAlive,
    clearEventWatchdog,
  ]);

  // Re-evaluate permissions when the app returns to the foreground, so that
  // flipping Location to "Always" (or enabling notifications) in Settings and
  // coming back clears the warning — and a regression re-surfaces it.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        checkPermissions().then(surfacePermissionGaps).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [surfacePermissionGaps]);

  // Toggle tracking
  const toggleTracking = useCallback(async () => {
    try {
      if (isTracking) {
        await polyfence.current.stopTracking();
        logDebug('Tracking stopped', 'info');
        setIsTracking(false);
        setSpeed(0);
        clearEventWatchdog();
        await saveTrackingState(false);
      } else {
        await polyfence.current.startTracking();
        logDebug('Tracking started', 'info');
        setIsTracking(true);
        startEventWatchdog();
        await saveTrackingState(true);
      }
    } catch (e: unknown) {
      addError(`Failed to toggle tracking: ${e}`);
    }
  }, [isTracking, addError, startEventWatchdog, clearEventWatchdog]);

  // Set GPS profile
  const setGpsProfile = useCallback(
    async (profile: GpsProfile) => {
      try {
        const accuracyProfile: AccuracyProfile =
          GPS_PROFILES[profile].accuracyProfile;
        await polyfence.current.setAccuracyProfile(accuracyProfile);
        logDebug(`GPS profile: ${profile}`, 'info');
        setGpsProfileState(profile);
      } catch (e: unknown) {
        addError(`Failed to set GPS profile: ${e}`);
      }
    },
    [addError],
  );

  // Clear events
  const clearEvents = useCallback(() => {
    setEvents([]);
    saveEvents([]);
  }, []);

  // Dismiss a single error by id.
  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Clear every error at once — wired to the banner's "Clear All" button.
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const state: PolyfenceState = {
    isTracking,
    isInitialized,
    location,
    accuracy,
    speed,
    activity,
    locationStatus,
    gpsProfile,
    zones: computeAppZones(),
    rawZones,
    isLoadingZones,
    events,
    errors,
  };

  const actions: PolyfenceActions = {
    toggleTracking,
    setGpsProfile,
    refreshZones,
    clearEvents,
    dismissError,
    clearErrors,
  };

  return [state, actions];
}
