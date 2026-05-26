jest.mock('react-native', () => {
  const DeviceEventEmitter = {
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
    removeAllListeners: jest.fn(),
  };
  return {
    NativeModules: {
      Polyfence: {
        initialize: jest.fn().mockResolvedValue(null),
        startTracking: jest.fn().mockResolvedValue(null),
        stopTracking: jest.fn().mockResolvedValue(null),
        addZone: jest.fn().mockResolvedValue(null),
        removeZone: jest.fn().mockResolvedValue(null),
        removeAllZones: jest.fn().mockResolvedValue(null),
        getZoneStates: jest.fn().mockResolvedValue([]),
        getDebugInfo: jest.fn().mockResolvedValue({}),
        getSessionTelemetry: jest.fn().mockResolvedValue({}),
        setTrackingSchedule: jest.fn().mockResolvedValue(null),
        clearTrackingSchedule: jest.fn().mockResolvedValue(null),
        requestPermissions: jest.fn().mockResolvedValue(true),
        isLocationServiceEnabled: jest.fn().mockResolvedValue(true),
        getConfiguration: jest.fn().mockResolvedValue({}),
        updateConfiguration: jest.fn().mockResolvedValue(null),
        resetConfiguration: jest.fn().mockResolvedValue(null),
        setAccuracyProfile: jest.fn().mockResolvedValue(null),
        batteryOptimizationStatus: jest.fn().mockResolvedValue({
          isIgnoringOptimizations: true,
          manufacturer: 'test',
        }),
        requestBatteryOptimizationExemption: jest.fn().mockResolvedValue(true),
        getErrorHistory: jest.fn().mockResolvedValue([]),
        dispose: jest.fn().mockResolvedValue(null),
      },
    },
    DeviceEventEmitter,
    NativeEventEmitter: jest.fn().mockImplementation(() => DeviceEventEmitter),
    Platform: { OS: 'ios' },
  };
});

export function getMockEventEmitter(): {
  addListener: jest.Mock;
  removeAllListeners: jest.Mock;
} {
  const RN = jest.requireMock<typeof import('react-native')>('react-native');
  return RN.DeviceEventEmitter;
}
