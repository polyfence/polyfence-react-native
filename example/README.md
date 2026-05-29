# Polyfence React Native — Example App

A working React Native app that uses the `polyfence-react-native` bridge to
fetch zones from the Polyfence SaaS, track location, and display geofence
enter / exit / dwell events on both iOS and Android.

The app exercises the full SDK surface: zone fetching, location permissions,
background tracking, GPS profile switching, and event observation.

---

## 1. Get an API key

The example needs a Polyfence API key to fetch zones. Sign up for a free
account at [polyfence.io](https://polyfence.io), create your zones in the
dashboard, and copy the API key from your account settings.

Then paste it into `example/.env`:

```bash
cp .env.example .env
# edit .env and paste your key into POLYFENCE_API_KEY
```

`react-native-config` injects the value into the native build at compile
time (BuildConfig on Android, an Info.plist script on iOS), so rebuild
the native app after changing `.env`. If you launch the app without a key
set, the dashboard error banner will tell you the key is missing and
point you back to this file.

---

## 2. Install and run

The example consumes the bridge from this repo via a relative `file:` path,
so the bridge needs to be built first.

```bash
# From the repo root — build the bridge once:
npm install
npm run build

# Then in example/:
cd example
npm install
npx react-native-asset      # first-time: links assets/fonts/ into ios/ + android/
cd ios && pod install && cd ..

# In one terminal:
npm start

# In another:
npm run ios       # or: npm run android
```

Tested with React Native 0.76.7, Node 18+, Xcode 15+, JDK 17, CocoaPods 1.15+.

> **iOS — set your signing team.** The committed Xcode project declares
> no signing team. Open `example/ios/PolyfenceExample.xcworkspace` in Xcode,
> select the `PolyfenceExample` target, go to **Signing & Capabilities**,
> and pick your team from the dropdown. Simulator builds work without a
> team; running on a device or archiving needs one.

> **Editing the bridge while developing the example?** Re-run `npm run build`
> at the repo root after each change to the bridge `src/` so the example
> picks it up. (The example's Metro config watches `..`, but module
> resolution targets the bridge's compiled `lib/` output declared in its
> `package.json`.)

---

## 3. How it consumes the bridge

`package.json` references the bridge package by relative path:

```json
"polyfence-react-native": "../"
```

`npm install` symlinks `node_modules/polyfence-react-native` to the parent
directory. The bridge's `package.json` declares its entry points in
`lib/` (produced by `npm run build` at the repo root), so re-run that
command after changes to the bridge `src/`. The example's `metro.config.js`
adds the parent as a `watchFolder` and dedupes the React copies between
the bridge and the example so only one of each is bundled.

For native code changes in the bridge (`ios/` or `android/`), rebuild the
native app: `npm run ios` / `npm run android` again.

---

## 4. Layout

```
example/
├── src/
│   ├── App.tsx                    # Root: gate -> tab navigator
│   ├── screens/                   # Dashboard, Map
│   ├── components/                # UI: StatusBar, GpsProfileCard, ZoneList, EventLog, ApiKeyGate, ...
│   ├── hooks/usePolyfence.ts      # Wraps the SDK: init, subscriptions, tracking toggle, zone fetch
│   ├── services/                  # ZoneApiService, apiKey, LogBuffer, logger
│   ├── utils/                     # distance, permissions, storage
│   └── theme.ts                   # Brand tokens (colours, fonts, spacing, radii, shadows)
├── assets/
│   ├── fonts/                     # Space Grotesk (4 weights)
│   └── branding/                  # App icons (iOS + Android)
├── ios/                           # Native iOS project (committed)
├── android/                       # Native Android project (committed)
├── .env.example                   # Template for the build-time key path
├── app.json                       # name: PolyfenceExample
├── index.js                       # AppRegistry entry
├── metro.config.js                # Resolves the bridge from `..`
└── package.json
```

---

## 5. Troubleshooting

**"No zones loaded" / 401 from the API** — the API key wasn't picked up.
Confirm with a hard restart that either (a) `.env` has the key and you've
rebuilt the native app, or (b) you've completed the in-app gate.

**Fonts look wrong on Android** — run `npx react-native-asset` and rebuild.
The font files need to be copied into `android/app/src/main/assets/fonts/`.

**iOS build fails on first run** — run `cd ios && pod install` manually.
The first install pulls down `PolyfenceCore` via git, MapLibre via Swift
Package Manager, and the React Native pods.

**Permissions dialog never appears on Android** — uninstall the app and
reinstall. Android caches the "denied" decision per install.

---

## 6. License

MIT — see the root `LICENSE` file.
