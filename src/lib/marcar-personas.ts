import { getSupabaseAdmin } from "@/lib/supabase";
import type { Origen } from "@/lib/personas-reserva";

/**
 * Marcar ingreso o pago de personas concretas de una reserva (migración 0011).
 *
 * Solo servidor: se importa con `await import()` desde el handler de una server
 * function, que ya ha pasado por su guarda (`requireDoorOrAdmin` o `requireAdmin`).
 *
 * El titular (posición 0) vive en `reservations`; cada acompañante (1, 2…) en
 * `reservation_guests`. Tras marcar ingresos se recalcula el estado de la reserva.
 */

export type Resultado = { ok: true } | { ok: false; message: string };

const AHORA = () => new Date().toISOString();

function columnas(campo: "ingreso" | "pago", valor: boolean, origen: Origen) {
  if (campo === "ingreso") {
    return valor
      ? { checked_in_at: AHORA(), checked_in_by: origen }
      : { checked_in_at: null, checked_in_by: null };
  }
  return valor
    ? { paid: true, paid_at: AHORA(), paid_by: origen }
    : { paid: false, paid_at: null, paid_by: null };
}

/**
 * `status` es un resumen del grupo: 'checked_in' cuando entraron todos, 'confirmed'
 * mientras falte alguien. Una reserva cancelada no se toca.
 */
export async function sincronizarEstado(reservaId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { data: reserva } = await supabase
    .from("reservations")
    .select("status, checked_in_at")
    .eq("id", reservaId)
    .maybeSingle();
  if (!reserva || reserva.status === "cancelled") return;

  const { data: acompanantes } = await supabase
    .from("reservation_guests")
    .select("checked_in_at")
    .eq("reservation_id", reservaId);

  const todos =
    reserva.checked_in_at !== null &&
    (acompanantes ?? []).every((g: { checked_in_at: string | null }) => g.checked_in_at !== null);
  const status = todos ? "checked_in" : "confirmed";

  if (status !== reserva.status) {
    await supabase.from("reservations").update({ status }).eq("id", reservaId);
  }
}

export async function marcarPersonas({
  reservaId,
  personas,
  campo,
  valor,
  origen,
}: {
  reservaId: string;
  /** 0 = titular; 1, 2… = acompañantes. */
  personas: ReadonlyArray<number>;
  campo: "ingreso" | "pago";
  valor: boolean;
  origen: Origen;
}): Promise<Resultado> {
  const supabase = getSupabaseAdmin();

  const { data: reserva, error: lecturaError } = await supabase
    .from("reservations")
    .select("status, tickets")
    .eq("id", reservaId)
    .maybeSingle();

  if (lecturaError || !reserva) {
    return { ok: false, message: "Esa reserva no existe." };
  }
  if (campo === "ingreso" && valor && reserva.status === "cancelled") {
    return { ok: false, message: "Esa reserva está cancelada. No debe entrar." };
  }

  const unicas = [...new Set(personas)];
  if (unicas.some((p) => p >= reserva.tickets)) {
    return { ok: false, message: "Esa persona no está en la reserva. Recarga la lista." };
  }

  const cambios = columnas(campo, valor, origen);

  if (unicas.includes(0)) {
    const { error } = await supabase.from("reservations").update(cambios).eq("id", reservaId);
    if (error) {
      console.error(`marcarPersonas (${campo}, titular):`, error);
      return { ok: false, message: "No se pudo guardar. Intenta de nuevo." };
    }
  }

  const acompanantes = unicas.filter((p) => p > 0);
  if (acompanantes.length > 0) {
    const { error } = await supabase
      .from("reservation_guests")
      .update(cambios)
      .eq("reservation_id", reservaId)
      .in("position", acompanantes);
    if (error) {
      console.error(`marcarPersonas (${campo}, acompañantes):`, error);
      return { ok: false, message: "No se pudo guardar. Intenta de nuevo." };
    }
  }

  if (campo === "ingreso") await sincronizarEstado(reservaId);

  return { ok: true };
}
