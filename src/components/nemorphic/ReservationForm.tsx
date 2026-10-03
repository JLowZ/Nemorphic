import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { createReservation } from "@/actions/reservations";
import { getOpenEvents } from "@/actions/events";
import { MAX_TICKETS, reservationSchema, type ReservationInput } from "@/schemas/reservation";

type Confirmacion = { code: string; eventName: string; correoEnviado: boolean };

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

export function ReservationForm({
  onDone,
  eventoInicial = null,
}: {
  onDone: () => void;
  /**
   * Evento que llega ya elegido, porque se pulsó "Reservar" en uno concreto.
   * Null cuando se abre desde un botón general: ahí elige la persona.
   */
  eventoInicial?: string | null;
}) {
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [copiado, setCopiado] = useState(false);

  const eventos = useQuery({
    queryKey: ["eventos-abiertos"],
    queryFn: () => getOpenEvents(),
    staleTime: 5 * 60 * 1000,
    // Los que ya cerraron siguen en la agenda, pero no se pueden elegir aquí.
    select: (lista) => lista.filter((evento) => !evento.reservasCerradas),
  });

  const form = useForm<ReservationInput>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      eventSlug: eventoInicial ?? "",
      holderName: "",
      holderEmail: "",
      holderPhone: "",
      tickets: 1,
      guests: [],
    },
  });

  const { fields, replace } = useFieldArray({ control: form.control, name: "guests" });
  const tickets = form.watch("tickets");

  // Los acompañantes son siempre las entradas menos el titular. Se sincronizan
  // conservando lo ya escrito para no borrar nombres al subir y bajar el número.
  useEffect(() => {
    const necesarios = Math.max(0, (Number(tickets) || 1) - 1);
    const actuales = form.getValues("guests");
    if (actuales.length === necesarios) return;

    replace(Array.from({ length: necesarios }, (_, i) => ({ name: actuales[i]?.name ?? "" })));
  }, [tickets, replace, form]);

  // Qué evento aparece elegido al abrir. Por orden: el que se pidió al abrir el
  // formulario, o el único que haya. Con varios y sin petición, elige la persona.
  useEffect(() => {
    const lista = eventos.data;
    if (!lista || form.getValues("eventSlug")) return;

    const pedido =
      eventoInicial && lista.some((e) => e.slug === eventoInicial) ? eventoInicial : null;
    const unico = lista.length === 1 ? (lista[0]?.slug ?? null) : null;
    const elegido = pedido ?? unico;

    if (elegido) form.setValue("eventSlug", elegido);
  }, [eventos.data, eventoInicial, form]);

  const mutation = useMutation({
    mutationFn: (data: ReservationInput) => createReservation({ data }),
    onSuccess: (resultado) => {
      if (!resultado.ok) {
        form.setError("root", { message: resultado.message });
        return;
      }
      setConfirmacion({
        code: resultado.code,
        eventName: resultado.eventName,
        correoEnviado: resultado.correoEnviado,
      });
    },
    onError: () => {
      form.setError("root", {
        message: "No pudimos conectar. Revisa tu conexión e intenta de nuevo.",
      });
    },
  });

  if (confirmacion) {
    return (
      <div className="nm-reserva-ok">
        <p className="nm-eyebrow">Cupo reservado</p>
        <p className="nm-reserva-codigo">{confirmacion.code}</p>
        <p className="nm-body-text">
          Guarda este código: es lo que debes presentar en la entrada de{" "}
          <strong>{confirmacion.eventName}</strong>. Te esperamos.
        </p>
        <p className="nm-reserva-ok-correo">
          {confirmacion.correoEnviado
            ? "Te lo enviamos también por correo. Si no lo ves, revisa la carpeta de spam."
            : "No pudimos enviarte el correo de confirmación, así que guarda el código de aquí."}
        </p>

        <div className="nm-reserva-ok-acciones">
          <button
            type="button"
            className="nm-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(confirmacion.code);
                setCopiado(true);
                window.setTimeout(() => setCopiado(false), 2500);
              } catch {
                // Algunos navegadores bloquean el portapapeles; el código está a
                // la vista, así que basta con no romper nada.
                setCopiado(false);
              }
            }}
          >
            {copiado ? "¡Copiado!" : "Copiar código"}
          </button>
          <button type="button" className="nm-btn nm-btn--solid" onClick={onDone}>
            Listo
          </button>
        </div>
      </div>
    );
  }

  if (eventos.isLoading) {
    return <p className="nm-body-text">Cargando eventos…</p>;
  }

  if (!eventos.data || eventos.data.length === 0) {
    return (
      <p className="nm-body-text">
        Ahora mismo no hay eventos con reservas abiertas. Síguenos en redes para enterarte del
        próximo.
      </p>
    );
  }

  const errores = form.formState.errors;

  return (
    <form
      className="nm-reserva-form"
      onSubmit={form.handleSubmit((valores) => mutation.mutate(valores))}
      noValidate
    >
      <div className="nm-campo">
        <label htmlFor="nm-evento">Evento</label>
        <select id="nm-evento" className="nm-input" {...form.register("eventSlug")}>
          <option value="">Elige un evento</option>
          {eventos.data.map((evento) => (
            <option key={evento.slug} value={evento.slug}>
              {evento.name} — {formatearFecha(evento.startsAt)}
            </option>
          ))}
        </select>
        {errores.eventSlug && <p role="alert">{errores.eventSlug.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-nombre">Tu nombre completo</label>
        <input id="nm-nombre" type="text" className="nm-input" {...form.register("holderName")} />
        {errores.holderName && <p role="alert">{errores.holderName.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-correo">Correo</label>
        <input
          id="nm-correo"
          type="email"
          autoComplete="email"
          className="nm-input"
          {...form.register("holderEmail")}
        />
        {errores.holderEmail && <p role="alert">{errores.holderEmail.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-telefono">Teléfono</label>
        <input
          id="nm-telefono"
          type="tel"
          autoComplete="tel"
          className="nm-input"
          {...form.register("holderPhone")}
        />
        {errores.holderPhone && <p role="alert">{errores.holderPhone.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-entradas">Cantidad de entradas</label>
        <select
          id="nm-entradas"
          className="nm-input"
          {...form.register("tickets", { valueAsNumber: true })}
        >
          {Array.from({ length: MAX_TICKETS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {errores.tickets && <p role="alert">{errores.tickets.message}</p>}
      </div>

      {fields.length > 0 && (
        <fieldset className="nm-acompanantes">
          <legend>
            {fields.length === 1 ? "Tu acompañante" : `Tus ${fields.length} acompañantes`}
          </legend>
          {fields.map((campo, indice) => (
            <div className="nm-campo" key={campo.id}>
              <label htmlFor={`nm-acompanante-${indice}`}>Nombre completo</label>
              <input
                id={`nm-acompanante-${indice}`}
                type="text"
                className="nm-input"
                {...form.register(`guests.${indice}.name`)}
              />
              {errores.guests?.[indice]?.name && (
                <p role="alert">{errores.guests[indice]?.name?.message}</p>
              )}
            </div>
          ))}
        </fieldset>
      )}

      {errores.root && (
        <p role="alert" className="nm-reserva-error">
          {errores.root.message}
        </p>
      )}

      <p className="nm-reserva-aviso">
        Usamos estos datos únicamente para gestionar tu entrada al evento. No los compartimos con
        nadie.
      </p>

      <button
        type="submit"
        className="nm-btn nm-btn--solid nm-reserva-enviar"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Reservando…" : "Reservar mi cupo"}
      </button>
    </form>
  );
}
