# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- **iOS / React Native 0.76 Bridgeless:** Export `addListener` / `removeListeners` (`RCT_EXTERN_METHOD`) and forward to `RCTEventEmitter` so `NativeEventEmitter` subscriptions register under the New Architecture; emit location, geofence, error, and performance events unconditionally (aligned with Android). Previously `hasListeners` stayed false when `startObserving` never ran, so events were buffered then dropped after 50 entries.

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
