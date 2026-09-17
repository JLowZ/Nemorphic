import { createServerFn } from "@tanstack/react-start";

import { loginSchema } from "@/schemas/admin";

/** Respuesta uniforme del login: nunca dice si falló por clave o por bloqueo. */
type LoginResult = { ok: true } | { ok: false; message: string };

/**
 * Retraso fijo en cada intento fallido. Iguala el tiempo de respuesta entre
 * "clave incorrecta" y "clave correcta", y encarece probar claves en bucle.
 */
const FAILURE_DELAY_MS = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const login = createServerFn({ method: "POST" })
  .validator(loginSchema)
  .handler(async ({ data }): Promise<LoginResult> => {
    const auth = await import("@/lib/auth");

    if (!auth.isAdminConfigured()) {
      console.error(
        "login: faltan SESSION_SECRET o ADMIN_PASSWORD_HASH en las variables de entorno.",
      );
      return { ok: false, message: "El panel aún no está configurado. Avisa al desarrollador." };
    }

    const blockedSeconds = await auth.getLoginBlockSeconds();
    if (blockedSeconds > 0) {
      const minutes = Math.ceil(blockedSeconds / 60);
      return {
        ok: false,
        message: `Demasiados intentos. Espera ${minutes} minuto${minutes === 1 ? "" : "s"} y vuelve a probar.`,
      };
    }

    let valid: boolean;
    try {
      valid = auth.verifyAdminPassword(data.password);
    } catch (error) {
      // Falta configuración en el servidor: se registra completo y al usuario le
      // llega un mensaje que no revela nada del entorno.
      console.error("login:", error);
      return { ok: false, message: "El panel no está configurado. Avisa al desarrollador." };
    }

    if (!valid) {
      await auth.registerFailedLogin();
      await wait(FAILURE_DELAY_MS);
      return { ok: false, message: "Clave incorrecta." };
    }

    await auth.clearFailedLogins();
    // Este navegador pasa a ser conocido: a partir de ahora el bloqueo por IP de
    // un atacante de la misma red ya no lo alcanza.
    await auth.trustCurrentDevice("admin");
    await auth.startAdminSession();
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { endAdminSession } = await import("@/lib/auth");
  await endAdminSession();
  return { ok: true as const };
});

/**
 * Lo consulta la guarda del panel en cada navegación. Devuelve solo un booleano:
 * nunca datos de sesión.
 */
export const getAdminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdmin } = await import("@/lib/auth");
  return { isAdmin: await isAdmin() };
});
