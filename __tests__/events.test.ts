import { getMockEventEmitter } from './setup';
import {
  onLocationUpdate,
  onGeofenceEvent,
  onError,
  onPerformance,
  removeAllListeners,
} from '../src/events';

describe('Events', () => {
  let mockEmitter: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmitter = getMockEventEmitter();
  });

  describe('onLocationUpdate', () => {
    it('should register listener on onLocation event', () => {
      const callback = jest.fn();
      onLocationUpdate(callback);
      const [[eventName]] = (mockEmitter.addListener as jest.Mock).mock.calls;
      expect(eventName).toBe('onLocation');
    });

    it('should return subscription with remove method', () => {
      const callback = jest.fn();
      const subscription = onLocationUpdate(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });

    it('should call remove on underlying subscription', () => {
      const callback = jest.fn();
      const mockSub = { remove: jest.fn() };
      (mockEmitter.addListener as jest.Mock).mockReturnValueOnce(mockSub);

      const subscription = onLocationUpdate(callback);
      subscription.remove();

      expect(mockSub.remove).toHaveBeenCalled();
    });
  });

  describe('onGeofenceEvent', () => {
    it('should register listener on onGeofenceEvent event', () => {
      const callback = jest.fn();
      onGeofenceEvent(callback);
      const calls = (mockEmitter.addListener as jest.Mock).mock.calls;
      const found = calls.find((call: any[]) => call[0] === 'onGeofenceEvent');
      expect(found).toBeDefined();
    });

    it('should return subscription with remove method', () => {
      const callback = jest.fn();
      const subscription = onGeofenceEvent(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });

    it('should normalize raw native events to GeofenceEvent', () => {
      const callback = jest.fn();
      onGeofenceEvent(callback);

      const calls = (mockEmitter.addListener as jest.Mock).mock.calls;
      const geoCall = calls.find((call: any[]) => call[0] === 'onGeofenceEvent');
      const listener = geoCall![1];

      const rawEvent = {
        zoneId: 'zone1',
        zoneName: 'Office',
        eventType: 'ENTER',
        latitude: 51.5074,
        longitude: -0.1278,
        detectionTimeMs: 150.0,
        gpsAccuracy: 8.5,
        speedMps: 1.2,
        timestamp: 1000,
      };

      listener(rawEvent);

      expect(callback).toHaveBeenCalledWith({
        zoneId: 'zone1',
        zoneName: 'Office',
        type: 'enter',
        location: {
          latitude: 51.5074,
          longitude: -0.1278,
          accuracy: 8.5,
          speed: 1.2,
          timestamp: 1000,
        },
        timestamp: 1000,
      });
    });

    it('should convert uppercase eventType to lowercase', () => {
      const callback = jest.fn();
      onGeofenceEvent(callback);

      const calls = (mockEmitter.addListener as jest.Mock).mock.calls;
      const geoCall = calls.find((call: any[]) => call[0] === 'onGeofenceEvent');
      const listener = geoCall![1];

      listener({
        zoneId: 'z1',
        zoneName: 'Test',
        eventType: 'EXIT',
        latitude: 0,
        longitude: 0,
        gpsAccuracy: 10,
        timestamp: 1000,
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exit',
        })
      );
    });
  });

  describe('onError', () => {
    it('should register listener on onError event', () => {
      const callback = jest.fn();
      onError(callback);
      const calls = (mockEmitter.addListener as jest.Mock).mock.calls;
      const found = calls.find((call: any[]) => call[0] === 'onError');
      expect(found).toBeDefined();
    });

    it('should return subscription with remove method', () => {
      const callback = jest.fn();
      const subscription = onError(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('onPerformance', () => {
    it('should register listener on onPerformance event', () => {
      const callback = jest.fn();
      onPerformance(callback);
      const calls = (mockEmitter.addListener as jest.Mock).mock.calls;
      const found = calls.find((call: any[]) => call[0] === 'onPerformance');
      expect(found).toBeDefined();
    });

    it('should return subscription with remove method', () => {
      const callback = jest.fn();
      const subscription = onPerformance(callback);
      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });
  });

  describe('removeAllListeners', () => {
    it('should call removeAllListeners for onLocation', () => {
      removeAllListeners();
      const calls = (mockEmitter.removeAllListeners as jest.Mock).mock.calls;
      expect(calls).toContainEqual(['onLocation']);
    });

    it('should call removeAllListeners for onGeofenceEvent', () => {
      removeAllListeners();
      const calls = (mockEmitter.removeAllListeners as jest.Mock).mock.calls;
      expect(calls).toContainEqual(['onGeofenceEvent']);
    });

    it('should call removeAllListeners for onError', () => {
      removeAllListeners();
      const calls = (mockEmitter.removeAllListeners as jest.Mock).mock.calls;
      expect(calls).toContainEqual(['onError']);
    });

    it('should call removeAllListeners for onPerformance', () => {
      removeAllListeners();
      const calls = (mockEmitter.removeAllListeners as jest.Mock).mock.calls;
      expect(calls).toContainEqual(['onPerformance']);
    });

    it('should call removeAllListeners exactly 4 times', () => {
      removeAllListeners();
      expect((mockEmitter.removeAllListeners as jest.Mock).mock.calls.length).toBe(4);
    });
  });

  describe('Subscription removal', () => {
    it('should remove subscription independently', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const mockSub1 = { remove: jest.fn() };
      const mockSub2 = { remove: jest.fn() };

      (mockEmitter.addListener as jest.Mock)
        .mockReturnValueOnce(mockSub1)
        .mockReturnValueOnce(mockSub2);

      const sub1 = onLocationUpdate(callback1);
      onLocationUpdate(callback2);

      sub1.remove();

      expect(mockSub1.remove).toHaveBeenCalled();
      expect(mockSub2.remove).not.toHaveBeenCalled();
    });
  });

  describe('Multiple listeners', () => {
    it('should support multiple listeners for same event', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const sub1 = onLocationUpdate(callback1);
      const sub2 = onLocationUpdate(callback2);

      expect((mockEmitter.addListener as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(sub1).toHaveProperty('remove');
      expect(sub2).toHaveProperty('remove');
    });

    it('should support listeners across different event types', () => {
      const locCallback = jest.fn();
      const geoCallback = jest.fn();
      const errCallback = jest.fn();
      const perfCallback = jest.fn();

      const locSub = onLocationUpdate(locCallback);
      const geoSub = onGeofenceEvent(geoCallback);
      const errSub = onError(errCallback);
      const perfSub = onPerformance(perfCallback);

      expect(locSub).toHaveProperty('remove');
      expect(geoSub).toHaveProperty('remove');
      expect(errSub).toHaveProperty('remove');
      expect(perfSub).toHaveProperty('remove');
    });
  });
});
