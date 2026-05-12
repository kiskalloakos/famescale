import { supabase } from './supabase';
import { load, save } from './storage';

export interface Account {
  id: string;
  name: string;
  amount: string;
  position: number;
}

export interface Cost {
  id: string;
  name: string;
  amount: string;
  paid: boolean;
  position: number;
}

export interface DashboardData {
  accounts: Account[];
  costs: Cost[];
}

const NS = 'dashboard';
const EMPTY: DashboardData = { accounts: [], costs: [] };

// Pure-JS UUID v4 (no native crypto module required)
export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ── Local cache ────────────────────────────────────────────
export async function getDashboard(): Promise<DashboardData> {
  return load<DashboardData>(NS, EMPTY);
}

async function persistCache(data: DashboardData): Promise<void> {
  await save(NS, data);
}

// ── Refresh from Supabase ──────────────────────────────────
export async function refreshDashboard(): Promise<DashboardData> {
  const uid = await userId();
  if (!uid) return getDashboard();

  const [accountsRes, costsRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, amount, position')
      .eq('user_id', uid)
      .order('position', { ascending: true }),
    supabase
      .from('costs')
      .select('id, name, amount, paid, position')
      .eq('user_id', uid)
      .order('position', { ascending: true }),
  ]);

  if (accountsRes.error || costsRes.error) return getDashboard();

  const data: DashboardData = {
    accounts: (accountsRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      amount: String(r.amount),
      position: r.position,
    })),
    costs: (costsRes.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      amount: String(r.amount),
      paid: r.paid,
      position: r.position,
    })),
  };
  await persistCache(data);
  return data;
}

// ── Account ops ─────────────────────────────────────────────
export async function saveAccount(account: Account): Promise<void> {
  const cache = await getDashboard();
  const accounts = cache.accounts.find((a) => a.id === account.id)
    ? cache.accounts.map((a) => (a.id === account.id ? account : a))
    : [...cache.accounts, account];
  await persistCache({ ...cache, accounts });

  const uid = await userId();
  if (!uid) return;
  await supabase.from('accounts').upsert({
    id: account.id,
    user_id: uid,
    name: account.name,
    amount: parseFloat(account.amount) || 0,
    position: account.position,
  });
}

export async function deleteAccount(id: string): Promise<void> {
  const cache = await getDashboard();
  await persistCache({ ...cache, accounts: cache.accounts.filter((a) => a.id !== id) });

  const uid = await userId();
  if (!uid) return;
  await supabase.from('accounts').delete().eq('id', id).eq('user_id', uid);
}

// ── Cost ops ────────────────────────────────────────────────
export async function saveCost(cost: Cost): Promise<void> {
  const cache = await getDashboard();
  const costs = cache.costs.find((c) => c.id === cost.id)
    ? cache.costs.map((c) => (c.id === cost.id ? cost : c))
    : [...cache.costs, cost];
  await persistCache({ ...cache, costs });

  const uid = await userId();
  if (!uid) return;
  await supabase.from('costs').upsert({
    id: cost.id,
    user_id: uid,
    name: cost.name,
    amount: parseFloat(cost.amount) || 0,
    paid: cost.paid,
    position: cost.position,
  });
}

export async function deleteCost(id: string): Promise<void> {
  const cache = await getDashboard();
  await persistCache({ ...cache, costs: cache.costs.filter((c) => c.id !== id) });

  const uid = await userId();
  if (!uid) return;
  await supabase.from('costs').delete().eq('id', id).eq('user_id', uid);
}
