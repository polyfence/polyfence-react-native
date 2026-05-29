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

/** Request all permissions needed for geofence tracking. */
export async function requestTrackingPermissions(): Promise<PermissionState> {
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

    // Background location (requires fine location first)
    const bgResult = await request(
      PERMISSIONS.ANDROID.ACCESS_BACKGROUND_LOCATION,
    );
    state.backgroundLocation = bgResult === RESULTS.GRANTED;

    if (!state.backgroundLocation) {
      // Some OEMs require settings
      await openSettings();
      return state;
    }

    // Activity recognition (optional)
    const actResult = await request(
      PERMISSIONS.ANDROID.ACTIVITY_RECOGNITION,
    );
    state.activityRecognition = actResult === RESULTS.GRANTED;
  } else if (Platform.OS === 'ios') {
    // iOS: request when-in-use first, then always
    const whenInUse = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    state.location = whenInUse === RESULTS.GRANTED;

    if (state.location) {
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

/** Check current permission state without requesting. */
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
