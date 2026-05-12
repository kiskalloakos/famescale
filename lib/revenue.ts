import { supabase } from './supabase';
import { load, save } from './storage';
import { newId } from './dashboard';

export interface RevenueEntry {
  id: string;            // UUID — stable across renames + cloud sync
  label: string;         // e.g. "2026" or "2020-2022"
  amount: number;
  months?: number[];     // 12 entries (Jan–Dec) when monthly breakdown is used
}

export interface RevenueState {
  currentYearLabel: string;
  entries: RevenueEntry[];
}

const NS = 'revenue';

function defaultState(): RevenueState {
  const year = String(new Date().getFullYear());
  return { currentYearLabel: year, entries: [{ id: newId(), label: year, amount: 0 }] };
}

function ensureCurrentEntry(state: RevenueState): RevenueState {
  // Backfill ids for any entries cached before id was a field
  const entries = state.entries.map((e) => (e.id ? e : { ...e, id: newId() }));
  if (!entries.some((e) => e.label === state.currentYearLabel)) {
    entries.push({ id: newId(), label: state.currentYearLabel, amount: 0 });
  }
  return { currentYearLabel: state.currentYearLabel, entries };
}

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getRevenue(): Promise<RevenueState> {
  const state = await load<RevenueState>(NS, defaultState());
  return ensureCurrentEntry(state);
}

export async function refreshRevenue(): Promise<RevenueState> {
  const uid = await userId();
  if (!uid) return getRevenue();

  const { data, error } = await supabase
    .from('revenue_entries')
    .select('id, label, amount, months, is_current')
    .eq('user_id', uid);

  if (error) return getRevenue();

  const rows = data ?? [];
  const entries: RevenueEntry[] = rows.map((r) => ({
    id: r.id,
    label: r.label,
    amount: Number(r.amount),
    months: r.months ?? undefined,
  }));

  const currentRow = rows.find((r) => r.is_current);
  const currentYearLabel =
    currentRow?.label ?? entries[entries.length - 1]?.label ?? String(new Date().getFullYear());

  const state = ensureCurrentEntry({ currentYearLabel, entries });
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
    await supabase.from('revenue_entries').delete().in('id', toDelete);
  }

  if (state.entries.length > 0) {
    const rows = state.entries.map((e) => ({
      id: e.id,
      user_id: uid,
      label: e.label,
      amount: e.amount,
      months: e.months ?? null,
      is_current: e.label === state.currentYearLabel,
    }));
    await supabase.from('revenue_entries').upsert(rows);
  }
}

// Returns entries sorted newest first (by label string descending).
export function sortEntries(entries: RevenueEntry[]): RevenueEntry[] {
  return [...entries].sort((a, b) => b.label.localeCompare(a.label));
}

export function allTimeTotal(entries: RevenueEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

export function previousEntry(state: RevenueState): RevenueEntry | null {
  const sorted = sortEntries(state.entries);
  const idx = sorted.findIndex((e) => e.label === state.currentYearLabel);
  if (idx === -1 || idx + 1 >= sorted.length) return null;
  return sorted[idx + 1];
}

export function sumMonths(months: number[] | undefined): number {
  return months ? months.reduce((a, b) => a + b, 0) : 0;
}

export function activeMonthCount(months: number[] | undefined): number {
  return months ? months.filter((m) => m > 0).length : 0;
}
