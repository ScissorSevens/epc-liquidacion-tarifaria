import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';

import { AuthGate } from './src/componentes/AuthGate';

SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <PaperProvider>
      <AuthGate />
      <StatusBar style="auto" />
    </PaperProvider>
  );
}