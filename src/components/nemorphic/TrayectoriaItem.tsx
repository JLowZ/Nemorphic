import type { EventoTrayectoria, MediaEvento } from "@/actions/trayectoria";
import { PosterEvento } from "@/components/nemorphic/PosterEvento";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { artistas } from "@/data/nemorphic";
import { fechaCompleta, lugarCompleto } from "@/lib/fechas";

/**
 * Un evento pasado: el flyer a la izquierda y, a su derecha, el carrusel con las
 * fotos y vídeos de esa noche. En móvil se apilan.
 *
 * Lo comparten la landing (los dos últimos) y `/trayectoria` (todos), así que el
 * título se pasa como prop: en la landing el h2 es el de la sección y cada evento
 * es un h3; en su propia página cada evento es un h2 bajo el h1.
 */
export function TrayectoriaItem({
  evento,
  encabezado: Encabezado = "h3",
}: {
  evento: EventoTrayectoria;
  encabezado?: "h2" | "h3";
}) {
  const lugar = lugarCompleto(evento.venue, evento.address);
  const fecha = fechaCompleta(evento.startsAt);

  return (
    <article className="nm-tray-item" aria-label={evento.name}>
      <div className="nm-tray-flyer">
        <div className="nm-event-poster-wrap">
          <PosterEvento
            posterUrl={evento.posterUrl}
            nombre={evento.name}
            alt={`Flyer del evento ${evento.name}, ${fecha}${lugar ? ` en ${lugar}` : ""}`}
          />
        </div>

        <Encabezado className="nm-display nm-tray-titulo">{evento.name}</Encabezado>
        <p className="nm-tray-fecha">
          <time dateTime={evento.startsAt}>{fecha}</time>
        </p>
        {lugar && <p className="nm-agenda-lugar">{lugar}</p>}
      </div>

      <Carousel
        className="nm-tray-carrusel"
        opts={{ align: "start", containScroll: "trimSnaps" }}
        aria-label={`Fotos y vídeos de ${evento.name}`}
      >
        <CarouselContent className="items-center">
          {evento.media.map((pieza) => (
            <CarouselItem key={pieza.src} className="nm-tray-slide">
              <figure className="nm-tray-figura">
                <Pieza pieza={pieza} />
                {pieza.artists.length > 0 && (
                  <figcaption className="nm-tray-pie">{pieArtistas(pieza.artists)}</figcaption>
                )}
              </figure>
            </CarouselItem>
          ))}
        </CarouselContent>
        {evento.media.length > 1 && (
          <>
            <CarouselPrevious className="nm-tray-flecha left-2" />
            <CarouselNext className="nm-tray-flecha right-2" />
          </>
        )}
      </Carousel>
    </article>
  );
}

/**
 * Pie de foto: quién sale. Siempre con el nombre artístico (la tabla de alias está en
 * CLAUDE.md y en scripts/artistas.mjs): «A.L.L y Do», «A.L.L, DSTRKT y J Løwℤ». Si
 * salen todos, «Todo el line-up» — listar seis nombres no dice más que eso.
 */
function pieArtistas(salen: ReadonlyArray<string>): string {
  if (salen.length >= artistas.length) return "Todo el line-up";
  if (salen.length <= 1) return salen.join("");
  return `${salen.slice(0, -1).join(", ")} y ${salen[salen.length - 1]}`;
}

/**
 * Una foto o un vídeo, con la proporción 4:5 que fija el CSS.
 *
 * Rendimiento: todo es `lazy` porque la sección queda muy por debajo del primer
 * pantallazo, y los vídeos llevan `preload="none"` — no descargan ni un byte hasta
 * que alguien les da a reproducir; antes solo cuesta la imagen de portada.
 * `width` y `height` reservan el hueco para que la página no salte al cargar.
 */
function Pieza({ pieza }: { pieza: MediaEvento }) {
  if (pieza.kind === "video") {
    return (
      <video
        className="nm-tray-media"
        controls
        playsInline
        preload="none"
        poster={pieza.poster ?? undefined}
        width={pieza.width}
        height={pieza.height}
        aria-label={pieza.alt}
      >
        <source src={pieza.src} type="video/mp4" />
        {pieza.alt}
      </video>
    );
  }

  return (
    <img
      className="nm-tray-media nm-tray-media--foto"
      src={pieza.src}
      srcSet={pieza.srcset ?? undefined}
      // Un tercio del ancho en escritorio (3 piezas a la vez), media pantalla en
      // tablet y casi todo el ancho en móvil.
      sizes="(min-width: 1280px) 22vw, (min-width: 768px) 32vw, 90vw"
      alt={pieza.alt}
      width={pieza.width}
      height={pieza.height}
      loading="lazy"
      decoding="async"
    />
  );
}
