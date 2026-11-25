// Los artistas del sello: nombre artístico (el que se ve en la web) y los nombres
// con que se les conoce de otra manera — nombre real, apodo, abreviatura o la
// forma en que se escribe a la ligera en el nombre de un archivo.
//
// REGLA: en la web siempre sale el nombre artístico (`nombre`). Si alguien dice
// «Franco» o «Diaz», es A.L.L y Do; nunca se imprime «Franco» ni «Diaz». Esta tabla
// es la misma que está documentada en CLAUDE.md: si cambia una, cambia la otra.
//
// Un artista nuevo se añade aquí con sus alias. Los alias se comparan sin tildes,
// sin mayúsculas y sin puntos ni espacios de más: «A.L.L», «a l l» y «ALL» son lo mismo.

export const ARTISTAS = [
  {
    nombre: "J Løwℤ",
    real: "Juan José López",
    alias: ["jlowz", "j lowz", "j low", "juan jose lopez", "juan jose"],
  },
  {
    nombre: "DSTRKT",
    real: "Alejandro Acevedo",
    // «dstekt» es un error de tipeo que ya existía en un nombre de archivo.
    alias: ["dstrkt", "dstekt", "alejandro acevedo", "alejandro", "alejo"],
  },
  {
    nombre: "Do",
    real: "Juan Camilo Diaz",
    alias: ["do", "diaz", "juan camilo diaz", "juan camilo"],
  },
  {
    nombre: "A.L.L",
    real: "Juan Manuel Franco",
    alias: ["all", "a l l", "franco", "juan manuel franco", "juan manuel"],
  },
  {
    nombre: "Ectasy",
    real: "Juan Diego",
    alias: ["ectasy", "ecstasy", "jd", "juan diego"],
  },
  {
    nombre: "Blaue Nacht",
    real: "Sergio Tibaduiza",
    alias: ["blaue nacht", "blaue", "tiba", "tibaduiza", "sergio tibaduiza", "sergio"],
  },
];

/**
 * Invitados especiales: artistas que no son residentes del sello pero tocaron en
 * algún evento. Salen en el pie de foto con su nombre (la web les añade «invitado
 * especial»), pero no cuentan para «todos» ni para el pie «Nemorphic», y no van en
 * `artistas[]` de src/data/nemorphic.ts.
 */
export const INVITADOS = [
  {
    nombre: "Abrut",
    // Amigo y compañero profesional del sello; invitado a La Nocturna (2026-11-20).
    alias: ["abrut"],
  },
];

/** Todo el line-up del sello: la foto de «todos juntos». */
const ALIAS_TODOS = ["todos", "todos los djs", "todos los artistas", "todo el line up", "line up"];

/** Minúsculas, sin tildes y sin signos: «A.L.L» → «a l l», «Díaz» → «diaz». */
function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const POR_ALIAS = new Map(
  [...ARTISTAS, ...INVITADOS].flatMap((artista) =>
    artista.alias.map((alias) => [normalizar(alias), artista.nombre]),
  ),
);

const NOMBRES_INVITADOS = new Set(INVITADOS.map((i) => i.nombre));

/** Si el nombre (artístico) es de un invitado y no de un residente. */
export function esInvitado(nombre) {
  return NOMBRES_INVITADOS.has(nombre);
}

/**
 * «Franco, Alejo y JLowz» → { artistas: ["A.L.L", "DSTRKT", "J Løwℤ"], desconocidos: [] }.
 *
 * Separa por comas, «y», «+» y «&». Un número al final («Do 2») solo sirve para
 * distinguir archivos y se ignora. «Todos» devuelve a todo el line-up.
 */
export function resolverArtistas(texto) {
  const limpio = texto.replace(/\s+\d+$/, "").trim();
  if (ALIAS_TODOS.includes(normalizar(limpio))) {
    return { artistas: ARTISTAS.map((a) => a.nombre), desconocidos: [] };
  }

  const artistas = [];
  const desconocidos = [];
  for (const trozo of limpio.split(/\s*,\s*|\s+y\s+|\s*\+\s*|\s*&\s*/i)) {
    if (!trozo) continue;
    const nombre = POR_ALIAS.get(normalizar(trozo));
    if (!nombre) desconocidos.push(trozo);
    else if (!artistas.includes(nombre)) artistas.push(nombre);
  }
  return { artistas, desconocidos };
}

/**
 * «A», «A y B», «A, B y C» — y «todos los artistas de Nemorphic» si salen los seis
 * residentes. Un invitado lleva «(invitado especial)» detrás: «Abrut (invitado especial)».
 */
export function nombresNaturales(artistas) {
  const residentes = artistas.filter((n) => !esInvitado(n));
  const invitados = artistas.filter((n) => esInvitado(n)).map((n) => `${n} (invitado especial)`);
  const todos = residentes.length === ARTISTAS.length;
  const partes = [...(todos ? ["todos los artistas de Nemorphic"] : residentes), ...invitados];
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}
