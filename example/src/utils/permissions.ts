import { Platform } from 'react-native';
import {
  request,
  check,
  PERMISSIONS,
  RESULTS,
  openSettings,
  requestNotifications,
  checkNotifications,
} from 'react-native-permissions';

export interface PermissionState {
  location: boolean;
  backgroundLocation: boolean;
  activityRecognition: boolean;
  notification: boolean;
}

/**
 * Request the permissions geofence tracking needs.
 *
 * Foreground location is the whole requirement: the tracker runs as a
 * foreground service typed `location` on Android and accepts "When In Use" on
 * iOS, so neither platform needs a background grant to detect crossings.
 *
 * The background grant buys exactly one thing — OS wake fences
 * (`osGeofenceWakeEnabled`), which capture a crossing after the app's process
 * is killed. It is requested only when `osGeofenceWakeEnabled` is `true`, and
 * never otherwise: on Android, requesting `ACCESS_BACKGROUND_LOCATION` once it
 * has been denied shows no prompt and sends the user to the system settings
 * screen, so a request "just in case" is a visible detour with nothing behind
 * it — and declaring the permission at all puts the app into Google Play's
 * manual background-location review.
 *
 * A denied background grant is not fatal. Tracking runs on the foreground
 * grant, wake fences degrade to polling, and the engine reports the
 * degradation as an `osGeofencePermissionDenied` error — so this returns the
 * state rather than blocking.
 */
export async function requestTrackingPermissions({
  osGeofenceWakeEnabled = false,
}: { osGeofenceWakeEnabled?: boolean } = {}): Promise<PermissionState> {
  const state: PermissionState = {
    location: false,
    backgroundLocation: false,
    activityRecognition: false,
    notification: false,
  };

  if (Platform.OS === 'android') {
    // Notifications (Android 13+)
    const notifResult = await requestNotifications(['alert', 'sound']);
    state.notification = notifResult.status === RESULTS.GRANTED;

    // Fine location
    const fineResult = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    state.location = fineResult === RESULTS.GRANTED;

    if (!state.location) return state;

    if (osGeofenceWakeEnabled) {
      // Background location (requires fine location first)
      const bgResult = await request(
        PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
      );
      state.backgroundLocation = bgResult === RESULTS.GRANTED;

      if (!state.backgroundLocation) {
        // Some OEMs only expose the "Allow all the time" toggle in settings.
        // Tracking is already usable at this point, so this is an offer to
        // restore wake coverage rather than a gate on continuing.
        await openSettings();
      }
    }

    // Activity recognition (optional)
    const actResult = await request(
      PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION,
    );
    state.activityRecognition = actResult === RESULTS.GRANTED;
  } else if (Platform.OS === 'ios') {
    // "When In Use" is enough for tracking; "Always" is what wake fences need,
    // because region callbacks after process death cannot be delivered under
    // "When In Use".
    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    state.location = whenInUse === RESULTS.GRANTED;

    if (state.location && osGeofenceWakeEnabled) {
      const always = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);
      state.backgroundLocation = always === RESULTS.GRANTED;
    }

    // Motion (activity recognition equivalent)
    const motion = await request(PERMISSIONS.IOS.MOTION);
    state.activityRecognition = motion === RESULTS.GRANTED;

    // Notifications
    const notifResult = await requestNotifications(['alert', 'sound', 'badge']);
    state.notification = notifResult.status === RESULTS.GRANTED;
  }

  return state;
}

/**
 * Check current permission state without requesting.
 *
 * `backgroundLocation` is reported for diagnostics whether or not wake fences
 * are enabled — `check` never prompts, so reading it costs the user nothing.
 * It is not part of what tracking requires.
 */
export async function checkPermissions(): Promise<PermissionState> {
  const state: PermissionState = {
    location: false,
    backgroundLocation: false,
    activityRecognition: false,
    notification: false,
  };

  if (Platform.OS === 'android') {
    const fine = await check(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
    state.location = fine === RESULTS.GRANTED;

    const bg = await check(PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION);
    state.backgroundLocation = bg === RESULTS.GRANTED;

    const act = await check(PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION);
    state.activityRecognition = act === RESULTS.GRANTED;
  } else if (Platform.OS === 'ios') {
    const whenInUse = await check(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    state.location = whenInUse === RESULTS.GRANTED;

    const always = await check(PERMISSIONS.IOS.LOCATION_ALWAYS);
    state.backgroundLocation = always === RESULTS.GRANTED;

    const motion = await check(PERMISSIONS.IOS.MOTION);
    state.activityRecognition = motion === RESULTS.GRANTED;
  }

  // Notification status (same API on both platforms; does not prompt).
  try {
    const notif = await checkNotifications();
    state.notification = notif.status === RESULTS.GRANTED;
  } catch {
    // Leave as false if the check is unavailable.
  }

  return state;
}
