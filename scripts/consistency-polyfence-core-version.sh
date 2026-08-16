#!/bin/bash
# Verify polyfence-core dependency version matches across Android (build.gradle)
# and iOS (polyfence-react-native.podspec). Catches drift where one platform
# bumps the engine pin and the other doesn't.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Android: implementation "io.polyfence:polyfence-core:X.Y.Z"
GRADLE_COORD=$(grep -E '"io\.polyfence:polyfence-core:' android/build.gradle 2>/dev/null \
  | grep -oE 'io\.polyfence:polyfence-core:[^"]+' \
  | head -1)
GRADLE_VER=$(echo "$GRADLE_COORD" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)

# A -SNAPSHOT pin resolves only from a developer's mavenLocal, so a shipped
# build would fail to resolve for every consumer. The comparison below reads
# only the numeric triple, so the qualifier is invisible to it — reject it
# explicitly rather than letting a local testing pin ride to release.
if [[ "$GRADLE_COORD" == *-SNAPSHOT* ]]; then
  echo "polyfence-core-version-sync: android/build.gradle pins a SNAPSHOT of polyfence-core"
  echo "  $GRADLE_COORD"
  echo "Fix: pin the released version. A SNAPSHOT resolves only from mavenLocal and would not resolve for consumers."
  exit 1
fi

# iOS: s.dependency "PolyfenceCore", "~> X.Y.Z"
PODSPEC_VER=$(grep -E 's\.dependency\s+"PolyfenceCore"' polyfence-react-native.podspec 2>/dev/null \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' \
  | head -1)

if [ -z "$GRADLE_VER" ]; then
  echo "polyfence-core-version-sync: could not extract polyfence-core version from android/build.gradle"
  exit 1
fi

if [ -z "$PODSPEC_VER" ]; then
  echo "polyfence-core-version-sync: could not extract PolyfenceCore version from polyfence-react-native.podspec"
  exit 1
fi

if [ "$GRADLE_VER" != "$PODSPEC_VER" ]; then
  echo "polyfence-core-version-sync: polyfence-core version mismatch between platforms"
  echo "  android/build.gradle:               $GRADLE_VER"
  echo "  polyfence-react-native.podspec:     $PODSPEC_VER"
  echo "Fix: update both files to the same polyfence-core version. The podspec uses '~> X.Y.Z' (twiddle-wakka, accepts 1.0.x); Android pins exactly."
  exit 1
fi
