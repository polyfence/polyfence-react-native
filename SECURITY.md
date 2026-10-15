# Security Policy

## Supported Versions

Security updates are provided for the following versions:

| Version | Supported          |
|---------|--------------------|
| 3.0.x   | Yes                |
| < 3.0   | No                 |

## Reporting Security Vulnerabilities

**Do not open a public issue for security vulnerabilities.** Instead, please email hello@polyfence.io with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will:
- Acknowledge receipt within 48 hours
- Investigate and confirm the issue
- Develop and test a fix
- Prepare a security release
- Coordinate public disclosure timing

## Security Architecture

This React Native bridge inherits its on-device geofencing security properties from polyfence-core. The bridge itself makes one category of network call: anonymous, opt-out platform telemetry (aggregates only — never coordinates, never PII), described under [Network Security](#network-security) below.

### Location Data

- **Processed on-device only** — Geofencing runs locally; raw coordinates never leave the device (only anonymous aggregates are sent when telemetry is enabled — see Network Security)
- **Not persisted** — Coordinates are not stored to disk
- **Developer opt-in** — Location processing only occurs if the developer explicitly initializes the plugin
- **Platform permissions** — Respects system location permissions; no location data without user consent

### Dependencies

- **polyfence-core** — Geofencing engine (Kotlin + Swift). See `android/build.gradle` and `polyfence-react-native.podspec` for the currently pinned version.
- **React Native 0.73+** — Mobile framework
- **Play Services Location 21.3.0** (Android) — System location provider
- **CoreLocation** (iOS) — System location provider

All dependencies are regularly audited for vulnerabilities.

### Network Security

This bridge sends anonymous platform telemetry by default (opt-out). Aside from that, it makes no network calls — all geofencing runs on-device via polyfence-core.

- **Telemetry is opt-out** — enabled by default; disable with `initialize(undefined, { disableTelemetry: true })`
- **No location coordinates are transmitted**: telemetry carries aggregates only, some of them derived from location (average speed at events, dwell times, activity mix). See `doc/TELEMETRY.md`.
- **No API key required** for the telemetry pipeline
- **HTTPS only**
- See [PRIVACY.md](PRIVACY.md) and [`doc/TELEMETRY.md`](doc/TELEMETRY.md) for the field-by-field contract, and the [polyfence-core security policy](https://github.com/polyfence/polyfence-core/blob/main/SECURITY.md) for the engine's on-device guarantees

## Privacy Principles

1. **Privacy by default** — Anonymous aggregate telemetry only (opt-out); no end-user tracking, identifiers, or coordinates
2. **On-device processing** — All geofencing decisions happen locally
3. **No PII leakage** — No end-user identifiers are collected or transmitted; telemetry carries your app's package name, and a link to your Polyfence account if you configure an API key
4. **Transparent APIs** — Developers know what data flows where
5. **Minimal dependencies** — Reduces attack surface

## iOS Deployment Notes

### Time-Critical Alerts (Optional, Downstream)

If your app needs zone events to break through Do Not Disturb / Silent mode / Focus — for example perimeter security, anti-theft, child safety, fall detection, or medication adherence — you'll want Apple's [Critical Alerts entitlement](https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/). Polyfence fires events to your code; surfacing them with `.criticalAlert` is your app's responsibility and requires this entitlement, applied for via the form linked above.

This is **not** required for normal use cases — standard "you arrived at the office" notifications work fine without it. The entitlement is specifically for time-critical safety / security scenarios where breaking through DND is essential.

### App Store Submission — Background Location Review

Apple reviewers scrutinize apps that declare `UIBackgroundModes: location` and request Always permission. To smooth review:

- **Justify Always permission in plain language.** Reviewers want to understand the user-visible benefit, not just the technical capability ("we need Always to fire reminders when you arrive at a saved location, even when the app is closed").
- **Include a brief screen recording** in your TestFlight build showing the location-driven feature working. Helps avoid a reject + resubmit cycle.
- **Link your privacy policy from the app's settings screen**, not just from the App Store listing — reviewers check both.

## Privacy Policy Guidance

Telemetry fields, legal basis, retention, and opt-out are documented in **[PRIVACY.md](./PRIVACY.md)** and the technical payload reference **[doc/TELEMETRY.md](./doc/TELEMETRY.md)**. Use those sources as the source of truth so your public policy stays aligned with what the plugin actually sends.

When submitting apps using Polyfence to the App Store, include the following in your privacy policy:

### Location Data Usage Template

```
[Your App Name] uses background location services to provide geofence-based
features. Your position is processed on your device by the Polyfence SDK,
which does not send it to external servers.

We use the Polyfence open-source SDK for geofencing. By default, Polyfence:
- Processes your position locally on your device
- Does not send your position to any external server
- Stores geofence zone definitions locally in device storage

Polyfence also sends usage statistics to polyfence.io by default, each time
the app goes to the background or shuts Polyfence down, with totals since
tracking started. They include GPS accuracy averages, battery level and usage,
detection latency, average speed at zone events, time spent in zones, the mix
of activities such as walking or driving, the hour tracking started, the
device maker and class (for example, Samsung flagship) and OS version, and
this app's package name. They do NOT include your GPS coordinates, your
location history or anything that names you.
Polyfence's servers see your device's IP address when the statistics arrive,
as with any internet request; Polyfence does not keep it with them. [Delete
this paragraph if your app turns Polyfence telemetry off.]

You can disable location services at any time in your device Settings.
```

### Data Retention Template

```
Geofence zone definitions are stored locally on your device and persist until:
- You delete the app
- You clear app data via device Settings
- You explicitly remove zones within the app

Your GPS coordinates are not sent to or retained on external servers by the
Polyfence SDK.
```

## Secure Development Practices

- Code reviews on all changes
- Static analysis in CI (TypeScript strict mode, lint rules)
- Tests cover security-sensitive paths
- Dependencies updated regularly
- No hardcoded secrets or credentials
- Internal communication over native bridges only

## Contact

For any security issues, privacy concerns, or general inquiries: [hello@polyfence.io](mailto:hello@polyfence.io)
