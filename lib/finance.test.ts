import { describe, it, expect } from '@jest/globals';
import { fv, monthsSinceStart } from './finance';

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
