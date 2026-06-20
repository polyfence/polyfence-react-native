# Security Policy

## Supported Versions

Security updates are provided for the following versions:

| Version | Supported          |
|---------|--------------------|
| 2.0.x   | Yes                |
| 0.1.x   | Limited (security only) |
| < 0.1   | No                 |

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
- **No location coordinates are transmitted** — only anonymous aggregates (session counts, accuracy averages, error-class tallies)
- **No API key required** for the telemetry pipeline
- **HTTPS only**
- See [PRIVACY.md](PRIVACY.md) and [`doc/TELEMETRY.md`](doc/TELEMETRY.md) for the field-by-field contract, and the [polyfence-core security policy](https://github.com/polyfence/polyfence-core/blob/main/SECURITY.md) for the engine's on-device guarantees

## Privacy Principles

1. **Privacy by default** — Anonymous aggregate telemetry only (opt-out); no end-user tracking, identifiers, or coordinates
2. **On-device processing** — All geofencing decisions happen locally
3. **No PII leakage** — No user identifiers are collected or transmitted
4. **Transparent APIs** — Developers know what data flows where
5. **Minimal dependencies** — Reduces attack surface

## Secure Development Practices

- Code reviews on all changes
- Static analysis in CI (TypeScript strict mode, lint rules)
- Tests cover security-sensitive paths
- Dependencies updated regularly
- No hardcoded secrets or credentials
- Internal communication over native bridges only

## Contact

For any security issues, privacy concerns, or general inquiries: [hello@polyfence.io](mailto:hello@polyfence.io)
