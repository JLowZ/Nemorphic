import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Una foto o un vídeo de un evento, tal como lo pinta el carrusel. */
export type MediaEvento = {
  kind: "photo" | "video";
  /** Foto: la variante mediana. Vídeo: el MP4. */
  src: string;
  /** Solo fotos: atributo `srcset` ya armado. */
  srcset: string | null;
  /** Solo vídeos: imagen previa a la reproducción. */
  poster: string | null;
  width: number;
  height: number;
  alt: string;
  /** Quién sale, con nombre artístico. Es el pie de foto. */
  artists: Array<string>;
};

/** Un evento pasado con su media. Sin datos internos: nada de aforo ni precios. */
export type EventoTrayectoria = {
  slug: string;
  name: string;
  tagline: string | null;
  startsAt: string;
  endsAt: string | null;
  venue: string | null;
  address: string | null;
  posterUrl: string | null;
  media: Array<MediaEvento>;
};

export type Trayectoria = {
  eventos: Array<EventoTrayectoria>;
  /** Cuántos eventos hay en total, aunque `eventos` traiga solo los últimos. */
  total: number;
};

const VACIA: Trayectoria = { eventos: [], total: 0 };

type FilaMedia = {
  kind: "photo" | "video";
  src: string;
  srcset: string | null;
  poster: string | null;
  width: number;
  height: number;
  alt: string;
  artists: Array<string> | null;
  position: number;
};

/**
 * Eventos que ya pasaron y tienen al menos una foto o vídeo, del más reciente al
 * más antiguo.
 *
 * Un evento sin media no entra (`event_media!inner`): la sección se publica cuando
 * hay con qué llenarla, no antes. Mientras la tabla esté vacía —o todavía no exista
 * porque falta aplicar la migración 0008— devuelve vacío y la web no enseña nada,
 * en vez de romper la landing.
 *
 * `limite` recorta a los últimos N (la landing pide 2); sin él trae todos.
 */
export const getTrayectoria = createServerFn({ method: "GET" })
  .validator(z.object({ limite: z.number().int().min(1).max(100).optional() }).optional())
  .handler(async ({ data }): Promise<Trayectoria> => {
    const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");

    if (!isDatabaseConfigured()) return VACIA;

    let consulta = getSupabaseAdmin()
      .from("events")
      .select(
        "slug, name, tagline, starts_at, ends_at, venue, address, poster_url, " +
          "event_media!inner(kind, src, srcset, poster, width, height, alt, artists, position)",
        { count: "exact" },
      )
      .lt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .order("position", { referencedTable: "event_media", ascending: true });

    if (data?.limite) consulta = consulta.limit(data.limite);

    const { data: filas, error, count } = await consulta;

    if (error) {
      console.error("getTrayectoria:", error);
      return VACIA;
    }

    const eventos = (filas ?? []).map((fila): EventoTrayectoria => {
      const f = fila as unknown as {
        slug: string;
        name: string;
        tagline: string | null;
        starts_at: string;
        ends_at: string | null;
        venue: string | null;
        address: string | null;
        poster_url: string | null;
        event_media: Array<FilaMedia>;
      };

      return {
        slug: f.slug,
        name: f.name,
        tagline: f.tagline,
        startsAt: f.starts_at,
        endsAt: f.ends_at,
        venue: f.venue,
        address: f.address,
        posterUrl: f.poster_url,
        media: f.event_media.map((m) => ({
          kind: m.kind,
          src: m.src,
          srcset: m.srcset,
          poster: m.poster,
          width: m.width,
          height: m.height,
          alt: m.alt,
          artists: m.artists ?? [],
        })),
      };
    });

    return { eventos, total: count ?? eventos.length };
  });
