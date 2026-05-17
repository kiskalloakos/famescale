// One-time, dismiss-forever UI hints. Local-only (no Supabase): a hint
// already shown on this device never needs to come back, and there's
// nothing to reconcile across devices. Stored as a single flags object
// under one profile-scoped key (see storage.ts).

import { load, save } from './storage';

const NS = 'hints';

export type HintName = 'accountsReorder';

type Hints = Partial<Record<HintName, boolean>>;

export async function hintSeen(name: HintName): Promise<boolean> {
  const h = await load<Hints>(NS, {});
  return h[name] === true;
}

export async function markHintSeen(name: HintName): Promise<void> {
  const h = await load<Hints>(NS, {});
  if (h[name]) return;
  await save(NS, { ...h, [name]: true });
}
