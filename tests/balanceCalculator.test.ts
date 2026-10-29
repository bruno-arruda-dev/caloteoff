import { describe, it, expect } from 'vitest';
import {
  calculateClientBalance,
  checkCreditLimit,
  calculateSettlement,
  getLimitUsageProgress,
} from '../src/utils/balanceCalculator';

describe('Balance Calculator & Accounting Rules', () => {
  it('calculates positive balance (debtor) when debits exceed credit', () => {
    const debits = [{ amount: 50 }, { amount: 30.5 }, { amount: 20 }];
    const credit = 0;
    const res = calculateClientBalance(debits, credit);

    expect(res.currentBalance).toBe(100.5);
    expect(res.status).toBe('debtor');
    expect(res.totalPendingDebits).toBe(100.5);
  });

  it('calculates zero balance when debits equals credit', () => {
    const debits = [{ amount: 50 }];
    const credit = 50;
    const res = calculateClientBalance(debits, credit);

    expect(res.currentBalance).toBe(0);
    expect(res.status).toBe('zero');
  });

  it('calculates negative balance (creditor / a favor) when credit exceeds debits', () => {
    const debits = [{ amount: 20 }];
    const credit = 50;
    const res = calculateClientBalance(debits, credit);

    expect(res.currentBalance).toBe(-30);
    expect(res.status).toBe('creditor');
  });

  describe('Credit Limit Check & Policies', () => {
    it('allows debit when under limit', () => {
      const res = checkCreditLimit(100, 50, 200, 'BLOQUEAR_TOTAL');
      expect(res.allowed).toBe(true);
      expect(res.isExceeded).toBe(false);
      expect(res.projectedBalance).toBe(150);
      expect(res.usagePercent).toBe(75);
    });

    it('blocks debit when exceeding limit under BLOQUEAR_TOTAL', () => {
      const res = checkCreditLimit(150, 60, 200, 'BLOQUEAR_TOTAL');
      expect(res.allowed).toBe(false);
      expect(res.isExceeded).toBe(true);
      expect(res.exceededAmount).toBe(10);
      expect(res.projectedBalance).toBe(210);
    });

    it('allows debit with warning when exceeding limit under AVISAR_E_PERMITIR', () => {
      const res = checkCreditLimit(150, 60, 200, 'AVISAR_E_PERMITIR');
      expect(res.allowed).toBe(true);
      expect(res.needsWarning).toBe(true);
      expect(res.isExceeded).toBe(true);
      expect(res.exceededAmount).toBe(10);
    });
  });

  describe('Settlement Calculation ("Passar a Régua")', () => {
    it('handles Full Settlement (Valor Pago = Dívida)', () => {
      const res = calculateSettlement(150, 150);
      expect(res.paymentType).toBe('FULL');
      expect(res.resultingBalance).toBe(0);
      expect(res.newCreditBalance).toBe(0);
    });

    it('handles Partial Abatement (Valor Pago < Dívida)', () => {
      const res = calculateSettlement(150, 50);
      expect(res.paymentType).toBe('PARTIAL');
      expect(res.resultingBalance).toBe(100);
      expect(res.newCreditBalance).toBe(0);
    });

    it('handles Excess Payment / Troco (Valor Pago > Dívida)', () => {
      const res = calculateSettlement(150, 200);
      expect(res.paymentType).toBe('EXCESS');
      expect(res.resultingBalance).toBe(-50);
      expect(res.newCreditBalance).toBe(50);
    });
  });

  describe('Limit Usage Progress Gauge', () => {
    it('returns green color type when usage < 80%', () => {
      const res = getLimitUsageProgress(70, 100);
      expect(res).not.toBeNull();
      expect(res?.percent).toBe(70);
      expect(res?.colorType).toBe('green');
    });

    it('returns yellow color type when usage between 80% and 99%', () => {
      const res = getLimitUsageProgress(85, 100);
      expect(res).not.toBeNull();
      expect(res?.percent).toBe(85);
      expect(res?.colorType).toBe('yellow');
    });

    it('returns red color type when usage >= 100%', () => {
      const res = getLimitUsageProgress(120, 100);
      expect(res).not.toBeNull();
      expect(res?.percent).toBe(120);
      expect(res?.colorType).toBe('red');
    });
  });
});
