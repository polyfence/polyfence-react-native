import { PolyfenceAnalytics } from '../src/analytics';
import type { SessionTelemetry } from '../src/types';

/**
 * Regression coverage for #58: the native bridge (polyfence-core) emits
 * snake_case telemetry keys, but endSession() previously read the camelCase
 * fields off the (camelCase-typed) object, which were `undefined` at runtime,
 * so the zero-duration guard dropped EVERY React Native session before upload.
 * These tests pin that endSession reads the real snake_case keys.
 *
 * Since #63 the SessionTelemetry type carries those same snake_case names, so
 * the fixture below needs no reshaping to satisfy it.
 */
describe('PolyfenceAnalytics.endSession — snake_case native telemetry (#58)', () => {
  const resetSingleton = () => {
    (
      PolyfenceAnalytics as unknown as { _instance: PolyfenceAnalytics | null }
    )._instance = null;
  };

  // The runtime shape the native bridge actually returns. The assertion
  // covers the `over` spread and the keys core emits that SessionTelemetry
  // leaves to its index signature, not any change of case.
  const nativeTelemetry = (
    over: Record<string, unknown> = {},
  ): SessionTelemetry =>
    ({
      app_identifier: 'io.polyfence.qar',
      session_duration_minutes: 24,
      avg_gps_interval_ms: 30000,
      zone_count: 3,
      false_event_count: 0,
      zone_transition_count: 6,
      session_start_hour: 9,
      detection_time_avg_ms: 118,
      gps_ok_ratio: 0.92,
      ...over,
    } as SessionTelemetry);

  let fetchMock: jest.Mock;

  beforeEach(() => {
    resetSingleton();
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201 });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  const init = (fetcher: () => Promise<SessionTelemetry>) =>
    PolyfenceAnalytics.instance.initialize({}, '2.0.1', fetcher);

  const sentBody = () =>
    JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);

  const sentHeader = (name: string) =>
    (fetchMock.mock.calls[0][1] as { headers: Record<string, string> }).headers[name];

  // The payload is a running total, so a session re-sent while it is still
  // growing differs only in its duration. A key minted per request made every
  // re-send a new row at the server, which deduplicates on the key.
  it('keys the upload on the session, not the request', async () => {
    init(async () => nativeTelemetry({ session_id: 'sess-abc' }));
    await PolyfenceAnalytics.instance.endSession();

    expect(sentHeader('Idempotency-Key')).toBe('sess-abc');
  });

  it('falls back to a generated key when core sends no session id', async () => {
    init(async () => nativeTelemetry());
    await PolyfenceAnalytics.instance.endSession();

    const key = sentHeader('Idempotency-Key');
    expect(typeof key).toBe('string');
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uploads when native returns snake_case session_duration_minutes', async () => {
    init(async () => nativeTelemetry());
    await PolyfenceAnalytics.instance.endSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = sentBody();
    expect(body.session_duration_minutes).toBe(24);
    expect(body.app_identifier).toBe('io.polyfence.qar');
    expect(body.bridge_platform).toBe('react-native');
  });

  it('skips upload when session_duration_minutes is zero', async () => {
    init(async () => nativeTelemetry({ session_duration_minutes: 0 }));
    await PolyfenceAnalytics.instance.endSession();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips upload when session_duration_minutes is missing', async () => {
    init(async () => nativeTelemetry({ session_duration_minutes: undefined }));
    await PolyfenceAnalytics.instance.endSession();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to "unknown" app_identifier when native omits it', async () => {
    init(async () => nativeTelemetry({ app_identifier: undefined }));
    await PolyfenceAnalytics.instance.endSession();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody().app_identifier).toBe('unknown');
  });

  it('does not upload when telemetry is disabled', async () => {
    PolyfenceAnalytics.instance.initialize(
      { disableTelemetry: true },
      '2.0.1',
      async () => nativeTelemetry(),
    );
    await PolyfenceAnalytics.instance.endSession();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
