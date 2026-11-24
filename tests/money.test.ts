import { describe, expect, it } from 'vitest';
import { centsToMoney, formatARS } from '../src/lib/money.js';

describe('centsToMoney', () => {
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [-1, '-0.01'],
    [-10000, '-100.00'],
    [1250050, '12500.50'],
    [999999999, '9999999.99'],
  ])('%i centavos → "%s"', (cents, money) => {
    expect(centsToMoney(cents)).toBe(money);
  });

  it('rechaza lo que no es un entero de centavos', () => {
    expect(() => centsToMoney(1.5)).toThrow();
    expect(() => centsToMoney(Number.NaN)).toThrow();
  });
});

describe('formatARS', () => {
  it.each([
    [1, '$ 0,01'],
    [-1, '-$ 0,01'],
    [123456, '$ 1.234,56'],
    [1250050, '$ 12.500,50'],
    [100000000, '$ 1.000.000,00'],
  ])('%i centavos → "%s"', (cents, texto) => {
    expect(formatARS(cents)).toBe(texto);
  });
});
