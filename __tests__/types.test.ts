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

    it('should support interval options via nested ProximitySettings + MovementSettings', () => {
      const config: PolyfenceConfiguration = {
        proximitySettings: {
          nearZoneUpdateIntervalMs: 1000,
          farZoneUpdateIntervalMs: 5000,
        },
        movementSettings: {
          movingUpdateIntervalMs: 1000,
          stationaryUpdateIntervalMs: 5000,
          movementThresholdMeters: 10,
        },
      };
      expect(config.proximitySettings?.nearZoneUpdateIntervalMs).toBe(1000);
      expect(config.movementSettings?.movementThresholdMeters).toBe(10);
    });

    it('should support dwell detection via nested DwellSettings', () => {
      const config: PolyfenceConfiguration = {
        dwellSettings: { enabled: true, dwellThresholdMs: 300000 },
      };
      expect(config.dwellSettings?.enabled).toBe(true);
      expect(config.dwellSettings?.dwellThresholdMs).toBe(300000);
    });

    it('should support clustering via nested ClusterSettings', () => {
      const config: PolyfenceConfiguration = {
        clusterSettings: { enabled: true, activeRadiusMeters: 5000 },
      };
      expect(config.clusterSettings?.enabled).toBe(true);
      expect(config.clusterSettings?.activeRadiusMeters).toBe(5000);
    });

    // False-event protection has no toggle now — it's always on. The
    // pre-2.x falseEventProtectionEnabled property was a no-op even when
    // accepted, so it was removed alongside the other dead flat props.

    it('should support activity recognition via nested ActivitySettings', () => {
      const config: PolyfenceConfiguration = {
        activitySettings: {
          enabled: true,
          stillIntervalMs: 120000,
          walkingIntervalMs: 15000,
        },
      };
      expect(config.activitySettings?.enabled).toBe(true);
      expect(config.activitySettings?.stillIntervalMs).toBe(120000);
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
    const fullDebugInfo = (): PolyfenceDebugInfo => ({
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
        totalZoneDetections: 100,
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
    });

    it('should have all five top-level metric groups', () => {
      const debugInfo = fullDebugInfo();
      expect(debugInfo.systemStatus).toBeDefined();
      expect(debugInfo.performance).toBeDefined();
      expect(debugInfo.battery).toBeDefined();
      expect(debugInfo.zones).toBeDefined();
      expect(debugInfo.recentErrors).toBeDefined();
    });

    it('should expose nested zone and performance metrics', () => {
      const debugInfo = fullDebugInfo();
      expect(debugInfo.zones.activeZones).toBe(5);
      expect(debugInfo.performance.totalZoneDetections).toBe(100);
      expect(debugInfo.systemStatus.platformVersion).toBe('15');
    });

    it('should allow a 0 lastLocationUpdate to encode "no fix yet"', () => {
      const debugInfo = fullDebugInfo();
      expect(debugInfo.systemStatus.lastLocationUpdate).toBe(0);
    });
  });
});
