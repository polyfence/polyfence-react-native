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
  // jest.requireMock is typed against the real `react-native` module, so
  // `RN.DeviceEventEmitter` is `DeviceEventEmitterStatic` whose
  // `addListener` returns `EmitterSubscription` — not the `jest.Mock` shape
  // our jest.mock factory above actually constructs. Cast through `unknown`
  // to tell TypeScript we know the runtime shape, without lying about either
  // side of the boundary. (A recent Dependabot bump of @types/jest or
  // @types/react-native tightened the inference so this is now caught.)
  return RN.DeviceEventEmitter as unknown as {
    addListener: jest.Mock;
    removeAllListeners: jest.Mock;
  };
}
