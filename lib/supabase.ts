import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase config. Make sure .env has EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

// SECURITY (audit 2026-05, accepted): native uses sandboxed AsyncStorage.
// On web, supabase-js falls back to localStorage for the session JWT —
// JS-readable, so any XSS could exfiltrate it. There is no httpOnly-cookie
// option without a backend (this app has none). Accepted risk: the web
// XSS surface is minimal (no user-rendered HTML, no 3rd-party scripts) and
// `app/+html.tsx` ships a strict CSP (script-src 'self', object-src 'none',
// frame-ancestors 'none', scoped connect-src) as the mitigation. Keep that
// CSP tight — it is what makes this acceptable.
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Off across all platforms — Supabase JS touches `document` even when
    // this flag is false at runtime, which throws on native. Recovery URL
    // parsing is done manually on web in RootLayout.
    detectSessionInUrl: false,
  },
});

// The signed-in user's id, or null. Single source of truth — every lib
// module scopes its Supabase reads/writes by this.
export async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// Where Supabase should redirect after sending a password-reset email.
export function getRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'famescale://';
}
