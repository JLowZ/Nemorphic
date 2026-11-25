/**
 * Las personas de una reserva: el titular y sus acompañantes, cada una con su
 * propio ingreso y su propio pago (migración 0011).
 *
 * Una reserva de grupo tiene UN código, pero el grupo no siempre llega junto: en
 * La Nocturna llegaron grupos partidos (2 y luego 2). Por eso se marca persona a
 * persona. Este módulo no habla con la base: solo da forma y hace cuentas, y lo
 * usan por igual la puerta, el panel y el servidor.
 */

export type Origen = "admin" | "door";

export type PersonaReserva = {
  /** 0 = titular; 1, 2… = acompañantes en el orden en que se escribieron. */
  posicion: number;
  nombre: string;
  entro: boolean;
  pagado: boolean;
  /** Desde dónde se marcó el pago, para cuadrar caja. */
  pagadoPor: Origen | null;
};

/** Fila mínima del titular, tal como sale de `reservations`. */
type FilaTitular = {
  holder_name: string;
  paid: boolean;
  paid_by: string | null;
  checked_in_at: string | null;
};

/** Fila mínima de un acompañante, tal como sale de `reservation_guests`. */
export type FilaAcompanante = {
  reservation_id: string;
  name: string;
  position: number;
  paid: boolean;
  paid_by: string | null;
  checked_in_at: string | null;
};

function origen(valor: string | null): Origen | null {
  return valor === "admin" || valor === "door" ? valor : null;
}

/** Titular primero y luego los acompañantes por posición. */
export function armarPersonas(
  titular: FilaTitular,
  acompanantes: ReadonlyArray<FilaAcompanante>,
): Array<PersonaReserva> {
  return [
    {
      posicion: 0,
      nombre: titular.holder_name,
      entro: titular.checked_in_at !== null,
      pagado: titular.paid,
      pagadoPor: origen(titular.paid_by),
    },
    ...[...acompanantes]
      .sort((a, b) => a.position - b.position)
      .map((g) => ({
        posicion: g.position,
        nombre: g.name,
        entro: g.checked_in_at !== null,
        pagado: g.paid,
        pagadoPor: origen(g.paid_by),
      })),
  ];
}

/** Agrupa los acompañantes por reserva, para no recorrer la lista una vez por reserva. */
export function acompanantesPorReserva(
  filas: ReadonlyArray<FilaAcompanante>,
): Map<string, Array<FilaAcompanante>> {
  const mapa = new Map<string, Array<FilaAcompanante>>();
  for (const fila of filas) {
    const lista = mapa.get(fila.reservation_id) ?? [];
    lista.push(fila);
    mapa.set(fila.reservation_id, lista);
  }
  return mapa;
}

export type ResumenPersonas = {
  total: number;
  dentro: number;
  pagaron: number;
  /** Lo que falta cobrar, en pesos. Null si el evento no tiene precio. */
  debe: number | null;
  /** Lo ya cobrado, en pesos. Null si el evento no tiene precio. */
  cobrado: number | null;
};

export function resumirPersonas(
  personas: ReadonlyArray<PersonaReserva>,
  precio: number | null,
): ResumenPersonas {
  const dentro = personas.filter((p) => p.entro).length;
  const pagaron = personas.filter((p) => p.pagado).length;
  const sinPagar = personas.length - pagaron;
  return {
    total: personas.length,
    dentro,
    pagaron,
    debe: precio === null ? null : precio * sinPagar,
    cobrado: precio === null ? null : precio * pagaron,
  };
}
