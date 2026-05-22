import { Platform } from 'react-native';
import type { SessionTelemetry } from './types';

/**
 * Configuration for Polyfence analytics telemetry.
 * Telemetry is opt-out by default (D008).
 */
export interface AnalyticsConfig {
  /** Disable telemetry entirely. Defaults to false (telemetry ON). */
  disableTelemetry?: boolean;
  /** Industry category for segmentation (e.g. "logistics", "fitness"). */
  industryCategory?: string;
  /** Use case label (e.g. "delivery_tracking"). */
  useCase?: string;
  /** Custom analytics endpoint. Must be HTTPS. Defaults to polyfence.io. */
  apiEndpoint?: string;
  /** API key sent as x-api-key header. */
  apiKey?: string;
}

/**
 * Optional storage adapter for persisting the retry queue across app restarts.
 * Matches the @react-native-async-storage/async-storage interface.
 * If not provided, retry queue is in-memory only.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
}

const DEFAULT_ENDPOINT = 'https://polyfence.io/api/v1/telemetry/session';
const RETRY_KEY_PREFIX = 'polyfence_analytics_retry_';
const MAX_RETRY_ENTRIES = 50;

function generateIdempotencyKey(): string {
  // Simple UUID v4 without external dependency
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4';
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8];
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}

/**
 * Polyfence analytics service for React Native.
 * Collects session telemetry from the native engine and uploads it.
 *
 * Port of Flutter's PolyfenceAnalytics — same endpoint, same payload shape,
 * same opt-out behavior (D008), same retry queue (capped at 50).
 *
 * Posture: opt-OUT with one-line disable for anonymous aggregates.
 * Never coordinates, never identifiers, never PII.
 * See PRIVACY.md for the SDK privacy stance.
 */
export class PolyfenceAnalytics {
  private static _instance: PolyfenceAnalytics | null = null;

  private _initialized = false;
  private _config: AnalyticsConfig = {};
  private _pluginVersion = '';
  private _sessionTelemetryFetcher: (() => Promise<SessionTelemetry>) | null = null;
  private _storage: StorageAdapter | null = null;

  // In-memory retry queue (flushed to storage if adapter provided)
  private _memoryRetryQueue: Map<string, string> = new Map();

  static get instance(): PolyfenceAnalytics {
    if (!PolyfenceAnalytics._instance) {
      PolyfenceAnalytics._instance = new PolyfenceAnalytics();
    }
    return PolyfenceAnalytics._instance;
  }

  private constructor() {}

  /**
   * Initialize the analytics service.
   *
   * @param config Analytics configuration
   * @param pluginVersion Current plugin version string
   * @param sessionTelemetryFetcher Callback that fetches telemetry from the native engine
   * @param storage Optional storage adapter for persistent retry queue
   */
  initialize(
    config: AnalyticsConfig,
    pluginVersion: string,
    sessionTelemetryFetcher: () => Promise<SessionTelemetry>,
    storage?: StorageAdapter,
  ): void {
    if (config.apiEndpoint && !config.apiEndpoint.startsWith('https://')) {
      console.warn('[PolyfenceAnalytics] Endpoint must be HTTPS. Analytics disabled.');
      return;
    }

    this._config = config;
    this._pluginVersion = pluginVersion;
    this._sessionTelemetryFetcher = sessionTelemetryFetcher;
    this._storage = storage ?? null;
    this._initialized = true;
  }

  /**
   * End the current session — fetches native telemetry and uploads it.
   * Called automatically on app background transition by AppLifecycleManager.
   */
  async endSession(): Promise<void> {
    if (!this._initialized || this._config.disableTelemetry) {
      return;
    }

    if (!this._sessionTelemetryFetcher) {
      return;
    }

    try {
      const telemetry = await this._sessionTelemetryFetcher();

      // Skip sessions with zero duration
      if (!telemetry.sessionDurationMinutes || telemetry.sessionDurationMinutes <= 0) {
        return;
      }

      const payload: Record<string, unknown> = {
        ...telemetry,
        app_identifier: telemetry.bridgePlatform === 'react-native'
          ? (telemetry as Record<string, unknown>)['appIdentifier'] ?? 'unknown'
          : 'unknown',
        platform: Platform.OS,
        plugin_version: this._pluginVersion,
        bridge_platform: 'react-native',
      };

      if (this._config.industryCategory) {
        payload['industry_category'] = this._config.industryCategory;
      }
      if (this._config.useCase) {
        payload['use_case'] = this._config.useCase;
      }

      await this._sendPayload(payload);
    } catch (error) {
      // Analytics must never crash the app
      console.warn('[PolyfenceAnalytics] endSession failed:', error);
    }
  }

  /**
   * Retry previously failed analytics requests.
   * Call on app launch or periodically.
   */
  async retryFailedRequests(): Promise<void> {
    if (!this._initialized || this._config.disableTelemetry) {
      return;
    }

    try {
      const entries = await this._getRetryEntries();

      for (const [key, payloadStr] of entries) {
        try {
          const payload = JSON.parse(payloadStr) as Record<string, unknown>;
          const endpoint = this._config.apiEndpoint ?? DEFAULT_ENDPOINT;

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: this._buildHeaders(),
            body: JSON.stringify(payload),
          });

          if (response.ok || response.status === 409) {
            // Success or duplicate — remove from queue
            await this._removeRetryEntry(key);
          }
          // Non-ok: leave in queue for next retry cycle
        } catch {
          // Network error — leave in queue
        }
      }
    } catch (error) {
      console.warn('[PolyfenceAnalytics] retryFailedRequests failed:', error);
    }
  }

  /** Reset state. Called during dispose. */
  reset(): void {
    this._initialized = false;
    this._config = {};
    this._pluginVersion = '';
    this._sessionTelemetryFetcher = null;
    this._memoryRetryQueue.clear();
  }

  private async _sendPayload(payload: Record<string, unknown>): Promise<void> {
    const endpoint = this._config.apiEndpoint ?? DEFAULT_ENDPOINT;
    const idempotencyKey = generateIdempotencyKey();

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...this._buildHeaders(),
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status !== 409) {
        // Queue for retry
        await this._addRetryEntry(payload);
      }
    } catch {
      // Network failure — queue for retry
      await this._addRetryEntry(payload);
    }
  }

  private _buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `polyfence-react-native/${this._pluginVersion}`,
      'X-Platform': Platform.OS,
    };
    if (this._config.apiKey) {
      headers['x-api-key'] = this._config.apiKey;
    }
    return headers;
  }

  private async _addRetryEntry(payload: Record<string, unknown>): Promise<void> {
    const key = `${RETRY_KEY_PREFIX}${Date.now()}`;
    const value = JSON.stringify(payload);

    if (this._storage) {
      await this._storage.setItem(key, value);
      // Prune if over limit
      const allKeys = await this._storage.getAllKeys();
      const retryKeys = allKeys
        .filter(k => k.startsWith(RETRY_KEY_PREFIX))
        .sort();
      if (retryKeys.length > MAX_RETRY_ENTRIES) {
        const toRemove = retryKeys.slice(0, retryKeys.length - MAX_RETRY_ENTRIES);
        for (const k of toRemove) {
          await this._storage.removeItem(k);
        }
      }
    } else {
      this._memoryRetryQueue.set(key, value);
      // Prune in-memory
      if (this._memoryRetryQueue.size > MAX_RETRY_ENTRIES) {
        const keys = [...this._memoryRetryQueue.keys()].sort();
        const toRemove = keys.slice(0, keys.length - MAX_RETRY_ENTRIES);
        for (const k of toRemove) {
          this._memoryRetryQueue.delete(k);
        }
      }
    }
  }

  private async _getRetryEntries(): Promise<[string, string][]> {
    if (this._storage) {
      const allKeys = await this._storage.getAllKeys();
      const retryKeys = allKeys.filter(k => k.startsWith(RETRY_KEY_PREFIX));
      const entries: [string, string][] = [];
      for (const key of retryKeys) {
        const value = await this._storage.getItem(key);
        if (value) {
          entries.push([key, value]);
        }
      }
      return entries;
    }
    return [...this._memoryRetryQueue.entries()];
  }

  private async _removeRetryEntry(key: string): Promise<void> {
    if (this._storage) {
      await this._storage.removeItem(key);
    } else {
      this._memoryRetryQueue.delete(key);
    }
  }
}
