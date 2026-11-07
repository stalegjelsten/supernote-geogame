/**
 * @format
 */

import {AppRegistry, Image} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

import {PluginManager} from 'sn-plugin-lib';
import {startLanguageTracking} from './src/i18n/device';

AppRegistry.registerComponent(appName, () => App);

PluginManager.init();

// Follow the device language and load a saved language choice from the menu.
startLanguageTracking();

// A single button in the NOTE toolbar that opens the World Capitals Quiz menu.
PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: 'World Capitals Quiz',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});
