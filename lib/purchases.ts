// RevenueCat wrapper. The ENTIRE paywall is gated on this module reporting
// "configured": if no platform API key is set (EXPO_PUBLIC_REVENUECAT_*),
// or on web (RevenueCat has no web SDK), the app behaves exactly as it did
// before the paywall existed — nothing ships half-working while the
// RevenueCat account / store product are still being set up.
//
// The native module is require()'d lazily so the web bundle never evaluates
// it. Tie the RevenueCat identity to the Supabase user id so the one-time
// lifetime unlock restores across devices/reinstalls.

import { Platform } from 'react-native';

// Configured in RevenueCat: one entitlement, granted by the $9.99
// non-consumable "lifetime" product/offering.
export const PRO_ENTITLEMENT = 'pro';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

function apiKey(): string | undefined {
  if (Platform.OS === 'ios') return IOS_KEY;
  if (Platform.OS === 'android') return ANDROID_KEY;
  return undefined; // web / unsupported
}

// Master switch. False → paywall disabled, app runs as pre-paywall.
export function purchasesConfigured(): boolean {
  return !!apiKey();
}

// Lazy native-module handle (never loaded on web or when unconfigured).
let RC: typeof import('react-native-purchases').default | null = null;
function rc() {
  if (!RC) RC = require('react-native-purchases').default;
  return RC!;
}

let configured = false;

// Idempotent. Call once after auth with the Supabase user id so purchases
// are account-scoped (cross-device restore).
export async function configurePurchases(supabaseUserId: string): Promise<void> {
  const key = apiKey();
  if (!key || configured) return;
  try {
    rc().configure({ apiKey: key, appUserID: supabaseUserId });
    configured = true;
  } catch {
    // Native module missing (e.g. Expo Go) — stay unconfigured; the
    // access layer falls back to trial-only and never hard-locks.
    configured = false;
  }
}

export async function isProActive(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await rc().getCustomerInfo();
    return info.entitlements.active[PRO_ENTITLEMENT] != null;
  } catch {
    return false;
  }
}

// The current offering's lifetime package, or null if offerings aren't
// configured yet in RevenueCat / the store.
export async function getLifetimePackage(): Promise<unknown | null> {
  if (!configured) return null;
  try {
    const offerings = await rc().getOfferings();
    const cur = offerings.current;
    if (!cur) return null;
    return cur.lifetime ?? cur.availablePackages[0] ?? null;
  } catch {
    return null;
  }
}

// Returns true if the purchase resulted in the pro entitlement being
// active. Throws on real errors; callers treat user-cancellation as a
// no-op (RevenueCat sets userCancelled on the error).
export async function purchaseLifetime(pkg: unknown): Promise<boolean> {
  if (!configured || !pkg) return false;
  const { customerInfo } = await rc().purchasePackage(pkg as never);
  return customerInfo.entitlements.active[PRO_ENTITLEMENT] != null;
}

export function isUserCancelled(e: unknown): boolean {
  return !!(e && typeof e === 'object' && (e as { userCancelled?: boolean }).userCancelled);
}

export async function restorePurchases(): Promise<boolean> {
  if (!configured) return false;
  try {
    const info = await rc().restorePurchases();
    return info.entitlements.active[PRO_ENTITLEMENT] != null;
  } catch {
    return false;
  }
}
