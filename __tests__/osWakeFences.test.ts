import { NativeModules } from 'react-native';
import { Polyfence } from '../src/Polyfence';
import { normalizePolyfenceError } from '../src/events';
import type { PolyfenceConfiguration } from '../src/types';

/**
 * The OS wake-fence surface sits across three layers (Jest, Kotlin, Swift).
 * The permission half has Kotlin and Swift counterparts in
 * `PolyfenceModulePermissionGateTest.kt` and the polyfence-core matrix; this
 * file covers the JS-visible half — config pass-through, the health field, and
 * the error types that report degradation.
 */
describe('OS wake fences', () => {
  const NativePolyfence = NativeModules.Polyfence;

  const resetSingleton = () => {
    (Polyfence as unknown as { _instance: Polyfence | null })._instance = null;
  };

  beforeEach(async () => {
    resetSingleton();
    jest.clearAllMocks();
  });

  describe('configuration pass-through', () => {
    it('propagates osGeofenceWakeEnabled from initialize() unchanged', async () => {
      const config: PolyfenceConfiguration = {
        osGeofenceWakeEnabled: true,
        pendingEventsQueueSize: 500,
      };
      await Polyfence.instance.initialize(config);
      expect(NativePolyfence.initialize).toHaveBeenCalledWith({ config });
    });

    it('propagates both keys through updateConfiguration()', async () => {
      await Polyfence.instance.initialize();
      jest.clearAllMocks();

      await Polyfence.instance.updateConfiguration({
        osGeofenceWakeEnabled: true,
        osGeofenceMaxRegions: 30,
      });
      expect(NativePolyfence.updateConfiguration).toHaveBeenCalledWith({
        osGeofenceWakeEnabled: true,
        osGeofenceMaxRegions: 30,
      });
    });

    it('passes an out-of-range osGeofenceMaxRegions through without clamping', async () => {
      // The native engine clamps into the platform's usable range (Android
      // caps at 100, iOS at 20) and reports the effective budget back through
      // getConfiguration(). Clamping here as well would produce two answers
      // for one question, and the bridge cannot know which platform it is
      // clamping for.
      await Polyfence.instance.initialize();
      jest.clearAllMocks();

      await Polyfence.instance.updateConfiguration({
        osGeofenceMaxRegions: 5000,
      });
      expect(NativePolyfence.updateConfiguration).toHaveBeenCalledWith({
        osGeofenceMaxRegions: 5000,
      });
    });

    it('omitting both keys sends nothing for them', async () => {
      // Absent must stay absent: emitting a default here would force one
      // platform's slot budget onto the other.
      await Polyfence.instance.initialize();
      jest.clearAllMocks();

      await Polyfence.instance.updateConfiguration({
        gpsAccuracyThreshold: 50,
      });
      const sent = (NativePolyfence.updateConfiguration as jest.Mock).mock
        .calls[0][0];
      expect(sent).not.toHaveProperty('osGeofenceWakeEnabled');
      expect(sent).not.toHaveProperty('osGeofenceMaxRegions');
    });
  });

  describe('error types', () => {
    it.each([
      ['os_geofence_permission_denied', 'osGeofencePermissionDenied'],
      ['os_geofence_registration_failed', 'osGeofenceRegistrationFailed'],
      ['os_geofence_queue_disabled', 'osGeofenceQueueDisabled'],
    ])(
      'normalizes native code "%s" to "%s" rather than unknown',
      (code, expected) => {
        // Wake fences degrade rather than fail loudly, so an unmapped code
        // leaves a consumer unable to tell lost wake coverage apart from any
        // other unmapped error.
        expect(normalizePolyfenceError({ type: code, message: 'x' }).type).toBe(
          expected,
        );
      },
    );

    it('accepts the camelCase form emitted under `type` verbatim', () => {
      // A type present in the union but missing from ALLOWED_ERROR_TYPES
      // silently degrades to `unknown` on this path — the failure mode the
      // core-error-types consistency check exists to catch.
      expect(
        normalizePolyfenceError({
          type: 'osGeofencePermissionDenied',
          message: 'x',
        }).type,
      ).toBe('osGeofencePermissionDenied');
    });

    it('carries the warning severity through to context', () => {
      const error = normalizePolyfenceError({
        type: 'os_geofence_permission_denied',
        message: 'background location denied',
        context: { severity: 'warning', platform: 'android' },
      });
      expect(error.type).toBe('osGeofencePermissionDenied');
      expect(
        (error.context?.context as Record<string, unknown> | undefined)
          ?.severity,
      ).toBe('warning');
    });
  });

  describe('osGeofenceRegistrationHealth on debugInfo', () => {
    const baseSystemStatus = {
      isLocationPermissionGranted: true,
      isBackgroundLocationEnabled: false,
      isBatteryOptimizationDisabled: false,
      isGpsEnabled: true,
      isWakeLockAcquired: false,
      lastKnownAccuracy: -1,
      lastLocationUpdate: 0,
      platformVersion: '12',
      pluginVersion: '2.2.0',
    };

    const debugInfoWith = (osGeofenceRegistrationHealth: unknown) => ({
      systemStatus: { ...baseSystemStatus, osGeofenceRegistrationHealth },
      performance: {},
      battery: {},
      zones: {},
      recentErrors: [],
    });

    it('surfaces null when no registration has been attempted', async () => {
      await Polyfence.instance.initialize();
      (NativePolyfence.getDebugInfo as jest.Mock).mockResolvedValueOnce(
        debugInfoWith(null),
      );

      const info = await Polyfence.instance.debugInfo();
      expect(info.systemStatus.osGeofenceRegistrationHealth).toBeNull();
    });

    it('surfaces a cap hit without an error', async () => {
      await Polyfence.instance.initialize();
      (NativePolyfence.getDebugInfo as jest.Mock).mockResolvedValueOnce(
        debugInfoWith({ requested: 40, registered: 20, lastError: null }),
      );

      const health = (await Polyfence.instance.debugInfo()).systemStatus
        .osGeofenceRegistrationHealth;
      expect(health?.requested).toBe(40);
      expect(health?.registered).toBe(20);
      expect(health?.lastError).toBeNull();
    });

    it('surfaces a denied background grant', async () => {
      await Polyfence.instance.initialize();
      (NativePolyfence.getDebugInfo as jest.Mock).mockResolvedValueOnce(
        debugInfoWith({
          requested: 12,
          registered: 0,
          lastError: 'background_location_denied',
        }),
      );

      const health = (await Polyfence.instance.debugInfo()).systemStatus
        .osGeofenceRegistrationHealth;
      expect(health?.lastError).toBe('background_location_denied');
    });
  });
});
