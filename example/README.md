# Polyfence React Native Example App

A self-contained React Native example demonstrating all core features of the polyfence-react-native plugin.

## Prerequisites

- Node.js 18+ and npm
- React Native CLI: `npm install -g react-native-cli`
- **iOS**: Xcode 14.0+, iOS 14.0 SDK minimum
- **Android**: Android Studio, API 24+ (compileSdk 35, minSdk 24)

## Setup

```bash
# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Android setup (no additional steps required)
```

## Running the App

### Android

```bash
npm run android
```

Or manually:

```bash
npx react-native run-android
```

### iOS

```bash
npm run ios
```

Or manually:

```bash
npx react-native run-ios
```

## What the App Demonstrates

The example app showcases all core polyfence plugin features:

### Features
- **Initialization**: Configure plugin with accuracy profiles and update strategies
- **Zone Management**: Load demo circle and polygon zones, view zone state (inside/outside)
- **Tracking Control**: Start/stop location tracking with one tap
- **GPS Profiles**: Switch between 4 accuracy profiles (Max, Balanced, Battery, Adaptive)
- **Status Display**: Real-time location, accuracy, tracking state, and zone count
- **Event Logging**: See all geofence events (enter/exit/dwell) with timestamps
- **Error Handling**: Display errors gracefully with dismissible banner

### Demo Zones

The app comes with 3 pre-configured zones:

1. **Office** (Circle) — 100m radius in London
2. **London ULEZ** (Polygon) — Congestion charge zone
3. **Parking Lot** (Polygon) — Small parking area

## Location Permissions

On first launch, the app will request:
- **Fine Location** (always required)
- **Background Location** (required for background tracking)
- **Activity Recognition** (Android only, optional for activity-based GPS optimization)

Grant permissions when prompted for the app to function.

## Project Structure

```
example/
├── src/
│   ├── App.tsx              # Main app component
│   ├── styles.ts            # Shared styling and theme
│   └── demoZones.ts         # Demo zone definitions
├── android/                 # Android native configuration
├── ios/                     # iOS native configuration
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
├── metro.config.js          # Metro bundler config
└── babel.config.js          # Babel configuration
```

## Development

- TypeScript is enabled; all code uses `.tsx`/`.ts` files
- React Hooks (useState, useEffect, useCallback) for state management
- Native React Native components only (no third-party UI libraries)
- Subscriptions cleaned up on unmount via useEffect

## Troubleshooting

### Metro bundler errors
If metro fails to resolve the parent package:

```bash
npm start -- --reset-cache
```

### Pod install fails (iOS)
```bash
cd ios && pod install --repo-update && cd ..
```

### Gradle build fails (Android)
```bash
cd android && ./gradlew clean && cd ..
npm run android
```

### Permissions not requested
Ensure you have the correct Android/iOS permission declarations in:
- `android/app/src/main/AndroidManifest.xml`
- `ios/PolyfenceExample/Info.plist`

## Notes

- Demo zones use London coordinates; actual geofencing requires GPS-enabled device
- Location updates shown in status only work with location services enabled
- All geofencing runs on-device; no data sent to cloud (privacy-first)
- Telemetry is opt-out by default. To disable, pass `analyticsEnabled: false` to `Polyfence.instance.initialize({ analyticsEnabled: false })` (one line). All telemetry is anonymous aggregates — never coordinates, never identifiers.
