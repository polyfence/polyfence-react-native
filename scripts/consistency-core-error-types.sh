#!/usr/bin/env bash
# Fails when an error type polyfence-core can emit has no mapping in this
# bridge's PolyfenceErrorType surface.
#
# An unmapped native code does not fail loudly — normalizePolyfenceError falls
# back to `unknown`, so the error still reaches onError and a consumer simply
# cannot tell it apart from anything else unmapped. That is invisible in every
# test that does not assert on the specific type, which is how the same gap
# reached this bridge twice.
#
# Three assertions, all offline:
#
#   1. Every entry in CORE_ERROR_TYPES below is a key in NATIVE_CODE_TO_TYPE.
#      CORE_ERROR_TYPES is the contract; it always runs.
#   2. Every type NATIVE_CODE_TO_TYPE maps to is also in ALLOWED_ERROR_TYPES.
#      TypeScript checks that the values are valid union members, not that the
#      Set is complete — and a type missing from the Set silently degrades to
#      `unknown` whenever native sends the camelCase form under `type`.
#   3. When a polyfence-core checkout is reachable, its emitted type strings are
#      extracted and diffed against CORE_ERROR_TYPES, so a type added upstream
#      is caught here rather than at the next device test. Skipped with a notice
#      when no checkout is found, which is the normal case in CI.
#
# Set POLYFENCE_CORE_PATH to point assertion 3 at a checkout in a non-default
# place.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

EVENTS_SOURCE="src/events.ts"

# Every `type` string polyfence-core passes to PolyfenceErrorManager.reportError
# (directly or through reportGpsError / reportServiceError / reportBatteryError)
# on either platform.
CORE_ERROR_TYPES=(
  analytics_upload_failed
  battery_optimization_required
  configuration_error
  gps_accuracy_poor
  gps_error
  gps_permission_denied
  gps_service_disabled
  gps_timeout
  gps_unreliable
  low_battery
  memory_low
  network_timeout
  os_geofence_permission_denied
  os_geofence_queue_disabled
  os_geofence_registration_failed
  pending_events_evicted
  permission_revoked
  polygon_self_intersecting
  service_killed
  service_restart_failed
  service_start_failed
  wake_lock_timeout
  zone_load_failed
  zone_storage_failed
  zone_validation_failed
)

if [[ ! -f "$EVENTS_SOURCE" ]]; then
  echo "FAIL: $EVENTS_SOURCE not found — the error-type surface moved."
  exit 1
fi

# NATIVE_CODE_TO_TYPE spans from its declaration to the closing brace of the
# object literal; ALLOWED_ERROR_TYPES from its `new Set` to the closing bracket.
native_map_block="$(sed -n '/^const NATIVE_CODE_TO_TYPE/,/^};$/p' "$EVENTS_SOURCE")"
allowed_block="$(sed -n '/ALLOWED_ERROR_TYPES/,/\]);$/p' "$EVENTS_SOURCE")"

if [[ -z "$native_map_block" || -z "$allowed_block" ]]; then
  echo "FAIL: could not locate NATIVE_CODE_TO_TYPE / ALLOWED_ERROR_TYPES in $EVENTS_SOURCE."
  echo "The extraction below is anchored to their declarations — update it if they were renamed."
  exit 1
fi

unmapped=()
for code in "${CORE_ERROR_TYPES[@]}"; do
  grep -qE "^[[:space:]]*${code}:" <<<"$native_map_block" || unmapped+=("$code")
done

if (( ${#unmapped[@]} > 0 )); then
  echo "FAIL: polyfence-core error types with no NATIVE_CODE_TO_TYPE entry:"
  for code in "${unmapped[@]}"; do
    echo "  - $code"
  done
  echo
  echo "Add each to NATIVE_CODE_TO_TYPE in $EVENTS_SOURCE, mapping it to a new"
  echo "PolyfenceErrorType (also added to the union in src/types.ts and to"
  echo "ALLOWED_ERROR_TYPES) or to an existing one — 'unknown' is a valid,"
  echo "deliberate target. Mirror the decision in polyfence-flutter's"
  echo "PolyfenceErrorType enum."
  exit 1
fi

mapped_types="$(grep -oE ":[[:space:]]*'[A-Za-z]+'" <<<"$native_map_block" | grep -oE "'[A-Za-z]+'" | tr -d "'" | sort -u)"
missing_from_allowed=()
while IFS= read -r t; do
  [[ -n "$t" ]] || continue
  grep -qE "^[[:space:]]*'${t}'," <<<"$allowed_block" || missing_from_allowed+=("$t")
done <<<"$mapped_types"

if (( ${#missing_from_allowed[@]} > 0 )); then
  echo "FAIL: PolyfenceErrorType values mapped by NATIVE_CODE_TO_TYPE but absent from ALLOWED_ERROR_TYPES:"
  for t in "${missing_from_allowed[@]}"; do
    echo "  - $t"
  done
  echo
  echo "normalizePolyfenceError only accepts a native \`type\` verbatim when it"
  echo "is in ALLOWED_ERROR_TYPES, so a value missing here silently degrades to"
  echo "'unknown'. Add it to the Set in $EVENTS_SOURCE."
  exit 1
fi

# Diff the roster against a live core checkout when one is reachable.
CORE_DIR=""
for candidate in \
  "${POLYFENCE_CORE_PATH:-}" \
  "$ROOT/../polyfence-core" \
  "$ROOT/../../polyfence-core" \
  "$ROOT/../../../polyfence-core" \
  "$ROOT/../../../../polyfence-core"
do
  [[ -n "$candidate" && -d "$candidate/android/src/main" ]] || continue
  CORE_DIR="$candidate"
  break
done

if [[ -z "$CORE_DIR" ]]; then
  echo "OK: ${#CORE_ERROR_TYPES[@]} core error types all map to a PolyfenceErrorType"
  echo "OK: every mapped type is present in ALLOWED_ERROR_TYPES"
  echo "NOTE: no polyfence-core checkout found — roster not diffed against core."
  echo "      Set POLYFENCE_CORE_PATH to enable that check."
  exit 0
fi

live="$(
  grep -rhoE '(reportError|reportGpsError|reportServiceError|reportBatteryError)\([^)]*' \
    "$CORE_DIR/android/src/main" "$CORE_DIR/ios/Classes" 2>/dev/null \
    | grep -oE '(type|errorType)?[[:space:]]*[:=]?[[:space:]]*"[a-z][a-z0-9_]+"' \
    | grep -oE '"[a-z][a-z0-9_]+"' \
    | tr -d '"' \
    | sort -u
)"

# The extractor sees the first string literal after each call site, which is the
# type argument at every call but also picks up context-map keys where the type
# was passed as a variable. Only strings that are NOT in the roster matter, and
# a false positive there is a prompt to look rather than a silent pass.
missing="$(comm -23 <(echo "$live") <(printf '%s\n' "${CORE_ERROR_TYPES[@]}" | sort -u) || true)"
# Known non-type strings the extractor cannot distinguish from a type argument.
missing="$(echo "$missing" | grep -vxE 'android|ios|platform|type|details|error|timestamp|severity|source' || true)"

if [[ -n "$missing" ]]; then
  echo "FAIL: polyfence-core emits error types absent from CORE_ERROR_TYPES:"
  echo "$missing" | sed 's/^/  - /'
  echo
  echo "Core checkout: $CORE_DIR"
  echo "Add each to CORE_ERROR_TYPES in this script AND give it a mapping in"
  echo "$EVENTS_SOURCE, then mirror both in polyfence-flutter."
  exit 1
fi

echo "OK: ${#CORE_ERROR_TYPES[@]} core error types all map to a PolyfenceErrorType"
echo "OK: every mapped type is present in ALLOWED_ERROR_TYPES"
echo "OK: roster matches the error types emitted by $CORE_DIR"
exit 0
