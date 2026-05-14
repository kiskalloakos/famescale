import { supabase } from './supabase';
import { load, save } from './storage';
import { newId } from './dashboard';
import { reportable } from './sync';

export interface RevenueEntry {
  id: string;            // UUID — stable across renames + cloud sync
  label: string;         // e.g. "2026"
  amount: number;
  months?: number[];     // 12 entries (Jan–Dec) when monthly breakdown is used
}

export interface RevenueState {
  entries: RevenueEntry[];
}

const NS = 'revenue';

function defaultState(): RevenueState {
  const year = String(new Date().getFullYear());
  return { entries: [{ id: newId(), label: year, amount: 0 }] };
}

function normalize(state: RevenueState): RevenueState {
  const entries = state.entries.map((e) => (e.id ? e : { ...e, id: newId() }));
  if (entries.length === 0) {
    entries.push({ id: newId(), label: String(new Date().getFullYear()), amount: 0 });
  }
  return { entries };
}

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getRevenue(): Promise<RevenueState> {
  const state = await load<RevenueState>(NS, defaultState());
  return normalize(state);
}

export async function refreshRevenue(): Promise<RevenueState> {
  const uid = await userId();
  if (!uid) return getRevenue();

  const { data, error } = await supabase
    .from('revenue_entries')
    .select('id, label, amount, months')
    .eq('user_id', uid);

  if (error) return getRevenue();

  const rows = data ?? [];
  const entries: RevenueEntry[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    amount: Number(r.amount),
    months: r.months ?? undefined,
  }));

  const state = normalize({ entries });
  await save(NS, state);
  return state;
}

export async function saveRevenue(state: RevenueState): Promise<void> {
  await save(NS, state);

  const uid = await userId();
  if (!uid) return;

  // Find existing remote rows so we can compute deletes.
  const { data: existing } = await supabase
    .from('revenue_entries')
    .select('id')
    .eq('user_id', uid);

  const remoteIds = new Set((existing ?? []).map((r) => r.id));
  const localIds = new Set(state.entries.map((e) => e.id));
  const toDelete = [...remoteIds].filter((id) => !localIds.has(id));

  if (toDelete.length > 0) {
    await reportable(
      supabase.from('revenue_entries').delete().in('id', toDelete).eq('user_id', uid),
    );
  }

  if (state.entries.length > 0) {
    const newestLabel = sortEntries(state.entries)[0]?.label;
    const rows = state.entries.map((e) => ({
      id: e.id,
      user_id: uid,
      label: e.label,
      amount: e.amount,
      months: e.months ?? null,
      is_current: e.label === newestLabel,
    }));
    await reportable(supabase.from('revenue_entries').upsert(rows));
  }
}

// Returns entries sorted newest first (by label string descending).
export function sortEntries(entries: RevenueEntry[]): RevenueEntry[] {
  return [...entries].sort((a, b) => b.label.localeCompare(a.label));
}

export function allTimeTotal(entries: RevenueEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

// Current entry = newest by label.
export function currentEntry(state: RevenueState): RevenueEntry | null {
  return sortEntries(state.entries)[0] ?? null;
}

export function previousEntry(state: RevenueState): RevenueEntry | null {
  return sortEntries(state.entries)[1] ?? null;
}

export function sumMonths(months: number[] | undefined): number {
  return months ? months.reduce((a, b) => a + b, 0) : 0;
}

export function activeMonthCount(months: number[] | undefined): number {
  return months ? months.filter((m) => m > 0).length : 0;
}
