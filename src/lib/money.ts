import type { Money } from '../domain/grupo.js';

/** Centavos enteros → string decimal con 2 decimales (`-10000` → `"-100.00"`). */
export function centsToMoney(cents: number): Money {
  if (!Number.isSafeInteger(cents)) {
    throw new TypeError(`Monto en centavos inválido: ${cents}`);
  }
  const signo = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${signo}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Centavos → texto para mensajes, con el formato de pesos argentinos (`123456` → `"$ 1.234,56"`). */
export function formatARS(cents: number): string {
  const [entero = '0', decimales = '00'] = centsToMoney(Math.abs(cents)).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}$ ${miles},${decimales}`;
}
