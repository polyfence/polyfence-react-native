import { NativeModules } from 'react-native';
import { Polyfence } from '../src/Polyfence';
import type { NotificationText, Zone } from '../src/types';

const native = NativeModules.Polyfence as {
  updateConfiguration: jest.Mock;
  getZone: jest.Mock;
};

/**
 * The two additions this bridge carries from polyfence-core 3.1.0: the
 * `notificationText` configuration group, and `getZone` for reading back what
 * was attached to a zone.
 *
 * `notificationText` is a pass-through, so what is worth asserting is that the
 * key is accepted at all. The bridge rejects any configuration key it does not
 * recognise rather than letting the native side ignore it, which means a key
 * missing from the allow-list does not quietly do nothing: it throws. A test
 * that only checked the happy path of some other key would never notice.
 */
describe('notificationText', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (Polyfence as unknown as { _instance: Polyfence | null })._instance = null;
    await Polyfence.instance.initialize();
  });

  it('is accepted by updateConfiguration rather than rejected as unknown', async () => {
    // Acceptance is the assertion: an unrecognised key throws here rather than
    // reaching the native side, so reaching it at all is the thing to check.
    await Polyfence.instance.updateConfiguration({
      notificationText: { enterTitle: 'Arrivé à {zone}' },
    });

    expect(native.updateConfiguration).toHaveBeenCalledTimes(1);
  });

  it('is accepted by initialize', async () => {
    (Polyfence as unknown as { _instance: Polyfence | null })._instance = null;
    await expect(
      Polyfence.instance.initialize({
        notificationText: { enterTitle: 'Arrivé à {zone}' },
      }),
    ).resolves.toBeUndefined();
  });

  it('reaches the native side unchanged', async () => {
    // A placeholder must survive the bridge verbatim. Anything that treated
    // the braces as something to interpolate here would reach the tray already
    // filled in, or emptied.
    const notificationText: NotificationText = {
      trackingTitle: 'Roadie',
      enterTitle: 'Arrivé à {zone}',
      dwellBodyHoursMinutes: '{hours} h {minutes} min sur place',
      alertChannelName: 'Alertes de zone',
    };

    await Polyfence.instance.updateConfiguration({ notificationText });

    expect(native.updateConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({ notificationText }),
    );
  });

  it('carries a whole group of fourteen keys through', async () => {
    // Every key the native side accepts, so one missing from the allow-list or
    // mangled in transit shows up here rather than on a device.
    const notificationText: Required<NotificationText> = {
      trackingTitle: 'a',
      trackingText: 'b',
      trackingIconName: 'ic_tracking',
      enterTitle: 'c {zone}',
      dwellTitle: 'd {zone}',
      exitTitle: 'e {zone}',
      dwellBodyUnderMinute: 'f',
      dwellBodyMinutes: 'g {minutes}',
      dwellBodyHours: 'h {hours}',
      dwellBodyHoursMinutes: 'i {hours} {minutes}',
      trackingChannelName: 'j',
      trackingChannelDescription: 'k',
      alertChannelName: 'l',
      alertChannelDescription: 'm',
    };

    await Polyfence.instance.updateConfiguration({ notificationText });

    const sent = native.updateConfiguration.mock.calls[0][0];
    expect(Object.keys(sent.notificationText).sort()).toEqual(
      Object.keys(notificationText).sort(),
    );
    expect(Object.keys(sent.notificationText)).toHaveLength(14);
  });

  it('still rejects a key that is genuinely unknown', async () => {
    // Guards the allow-list addition itself: adding `notificationText` must not
    // have widened the check into accepting anything.
    await expect(
      Polyfence.instance.updateConfiguration({
        notificationTxt: { enterTitle: 'x' },
      } as unknown as Parameters<typeof Polyfence.instance.updateConfiguration>[0]),
    ).rejects.toThrow(/notificationTxt \(unknown\)/);
  });
});

describe('getZone', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (Polyfence as unknown as { _instance: Polyfence | null })._instance = null;
    await Polyfence.instance.initialize();
  });

  it('asks the native side for the id it was given', async () => {
    await Polyfence.instance.getZone('zone-1');
    expect(native.getZone).toHaveBeenCalledWith('zone-1');
  });

  it('returns the zone the native side stored, metadata included', async () => {
    // The point of the method: a crossing handler holds a zoneId and wants
    // whatever the app attached to that zone.
    const stored: Zone = {
      id: 'zone-1',
      name: 'Home',
      type: 'circle',
      center: { latitude: 51.5, longitude: -0.1 },
      radius: 100,
      metadata: { note: 'milk', pinned: true },
    };
    native.getZone.mockResolvedValueOnce(stored);

    await expect(Polyfence.instance.getZone('zone-1')).resolves.toEqual(stored);
  });

  it('returns null for a zone that was never added', async () => {
    native.getZone.mockResolvedValueOnce(null);
    await expect(Polyfence.instance.getZone('nope')).resolves.toBeNull();
  });

  it('returns null, not undefined, when iOS resolves a nil result', async () => {
    // React Native on iOS passes no argument for a nil resolve, so the native
    // promise settles with undefined. Android resolves null. The caller is
    // promised null for an absent zone on both.
    native.getZone.mockResolvedValueOnce(undefined);
    await expect(Polyfence.instance.getZone('nope')).resolves.toBeNull();
  });

  it('rejects before initialize, like the other zone methods', async () => {
    (Polyfence as unknown as { _instance: Polyfence | null })._instance = null;
    await expect(Polyfence.instance.getZone('zone-1')).rejects.toThrow();
    expect(native.getZone).not.toHaveBeenCalled();
  });

  it('rejects after dispose', async () => {
    await Polyfence.instance.dispose();
    await expect(Polyfence.instance.getZone('zone-1')).rejects.toThrow();
  });
});
