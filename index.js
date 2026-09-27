import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
// and also ensures the environment is set up appropriately whether you load
// the app in the Expo Go client, or in a native build.
registerRootComponent(App);
