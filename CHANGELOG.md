# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-06-22

### Fixed
- **BUG-001 — `startTracking()` / `addZone()` no longer silently no-op when called before `initialize()` on Android.** The JS bridge now rejects every pre-init call with `"Polyfence: call initialize() before any other method."`, matching the existing iOS `guard let tracker = locationTracker` rejection. Previously on Android, calling `startTracking()` before `initialize()` set the persistent `tracking_enabled` SharedPref to `true` (surviving app restarts) before `PolyfenceErrorManager` and the core delegate were wired by `initialize()`; subsequent `addZone()` calls for polygon zones then routed through the foreground-service Intent path where coordinate-array deserialization failed silently inside polyfence-core's `LocationTracker` ("Skipping invalid zone …" log entries with no `onError` to JS). The bridge-layer guard makes that ordering impossible. Note: the native-side "Skipping invalid zone" path inside polyfence-core does not route through `PolyfenceErrorManager` — surfacing per-zone deserialization failures via `onError` is tracked as a follow-up against polyfence-core, not this bridge.

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

- Peer review remediation: **PolyfenceCoreDelegate** alignment (map-based callbacks, `setCoreDelegate` / `coreDelegate`) on Android and iOS
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
