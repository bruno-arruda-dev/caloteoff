import { describe, it, expect } from 'vitest';
import {
  formatDateBR,
  getTodayISO,
  getDaysInMonth,
  addMonthsPreservingDay,
  addDaysToISO,
} from '../src/utils/date';

describe('Date Utilities & Calculations', () => {
  it('formats ISO to Brazilian format DD/MM/YYYY', () => {
    expect(formatDateBR('2026-10-30')).toBe('30/10/2026');
    expect(formatDateBR('2026-01-05')).toBe('05/01/2026');
  });

  it('calculates days in month correctly including leap years', () => {
    expect(getDaysInMonth(2026, 1)).toBe(31); // Jan
    expect(getDaysInMonth(2026, 2)).toBe(28); // Feb 2026 non-leap
    expect(getDaysInMonth(2028, 2)).toBe(29); // Feb 2028 leap year
  });

  it('adds and subtracts days correctly', () => {
    expect(addDaysToISO('2026-10-30', 1)).toBe('2026-10-31');
    expect(addDaysToISO('2026-10-30', 2)).toBe('2026-11-01');
    expect(addDaysToISO('2026-10-30', -1)).toBe('2026-10-29');
  });

  it('adds months preserving original day and clamping to month end', () => {
    // 31 de Janeiro + 1 mês -> 28 de Fevereiro (em 2026)
    const res1 = addMonthsPreservingDay(2026, 1, 1, 31);
    expect(res1.dateISO).toBe('2026-02-28');

    // 15 de Outubro + 1 mês -> 15 de Novembro
    const res2 = addMonthsPreservingDay(2026, 10, 1, 15);
    expect(res2.dateISO).toBe('2026-11-15');

    // 15 de Outubro - 1 mês -> 15 de Setembro
    const res3 = addMonthsPreservingDay(2026, 10, -1, 15);
    expect(res3.dateISO).toBe('2026-09-15');
  });
});
