#!/bin/bash
# Verify polyfence-core dependency version matches across Android (build.gradle)
# and iOS (polyfence-react-native.podspec). Catches drift where one platform
# bumps the engine pin and the other doesn't.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Android: implementation "io.polyfence:polyfence-core:X.Y.Z"
GRADLE_VER=$(grep -E '"io\.polyfence:polyfence-core:' android/build.gradle 2>/dev/null \
  | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' \
  | head -1)

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
