import { getMockEventEmitter } from './setup';
import { NativeModules } from 'react-native';
import { Polyfence } from '../src/Polyfence';
import { normalizeGeofenceEvent } from '../src/events';
import type { PolyfenceConfiguration } from '../src/types';

/**
 * Test-parity contract (`polyfence-react-native/tasks/lessons.md` L202):
 * every case here has a matching Kotlin `PendingEventsQueueTest.kt` and Swift
 * `PendingEventsQueueTests.swift` counterpart on the native side. Drift
 * between the three surfaces is exactly the class of gap that Bug-028 caught
 * on the previous release train.
 */
describe('Pending events queue', () => {
  const NativePolyfence = NativeModules.Polyfence;

  const resetSingleton = () => {
    (Polyfence as unknown as { _instance: Polyfence | null })._instance = null;
  };

  beforeEach(async () => {
    resetSingleton();
    await Polyfence.instance.initialize();
    jest.clearAllMocks();
  });

  describe('drainPendingEvents', () => {
    it('returns an empty list when the native queue is empty', async () => {
      (NativePolyfence.drainPendingEvents as jest.Mock).mockResolvedValueOnce(
        [],
      );
      const result = await Polyfence.instance.drainPendingEvents();
      expect(result).toEqual([]);
      expect(NativePolyfence.drainPendingEvents).toHaveBeenCalledTimes(1);
    });

    it('stamps deliveredLate=true, capturedTs and queuedDurationMs on drained events', async () => {
      const capturedAt = 1_700_000_000_000;
      const now = capturedAt + 5_000;
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(now);

      (NativePolyfence.drainPendingEvents as jest.Mock).mockResolvedValueOnce([
        {
          zoneId: 'z1',
          zoneName: 'Home',
          eventType: 'ENTER',
          latitude: 51.5074,
          longitude: -0.1278,
          gpsAccuracy: 8.5,
          timestamp: capturedAt,
          detectionTimeMs: 150,
          distanceToBoundaryM: 12.3,
        },
      ]);

      const result = await Polyfence.instance.drainPendingEvents();
      nowSpy.mockRestore();

      expect(result).toHaveLength(1);
      const drained = result[0]!;
      expect(drained).toEqual(
        expect.objectContaining({
          zoneId: 'z1',
          zoneName: 'Home',
          type: 'enter',
          deliveredLate: true,
          capturedTs: capturedAt,
          queuedDurationMs: 5_000,
          detectionTimeMs: 150,
          distanceToBoundaryM: 12.3,
        }),
      );
      expect(drained.timestamp).toBe(capturedAt);
    });

    it('preserves oldest-first order from the native drain', async () => {
      const t0 = 1_700_000_000_000;
      (NativePolyfence.drainPendingEvents as jest.Mock).mockResolvedValueOnce([
        {
          zoneId: 'z1',
          zoneName: 'A',
          eventType: 'ENTER',
          latitude: 0,
          longitude: 0,
          gpsAccuracy: 10,
          timestamp: t0,
        },
        {
          zoneId: 'z1',
          zoneName: 'A',
          eventType: 'EXIT',
          latitude: 0,
          longitude: 0,
          gpsAccuracy: 10,
          timestamp: t0 + 60_000,
        },
      ]);

      const result = await Polyfence.instance.drainPendingEvents();
      expect(result.map((e) => e.type)).toEqual(['enter', 'exit']);
      const first = result[0]!;
      const second = result[1]!;
      expect(first.capturedTs!).toBeLessThan(second.capturedTs!);
    });

    it('drops raw entries whose eventType is unknown without throwing', async () => {
      (NativePolyfence.drainPendingEvents as jest.Mock).mockResolvedValueOnce([
        {
          zoneId: 'z1',
          zoneName: 'A',
          eventType: 'ENTER',
          latitude: 0,
          longitude: 0,
          gpsAccuracy: 10,
          timestamp: 1000,
        },
        {
          zoneId: 'z2',
          zoneName: 'B',
          eventType: 'GARBAGE',
          latitude: 0,
          longitude: 0,
          gpsAccuracy: 10,
          timestamp: 2000,
        },
      ]);
      const result = await Polyfence.instance.drainPendingEvents();
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe('enter');
    });

    it('is safe when the native drain returns a non-array (defensive normalisation)', async () => {
      (NativePolyfence.drainPendingEvents as jest.Mock).mockResolvedValueOnce(
        null,
      );
      const result = await Polyfence.instance.drainPendingEvents();
      expect(result).toEqual([]);
    });
  });

  describe('pendingEventsDroppedCount', () => {
    it('returns 0 initially and passes through non-zero values from native', async () => {
      (
        NativePolyfence.pendingEventsDroppedCount as jest.Mock
      ).mockResolvedValueOnce(0);
      expect(await Polyfence.instance.pendingEventsDroppedCount()).toBe(0);

      (
        NativePolyfence.pendingEventsDroppedCount as jest.Mock
      ).mockResolvedValueOnce(42);
      expect(await Polyfence.instance.pendingEventsDroppedCount()).toBe(42);
    });

    it('coerces a non-numeric native response to 0', async () => {
      (
        NativePolyfence.pendingEventsDroppedCount as jest.Mock
      ).mockResolvedValueOnce('not a number' as unknown as number);
      expect(await Polyfence.instance.pendingEventsDroppedCount()).toBe(0);
    });
  });

  describe('assertInitialized guard', () => {
    beforeEach(() => {
      resetSingleton();
      jest.clearAllMocks();
    });

    it('drainPendingEvents rejects before initialize() and never reaches native', async () => {
      await expect(Polyfence.instance.drainPendingEvents()).rejects.toThrow(
        /call initialize\(\) before any other method/,
      );
      expect(NativePolyfence.drainPendingEvents).not.toHaveBeenCalled();
    });

    it('pendingEventsDroppedCount rejects before initialize() and never reaches native', async () => {
      await expect(
        Polyfence.instance.pendingEventsDroppedCount(),
      ).rejects.toThrow(/call initialize\(\) before any other method/);
      expect(NativePolyfence.pendingEventsDroppedCount).not.toHaveBeenCalled();
    });
  });

  describe('pendingEventsQueueSize config field', () => {
    beforeEach(() => {
      resetSingleton();
      jest.clearAllMocks();
    });

    it('propagates a positive value from initialize() config to the native config map', async () => {
      const config: PolyfenceConfiguration = { pendingEventsQueueSize: 500 };
      await Polyfence.instance.initialize(config);
      expect(NativePolyfence.initialize).toHaveBeenCalledWith({ config });
    });

    it('propagates through updateConfiguration()', async () => {
      await Polyfence.instance.initialize();
      jest.clearAllMocks();

      await Polyfence.instance.updateConfiguration({
        pendingEventsQueueSize: 250,
      });
      expect(NativePolyfence.updateConfiguration).toHaveBeenCalledWith({
        pendingEventsQueueSize: 250,
      });
    });

    it('is accepted as a known configuration key (no unknown-key rejection)', async () => {
      await Polyfence.instance.initialize();
      jest.clearAllMocks();
      await Polyfence.instance.updateConfiguration({
        pendingEventsQueueSize: 0,
      });
      expect(NativePolyfence.updateConfiguration).toHaveBeenCalledWith({
        pendingEventsQueueSize: 0,
      });
    });
  });

  describe('default off = zero behaviour change', () => {
    beforeEach(() => {
      resetSingleton();
      jest.clearAllMocks();
    });

    it('initialize + dispose without any drain calls invokes no queue-related native ops', async () => {
      await Polyfence.instance.initialize();
      await Polyfence.instance.dispose();

      expect(NativePolyfence.drainPendingEvents).not.toHaveBeenCalled();
      expect(NativePolyfence.pendingEventsDroppedCount).not.toHaveBeenCalled();
    });

    it('a live geofence event carries no additive queue fields', () => {
      const event = normalizeGeofenceEvent({
        zoneId: 'z1',
        zoneName: 'A',
        eventType: 'ENTER',
        latitude: 0,
        longitude: 0,
        gpsAccuracy: 10,
        timestamp: 1000,
      });
      expect(event).not.toBeNull();
      expect(event!.deliveredLate).toBeUndefined();
      expect(event!.capturedTs).toBeUndefined();
      expect(event!.queuedDurationMs).toBeUndefined();
    });

    it('the onGeofenceEvent live listener receives events with the queue fields undefined', () => {
      const callback = jest.fn();
      Polyfence.instance.onGeofenceEvent(callback);
      const mockEmitter = getMockEventEmitter();
      const registered = (mockEmitter.addListener as jest.Mock).mock.calls.find(
        (c: unknown[]) => c[0] === 'onGeofenceEvent',
      );
      const listener = registered![1] as (raw: unknown) => void;

      listener({
        zoneId: 'z1',
        zoneName: 'A',
        eventType: 'EXIT',
        latitude: 0,
        longitude: 0,
        gpsAccuracy: 10,
        timestamp: 4242,
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'exit',
          deliveredLate: undefined,
          capturedTs: undefined,
          queuedDurationMs: undefined,
        }),
      );
    });
  });
});
