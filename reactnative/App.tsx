import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ClerkProvider, ClerkLoaded} from '@clerk/clerk-expo';
import {ThemeProvider} from './src/context/ThemeContext';
import {ToastProvider} from './src/context/ToastContext';
import {UserProvider} from './src/context/UserContext';
import AppNavigator from './src/app/navigation/AppNavigator';
import {ENV} from './src/config/env';

export default function App() {
  return (
    <ClerkProvider publishableKey={ENV.CLERK_PUBLISHABLE_KEY}>
      <ClerkLoaded>
        <SafeAreaProvider>
          <ThemeProvider>
            <UserProvider>
              <ToastProvider>
                <AppNavigator />
              </ToastProvider>
            </UserProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}