// Profile-scoped storage. AsyncStorage today, cloud-backed tomorrow.
// To swap in a cloud backend, replace the body of load/save/remove —
// the public API and key shape stay the same.

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_PROFILE = 'default';
let currentProfile = DEFAULT_PROFILE;

function key(namespace: string): string {
  return `@famescale/${currentProfile}/${namespace}`;
}

export function setProfile(profile: string): void {
  currentProfile = profile;
}

export function getProfile(): string {
  return currentProfile;
}

export async function load<T>(namespace: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key(namespace));
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function save<T>(namespace: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key(namespace), JSON.stringify(value));
}

export async function remove(namespace: string): Promise<void> {
  await AsyncStorage.removeItem(key(namespace));
}
