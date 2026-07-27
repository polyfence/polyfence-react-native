#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ver="$(node -p "require('./package.json').version")"

# Check the specific sentinel form, not just that the version string appears
# somewhere in the file. Bare-string presence passed while the visible
# `<!-- pf:version -->` install-snippet block silently held a stale prior
# version, because the CHANGELOG / upgrade text elsewhere contained the new
# string. Anchor on the exact sentinel span that scripts/sync_version.sh
# writes so drift in the sentinel fails the check.
grep -qF "<!-- pf:version -->${ver}<!-- /pf:version -->" README.md || {
  echo "README.md <!-- pf:version --> sentinel not synced to ${ver}"
  echo "Fix: run scripts/sync_version.sh after bumping package.json."
  exit 1
}
grep -qF "\"plugin_version\": \"$ver\"" doc/TELEMETRY.md || {
  echo "doc/TELEMETRY.md missing plugin_version sentinel for ${ver}"
  exit 1
}
grep -qF "POLYFENCE_PLUGIN_VERSION = '$ver'" src/version.ts || {
  echo "src/version.ts POLYFENCE_PLUGIN_VERSION out of sync with package.json ${ver}"
  exit 1
}
maj_min="$(echo "$ver" | awk -F. '{print $1 "." $2}')"
grep -qF "| ${maj_min}.x " SECURITY.md || {
  echo "SECURITY.md missing ${maj_min}.x row in Supported Versions table"
  echo "Fix: run scripts/sync_version.sh after bumping package.json."
  exit 1
}
