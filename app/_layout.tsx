import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingFlow, { SETUP_KEY } from '../components/OnboardingFlow';

export default function RootLayout() {
  const [status, setStatus] = useState<'loading' | 'onboarding' | 'ready'>('loading');

  useEffect(() => {
    AsyncStorage.getItem(SETUP_KEY).then((data) => {
      const complete = data ? JSON.parse(data).completed === true : false;
      setStatus(complete ? 'ready' : 'onboarding');
    });
  }, []);

  if (status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: '#0D0D0D' }} />;
  }

  if (status === 'onboarding') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <OnboardingFlow onComplete={() => setStatus('ready')} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
