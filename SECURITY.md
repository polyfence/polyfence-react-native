# Security Policy

## Supported Versions

Security updates are provided for the following versions:

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | Yes                |
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

This React Native bridge makes no network calls itself. All security properties inherit from polyfence-core:

### Location Data

- **Processed on-device only** — Location data never leaves the device
- **Not persisted** — Coordinates are not stored to disk
- **Developer opt-in** — Location processing only occurs if the developer explicitly initializes the plugin
- **Platform permissions** — Respects system location permissions; no location data without user consent

### Dependencies

- **polyfence-core 1.0.5+** — Geofencing engine (Kotlin + Swift)
- **React Native 0.73+** — Mobile framework
- **Play Services Location 21.3.0** (Android) — System location provider
- **CoreLocation** (iOS) — System location provider

All dependencies are regularly audited for vulnerabilities.

### Network Security

This bridge does not make any network calls. Optionally, you may configure telemetry reporting via your backend, but:

- You control all network calls
- No location coordinates are transmitted
- Only aggregated telemetry (session counts, error types) leaves the device
- See [polyfence-core security policy](https://github.com/polyfence/polyfence-core/blob/main/SECURITY.md) for details

## Privacy Principles

1. **Privacy by default** — No tracking without explicit developer configuration
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
