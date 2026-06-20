#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ver="$(node -p "require('./package.json').version")"
grep -qF "$ver" README.md || { echo "package.json version ${ver} not cited in README.md"; exit 1; }
grep -qF "\"plugin_version\": \"$ver\"" doc/TELEMETRY.md || {
  echo "doc/TELEMETRY.md missing plugin_version sentinel for ${ver}"
  exit 1
}
grep -qF "POLYFENCE_PLUGIN_VERSION = '$ver'" src/version.ts || {
  echo "src/version.ts POLYFENCE_PLUGIN_VERSION out of sync with package.json ${ver}"
  exit 1
}
maj_min="$(echo "$ver" | awk -F. '{print $1 "." $2}')"
grep -qF "$maj_min" SECURITY.md || { echo "SECURITY.md missing ${maj_min} train marker"; exit 1; }
