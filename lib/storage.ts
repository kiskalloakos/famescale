// Profile-scoped storage. AsyncStorage today, cloud-backed tomorrow.
// To swap in a cloud backend, replace the body of load/save/remove —
// the public API and key shape stay the same.

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_PROFILE = 'default';
let currentProfile = DEFAULT_PROFILE;

// In-memory mirror of AsyncStorage so screens can read the latest value
// synchronously during render (via peek). Populated by load/save; cleared
// when the profile changes so one user's data never bleeds into another's.
const cache = new Map<string, unknown>();

function key(namespace: string): string {
  return `@famescale/${currentProfile}/${namespace}`;
}

export function setProfile(profile: string): void {
  if (profile !== currentProfile) cache.clear();
  currentProfile = profile;
}

export function getProfile(): string {
  return currentProfile;
}

// Sync read of the in-memory cache. Returns the cached value if load() has
// run for this namespace in this profile, otherwise the fallback. Use this
// as the lazy initializer for useState so the first paint already reflects
// real data instead of bouncing when the async load resolves.
export function peek<T>(namespace: string, fallback: T): T {
  const k = key(namespace);
  return cache.has(k) ? (cache.get(k) as T) : fallback;
}

export async function load<T>(namespace: string, fallback: T): Promise<T> {
  const k = key(namespace);
  const raw = await AsyncStorage.getItem(k);
  if (!raw) {
    cache.set(k, fallback);
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as T;
    cache.set(k, parsed);
    return parsed;
  } catch {
    cache.set(k, fallback);
    return fallback;
  }
}

export async function save<T>(namespace: string, value: T): Promise<void> {
  cache.set(key(namespace), value);
  await AsyncStorage.setItem(key(namespace), JSON.stringify(value));
}

export async function remove(namespace: string): Promise<void> {
  cache.delete(key(namespace));
  await AsyncStorage.removeItem(key(namespace));
}
