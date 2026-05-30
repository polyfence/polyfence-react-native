// Consumed by `npx react-native-asset` to copy bundled fonts into the
// native ios/ and android/ projects. After `npm install`, run:
//
//   npx react-native-asset
//
// on first checkout to link assets/fonts/ into Info.plist (UIAppFonts) and
// android/app/src/main/assets/fonts/.
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/fonts/'],
};
