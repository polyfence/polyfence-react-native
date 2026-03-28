import { AppState } from 'react-native';
import type { NativeEventSubscription } from 'react-native';
import { PolyfenceAnalytics } from './analytics';

type AppStateStatus = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

/**
 * Manages app lifecycle transitions for analytics.
 * Calls PolyfenceAnalytics.endSession() when the app moves to background.
 *
 * Port of Flutter's AppLifecycleManager — same behavior:
 * background/inactive triggers session end, matching Flutter's paused/detached.
 */
export class AppLifecycleManager {
  private static _instance: AppLifecycleManager | null = null;

  private _subscription: NativeEventSubscription | null = null;
  private _currentState: AppStateStatus = 'unknown';
  private _initialized = false;

  static get instance(): AppLifecycleManager {
    if (!AppLifecycleManager._instance) {
      AppLifecycleManager._instance = new AppLifecycleManager();
    }
    return AppLifecycleManager._instance;
  }

  private constructor() {}

  initialize(): void {
    if (this._initialized) {
      return;
    }

    this._currentState = AppState.currentState as AppStateStatus;

    this._subscription = AppState.addEventListener('change', (nextState: string) => {
      const prevState = this._currentState;
      this._currentState = nextState as AppStateStatus;

      // App moving to background — end session and upload telemetry
      if (
        prevState === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        // Fire-and-forget — analytics must never block the app
        PolyfenceAnalytics.instance.endSession().catch(() => {
          // Silently swallow — analytics errors are non-fatal
        });
      }

      // App returning to foreground — retry failed requests
      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active'
      ) {
        PolyfenceAnalytics.instance.retryFailedRequests().catch(() => {
          // Silently swallow
        });
      }
    });

    this._initialized = true;
  }

  dispose(): void {
    if (this._subscription) {
      this._subscription.remove();
      this._subscription = null;
    }
    this._initialized = false;
    this._currentState = 'unknown';
  }
}
