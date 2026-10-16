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

/**
 * The server rejects a request with no Idempotency-Key (400) and dedupes on
 * the key, so a retry must send the key its first send used. Before this, the
 * retry sent no key at all: every queued session got a 400 and never landed.
 */
describe('PolyfenceAnalytics retry — Idempotency-Key reuse', () => {
  const PREFIX = 'polyfence_analytics_retry_';
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  const telemetry = {
    app_identifier: 'io.polyfence.qar',
    session_duration_minutes: 12,
  };

  const resetSingleton = () => {
    (
      PolyfenceAnalytics as unknown as { _instance: PolyfenceAnalytics | null }
    )._instance = null;
  };

  // Minimal in-memory AsyncStorage stand-in.
  const makeStorage = (initial: Record<string, string> = {}) => {
    const data = new Map(Object.entries(initial));
    return {
      data,
      getItem: jest.fn(async (k: string) => data.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        data.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        data.delete(k);
      }),
      getAllKeys: jest.fn(async () => [...data.keys()]),
    };
  };

  let fetchMock: jest.Mock;

  const keyOfCall = (i: number) =>
    (fetchMock.mock.calls[i][1] as { headers: Record<string, string> }).headers[
      'Idempotency-Key'
    ];

  beforeEach(() => {
    resetSingleton();
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const init = (storage?: ReturnType<typeof makeStorage>) =>
    PolyfenceAnalytics.instance.initialize(
      {},
      '3.0.1',
      async () => telemetry as unknown as SessionTelemetry,
      storage,
    );

  it('retries a failed upload with the same key as its first send', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, status: 201 });
    init();

    await PolyfenceAnalytics.instance.endSession();
    await PolyfenceAnalytics.instance.retryFailedRequests();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(keyOfCall(0)).toMatch(UUID);
    expect(keyOfCall(1)).toBe(keyOfCall(0));

    // Accepted, so the queue is empty and nothing is sent again.
    await PolyfenceAnalytics.instance.retryFailedRequests();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the same key across repeated failed retries and a server error', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    init();

    await PolyfenceAnalytics.instance.endSession();
    await PolyfenceAnalytics.instance.retryFailedRequests();
    await PolyfenceAnalytics.instance.retryFailedRequests();
    await PolyfenceAnalytics.instance.retryFailedRequests();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const first = keyOfCall(0);
    expect(first).toMatch(UUID);
    for (let i = 1; i < 4; i++) {
      expect(keyOfCall(i)).toBe(first);
    }
  });

  it('carries the key through a storage adapter', async () => {
    const storage = makeStorage();
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: true, status: 201 });
    init(storage);

    await PolyfenceAnalytics.instance.endSession();
    const entry = [...storage.data.keys()][0] ?? '';
    expect(entry.endsWith(`_${keyOfCall(0)}`)).toBe(true);

    // A fresh instance, as after an app restart, reads the key back from storage.
    resetSingleton();
    init(storage);
    await PolyfenceAnalytics.instance.retryFailedRequests();

    expect(keyOfCall(1)).toBe(keyOfCall(0));
    expect(storage.data.size).toBe(0);
  });

  it('keeps two failures in the same millisecond as separate entries', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_760_000_000_000);
    const storage = makeStorage();
    fetchMock.mockRejectedValue(new Error('offline'));
    init(storage);

    await PolyfenceAnalytics.instance.endSession();
    await PolyfenceAnalytics.instance.endSession();

    expect(storage.data.size).toBe(2);
  });

  it('gives an entry from an older version a stable key without rewriting storage', async () => {
    const legacyName = `${PREFIX}1743150000000`;
    const legacyValue = JSON.stringify({ ...telemetry, platform: 'android' });
    const storage = makeStorage({ [legacyName]: legacyValue });
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    init(storage);

    await PolyfenceAnalytics.instance.retryFailedRequests();
    await PolyfenceAnalytics.instance.retryFailedRequests();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(keyOfCall(0)).toMatch(/^legacy-[0-9a-f]{16}$/);
    expect(keyOfCall(0)).not.toContain('1743150000000');
    expect(keyOfCall(1)).toBe(keyOfCall(0));
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.data.size).toBe(0);
  });

  it('derives the same legacy key as the Flutter bridge', async () => {
    // Same vector as polyfence-flutter's telemetry_retry_idempotency_test, so
    // the two implementations cannot drift apart unnoticed.
    const storage = makeStorage({
      [`${PREFIX}1743150000000`]:
        '{"app_identifier":"io.polyfence.qar","platform":"android","note":"é→"}',
    });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201 });
    init(storage);

    await PolyfenceAnalytics.instance.retryFailedRequests();

    expect(keyOfCall(0)).toBe('legacy-c8bbec26dfdca317');
  });

  it('does not let the queue time in a legacy name reach the key', async () => {
    const value = JSON.stringify({ ...telemetry, platform: 'android' });
    const storage = makeStorage({
      [`${PREFIX}1743150000000`]: value,
      [`${PREFIX}1760000000000`]: value,
    });
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    init(storage);

    await PolyfenceAnalytics.instance.retryFailedRequests();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(keyOfCall(1)).toBe(keyOfCall(0));
  });

  it('joins a retry already in flight instead of sending entries twice', async () => {
    let release: (v: { ok: boolean; status: number }) => void = () => {};
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
    init();
    await PolyfenceAnalytics.instance.endSession();

    const a = PolyfenceAnalytics.instance.retryFailedRequests();
    const b = PolyfenceAnalytics.instance.retryFailedRequests();
    await new Promise((r) => setImmediate(r));
    release({ ok: true, status: 201 });
    await Promise.all([a, b]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
