/**
 * Normalize the native engine's configuration response so its enum string
 * values match the TypeScript contract (AccuracyProfile / UpdateStrategy
 * unions in `./types`).
 *
 * Why this exists: polyfence-core's `SmartGpsConfigFactory.toMap` emits enum
 * values in UPPERCASE_SNAKE_CASE on BOTH platforms — on Android via Kotlin's
 * `enum.name` (cases are conventionally UPPERCASE_SNAKE), and on iOS via
 * Swift's explicit `String` raw values declared as `case balanced = "BALANCED"`
 * etc. The TypeScript contract (`AccuracyProfile = 'maxAccuracy' | 'balanced'
 * | ...`) and the README examples both use lowerCamelCase, so a JS consumer
 * comparing `config.accuracyProfile === 'balanced'` against the native
 * response gets a false negative even when the configuration is correctly
 * set. BUG-007.
 *
 * Fix lives in the bridge per the triage decision, in the JS layer (not the
 * native modules) so a single normalizer covers both platforms plus any
 * future bridge surface — matches the precedent set by the Flutter bridge's
 * `EnumUtils.fromChannelFormat`.
 *
 * Scope: read path only. The write path
 * (`setAccuracyProfile` / `updateConfiguration`) already accepts any case
 * via polyfence-core's upstream `.trim().uppercase().replace("[^A-Z0-9]","")`
 * matcher, so lowerCamelCase from JS already works going IN.
 */

/** Top-level keys whose values are enum names that need normalization. */
const ENUM_KEYS_TO_NORMALIZE: ReadonlySet<string> = new Set([
  'accuracyProfile',
  'updateStrategy',
]);

/**
 * `"BALANCED"` → `"balanced"`
 * `"MAX_ACCURACY"` → `"maxAccuracy"`
 * `"PROXIMITY_BASED"` → `"proximityBased"`
 *
 * Already-lowerCamelCase or single-word lowercase strings pass through
 * unchanged, so this is safe to apply blindly on the listed keys.
 */
export function snakeUpperToLowerCamel(value: string): string {
  if (value.length === 0) {
    return value;
  }
  if (!value.includes('_')) {
    // No underscores. Idempotency: if the input is already lowerCamelCase
    // (`"maxAccuracy"`) or any mixed-case form, pass it through unchanged —
    // otherwise we'd flatten `"maxAccuracy"` → `"maxaccuracy"` and break
    // already-normalized callers. Only the all-uppercase single-word case
    // (`"BALANCED"` / `"ADAPTIVE"`) needs lowercasing.
    return value === value.toUpperCase() ? value.toLowerCase() : value;
  }
  const parts = value.split('_').filter((p) => p.length > 0);
  if (parts.length === 0) {
    return value;
  }
  const head = parts[0]!.toLowerCase();
  const tail = parts
    .slice(1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
  return head + tail;
}

/**
 * Apply {@link snakeUpperToLowerCamel} to the enum-keyed top-level fields of
 * a configuration object returned by the native bridge. Every other value
 * passes through unchanged; nested settings objects are left as-is (they
 * contain numeric/boolean fields, not enum strings).
 */
export function normalizeConfigEnums<T extends Record<string, unknown>>(
  config: T,
): T {
  if (config == null || typeof config !== 'object') {
    return config;
  }
  const out: Record<string, unknown> = { ...config };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (ENUM_KEYS_TO_NORMALIZE.has(key) && typeof value === 'string') {
      out[key] = snakeUpperToLowerCamel(value);
    }
  }
  return out as T;
}
