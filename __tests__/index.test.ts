import './setup'; // Must import first to set up mocks
import {
  Polyfence,
  onLocationUpdate,
  onGeofenceEvent,
  onError,
  onPerformance,
  removeAllListeners,
} from '../src/index';
import type {
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
  PolyfenceError,
  PolyfenceErrorType,
  PolyfenceDebugInfo,
  ZoneState,
  SessionTelemetry,
  Subscription,
  BatteryOptimizationStatus,
} from '../src/index';

describe('index exports', () => {
  describe('Polyfence class', () => {
    it('should export Polyfence class', () => {
      expect(Polyfence).toBeDefined();
      expect(typeof Polyfence).toBe('function');
    });

    it('should be accessible as instance', () => {
      expect(Polyfence.instance).toBeDefined();
      expect(typeof Polyfence.instance.initialize).toBe('function');
    });
  });

  describe('Event functions', () => {
    it('should export onLocationUpdate function', () => {
      expect(typeof onLocationUpdate).toBe('function');
    });

    it('should export onGeofenceEvent function', () => {
      expect(typeof onGeofenceEvent).toBe('function');
    });

    it('should export onError function', () => {
      expect(typeof onError).toBe('function');
    });

    it('should export onPerformance function', () => {
      expect(typeof onPerformance).toBe('function');
    });

    it('should export removeAllListeners function', () => {
      expect(typeof removeAllListeners).toBe('function');
    });
  });

  describe('Type exports', () => {
    it('should allow Zone type usage', () => {
      const zone: Zone = {
        id: 'test',
        name: 'Test',
        type: 'circle',
        center: { latitude: 0, longitude: 0 },
        radius: 100,
      };
      expect(zone.id).toBe('test');
    });

    it('should allow ZoneType type usage', () => {
      const type: ZoneType = 'circle';
      expect(type).toBe('circle');
    });

    it('should allow Coordinate type usage', () => {
      const coord: Coordinate = {
        latitude: 37.7749,
        longitude: -122.4194,
      };
      expect(coord.latitude).toBe(37.7749);
    });

    it('should allow GeofenceEvent type usage', () => {
      const event: GeofenceEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        type: 'enter',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
      expect(event.zoneId).toBe('zone1');
    });

    it('should allow GeofenceEventType type usage', () => {
      const eventType: GeofenceEventType = 'enter';
      expect(eventType).toBe('enter');
    });

    it('should allow PolyfenceLocation type usage', () => {
      const location: PolyfenceLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        timestamp: Date.now(),
      };
      expect(location.latitude).toBe(37.7749);
    });

    it('should allow PolyfenceConfiguration type usage', () => {
      const config: PolyfenceConfiguration = {
        accuracyProfile: 'balanced',
        updateStrategy: 'proximityBased',
      };
      expect(config.accuracyProfile).toBe('balanced');
    });

    it('should allow AccuracyProfile type usage', () => {
      const profile: AccuracyProfile = 'balanced';
      expect(profile).toBe('balanced');
    });

    it('should allow UpdateStrategy type usage', () => {
      const strategy: UpdateStrategy = 'proximityBased';
      expect(strategy).toBe('proximityBased');
    });

    it('should allow RuntimeStatus type usage', () => {
      const status: RuntimeStatus = {
        isTracking: true,
        activeZoneCount: 5,
        currentAccuracyProfile: 'balanced',
        currentUpdateStrategy: 'proximityBased',
        currentIntervalMs: 5000,
        batteryLevel: 75,
      };
      expect(status.isTracking).toBe(true);
    });

    it('should allow PolyfenceError type usage', () => {
      const error: PolyfenceError = {
        type: 'gpsPermissionDenied',
        message: 'Permission denied',
      };
      expect(error.type).toBe('gpsPermissionDenied');
    });

    it('should allow PolyfenceErrorType type usage', () => {
      const errorType: PolyfenceErrorType = 'gpsPermissionDenied';
      expect(errorType).toBe('gpsPermissionDenied');
    });

    it('should allow PolyfenceDebugInfo type usage', () => {
      const debugInfo: PolyfenceDebugInfo = {
        systemStatus: {
          isLocationPermissionGranted: true,
          isBackgroundLocationEnabled: true,
          isBatteryOptimizationDisabled: false,
          isGpsEnabled: true,
          isWakeLockAcquired: false,
          lastKnownAccuracy: -1,
          lastLocationUpdate: 0,
          platformVersion: '15',
          pluginVersion: '2.0.1',
        },
        performance: {
          restartCount: 0,
          cpuUsagePercent: 0,
          totalLocationUpdates: 0,
          averageDetectionLatency: 0,
          memoryUsageMB: 10,
          totalZoneDetections: 0,
          uptime: 1000,
        },
        battery: {
          totalActiveTime: 0,
          gpsActiveTimePercent: 0,
          batteryLevel: 100,
          estimatedHourlyDrain: 0,
          isCharging: true,
          wakeUpCount: 0,
        },
        zones: {
          zoneEventCounts: {},
          polygonZones: 0,
          circleZones: 0,
          activeZones: 5,
          lastZoneUpdate: 0,
        },
        recentErrors: [],
      };
      expect(debugInfo.zones.activeZones).toBe(5);
    });

    it('should allow ZoneState type usage', () => {
      const state: ZoneState = {
        zoneId: 'zone1',
        zoneName: 'Home',
        isInside: true,
      };
      expect(state.zoneId).toBe('zone1');
    });

    it('should allow SessionTelemetry type usage', () => {
      const telemetry: SessionTelemetry = {
        sessionDurationMinutes: 60,
        gpsUpdateCount: 120,
        avgGpsIntervalMs: 30000,
        zoneCount: 5,
        enterEventCount: 10,
        exitEventCount: 8,
        dwellEventCount: 2,
        falseEventCount: 1,
        recoveryEventCount: 0,
        zoneTransitionCount: 18,
        accuracyProfile: 'balanced',
        updateStrategy: 'proximityBased',
        batteryDrainPercent: 15,
        deviceCategory: 'phone',
        bridgePlatform: 'react-native',
        sessionStartHour: 9,
      };
      expect(telemetry.sessionDurationMinutes).toBe(60);
    });

    it('should allow Subscription type usage', () => {
      const subscription: Subscription = {
        remove: jest.fn(),
      };
      expect(subscription).toHaveProperty('remove');
    });

    it('should allow BatteryOptimizationStatus type usage', () => {
      const status: BatteryOptimizationStatus = {
        isIgnoringOptimizations: true,
        manufacturer: 'Samsung',
      };
      expect(status.isIgnoringOptimizations).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should allow using exported types with exported functions', () => {
      const callback = (location: PolyfenceLocation) => {
        expect(location.latitude).toBeDefined();
      };
      const subscription = onLocationUpdate(callback);
      expect(subscription).toHaveProperty('remove');
    });

    it('should allow using exported Polyfence instance with exported types', async () => {
      const zone: Zone = {
        id: 'zone1',
        name: 'Home',
        type: 'circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
      };
      await Polyfence.instance.initialize();
      await Polyfence.instance.addZone(zone);
      expect(Polyfence.instance).toBeDefined();
    });
  });
});
