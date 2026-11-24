// Reparto de un gasto en centavos (spec 4.2 y 4.3). Funciones puras: la suma siempre da el total.

/** Tope de RN-01: $99.999.999,99. */
export const MONTO_MAXIMO_CENTAVOS = 9_999_999_999;

/** `"12.5"` o `"12.50"` → 1250. `null` si no es un monto no negativo con hasta 2 decimales. */
export function parseMoney(s: string): number | null {
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** `"33.33"` → 3333 centésimos de punto. `null` si no tiene el formato. */
export function parsePorcentaje(s: string): number | null {
  const m = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** 3333 → `"33.33"`. */
export const formatPorcentaje = (c: number) =>
  `${Math.trunc(c / 100)}.${String(c % 100).padStart(2, '0')}`;

const porId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Reparte los centavos que sobran de a 1, a los primeros ids en orden ascendente. */
function repartirResto(total: number, base: Map<string, number>): Map<string, number> {
  let resto = total - [...base.values()].reduce((a, b) => a + b, 0);
  for (const id of [...base.keys()].sort(porId)) {
    if (resto <= 0) break;
    base.set(id, (base.get(id) ?? 0) + 1);
    resto--;
  }
  return base;
}

/** Spec 4.2: `floor(total / n)` a cada uno y el resto a los primeros ids. */
export function splitEqual(total: number, ids: string[]): Map<string, number> {
  const base = Math.floor(total / ids.length);
  return repartirResto(total, new Map(ids.map((id) => [id, base])));
}

/** Spec 4.3: `floor(total × % / 100)` a cada uno y el resto como en 4.2. `pct` en centésimos (100 % = 10000). */
export function splitPct(total: number, items: { id: string; pct: number }[]): Map<string, number> {
  return repartirResto(
    total,
    new Map(items.map(({ id, pct }) => [id, Math.floor((total * pct) / 10000)])),
  );
}
