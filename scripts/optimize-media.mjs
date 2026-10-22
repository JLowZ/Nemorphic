#!/usr/bin/env node
// Prepara las fotos y vídeos de los eventos para la web: genera las variantes
// optimizadas en public/Assets/eventos/<slug>/ y escribe el SQL que las registra
// en la tabla `event_media` (migración 0008).
//
//   node scripts/optimize-media.mjs                      todos los eventos
//   node scripts/optimize-media.mjs --evento "UMBRA"     solo esa carpeta
//   node scripts/optimize-media.mjs --force              regenera aunque ya existan
//   node scripts/optimize-media.mjs --sin-audio          quita el audio (por defecto se conserva)
//   node scripts/optimize-media.mjs --max-seg 30         recorta los vídeos (30 s por defecto; 0 = no)
//
// ORIGINALES (no se suben a git; pesan decenas de MB):
//
//   media-fuente/eventos/<Nombre del evento>/[N ]<Foto|Video> <artistas>.<ext>
//
//   media-fuente/eventos/UMBRA/3 Video Do.mp4
//   media-fuente/eventos/Opening Nemorphic/1 Video JLowz y DSTRKT.mp4
//   media-fuente/eventos/Nemorphic Pool Party/1 Foto Todos.jpeg
//
// El nombre del archivo es el contenido: «Foto» o «Video», y lo que sigue son los
// artistas que se ven. Se acepta cualquier nombre o alias conocido (Franco, Diaz,
// Tiba, JD…, ver scripts/artistas.mjs), pero en la web siempre sale el nombre
// artístico: «Franco» se publica como «A.L.L». Dos o más artistas se separan con
// «y» o con comas. «Todos» es todo el line-up. Un número delante fija el orden en el
// carrusel; sin número, orden alfabético. Lo que no se vaya a usar va a una
// subcarpeta (p. ej. `_sin-usar/`): el script no la mira.
//
// Máximo recomendado: 6 piezas por evento (un vídeo por artista). Más de 6 solo avisa.
//
// SALIDA (esto sí se sube):
//
//   public/Assets/eventos/<slug>/foto-<dj>-480.<huella>.webp · -800 · -1200
//   public/Assets/eventos/<slug>/video-<dj>.<huella>.mp4 y video-<dj>-portada.<huella>.webp
//
// La <huella> son 8 caracteres del contenido del archivo. Vercel sirve /Assets con
// `cache-control: immutable` (un año): si un archivo cambiara SIN cambiar de nombre, los
// navegadores que ya lo bajaron seguirían con la versión vieja (pasó: los vídeos sin
// audio). Con huella, un archivo distinto es una URL distinta y nunca hay caché vieja.
//   media-fuente/eventos/<Nombre del evento>/cargar.sql   ← se pega en Supabase
//
// El <slug> sale del nombre de la carpeta y tiene que coincidir con `events.slug`.
// El SQL termina con un `returning`: si devuelve 0 filas, el slug no coincide.
//
// Requiere `ffmpeg` en el PATH (o en la variable FFMPEG) solo para los vídeos.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { rm } from "node:fs/promises";
import { basename, extname, join, parse } from "node:path";

import sharp from "sharp";

import { ARTISTAS, nombresNaturales, resolverArtistas } from "./artistas.mjs";

const RAIZ_FUENTE = "media-fuente/eventos";
const RAIZ_SALIDA = "public/Assets/eventos";

/** Anchos de las fotos. El navegador elige uno según su pantalla (srcset). */
const ANCHOS = [480, 800, 1200];
/** La variante que se usa como `src` y de la que salen width y height. */
const ANCHO_BASE = 800;
const CALIDAD_WEBP = 78;
/** Los vídeos se muestran en tarjetas pequeñas: 540 px de ancho sobra. */
const ANCHO_VIDEO = 540;
const CRF_VIDEO = 30;
/** Tope de bitrate: sin él, un clip ruidoso (luces, humo) se dispara a 10 MB. */
const BITRATE_MAX = "900k";
const AVISO_FOTO_KB = 180;
const AVISO_VIDEO_MB = 4;
const MAX_FPS = 30;
/** Piezas recomendadas por evento: un vídeo por artista. */
const MAX_PIEZAS = 6;

const FFMPEG = process.env["FFMPEG"] ?? "ffmpeg";
const FFPROBE = process.env["FFPROBE"] ?? FFMPEG.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");

const EXT_FOTO = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tif", ".tiff"]);
const EXT_VIDEO = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"]);

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
/** El audio se conserva: quien reproduce un vídeo espera oírlo. */
const SIN_AUDIO = args.includes("--sin-audio");
const iMax = args.indexOf("--max-seg");
/** Duración máxima de cada vídeo, en segundos. 0 = sin recorte. */
const MAX_SEG = iMax === -1 ? 30 : Number(args[iMax + 1]);
const iEvento = args.indexOf("--evento");
const SOLO_EVENTO = iEvento === -1 ? null : args[iEvento + 1];

const avisos = [];

function slugify(texto) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function sql(texto) {
  return `'${String(texto).replaceAll("'", "''")}'`;
}

function ffmpegDisponible() {
  return spawnSync(FFMPEG, ["-version"], { stdio: "ignore" }).status === 0;
}

/**
 * «2 Foto Blaue Nacht.jpg» → { orden: 2, tipo: "foto", dj: "Blaue Nacht" }.
 * Devuelve null si el nombre no sigue el patrón, para avisar en vez de adivinar.
 */
function interpretar(nombreBase) {
  const m = /^(?:(\d+)[\s._-]+)?(foto|video|vídeo)(?:[\s._-]+(.*))?$/i.exec(nombreBase.trim());
  if (!m) return null;
  return {
    orden: m[1] ? Number(m[1]) : null,
    tipo: m[2].toLowerCase().startsWith("v") ? "video" : "foto",
    dj: (m[3] ?? "").trim(),
  };
}

function textoAlternativo(tipo, artistas, evento) {
  const que = tipo === "video" ? "Vídeo" : "Foto";
  return artistas.length > 0
    ? `${que} de ${nombresNaturales(artistas)} en ${evento}`
    : `${que} de ${evento}`;
}

/** Los 8 primeros caracteres del hash del contenido. */
function huella(archivo) {
  return createHash("sha1").update(readFileSync(archivo)).digest("hex").slice(0, 8);
}

/**
 * `base.ext` → `base.<huella>.ext`. Devuelve la ruta nueva. Si ya existe un archivo con
 * ese nombre, el contenido es idéntico por construcción y basta con borrar el sobrante.
 */
function sellar(ruta) {
  const { dir, name, ext } = parse(ruta);
  const sellada = join(dir, `${name}.${huella(ruta)}${ext}`);
  if (existsSync(sellada)) rmSync(ruta);
  else renameSync(ruta, sellada);
  return sellada;
}

/** `nombre.<huella>.ext` ya generado, si existe. */
function buscarSellado(dir, nombre, ext) {
  const patron = new RegExp(
    `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.[0-9a-f]{8}${ext}$`,
  );
  const encontrado = readdirSync(dir).find((f) => patron.test(f));
  return encontrado ? join(dir, encontrado) : null;
}

/** Borra las versiones anteriores de un archivo (con huella o sin ella). */
function borrarSalidas(dir, nombre, ext) {
  const previo = buscarSellado(dir, nombre, ext);
  if (previo) rmSync(previo);
  rmSync(join(dir, `${nombre}${ext}`), { force: true });
}

/**
 * El archivo ya generado y sellado de `nombre`, o el de una versión anterior del script
 * sin huella, que se sella (mismo contenido, nombre nuevo). Null si hay que generarlo.
 */
function existente(dir, nombre, ext) {
  if (FORCE) {
    borrarSalidas(dir, nombre, ext);
    return null;
  }
  const sellado = buscarSellado(dir, nombre, ext);
  if (sellado) return sellado;
  const antiguo = join(dir, `${nombre}${ext}`);
  return existsSync(antiguo) ? sellar(antiguo) : null;
}

async function procesarFoto(origen, carpetaSalida, rutaPublica, base) {
  const salidas = [];
  const meta = await sharp(origen).rotate().metadata();
  // `rotate()` sin argumentos aplica la orientación EXIF; sin ella una foto de
  // móvil saldría girada. Las dimensiones reales son las de DESPUÉS de girar.
  const anchoOriginal =
    meta.orientation && meta.orientation >= 5 ? (meta.height ?? 0) : (meta.width ?? 0);

  for (const ancho of ANCHOS) {
    // No se agranda nunca: una foto de 700 px no gana nada con un «1200w».
    const real = Math.min(ancho, anchoOriginal || ancho);
    if (salidas.some((s) => s.ancho === real)) continue;

    const nombre = `${base}-${ancho}`;
    let destino = existente(carpetaSalida, nombre, ".webp");
    if (!destino) {
      const temporal = join(carpetaSalida, `${nombre}.webp`);
      await sharp(origen)
        .rotate()
        .resize({ width: real, withoutEnlargement: true })
        .webp({ quality: CALIDAD_WEBP, effort: 5 })
        .toFile(temporal);
      destino = sellar(temporal);
    }
    const info = await sharp(destino).metadata();
    salidas.push({ ancho: real, ruta: `${rutaPublica}/${basename(destino)}`, destino, info });
  }

  const principal = salidas.find((s) => s.ancho === ANCHO_BASE) ?? salidas[salidas.length - 1];

  for (const s of salidas) {
    const peso = statSync(s.destino).size;
    if (s.ancho === principal.ancho && peso > AVISO_FOTO_KB * 1024) {
      avisos.push(
        `${base}: la variante de ${s.ancho}px pesa ${kb(peso)} (objetivo < ${AVISO_FOTO_KB} KB)`,
      );
    }
  }

  return {
    kind: "photo",
    src: principal.ruta,
    srcset: salidas.map((s) => `${s.ruta} ${s.info.width}w`).join(", "),
    poster: null,
    width: principal.info.width,
    height: principal.info.height,
    pesos: salidas.map((s) => statSync(s.destino).size),
  };
}

function sondear(archivo) {
  const r = spawnSync(
    FFPROBE,
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", archivo],
    { encoding: "utf8" },
  );
  return Number.parseFloat(r.stdout) || 0;
}

async function procesarVideo(origen, carpetaSalida, rutaPublica, base) {
  let destino = existente(carpetaSalida, base, ".mp4");

  if (!destino) {
    const temporal = join(carpetaSalida, `${base}.mp4`);
    const filtros = `scale='min(${ANCHO_VIDEO},iw)':-2`;
    const original = sondear(origen);
    const recortar = MAX_SEG > 0 && original > MAX_SEG;
    if (recortar) {
      avisos.push(
        `${base}.mp4: recortado a los primeros ${MAX_SEG} s (el original dura ${original.toFixed(0)} s)`,
      );
    }
    const r = spawnSync(
      FFMPEG,
      [
        "-y",
        "-i",
        origen,
        "-vf",
        filtros,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        String(CRF_VIDEO),
        "-maxrate",
        BITRATE_MAX,
        "-bufsize",
        "1800k",
        "-pix_fmt",
        "yuv420p",
        // Un vídeo a 50 o 60 fps pesa el doble sin que en una tarjeta se note.
        "-fpsmax",
        String(MAX_FPS),
        ...(recortar ? ["-t", String(MAX_SEG)] : []),
        // El MP4 se puede empezar a ver antes de bajarse entero.
        "-movflags",
        "+faststart",
        ...(SIN_AUDIO ? ["-an"] : ["-c:a", "aac", "-b:a", "96k", "-ac", "2"]),
        temporal,
      ],
      { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`ffmpeg falló con ${origen}:\n${r.stderr?.slice(-600)}`);
    destino = sellar(temporal);
  }

  let portada = existente(carpetaSalida, `${base}-portada`, ".webp");
  if (!portada) {
    const frame = join(carpetaSalida, `${base}-frame.png`);
    const temporal = join(carpetaSalida, `${base}-portada.webp`);
    // Un segundo adentro evita el fotograma negro con que empiezan muchos clips.
    const duracion = sondear(destino);
    const t = duracion > 2 ? "1" : "0";
    const r = spawnSync(FFMPEG, ["-y", "-ss", t, "-i", destino, "-frames:v", "1", frame], {
      stdio: "ignore",
    });
    if (r.status !== 0) throw new Error(`No se pudo sacar la portada de ${origen}`);
    await sharp(frame).webp({ quality: CALIDAD_WEBP, effort: 5 }).toFile(temporal);
    await rm(frame, { force: true });
    portada = sellar(temporal);
  }

  const info = await sharp(portada).metadata();
  const peso = statSync(destino).size;
  if (peso > AVISO_VIDEO_MB * 1024 * 1024) {
    avisos.push(
      `${base}.mp4 pesa ${(peso / 1048576).toFixed(1)} MB (objetivo < ${AVISO_VIDEO_MB} MB)`,
    );
  }

  return {
    kind: "video",
    src: `${rutaPublica}/${basename(destino)}`,
    srcset: null,
    poster: `${rutaPublica}/${basename(portada)}`,
    width: info.width,
    height: info.height,
    pesos: [peso, statSync(portada).size],
  };
}

function generarSql(slug, piezas) {
  const valor = (v, tipo) =>
    v === null ? `null::${tipo}` : `${tipo === "integer" ? v : sql(v)}::${tipo}`;
  const filas = piezas
    .map(
      (p) =>
        `    (${[
          valor(p.kind, "text"),
          valor(p.src, "text"),
          valor(p.srcset, "text"),
          valor(p.poster, "text"),
          valor(p.width, "integer"),
          valor(p.height, "integer"),
          valor(p.alt, "text"),
          `array[${p.artists.map(sql).join(", ")}]::text[]`,
          valor(p.posicion, "integer"),
        ].join(", ")})`,
    )
    .join(",\n");

  return `-- Generado por scripts/optimize-media.mjs — pega esto en el SQL Editor de Supabase.
-- Requiere la migración 0008 aplicada y el evento creado (0009). Se puede pegar las veces
-- que haga falta: siempre deja la media del evento exactamente como está aquí.

-- Este archivo es el estado COMPLETO de la media del evento: primero se borra lo que había
-- y luego se inserta. Hace falta porque los archivos llevan huella en el nombre: si uno
-- cambia, su fila antigua (con el nombre viejo) no se actualizaría sino que se duplicaría.
delete from public.event_media
where event_id in (select id from public.events where slug = ${sql(slug)});

insert into public.event_media (event_id, kind, src, srcset, poster, width, height, alt, artists, position)
select e.id, v.kind, v.src, v.srcset, v.poster, v.width, v.height, v.alt, v.artists, v.position
from public.events e
cross join (values
${filas}
) as v(kind, src, srcset, poster, width, height, alt, artists, position)
where e.slug = ${sql(slug)}
on conflict (event_id, src) do update
  set srcset = excluded.srcset, poster = excluded.poster, width = excluded.width,
      height = excluded.height, alt = excluded.alt, artists = excluded.artists,
      position = excluded.position
returning kind, src, position;
-- Si «returning» devuelve 0 filas, no existe un evento con slug ${sql(slug)}.
`;
}

/**
 * Lee y valida los archivos de un evento sin tocar nada. Devuelve las entradas en
 * el orden en que saldrán en el carrusel y los errores que impiden continuar.
 */
function leerEntradas(carpeta) {
  const origenDir = join(RAIZ_FUENTE, carpeta);
  const entradas = [];
  const errores = [];

  for (const archivo of readdirSync(origenDir)) {
    const { name, ext } = parse(archivo);
    const e = ext.toLowerCase();
    if (!EXT_FOTO.has(e) && !EXT_VIDEO.has(e)) continue; // cargar.sql, subcarpetas, notas…

    const dato = interpretar(name);
    if (!dato) {
      errores.push(`${carpeta}/${archivo}: el nombre debe empezar por «Foto» o «Video»`);
      continue;
    }
    const esVideo = EXT_VIDEO.has(e);
    if ((dato.tipo === "video") !== esVideo) {
      errores.push(
        `${carpeta}/${archivo}: el nombre dice «${dato.tipo}» pero el archivo es ${esVideo ? "un vídeo" : "una imagen"}`,
      );
      continue;
    }

    if (dato.dj === "") {
      errores.push(`${carpeta}/${archivo}: falta el artista (p. ej. «Video Do.mp4»)`);
      continue;
    }
    const { artistas, desconocidos } = resolverArtistas(dato.dj);
    if (desconocidos.length > 0) {
      errores.push(
        `${carpeta}/${archivo}: no conozco a «${desconocidos.join("», «")}». ` +
          "Corrige el nombre o añádelo a scripts/artistas.mjs",
      );
      continue;
    }
    entradas.push({ archivo, ...dato, artistas });
  }

  // Sin número delante, por nombre; con número, por número primero.
  entradas.sort(
    (a, b) =>
      (a.orden ?? 1e6) - (b.orden ?? 1e6) ||
      a.archivo.localeCompare(b.archivo, "es", { numeric: true }),
  );

  return { entradas, errores };
}

async function procesarEvento(carpeta, entradas) {
  const nombreEvento = carpeta;
  const slug = slugify(nombreEvento);
  const origenDir = join(RAIZ_FUENTE, carpeta);
  const salidaDir = join(RAIZ_SALIDA, slug);
  const rutaPublica = `/Assets/eventos/${slug}`;

  console.log(`\n${nombreEvento}  →  slug «${slug}»`);

  if (entradas.length === 0) {
    console.log("  (sin fotos ni vídeos)");
    return;
  }
  mkdirSync(salidaDir, { recursive: true });

  const usados = new Set();
  const piezas = [];

  for (const [i, entrada] of entradas.entries()) {
    const origen = join(origenDir, entrada.archivo);
    // «video-do-y-dstrkt», y si dos piezas coinciden, «…-2».
    let base = `${entrada.tipo}-${slugify(entrada.dj) || "evento"}`;
    for (let n = 2; usados.has(base); n += 1) {
      base = `${entrada.tipo}-${slugify(entrada.dj) || "evento"}-${n}`;
    }
    usados.add(base);

    const pieza =
      entrada.tipo === "video"
        ? await procesarVideo(origen, salidaDir, rutaPublica, base)
        : await procesarFoto(origen, salidaDir, rutaPublica, base);

    pieza.artists = entrada.artistas;
    pieza.alt = textoAlternativo(entrada.tipo, entrada.artistas, nombreEvento);
    pieza.posicion = i + 1;
    piezas.push(pieza);

    const total = pieza.pesos.reduce((a, b) => a + b, 0);
    console.log(
      `  ${String(i + 1).padStart(2)}. ${entrada.archivo}  →  ${base}  [${entrada.artistas.join(" + ")}]  (${pieza.width}×${pieza.height}, ${kb(total)})`,
    );
  }

  // Quién sale y quién no. «No aparecen» no es un error: puede que no tocaran esa noche.
  const salen = new Set(piezas.flatMap((p) => p.artists));
  const faltan = ARTISTAS.map((a) => a.nombre).filter((n) => !salen.has(n));
  console.log(`  Salen: ${[...salen].join(", ")}`);
  if (faltan.length > 0) console.log(`  No aparecen: ${faltan.join(", ")}`);
  if (piezas.length > MAX_PIEZAS) {
    avisos.push(`${nombreEvento}: tiene ${piezas.length} piezas (lo recomendado es ${MAX_PIEZAS})`);
  }

  const archivoSql = join(origenDir, "cargar.sql");
  writeFileSync(archivoSql, generarSql(slug, piezas), "utf8");
  console.log(`  SQL: ${archivoSql}`);
}

async function main() {
  if (!existsSync(RAIZ_FUENTE)) {
    console.error(
      `No existe ${RAIZ_FUENTE}/.\nCrea una carpeta por evento con sus originales, por ejemplo:\n` +
        `  ${RAIZ_FUENTE}/UMBRA/Foto Blaue Nacht.jpg`,
    );
    process.exit(1);
  }

  const carpetas = readdirSync(RAIZ_FUENTE).filter(
    (nombre) =>
      statSync(join(RAIZ_FUENTE, nombre)).isDirectory() && (!SOLO_EVENTO || nombre === SOLO_EVENTO),
  );

  if (carpetas.length === 0) {
    console.error(SOLO_EVENTO ? `No hay carpeta «${SOLO_EVENTO}».` : "No hay carpetas de eventos.");
    process.exit(1);
  }

  const hayVideos = carpetas.some((c) =>
    readdirSync(join(RAIZ_FUENTE, c)).some((f) => EXT_VIDEO.has(extname(f).toLowerCase())),
  );
  if (hayVideos && !ffmpegDisponible()) {
    console.error(`Hay vídeos pero no encuentro ffmpeg («${FFMPEG}»). Instálalo o define FFMPEG.`);
    process.exit(1);
  }

  // Primero se valida todo: un nombre mal escrito debe fallar antes de gastar
  // minutos comprimiendo vídeos, no después.
  const lecturas = carpetas.map((carpeta) => ({ carpeta, ...leerEntradas(carpeta) }));
  const errores = lecturas.flatMap((l) => l.errores);
  if (errores.length > 0) {
    console.error("No se procesó nada. Corrige esto y vuelve a correrlo:\n");
    for (const error of errores) console.error(`  - ${error}`);
    process.exit(1);
  }

  for (const { carpeta, entradas } of lecturas) await procesarEvento(carpeta, entradas);

  if (avisos.length > 0) {
    console.log("\nAvisos:");
    for (const aviso of avisos) console.log(`  - ${aviso}`);
  }
  console.log(
    "\nSiguiente: pega cada cargar.sql en el SQL Editor de Supabase (con las migraciones 0008 y 0009 aplicadas).",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
