// Pure money math. No React Native / Supabase imports on purpose: this stays
// trivially unit-testable and is the single source of truth for the growth
// projection used by both the Investments and Savings screens.

// Months elapsed from a start (year, month) up to and including the current
// calendar month. Always >= 1 so a brand-new plan still divides cleanly.
export function monthsSinceStart(year: number, month: number): number {
  const now = new Date();
  const diff = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month) + 1;
  return Math.max(1, diff);
}

// Future value of a present sum `pv` plus a fixed monthly contribution `pmt`,
// compounded monthly at `annualRate` percent, after `months` months.
// Standard annuity formula; the r === 0 branch avoids a divide-by-zero and
// returns the plain (no-growth) sum.
export function fv(pv: number, pmt: number, annualRate: number, months: number): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return pv + pmt * months;
  return pv * Math.pow(1 + r, months) + pmt * ((Math.pow(1 + r, months) - 1) / r);
}

// Net-worth roll-up. The boolean defaults are deliberate and load-bearing:
// investments/debts default ON when the flag is undefined (`!== false`),
// savings defaults OFF (`=== true`). A null setup (not yet loaded) therefore
// counts cash + investments − debts. Returns the full breakdown so the screen
// has a single source of truth for both the number and row visibility.
export interface NetWorthSetup {
  showInvestments?: boolean;
  showSavings?: boolean;
  showDebts?: boolean;
  includeDebtsInNetWorth?: boolean;
}
export interface NetWorthBreakdown {
  investmentsEnabled: boolean;
  savingsEnabled: boolean;
  debtsEnabled: boolean;
  debtsCountInTotal: boolean;
  investedTotal: number;
  netWorth: number;
}
// `assets` (manually-tracked house/car/valuables) always counts toward net
// worth — no gating. Defaulted/last so existing call sites stay valid.
export function computeNetWorth(
  cash: number,
  invested: number,
  saved: number,
  debts: number,
  setup: NetWorthSetup | null,
  assets = 0,
): NetWorthBreakdown {
  const investmentsEnabled = setup?.showInvestments !== false;
  const savingsEnabled = setup?.showSavings === true;
  const debtsEnabled = setup?.showDebts !== false;
  const debtsCountInTotal = debtsEnabled && setup?.includeDebtsInNetWorth !== false;
  const investedTotal = (investmentsEnabled ? invested : 0) + (savingsEnabled ? saved : 0);
  const netWorth = cash + investedTotal + assets - (debtsCountInTotal ? debts : 0);
  return { investmentsEnabled, savingsEnabled, debtsEnabled, debtsCountInTotal, investedTotal, netWorth };
}

// Monthly cost auto-reset. A cost that was marked paid in a *previous* month
// is un-paid for the new month (the past payment stays deducted — no refund).
// Pure: returns the rebuilt list plus the subset that changed, so the caller
// owns the side effects (persist + toast). Generic so the caller keeps its
// full Cost type; only the fields this clears are constrained.
export interface ResettableCost {
  paid: boolean;
  paidFromAccountId?: string | null;
  paidMonth?: string | null;
}
export function resetStaleCosts<T extends ResettableCost>(
  costs: T[],
  currentMonth: string,
): { next: T[]; reset: T[] } {
  const reset: T[] = [];
  const next = costs.map((c) => {
    if (c.paid && c.paidMonth && c.paidMonth !== currentMonth) {
      const cleared = { ...c, paid: false, paidFromAccountId: null, paidMonth: null };
      reset.push(cleared);
      return cleared;
    }
    return c;
  });
  return { next, reset };
}
