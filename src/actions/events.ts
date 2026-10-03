import { createServerFn } from "@tanstack/react-start";

/**
 * Evento tal como lo necesita la parte pública: la landing, la página de agenda y
 * el formulario de reserva. Sin datos internos — nada de aforo, ids ni conteos.
 */
export type EventoPublico = {
  slug: string;
  name: string;
  /** Eslogan. Falta mientras el evento no lo tenga. */
  tagline: string | null;
  startsAt: string;
  /** Cierre. Sin esto no se puede mostrar el horario, solo la hora de inicio. */
  endsAt: string | null;
  venue: string | null;
  address: string | null;
  /** Flyer. Se anuncian eventos antes de tenerlo, así que puede faltar. */
  posterUrl: string | null;
  /** El que la landing muestra en #eventos. Solo uno lo tiene. */
  featured: boolean;
  /**
   * Ya pasó la hora de cierre de reservas. El evento sigue en la agenda, pero sin
   * botón de reservar. Se calcula al cargar; el servidor lo vuelve a comprobar.
   */
  reservasCerradas: boolean;
};

/**
 * Eventos futuros con las reservas abiertas, del más próximo al más lejano.
 *
 * Lo consumen la landing (que muestra el destacado), la página `/eventos` (que
 * los muestra todos) y el selector del formulario de reserva. Una sola consulta
 * para los tres: son pocas filas y así no hay dos versiones de la verdad.
 */
export const getOpenEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<Array<EventoPublico>> => {
    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

    if (!isDatabaseConfigured()) return [];

    const { data, error } = await getSupabaseAdmin()
      .from("events")
      .select(
        "slug, name, tagline, starts_at, ends_at, venue, address, poster_url, featured, reservations_close_at",
      )
      .eq("reservations_open", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("getOpenEvents:", error);
      return [];
    }

    const ahora = Date.now();

    return (data ?? []).map((fila) => ({
      slug: fila.slug,
      name: fila.name,
      tagline: fila.tagline,
      startsAt: fila.starts_at,
      endsAt: fila.ends_at,
      venue: fila.venue,
      address: fila.address,
      posterUrl: fila.poster_url,
      featured: fila.featured ?? false,
      reservasCerradas:
        fila.reservations_close_at !== null && Date.parse(fila.reservations_close_at) <= ahora,
    }));
  },
);

/**
 * Cuál se muestra en la landing.
 *
 * Si nadie ha marcado destacado —o el destacado ya pasó— cae al más próximo, que
 * es lo que menos sorprende: la web nunca se queda sin agenda por un olvido.
 */
export function eventoDestacado(eventos: ReadonlyArray<EventoPublico>): EventoPublico | undefined {
  return eventos.find((evento) => evento.featured) ?? eventos[0];
}
