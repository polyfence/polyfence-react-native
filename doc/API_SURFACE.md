# Polyfence React Native API Surface — v1.0.1

Complete reference for the public API of the Polyfence React Native package.

## Polyfence Singleton

### Entry Point

```typescript
import { Polyfence } from 'polyfence-react-native';

const polyfence = Polyfence.instance;
```

The `Polyfence` class is a singleton. Access it via `Polyfence.instance`.

## Initialization & Lifecycle

### `initialize(config?: PolyfenceConfiguration): Promise<void>`

Initialize the geofencing engine. Must be called before any other operations.

```typescript
await Polyfence.instance.initialize({
  accuracyProfile: 'balanced',
  updateStrategy: 'intelligent',
  analyticsEnabled: true,
});
```

**Parameters:**
- `config` (optional) — Configuration object. See `PolyfenceConfiguration`.

**Throws:** Rejects if initialization fails (e.g., permissions denied, native module not linked).

---

### `dispose(): Promise<void>`

Tear down the geofencing engine and stop all tracking. Releases resources and listeners.

```typescript
await Polyfence.instance.dispose();
```

---

### `removeAllListeners(): void`

Stop all registered event listeners (location, geofence, error, performance).

```typescript
Polyfence.instance.removeAllListeners();
```

## Tracking Control

### `startTracking(): Promise<void>`

Begin background location tracking. Zones must be added before tracking starts.

```typescript
await Polyfence.instance.startTracking();
```

**Requires:** Location permissions (foreground + background on Android).

---

### `stopTracking(): Promise<void>`

Stop all location tracking. Zones remain in memory.

```typescript
await Polyfence.instance.stopTracking();
```

## Zone Management

### `addZone(zone: Zone): Promise<void>`

Add a circle or polygon zone for geofencing.

```typescript
await Polyfence.instance.addZone({
  id: 'zone-1',
  name: 'Office',
  type: 'circle',
  center: { latitude: 37.7749, longitude: -122.4194 },
  radius: 100, // meters
});
```

**Parameters:**
- `zone` — Zone object with id, name, type, and type-specific fields.

**Throws:** Rejects if zone is invalid or storage fails.

---

### `removeZone(zoneId: string): Promise<void>`

Remove a zone by ID.

```typescript
await Polyfence.instance.removeZone('zone-1');
```

**Parameters:**
- `zoneId` — Unique zone identifier.

---

### `removeAllZones(): Promise<void>`

Remove all zones.

```typescript
await Polyfence.instance.removeAllZones();
```

---

### `getZoneStates(): Promise<ZoneState[]>`

Get the current state of all zones (inside/outside).

```typescript
const states = await Polyfence.instance.getZoneStates();
// [
//   {
//     zoneId: 'zone-1',
//     zoneName: 'Office',
//     isInside: true,
//     lastEventType: 'enter',
//     lastEventTimestamp: 1709000000000,
//   }
// ]
```

**Returns:** Array of zone state objects.

## Configuration

### `getConfiguration(): Promise<PolyfenceConfiguration>`

Fetch the current configuration.

```typescript
const config = await Polyfence.instance.getConfiguration();
console.log(config.accuracyProfile); // 'balanced'
```

---

### `updateConfiguration(config: PolyfenceConfiguration): Promise<void>`

Update the configuration. Changes take effect immediately.

```typescript
await Polyfence.instance.updateConfiguration({
  accuracyProfile: 'maxAccuracy',
  updateStrategy: 'proximityBased',
});
```

---

### `resetConfiguration(): Promise<void>`

Restore default configuration.

```typescript
await Polyfence.instance.resetConfiguration();
```

---

### `setAccuracyProfile(profile: AccuracyProfile): Promise<void>`

Set the accuracy profile (convenience method).

```typescript
await Polyfence.instance.setAccuracyProfile('batteryOptimal');
```

**Valid profiles:**
- `'maxAccuracy'` — Highest precision, highest battery drain
- `'balanced'` — Default; balanced accuracy/battery
- `'batteryOptimal'` — Prioritizes battery life
- `'adaptive'` — Context-aware auto-adjustment

## Permissions & System Status

### `requestPermissions(options?: { always?: boolean }): Promise<boolean>`

Request location permissions from the user.

```typescript
const granted = await Polyfence.instance.requestPermissions({
  always: true, // Request "Allow all the time" on Android
});
```

**Parameters:**
- `options.always` (Android only) — If true, request "Always" permission. iOS ignores this.

**Returns:** `true` if permissions granted, `false` otherwise.

---

### `isLocationServiceEnabled(): Promise<boolean>`

Check if device location services are enabled.

```typescript
const enabled = await Polyfence.instance.isLocationServiceEnabled();
```

**Returns:** `true` if GPS or network location is available.

---

### `batteryOptimizationStatus(): Promise<BatteryOptimizationStatus>`

Check battery optimization status (Android only).

```typescript
const status = await Polyfence.instance.batteryOptimizationStatus();
// { isIgnoringOptimizations: false, manufacturer: 'samsung' }
```

**Returns:** Object with `isIgnoringOptimizations` and `manufacturer`.

**iOS:** Returns `{ isIgnoringOptimizations: true, manufacturer: 'apple' }` (battery optimization not an iOS concept).

---

### `requestBatteryOptimizationExemption(): Promise<boolean>`

Request exemption from battery optimization (Android only).

```typescript
const exempted = await Polyfence.instance.requestBatteryOptimizationExemption();
```

**Returns:** `true` if user granted exemption.

**iOS:** No-op, returns `true`.

## Schedules

### `setTrackingSchedule(schedule: TrackingSchedule): Promise<void>`

Enable tracking only during specific hours/days.

```typescript
await Polyfence.instance.setTrackingSchedule({
  startHour: 9,
  startMinute: 0,
  endHour: 17,
  endMinute: 0,
  daysOfWeek: [1, 2, 3, 4, 5], // Monday–Friday
});
```

**Parameters:**
- `startHour` — 0–23
- `startMinute` — 0–59
- `endHour` — 0–23
- `endMinute` — 0–59
- `daysOfWeek` (optional) — 1=Monday, 7=Sunday. Omit for all days.

---

### `clearTrackingSchedule(): Promise<void>`

Disable schedule-based tracking.

```typescript
await Polyfence.instance.clearTrackingSchedule();
```

## Debug & Diagnostics

### `getDebugInfo(): Promise<PolyfenceDebugInfo>`

Get comprehensive debug information.

```typescript
const debug = await Polyfence.instance.getDebugInfo();
// {
//   engineVersion: '1.0.0',
//   bridgePlatform: 'react-native',
//   isTracking: true,
//   activeZones: 3,
//   totalEventsGenerated: 45,
//   currentAccuracyProfile: 'balanced',
//   currentUpdateStrategy: 'intelligent',
//   currentIntervalMs: 10000,
//   errorHistory: [...]
// }
```

**Returns:** Nested object with system status, configuration, performance metrics.

---

### `getErrorHistory(options?: { limit?: number }): Promise<PolyfenceError[]>`

Fetch recent errors from the session.

```typescript
const errors = await Polyfence.instance.getErrorHistory({ limit: 10 });
```

**Parameters:**
- `options.limit` (optional) — Max number of errors to return. Default: 50.

---

### `getSessionTelemetry(): Promise<SessionTelemetry>`

Get aggregated session telemetry (D016).

```typescript
const telemetry = await Polyfence.instance.getSessionTelemetry();
// {
//   sessionDurationMinutes: 30,
//   gpsUpdateCount: 180,
//   avgGpsIntervalMs: 10000,
//   zoneCount: 3,
//   enterEventCount: 2,
//   exitEventCount: 1,
//   dwellEventCount: 0,
//   falseEventCount: 0,
//   batteryDrainPercent: 2.5,
//   deviceCategory: 'google_pixel',
//   bridgePlatform: 'react-native',
// }
```

**Returns:** Telemetry object with session aggregates. Privacy-first — no GPS coords, no PII.

## Event Listeners

### `onLocation(callback: (location: PolyfenceLocation) => void): Subscription`

Listen for GPS location updates.

```typescript
const sub = Polyfence.instance.onLocation((location) => {
  console.log(`Lat: ${location.latitude}, Lon: ${location.longitude}`);
});

// Unsubscribe
sub.remove();
```

**Callback receives:** `PolyfenceLocation` object.

---

### `onGeofenceEvent(callback: (event: GeofenceEvent) => void): Subscription`

Listen for zone entry/exit/dwell events.

```typescript
const sub = Polyfence.instance.onGeofenceEvent((event) => {
  if (event.type === 'enter') {
    console.log(`Entered zone: ${event.zoneName}`);
  }
});

sub.remove();
```

**Callback receives:** `GeofenceEvent` object with `zoneId`, `type` (`'enter'`, `'exit'`, `'dwell'`, etc.), location, timestamp.

---

### `onZoneEnter(callback: (event: GeofenceEvent) => void): Subscription`

Listen for zone entry events (filtered).

```typescript
const sub = Polyfence.instance.onZoneEnter((event) => {
  console.log(`Entered: ${event.zoneName}`);
});

sub.remove();
```

**Equivalent to:** `onGeofenceEvent()` with filter for `type === 'enter'` or `'recovery_enter'`.

---

### `onZoneExit(callback: (event: GeofenceEvent) => void): Subscription`

Listen for zone exit events (filtered).

```typescript
const sub = Polyfence.instance.onZoneExit((event) => {
  console.log(`Exited: ${event.zoneName}`);
});

sub.remove();
```

**Equivalent to:** `onGeofenceEvent()` with filter for `type === 'exit'` or `'recovery_exit'`.

---

### `onError(callback: (error: PolyfenceError) => void): Subscription`

Listen for error events.

```typescript
const sub = Polyfence.instance.onError((error) => {
  console.error(`Error [${error.type}]: ${error.message}`);
});

sub.remove();
```

**Callback receives:** `PolyfenceError` object with `type`, `message`, `code`, optional `details`.

---

### `onPerformance(callback: (status: RuntimeStatus) => void): Subscription`

Listen for performance and runtime status updates.

```typescript
const sub = Polyfence.instance.onPerformance((status) => {
  console.log(`Tracking: ${status.isTracking}, Battery: ${status.batteryLevel}%`);
});

sub.remove();
```

**Callback receives:** `RuntimeStatus` object with current interval, zone count, battery level, etc.

## Type Definitions

### Zone

```typescript
interface Zone {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  type: 'circle' | 'polygon';    // Zone type
  center?: Coordinate;           // Required for circles
  radius?: number;               // Required for circles (meters)
  polygon?: Coordinate[];        // Required for polygons (min 3 points)
  metadata?: Record<string, unknown>; // Optional custom data
  dwellThresholdMs?: number;     // Override default dwell threshold
  clusterGroupId?: string;       // For zone clustering
}
```

### Coordinate

```typescript
interface Coordinate {
  latitude: number;              // -90 to 90
  longitude: number;             // -180 to 180
}
```

### GeofenceEvent

```typescript
interface GeofenceEvent {
  zoneId: string;
  zoneName: string;
  type: 'enter' | 'exit' | 'dwell' | 'recovery_enter' | 'recovery_exit';
  location: PolyfenceLocation;
  timestamp: number;             // Milliseconds since epoch
  confidence?: number;
  dwellDurationMs?: number;
}
```

### PolyfenceLocation

```typescript
interface PolyfenceLocation {
  latitude: number;
  longitude: number;
  accuracy: number;              // Meters
  altitude?: number;
  speed?: number;                // m/s
  bearing?: number;              // Degrees
  timestamp: number;             // Milliseconds since epoch
}
```

### PolyfenceConfiguration

```typescript
interface PolyfenceConfiguration {
  accuracyProfile?: AccuracyProfile;
  updateStrategy?: UpdateStrategy;
  desiredIntervalMs?: number;
  fastestIntervalMs?: number;
  smallestDisplacementM?: number;
  dwellDetectionEnabled?: boolean;
  dwellDefaultThresholdMs?: number;
  clusteringEnabled?: boolean;
  clusterRadiusM?: number;
  falseEventProtectionEnabled?: boolean;
  activityRecognitionEnabled?: boolean;
  activityRecognitionIntervalMs?: number;
  saasApiKey?: string;
  saasBaseUrl?: string;
  analyticsEnabled?: boolean;
  industryCategory?: string;
}
```

### RuntimeStatus

```typescript
interface RuntimeStatus {
  isTracking: boolean;
  activeZoneCount: number;
  currentAccuracyProfile: AccuracyProfile;
  currentUpdateStrategy: UpdateStrategy;
  currentIntervalMs: number;
  batteryLevel: number;
  lastLocationTimestamp?: number;
}
```

### PolyfenceDebugInfo

```typescript
interface PolyfenceDebugInfo {
  engineVersion: string;
  bridgePlatform: string;
  isTracking: boolean;
  activeZones: number;
  totalEventsGenerated: number;
  currentAccuracyProfile: string;
  currentUpdateStrategy: string;
  currentIntervalMs: number;
  lastLocationTimestamp?: number;
  errorHistory: PolyfenceError[];
}
```

### ZoneState

```typescript
interface ZoneState {
  zoneId: string;
  zoneName: string;
  isInside: boolean;
  lastEventType?: GeofenceEventType;
  lastEventTimestamp?: number;
  dwellStartTimestamp?: number;
  distanceToBoundaryM?: number;
}
```

### PolyfenceError

```typescript
interface PolyfenceError {
  type: PolyfenceErrorType;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}
```

### SessionTelemetry

```typescript
interface SessionTelemetry {
  sessionDurationMinutes: number;
  gpsUpdateCount: number;
  avgGpsIntervalMs: number;
  zoneCount: number;
  enterEventCount: number;
  exitEventCount: number;
  dwellEventCount: number;
  falseEventCount: number;
  recoveryEventCount: number;
  zoneTransitionCount: number;
  accuracyProfile: string;
  updateStrategy: string;
  batteryDrainPercent: number;
  deviceCategory: string;
  bridgePlatform: string;
  sessionStartHour: number;
  [key: string]: unknown; // Future-proof
}
```

### Subscription

```typescript
interface Subscription {
  remove(): void;  // Unsubscribe from the listener
}
```
