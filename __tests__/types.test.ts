import type {
  Zone,
  Coordinate,
  GeofenceEvent,
  PolyfenceConfiguration,
  PolyfenceLocation,
  RuntimeStatus,
  BatteryOptimizationStatus,
  PolyfenceError,
  PolyfenceDebugInfo,
  ZoneState,
  SessionTelemetry,
  Subscription,
  PolyfenceErrorType,
} from '../src/types';

describe('Types', () => {
  describe('Zone', () => {
    it('should accept circle zone shape', () => {
      const zone: Zone = {
        id: 'zone1',
        name: 'Home',
        type: 'circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
      };
      expect(zone.type).toBe('circle');
      expect(zone.center).toBeDefined();
      expect(zone.radius).toBeDefined();
    });

    it('should accept polygon zone shape', () => {
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
      expect(zone.type).toBe('polygon');
      expect(zone.polygon).toBeDefined();
      expect(zone.polygon?.length).toBeGreaterThan(0);
    });

    it('should support optional metadata', () => {
      const zone: Zone = {
        id: 'zone1',
        name: 'Home',
        type: 'circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
        metadata: { color: 'red', owner: 'user123' },
      };
      expect(zone.metadata).toBeDefined();
      expect(zone.metadata?.color).toBe('red');
    });

    it('should support optional dwellThresholdMs', () => {
      const zone: Zone = {
        id: 'zone1',
        name: 'Home',
        type: 'circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
        dwellThresholdMs: 300000,
      };
      expect(zone.dwellThresholdMs).toBe(300000);
    });

    it('should support optional clusterGroupId', () => {
      const zone: Zone = {
        id: 'zone1',
        name: 'Home',
        type: 'circle',
        center: { latitude: 37.7749, longitude: -122.4194 },
        radius: 100,
        clusterGroupId: 'cluster1',
      };
      expect(zone.clusterGroupId).toBe('cluster1');
    });
  });

  describe('Coordinate', () => {
    it('should have latitude and longitude', () => {
      const coord: Coordinate = {
        latitude: 37.7749,
        longitude: -122.4194,
      };
      expect(coord.latitude).toBe(37.7749);
      expect(coord.longitude).toBe(-122.4194);
    });
  });

  describe('GeofenceEvent', () => {
    it('should accept enter event type', () => {
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
      expect(event.type).toBe('enter');
    });

    it('should accept exit event type', () => {
      const event: GeofenceEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        type: 'exit',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
      expect(event.type).toBe('exit');
    });

    it('should accept dwell event type', () => {
      const event: GeofenceEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        type: 'dwell',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
      expect(event.type).toBe('dwell');
    });

    it('should accept recoveryEnter event type', () => {
      const event: GeofenceEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        type: 'recoveryEnter',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
      expect(event.type).toBe('recoveryEnter');
    });

    it('should accept recoveryExit event type', () => {
      const event: GeofenceEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        type: 'recoveryExit',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      };
      expect(event.type).toBe('recoveryExit');
    });

    it('should support optional confidence', () => {
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
        confidence: 0.95,
      };
      expect(event.confidence).toBe(0.95);
    });

    it('should support optional dwellDurationMs', () => {
      const event: GeofenceEvent = {
        zoneId: 'zone1',
        zoneName: 'Home',
        type: 'dwell',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          accuracy: 10,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
        dwellDurationMs: 600000,
      };
      expect(event.dwellDurationMs).toBe(600000);
    });
  });

  describe('PolyfenceConfiguration', () => {
    it('should accept maxAccuracy profile', () => {
      const config: PolyfenceConfiguration = {
        accuracyProfile: 'maxAccuracy',
      };
      expect(config.accuracyProfile).toBe('maxAccuracy');
    });

    it('should accept balanced profile', () => {
      const config: PolyfenceConfiguration = {
        accuracyProfile: 'balanced',
      };
      expect(config.accuracyProfile).toBe('balanced');
    });

    it('should accept adaptive profile', () => {
      const config: PolyfenceConfiguration = {
        accuracyProfile: 'adaptive',
      };
      expect(config.accuracyProfile).toBe('adaptive');
    });

    it('should accept batteryOptimal profile', () => {
      const config: PolyfenceConfiguration = {
        accuracyProfile: 'batteryOptimal',
      };
      expect(config.accuracyProfile).toBe('batteryOptimal');
    });

    it('should accept continuous update strategy', () => {
      const config: PolyfenceConfiguration = {
        updateStrategy: 'continuous',
      };
      expect(config.updateStrategy).toBe('continuous');
    });

    it('should accept proximityBased update strategy', () => {
      const config: PolyfenceConfiguration = {
        updateStrategy: 'proximityBased',
      };
      expect(config.updateStrategy).toBe('proximityBased');
    });

    it('should accept movementBased update strategy', () => {
      const config: PolyfenceConfiguration = {
        updateStrategy: 'movementBased',
      };
      expect(config.updateStrategy).toBe('movementBased');
    });

    it('should accept intelligent update strategy', () => {
      const config: PolyfenceConfiguration = {
        updateStrategy: 'intelligent',
      };
      expect(config.updateStrategy).toBe('intelligent');
    });

    it('should support all interval options', () => {
      const config: PolyfenceConfiguration = {
        desiredIntervalMs: 5000,
        fastestIntervalMs: 1000,
        smallestDisplacementM: 10,
      };
      expect(config.desiredIntervalMs).toBe(5000);
      expect(config.fastestIntervalMs).toBe(1000);
      expect(config.smallestDisplacementM).toBe(10);
    });

    it('should support dwell detection options', () => {
      const config: PolyfenceConfiguration = {
        dwellDetectionEnabled: true,
        dwellDefaultThresholdMs: 300000,
      };
      expect(config.dwellDetectionEnabled).toBe(true);
      expect(config.dwellDefaultThresholdMs).toBe(300000);
    });

    it('should support clustering options', () => {
      const config: PolyfenceConfiguration = {
        clusteringEnabled: true,
        clusterRadiusM: 5000,
      };
      expect(config.clusteringEnabled).toBe(true);
      expect(config.clusterRadiusM).toBe(5000);
    });

    it('should support false event protection', () => {
      const config: PolyfenceConfiguration = {
        falseEventProtectionEnabled: true,
      };
      expect(config.falseEventProtectionEnabled).toBe(true);
    });

    it('should support activity recognition options', () => {
      const config: PolyfenceConfiguration = {
        activityRecognitionEnabled: true,
        activityRecognitionIntervalMs: 10000,
      };
      expect(config.activityRecognitionEnabled).toBe(true);
      expect(config.activityRecognitionIntervalMs).toBe(10000);
    });

    it('should support SaaS configuration', () => {
      const config: PolyfenceConfiguration = {
        saasApiKey: 'test-key',
        saasBaseUrl: 'https://api.example.com',
      };
      expect(config.saasApiKey).toBe('test-key');
      expect(config.saasBaseUrl).toBe('https://api.example.com');
    });

    it('should support analytics and industry category', () => {
      const config: PolyfenceConfiguration = {
        analyticsEnabled: true,
        industryCategory: 'retail',
      };
      expect(config.analyticsEnabled).toBe(true);
      expect(config.industryCategory).toBe('retail');
    });
  });

  describe('RuntimeStatus', () => {
    it('should have required fields', () => {
      const status: RuntimeStatus = {
        isTracking: true,
        activeZoneCount: 5,
        currentAccuracyProfile: 'balanced',
        currentUpdateStrategy: 'proximityBased',
        currentIntervalMs: 5000,
        batteryLevel: 75,
      };
      expect(status.isTracking).toBe(true);
      expect(status.activeZoneCount).toBe(5);
      expect(status.currentAccuracyProfile).toBe('balanced');
      expect(status.currentUpdateStrategy).toBe('proximityBased');
      expect(status.currentIntervalMs).toBe(5000);
      expect(status.batteryLevel).toBe(75);
    });

    it('should support optional lastLocationTimestamp', () => {
      const status: RuntimeStatus = {
        isTracking: true,
        activeZoneCount: 5,
        currentAccuracyProfile: 'balanced',
        currentUpdateStrategy: 'proximityBased',
        currentIntervalMs: 5000,
        batteryLevel: 75,
        lastLocationTimestamp: Date.now(),
      };
      expect(status.lastLocationTimestamp).toBeDefined();
    });
  });

  describe('BatteryOptimizationStatus', () => {
    it('should have required fields', () => {
      const status: BatteryOptimizationStatus = {
        isIgnoringOptimizations: true,
        manufacturer: 'Samsung',
      };
      expect(status.isIgnoringOptimizations).toBe(true);
      expect(status.manufacturer).toBe('Samsung');
    });
  });

  describe('PolyfenceError', () => {
    it('should accept all error types', () => {
      const errorTypes: PolyfenceErrorType[] = [
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
      ];

      errorTypes.forEach((errorType) => {
        const error: PolyfenceError = {
          type: errorType,
          message: 'Test error',
        };
        expect(error.type).toBe(errorType);
      });
    });

    it('should support optional context and correlationId', () => {
      const error: PolyfenceError = {
        type: 'gpsPermissionDenied',
        message: 'Permission denied',
        context: { permission: 'LOCATION' },
        timestamp: Date.now(),
        correlationId: 'abc-123',
      };
      expect(error.context?.permission).toBe('LOCATION');
      expect(error.correlationId).toBe('abc-123');
    });
  });

  describe('ZoneState', () => {
    it('should have required fields', () => {
      const state: ZoneState = {
        zoneId: 'zone1',
        zoneName: 'Home',
        isInside: true,
      };
      expect(state.zoneId).toBe('zone1');
      expect(state.zoneName).toBe('Home');
      expect(state.isInside).toBe(true);
    });

    it('should support optional event fields', () => {
      const state: ZoneState = {
        zoneId: 'zone1',
        zoneName: 'Home',
        isInside: true,
        lastEventType: 'enter',
        lastEventTimestamp: Date.now(),
      };
      expect(state.lastEventType).toBe('enter');
      expect(state.lastEventTimestamp).toBeDefined();
    });

    it('should support dwell tracking', () => {
      const state: ZoneState = {
        zoneId: 'zone1',
        zoneName: 'Home',
        isInside: true,
        dwellStartTimestamp: Date.now(),
      };
      expect(state.dwellStartTimestamp).toBeDefined();
    });

    it('should support distance to boundary', () => {
      const state: ZoneState = {
        zoneId: 'zone1',
        zoneName: 'Home',
        isInside: true,
        distanceToBoundaryM: 50.5,
      };
      expect(state.distanceToBoundaryM).toBe(50.5);
    });
  });

  describe('SessionTelemetry', () => {
    it('should have all required fields', () => {
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
      expect(telemetry.gpsUpdateCount).toBe(120);
      expect(telemetry.zoneCount).toBe(5);
      expect(telemetry.bridgePlatform).toBe('react-native');
    });

    it('should support additional fields via indexer', () => {
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
        customField: 'custom-value',
      };
      expect((telemetry as any).customField).toBe('custom-value');
    });
  });

  describe('Subscription', () => {
    it('should have remove method', () => {
      const subscription: Subscription = {
        remove: jest.fn(),
      };
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('PolyfenceLocation', () => {
    it('should have required fields', () => {
      const location: PolyfenceLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
      };
      expect(location.latitude).toBe(37.7749);
      expect(location.longitude).toBe(-122.4194);
    });

    it('should support optional fields', () => {
      const location: PolyfenceLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        altitude: 50,
        speed: 5.5,
        bearing: 90,
        timestamp: Date.now(),
        interval: 5000,
        isFallback: false,
        activity: 'WALKING',
      };
      expect(location.accuracy).toBe(10);
      expect(location.altitude).toBe(50);
      expect(location.speed).toBe(5.5);
      expect(location.bearing).toBe(90);
      expect(location.interval).toBe(5000);
      expect(location.isFallback).toBe(false);
      expect(location.activity).toBe('WALKING');
    });
  });

  describe('PolyfenceDebugInfo', () => {
    it('should have required fields', () => {
      const debugInfo: PolyfenceDebugInfo = {
        engineVersion: '1.0.0',
        bridgePlatform: 'react-native',
        isTracking: true,
        activeZones: 5,
        totalEventsGenerated: 100,
        currentAccuracyProfile: 'balanced',
        currentUpdateStrategy: 'proximityBased',
        currentIntervalMs: 5000,
        errorHistory: [],
      };
      expect(debugInfo.engineVersion).toBe('1.0.0');
      expect(debugInfo.bridgePlatform).toBe('react-native');
      expect(debugInfo.isTracking).toBe(true);
      expect(debugInfo.activeZones).toBe(5);
    });

    it('should support optional lastLocationTimestamp', () => {
      const debugInfo: PolyfenceDebugInfo = {
        engineVersion: '1.0.0',
        bridgePlatform: 'react-native',
        isTracking: true,
        activeZones: 5,
        totalEventsGenerated: 100,
        currentAccuracyProfile: 'balanced',
        currentUpdateStrategy: 'proximityBased',
        currentIntervalMs: 5000,
        lastLocationTimestamp: Date.now(),
        errorHistory: [],
      };
      expect(debugInfo.lastLocationTimestamp).toBeDefined();
    });
  });
});
