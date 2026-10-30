import { describe, it, expect } from 'vitest';
import { maskClientName } from '../src/utils/privacy';
import {
  calculateNextBillingDate,
  formatDateBR,
  getDaysDiffFromToday,
  getTodayISO,
} from '../src/utils/date';

describe('Privacy Masking Logic', () => {
  it('masks client name with prefix, middle asterisks and suffix', () => {
    const masked = maskClientName('Bruno Guimarães', 'masked');
    expect(masked.startsWith('Bru')).toBe(true);
    expect(masked.endsWith('ães')).toBe(true);
    expect(masked).toContain('****');
  });

  it('hides completely when maskType is hidden', () => {
    const hidden = maskClientName('Bruno Guimarães', 'hidden');
    expect(hidden).toBe('••••••••••');
  });

  it('handles short names gracefully', () => {
    const shortMasked = maskClientName('Ana', 'masked');
    expect(shortMasked).toBe('A***a');
  });
});

describe('Date & Billing Cycle Logic', () => {
  it('formats ISO date to Brazilian format DD/MM/YYYY', () => {
    expect(formatDateBR('2026-10-29')).toBe('29/10/2026');
  });

  it('calculates monthly billing date for later day in current month', () => {
    const next = calculateNextBillingDate('MONTHLY', 20, '2026-10-05');
    expect(next).toBe('2026-10-20');
  });

  it('calculates monthly billing date for next month when day already passed', () => {
    const next = calculateNextBillingDate('MONTHLY', 10, '2026-10-15');
    expect(next).toBe('2026-11-10');
  });

  it('clamps monthly billing date on months with fewer days', () => {
    const next = calculateNextBillingDate('MONTHLY', 31, '2026-01-31');
    expect(next).toBe('2026-02-28');
  });

  it('calculates overdue days diff from today', () => {
    const today = getTodayISO();
    expect(getDaysDiffFromToday(today)).toBe(0);
  });
});
