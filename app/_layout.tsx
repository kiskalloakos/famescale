import { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import OnboardingFlow from '../components/OnboardingFlow';
import AuthScreen from '../components/AuthScreen';
import SetNewPassword from '../components/SetNewPassword';
import { supabase } from '../lib/supabase';
import { setProfile } from '../lib/storage';
import { getSetup, refreshSetup } from '../lib/setup';

type Phase = 'loading' | 'signed-out' | 'recovery' | 'onboarding' | 'ready';

// Pull a key=value out of "#a=1&b=2"
function readHash(key: string, hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
  return params.get(key);
}

export default function RootLayout() {
  const [phase, setPhase] = useState<Phase>('loading');

  useEffect(() => {
    let cancelled = false;
    let inRecovery = false;

    const apply = async (userId: string | null) => {
      if (!userId) {
        setProfile('anonymous');
        if (!cancelled) {
          inRecovery = false;
          setPhase('signed-out');
        }
        return;
      }
      setProfile(userId);
      if (inRecovery) {
        if (!cancelled) setPhase('recovery');
        return;
      }
      let setup = await getSetup();
      if (!setup) setup = await refreshSetup();
      if (cancelled) return;
      setPhase(setup?.completed ? 'ready' : 'onboarding');
    };

    // On web only, check the URL hash for a Supabase recovery token before
    // anything else — if found, exchange it for a session and flag recovery.
    const bootstrap = async () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const type = readHash('type', hash);
        const accessToken = readHash('access_token', hash);
        const refreshToken = readHash('refresh_token', hash);
        if (type === 'recovery' && accessToken && refreshToken) {
          inRecovery = true;
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          // Strip the tokens out of the address bar so reload doesn't loop.
          window.history.replaceState({}, '', window.location.pathname + window.location.search);
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      apply(session?.user?.id ?? null);
    };

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // A successful password update fires USER_UPDATED; treat it as exit
      // from recovery so the user lands in the app normally.
      if (event === 'USER_UPDATED') inRecovery = false;
      apply(session?.user?.id ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (phase === 'loading') {
    return <View style={{ flex: 1, backgroundColor: '#0D0D0D' }} />;
  }

  if (phase === 'signed-out') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AuthScreen />
      </SafeAreaProvider>
    );
  }

  if (phase === 'recovery') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SetNewPassword />
      </SafeAreaProvider>
    );
  }

  if (phase === 'onboarding') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <OnboardingFlow onComplete={() => setPhase('ready')} />
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
