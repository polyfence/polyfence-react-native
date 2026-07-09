#!/usr/bin/env bash
# Sync polyfence-react-native package version across all files.
#
# Source of truth: package.json (the `"version"` field).
# Usage: edit package.json to the new version FIRST, then run this script.
# The companion `scripts/consistency-check.sh --local-only` verifies nothing
# drifted afterwards; pre-push runs it automatically.
#
# Note: polyfence-react-native.podspec derives `s.version` from
# package.json at pod parse time, so it is not touched here.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
if [ -z "$VERSION" ]; then
    echo "Error: could not extract version from package.json"
    exit 1
fi

# Major.minor "train" marker used in SECURITY.md ("2.0.x" for 2.0.3, etc.).
MAJ_MIN="$(echo "$VERSION" | awk -F. '{print $1 "." $2}')"

echo "Syncing polyfence-react-native to version $VERSION..."

# TypeScript version constant
sed -i '' "s/POLYFENCE_PLUGIN_VERSION = '[^']*'/POLYFENCE_PLUGIN_VERSION = '$VERSION'/" src/version.ts

# README version marker
sed -i '' "s|<!-- pf:version -->[0-9][0-9.]*<!-- /pf:version -->|<!-- pf:version -->$VERSION<!-- /pf:version -->|" README.md

# doc/TELEMETRY.md — plugin_version sentinel in the payload example
sed -i '' "s/\"plugin_version\": \"[0-9][0-9.]*\"/\"plugin_version\": \"$VERSION\"/g" doc/TELEMETRY.md

# doc/TELEMETRY.md — plugin_version citation in the field table
sed -i '' "s/\`\"[0-9][0-9.]*\"\` | Package version/\`\"$VERSION\"\` | Package version/" doc/TELEMETRY.md

# SECURITY.md — major.minor supported-versions train marker.
# Find whichever train is currently marked "Yes" and rewrite it to
# $MAJ_MIN.x, but only if it actually differs (so we do not clobber
# unchanged files or older "Limited" train rows).
current_train="$(awk '/^\| [0-9]+\.[0-9]+\.x/ && /Yes/ {sub(/^\| /, ""); sub(/[[:space:]].*/, ""); print; exit}' SECURITY.md)"
if [ -n "$current_train" ] && [ "$current_train" != "$MAJ_MIN.x" ]; then
    sed -i '' "s#^| $current_train #| $MAJ_MIN.x #" SECURITY.md
fi

echo "Synced to $VERSION:"
echo "  package.json                    (source of truth)"
echo "  polyfence-react-native.podspec  (auto-derives from package.json)"
echo "  src/version.ts"
echo "  README.md pf:version marker"
echo "  doc/TELEMETRY.md plugin_version citations"
echo "  SECURITY.md $MAJ_MIN.x train marker"
echo
echo "Verify with: bash scripts/consistency-check.sh --local-only"
