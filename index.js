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

// Følg enhetens språk og hent et lagret språkvalg fra menyen.
startLanguageTracking();

// Én knapp i verktøylinja i NOTE som åpner Geogame-menyen.
PluginManager.registerButton(1, ['NOTE'], {
  id: 100,
  name: 'Geogame',
  icon: Image.resolveAssetSource(require('./assets/icon.png')).uri,
  showType: 1,
});
