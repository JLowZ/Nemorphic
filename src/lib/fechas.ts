/**
 * Fechas y horas de los eventos, en el formato en que se escriben en la web.
 *
 * Todo se imprime en hora de Colombia, no en la del navegador: la fecha de un
 * evento es la del sitio donde ocurre, y a alguien mirando desde otra zona no le
 * sirve ver "2 AM del día siguiente".
 *
 * Vive en `lib` porque lo usan la landing, la página de eventos y el panel, y
 * antes cada uno tenía su propia copia con pequeñas diferencias.
 */

const ZONA = "America/Bogota";

function partes(iso: string, opciones: Intl.DateTimeFormatOptions): Array<Intl.DateTimeFormatPart> {
  return new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, ...opciones }).formatToParts(
    new Date(iso),
  );
}

function valor(lista: Array<Intl.DateTimeFormatPart>, tipo: Intl.DateTimeFormatPartTypes): string {
  return lista.find((parte) => parte.type === tipo)?.value ?? "";
}

function mayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Sábado 3 de octubre". Se arma por partes para no arrastrar la coma del locale. */
export function fechaLarga(iso: string): string {
  const lista = partes(iso, { weekday: "long", day: "numeric", month: "long" });
  return `${mayuscula(valor(lista, "weekday"))} ${valor(lista, "day")} de ${valor(lista, "month")}`;
}

/** "Sábado 26 de septiembre de 2026" — para el pasado, donde el año sí importa. */
export function fechaCompleta(iso: string): string {
  const lista = partes(iso, { year: "numeric" });
  return `${fechaLarga(iso)} de ${valor(lista, "year")}`;
}

/** "SÁB 27 SEP" — para la cabecera de una tarjeta, donde no cabe la fecha larga. */
export function fechaCorta(iso: string): string {
  const lista = partes(iso, { weekday: "short", day: "numeric", month: "short" });
  const dia = valor(lista, "weekday").replace(".", "");
  const mes = valor(lista, "month").replace(".", "");
  return `${dia} ${valor(lista, "day")} ${mes}`.toUpperCase();
}

/** "8 PM", "8:30 PM". Los minutos solo aparecen si los hay. */
export function hora(iso: string): string {
  const lista = partes(iso, { hour: "numeric", minute: "2-digit", hour12: false });
  const h = Number(valor(lista, "hour"));
  const m = Number(valor(lista, "minute"));
  const sufijo = h < 12 ? "AM" : "PM";
  const doce = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${doce} ${sufijo}` : `${doce}:${String(m).padStart(2, "0")} ${sufijo}`;
}

/** "8 PM — 2 AM", o solo la hora de inicio si el evento no tiene cierre. */
export function horario(inicio: string, fin: string | null): string {
  return fin ? `${hora(inicio)} — ${hora(fin)}` : `Desde las ${hora(inicio)}`;
}

/** "Épica — Av. Paralela #55-35", con lo que haya. Vacío si no hay ni lugar. */
export function lugarCompleto(venue: string | null, address: string | null): string {
  return [venue, address].filter(Boolean).join(" — ");
}
