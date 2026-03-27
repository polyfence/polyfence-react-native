# Privacy

polyfence-react-native is a bridge package that connects React Native applications to the polyfence-core native geofencing engine.

## What This Package Does

- Marshals data between JavaScript and native code (Kotlin/Swift)
- Forwards zone definitions and configuration to polyfence-core
- Relays location updates and geofence events back to JavaScript

## What This Package Does NOT Do

- Makes no network calls
- Stores no data independently (polyfence-core handles zone persistence)
- Collects no telemetry on its own (telemetry aggregation lives in polyfence-core)
- Includes no third-party analytics or tracking SDKs

## Data Flow

All location processing happens in polyfence-core on the device. No location data leaves the device unless the developer explicitly configures the optional SaaS integration via an API key.

When SaaS telemetry is enabled (opt-out with one line), only aggregated session metrics are sent. See [polyfence-core PRIVACY.md](https://github.com/polyfence/polyfence-core/blob/main/PRIVACY.md) for details on what is and is not collected.

## Dependencies

| Dependency | Purpose | Network Access |
|-----------|---------|----------------|
| polyfence-core | Geofencing engine | None (on-device only) |
| React Native | Bridge framework | None from this package |
| Play Services Location (Android) | GPS provider | Device GPS only |
| CoreLocation (iOS) | GPS provider | Device GPS only |
