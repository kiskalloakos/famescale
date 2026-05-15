import { describe, it, expect } from '@jest/globals';
import {
  fv,
  monthsSinceStart,
  computeNetWorth,
  resetStaleCosts,
  goalMonthlyPace,
} from './finance';

describe('fv — future value of lump sum + monthly contributions', () => {
  it('zero rate, no contributions: value is unchanged', () => {
    expect(fv(1000, 0, 0, 12)).toBe(1000);
  });

  it('zero rate, with contributions: plain sum, no growth', () => {
    expect(fv(1000, 100, 0, 12)).toBe(1000 + 100 * 12);
  });

  it('zero months: returns the present value untouched', () => {
    expect(fv(5000, 100, 7, 0)).toBe(5000);
  });

  it('positive rate, lump sum only: compounds monthly', () => {
    // 1000 * (1 + 0.12/12)^12 = 1000 * 1.01^12
    expect(fv(1000, 0, 12, 12)).toBeCloseTo(1126.825, 2);
  });

  it('positive rate, contributions only: standard annuity', () => {
    // 100 * ((1.01^12 - 1) / 0.01)
    expect(fv(0, 100, 12, 12)).toBeCloseTo(1268.25, 2);
  });

  it('positive rate, lump sum + contributions: sums both legs', () => {
    expect(fv(1000, 100, 12, 12)).toBeCloseTo(1126.825 + 1268.25, 2);
  });

  it('negative rate: erodes value (no NaN/throw)', () => {
    const v = fv(1000, 0, -12, 12);
    expect(v).toBeLessThan(1000);
    expect(Number.isFinite(v)).toBe(true);
  });

  it('is monotonically non-decreasing in months at a positive rate', () => {
    let prev = -Infinity;
    for (let m = 0; m <= 120; m += 12) {
      const v = fv(1000, 100, 7, m);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('monthsSinceStart — elapsed months, clamped to >= 1', () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12

  it('current month counts as 1', () => {
    expect(monthsSinceStart(y, m)).toBe(1);
  });

  it('one full year ago is 13 (12 elapsed + inclusive current)', () => {
    expect(monthsSinceStart(y - 1, m)).toBe(13);
  });

  it('a future start is clamped to 1, never zero or negative', () => {
    expect(monthsSinceStart(y + 5, m)).toBe(1);
  });

  it('exactly one month ago is 2', () => {
    // step back one calendar month, handling the January wrap
    const d = new Date(y, now.getMonth() - 1, 1);
    expect(monthsSinceStart(d.getFullYear(), d.getMonth() + 1)).toBe(2);
  });
});

describe('computeNetWorth — roll-up with load-bearing boolean defaults', () => {
  it('null setup: cash + investments − debts, savings excluded by default', () => {
    const r = computeNetWorth(1000, 500, 999, 200, null);
    expect(r.investmentsEnabled).toBe(true);
    expect(r.savingsEnabled).toBe(false); // showSavings defaults OFF
    expect(r.debtsEnabled).toBe(true);
    expect(r.debtsCountInTotal).toBe(true);
    expect(r.investedTotal).toBe(500); // saved (999) NOT counted
    expect(r.netWorth).toBe(1000 + 500 - 200);
  });

  it('savings counted only when showSavings === true', () => {
    expect(computeNetWorth(0, 0, 300, 0, { showSavings: true }).investedTotal).toBe(300);
    expect(computeNetWorth(0, 0, 300, 0, { showSavings: false }).investedTotal).toBe(0);
    expect(computeNetWorth(0, 0, 300, 0, {}).investedTotal).toBe(0); // undefined => off
  });

  it('investments excluded only when showInvestments === false', () => {
    expect(computeNetWorth(0, 400, 0, 0, { showInvestments: false }).investedTotal).toBe(0);
    expect(computeNetWorth(0, 400, 0, 0, { showInvestments: undefined }).investedTotal).toBe(400);
  });

  it('debts dropped from total when the tab is off', () => {
    const r = computeNetWorth(1000, 0, 0, 250, { showDebts: false });
    expect(r.debtsEnabled).toBe(false);
    expect(r.debtsCountInTotal).toBe(false);
    expect(r.netWorth).toBe(1000); // debts not subtracted
  });

  it('debts shown but excluded from total via includeDebtsInNetWorth=false', () => {
    const r = computeNetWorth(1000, 0, 0, 250, { includeDebtsInNetWorth: false });
    expect(r.debtsEnabled).toBe(true); // still rendered
    expect(r.debtsCountInTotal).toBe(false); // but not subtracted
    expect(r.netWorth).toBe(1000);
  });

  it('everything on: cash + investments + savings − debts', () => {
    const r = computeNetWorth(1000, 500, 300, 200, {
      showInvestments: true,
      showSavings: true,
      showDebts: true,
      includeDebtsInNetWorth: true,
    });
    expect(r.netWorth).toBe(1000 + 500 + 300 - 200);
  });

  it('net worth can go negative', () => {
    expect(computeNetWorth(100, 0, 0, 900, null).netWorth).toBe(-800);
  });

  it('assets default to 0 — omitting the arg is unchanged', () => {
    expect(computeNetWorth(1000, 500, 0, 200, null).netWorth).toBe(1300);
  });

  it('assets always add to net worth (no gating)', () => {
    expect(computeNetWorth(1000, 0, 0, 0, null, 50000).netWorth).toBe(51000);
    // counted even when other tabs are off
    expect(
      computeNetWorth(0, 0, 0, 0, { showInvestments: false, showDebts: false }, 250000)
        .netWorth,
    ).toBe(250000);
  });

  it('assets combine with the rest: cash + invested + assets − debts', () => {
    expect(computeNetWorth(1000, 500, 0, 200, null, 30000).netWorth).toBe(
      1000 + 500 + 30000 - 200,
    );
  });
});

describe('resetStaleCosts — monthly un-pay of last month’s costs', () => {
  const mk = (over: Partial<{ id: string; paid: boolean; paidMonth: string | null; paidFromAccountId: string | null; name: string }>) => ({
    id: 'x', name: 'rent', amount: '100', paid: false, paidMonth: null as string | null,
    paidFromAccountId: null as string | null, ...over,
  });

  it('a cost paid in a previous month is cleared and reported', () => {
    const { next, reset } = resetStaleCosts([mk({ paid: true, paidMonth: '2026-04', paidFromAccountId: 'acc1' })], '2026-05');
    expect(reset).toHaveLength(1);
    expect(next[0].paid).toBe(false);
    expect(next[0].paidMonth).toBeNull();
    expect(next[0].paidFromAccountId).toBeNull();
  });

  it('a cost paid in the current month is left untouched', () => {
    const c = mk({ paid: true, paidMonth: '2026-05', paidFromAccountId: 'acc1' });
    const { next, reset } = resetStaleCosts([c], '2026-05');
    expect(reset).toHaveLength(0);
    expect(next[0]).toBe(c); // same reference, unchanged
  });

  it('an unpaid cost is never touched', () => {
    const c = mk({ paid: false, paidMonth: null });
    const { next, reset } = resetStaleCosts([c], '2026-05');
    expect(reset).toHaveLength(0);
    expect(next[0]).toBe(c);
  });

  it('a paid cost with no paidMonth (legacy) is left alone', () => {
    const c = mk({ paid: true, paidMonth: null });
    const { reset } = resetStaleCosts([c], '2026-05');
    expect(reset).toHaveLength(0);
  });

  it('preserves unrelated fields on reset rows', () => {
    const { next } = resetStaleCosts([mk({ id: 'rent7', name: 'Rent', paid: true, paidMonth: '2026-03' })], '2026-05');
    expect(next[0].id).toBe('rent7');
    expect(next[0].name).toBe('Rent');
    expect(next[0].amount).toBe('100');
  });

  it('mixed list: only stale rows reset, order preserved', () => {
    const a = mk({ id: 'a', paid: true, paidMonth: '2026-04' }); // stale
    const b = mk({ id: 'b', paid: true, paidMonth: '2026-05' }); // current
    const c = mk({ id: 'c', paid: false });                       // unpaid
    const { next, reset } = resetStaleCosts([a, b, c], '2026-05');
    expect(reset.map((r) => r.id)).toEqual(['a']);
    expect(next.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(next[1]).toBe(b);
    expect(next[2]).toBe(c);
  });

  it('empty list yields empty result', () => {
    expect(resetStaleCosts([], '2026-05')).toEqual({ next: [], reset: [] });
  });
});

describe('goalMonthlyPace — set-aside per month to hit a target', () => {
  it('splits the remaining amount across the months left', () => {
    expect(goalMonthlyPace(1200, 0, 12)).toBe(100);
    expect(goalMonthlyPace(1000, 400, 6)).toBe(100);
  });

  it('returns 0 once the goal is met or exceeded', () => {
    expect(goalMonthlyPace(1000, 1000, 5)).toBe(0);
    expect(goalMonthlyPace(1000, 1500, 5)).toBe(0);
  });

  it('clamps months to >= 1 (no divide-by-zero on a same-month deadline)', () => {
    expect(goalMonthlyPace(800, 0, 0)).toBe(800);
    expect(goalMonthlyPace(800, 0, -3)).toBe(800);
  });
});
