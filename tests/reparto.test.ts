import { describe, expect, it } from 'vitest';
import { parseMoney, parsePorcentaje, splitEqual, splitPct } from '../src/domain/reparto.js';

const suma = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('splitEqual (spec 4.2)', () => {
  it.each([
    [10000, ['c', 'a', 'b'], { a: 3334, b: 3333, c: 3333 }], // CB-01
    [1, ['a', 'b', 'c'], { a: 1, b: 0, c: 0 }], // CB-02
    [30000, ['a', 'b', 'c'], { a: 10000, b: 10000, c: 10000 }], // CA-12.1
  ])('%i entre %j', (total, ids, esperado) => {
    expect(Object.fromEntries(splitEqual(total, ids))).toEqual(esperado);
  });

  it('la suma siempre da el total', () => {
    for (let total = 1; total < 2000; total += 7)
      for (let n = 1; n <= 7; n++)
        expect(
          suma(
            splitEqual(
              total,
              Array.from({ length: n }, (_, i) => `u${i}`),
            ),
          ),
        ).toBe(total);
  });
});

describe('splitPct (spec 4.3)', () => {
  it('60/40 sobre $1000 (CA-14.1)', () => {
    const r = splitPct(100000, [
      { id: 'a', pct: 6000 },
      { id: 'b', pct: 4000 },
    ]);
    expect(Object.fromEntries(r)).toEqual({ a: 60000, b: 40000 });
  });

  it('33,33/33,33/33,34 sobre $0,10 suma exacto (CA-14.3)', () => {
    const r = splitPct(10, [
      { id: 'a', pct: 3333 },
      { id: 'b', pct: 3333 },
      { id: 'c', pct: 3334 },
    ]);
    expect(suma(r)).toBe(10);
  });
});

describe('parseo', () => {
  it.each([
    ['12.5', 1250],
    ['12.50', 1250],
    ['0.01', 1],
    ['10.555', null],
    ['-1', null],
    ['1e3', null],
  ])('parseMoney(%s)', (s, c) => {
    expect(parseMoney(s)).toBe(c);
  });

  it.each([
    ['60', 6000],
    ['33.33', 3333],
    ['33.333', null],
  ])('parsePorcentaje(%s)', (s, c) => {
    expect(parsePorcentaje(s)).toBe(c);
  });
});
