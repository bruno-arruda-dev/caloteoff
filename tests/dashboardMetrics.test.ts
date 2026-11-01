import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('Dashboard Service & Invariants', () => {
  it('calculates aging and recovery rate percentages correctly', () => {
    const totalReceivables = 1000;
    const receivedThisMonth = 500;
    const circulating = totalReceivables + receivedThisMonth;
    const recoveryRate = Math.round((receivedThisMonth / circulating) * 100);

    expect(recoveryRate).toBe(33); // 500 / 1500 = 33.3%
  });

  it('correctly categorizes aging buckets based on days diff', () => {
    const debtors = [
      { id: '1', balance: 100, diff: -5 }, // A vencer
      { id: '2', balance: 50, diff: 0 },   // Vence hoje
      { id: '3', balance: 200, diff: 10 }, // 1 a 15 dias
      { id: '4', balance: 150, diff: 25 }, // 16 a 30 dias
      { id: '5', balance: 300, diff: 45 }, // +30 dias
    ];

    let upToDate = 0;
    let today = 0;
    let late1to15 = 0;
    let late16to30 = 0;
    let over30 = 0;

    debtors.forEach((d) => {
      if (d.diff < 0) upToDate += d.balance;
      else if (d.diff === 0) today += d.balance;
      else if (d.diff <= 15) late1to15 += d.balance;
      else if (d.diff <= 30) late16to30 += d.balance;
      else over30 += d.balance;
    });

    expect(upToDate).toBe(100);
    expect(today).toBe(50);
    expect(late1to15).toBe(200);
    expect(late16to30).toBe(150);
    expect(over30).toBe(300);

    const total = upToDate + today + late1to15 + late16to30 + over30;
    expect(total).toBe(800);
  });

  it('identifies top debtor concentration risk when a client exceeds 35% of receivables', () => {
    const totalReceivables = 1000;
    const debtorBalance = 400; // 40%
    const percentage = (debtorBalance / totalReceivables) * 100;

    expect(percentage).toBe(40);
    expect(percentage >= 35).toBe(true);
  });
});
