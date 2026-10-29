import { DebitEntry, LimitPolicy, PaymentType } from '../types';

export interface BalanceResult {
  currentBalance: number; // >0 devedor, ==0 zerado, <0 credor
  status: 'debtor' | 'zero' | 'creditor';
  totalPendingDebits: number;
  creditBalance: number;
}

export function calculateClientBalance(
  pendingDebits: { amount: number }[],
  creditBalance: number = 0
): BalanceResult {
  const totalPending = pendingDebits.reduce((acc, d) => acc + (d.amount || 0), 0);
  const currentBalance = totalPending - creditBalance;

  let status: 'debtor' | 'zero' | 'creditor' = 'zero';
  if (currentBalance > 0.001) {
    status = 'debtor';
  } else if (currentBalance < -0.001) {
    status = 'creditor';
  }

  return {
    currentBalance: Math.round(currentBalance * 100) / 100,
    status,
    totalPendingDebits: totalPending,
    creditBalance,
  };
}

export interface LimitCheckResult {
  allowed: boolean;
  needsWarning: boolean;
  isExceeded: boolean;
  exceededAmount: number;
  usagePercent: number;
  projectedBalance: number;
}

export function checkCreditLimit(
  currentBalance: number,
  newDebitAmount: number,
  creditLimit: number | null,
  policy: LimitPolicy = 'AVISAR_E_PERMITIR'
): LimitCheckResult {
  const projected = Math.max(0, currentBalance) + newDebitAmount;

  if (creditLimit === null || creditLimit === undefined || creditLimit <= 0) {
    return {
      allowed: true,
      needsWarning: false,
      isExceeded: false,
      exceededAmount: 0,
      usagePercent: 0,
      projectedBalance: projected,
    };
  }

  const usagePercent = Math.round((projected / creditLimit) * 100);
  const isExceeded = projected > creditLimit;
  const exceededAmount = isExceeded ? Math.round((projected - creditLimit) * 100) / 100 : 0;

  if (isExceeded) {
    if (policy === 'BLOQUEAR_TOTAL') {
      return {
        allowed: false,
        needsWarning: true,
        isExceeded: true,
        exceededAmount,
        usagePercent,
        projectedBalance: projected,
      };
    } else {
      // AVISAR_E_PERMITIR
      return {
        allowed: true,
        needsWarning: true,
        isExceeded: true,
        exceededAmount,
        usagePercent,
        projectedBalance: projected,
      };
    }
  }

  return {
    allowed: true,
    needsWarning: false,
    isExceeded: false,
    exceededAmount: 0,
    usagePercent,
    projectedBalance: projected,
  };
}

export function getLimitUsageProgress(
  currentBalance: number,
  creditLimit: number | null
): { percent: number; colorType: 'green' | 'yellow' | 'red' } | null {
  if (creditLimit === null || creditLimit === undefined || creditLimit <= 0) {
    return null;
  }

  const positiveDebt = Math.max(0, currentBalance);
  const percent = Math.round((positiveDebt / creditLimit) * 100);

  let colorType: 'green' | 'yellow' | 'red' = 'green';
  if (percent >= 100) {
    colorType = 'red';
  } else if (percent >= 80) {
    colorType = 'yellow';
  }

  return {
    percent,
    colorType,
  };
}

export interface SettlementResult {
  resultingBalance: number; // 0 para quitação total, >0 para parcial, <0 para excedente
  newCreditBalance: number;
  paymentType: PaymentType;
}

export function calculateSettlement(
  debtAmount: number,
  paymentAmount: number
): SettlementResult {
  const diff = Math.round((debtAmount - paymentAmount) * 100) / 100;

  if (Math.abs(diff) < 0.009) {
    return {
      resultingBalance: 0,
      newCreditBalance: 0,
      paymentType: 'FULL',
    };
  } else if (diff > 0) {
    return {
      resultingBalance: diff,
      newCreditBalance: 0,
      paymentType: 'PARTIAL',
    };
  } else {
    // diff < 0 (pagou mais do que devia)
    const excess = Math.abs(diff);
    return {
      resultingBalance: -excess,
      newCreditBalance: excess,
      paymentType: 'EXCESS',
    };
  }
}
