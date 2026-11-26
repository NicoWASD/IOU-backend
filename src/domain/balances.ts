// Balances y liquidación (spec 4.1 y 4.4). Funciones puras, en centavos.
import type { Money, UsuarioRef } from './grupo.js';

export type Balance = { usuario: UsuarioRef; balance: Money };
export type Transferencia = { de: UsuarioRef; a: UsuarioRef; monto: Money };

export type Pago = {
  id: string;
  de: UsuarioRef;
  a: UsuarioRef;
  monto: Money;
  fecha: string;
  creadoPor: UsuarioRef;
  puedeEliminar: boolean;
};

/** Sumas por usuario en un grupo, en centavos. */
export type Aportes = {
  pagado: Map<string, number>; // gastos que pagó
  consumido: Map<string, number>; // sus participaciones
  enviado: Map<string, number>; // pagos que hizo
  recibido: Map<string, number>; // pagos que recibió
};

/** balance(u) = pagado − consumido + enviado − recibido. La suma de todos da 0. */
export function calcularBalances(a: Aportes): Map<string, number> {
  const out = new Map<string, number>();
  const sumar = (m: Map<string, number>, signo: 1 | -1) => {
    for (const [id, c] of m) out.set(id, (out.get(id) ?? 0) + signo * c);
  };
  sumar(a.pagado, 1);
  sumar(a.consumido, -1);
  sumar(a.enviado, 1);
  sumar(a.recibido, -1);
  return out;
}

/** Greedy de la spec 4.4: el mayor deudor le paga al mayor acreedor. Como máximo n − 1 transferencias. */
export function liquidar(
  balances: Map<string, number>,
): { de: string; a: string; monto: number }[] {
  const porMonto = (x: [string, number], y: [string, number]) =>
    y[1] - x[1] || (x[0] < y[0] ? -1 : 1);
  const deudores = [...balances]
    .filter(([, b]) => b < 0)
    .map(([id, b]): [string, number] => [id, -b]);
  const acreedores = [...balances].filter(([, b]) => b > 0);
  const out: { de: string; a: string; monto: number }[] = [];
  while (deudores.length > 0 && acreedores.length > 0) {
    deudores.sort(porMonto);
    acreedores.sort(porMonto);
    const d = deudores[0] as [string, number];
    const c = acreedores[0] as [string, number];
    const monto = Math.min(d[1], c[1]);
    out.push({ de: d[0], a: c[0], monto });
    d[1] -= monto;
    c[1] -= monto;
    if (d[1] === 0) deudores.shift();
    if (c[1] === 0) acreedores.shift();
  }
  return out;
}

export type PagoRow = {
  id: string;
  grupoId: string;
  de: UsuarioRef;
  a: UsuarioRef;
  montoCentavos: number;
  fecha: string;
  creadoPor: UsuarioRef;
};

export interface BalanceRepository {
  aportes(grupoId: string): Promise<Aportes>;
}

export interface PagoRepository {
  /** Por `fecha` desc y después `createdAt` desc. */
  listar(grupoId: string): Promise<PagoRow[]>;
  buscar(grupoId: string, pagoId: string): Promise<PagoRow | null>;
  crear(
    grupoId: string,
    creadoPorId: string,
    d: { deId: string; aId: string; montoCentavos: number; fecha: string },
  ): Promise<PagoRow>;
  eliminar(pagoId: string): Promise<void>;
}
