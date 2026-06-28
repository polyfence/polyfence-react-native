import { getMockEventEmitter } from './setup';
import { Polyfence } from '../src/Polyfence';
import { NativeModules } from 'react-native';
import type { Zone, PolyfenceConfiguration } from '../src/types';

describe('Polyfence', () => {
  const NativePolyfence = NativeModules.Polyfence;

  const resetSingleton = () => {
    (Polyfence as unknown as { _instance: Polyfence | null })._instance = null;
  };

  beforeEach(async () => {
    // Default: every test starts with an initialized singleton, matching the
    // contract every consumer must follow. Tests that need to assert pre-init
    // behaviour override this in their own beforeEach.
    resetSingleton();
    await Polyfence.instance.initialize();
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = Polyfence.instance;
      const instance2 = Polyfence.instance;
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    beforeEach(() => {
      // Override: tests in this block call initialize() themselves and want a
      // clean mock + fresh singleton to assert against.
      resetSingleton();
      jest.clearAllMocks();
    });

    it('should call native initialize with config', async () => {
      const config: PolyfenceConfiguration = {
        accuracyProfile: 'balanced',
        updateStrategy: 'proximityBased',
      };
      await Polyfence.instance.initialize(config);
      expect(NativePolyfence.initialize).toHaveBeenCalledWith({ config });
    });

    it('should pass empty object when no config provided', async () => {
      await Polyfence.instance.initialize();
      expect(NativePolyfence.initialize).toHaveBeenCalledWith({});
    });
  });

  describe('precondition: initialize() required (BUG-001)', () => {
    beforeEach(() => {
      // Override: fresh singleton with _isInitialized = false so we can
      // exercise the pre-init guard.
      resetSingleton();
      jest.clearAllMocks();
    });

    const errorPattern = /call initialize\(\) before any other method/;

    // The Android-side silent path leak (addZone routing through the
    // Intent/service branch when tracking_enabled is true) is the
    // motivating symptom for BUG-001. Kept as its own narrative test
    // because the polygon shape and Android context matter for the bug
    // trail; the every-guarded-method coverage lives in the table below.
    it('addZone() rejects before initialize() with a polygon zone (BUG-001 repro shape)', async () => {
      const zone: Zone = {
        id: 'z1',
        name: 'Polygon',
        type: 'polygon',
        polygon: [
          { latitude: 0, longitude: 0 },
          { latitude: 0, longitude: 1 },
          { latitude: 1, longitude: 1 },
        ],
      };
      await expect(Polyfence.instance.addZone(zone)).rejects.toThrow(
        errorPattern,
      );
      expect(NativePolyfence.addZone).not.toHaveBeenCalled();
    });

    // Every guarded JS method must reject pre-init. Data-driven so a
    // future refactor that drops assertInitialized() from any one of
    // these still fails the suite.
    type GuardedCall = {
      method: string;
      nativeName: string;
      call: (p: Polyfence) => Promise<unknown>;
    };

    const sampleZone: Zone = {
      id: 'z1',
      name: 'Home',
      type: 'circle',
      center: { latitude: 0, longitude: 0 },
      radius: 100,
    };
    const sampleConfig: PolyfenceConfiguration = {
      accuracyProfile: 'balanced',
    };

    const guardedCalls: GuardedCall[] = [
      {
        method: 'startTracking',
        nativeName: 'startTracking',
        call: (p) => p.startTracking(),
      },
      {
        method: 'stopTracking',
        nativeName: 'stopTracking',
        call: (p) => p.stopTracking(),
      },
      {
        method: 'addZone',
        nativeName: 'addZone',
        call: (p) => p.addZone(sampleZone),
      },
      {
        method: 'removeZone',
        nativeName: 'removeZone',
        call: (p) => p.removeZone('z1'),
      },
      {
        method: 'clearAllZones',
        nativeName: 'removeAllZones',
        call: (p) => p.clearAllZones(),
      },
      {
        method: 'getZoneStates',
        nativeName: 'getZoneStates',
        call: (p) => p.getZoneStates(),
      },
      {
        method: 'getSessionTelemetry',
        nativeName: 'getSessionTelemetry',
        call: (p) => p.getSessionTelemetry(),
      },
      {
        method: 'requestPermissions',
        nativeName: 'requestPermissions',
        call: (p) => p.requestPermissions(),
      },
      {
        method: 'getConfiguration',
        nativeName: 'getConfiguration',
        call: (p) => p.getConfiguration(),
      },
      {
        method: 'updateConfiguration',
        nativeName: 'updateConfiguration',
        call: (p) => p.updateConfiguration(sampleConfig),
      },
      {
        method: 'resetConfiguration',
        nativeName: 'resetConfiguration',
        call: (p) => p.resetConfiguration(),
      },
      {
        method: 'setAccuracyProfile',
        nativeName: 'setAccuracyProfile',
        call: (p) => p.setAccuracyProfile('balanced'),
      },
    ];

    it.each(guardedCalls)(
      '$method() rejects before initialize() and never reaches the native module',
      async ({ call, nativeName }) => {
        await expect(call(Polyfence.instance)).rejects.toThrow(errorPattern);
        expect(
          (NativePolyfence as Record<string, jest.Mock>)[nativeName],
        ).not.toHaveBeenCalled();
      },
    );

    it('once initialize() resolves, guarded methods succeed', async () => {
      await Polyfence.instance.initialize();
      await Polyfence.instance.startTracking();
      expect(NativePolyfence.startTracking).toHaveBeenCalled();
    });
  });

  describe('startTracking', () => {
    it('should call native startTracking', async () => {
      await Polyfence.instance.startTracking();
      expect(NativePolyfence.startTracking).toHaveBeenCalled();
    });
  });

  describe('stopTracking', () => {
    it('should call native stopTracking', async () => {
      await Polyfence.instance.stopTracking();
      expect(NativePolyfence.stopTracking).toHaveBeenCalled();
    });
  });

  describe('addZone', () => {
    it('should pass zone data to native', async () => {
      const zone: Zone = {
        id: 'zone1',
        name: 'Home',
        type: 'circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
      };
      await Polyfence.instance.addZone(zone);
      expect(NativePolyfence.addZone).toHaveBeenCalledWith(zone);
    });

    it('should handle polygon zones', async () => {
      const zone: Zone = {
        id: 'zone2',
        name: 'Office',
        type: 'polygon',
        polygon: [
          { latitude: 37.77, longitude: -122.41 },
          { latitude: 37.78, longitude: -122.41 },
          { latitude: 37.78, longitude: -122.42 },
        ],
      };
      await Polyfence.instance.addZone(zone);
      expect(NativePolyfence.addZone).toHaveBeenCalledWith(zone);
    });
  });

  describe('removeZone', () => {
    it('should pass zoneId to native', async () => {
      await Polyfence.instance.removeZone('zone1');
      expect(NativePolyfence.removeZone).toHaveBeenCalledWith('zone1');
    });
  });

  describe('clearAllZones', () => {
    it('should call native removeAllZones', async () => {
      await Polyfence.instance.clearAllZones();
      expect(NativePolyfence.removeAllZones).toHaveBeenCalled();
    });
  });

  describe('getZoneStates', () => {
    it('should return native result', async () => {
      const mockStates = [
        {
          zoneId: 'zone1',
          zoneName: 'Home',
          isInside: true,
          lastEventType: 'enter' as const,
          lastEventTimestamp: 1000,
        },
      ];
      (NativePolyfence.getZoneStates as jest.Mock).mockResolvedValueOnce(
        mockStates,
      );
      const result = await Polyfence.instance.getZoneStates();
      expect(result).toEqual(mockStates);
      expect(NativePolyfence.getZoneStates).toHaveBeenCalled();
    });
  });

  describe('debugInfo', () => {
    it('should return native result', async () => {
      const mockDebugInfo = {
        engineVersion: '1.0.0',
        bridgePlatform: 'react-native',
        isTracking: true,
        activeZones: 2,
      };
      (NativePolyfence.getDebugInfo as jest.Mock).mockResolvedValueOnce(
        mockDebugInfo,
      );
      const result = await Polyfence.instance.debugInfo();
      expect(result).toEqual(mockDebugInfo);
      expect(NativePolyfence.getDebugInfo).toHaveBeenCalled();
    });
  });

  describe('getSessionTelemetry', () => {
    it('should return native result', async () => {
      const mockTelemetry = {
        sessionDurationMinutes: 60,
        gpsUpdateCount: 100,
        zoneCount: 2,
      };
      (NativePolyfence.getSessionTelemetry as jest.Mock).mockResolvedValueOnce(
        mockTelemetry,
      );
      const result = await Polyfence.instance.getSessionTelemetry();
      expect(result).toEqual(mockTelemetry);
      expect(NativePolyfence.getSessionTelemetry).toHaveBeenCalled();
    });
  });

  describe('requestPermissions', () => {
    it('should pass options to native and return boolean', async () => {
      (NativePolyfence.requestPermissions as jest.Mock).mockResolvedValueOnce(
        true,
      );
      const result = await Polyfence.instance.requestPermissions({
        always: true,
      });
      expect(result).toBe(true);
      expect(NativePolyfence.requestPermissions).toHaveBeenCalledWith({
        always: true,
      });
    });

    it('should pass empty object when no options provided', async () => {
      (NativePolyfence.requestPermissions as jest.Mock).mockResolvedValueOnce(
        false,
      );
      const result = await Polyfence.instance.requestPermissions();
      expect(result).toBe(false);
      expect(NativePolyfence.requestPermissions).toHaveBeenCalledWith({});
    });
  });

  describe('isLocationServiceEnabled', () => {
    it('should return boolean from native', async () => {
      (
        NativePolyfence.isLocationServiceEnabled as jest.Mock
      ).mockResolvedValueOnce(true);
      const result = await Polyfence.instance.isLocationServiceEnabled();
      expect(result).toBe(true);
      expect(NativePolyfence.isLocationServiceEnabled).toHaveBeenCalled();
    });
  });

  describe('getConfiguration', () => {
    it('should return configuration from native', async () => {
      const mockConfig: PolyfenceConfiguration = {
        accuracyProfile: 'balanced',
        updateStrategy: 'proximityBased',
      };
      (NativePolyfence.getConfiguration as jest.Mock).mockResolvedValueOnce(
        mockConfig,
      );
      const result = await Polyfence.instance.getConfiguration();
      expect(result).toEqual(mockConfig);
      expect(NativePolyfence.getConfiguration).toHaveBeenCalled();
    });

    // BUG-007: native engine emits enum string values in UPPERCASE_SNAKE_CASE
    // on both platforms (Kotlin enum.name; Swift `case balanced = "BALANCED"`
    // raw values). The JS bridge normalizes them to lowerCamelCase before
    // returning so they match the TS AccuracyProfile / UpdateStrategy unions.
    it('normalizes UPPERCASE_SNAKE enum values to lowerCamelCase (BUG-007)', async () => {
      (NativePolyfence.getConfiguration as jest.Mock).mockResolvedValueOnce({
        accuracyProfile: 'BALANCED',
        updateStrategy: 'PROXIMITY_BASED',
        enableDebugLogging: false,
      });
      const result = await Polyfence.instance.getConfiguration();
      expect(result.accuracyProfile).toBe('balanced');
      expect(result.updateStrategy).toBe('proximityBased');
      expect(result.enableDebugLogging).toBe(false);
    });

    it('is idempotent on already-normalized native responses', async () => {
      (NativePolyfence.getConfiguration as jest.Mock).mockResolvedValueOnce({
        accuracyProfile: 'balanced',
        updateStrategy: 'proximityBased',
      });
      const result = await Polyfence.instance.getConfiguration();
      expect(result.accuracyProfile).toBe('balanced');
      expect(result.updateStrategy).toBe('proximityBased');
    });
  });

  describe('updateConfiguration', () => {
    it('should pass configuration to native', async () => {
      const config: PolyfenceConfiguration = {
        accuracyProfile: 'maxAccuracy',
        desiredIntervalMs: 1000,
      };
      await Polyfence.instance.updateConfiguration(config);
      expect(NativePolyfence.updateConfiguration).toHaveBeenCalledWith(config);
    });
  });

  describe('resetConfiguration', () => {
    it('should call native resetConfiguration', async () => {
      await Polyfence.instance.resetConfiguration();
      expect(NativePolyfence.resetConfiguration).toHaveBeenCalled();
    });
  });

  describe('setAccuracyProfile', () => {
    it('should pass profile string to native', async () => {
      await Polyfence.instance.setAccuracyProfile('balanced');
      expect(NativePolyfence.setAccuracyProfile).toHaveBeenCalledWith(
        'balanced',
      );
    });
  });

  describe('batteryOptimizationStatus', () => {
    it('should return status object from native', async () => {
      const mockStatus = {
        isIgnoringOptimizations: false,
        manufacturer: 'Samsung',
      };
      (
        NativePolyfence.batteryOptimizationStatus as jest.Mock
      ).mockResolvedValueOnce(mockStatus);
      const result = await Polyfence.instance.batteryOptimizationStatus();
      expect(result).toEqual(mockStatus);
      expect(NativePolyfence.batteryOptimizationStatus).toHaveBeenCalled();
    });
  });

  describe('requestBatteryOptimizationExemption', () => {
    it('should return boolean from native', async () => {
      (
        NativePolyfence.requestBatteryOptimizationExemption as jest.Mock
      ).mockResolvedValueOnce(true);
      const result =
        await Polyfence.instance.requestBatteryOptimizationExemption();
      expect(result).toBe(true);
      expect(
        NativePolyfence.requestBatteryOptimizationExemption,
      ).toHaveBeenCalled();
    });
  });

  describe('errorHistory', () => {
    it('should pass options to native and return array', async () => {
      const mockErrors = [
        {
          type: 'gpsPermissionDenied' as const,
          message: 'Permission denied',
        },
      ];
      (NativePolyfence.getErrorHistory as jest.Mock).mockResolvedValueOnce(
        mockErrors,
      );
      const result = await Polyfence.instance.errorHistory({ limit: 10 });
      expect(result[0]).toMatchObject({
        type: 'gpsPermissionDenied',
        message: 'Permission denied',
      });
      expect(NativePolyfence.getErrorHistory).toHaveBeenCalledWith({
        limit: 10,
      });
    });

    it('should pass empty object when no options provided', async () => {
      (NativePolyfence.getErrorHistory as jest.Mock).mockResolvedValueOnce([]);
      await Polyfence.instance.errorHistory();
      expect(NativePolyfence.getErrorHistory).toHaveBeenCalledWith({});
    });
  });

  describe('dispose', () => {
    it('should remove all listeners then call native dispose', async () => {
      const mockEmitter = getMockEventEmitter();
      await Polyfence.instance.dispose();
      expect(mockEmitter.removeAllListeners).toHaveBeenCalled();
      expect(NativePolyfence.dispose).toHaveBeenCalled();
    });

    // BUG-002: dispose() must NOT permanently brick the SDK. It retires the
    // cached singleton so the documented logout -> login pattern works again.
    it('supports re-initialize after dispose (logout -> login)', async () => {
      const first = Polyfence.instance;
      // Telemetry off so dispose() teardown stays on the native path only.
      await first.initialize(undefined, { disableTelemetry: true });
      await first.dispose();

      // Re-acquire per the documented pattern — a fresh, usable instance.
      const second = Polyfence.instance;
      expect(second).not.toBe(first);
      await second.initialize(undefined, { disableTelemetry: true });
      await second.startTracking();
      expect(NativePolyfence.startTracking).toHaveBeenCalled();
    });

    it('throws a clear, non-misleading error when a stale disposed reference is reused', async () => {
      const stale = Polyfence.instance;
      await stale.initialize(undefined, { disableTelemetry: true });
      await stale.dispose();

      // The retired reference stays disposed; the message must point to
      // Polyfence.instance, not the impossible "create a new instance".
      await expect(stale.startTracking()).rejects.toThrow(
        /disposed.*Polyfence\.instance/s,
      );
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all event listeners', () => {
      const mockEmitter = getMockEventEmitter();
      Polyfence.instance.removeAllListeners();
      expect(mockEmitter.removeAllListeners).toHaveBeenCalled();
    });
  });

  describe('onLocationUpdate', () => {
    it('should register location listener and return subscription', () => {
      const callback = jest.fn();
      const subscription = Polyfence.instance.onLocationUpdate(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('onGeofenceEvent', () => {
    it('should register geofence event listener and return subscription', () => {
      const callback = jest.fn();
      const subscription = Polyfence.instance.onGeofenceEvent(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('onError', () => {
    it('should register error listener and return subscription', () => {
      const callback = jest.fn();
      const subscription = Polyfence.instance.onError(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('onPerformance', () => {
    it('should register performance listener and return subscription', () => {
      const callback = jest.fn();
      const subscription = Polyfence.instance.onPerformance(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('onZoneEnter', () => {
    it('should only trigger on enter and recoveryEnter events', (done) => {
      const callback = jest.fn();
      Polyfence.instance.onZoneEnter(callback);

      const mockEmitter = getMockEventEmitter();
      const [[, listener]] = (
        mockEmitter.addListener as jest.Mock
      ).mock.calls.filter((call: any[]) => call[0] === 'onGeofenceEvent');

      const timestamp = Date.now();

      const rawEnterEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        eventType: 'ENTER',
        latitude: 37.7749,
        longitude: -122.4194,
        gpsAccuracy: 10,
        timestamp,
      };

      const rawExitEvent = {
        ...rawEnterEvent,
        eventType: 'EXIT',
      };

      const rawRecoveryEnterEvent = {
        ...rawEnterEvent,
        eventType: 'RECOVERY_ENTER',
      };

      listener(rawEnterEvent);
      listener(rawExitEvent);
      listener(rawRecoveryEnterEvent);

      setTimeout(() => {
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            zoneId: 'zone1',
            type: 'enter',
          }),
        );
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            zoneId: 'zone1',
            type: 'recoveryEnter',
          }),
        );
        done();
      }, 0);
    });
  });

  describe('onZoneExit', () => {
    it('should only trigger on exit and recoveryExit events', (done) => {
      const callback = jest.fn();
      Polyfence.instance.onZoneExit(callback);

      const mockEmitter = getMockEventEmitter();
      const [[, listener]] = (
        mockEmitter.addListener as jest.Mock
      ).mock.calls.filter((call: any[]) => call[0] === 'onGeofenceEvent');

      const timestamp = Date.now();

      const rawExitEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        eventType: 'EXIT',
        latitude: 37.7749,
        longitude: -122.4194,
        gpsAccuracy: 10,
        timestamp,
      };

      const rawEnterEvent = {
        ...rawExitEvent,
        eventType: 'ENTER',
      };

      const rawRecoveryExitEvent = {
        ...rawExitEvent,
        eventType: 'RECOVERY_EXIT',
      };

      listener(rawExitEvent);
      listener(rawEnterEvent);
      listener(rawRecoveryExitEvent);

      setTimeout(() => {
        expect(callback).toHaveBeenCalledTimes(2);
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            zoneId: 'zone1',
            type: 'exit',
          }),
        );
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            zoneId: 'zone1',
            type: 'recoveryExit',
          }),
        );
        done();
      }, 0);
    });
  });
});
