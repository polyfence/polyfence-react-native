# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- **Core version in telemetry types** — `SessionTelemetry.coreVersion` typed in `types.ts` (D043)
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
