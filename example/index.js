import {AppRegistry, Text, TextInput} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

// Set Space Grotesk as the default for all bare <Text> / <TextInput>.
// Any component that explicitly sets fontFamily (e.g. Typography styles
// in src/theme.ts) overrides this.
const DEFAULT_FONT_STYLE = {fontFamily: 'SpaceGrotesk-Regular'};
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = [DEFAULT_FONT_STYLE, Text.defaultProps.style];
TextInput.defaultProps = TextInput.defaultProps || {};
TextInput.defaultProps.style = [DEFAULT_FONT_STYLE, TextInput.defaultProps.style];

AppRegistry.registerComponent(appName, () => App);
