import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
  createReservationAsAdmin,
  deleteReservation,
  listReservations,
  setReservationStatus,
  updateReservation,
  type EventoAdmin,
  type ReservaAdmin,
} from "@/actions/admin-reservations";
import { setEventPrices } from "@/actions/admin-settings";
import { setCheckIn, setPaid } from "@/actions/door";
import { PersonasReserva, ResumenGrupo } from "@/components/nemorphic/PersonasReserva";
import {
  MAX_TICKETS,
  adminReservationSchema,
  type AdminReservationInput,
} from "@/schemas/reservation";

export const Route = createFileRoute("/admin/_panel/reservas")({
  component: Reservas,
});

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

function formatearMomento(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(new Date(iso));
}

/** Formulario compartido por el alta y la edición de una reserva. */
function FormularioReserva({
  inicial,
  eventos,
  enviando,
  textoBoton,
  onGuardar,
  onCancelar,
}: {
  inicial: AdminReservationInput;
  eventos: Array<EventoAdmin>;
  enviando: boolean;
  textoBoton: string;
  onGuardar: (valores: AdminReservationInput) => void;
  onCancelar: () => void;
}) {
  const form = useForm<AdminReservationInput>({
    resolver: zodResolver(adminReservationSchema),
    defaultValues: inicial,
  });

  const { fields, replace } = useFieldArray({ control: form.control, name: "guests" });
  const tickets = form.watch("tickets");

  useEffect(() => {
    const necesarios = Math.max(0, (Number(tickets) || 1) - 1);
    const actuales = form.getValues("guests");
    if (actuales.length === necesarios) return;
    replace(Array.from({ length: necesarios }, (_, i) => ({ name: actuales[i]?.name ?? "" })));
  }, [tickets, replace, form]);

  const errores = form.formState.errors;

  return (
    <form className="nm-admin-form" onSubmit={form.handleSubmit(onGuardar)} noValidate>
      <div className="nm-campo">
        <label htmlFor="nm-res-evento">Evento</label>
        <select id="nm-res-evento" className="nm-input" {...form.register("eventSlug")}>
          {eventos.map((e) => (
            <option key={e.slug} value={e.slug}>
              {e.name}
            </option>
          ))}
        </select>
        {errores.eventSlug && <p role="alert">{errores.eventSlug.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-res-nombre">Nombre completo</label>
        <input
          id="nm-res-nombre"
          type="text"
          className="nm-input"
          {...form.register("holderName")}
        />
        {errores.holderName && <p role="alert">{errores.holderName.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-res-correo">Correo</label>
        <input
          id="nm-res-correo"
          type="email"
          className="nm-input"
          {...form.register("holderEmail")}
        />
        {errores.holderEmail && <p role="alert">{errores.holderEmail.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-res-telefono">Teléfono</label>
        <input
          id="nm-res-telefono"
          type="tel"
          className="nm-input"
          {...form.register("holderPhone")}
        />
        {errores.holderPhone && <p role="alert">{errores.holderPhone.message}</p>}
      </div>

      <div className="nm-campo">
        <label htmlFor="nm-res-entradas">Entradas</label>
        <select
          id="nm-res-entradas"
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
          <legend>Acompañantes</legend>
          {fields.map((campo, indice) => (
            <div className="nm-campo" key={campo.id}>
              <label htmlFor={`nm-res-acomp-${indice}`}>Nombre completo</label>
              <input
                id={`nm-res-acomp-${indice}`}
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

      {errores.guests?.message && <p role="alert">{errores.guests.message}</p>}

      <div className="nm-admin-form-acciones">
        <button type="submit" className="nm-btn nm-btn--solid" disabled={enviando}>
          {enviando ? "Guardando…" : textoBoton}
        </button>
        <button type="button" className="nm-admin-logout" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Reservas() {
  const queryClient = useQueryClient();
  const [eventoAbierto, setEventoAbierto] = useState<string | null>(null);
  const [anadiendo, setAnadiendo] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [editandoPrecios, setEditandoPrecios] = useState(false);

  const consulta = useQuery({
    queryKey: ["admin", "reservas"],
    queryFn: () => listReservations(),
  });

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "reservas"] });
  };

  const cambiarEstado = useMutation({
    mutationFn: (variables: { id: string; status: "confirmed" | "cancelled" }) =>
      setReservationStatus({ data: variables }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      toast.success("Reserva actualizada");
    },
    onError: () => toast.error("No se pudo actualizar. Intenta de nuevo."),
  });

  const alta = useMutation({
    mutationFn: (data: AdminReservationInput) => createReservationAsAdmin({ data }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      setAnadiendo(false);
      toast.success(
        resultado.correoEnviado
          ? `Reserva creada con el código ${resultado.code}. Se le envió por correo.`
          : `Reserva creada con el código ${resultado.code}. NO salió el correo: pásaselo tú.`,
      );
    },
    onError: () => toast.error("No se pudo crear. Intenta de nuevo."),
  });

  const edicion = useMutation({
    mutationFn: (data: AdminReservationInput & { id: string }) => updateReservation({ data }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      setEditando(null);
      toast.success("Cambios guardados");
    },
    onError: () => toast.error("No se pudo guardar. Intenta de nuevo."),
  });

  const ingreso = useMutation({
    mutationFn: (v: { id: string; personas: Array<number>; entered: boolean }) =>
      setCheckIn({ data: v }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
    },
    onError: () => toast.error("No se pudo actualizar el ingreso."),
  });

  const pago = useMutation({
    mutationFn: (v: { id: string; personas: Array<number>; paid: boolean }) => setPaid({ data: v }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
    },
    onError: () => toast.error("No se pudo actualizar el pago."),
  });

  const precios = useMutation({
    mutationFn: (v: { slug: string; presalePrice: number; doorPrice: number }) =>
      setEventPrices({ data: v }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      setEditandoPrecios(false);
      toast.success("Precios guardados");
    },
    onError: () => toast.error("No se pudieron guardar los precios."),
  });

  const borrado = useMutation({
    mutationFn: (id: string) => deleteReservation({ data: { id } }),
    onSuccess: async (resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.message);
        return;
      }
      await refrescar();
      toast.success("Reserva eliminada");
    },
    onError: () => toast.error("No se pudo eliminar. Intenta de nuevo."),
  });

  if (consulta.isLoading) {
    return (
      <>
        <h1 className="nm-admin-title">Reservas</h1>
        <p className="nm-admin-lead">Cargando…</p>
      </>
    );
  }

  if (consulta.isError) {
    return (
      <>
        <h1 className="nm-admin-title">Reservas</h1>
        <p className="nm-admin-lead">
          No se pudieron cargar las reservas. Recarga la página; si sigue fallando, avisa al
          desarrollador.
        </p>
      </>
    );
  }

  const eventos = consulta.data ?? [];
  const seleccionado = eventoAbierto ?? eventos[0]?.slug ?? null;
  const evento = eventos.find((e) => e.slug === seleccionado);

  return (
    <>
      <h1 className="nm-admin-title">Reservas</h1>
      <p className="nm-admin-lead">
        Quiénes reservaron su cupo. El <strong>código</strong> es lo que la persona presenta en la
        puerta: búscalo aquí junto a su nombre. En un grupo, cada persona se marca por separado (
        <strong>Entró</strong> y <strong>Pagó</strong>), porque no siempre llegan juntas.
      </p>

      {eventos.length === 0 ? (
        <p className="nm-admin-vacio">Todavía no hay eventos creados.</p>
      ) : (
        <>
          <div className="nm-admin-toolbar">
            {eventos.length > 1 && (
              <select
                className="nm-input"
                aria-label="Elegir evento"
                value={seleccionado ?? ""}
                onChange={(e) => setEventoAbierto(e.target.value)}
              >
                {eventos.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name} — {formatearFecha(e.startsAt)}
                  </option>
                ))}
              </select>
            )}
            {!anadiendo && evento && (
              <button
                type="button"
                className="nm-btn nm-btn--solid"
                onClick={() => setAnadiendo(true)}
              >
                Añadir reserva a mano
              </button>
            )}
          </div>

          {anadiendo && evento && (
            <FormularioReserva
              inicial={{
                eventSlug: evento.slug,
                holderName: "",
                holderEmail: "",
                holderPhone: "",
                tickets: 1,
                guests: [],
              }}
              eventos={eventos}
              enviando={alta.isPending}
              textoBoton="Crear reserva"
              onGuardar={(valores) => alta.mutate(valores)}
              onCancelar={() => setAnadiendo(false)}
            />
          )}

          {evento && (
            <>
              <dl className="nm-admin-resumen">
                <div className="nm-admin-dato">
                  <dt>Reservas</dt>
                  <dd>{evento.reservas.filter((r) => r.status !== "cancelled").length}</dd>
                </div>
                <div className="nm-admin-dato">
                  <dt>Entradas</dt>
                  <dd>
                    {evento.entradasComprometidas}
                    {evento.capacity !== null && ` / ${evento.capacity}`}
                  </dd>
                </div>
                <div className="nm-admin-dato">
                  <dt>Ya entraron</dt>
                  <dd>{evento.personasDentro}</dd>
                </div>
                <div className="nm-admin-dato">
                  <dt>Cobrado</dt>
                  <dd className="nm-admin-dato-dinero">{pesos.format(evento.totalCobrado)}</dd>
                </div>
                <div className="nm-admin-dato">
                  <dt>Por cobrar</dt>
                  <dd className="nm-admin-dato-dinero">{pesos.format(evento.totalPendiente)}</dd>
                </div>
              </dl>

              <section className="nm-admin-card">
                {editandoPrecios ? (
                  <form
                    className="nm-admin-precios-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const datos = new FormData(e.currentTarget);
                      precios.mutate({
                        slug: evento.slug,
                        presalePrice: Number(datos.get("presale") ?? 0),
                        doorPrice: Number(datos.get("door") ?? 0),
                      });
                    }}
                  >
                    <div className="nm-campo">
                      <label htmlFor="nm-precio-preventa">Precio reservando (COP)</label>
                      <input
                        id="nm-precio-preventa"
                        name="presale"
                        type="number"
                        min={0}
                        step={1000}
                        className="nm-input"
                        defaultValue={evento.presalePrice ?? 0}
                      />
                    </div>
                    <div className="nm-campo">
                      <label htmlFor="nm-precio-puerta">Precio en puerta sin reserva (COP)</label>
                      <input
                        id="nm-precio-puerta"
                        name="door"
                        type="number"
                        min={0}
                        step={1000}
                        className="nm-input"
                        defaultValue={evento.doorPrice ?? 0}
                      />
                    </div>
                    <div className="nm-admin-form-acciones">
                      <button
                        type="submit"
                        className="nm-btn nm-btn--solid"
                        disabled={precios.isPending}
                      >
                        {precios.isPending ? "Guardando..." : "Guardar precios"}
                      </button>
                      <button
                        type="button"
                        className="nm-admin-logout"
                        onClick={() => setEditandoPrecios(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="nm-admin-card-texto">
                    {evento.presalePrice === null ? (
                      <strong>Sin precio definido.</strong>
                    ) : (
                      <>
                        Reservando: <strong>{pesos.format(evento.presalePrice)}</strong> por persona
                        {evento.doorPrice !== null && (
                          <>
                            {" - "}En puerta sin reserva:{" "}
                            <strong>{pesos.format(evento.doorPrice)}</strong>
                          </>
                        )}
                      </>
                    )}{" "}
                    <button
                      type="button"
                      className="nm-admin-enlace"
                      onClick={() => setEditandoPrecios(true)}
                    >
                      Cambiar precios
                    </button>
                  </p>
                )}

                {/* Cuál sale en la portada se elige en Resumen: es una decisión de
                    anuncio, no del día del evento. Aquí solo se dice cómo está. */}
                {evento.featured && (
                  <p className="nm-admin-card-texto">
                    <strong>Este es el evento que se ve en la portada.</strong> Los demás siguen
                    visibles en la página de eventos.
                  </p>
                )}
              </section>

              {evento.reservas.length === 0 ? (
                <p className="nm-admin-vacio">Nadie ha reservado todavía para {evento.name}.</p>
              ) : (
                <div className="nm-reserva-lista">
                  {evento.reservas.map((reserva) => (
                    <article className="nm-reserva-item" key={reserva.id}>
                      {editando === reserva.id ? (
                        <FormularioReserva
                          inicial={{
                            eventSlug: evento.slug,
                            holderName: reserva.holderName,
                            holderEmail: reserva.holderEmail,
                            holderPhone: reserva.holderPhone,
                            tickets: reserva.tickets,
                            guests: reserva.guests.map((name) => ({ name })),
                          }}
                          eventos={eventos}
                          enviando={edicion.isPending}
                          textoBoton="Guardar cambios"
                          onGuardar={(valores) => edicion.mutate({ ...valores, id: reserva.id })}
                          onCancelar={() => setEditando(null)}
                        />
                      ) : (
                        <>
                          <div className="nm-reserva-cabecera">
                            <span className="nm-reserva-nombre">{reserva.holderName}</span>
                            <span className="nm-reserva-item-codigo">{reserva.code}</span>
                            <span className="nm-reserva-entradas">
                              {reserva.tickets} entrada{reserva.tickets === 1 ? "" : "s"} ·{" "}
                              {formatearMomento(reserva.createdAt)}
                            </span>
                          </div>

                          <div className="nm-reserva-contacto">
                            <a href={`mailto:${reserva.holderEmail}`}>{reserva.holderEmail}</a>
                            <a href={`tel:${reserva.holderPhone.replace(/\s/g, "")}`}>
                              {reserva.holderPhone}
                            </a>
                          </div>

                          <ResumenGrupo
                            personas={reserva.personas}
                            debe={reserva.debe}
                            cancelada={reserva.status === "cancelled"}
                          />

                          <PersonasReserva
                            personas={reserva.personas}
                            precio={evento.presalePrice}
                            cancelada={reserva.status === "cancelled"}
                            ocupado={ingreso.isPending || pago.isPending}
                            onIngreso={(personas, entro) =>
                              ingreso.mutate({ id: reserva.id, personas, entered: entro })
                            }
                            onPago={(personas, pagado) =>
                              pago.mutate({ id: reserva.id, personas, paid: pagado })
                            }
                          />

                          <div className="nm-reserva-acciones">
                            <button
                              type="button"
                              className="nm-admin-logout"
                              onClick={() => setEditando(reserva.id)}
                            >
                              Editar
                            </button>
                            {reserva.status !== "cancelled" ? (
                              <button
                                type="button"
                                className="nm-admin-logout"
                                disabled={cambiarEstado.isPending}
                                onClick={() =>
                                  cambiarEstado.mutate({ id: reserva.id, status: "cancelled" })
                                }
                              >
                                Cancelar
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="nm-admin-logout"
                                disabled={cambiarEstado.isPending}
                                onClick={() =>
                                  cambiarEstado.mutate({ id: reserva.id, status: "confirmed" })
                                }
                              >
                                Reactivar
                              </button>
                            )}
                            <button
                              type="button"
                              className="nm-admin-logout"
                              disabled={borrado.isPending}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `¿Eliminar del todo la reserva ${reserva.code} de ${reserva.holderName}? No se puede deshacer. Si solo quieres liberar las entradas, usa Cancelar.`,
                                  )
                                ) {
                                  return;
                                }
                                borrado.mutate(reserva.id);
                              }}
                            >
                              Eliminar
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
