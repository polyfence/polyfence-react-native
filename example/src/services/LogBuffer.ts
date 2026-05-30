import { Platform } from 'react-native';
import type { LogLevel } from '../types';

const MAX_RING_ENTRIES = 500;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function formatTimestamp(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}.${pad3(date.getMilliseconds())}`;
}

/**
 * In-memory ring buffer for SDK diagnostic logs.
 *
 * The example app uses this to show "what's the SDK doing right now" via
 * LogExportButton (Share-API export) and the badge on the bell. Entries
 * live in memory only — they don't survive an app restart. That keeps the
 * example free of react-native-fs and scoped-storage concerns. A real app
 * that needs persistence can layer disk + enrichment (battery, network)
 * on top without touching the consumers of this surface.
 */
export class LogBuffer {
  private static _entries: string[] = [];
  private static _initialized = false;
  private static _sessionStart: Date | null = null;

  static minimumLevel: LogLevel = 'debug';

  static get count(): number {
    return LogBuffer._entries.length;
  }

  static get sessionStart(): Date | null {
    return LogBuffer._sessionStart;
  }

  /**
   * Stable identifier used as a fallback in export titles. Real device
   * model names need react-native-device-info; the example skips that
   * dependency and uses the platform name instead.
   */
  static get deviceName(): string {
    return `polyfence-example-${Platform.OS}`;
  }

  static initialize(): void {
    if (LogBuffer._initialized) return;
    LogBuffer._initialized = true;
    LogBuffer._sessionStart = new Date();
    LogBuffer.add('Logger initialized', 'info');
  }

  static add(message: string, level: LogLevel = 'info'): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[LogBuffer.minimumLevel]) {
      return;
    }

    const timestamp = formatTimestamp(new Date());
    const levelStr = level.toUpperCase().padEnd(5);
    const entry = `[${timestamp}] [${levelStr}] ${message}`;

    LogBuffer._entries.push(entry);
    if (LogBuffer._entries.length > MAX_RING_ENTRIES) {
      LogBuffer._entries.splice(
        0,
        LogBuffer._entries.length - MAX_RING_ENTRIES,
      );
    }
  }

  /**
   * Returns the full in-memory buffer as text, prefixed with a session
   * header. Callers feed this to React Native's Share API.
   */
  static buildExportText(): string {
    const now = new Date();
    const sessionStart = LogBuffer._sessionStart ?? now;
    const durationMs = now.getTime() - sessionStart.getTime();
    const durationSec = Math.floor(durationMs / 1000);
    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor((durationSec % 3600) / 60);
    const seconds = durationSec % 60;

    const header = [
      '=== POLYFENCE RN EXAMPLE APP LOG ===',
      `Platform: ${Platform.OS}`,
      `Session: ${sessionStart.toISOString()}`,
      `Duration: ${hours}h ${minutes}m ${seconds}s`,
      `Ring buffer: ${LogBuffer._entries.length} / ${MAX_RING_ENTRIES}`,
      '=================================',
    ].join('\n');

    return header + '\n\n' + LogBuffer._entries.join('\n');
  }

  static clear(): void {
    LogBuffer._entries = [];
  }

  static dispose(): void {
    LogBuffer._entries = [];
    LogBuffer._initialized = false;
    LogBuffer._sessionStart = null;
  }
}
