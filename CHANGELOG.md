# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2026-08-05

### Added
- **Queued crossings now arrive automatically on first listen.** The first `Polyfence.onGeofenceEvent(handler)` subscription tells the native engine a listener is live, and it replays whatever the durable queue captured while the JS runtime was gone — through the same handler live events use. A crossing recorded across a backgrounded or killed app therefore reaches your code without you asking for it. Replayed events still carry `deliveredLate: true`, `capturedTs` and `queuedDurationMs`, so branching on replay-versus-live is unchanged. `drainPendingEvents()` remains available for manual control, and `pendingEventsAutoDrainEnabled: false` disables the automatic path.
- **`pendingEventsAutoDrainEnabled?: boolean` (default `true`) on `PolyfenceConfiguration`.** Opt out of the automatic replay above and keep the queue pull-only. Only meaningful with `pendingEventsQueueSize > 0`; the setting is persisted natively, so it survives the process kill the queue exists for.
- **Durable pending-events queue exposed on the RN bridge.** Set `pendingEventsQueueSize > 0` on `PolyfenceConfiguration` (e.g. `500`) to enable polyfence-core's on-disk queue for zone-crossing events that would otherwise drop when the JS runtime is torn down but the native tracker is still alive (Doze kill, RN bundle reload, foreground-service outliving the bridge). Off by default (`0` = disabled — today's behaviour) so existing integrations see zero behaviour change on upgrade. A negative `pendingEventsQueueSize` is coerced to `0` with a `console.warn`, matching the `gpsStalenessTimeoutMs` guard — a typo that would silently turn the queue off is rejected in the same shape.
- **`Polyfence.instance.drainPendingEvents(): Promise<GeofenceEvent[]>`** — atomically drains and clears the native queue, oldest-first. Each event carries `deliveredLate: true`, `capturedTs` (original native detection timestamp, ms since epoch), and `queuedDurationMs` (time the event sat on disk). Rejects with the standard not-initialized error when called before `initialize()`. When the native `LocationTracker` Service is running, drained events are also applied to the engine's persisted zone states so the next reconcile only fires `RECOVERY_ENTER` / `RECOVERY_EXIT` where a genuine mismatch remains.
- **`Polyfence.instance.pendingEventsDroppedCount(): Promise<number>`** — cumulative counter of events oldest-first eviction has dropped since a store was first constructed. Persists across process restarts; does not reset. Silent loss also surfaces on the existing `onError` channel as `PolyfenceError { type: 'pendingEventsEvicted', context: { context: { severity: 'warning', droppedCount, platform }, … } }` — a first-class, discriminable public type rather than a fallthrough to `unknown`. The native eviction payload lands nested under the generic error envelope's `context`, so read the eviction fields via `error.context?.context?.droppedCount` / `error.context?.context?.severity`. No new event channel.
- **Additive `GeofenceEvent` fields — `deliveredLate?: boolean`, `capturedTs?: number`, `queuedDurationMs?: number`.** Nullable / optional; live events never carry them (they read as `undefined`), drained events arrive with them stamped. Consumers unchanged unless they opt into the queue.
- **New `PolyfenceErrorType` value — `'pendingEventsEvicted'`.** Additive; existing consumers of the union that don't branch on it see no change. Consumers who care about silent-loss warnings can switch on the new type and read `error.context?.context?.droppedCount`.

- **OS wake fences — `osGeofenceWakeEnabled?: boolean` (default `false`) and `osGeofenceMaxRegions?: number` on `PolyfenceConfiguration`.** Surfaces polyfence-core 3.0.0's opt-in wake source, which lets a zone crossing be captured after the app's process is killed outright. Polyfence's own engine remains the sole detector; when enabled, the nearest active zones are additionally mirrored to the platform geofence API purely as an alarm clock, and a woken crossing is written into the durable pending-events queue for delivery on the next `drainPendingEvents()`. Needs `pendingEventsQueueSize > 0` to deliver anything — set the two together. `osGeofenceMaxRegions` is the slot budget while backgrounded; omit it to use each platform's own default — 50 of Android's 100-per-app allocation, 20 on iOS, which is Apple's hard cap. Values outside a platform's usable range are clamped natively, so `getConfiguration()` reports the effective budget rather than necessarily the value passed in.
- **`PolyfenceSystemStatus.osGeofenceRegistrationHealth` on `debugInfo()`.** A new nullable `OsGeofenceRegistrationHealth` shaped `{ requested, registered, lastError }`. `null` until a registration is attempted, which is what distinguishes "wake fences are off" from "wake fences are on and failing". `requested > registered` means the platform cap was reached and coverage is partial — expected on a large zone set, not an error. `lastError === 'background_location_denied'` means the grant wake fences need is missing.
- **New `PolyfenceErrorType` values — `'osGeofencePermissionDenied'`, `'osGeofenceRegistrationFailed'`, `'osGeofenceQueueDisabled'`.** polyfence-core emits all three; without these union members they arrived as `'unknown'` and a consumer could not tell degraded wake coverage apart from any other unmapped error. All three carry `severity: 'warning'` in the nested error context and leave tracking running. The iOS `gps_error` passthrough is now mapped explicitly to `'unknown'` rather than falling through unmapped.

### Changed (BREAKING)
- **`debugInfo()` returns only what was measured, so six fields are gone and five can now be `null`.** Removed from `PolyfenceDebugInfo`: `battery.estimatedHourlyDrain`, `battery.gpsActiveTimePercent`, `battery.wakeUpCount`, `zones.lastZoneUpdate`, `zones.zoneEventCounts` and `performance.cpuUsagePercent`. None ever carried a measurement — one was hours-since-start multiplied by five, another divided a duration by itself and so read `100` forever, a third returned zero from a function whose body was a note about what it would one day count. **Code reading them no longer type-checks**, which is deliberate: a silently-removed key would read as `undefined` at runtime, and nothing would say why.

  Five fields become nullable, because a platform that cannot measure something now says so instead of substituting a value:

  | Field | `null` when |
  |---|---|
  | `systemStatus.isBatteryOptimizationDisabled` | always on iOS — no such setting exists |
  | `systemStatus.isWakeLockAcquired` | always on iOS; on Android when no tracking service is running, since nothing could be holding a lock |
  | `performance.restartCount` | always on iOS — no foreground service to restart |
  | `performance.averageDetectionLatency` | until at least one crossing has been **timed** |
  | `battery.batteryLevel` | when the platform has not reported a level |

  New `performance.timedZoneDetections` says how many crossings contributed a latency sample. It is lower than `totalZoneDetections` when the engine synthesised a crossing outside a timed evaluation — a degraded-GPS exit, for instance. Those crossings are real, so they are counted; folding them into the mean as zero would drag it toward a speed nothing achieved.


  The iOS `null`s above come from polyfence-core, not from this bridge — which platform can measure what is core's knowledge, and mirroring it here would put the same facts in three places. They therefore hold from **core 3.0.0** onward, the version this package pins. What the bridge does enforce regardless of core version is narrower and version-independent: a battery charge outside 0-100, a latency average with no samples behind it, and any non-finite number are reported as `null`, because none of those can be a reading at any version.

  **Migration:** delete any access to the six removed fields; handle `null` on the five above; read `timedZoneDetections` when you need to know how many samples the latency average covers.

  `debugInfo()` now normalises the native payload rather than returning it untouched: a battery level outside `0–100` and an average latency with no samples behind it are both reported as `null`. Older native builds signal "not populated" with a sentinel rather than with `null`, and zero is the *best* possible latency — so a stale core paired with this bridge would otherwise show a perfect reading for something never measured. The bundled `DebugOverlay` renders an unknown battery level as `—` rather than `null%`.

### Changed
- **The listener signal is separate from the bridge-attach signal.** The JS side subscribes through `RCTDeviceEventEmitter`, so the native module's codegen `addListener` / `removeListeners` hooks are never invoked and cannot carry a listener signal. `Polyfence.onGeofenceEvent` therefore counts its own subscribers and reports the 0↔1 transitions to native through a new `setEventListenerActive` method. Bridge attach and JS subscription happen at different moments, and only the second means somebody is receiving — keying the automatic replay off the first would emit the queue at `initialize()` time, before any handler exists.
- **Base tracking on Android requires only foreground location.** `ACCESS_FINE_LOCATION` or `ACCESS_COARSE_LOCATION`, plus `FOREGROUND_SERVICE_LOCATION` on API 34+, is the whole requirement. Tracking runs as a foreground service typed `location`, which holds location access for as long as it runs; `ACCESS_BACKGROUND_LOCATION` governs location access *outside* a foreground service and is therefore needed only for `osGeofenceWakeEnabled`. The bridge's `requestPermissions()` check previously demanded it unconditionally on API 29+ and reported `false` before the native engine was consulted. iOS accepts "When In Use"; "Always" is needed only for wake fences.

  **What this means for your app.** The permission requirement moved, so a check of your own that still demands always-on location keeps the old behaviour regardless of what this bridge does:

  - **Relax your own permission gate to match.** Request the background grant only when you set `osGeofenceWakeEnabled`, and treat a denial as degraded wake coverage rather than a reason to refuse to start — tracking runs without it, and the degradation is reported as an `osGeofencePermissionDenied` error. On Android, requesting `ACCESS_BACKGROUND_LOCATION` once it has been denied shows no prompt and sends the user to the system settings screen, so do not request it "just in case".
  - **Declare the tracker service in your own manifest** with `android:foregroundServiceType="location"`. This package declares no `<service>` of its own, and that type is what grants a foreground service its location access — required from API 29 and hard-enforced from API 34, where `startForeground()` throws without it.
  - **Declare `ACCESS_BACKGROUND_LOCATION` only when you enable wake fences.** This package declares no permissions of its own, so nothing reaches your merged manifest unless you put it there — and declaring that one permission is what triggers Google Play's manual background-location review.
- **polyfence-core bumped 1.0.14 → 3.0.0.** Picks up the durable `PendingEventsStore` primitive, `LocationTracker.setBridgeAttached(Boolean)` — as both an instance method and a `Companion` wrapper mirroring `setBridgePlatform` / `setPendingCoreDelegate` — and `GeofenceEngine.applyDrainedEventsToState`, the drain-then-reconcile ordering the new bridge API depends on. See polyfence-core 3.0.0 CHANGELOG for the native details.
- **RN bridge lifecycle now toggles the persist-vs-live signal on the native tracker.** iOS `initialize()` re-flips `bridgeAttached=true` (a shared tracker carried over from a previous session may have latched false), `dispose()` and RCTEventEmitter `invalidate` flip to false (chained to `super.invalidate()` for the `NS_REQUIRES_SUPER` contract). Android does the same in `initialize()`, `dispose()`, and `onCatalystInstanceDestroy` via the `LocationTracker` companion helper — which stages the value if the Service is not yet up and applies it on `onCreate`. Direct-Kotlin / direct-Swift consumers see no change: `bridgeAttached` defaults to true on the Service.

## [2.1.1] - 2026-07-27

### Fixed
- **`onPerformance` no longer surfaces internal `status` pings (bridge removal) or health-score events (SDK-boundary filter).** Every zone/tracking method (`startTracking`, `stopTracking`, `addZone`, `removeZone`, `clearAllZones`) on both platforms was pushing an internal `{type: "status", trackingEnabled, zonesCount, profile, lastAccuracy, timestamp}` payload into the `onPerformance` emitter — the same channel that carries real `type: "runtime_status"` GPS metrics from polyfence-core `LocationTracker`. Consumers writing threshold guards saw non-metric payloads mixed in, and any `payload.data.*` field-access on the status-typed variant read `undefined`. Fixed on two axes for defense in depth: (a) both native bridges (`ios/PolyfenceModule.swift`, `android/src/main/kotlin/io/polyfence/reactnative/PolyfenceModule.kt`) no longer emit the status payload — the `sendStatus` helper and every call site is removed (no in-tree consumer branched on `type: "status"`; downstream apps that did are covered by the migration note under **Changed** below); and (b) the JS `onPerformance` handler in `src/events.ts` now filters `raw.type === 'runtime_status'` before invoking the caller's callback, dropping health-score events and any future non-runtime_status payloads at the SDK boundary. `onHealthScore` already filtered separately for `type: "health_score"` and is unaffected.

### Changed
- **`onPerformance` payload contract narrowed to `type: 'runtime_status'` (migration).** Prior README taught consumers to branch on `payload.type === 'status'` and read `trackingEnabled`, `zonesCount`, `profile`, `lastAccuracy` — those variants are gone. Direct replacements: use `getConfiguration()` for `profile`, track tracking-enabled state locally around your `startTracking()` / `stopTracking()` calls (there is no dedicated `isTracking` query on this bridge), and read the last GPS accuracy from a `runtime_status` payload's `currentGpsAccuracy` (nested under `payload.data`). For `zonesCount`, track it in your own app state as you call `addZone` / `removeZone` / `clearAllZones` — `getZoneStates()` only reports reliable state *after* `startTracking()` (on Android it returns `[]` before that, per its own docstring), so its `.length` is not a drop-in replacement for the old always-available `zonesCount` field. Health-score events also no longer arrive on `onPerformance` — use `onHealthScore`. `PerformanceEventPayload` JSDoc in `src/types.ts` was updated to match the new scope.

### Documented
- **`onPerformance` README rewritten to match the new behaviour (companion).** Previous "Performance Events" section described the channel as multiplexing `type: "status"` and `type: "runtime_status"` variants; the status variant is gone and `onPerformance` is now scoped to real `runtime_status` snapshots. Points the reader at `onHealthScore` for health events and includes an example subscription with cleanup.

## [2.1.0] - 2026-07-21

### Added
- **Degraded-GPS handling — `signalLost` / `signalRestored` events + `gpsStalenessTimeoutMs` config.** New `signalLost` / `signalRestored` members on the `GeofenceEventType` union, and a `gpsStalenessTimeoutMs` field (milliseconds; `0` = off, the default) on `PolyfenceConfiguration`, allowed through the config guard and forwarded to native. When enabled, prolonged GPS loss while inside a zone reports `signalLost` (membership uncertain, not exited) and resolves with `signalRestored` — or a normal `exit` if the device left during the gap. Activated by the polyfence-core 1.0.13 bump below.

### Changed
- **polyfence-core bumped 1.0.11 → 1.0.14.** Picks up (a) the `applyRemoveZoneDirect` / `applyClearZonesDirect` companion helpers used by the fix below, (b) the degraded-GPS staleness watchdog + `signalLost` / `signalRestored` events (1.0.13 — the event-forwarding wiring landed on the bridge in a prior release but stayed dormant because core 1.0.11 never emitted those events; the bump activates that surface), and (c) the iOS `PolyfenceDebugCollector.getErrorHistory` filter fix (1.0.14) that the iOS parity below depends on. See polyfence-core 1.0.13 + 1.0.14 CHANGELOGs.
- **Behavioural note (Android only):** `initialize(config)` with any tracking-config key now spins up the `LocationTracker` Service, where previously only `startTracking()` did. On Android 8+ from a backgrounded context, `context.startService` throws `IllegalStateException`, so the initialize promise now rejects where it previously silently dropped the config. Realistic apps call `initialize` on cold-start / foreground so this is not an incidental regression; call sites that init from a background service should catch and retry when the app foregrounds. iOS has no equivalent change.

### Fixed
- **`errorHistory()` on iOS no longer returns `[]` for every non-nil `timeRangeMs` window (iOS parity).** Delivered via the polyfence-core 1.0.14 bump in **Changed** above: `PolyfenceDebugCollector.getErrorHistory` on iOS was reading the stored timestamp as `error["timestamp"] as? Double` while the writer stored it as `Int64`, which failed the Swift bridge on `[String: Any]` and dropped every entry within a non-nil `timeRangeMs` window. The RN iOS bridge in `PolyfenceModule.getErrorHistory` was already wired to `PolyfenceDebugCollector.shared.getErrorHistory(...)` correctly — the underlying core filter was the load-bearing bug, and the core bump resolves it end-to-end. Android was unaffected: the RN Android bridge already used the safe `Number.toLong()` numeric coercion that Flutter Android needed a separate fix for.
- **`removeZone()` and `clearAllZones()` on Android are now synchronous read-after-write.** Both methods previously routed through a `startService` Intent to the `LocationTracker` foreground Service — the returned Promise resolved when the Intent had been queued, not when the Service had actually updated engine + persistence. A `getZoneStates()` immediately after a removal could still show the zone. Bridge now calls `LocationTracker.applyRemoveZoneDirect` / `applyClearZonesDirect` — the same direct-when-Service-is-running / Intent-fallback pattern the addZone and updateConfiguration paths already use. Immediately-following `getZoneStates()` calls now observe the removal on both platforms without any wait. iOS was already synchronous — no change there.
- **`debugInfo()` on Android no longer stalls the `@ReactMethod` invocation thread.** `collectDebugInfo` reaches `getCpuUsage()` in polyfence-core, which reads `/proc/stat` with a ~360ms sleep. Old Architecture dispatched `@ReactMethod` on a native-modules background thread and tolerated the block; New Architecture (Turbo Modules / Bridgeless) can invoke on the JS thread instead, where a 360ms stall drops frames and delays the Promise. The call is now dispatched to a dedicated background thread — `Promise.resolve` / `reject` are thread-safe and marshal back to JS. iOS is unaffected — `collectDebugInfo` on iOS hard-codes `cpuUsagePercent: 0.0` and never reads `/proc/stat`.
- **`initialize(config)` now applies every field of `PolyfenceConfiguration`, not just `disableAlertNotifications`.** The native `initialize` handler on both platforms was reading `pluginVersion` + `disableAlertNotifications` from the config map and silently dropping every other field — `accuracyProfile`, `updateStrategy`, `gpsAccuracyThreshold`, and all nested settings. Native `LocationTracker` retained stale / default state; consumers who passed a full `PolyfenceConfiguration` saw only two of its fields applied. Bridge now forwards the remaining keys through the merge-aware `updateConfigurationFromMap` path already used by later `updateConfiguration` calls, so `initialize(config)` and `updateConfiguration(config)` produce identical state.

### Documented
- **`addZone` docstring now documents duplicate-ID behaviour.** Calling `addZone` with a `zone.id` already being monitored silently overwrites the previous zone — no error is thrown. **Re-adding also resets the persisted INSIDE/OUTSIDE state for that zone (and on iOS, its confidence state).** If the device is currently inside the zone, the next reconciliation may fire a fresh `enter` / `recoveryEnter` event. In-place metadata edits without a re-enter are a known limitation. Behaviour is unchanged; only the documentation is new.

## [2.0.3] - 2026-07-08

### Changed
- **polyfence-core bumped 1.0.10 → 1.0.11.** Picks up the new `applyConfigurationDirect` companion helper on the Android side.
- **Android bridge switched to `LocationTracker.applyConfigurationDirect`.** Closes a read-after-write race where `await polyfence.updateConfiguration({...})` followed by an immediate `await polyfence.getConfiguration()` on the same thread could return pre-write state. Now returns after the mutation lands when the Service is already running; falls back to the previous `startService` Intent transport when the Service isn't running (read-after-write is only observable in the direct path). iOS bridges were never affected — they already call `updateConfigurationFromMap` directly.

### Fixed
- **Configuration round-trips faithfully through the bridge.**
  - `getConfiguration()` returns the full shape — native emits the 12-key `PolyfenceConfiguration` map; JS marshals enum strings to canonical camelCase.
  - `updateConfiguration()` is merge-aware end-to-end on both Android and iOS bridges — partial payloads preserve omitted keys instead of resetting them.
  - `disableAlertNotifications` write path wired through the bridge — write it, read it back, reset applies the default.
  - Polygon self-intersection warnings reach `onError` and `errorHistory` via the shared `NATIVE_CODE_TO_TYPE` mapping and its inverse `TYPE_TO_NATIVE_CODES`.
  - `errorHistory` retains warnings alongside errors; the `type` filter accepts either the canonical `PolyfenceErrorType` or its legacy native-code aliases so consumers on either shape keep working.

## [2.0.2] - 2026-07-04

### Changed (BREAKING)

- **polyfence-core bumped 1.0.9 → 1.0.10 — inherits core's breaking behaviors.** See polyfence-core CHANGELOG for the full details:
  - **** — `updateConfiguration` now MERGES over current state instead of REPLACING. Consumers that relied on partial updates resetting unspecified fields to defaults must now pass every field explicitly, or call `resetConfiguration()` first.
  - **** — Android `emitHealthScore` callback delivered on a background thread. UI or non-thread-safe work inside `onHealthScore` must be re-dispatched to main.
  - **** — `runtime_status` map returns a stable key set with `null` for unknown fields instead of omitting keys. Callers using `containsKey` / `in` presence checks must switch to null-checks.

- **`requestBatteryOptimizationExemption` now returns `Promise<void>`.** Previously returned `Promise<boolean>`. The prior boolean was meaningless — Android's `startActivity` is fire-and-forget and can't observe the user's response to the system dialog. **Migration:** stop awaiting a bool. Poll `batteryOptimizationStatus` after `AppState` becomes `active` again to check whether the user granted the exemption.

- **`getConfiguration()` returns lowerCamelCase enum strings.** Previously returned uppercase (e.g. `"MAX_ACCURACY"`, `"CONTINUOUS"`). Now returns `"maxAccuracy"`, `"continuous"`. Restores cross-platform parity with iOS, which never went through the Kotlin uppercasing path. **Migration:** update any string comparisons on `profile`, `updateStrategy`, `adaptiveMode`, etc. to match the lowerCamelCase form.

- **`PolyfenceDebugInfo` TypeScript type aligned with the native engine response.** The type previously described fields the native side never emitted, and omitted fields it did emit. Strict TypeScript consumers of `getDebugInfo()` may see new compile errors. **Migration:** re-inspect the actual `getDebugInfo()` shape (documented in the API section of the README) and update field access.

- **`onGeofenceEvent` payload no longer includes fields the native engine never populated (bridge companion).** Dropped `speedAtCrossing`, `deltaFromLast`, and other never-sent fields from the `GeofenceEvent` type. Consumers destructuring or reading these fields see `undefined` at runtime. **Migration:** remove references to the dropped fields; the ones still emitted (`zoneName`, `dwellDurationMs`, `detectionTimeMs`, `distanceToBoundaryM`) are typed and populated.

- **`updateConfiguration` and `initialize` REJECT unknown keys (#83).** Previously silently ignored. Now throws `"Polyfence: unknown key(s) in <caller>: <keys>"`. Catches typos before they cause silent behavior mismatches. **Migration:** if you were passing extra keys (intentional or otherwise), remove them.

- **Pre-2.x flat config props are fully removed (#83).** `PolyfenceConfiguration`'s `analyticsEnabled`, `industryCategory`, `saasApiKey`, `saasBaseUrl` — deprecated in 2.0 — now fully removed and rejected as unknown keys per the change above. **Migration:** use `AnalyticsConfig` (the second `initialize()` argument): `industryCategory` → `industryCategory`, `saasApiKey` → `apiKey`, `saasBaseUrl` → `apiEndpoint`, telemetry via `disableTelemetry`.

### Fixed

- ** RN companion — native `zone_validation_failed` error code now maps to `zoneValidationFailed` in the JS layer.** The polyfence-core `zone_validation_failed` structured error was landing on the RN `onError` stream but with the raw snake_case code. `NATIVE_CODE_TO_TYPE` in `src/events.ts` now maps it to the documented `zoneValidationFailed` enum member, matching every other error code shape.
- ** — status payload includes real `profile` and `lastAccuracy` from polyfence-core.** Previously `getStatus()` returned `profile: null` and `lastAccuracy: null` even while tracking. The bridge now reads `runtime_status.profile` and calls the new `getLastKnownAccuracy()` core accessor (added in polyfence-core 1.0.10 alongside the shape stabilization).
- **iOS parity — `updateConfiguration` on iOS routes through polyfence-core's merge-aware method.** The Swift bridge was still calling the old replace-semantics path even after core 1.0.10 added the merge method. Now uses the same code path as Android, so behavior matches across platforms.
- **Analytics telemetry actually reaches the SaaS.** The RN telemetry upload payload was serialized in camelCase where the SaaS expects snake_case, so every batch was silently rejected. Also fixed `app_identifier` attribution — previously always empty because the bridge read the wrong Android manifest field.

### Documented

- ** — RECOVERY_ENTER / RECOVERY_EXIT event semantics.** Follows polyfence-core 1.0.10's Events reference. The Quick Start Step 4 comment (added in) has also been corrected — it originally attributed recovery events to "GPS gaps (airplane mode, tunnel, background restart, etc.)", which is the wrong reading. Recovery events fire ONLY on tracking-process restart (Doze kill / OOM / force-stop / phone reboot), not on GPS signal recovery during an active session.
- ** — `onError` is the SDK's central error channel.** README + JSDoc now emphasize that every recoverable failure (permission changes, GPS restart failures, silent zone-add throws in core, etc.) reaches consumers through `onError`.
- ** — Quick Start Step 2 documents the Android-specific `requestPermissions` flow.** Explains why Android requires the two-step foreground-then-background permission dance and how to handle the "granted foreground but denied background" state.
- ** — Quick Start Step 4 handles `recoveryEnter` / `recoveryExit`** in the example switch (see above for the follow-up semantic correction).
- **iOS Critical Alerts entitlement + App Store review + privacy-policy guidance** added to SECURITY.md.
- **`onPerformance` payload documentation** rewritten to match the actual native payload shape; `RuntimeStatus` type cleaned up to match.

## [2.0.1] - 2026-06-25

### Fixed
- ** — `startTracking()` / `addZone()` no longer silently no-op when called before `initialize()` on Android.** The JS bridge now rejects every pre-init call with `"Polyfence: call initialize() before any other method."`, matching the existing iOS `guard let tracker = locationTracker` rejection. Previously on Android, calling `startTracking()` before `initialize()` set the persistent `tracking_enabled` SharedPref to `true` (surviving app restarts) before `PolyfenceErrorManager` and the core delegate were wired by `initialize()`; subsequent `addZone()` calls for polygon zones then routed through the foreground-service Intent path where coordinate-array deserialization failed silently inside polyfence-core's `LocationTracker` ("Skipping invalid zone …" log entries with no `onError` to JS). The bridge-layer guard makes that ordering impossible on fresh installs. **Additionally**, Android `initialize()` now clears the persistent `tracking_enabled` SharedPref so consumers upgrading from a release that already poisoned the flag get a clean slate — `startTracking()` re-arms the flag immediately, so this is a no-op for the documented init → start sequence and matches iOS, where the tracker is process-scoped and has no persistent flag. Note: the native-side "Skipping invalid zone" path inside polyfence-core does not route through `PolyfenceErrorManager` — surfacing per-zone deserialization failures via `onError` is tracked as a follow-up against polyfence-core, not this bridge.
- ** — `dispose()` no longer permanently bricks the SDK.** Calling `dispose()` used to set `_isDisposed = true` on the cached singleton without ever resetting it, and `Polyfence.instance` kept returning that same poisoned object — so the documented logout → login pattern (`initialize` → `dispose` → `initialize`) threw on every subsequent call until the app was restarted, despite the native engine supporting clean re-init. `dispose()` now retires the cached singleton (sets `Polyfence._instance = null`) **before** awaiting native teardown, so the next `Polyfence.instance` access lazily builds a fresh, usable instance. The `assertNotDisposed()` error message also now points to `Polyfence.instance` (the real recovery path) instead of the impossible "create a new instance" — the constructor is private. A stale captured reference used after dispose still throws (correct/safe).

### Changed
- ** — `getZoneStates()` README contract clarified.** The method is a pass-through to the native engine, which has no running location service before `startTracking()`. On Android the result is reliably `[]` until tracking starts (`addZone` only persists to disk when not tracking); on iOS the native side loads zones into the tracker immediately, but membership state is still unreliable before tracking begins. README and the method table now document the required order (`initialize` → `addZone` → `startTracking` → `getZoneStates`) and point developers at `onZoneEnter` / `onZoneExit` for membership while tracking. Docs-only — no code or behaviour change.

## [2.0.0] - 2026-06-20

### ⚠ BREAKING CHANGES

- Removed four inert fields from `PolyfenceConfiguration` (the first `initialize` argument): `analyticsEnabled`, `industryCategory`, `saasApiKey`, `saasBaseUrl`. They were never read by the bridge or native engine, so removing them changes no runtime behavior — but TypeScript that set them will no longer compile. **Migration:** move analytics settings onto `AnalyticsConfig` (the second `initialize` argument): `industryCategory` → `industryCategory`, `saasApiKey` → `apiKey`, `saasBaseUrl` → `apiEndpoint`. Telemetry is controlled by `disableTelemetry`.

### Removed
- **Dead `analyticsEnabled` field** from `PolyfenceConfiguration`. It was never read by the bridge or the native engine — telemetry is controlled solely by `AnalyticsConfig.disableTelemetry` (the second `initialize` argument). Setting it had no effect.
- **Inert `industryCategory`, `saasApiKey`, `saasBaseUrl` fields** from `PolyfenceConfiguration`. None were read by the native engine or the JS bridge when set on the geofencing config (the first `initialize` argument). Their working equivalents live on `AnalyticsConfig` (the second argument): `industryCategory`, `apiKey`, `apiEndpoint` respectively — matching the polyfence-flutter config split.

### Fixed
- **Telemetry opt-out documentation.** `PRIVACY.md` instructed `initialize({ analyticsEnabled: false })`, which did nothing — users following it stayed opted in. Corrected to `initialize(undefined, { disableTelemetry: true })`, matching README and `doc/TELEMETRY.md`.
- **`SECURITY.md` network claims.** Removed the inaccurate "this bridge makes no network calls" statements; the bridge sends anonymous, opt-out platform telemetry (aggregates only — never coordinates or PII) over HTTPS.

### Changed
- **`PRIVACY.md` regulatory coverage.** Added Data storage & retention, Legal compliance (GDPR / CCPA / other jurisdictions), Children's privacy, Developer responsibility, and Changes sections, aligning the policy with the polyfence-flutter privacy posture.
- **README minimum React Native** raised from 0.71+ to 0.73+ to match the build/test target (`package.json` `react-native@^0.73.0`) and `SECURITY.md`.

## [1.0.11] - 2026-06-01

### Changed
- README screenshots now use repo-relative paths; `assets/` included in the npm tarball (via `files` in `package.json`) so screenshots render on npm.js.
- "Polyfence API" reference in the README links to `https://polyfence.io/api/docs`.
- `doc/ARCHITECTURE.md` "Related Repositories" table updated to the current public surface.

### Fixed
- README method tables and snippets aligned with the current public API: `clearAllZones`, `debugInfo`, `errorHistory`, `onLocationUpdate`. Error type strings updated to the granular camelCase forms (`gpsPermissionDenied`, `gpsServiceDisabled`, `recoveryEnter`, `recoveryExit`).
- Scheduled tracking snippet nests hour / minute / daysOfWeek fields inside `scheduleSettings.timeWindows[]`, matching the `TimeWindow` shape.
- Telemetry opt-out snippet in README and `doc/TELEMETRY.md` calls `initialize(undefined, { disableTelemetry: true })`, matching the analytics config positional argument.

## [1.0.10] - 2026-05-30

### Fixed
- **iOS podspec polyfence-core version sync.** `polyfence-react-native.podspec` pinned `PolyfenceCore` at `~> 1.0.5` while Android (`android/build.gradle`) had moved to `1.0.9`. The CocoaPods `~>` operator would still have resolved to 1.0.9 at install time, but the declared versions disagreed across platforms. Both now pin `~> 1.0.9` / `1.0.9`.

### Added
- **Anti-drift consistency check (`polyfence-core-version-sync`).** New subprocess check in `consistency-checks.yaml` that fails if the Android and iOS polyfence-core versions diverge. Catches the class of drift fixed in this release before it can land on `main` again — runs in pre-push hook and CI.
- **CI runs `bash scripts/consistency-check.sh`.** The pre-push hook already invoked the check suite; CI did not. Now PR builds fail on any consistency-check regression rather than relying on the pre-push hook running locally.

## [1.0.9] - 2026-05-30

### Added
- **Example app at `example/`.** Working iOS + Android React Native app that demonstrates the bridge end-to-end: zone fetching, location permissions, background tracking, GPS profile switching, geofence enter/exit/dwell events, MapLibre rendering. See `example/README.md` for setup.

### Changed
- Scrubbed `internal-brand` repo path references from `example/src/theme.ts` and the two `ic_launcher_foreground.xml` adaptive-icon comment blocks. Maintainer-facing comments only; no runtime behavior change.

## [1.0.8] - 2026-05-30

### Changed
- **`polyfence-core` dependency bumped from `1.0.8` to `1.0.9`.** v1.0.9 adds the cold-start empty-baseline guard in `GeofenceEngine.reconcileZoneStates` — fresh-install installs with no persisted zone state no longer lock in a `0 zones, inside=0` baseline when the engine receives its first GPS fix before bridge-driven `addZone()` calls land. Android-side bug primarily (activity-recognition kicks GPS independently of `LocationTracker.startTracking()`'s `hasZones()` defer-gate); iOS doesn't reproduce in practice but ships the same guard symmetrically for platform parity. See polyfence-core CHANGELOG for the full root-cause description.

## [1.0.7] - 2026-05-27

### Fixed
- **Tag-triggered publish workflow's "Validate TypeScript & Tests" job failed at `npm run lint`** with `ESLint couldn't find the config "@react-native" to extend from`. Three root causes, all pre-existing on main: (a) `@react-native/eslint-config` was missing from `devDependencies` and from `package-lock.json` — CI runs `npm ci` strictly against the lockfile so the package never installed; (b) `eslint-plugin-prettier` (transitive of `@react-native/eslint-config`) requires `prettier` as a peer dep, also not installed; (c) `.eslintrc.js` extended `@react-native` but there was no `.eslintignore`, so the linter walked into `lib/` (compiled output from `react-native-builder-bob`) and flagged transformed identifiers and mangled function bodies that aren't representative of source. **Fix:** add `@react-native/eslint-config@^0.73.0` + `prettier@^2.8.0` to devDependencies, add `.eslintignore` excluding `lib/` / `node_modules/` / `coverage/` / `example/`, add a `.prettierrc` matching the existing single-quote source style, and re-run lint with `--fix` to apply prettier's safe whitespace/quote auto-fixes across 9 source/test files.
- **`src/DebugOverlay.tsx` violated `react-hooks/rules-of-hooks`.** The exported `PolyfenceDebugOverlay` did `if (!__DEV__) return null;` BEFORE calling `useState` / `useRef` / `useCallback` / `useEffect` — React's rules require hooks to be called in the exact same order on every render, so a conditional early return before any hook is a real violation regardless of `__DEV__` being constant per build. **Fix:** apply the canonical wrapper-component split (per [facebook/react#15792](https://github.com/facebook/react/issues/15792)). `PolyfenceDebugOverlay` becomes a tiny outer gate that does the `__DEV__` check and conditionally renders the inner `PolyfenceDebugOverlayInner` component, which owns all the hooks. Satisfies the lint rule honestly while preserving the original "zero hook setup in production" property (the inner component never mounts in release builds).

### Changed
- **`polyfence-core` dependency bumped from `1.0.5` to `1.0.8`.** Same payload v1.0.6 was supposed to ship. v1.0.8 adds the `timestamp` field to the Android geofence event delegate map for parity with iOS — Flutter-facing fix that doesn't change the RN bridge surface.
- **CI now runs `npm run lint`.** Previously the CI workflow only ran `tsc + test`, so lint failures only surfaced at tag-triggered publish time — after PRs had already merged. Now lint runs on every PR, catching the same gate the Publish workflow enforces.

## [1.0.6] - 2026-05-27 [YANKED — failed publish]

> v1.0.6 was tagged on 2026-05-27 to bump the `polyfence-core` Android dep from `1.0.5` to `1.0.8`, but the Publish workflow's "Validate TypeScript & Tests" job failed at `npm run lint` due to the eslint config issues fixed in v1.0.7. **No artifact reached npm for this version.** See v1.0.7 for the actual shipped release. Tag retained in git history.

## [1.0.5] - 2026-05-23

### Fixed
- **Unknown native `eventType` strings silently became false ENTER events on the JS side.** `normalizeEventType()` in `src/events.ts` mapped each recognised native string (`enter`, `EXIT`, `recovery_enter`, etc.) to a known `GeofenceEventType`, but its `?? 'enter'` fallback meant any unrecognised or empty `eventType` payload — a future native value the bridge hasn't been updated for, a malformed event, or a partial payload during a state transition — was silently delivered to JS subscribers as an `enter`. That's the worst possible default: it masks EXIT misclassifications, fabricates ENTER events that never occurred, and breaks any zone-state machine on the consumer side. **Fix:** renamed to `parseGeofenceEventType()`, now returns `null` for anything that does not normalise to one of the five known types (`ENTER`, `EXIT`, `DWELL`, `RECOVERY_ENTER`, `RECOVERY_EXIT`). `normalizeGeofenceEvent()` drops the event entirely when parsing fails (no callback dispatch) instead of fabricating an ENTER. Adds an internal `canonicalGeofenceTypeKey()` helper that trims and upper-cases the raw string so case / whitespace variants from native still match. Regression coverage in `__tests__/events.test.ts` (lowercase normalises correctly; unknown-type input is dropped, callback not invoked).

## [1.0.4] - 2026-05-23

### Fixed
- **iOS background event drop after bridge teardown / app suspension:** The `LocationTracker` (and its `CLLocationManager` delegate) was owned exclusively by the `PolyfenceModule` bridge instance. When iOS suspended the app and later woke it for a significant-location change — or when the RN bridge reloaded for any reason — the previous `PolyfenceModule` was deallocated, taking the tracker with it. CLLocationManager arrived at a nil delegate, the buffered location was dropped, and the next ENTER/EXIT/DWELL never fired. Symptom: iOS RN apps caught a fraction of the events that iOS Flutter / Android RN / Android Flutter siblings caught for the same trip, with multi-hour gaps in the Events Log.
- Fix: hold `LocationTracker` and `ZonePersistence` in process-wide static refs on `PolyfenceModule`. When a new bridge instance comes online (cold launch, RN reload, post-suspension bootstrap), `initialize()` reuses the existing tracker and just re-wires `coreDelegate` to the current bridge — so the wake-up arrives at a live delegate with full state. `dispose()` still tears everything down (including the static) because that's an explicit user opt-out.

## [1.0.3] - 2026-05-23

### Fixed
- **iOS event delivery under RN 0.76+ Bridgeless / New Architecture:** Even with the explicit `addListener:` / `removeListeners:` codegen re-exports added in 1.0.2, events from native (`onLocation`, `onGeofenceEvent`, `onError`, `onPerformance`) were still being silently dropped on iOS in some bridgeless configurations. The JS-side `NativeEventEmitter` handshake doesn't reliably reach the native module under all RN 0.76+ codegen paths, leaving `RCTEventEmitter._listenerCount` at `0` and `sendEventWithName:body:` short-circuiting to `RCTLogWarn("Sending '…' with no listeners")`.
- Fix: align iOS with Android by emitting directly through `RCTDeviceEventEmitter.emit` (via the inherited `callableJSModules.invokeModule(...)`), bypassing the `RCTEventEmitter` listener-count gate entirely. The Android bridge has always used this pattern (`PolyfenceModule.kt:597-608`). On the JS side, `src/events.ts` now subscribes through `DeviceEventEmitter` for both platforms — no more `NativeEventEmitter(NativePolyfence)` on iOS.
- Removed the now-redundant `hasListeners` / `pendingEvents` queue, `startObserving` / `stopObserving` overrides, and `eventQueue` from `PolyfenceModule.swift`. The Swift `addListener` / `removeListeners` overrides are kept as no-ops to satisfy the New Arch codegen handshake (still exported via `RCT_EXTERN_METHOD` in `PolyfenceModule.m`).

See `react-native#41394` for the underlying RN issue.

## [1.0.2] - 2026-05-22

### Fixed
- **iOS / React Native 0.76 Bridgeless:** Events from native (`onLocation`, `onGeofenceEvent`, `onError`, `onPerformance`) were silently dropped on iOS under RN 0.76+ New Architecture. Root cause:
  - JS-side `new NativeEventEmitter(NativePolyfence).addListener(...)` calls the native module's `addListener:` to increment `RCTEventEmitter._listenerCount`.
  - Inherited `addListener:` / `removeListeners:` on `RCTEventEmitter` subclasses are not visible to the New Arch codegen / TurboModuleManager unless explicitly re-exported.
  - Without that export, `_listenerCount` stayed `0` and `RCTEventEmitter.sendEventWithName:body:` short-circuited to `RCTLogWarn("Sending '...' with no listeners registered")` instead of routing to `RCTDeviceEventEmitter.emit`.
- Fix: re-declare `addListener:` / `removeListeners:` in Swift (`@objc override`, calling `super`) and re-export them via `RCT_EXTERN_METHOD` in `PolyfenceModule.m`. Verified end-to-end on iOS 26.4 + RN 0.76.7 + `newArchEnabled=true`: a JS-side `polyfence.onGeofenceEvent(cb)` subscription now receives events emitted via the `coreDelegate.onGeofenceEvent` path.
- Also removed the redundant `hasListeners` / `pendingEvents` plumbing from `sendLocationEvent` / `sendGeofenceEvent` / `sendErrorEvent` / `sendPerformanceEvent` — `RCTEventEmitter`'s internal `_listenerCount` gate is what matters and is now properly maintained by the explicit exports.

See `react-native#41394` for upstream context on `RCTEventEmitter` listener-export semantics under New Architecture.

## [1.0.1] - 2026-05-22

### Fixed
- `setAccuracyProfile` on both bridges now rejects unknown profile names instead of silently falling back to `maxAccuracy`. Previously, passing `'powerSaver'` or `'custom'` (removed in 1.0.0) or any typo normalized to a value with no matching enum case and degraded to `MAX_ACCURACY`, the opposite of battery-savings intent. The TypeScript type already disallowed these values; this brings the native bridges into line with the typed contract.

## [1.0.0] - 2026-04-05

### Breaking Changes
- **API renames for Flutter parity:**
  - `onLocation()` → `onLocationUpdate()`
  - `removeAllZones()` → `clearAllZones()`
  - `getDebugInfo()` → `debugInfo()`
  - `getErrorHistory()` → `errorHistory()`
- **Error types overhauled:** Replaced generic types (`permission_denied`, `location_disabled`) with granular camelCase types (`gpsPermissionDenied`, `gpsServiceDisabled`, `gpsTimeout`, `gpsAccuracyPoor`, `serviceStartFailed`, `serviceKilled`, `batteryOptimizationRequired`, `zoneValidationFailed`, `networkTimeout`, `permissionRevoked`, etc.)
- **Error object structure:** `code`/`details` replaced by `context`/`timestamp`/`correlationId`
- **Geofence event types normalized:** `recovery_enter` → `recoveryEnter`, `recovery_exit` → `recoveryExit`
- **Accuracy profiles:** Removed `powerSaver` and `custom` profiles; kept `maxAccuracy`, `balanced`, `batteryOptimal`, `adaptive`
- **Update strategies renamed:** `fixed` → `continuous`, `activityBased` → `movementBased`
- **Removed:** `setTrackingSchedule()`, `clearTrackingSchedule()`, `TrackingSchedule` type

### Added
- **Bridge version constant** — `src/version.ts` exports `POLYFENCE_PLUGIN_VERSION` instead of hardcoded string
- **Core version in telemetry types** — `SessionTelemetry.coreVersion` typed in `types.ts`
- **Structured configuration types** — `ProximitySettings`, `MovementSettings`, `BatterySettings`, `DwellSettings`, `ClusterSettings`, `ScheduleSettings`, `TimeWindow`, `ActivitySettings`
- **Android Bridgeless mode support** — Events use `DeviceEventEmitter` on Android
- **Event type normalization** — Case-insensitive mapping with fallback for geofence and error events
- `PolyfenceLocation.interval`, `PolyfenceLocation.isFallback`, `PolyfenceLocation.activity` fields

### Changed
- `PolyfenceLocation.accuracy` and `PolyfenceLocation.timestamp` now optional
- Android: React Native version pinned to `0.76.7` (was `+`)
- polyfence-core dependency updated from `1.0.4` to `1.0.5`

### Fixed
- Android: Improved error logging for config apply failures

## [0.1.0] - 2026-03-29

### Fixed

- **PolyfenceCoreDelegate** alignment (map-based callbacks, `setCoreDelegate` / `coreDelegate`) on Android and iOS
- Battery APIs: JS method names match Android; iOS **batteryOptimizationStatus** / **requestBatteryOptimizationExemption** / **dispose** implemented and exported
- **dispose** on Android; geofence payloads aligned with TS **GeofenceEvent** (`type`, nested `location`, etc.)
- iOS: permission **granted** check no longer treats **.notDetermined** as granted; **pendingEvents** queue (50) with flush on **startObserving**; **sendStatus** uses **locationTracker.isTracking()** when needed
- Android: **requestPermissions** documented as check-only (use **react-native-permissions** for system dialog); **sendEvent** guarded with **hasActiveReactInstance()**
- **getErrorHistory**: **Android** applies **`limit`** (tail slice), **`timeRangeMs`**, **`errorTypes`**; **iOS** uses **PolyfenceDebugCollector** with the same keys + **limit**
- **getZoneStates**: native bridge returns **ZoneState[]** (zone id, name from persistence, **isInside**)
- **onError** stream + **getErrorHistory**: **normalizePolyfenceError**; **onPerformance** typed as **PerformanceEventPayload**
- **PolyfenceConfiguration**: optional **gpsAccuracyThreshold**, **dwellSettings**, **clusterSettings**, **scheduleSettings**, **activitySettings** for iOS-forwarded keys
- **npm**: **`src`** removed from **`files`**; **`react-native`** resolves **lib/module/index** (build before publish)
- Packaging: **.npmignore** excludes **src/** and **doc/**; example app style/import fixes
- TypeScript **dispose** guard (**_isDisposed** / **assertNotDisposed**)

### Added
- Initial React Native bridge for polyfence-core
- TypeScript API surface matching Flutter plugin
- Complete type definitions for all public APIs
- Android native module (Kotlin) with polyfence-core integration
- iOS RCTEventEmitter implementation (Swift + Objective-C bridge)
- Event streaming for location updates, geofence events, errors, and performance metrics
- Full TypeScript type definitions
- Jest test configuration and utilities
- CI/CD workflow (TypeScript check, lint, Android build, iOS pod lint)
- Code quality guardrails (emoji detection, internal file tracking, secret scanning)
- Example React Native app demonstrating usage
- Comprehensive documentation and contribution guidelines
