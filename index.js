import { registerRootComponent } from 'expo';
import App from './App';
import { installCrashReporter } from './src/utils/crashReporter';

installCrashReporter();
registerRootComponent(App);
