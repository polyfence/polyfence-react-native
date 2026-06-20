# Polyfence React Native Architecture

This document describes the internal architecture of the Polyfence React Native package and its relationship to polyfence-core.

## Repository Structure

Polyfence is split across two repositories:

```
polyfence-core                        ← Standalone native geofencing engine
  ├── android/                        ← Kotlin implementation
  │   └── core/
  │       ├── GeofenceEngine.kt       ← Zone detection (ray-casting, haversine)
  │       ├── LocationTracker.kt      ← SmartGPS, activity-based intervals
  │       ├── TrackingScheduler.kt    ← Time-window scheduling
  │       ├── ActivityRecognitionManager.kt
  │       ├── TelemetryAggregator.kt  ← Session metrics collection
  │       ├── ZonePersistence.kt      ← Zone state recovery
  │       └── SmartGpsConfig.kt       ← Configuration model
  └── ios/
      └── Classes/Core/               ← Swift implementation (mirrors Kotlin)

polyfence-react-native (this repo)    ← React Native bridge
  ├── src/
  │   ├── Polyfence.ts                ← Public API singleton
  │   ├── types.ts                    ← TypeScript type definitions
  │   └── events.ts                   ← NativeEventEmitter handlers
  ├── android/                        ← Kotlin native module (bridges to polyfence-core)
  └── ios/                            ← Swift native module (bridges to polyfence-core)
```

## Why Two Repos?

The native engines (Kotlin + Swift) are framework-agnostic. By separating them into polyfence-core:

- **polyfence-react-native** depends on polyfence-core via CocoaPods (iOS) and Maven (Android)
- **polyfence-flutter** depends on the same polyfence-core
- **polyfence-swift** and **polyfence-kotlin** (future) will expose polyfence-core directly

One set of algorithms, multiple framework bridges.

## Data Flow

### Zone Configuration

```
JavaScript code
  │  Polyfence.instance.addZone(zone)
  ▼
Polyfence.ts (TypeScript wrapper)
  │  zone object → NativeModules.Polyfence.addZone()
  ▼
PolyfenceModule (Kotlin/Swift)
  │  Deserialize JSON → zone object
  ▼
LocationTracker (polyfence-core)
  │  Store in memory + persist to SharedPreferences/UserDefaults
  ▼
Zone active — checked on every GPS update
```

### Geofence Detection

```
GPS hardware
  │  Location update
  ▼
LocationTracker (polyfence-core)
  │  SmartGPS: filter by accuracy threshold, apply distance filter
  │  Activity recognition: adjust interval (still=120s, driving=5s)
  ▼
GeofenceEngine (polyfence-core)
  │  For each active zone:
  │    Circle → haversine distance < radius?
  │    Polygon → ray-casting point-in-polygon test
  │  Compare with previous state → detect ENTER/EXIT
  │  Track dwell time → fire DWELL after threshold
  ▼
PolyfenceCoreDelegate callbacks
  │  Native code triggers onGeofenceEvent
  ▼
NativeEventEmitter
  │  JavaScript receives onGeofenceEvent callback
  ▼
JavaScript handler (developer's listener)
```

### Telemetry Flow

Telemetry posture: opt-out by default, one-line disable. Different data classes have different defaults — positions are opt-in, telemetry is opt-out, zone events are always-on. See PRIVACY.md.

Telemetry is opt-out. When enabled:

```
LocationTracker + GeofenceEngine (polyfence-core)
  │  TelemetryAggregator collects session metrics natively:
  │    detection counts, latency, GPS accuracy, battery,
  │    activity distribution, zone transitions, false events
  ▼
NativeModules.Polyfence.getSessionTelemetry()
  │  JavaScript fetches aggregated payload from native
  ▼
Application code
  │  Merges device context (category, OS version)
  │  Converts keys to snake_case if needed
  ▼
HTTPS POST → polyfence.io/api/v1/telemetry/session
  │  Anonymous aggregate metrics only
  │  No GPS coordinates, no PII, no zone definitions
```

## Bridge Design

This package is a thin bridge. It:

1. **Marshals data** between JavaScript and native code (JSON serialization)
2. **Forwards calls** to polyfence-core engines via NativeModules
3. **Relays events** back to JavaScript via NativeEventEmitter
4. **Does NOT** contain geofencing algorithms, GPS logic, or zone detection

All geofencing logic lives in polyfence-core. The bridge is transport only.

## Event Channels

Four separate native event types:

| Channel | JavaScript Event | Purpose |
|---------|------------------|---------|
| `onLocation` | `Polyfence.instance.onLocationUpdate()` | GPS location updates |
| `onGeofenceEvent` | `Polyfence.instance.onGeofenceEvent()` | Zone enter/exit/dwell events |
| `onError` | `Polyfence.instance.onError()` | Error notifications |
| `onPerformance` | `Polyfence.instance.onPerformance()` | Runtime status/performance metrics |

Events flow from native → NativeEventEmitter → JavaScript listeners.

## Critical Algorithms

These algorithms are implemented identically in both Kotlin and Swift (polyfence-core). Changes to one must be mirrored in the other.

### Haversine Formula

Calculates the great-circle distance between two GPS coordinates. Used for circle zone detection.

```
a = sin²(dlat/2) + cos(lat1) * cos(lat2) * sin²(dlon/2)
c = 2 * atan2(sqrt(a), sqrt(1-a))
d = R * c    (R = 6371000 meters)
```

### Ray-Casting Algorithm

Determines if a point is inside a polygon by counting how many times a ray from the point crosses polygon edges. Odd count = inside, even = outside.

## SmartGPS Strategies

| Strategy | Behavior |
|----------|----------|
| `continuous` | Fixed interval based on accuracy profile |
| `proximityBased` | Near zones: fast updates. Far from zones: slow updates |
| `movementBased` | Moving: fast updates. Stationary: slow updates |
| `intelligent` | Combines proximity + movement + battery + activity |

The `intelligent` strategy hierarchy:
1. Near a zone + moving → fast proximity interval (5s)
2. Near a zone + stationary → reduced interval (120s)
3. Far from all zones → slow interval (60s)
4. Low battery → further reduced regardless of above

## Building from Source

```bash
# Clone the package
git clone https://github.com/polyfence/polyfence-react-native.git
cd polyfence-react-native

# Install JavaScript dependencies
npm install

# Run TypeScript compiler
npm run typescript

# Run tests
npm test

# Run linter
npm run lint

# Build for distribution
npm run build
```

polyfence-core is pulled automatically as a dependency via CocoaPods (iOS) and Maven (Android) when building the native modules. To build polyfence-core separately:

```bash
# Clone polyfence-core
git clone https://github.com/polyfence/polyfence-core.git

# Android
cd polyfence-core/android && ./gradlew build

# iOS
cd polyfence-core/ios && pod lib lint
```

## Related Repositories

| Repository | Purpose |
|---|---|
| [polyfence-core](https://github.com/polyfence/polyfence-core) | Shared native engine (Kotlin + Swift) |
| [polyfence-flutter](https://github.com/polyfence/polyfence-flutter) | Flutter SDK |
| [polyfence-embedded](https://github.com/polyfence/polyfence-embedded) | C11 library for IoT / MCU |
| [Polyfence SaaS](https://polyfence.io) | Hosted dashboard + REST API |
