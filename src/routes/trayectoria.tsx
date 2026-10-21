import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { getTrayectoria, type EventoTrayectoria } from "@/actions/trayectoria";
import { TrayectoriaItem } from "@/components/nemorphic/TrayectoriaItem";
import { LOGO } from "@/data/nemorphic";

const SITIO = "https://nemorphic.vercel.app";
const DESCRIPCION =
  "La trayectoria de Nemorphic: los eventos que ya hicimos, con sus flyers, fotos y vídeos de cada noche.";

/** Ruta absoluta: schema.org y Open Graph no entienden rutas relativas. */
function absoluta(ruta: string): string {
  return ruta.startsWith("http") ? ruta : `${SITIO}${encodeURI(ruta)}`;
}

/** Datos estructurados para que el buscador entienda cada evento como un evento. */
function datosEstructurados(eventos: ReadonlyArray<EventoTrayectoria>): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": eventos.map((evento) => ({
      "@type": "MusicEvent",
      name: evento.name,
      startDate: evento.startsAt,
      ...(evento.endsAt ? { endDate: evento.endsAt } : {}),
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      ...(evento.tagline ? { description: evento.tagline } : {}),
      ...(evento.venue
        ? {
            location: {
              "@type": "Place",
              name: evento.venue,
              ...(evento.address ? { address: evento.address } : {}),
            },
          }
        : {}),
      // Quién tocó, sin repetir: sale de los pies de foto de la media.
      performer: [...new Set(evento.media.flatMap((m) => m.artists))].map((nombre) => ({
        "@type": "Person",
        name: nombre,
      })),
      image: [
        ...(evento.posterUrl ? [absoluta(evento.posterUrl)] : []),
        ...evento.media.filter((m) => m.kind === "photo").map((m) => absoluta(m.src)),
      ],
      organizer: { "@type": "Organization", name: "Nemorphic", url: SITIO },
    })),
  });
}

/**
 * La trayectoria completa: todos los eventos pasados con su media.
 *
 * Mientras no haya ninguno, la página existe pero se pide al buscador que no la
 * indexe: una página vacía en Google daría mala impresión. Con el primero cargado,
 * la etiqueta desaparece sola y no hay que acordarse de quitarla.
 */
export const Route = createFileRoute("/trayectoria")({
  loader: () => getTrayectoria(),
  head: ({ loaderData }) => {
    const eventos = loaderData?.eventos ?? [];
    const titulo = "Trayectoria — Nemorphic";
    const portada = eventos[0]?.posterUrl;

    return {
      meta: [
        { title: titulo },
        { name: "description", content: DESCRIPCION },
        ...(eventos.length === 0 ? [{ name: "robots", content: "noindex" }] : []),
        { property: "og:title", content: titulo },
        { property: "og:description", content: DESCRIPCION },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITIO}/trayectoria` },
        ...(portada ? [{ property: "og:image", content: absoluta(portada) }] : []),
      ],
      links: [{ rel: "canonical", href: `${SITIO}/trayectoria` }],
      scripts:
        eventos.length > 0
          ? [{ type: "application/ld+json", children: datosEstructurados(eventos) }]
          : [],
    };
  },
  component: Trayectoria,
});

function Trayectoria() {
  const { eventos } = Route.useLoaderData();

  useEffect(() => {
    document.body.classList.add("nm-body");
    return () => document.body.classList.remove("nm-body");
  }, []);

  return (
    <div className="nm-agenda">
      <header className="nm-agenda-cabecera">
        <div className="nm-container">
          <Link to="/" className="nm-agenda-volver">
            <img src={LOGO} alt="" aria-hidden="true" width={34} height={34} />
            <span>Volver a Nemorphic</span>
          </Link>

          <p className="nm-eyebrow mt-8">Historia</p>
          <h1 className="nm-display nm-section-title mt-3">Trayectoria</h1>
          <div className="nm-rule" />
        </div>
      </header>

      <main className="nm-container nm-tray-lista">
        {eventos.length === 0 ? (
          <p className="nm-body-text nm-eventos-vacio">
            Estamos reuniendo las fotos y los vídeos de cada noche. Muy pronto vas a poder recorrer
            aquí todo lo que hemos hecho.
          </p>
        ) : (
          eventos.map((evento) => (
            <TrayectoriaItem key={evento.slug} evento={evento} encabezado="h2" />
          ))
        )}
      </main>
    </div>
  );
}
