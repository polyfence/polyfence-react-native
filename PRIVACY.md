# Polyfence React Native — Privacy Policy

**Applies to:** `polyfence-react-native` SDK only. Server-side and SaaS-side privacy posture is described separately at `https://polyfence.io/privacy`.

## Zero PII about your end users

Polyfence collects **zero PII and zero identifiable data about your end users.** The only personal information in our system is YOUR account info (email, billing) — same as any paid SaaS, identical to what Stripe or Vercel hold about you.

## What we collect about your end users — the three buckets

| Data class | What we collect | When |
|---|---|---|
| **Zone events** | Zone references only (`zone_id`, `device_id`, timestamp). No PII. No coordinates. | Always — this is the product value. |
| **Anonymous platform telemetry** | Aggregates only — accuracy averages, event frequencies, error counts. No identifiers, no coordinates, no PII. | Opt-out (one-line disable). |
| **Raw positions** | Not collected by default. Opt-in retention only. When opted in: positions only — never names / phones / emails / health / etc. | Opt-in only. |

> **Zero PII. Zero identifiable data about end users.**

## What we hold about YOU (the customer)

| Data class | What we hold |
|---|---|
| Account email | Standard B2B SaaS PII. |
| Billing / payment | Handled by payment processor; we don't store card data. |
| API keys + audit log | Pseudonymous credentials + access trail. |

> **Minimal customer PII. Identical to what every paid SaaS holds.**

## Different defaults for different data classes

| Data class | Default | Why |
|---|---|---|
| **Raw positions** | **Opt-IN** | We don't have your customers' location data unless you explicitly turn retention on. |
| **Anonymous platform aggregates** | **Opt-OUT** with one-line disable | Collected by default to fuel product improvements everyone benefits from. Never coordinates, never identifiers, never PII. Industry-standard pattern (Stripe, Vercel, Cloudflare, Sentry). |
| **Zone events** | **Always** | They're the value we deliver — collecting them isn't surveillance, it's the product. |

Different defaults for different data — control on every axis, no privacy theatre.

## Honest qualifiers

- **`device_id` is pseudonymous** (hashed identifier). Not PII per se. If you correlate it against your own user database, it becomes identifiable on **your** side — never on ours. GDPR-clean pseudonymisation.
- **`display_name`** is user-typed and could contain PII ("John's truck"). Our `firmware_visible_name` flag defaults FALSE (D074), so the name stays on the SaaS DB only and never reaches the firmware unless you explicitly turn it on. The customer chose to type it.
- **Customer account PII** (email, billing) is unavoidable for a paid SaaS. We don't pretend otherwise — neither does Stripe.

## This SDK never collects, transmits, or stores

`polyfence-react-native` **never collects, transmits, or stores** location data on its own. All geofencing math runs in `polyfence-core` (Kotlin on Android, Swift on iOS); this package is a marshalling layer between JavaScript and the native engine.

## polyfence-react-native specific

Anonymous platform telemetry is **enabled by default**. Disable with one line:

```typescript
await Polyfence.instance.initialize({ analyticsEnabled: false });
```

Field-by-field telemetry contract: see [`doc/TELEMETRY.md`](doc/TELEMETRY.md).

This package is the React Native bridge over `polyfence-core` — the geofence math runs in `polyfence-core` (Kotlin on Android, Swift on iOS), not in TypeScript. See [`polyfence-core` PRIVACY.md](https://github.com/polyfence/polyfence-core/blob/main/PRIVACY.md) for the engine's privacy claims.

## Dependencies

| Dependency | Purpose | Network Access |
|---|---|---|
| polyfence-core | Geofencing engine | None (on-device only) |
| React Native | Bridge framework | None from this package |
| Play Services Location (Android) | GPS provider | Device GPS only |
| CoreLocation (iOS) | GPS provider | Device GPS only |

## Contact

For any privacy questions, security concerns, or general inquiries: [hello@polyfence.io](mailto:hello@polyfence.io)
