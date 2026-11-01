import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  parseDigitsToCents,
  centsToDecimalString,
  formatCurrencyInput,
  parseCurrencyInput,
} from '../src/utils/currency';

describe('Currency Form Input Formatting & Masking (Minhas Finanças pattern)', () => {
  it('formats raw numeric values with BRL currency symbol', () => {
    const formatted = formatCurrency(150.5);
    expect(formatted).toContain('150,50');
    expect(formatted).toContain('R$');
  });

  it('correctly extracts digits to cents', () => {
    expect(parseDigitsToCents('')).toBe(0);
    expect(parseDigitsToCents('0')).toBe(0);
    expect(parseDigitsToCents('1')).toBe(1);
    expect(parseDigitsToCents('15')).toBe(15);
    expect(parseDigitsToCents('1500')).toBe(1500);
    expect(parseDigitsToCents('R$ 1.250,50')).toBe(125050);
  });

  it('converts cents to decimal string with thousands separator', () => {
    expect(centsToDecimalString(0)).toBe('0,00');
    expect(centsToDecimalString(5)).toBe('0,05');
    expect(centsToDecimalString(50)).toBe('0,50');
    expect(centsToDecimalString(500)).toBe('5,00');
    expect(centsToDecimalString(5000)).toBe('50,00');
    expect(centsToDecimalString(125050)).toBe('1.250,50');
  });

  it('shifts digits dynamically as the user types numbers in currency fields', () => {
    // Typing sequence for R$ 10,05
    let current = '';
    current = formatCurrencyInput('1');
    expect(current).toBe('0,01');

    current = formatCurrencyInput('0,010'); // user typed '0'
    expect(current).toBe('0,10');

    current = formatCurrencyInput('0,100'); // user typed '0'
    expect(current).toBe('1,00');

    current = formatCurrencyInput('1,005'); // user typed '5'
    expect(current).toBe('10,05');

    // And now typing thousands
    current = formatCurrencyInput('10,050');
    expect(current).toBe('100,50');

    current = formatCurrencyInput('100,500');
    expect(current).toBe('1.005,00');
  });

  it('re-shifts digits backwards when the user presses backspace', () => {
    // Backspacing from '1.005,00'
    let current = formatCurrencyInput('1.005,0');
    expect(current).toBe('100,50');

    current = formatCurrencyInput('100,5');
    expect(current).toBe('10,05');

    current = formatCurrencyInput('10,0');
    expect(current).toBe('1,00');

    current = formatCurrencyInput('1,0');
    expect(current).toBe('0,10');

    current = formatCurrencyInput('0,1');
    expect(current).toBe('0,01');

    current = formatCurrencyInput('');
    expect(current).toBe('');
  });

  it('parses formatted currency strings back to numeric values accurately', () => {
    expect(parseCurrencyInput('')).toBe(0);
    expect(parseCurrencyInput('0,05')).toBe(0.05);
    expect(parseCurrencyInput('0,50')).toBe(0.5);
    expect(parseCurrencyInput('10,05')).toBe(10.05);
    expect(parseCurrencyInput('1.005,00')).toBe(1005);
    expect(parseCurrencyInput('1.250,50')).toBe(1250.5);
  });
});
