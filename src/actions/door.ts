import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireDoorOrAdmin } from "@/lib/require-admin";
import { loginSchema } from "@/schemas/admin";

/** Lo que ve quien atiende la entrada. Sin ids internos ni datos de más. */
export type ReservaPuerta = {
  id: string;
  code: string;
  holderName: string;
  tickets: number;
  guests: Array<string>;
  status: "confirmed" | "cancelled" | "checked_in";
  paid: boolean;
  /** Lo que debe si no ha pagado, en pesos. Null si el evento no tiene precio. */
  totalAPagar: number | null;
};

export type EventoPuerta = {
  slug: string;
  name: string;
  startsAt: string;
  presalePrice: number | null;
  doorPrice: number | null;
  reservas: Array<ReservaPuerta>;
};

const FAILURE_DELAY_MS = 600;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const doorLogin = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; message: string }> => {
    const auth = await import("@/lib/auth");

    const bloqueado = await auth.getLoginBlockSeconds("door");
    if (bloqueado > 0) {
      const minutos = Math.ceil(bloqueado / 60);
      return {
        ok: false,
        message: `Demasiados intentos. Espera ${minutos} minuto${minutos === 1 ? "" : "s"}.`,
      };
    }

    if (!(await auth.doorPasswordIsSet())) {
      return {
        ok: false,
        message: "El acceso de puerta no está activado. Pídeselo al equipo de Nemorphic.",
      };
    }

    if (!(await auth.verifyDoorPassword(data.password))) {
      await auth.registerFailedLogin("door");
      await esperar(FAILURE_DELAY_MS);
      return { ok: false, message: "Clave incorrecta." };
    }

    await auth.clearFailedLogins("door");
    await auth.trustCurrentDevice("door");
    await auth.startSession("door");
    return { ok: true };
  });

export const doorLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { endSession } = await import("@/lib/auth");
  await endSession("door");
  return { ok: true as const };
});

export const getDoorStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isDoor, isAdmin } = await import("@/lib/auth");

  // El equipo entra a la puerta con su propia sesión de admin, sin clave aparte:
  // es cómodo y no tiene sentido pedirles dos claves. Pero hay que DECIRLO en la
  // pantalla, porque si no parece que la clave de puerta no sirve para nada
  // cuando en realidad quien entra es el admin.
  const conClaveDePuerta = await isDoor();
  const comoAdmin = conClaveDePuerta ? false : await isAdmin();

  return { autorizado: conClaveDePuerta || comoAdmin, comoAdmin };
});

/**
 * Reservas de los eventos que aún no han pasado. Es lo que se consulta en la
 * entrada, así que no incluye correo ni teléfono: la puerta no los necesita.
 */
export const listReservationsForDoor = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<EventoPuerta>> => {
    await requireDoorOrAdmin();

    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
    if (!isDatabaseConfigured()) return [];

    const supabase = getSupabaseAdmin();

    // Desde ayer, para que un evento que terminó de madrugada siga visible.
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: eventos, error: eventosError } = await supabase
      .from("events")
      .select("id, slug, name, starts_at, presale_price, door_price")
      .gte("starts_at", desde)
      .order("starts_at", { ascending: true });

    if (eventosError) {
      console.error("listReservationsForDoor (eventos):", eventosError);
      throw new Error("No se pudieron cargar los eventos");
    }
    if (!eventos || eventos.length === 0) return [];

    const ids = eventos.map((e) => e.id);

    const { data: reservas, error: reservasError } = await supabase
      .from("reservations")
      .select("id, event_id, code, holder_name, tickets, status, paid")
      .in("event_id", ids)
      .order("holder_name", { ascending: true });

    if (reservasError) {
      console.error("listReservationsForDoor (reservas):", reservasError);
      throw new Error("No se pudieron cargar las reservas");
    }

    const { data: invitados, error: invitadosError } = await supabase
      .from("reservation_guests")
      .select("reservation_id, name, position")
      .order("position", { ascending: true });

    if (invitadosError) {
      console.error("listReservationsForDoor (acompañantes):", invitadosError);
      throw new Error("No se pudieron cargar los acompañantes");
    }

    const porReserva = new Map<string, Array<string>>();
    for (const fila of invitados ?? []) {
      const lista = porReserva.get(fila.reservation_id) ?? [];
      lista.push(fila.name);
      porReserva.set(fila.reservation_id, lista);
    }

    return eventos.map((evento) => ({
      slug: evento.slug,
      name: evento.name,
      startsAt: evento.starts_at,
      presalePrice: evento.presale_price,
      doorPrice: evento.door_price,
      reservas: (reservas ?? [])
        .filter((r) => r.event_id === evento.id)
        .map((r) => ({
          id: r.id,
          code: r.code,
          holderName: r.holder_name,
          tickets: r.tickets,
          guests: porReserva.get(r.id) ?? [],
          status: r.status as ReservaPuerta["status"],
          paid: r.paid,
          totalAPagar:
            typeof evento.presale_price === "number" ? evento.presale_price * r.tickets : null,
        })),
    }));
  },
);

/**
 * Marcar ingreso. Lo puede hacer la puerta y el panel; se guarda desde dónde.
 *
 * Deliberadamente NO permite editar nombres ni entradas: si la puerta pudiera,
 * bastaría cambiar un nombre para colar a otra persona.
 */
export const setCheckIn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), entered: z.boolean() }))
  .handler(async ({ data }) => {
    const origen = await requireDoorOrAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { data: reserva, error: lecturaError } = await getSupabaseAdmin()
      .from("reservations")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();

    if (lecturaError || !reserva) {
      return { ok: false as const, message: "Esa reserva no existe." };
    }
    if (reserva.status === "cancelled") {
      return { ok: false as const, message: "Esa reserva está cancelada. No debe entrar." };
    }

    const { error } = await getSupabaseAdmin()
      .from("reservations")
      .update(
        data.entered
          ? { status: "checked_in", checked_in_at: new Date().toISOString(), checked_in_by: origen }
          : { status: "confirmed", checked_in_at: null, checked_in_by: null },
      )
      .eq("id", data.id);

    if (error) {
      console.error("setCheckIn:", error);
      return { ok: false as const, message: "No se pudo actualizar. Intenta de nuevo." };
    }

    return { ok: true as const };
  });

/** Marcar cobrado. También disponible en la puerta, que es donde se cobra. */
export const setPaid = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), paid: z.boolean() }))
  .handler(async ({ data }) => {
    const origen = await requireDoorOrAdmin();

    const { getSupabaseAdmin } = await import("@/lib/supabase");

    const { error } = await getSupabaseAdmin()
      .from("reservations")
      .update(
        data.paid
          ? { paid: true, paid_at: new Date().toISOString(), paid_by: origen }
          : { paid: false, paid_at: null, paid_by: null },
      )
      .eq("id", data.id);

    if (error) {
      console.error("setPaid:", error);
      return { ok: false as const, message: "No se pudo actualizar el pago." };
    }

    return { ok: true as const };
  });
