import { registerRootComponent } from 'expo';
import App from './App';
import { syncService } from '../expo/lib/sync';
syncService.configure({ transactionsOnly: true });
registerRootComponent(App);
