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
