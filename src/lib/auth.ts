import { Buffer } from "node:buffer";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "node:process";

// `useSession` no es un hook de React, es el helper de sesión de TanStack Start.
// Se importa con alias para que `react-hooks/rules-of-hooks` no lo confunda con un
// hook al llamarlo desde funciones normales del servidor.
import {
  getCookie,
  getRequest,
  getRequestIP,
  setCookie,
  useSession as openSession,
} from "@tanstack/react-start/server";

/**
 * Hay dos accesos distintos, con cookies distintas a propósito:
 *
 *  - `admin`: el equipo del sello. Ve y edita todo.
 *  - `door` : quien atiende la entrada de un evento. Solo puede marcar ingreso y
 *    pago. Su clave cambia en cada evento y se edita desde el panel.
 *
 * Cookies separadas para que una sesión de puerta nunca pueda confundirse con una
 * de admin, y para que alguien del equipo pueda tener las dos abiertas a la vez.
 */
export type Rol = "admin" | "door";

type SesionData = {
  rol?: Rol;
  /** Compatibilidad con las sesiones emitidas antes de existir los roles. */
  admin?: true;
  at?: number;
  /**
   * Huella de la clave de puerta con la que se abrio esta sesion.
   *
   * Sin esto, la cookie se valida sola y cambiar la clave no echaba a nadie: las
   * sesiones abiertas seguian entrando hasta caducar. Comparando la huella en
   * cada peticion, cambiar la clave —o cerrar el acceso— invalida al instante
   * todo lo que se abrio con la anterior.
   */
  huella?: string;
};

const COOKIE: Record<Rol, string> = { admin: "nm_admin", door: "nm_door" };

/** La de puerta dura una noche de evento; la de admin, una jornada de trabajo. */
const DURACION_SEGUNDOS: Record<Rol, number> = { admin: 60 * 60 * 8, door: 60 * 60 * 12 };

const MIN_SECRET_LENGTH = 32;

/** Clave con la que se guarda el hash de la contrasena de puerta. */
const CLAVE_PUERTA = "door_password_hash";

/**
 * Configuración de sesión, o `null` si el entorno no está preparado.
 *
 * No lanza a propósito: un throw aquí convertiría `/admin` en un error 500 con
 * traza. Devolviendo `null` el sitio se comporta como "no hay sesión", redirige al
 * login y allí se explica el problema en un idioma humano.
 */
function getSessionConfig(rol: Rol) {
  const password = env["SESSION_SECRET"];
  if (!password || password.length < MIN_SECRET_LENGTH) return null;

  return {
    password,
    name: COOKIE[rol],
    maxAge: DURACION_SEGUNDOS[rol],
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      // Los navegadores tratan localhost como contexto seguro, así que esto
      // tampoco estorba en desarrollo.
      secure: true,
    },
  } as const;
}

function requireSessionConfig(rol: Rol) {
  const config = getSessionConfig(rol);
  if (!config) {
    throw new Error(
      `Falta SESSION_SECRET o tiene menos de ${MIN_SECRET_LENGTH} caracteres. ` +
        "En local va en .env; en producción, en las variables de entorno de Vercel. " +
        "Genérala con `node scripts/hash-password.mjs`.",
    );
  }
  return config;
}

// --- Sesiones ---------------------------------------------------------------

/**
 * Identifica la clave de puerta vigente sin exponerla.
 *
 * Se deriva del hash guardado, asi que cambia en cuanto se cambia la clave, y
 * es `null` si el acceso esta cerrado. No revela nada: ya es una huella de un
 * hash con sal.
 */
async function huellaClavePuerta(): Promise<string | null> {
  const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
  if (!isDatabaseConfigured()) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", CLAVE_PUERTA)
    .maybeSingle();

  if (error || !data?.value) return null;

  return createHash("sha256").update(data.value).digest("hex").slice(0, 32);
}

/** Solo para las pruebas: comprobar que la huella cambia al cambiar la clave. */
export async function huellaClavePuertaParaPruebas(): Promise<string | null> {
  return huellaClavePuerta();
}

async function tieneSesion(rol: Rol): Promise<boolean> {
  const config = getSessionConfig(rol);
  if (!config) return false;

  const session = await openSession<SesionData>(config);

  if (rol === "admin") {
    return session.data.rol === "admin" || session.data.admin === true;
  }

  if (session.data.rol !== "door") return false;

  // La sesion de puerta vale solo mientras siga vigente la clave con la que se
  // abrio. Si se cambio o se cerro el acceso, deja de servir de inmediato.
  const vigente = await huellaClavePuerta();
  return vigente !== null && session.data.huella === vigente;
}

export async function isAdmin(): Promise<boolean> {
  return tieneSesion("admin");
}

export async function isDoor(): Promise<boolean> {
  return tieneSesion("door");
}

export async function startSession(rol: Rol): Promise<void> {
  const session = await openSession<SesionData>(requireSessionConfig(rol));

  // La de puerta guarda con que clave se abrio, para poder invalidarla despues.
  const huella = rol === "door" ? await huellaClavePuerta() : undefined;

  await session.update({ rol, at: Date.now(), ...(huella ? { huella } : {}) });
}

export async function endSession(rol: Rol): Promise<void> {
  const config = getSessionConfig(rol);
  if (!config) return;

  const session = await openSession<SesionData>(config);
  await session.clear();
}

// Nombres antiguos, para no tocar las llamadas ya existentes del panel.
export const startAdminSession = () => startSession("admin");
export const endAdminSession = () => endSession("admin");

export function isAdminConfigured(): boolean {
  return getSessionConfig("admin") !== null && Boolean(env["ADMIN_PASSWORD_HASH"]);
}

// --- Claves -----------------------------------------------------------------

/** Formato guardado: "<saltHex>:<hashHex>". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

/**
 * Compara una clave contra su hash.
 *
 * `timingSafeEqual` evita que el tiempo de respuesta revele cuántos caracteres del
 * principio son correctos.
 */
export function verifyPassword(input: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  let actual: Buffer;
  try {
    actual = scryptSync(input, Buffer.from(saltHex, "hex"), expected.length);
  } catch {
    return false;
  }

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** La clave del panel vive en una variable de entorno. */
export function verifyAdminPassword(input: string): boolean {
  const stored = env["ADMIN_PASSWORD_HASH"];
  if (!stored) {
    throw new Error(
      "Falta la variable ADMIN_PASSWORD_HASH. Genérala con `node scripts/hash-password.mjs`.",
    );
  }
  return verifyPassword(input, stored);
}

/**
 * La clave de puerta vive en la base, no en el entorno: cambia en cada evento y
 * hacerlo por variable de entorno obligaría a redesplegar cada vez.
 */
export async function verifyDoorPassword(input: string): Promise<boolean> {
  const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
  if (!isDatabaseConfigured()) return false;

  const { data, error } = await getSupabaseAdmin()
    .from("app_settings")
    .select("value")
    .eq("key", CLAVE_PUERTA)
    .maybeSingle();

  // Sin clave configurada, el acceso de puerta está cerrado.
  if (error || !data?.value) return false;

  return verifyPassword(input, data.value);
}

export async function setDoorPassword(password: string): Promise<void> {
  const { getSupabaseAdmin } = await import("@/lib/supabase");

  const { error } = await getSupabaseAdmin()
    .from("app_settings")
    .upsert(
      { key: CLAVE_PUERTA, value: hashPassword(password), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );

  if (error) throw new Error(`No se pudo guardar la clave de puerta: ${error.message}`);
}

export async function doorPasswordIsSet(): Promise<boolean> {
  const { getSupabaseAdmin, isDatabaseConfigured } = await import("@/lib/supabase");
  if (!isDatabaseConfigured()) return false;

  const { data } = await getSupabaseAdmin()
    .from("app_settings")
    .select("updated_at")
    .eq("key", CLAVE_PUERTA)
    .maybeSingle();

  return Boolean(data);
}

// --- Límite de intentos -----------------------------------------------------
//
// Antes se contaba SOLO por IP, y eso tenía un agujero práctico grave: dos
// equipos detrás del mismo router salen a internet con la misma IP pública. Si
// alguien probaba claves desde un PC de la casa (o del mismo bar, o de la misma
// red móvil), el bloqueo caía también sobre el equipo del sello — justo en el
// momento en que hace falta entrar al panel.
//
// Ahora se cuentan dos cosas por separado:
//
//  1. Por DISPOSITIVO (cookie `nm_cid`): es el contador que de verdad frena a
//     quien está probando claves, porque lo normal es que no borre la cookie.
//  2. Por IP: red de seguridad para quien sí la borra en cada intento. Es más
//     laxo y solo se aplica a dispositivos desconocidos.
//
// Y un dispositivo que YA entró bien alguna vez lleva un sello firmado con
// SESSION_SECRET (`nm_trust_*`, no falsificable): ese queda fuera del contador
// por IP y tiene su propio margen, amplio y con bloqueo corto. Resultado: el
// ataque de alguien de tu misma red le cae encima a esa persona, no a ti.
//
// En serverless cada instancia tiene su propio mapa y se reinicia sola, así que
// esto no es una barrera perfecta. Sí frena el caso real que importa: alguien
// probando claves en bucle contra una instancia caliente.

type Intento = { count: number; firstAt: number; blockedUntil: number };

const intentos = new Map<string, Intento>();

const VENTANA_MS = 15 * 60 * 1000;

/** Dispositivo desconocido: pocos intentos y bloqueo largo. */
const MAX_DISPOSITIVO = 8;
const BLOQUEO_DISPOSITIVO_MS = 15 * 60 * 1000;

/**
 * Dispositivo que ya entró antes: margen amplio y bloqueo corto. Sigue habiendo
 * freno (por si te roban el portátil ya usado), pero no te deja fuera media hora
 * por teclear mal la clave la noche de un evento.
 */
const MAX_CONFIABLE = 25;
const BLOQUEO_CONFIABLE_MS = 2 * 60 * 1000;

/** Red de seguridad por IP, solo para dispositivos desconocidos. */
const MAX_IP = 40;
const BLOQUEO_IP_MS = 15 * 60 * 1000;

/** Identificador de navegador. No es un secreto: solo separa contadores. */
const COOKIE_DISPOSITIVO = "nm_cid";
const UN_ANO_SEGUNDOS = 60 * 60 * 24 * 365;

/** Cuánto vale el sello de "este navegador ya entró bien". */
const CONFIANZA_SEGUNDOS = 60 * 60 * 24 * 60;

// Una misma petición puede preguntar el bloqueo y luego anotar el fallo. Sin
// esta caché se generarían dos ids y se mandarían dos cookies distintas.
const dispositivoPorPeticion = new WeakMap<Request, string>();

function idDispositivo(): string {
  const peticion = getRequest();
  const cacheado = dispositivoPorPeticion.get(peticion);
  if (cacheado) return cacheado;

  let id = getCookie(COOKIE_DISPOSITIVO);
  if (!id || !/^[0-9a-f]{32}$/.test(id)) {
    id = randomBytes(16).toString("hex");
    setCookie(COOKIE_DISPOSITIVO, id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: UN_ANO_SEGUNDOS,
    });
  }

  dispositivoPorPeticion.set(peticion, id);
  return id;
}

/** Cookie sellada aparte de la sesión: sobrevive al cierre de sesión y al caducar. */
function configConfianza(rol: Rol) {
  const password = env["SESSION_SECRET"];
  if (!password || password.length < MIN_SECRET_LENGTH) return null;

  return {
    password,
    name: `nm_trust_${rol}`,
    maxAge: CONFIANZA_SEGUNDOS,
    cookie: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
  } as const;
}

type Sello = { rol?: Rol; huella?: string };

async function esDispositivoDeConfianza(rol: Rol): Promise<boolean> {
  const config = configConfianza(rol);
  if (!config) return false;

  const sello = await openSession<Sello>(config);
  if (sello.data.rol !== rol) return false;
  if (rol === "admin") return true;

  // La clave de puerta rota en cada evento. Sin esto, el portátil de quien
  // atendió un evento pasado conservaría el margen amplio y la exención del tope
  // por IP contra la clave NUEVA, que es justo el fraude que se quiere evitar.
  // Atado a la huella, cambiar la clave le devuelve el trato de desconocido.
  const vigente = await huellaClavePuerta();
  return vigente !== null && sello.data.huella === vigente;
}

/**
 * Marca este navegador como conocido. Se llama solo tras validar la clave, así
 * que la única forma de conseguir el sello es saberla.
 */
export async function trustCurrentDevice(rol: Rol = "admin"): Promise<void> {
  const config = configConfianza(rol);
  if (!config) return;

  const sello = await openSession<Sello>(config);
  const huella = rol === "door" ? await huellaClavePuerta() : undefined;

  await sello.update({ rol, ...(huella ? { huella } : {}) });
}

function claveDispositivo(ambito: Rol): string {
  return `${ambito}:d:${idDispositivo()}`;
}

function claveIp(ambito: Rol): string {
  // Vercel siempre pone x-forwarded-for, y el cliente no puede falsificarlo
  // porque el proxy lo reescribe.
  return `${ambito}:i:${getRequestIP({ xForwardedFor: true }) ?? "desconocido"}`;
}

function limpiar(ahora: number): void {
  for (const [clave, intento] of intentos) {
    if (ahora > intento.blockedUntil && ahora - intento.firstAt > VENTANA_MS) {
      intentos.delete(clave);
    }
  }
}

function segundosDeBloqueo(clave: string, ahora: number): number {
  const intento = intentos.get(clave);
  if (!intento || ahora >= intento.blockedUntil) return 0;

  return Math.ceil((intento.blockedUntil - ahora) / 1000);
}

function anotarFallo(clave: string, ahora: number, max: number, bloqueoMs: number): void {
  const intento = intentos.get(clave);

  if (!intento || ahora - intento.firstAt > VENTANA_MS) {
    intentos.set(clave, { count: 1, firstAt: ahora, blockedUntil: 0 });
    return;
  }

  intento.count += 1;
  if (intento.count >= max) {
    intento.blockedUntil = ahora + bloqueoMs;
    intento.count = 0;
    intento.firstAt = ahora;
  }
}

/** Segundos que faltan para poder reintentar, o 0 si se puede intentar ya. */
export async function getLoginBlockSeconds(ambito: Rol = "admin"): Promise<number> {
  const ahora = Date.now();
  limpiar(ahora);

  const propio = segundosDeBloqueo(claveDispositivo(ambito), ahora);

  // Un dispositivo conocido responde solo por lo suyo: lo que haga otra máquina
  // de la misma red no lo toca.
  if (await esDispositivoDeConfianza(ambito)) return propio;

  return Math.max(propio, segundosDeBloqueo(claveIp(ambito), ahora));
}

export async function registerFailedLogin(ambito: Rol = "admin"): Promise<void> {
  const ahora = Date.now();
  const confiable = await esDispositivoDeConfianza(ambito);

  anotarFallo(
    claveDispositivo(ambito),
    ahora,
    confiable ? MAX_CONFIABLE : MAX_DISPOSITIVO,
    confiable ? BLOQUEO_CONFIABLE_MS : BLOQUEO_DISPOSITIVO_MS,
  );

  if (!confiable) anotarFallo(claveIp(ambito), ahora, MAX_IP, BLOQUEO_IP_MS);
}

export async function clearFailedLogins(ambito: Rol = "admin"): Promise<void> {
  intentos.delete(claveDispositivo(ambito));
  intentos.delete(claveIp(ambito));
}
