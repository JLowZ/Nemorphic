import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { getOpenEvents, type EventoPublico } from "@/actions/events";
import { Modal } from "@/components/nemorphic/Modal";
import { PosterEvento } from "@/components/nemorphic/PosterEvento";
import { ReservationForm } from "@/components/nemorphic/ReservationForm";
import { LOGO } from "@/data/nemorphic";
import { fechaCorta, fechaLarga, horario, lugarCompleto } from "@/lib/fechas";

/**
 * La agenda completa.
 *
 * La landing muestra un solo evento —el destacado— porque es una página de
 * presentación del sello, no un calendario. Aquí están todos, y cada uno abre la
 * reserva **con ese evento ya elegido**: quien llega buscando una fecha concreta
 * no tiene que volver a seleccionarla en un desplegable.
 *
 * El evento a reservar va en la URL (`/eventos?reservar=umbra`) en vez de en el
 * estado del componente. Así el enlace se puede mandar por WhatsApp o Instagram y
 * abre directamente el formulario de esa fecha, y el botón de atrás del navegador
 * cierra el modal en vez de salirse de la página.
 */
export const Route = createFileRoute("/eventos")({
  validateSearch: z.object({ reservar: z.string().optional() }),
  loader: () => getOpenEvents(),
  head: () => ({
    meta: [
      { title: "Eventos — Nemorphic" },
      {
        name: "description",
        content:
          "Todas las fechas de Nemorphic: próximos eventos, horarios y reserva de cupo. Más que groove, cultura.",
      },
      { property: "og:title", content: "Eventos — Nemorphic" },
      {
        property: "og:description",
        content: "Todas las fechas de Nemorphic y la reserva de cupo para cada una.",
      },
    ],
  }),
  component: Eventos,
});

function Eventos() {
  const eventos = Route.useLoaderData();
  const { reservar } = Route.useSearch();
  const navigate = useNavigate({ from: "/eventos" });

  useEffect(() => {
    document.body.classList.add("nm-body");
    return () => document.body.classList.remove("nm-body");
  }, []);

  // Un slug inventado en la URL no debe abrir un formulario vacío.
  const enReserva = eventos.find((evento) => evento.slug === reservar && !evento.reservasCerradas);

  const abrirReserva = (slug: string) => navigate({ search: { reservar: slug } });
  const cerrarReserva = () => navigate({ search: {} });

  return (
    <div className="nm-agenda">
      <header className="nm-agenda-cabecera">
        <div className="nm-container">
          <Link to="/" className="nm-agenda-volver">
            <img src={LOGO} alt="" aria-hidden="true" width={34} height={34} />
            <span>Volver a Nemorphic</span>
          </Link>

          <p className="nm-eyebrow mt-8">Agenda</p>
          <h1 className="nm-display nm-section-title mt-3">Todos los eventos</h1>
          <div className="nm-rule" />
        </div>
      </header>

      <main className="nm-container nm-agenda-lista">
        {eventos.length === 0 ? (
          <p className="nm-body-text nm-eventos-vacio">
            No hay fechas abiertas ahora mismo. Estamos cocinando lo próximo: suscríbete al boletín
            desde la web y te avisamos antes que a nadie.
          </p>
        ) : (
          eventos.map((evento) => (
            <TarjetaEvento key={evento.slug} evento={evento} onReservar={abrirReserva} />
          ))
        )}
      </main>

      <Modal open={Boolean(enReserva)} onClose={cerrarReserva} title="Reservar cupo">
        <ReservationForm eventoInicial={enReserva?.slug ?? null} onDone={cerrarReserva} />
      </Modal>
    </div>
  );
}

function TarjetaEvento({
  evento,
  onReservar,
}: {
  evento: EventoPublico;
  onReservar: (slug: string) => void;
}) {
  const lugar = lugarCompleto(evento.venue, evento.address);

  return (
    <article className="nm-agenda-item">
      <div className="nm-agenda-poster">
        <PosterEvento
          posterUrl={evento.posterUrl}
          nombre={evento.name}
          alt={`Flyer del evento ${evento.name}, ${fechaLarga(evento.startsAt)}${
            lugar ? ` en ${lugar}` : ""
          }`}
        />
      </div>

      <div className="nm-agenda-info">
        <p className="nm-agenda-fecha">
          {fechaCorta(evento.startsAt)}
          <span aria-hidden="true"> · </span>
          {horario(evento.startsAt, evento.endsAt)}
        </p>

        <h2 className="nm-display nm-agenda-titulo">
          {evento.name}
          {evento.featured && <span className="nm-agenda-destacado">Destacado</span>}
        </h2>

        {evento.tagline && <p className="nm-event-tagline">{evento.tagline}</p>}
        {lugar && <p className="nm-agenda-lugar">{lugar}</p>}

        {evento.reservasCerradas ? (
          <p className="nm-body-text nm-event-cta">
            Las reservas ya cerraron. Los cupos se pagan en la puerta.
          </p>
        ) : (
          <button
            type="button"
            className="nm-btn nm-btn--solid nm-event-cta"
            onClick={() => onReservar(evento.slug)}
          >
            Reservar mi cupo
          </button>
        )}
      </div>
    </article>
  );
}
