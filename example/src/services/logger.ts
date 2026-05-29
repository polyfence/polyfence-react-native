import { LogBuffer } from './LogBuffer';
import type { LogLevel } from '../types';

/**
 * Debug print wrapper. Outputs to console in __DEV__ builds,
 * and always captures to the exportable ring buffer.
 */
export function logDebug(message: string, level: LogLevel = 'info'): void {
  LogBuffer.add(message, level);

  if (__DEV__) {
    const prefix = `[${level.toUpperCase()}]`;
    switch (level) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      default:
        console.log(prefix, message);
        break;
    }
  }
}
