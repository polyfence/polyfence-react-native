const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

// Resolve the in-repo bridge package from the parent directory.
// The example consumes polyfence-react-native via `"polyfence-react-native": "../"`
// in package.json (npm symlinks node_modules/polyfence-react-native -> ..).
// Watching the parent lets Metro pick up edits to src/ without reinstalling.
const polyfenceReactNative = path.resolve(__dirname, '..');

const appNodeModules = path.resolve(__dirname, 'node_modules');

const config = {
  watchFolders: [polyfenceReactNative],
  resolver: {
    // Only resolve modules from the example's own node_modules so the bridge
    // doesn't accidentally pull in its devDependency copies of react/react-native.
    nodeModulesPaths: [appNodeModules],
    // Block the bridge's own react / react-native trees from being bundled.
    blockList: [
      new RegExp(
        path
          .resolve(polyfenceReactNative, 'node_modules', '(react-native|react)')
          .replace(/[/\\]/g, '[/\\\\]') + '[/\\\\]',
      ),
    ],
    extraNodeModules: new Proxy(
      {
        react: path.resolve(appNodeModules, 'react'),
        'react-native': path.resolve(appNodeModules, 'react-native'),
      },
      {
        get: (target, name) =>
          target[name] ?? path.resolve(appNodeModules, String(name)),
      },
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
