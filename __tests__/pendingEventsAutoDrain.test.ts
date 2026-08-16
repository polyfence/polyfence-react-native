import { NativeModules } from 'react-native';
import { getMockEventEmitter } from './setup';
import {
  onGeofenceEvent,
  onLocationUpdate,
  removeAllListeners,
  __resetGeofenceListenerCountForTests,
} from '../src/events';

const nativeModule = NativeModules.Polyfence as unknown as {
  setEventListenerActive: jest.Mock;
};

/**
 * The listener-live signal that triggers automatic delivery of the durable
 * pending-events queue.
 *
 * Every case here has a Kotlin counterpart in
 * `android/src/test/kotlin/io/polyfence/reactnative/PolyfenceModuleAutoDrainTest.kt`
 * and a Swift counterpart in
 * `test/ios/PolyfenceModuleAutoDrainTests.swift`.
 */
describe('geofence listener-live signal', () => {
  let mockEmitter: ReturnType<typeof getMockEventEmitter>;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetGeofenceListenerCountForTests();
    mockEmitter = getMockEventEmitter();
    (mockEmitter.addListener as jest.Mock).mockReturnValue({
      remove: jest.fn(),
    });
  });

  // The load-bearing property. Importing the module and calling initialize()
  // must not report a listener: the native engine would replay the queue
  // before any consumer has called onGeofenceEvent, and the events would
  // reach a callback that does not exist yet.
  it('reports nothing until a consumer subscribes', async () => {
    await NativeModules.Polyfence.initialize({ config: {} });

    expect(nativeModule.setEventListenerActive).not.toHaveBeenCalled();
  });

  it('reports active on the first geofence subscription', () => {
    onGeofenceEvent(jest.fn());

    expect(nativeModule.setEventListenerActive).toHaveBeenCalledTimes(1);
    expect(nativeModule.setEventListenerActive).toHaveBeenCalledWith(true);
  });

  it('does not re-report on a second concurrent subscription', () => {
    onGeofenceEvent(jest.fn());
    (nativeModule.setEventListenerActive as jest.Mock).mockClear();

    onGeofenceEvent(jest.fn());

    expect(nativeModule.setEventListenerActive).not.toHaveBeenCalled();
  });

  it('reports inactive only when the last subscription is removed', () => {
    const first = onGeofenceEvent(jest.fn());
    const second = onGeofenceEvent(jest.fn());
    (nativeModule.setEventListenerActive as jest.Mock).mockClear();

    first.remove();
    expect(nativeModule.setEventListenerActive).not.toHaveBeenCalled();

    second.remove();
    expect(nativeModule.setEventListenerActive).toHaveBeenCalledWith(false);
  });

  it('reports active again after a full unsubscribe / resubscribe cycle', () => {
    const first = onGeofenceEvent(jest.fn());
    first.remove();
    (nativeModule.setEventListenerActive as jest.Mock).mockClear();

    onGeofenceEvent(jest.fn());

    expect(nativeModule.setEventListenerActive).toHaveBeenCalledWith(true);
  });

  it('ignores a double-remove rather than reporting inactive twice', () => {
    const sub = onGeofenceEvent(jest.fn());
    const other = onGeofenceEvent(jest.fn());
    sub.remove();
    sub.remove();
    (nativeModule.setEventListenerActive as jest.Mock).mockClear();

    other.remove();

    expect(nativeModule.setEventListenerActive).toHaveBeenCalledTimes(1);
    expect(nativeModule.setEventListenerActive).toHaveBeenCalledWith(false);
  });

  it('does not report for non-geofence subscriptions', () => {
    onLocationUpdate(jest.fn());

    expect(nativeModule.setEventListenerActive).not.toHaveBeenCalled();
  });

  it('removeAllListeners reports the listener as gone', () => {
    onGeofenceEvent(jest.fn());
    (nativeModule.setEventListenerActive as jest.Mock).mockClear();

    removeAllListeners();

    expect(nativeModule.setEventListenerActive).toHaveBeenCalledWith(false);
  });

  it('removeAllListeners with nothing subscribed reports nothing', () => {
    removeAllListeners();

    expect(nativeModule.setEventListenerActive).not.toHaveBeenCalled();
  });

  it('a rejected native call does not surface to the subscriber', () => {
    (nativeModule.setEventListenerActive as jest.Mock).mockReturnValueOnce(
      Promise.reject(new Error('bridge down')),
    );

    expect(() => onGeofenceEvent(jest.fn())).not.toThrow();
  });

  it('a native module without the method is tolerated', () => {
    const original = nativeModule.setEventListenerActive;
    // A JS package newer than the installed native side: the method is simply
    // absent, and the queue stays pull-only rather than the subscription
    // throwing.
    delete (NativeModules.Polyfence as Record<string, unknown>)
      .setEventListenerActive;

    expect(() => onGeofenceEvent(jest.fn())).not.toThrow();

    (
      NativeModules.Polyfence as Record<string, unknown>
    ).setEventListenerActive = original;
  });
});
