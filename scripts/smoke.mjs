#!/usr/bin/env node
// Smoke test del sitio: levanta `vite dev`, pide la home y verifica que el HTML
// que llega por SSR contiene las secciones y el contenido clave. Sustituye a un
// test runner mientras el proyecto no tenga uno.
//
// Uso: npm run smoke            (usa el dev server)
//      node scripts/smoke.mjs --url http://localhost:3000   (contra un server ya levantado)

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const READY_TIMEOUT_MS = 120_000;
const URL_RE = /(https?:\/\/(?:localhost|127\.0\.0\.1):\d+)/;
// Vite colorea el puerto, así que la URL llega partida por códigos ANSI.
const ANSI_RE = /\[[0-9;]*m/g;

/** Fragmentos que deben aparecer en el HTML de `/`. */
const CHECKS = [
  ['id="inicio"', "sección hero"],
  ['id="quienes"', "sección quiénes somos"],
  ['id="artistas"', "sección artistas"],
  ['id="lanzamientos"', "sección lanzamientos"],
  ['id="eventos"', "sección eventos"],
  ["Bienvenidos a Nemorphic", "título del hero"],
  ["Más que groove", "eslogan"],
  ["J Løwℤ", "primer artista renderizado"],
  ["Blaue Nacht", "último artista renderizado"],
  ["w.soundcloud.com/player", "embed de SoundCloud"],
  // El evento sale de la base, no del JSX: si esto falla, o no hay evento
  // destacado con reservas abiertas, o la consulta se rompió.
  ["UMBRA", "evento destacado"],
  ["Ver todos los eventos", "enlace a la agenda completa"],
  ["/Assets/logo nemorphic.png", "logo desde /Assets"],
  // Las familias cargadas deben coincidir con --nm-font-display y
  // --nm-font-secondary de styles.css, o el sitio cae al fallback del sistema.
  ["family=DM+Serif+Display", "DM Serif Display cargada"],
  ["family=Manrope", "Manrope cargada"],
  ["Reservar mi cupo", "botón de reserva de cupo"],
  // El formulario del boletín vive dentro del modal de contacto, que solo se
  // monta al abrirlo: por SSR solo se puede comprobar el botón que lo abre.
  ['aria-label="Conecta con Nemorphic"', "botón que abre el boletín"],
];

function parseArgs() {
  const i = process.argv.indexOf("--url");
  return i === -1 ? null : process.argv[i + 1];
}

async function fetchHome(baseUrl) {
  const res = await fetch(`${baseUrl}/`, { headers: { accept: "text/html" } });
  const html = await res.text();
  return { status: res.status, html };
}

function startDevServer() {
  // Se invoca el binario de vite con el node actual: `npm run dev` obligaria a
  // usar shell en Windows (npm.cmd) y eso da spawn EINVAL en Node >= 22.
  const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  if (!existsSync(viteBin)) {
    throw new Error("No se encontro node_modules/vite — corre `npm install` primero");
  }
  const child = spawn(process.execPath, [viteBin, "dev"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
  });

  const log = [];
  const url = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`El dev server no arrancó en ${READY_TIMEOUT_MS / 1000}s`)),
      READY_TIMEOUT_MS,
    );
    const onChunk = (buf) => {
      const text = buf.toString().replace(ANSI_RE, "");
      log.push(text);
      const match = URL_RE.exec(text);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout.on("data", onChunk);
    child.stderr.on("data", onChunk);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`El dev server terminó con código ${code}\n${log.join("")}`));
    });
  });

  return { child, url, log };
}

function stopDevServer(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    // taskkill sincrono: matar el arbol de forma asincrona mientras el proceso
    // se esta cerrando hace abortar a libuv.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
}

async function main() {
  const externalUrl = parseArgs();
  let server = null;
  let baseUrl = externalUrl;

  if (!baseUrl) {
    server = startDevServer();
    baseUrl = await server.url;
    // El primer render SSR compila bajo demanda: reintentar hasta que responda.
    for (let attempt = 1; ; attempt++) {
      try {
        await fetchHome(baseUrl);
        break;
      } catch (error) {
        if (attempt >= 20) throw error;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  const { status, html } = await fetchHome(baseUrl);
  const failures = [];

  // El panel de administración no debe entregarse nunca sin sesión.
  const panel = await fetch(`${baseUrl}/admin`, { redirect: "manual" });
  const redirigeAlLogin =
    panel.status >= 300 &&
    panel.status < 400 &&
    (panel.headers.get("location") ?? "").includes("/admin/login");
  if (!redirigeAlLogin) {
    failures.push(
      `GET /admin sin sesión devolvió ${panel.status} en vez de redirigir a /admin/login`,
    );
  }

  // Cada sección del panel se comprueba por separado: una ruta nueva que se
  // olvide de colgar del layout protegido quedaría abierta sin que nadie lo note.
  for (const seccion of ["/admin/reservas", "/admin/suscriptores", "/admin/boletin"]) {
    const respuesta = await fetch(`${baseUrl}${seccion}`, { redirect: "manual" });
    const protegida =
      respuesta.status >= 300 &&
      respuesta.status < 400 &&
      (respuesta.headers.get("location") ?? "").includes("/admin/login");
    if (!protegida) {
      failures.push(
        `GET ${seccion} sin sesión devolvió ${respuesta.status} en vez de redirigir al login`,
      );
    }
  }

  // El control de entrada tiene su propia clave y su propio login.
  const puerta = await fetch(`${baseUrl}/puerta`, { redirect: "manual" });
  const puertaProtegida =
    puerta.status >= 300 &&
    puerta.status < 400 &&
    (puerta.headers.get("location") ?? "").includes("/puerta/login");
  if (!puertaProtegida) {
    failures.push(
      `GET /puerta sin sesión devolvió ${puerta.status} en vez de redirigir a /puerta/login`,
    );
  }

  // La agenda completa: es pública y se renderiza en el servidor, así que tiene
  // que traer los dos eventos en el HTML.
  const agenda = await fetch(`${baseUrl}/eventos`);
  const agendaHtml = await agenda.text();
  for (const [needle, label] of [
    ["Todos los eventos", "título de la agenda"],
    ["UMBRA", "evento en la agenda"],
    ["Sembrando Conciencia", "segundo evento en la agenda"],
  ]) {
    if (agenda.status !== 200 || !agendaHtml.includes(needle)) {
      failures.push(`GET /eventos no trae ${label} (status ${agenda.status})`);
    }
  }

  const puertaLogin = await fetch(`${baseUrl}/puerta/login`);
  const puertaHtml = await puertaLogin.text();
  if (puertaLogin.status !== 200 || !puertaHtml.includes("Clave del evento")) {
    failures.push(`GET /puerta/login no muestra el formulario (status ${puertaLogin.status})`);
  }

  // La baja del boletín es una obligación legal: el enlace del correo tiene que
  // abrir sin sesión. Sin token, la página lo explica en vez de romperse.
  const baja = await fetch(`${baseUrl}/baja`);
  const bajaHtml = await baja.text();
  if (baja.status !== 200 || !bajaHtml.includes("Enlace incompleto")) {
    failures.push(`GET /baja no muestra la página de baja (status ${baja.status})`);
  }
  if (!bajaHtml.includes("noindex")) {
    failures.push("La página de baja no lleva la meta robots noindex");
  }

  const loginPage = await fetch(`${baseUrl}/admin/login`);
  const loginHtml = await loginPage.text();
  if (loginPage.status !== 200 || !loginHtml.includes("Clave de acceso")) {
    failures.push(`GET /admin/login no muestra el formulario (status ${loginPage.status})`);
  }
  if (!loginHtml.includes("noindex")) {
    failures.push("La página de login no lleva la meta robots noindex");
  }

  if (status !== 200) failures.push(`GET / devolvió ${status} (se esperaba 200)`);
  if (/Esta página no pudo cargar|unhandled/i.test(html)) {
    failures.push("La home renderizó la página de error del servidor");
  }
  for (const [needle, label] of CHECKS) {
    if (!html.includes(needle)) failures.push(`Falta ${label} — no se encontró ${needle}`);
  }

  if (server) stopDevServer(server.child);

  if (failures.length > 0) {
    console.error(`\nsmoke: ${failures.length} fallo(s) en ${baseUrl}`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  console.log(
    `smoke: OK — ${CHECKS.length + 13} comprobaciones sobre ${baseUrl} ` +
      `(home ${html.length} bytes, panel de admin protegido)`,
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(`smoke: ${error.message}`);
  process.exit(1);
});
