import type { PersonaReserva } from "@/lib/personas-reserva";

const pesos = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/**
 * Cómo va el grupo de un vistazo: cuántos entraron y cuánto falta por cobrar.
 * Para una reserva de una sola persona dice lo mismo que antes («No ha entrado»).
 */
export function ResumenGrupo({
  personas,
  debe,
  cancelada,
}: {
  personas: ReadonlyArray<PersonaReserva>;
  debe: number | null;
  cancelada: boolean;
}) {
  const dentro = personas.filter((p) => p.entro).length;
  const todosPagaron = personas.every((p) => p.pagado);

  const ingreso = cancelada
    ? { clase: "cancelled", texto: "Cancelada" }
    : dentro === personas.length
      ? { clase: "checked_in", texto: personas.length > 1 ? "Entraron todos" : "Ya entró" }
      : dentro > 0
        ? { clase: "confirmed", texto: `${dentro} de ${personas.length} dentro` }
        : { clase: "confirmed", texto: "No ha entrado" };

  return (
    <div className="nm-puerta-estados">
      <span className={`nm-etiqueta nm-etiqueta--${ingreso.clase}`}>{ingreso.texto}</span>
      <span className={`nm-etiqueta nm-etiqueta--${todosPagaron ? "active" : "debe"}`}>
        {todosPagaron ? "Pagado" : debe !== null ? `Debe ${pesos.format(debe)}` : "Sin pagar"}
      </span>
    </div>
  );
}

/**
 * Las personas de una reserva, cada una con su botón de ingreso y de pago.
 *
 * Un grupo de 4 puede llegar 2 y 2: se marca a quien está en la puerta y el resto
 * queda pendiente con el mismo código. Si llegan todos juntos, los botones de grupo
 * marcan a los que falten de una vez.
 *
 * Lo usan la puerta y el panel. No habla con el servidor: recibe qué hacer al pulsar.
 */
export function PersonasReserva({
  personas,
  precio,
  cancelada,
  ocupado,
  onIngreso,
  onPago,
}: {
  personas: ReadonlyArray<PersonaReserva>;
  /** Precio por persona (preventa). Null si el evento no tiene precio. */
  precio: number | null;
  cancelada: boolean;
  /** Mientras se guarda algo, los botones se bloquean para no marcar dos veces. */
  ocupado: boolean;
  onIngreso: (posiciones: Array<number>, entro: boolean) => void;
  onPago: (posiciones: Array<number>, pagado: boolean) => void;
}) {
  const faltanPorEntrar = personas.filter((p) => !p.entro).map((p) => p.posicion);
  const faltanPorPagar = personas.filter((p) => !p.pagado).map((p) => p.posicion);
  const esGrupo = personas.length > 1;

  return (
    <div className="nm-personas">
      <ul className="nm-personas-lista">
        {personas.map((persona) => (
          <li
            key={persona.posicion}
            className={`nm-persona${persona.entro ? " is-dentro" : ""}${cancelada ? " is-cancelada" : ""}`}
          >
            <span className="nm-persona-nombre">
              {persona.nombre}
              {persona.posicion === 0 && esGrupo && <span className="nm-persona-rol">Titular</span>}
            </span>

            <span className="nm-persona-estados">
              <span
                className={`nm-etiqueta nm-etiqueta--${persona.entro ? "checked_in" : "confirmed"}`}
              >
                {persona.entro ? "Entró" : "No ha entrado"}
              </span>
              <span className={`nm-etiqueta nm-etiqueta--${persona.pagado ? "active" : "debe"}`}>
                {persona.pagado
                  ? `Pagó${persona.pagadoPor === "door" ? " en puerta" : ""}`
                  : precio !== null
                    ? `Debe ${pesos.format(precio)}`
                    : "Sin pagar"}
              </span>
            </span>

            {!cancelada && (
              <span className="nm-persona-acciones">
                <button
                  type="button"
                  className={persona.entro ? "nm-admin-logout" : "nm-btn nm-btn--solid"}
                  disabled={ocupado}
                  aria-label={
                    persona.entro
                      ? `Deshacer el ingreso de ${persona.nombre}`
                      : `Marcar que entró ${persona.nombre}`
                  }
                  onClick={() => onIngreso([persona.posicion], !persona.entro)}
                >
                  {persona.entro ? "Deshacer ingreso" : "Entró"}
                </button>
                <button
                  type="button"
                  className={persona.pagado ? "nm-admin-logout" : "nm-btn"}
                  disabled={ocupado}
                  aria-label={
                    persona.pagado
                      ? `Marcar que ${persona.nombre} no ha pagado`
                      : `Marcar que ${persona.nombre} pagó`
                  }
                  onClick={() => onPago([persona.posicion], !persona.pagado)}
                >
                  {persona.pagado ? "Deshacer pago" : "Pagó"}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>

      {!cancelada && esGrupo && (faltanPorEntrar.length > 1 || faltanPorPagar.length > 1) && (
        <div className="nm-reserva-acciones">
          {faltanPorEntrar.length > 1 && (
            <button
              type="button"
              className="nm-btn nm-btn--solid"
              disabled={ocupado}
              onClick={() => onIngreso(faltanPorEntrar, true)}
            >
              {faltanPorEntrar.length === personas.length
                ? `Entraron los ${personas.length}`
                : `Entraron los ${faltanPorEntrar.length} que faltaban`}
            </button>
          )}
          {faltanPorPagar.length > 1 && (
            <button
              type="button"
              className="nm-btn"
              disabled={ocupado}
              onClick={() => onPago(faltanPorPagar, true)}
            >
              {`Pagaron los ${faltanPorPagar.length}`}
              {precio !== null && ` (${pesos.format(precio * faltanPorPagar.length)})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
