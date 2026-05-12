import { load, save } from './storage';

export interface RevenueEntry {
  label: string; // e.g. "2026" or "2020-2022"
  amount: number;
  months?: number[]; // 12 entries (Jan–Dec) when monthly breakdown is used
}

export function sumMonths(months: number[] | undefined): number {
  return months ? months.reduce((a, b) => a + b, 0) : 0;
}

export function activeMonthCount(months: number[] | undefined): number {
  return months ? months.filter((m) => m > 0).length : 0;
}

export interface RevenueState {
  currentYearLabel: string;
  entries: RevenueEntry[];
}

const NS = 'revenue';

function defaultState(): RevenueState {
  const year = String(new Date().getFullYear());
  return { currentYearLabel: year, entries: [{ label: year, amount: 0 }] };
}

export async function getRevenue(): Promise<RevenueState> {
  const state = await load<RevenueState>(NS, defaultState());
  if (!state.entries.some((e) => e.label === state.currentYearLabel)) {
    state.entries.push({ label: state.currentYearLabel, amount: 0 });
  }
  return state;
}

export async function saveRevenue(state: RevenueState): Promise<void> {
  await save(NS, state);
}

// Returns entries sorted newest first (by label string descending).
export function sortEntries(entries: RevenueEntry[]): RevenueEntry[] {
  return [...entries].sort((a, b) => b.label.localeCompare(a.label));
}

export function allTimeTotal(entries: RevenueEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

// Returns the entry immediately preceding the current year chronologically,
// or null if none exists. Used for year-over-year growth.
export function previousEntry(state: RevenueState): RevenueEntry | null {
  const sorted = sortEntries(state.entries);
  const idx = sorted.findIndex((e) => e.label === state.currentYearLabel);
  if (idx === -1 || idx + 1 >= sorted.length) return null;
  return sorted[idx + 1];
}
