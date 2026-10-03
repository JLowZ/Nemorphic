# Nemorphic — guía de trabajo

Sitio del sello techno **Nemorphic** (español, one-page). El proyecto ya no se
edita desde el editor de Lovable, pero el **build sigue siendo suyo**: ver
`AGENTS.md` para qué se puede tocar y qué no.

## Stack

| Pieza         | Qué se usa                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Framework     | TanStack Start 1.168 + TanStack Router 1.170 (file-based routing)                               |
| UI            | React 19, TypeScript 5.8 (`strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`) |
| Estilos       | Tailwind CSS v4 (plugin de Vite) + CSS propio en `src/styles.css` (prefijo `nm-`)               |
| Componentes   | shadcn/ui (new-york, 46 componentes en `src/components/ui/`) + Radix + lucide-react             |
| Datos/estado  | TanStack Query 5 (provider montado en `__root.tsx`) + Supabase (Postgres)                       |
| Formularios   | react-hook-form + zod + `@hookform/resolvers`                                                   |
| Toasts        | sonner — `<Toaster />` montado en `__root.tsx`. Nunca `window.alert`                            |
| Build         | Vite 8 vía `@lovable.dev/vite-tanstack-config`                                                  |
| Deploy        | **Vercel** (Node). Nitro elige el preset por entorno; ver «Despliegue»                          |
| Runtime local | Node 24 + npm (hay `bun.lock` y `bunfig.toml`, pero **bun no está instalado**: usar npm)        |

## Comandos

```sh
npm install        # node_modules no viene en el repo
npm run dev        # vite dev
npm run typecheck  # tsc --noEmit
npm run lint       # eslint .
npm run format     # prettier --write .
npm run smoke      # levanta dev y verifica que la home renderiza (SSR) sin errores
npm run check      # typecheck + lint + smoke  ← ejecutar antes de dar por terminado un cambio
npm run build      # build de producción (Nitro/Cloudflare)

node scripts/optimize-images.mjs            # informe de peso de public/Assets
node scripts/optimize-images.mjs --apply    # reprocesa y sobrescribe

npm run db:status    # qué migraciones de supabase/migrations/ están aplicadas
npm run test:panel   # pruebas de funcionalidad y seguridad contra la base real
```

`db:status` y `test:panel` leen `.env` con `--env-file`, así que necesitan las
variables de Supabase. `test:panel` crea filas de prueba con correos
`@ejemplo.test` y las borra al terminar.

`npm run check` es la verificación mínima de cualquier cambio. No hay test
runner instalado; `scripts/smoke.mjs` cumple ese rol para el HTML renderizado.

Sobre el smoke test:

- Levanta `vite dev` (puerto 8080, o el siguiente libre), pide `/` y comprueba
  que el HTML de SSR trae las 5 secciones, el hero, el eslogan, los artistas del
  array, el embed de SoundCloud, el evento y el logo — y que no cayó en la página
  de error del servidor. Al terminar mata el árbol de procesos del dev server.
- Contra un servidor ya levantado: `node scripts/smoke.mjs --url http://localhost:8080`.
- Cuando agregues secciones o features (newsletter, reservas), **agrega su
  comprobación al array `CHECKS`** de `scripts/smoke.mjs`.

Notas de entorno (Windows):

- El checkout usa CRLF (`core.autocrlf=true`); por eso `.prettierrc` tiene
  `endOfLine: "auto"`. Sin eso, `npm run lint` reportaba ~5600 errores falsos.
- Quedan 6 `warning` de `react-refresh/only-export-components` en `src/components/ui/`
  (código de shadcn). Son preexistentes: el objetivo es **0 errores**, no 0 warnings.

## Mapa del proyecto

```
src/
  routes/
    __root.tsx        shell HTML, <head>, QueryClientProvider, 404 y error boundary
    index.tsx         TODA la landing (~600 líneas): nav, hero, quiénes somos,
                      artistas, lanzamientos, evento destacado, modales y newsletter
    eventos.tsx       agenda pública: todos los eventos abiertos, con reserva directa
    admin/            panel privado: login, layout protegido `_panel` y secciones
    puerta/           control de entrada: login y layout protegido `_lista`
    routeTree.gen.ts  AUTOGENERADO — no editar a mano
  components/
    nemorphic/        Modal.tsx (modal propio, no Radix) y SocialIcons.tsx (SVG inline)
    ui/               shadcn/ui — reutilizar antes de escribir un componente nuevo
  data/nemorphic.ts   artistas[] y lanzamientos[] (contenido hardcodeado + constantes LOGO/HERO_BG)
  lib/                auth.ts (sesiones y claves), supabase.ts (cliente de servidor),
                      require-admin.ts (guardas), utils.ts y reporte de errores
  actions/            server functions llamables desde el cliente por RPC
  schemas/            schemas zod compartidos entre cliente y servidor
  start.ts            middlewares de servidor: manejo de errores + CSRF para server functions
  server.ts           entry SSR que normaliza errores 500 tragados por h3
public/Assets/        imágenes reales (rutas con mayúscula y espacios: "/Assets/logo nemorphic.png")
supabase/migrations/  SQL versionado; se aplica a mano en el SQL Editor de Supabase
scripts/              verificación (smoke, test:panel, db:status) y utilidades
tests/                arnés de pruebas del panel — NUNCA bajo src/routes/, contiene borrados
docs/                 documentación: arquitectura, base de datos y guía de operación
```

## Convenciones

- **Routing**: solo file-based en `src/routes/`. Nada de `src/pages/` ni `app/`.
  Ver `src/routes/README.md` para la tabla de convenciones.
- **Estilos**: la landing usa clases propias `nm-*` de `src/styles.css` con las
  variables `--nm-black/--nm-violet/--nm-pink/--nm-font-display`. Mantener esa
  paleta; Tailwind se usa para utilidades puntuales, no para reescribir el diseño.
- **Idioma**: todo el texto visible y los `alt` van en español.
- **Assets**: usar siempre las rutas reales bajo `/Assets/...` (respetar mayúsculas;
  espacios como `%20` en JSX).
- **Imports**: alias `@/*` → `src/*` disponible; el código actual usa rutas relativas.
- **TS estricto**: con `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`,
  indexar arrays da `T | undefined` y los opcionales no aceptan `undefined` explícito.
- **Prettier**: 100 columnas, comillas dobles. Correr `npm run format` al terminar.
- **Nunca `src/server/`**: la config de Lovable prohíbe que el cliente importe de
  `**/server/**` con `behavior: "error"`. `npm run dev` lo tolera, pero
  `npm run build` falla y el despliegue se cae. Las server functions van en
  `src/actions/`.
- **Dependencias**: `bunfig.toml` impone 24 h mínimas desde la publicación de un
  paquete. Preguntar antes de añadir una dependencia nueva.
- **Git**: no reescribir historia publicada (rebase/amend/squash/force-push).
  `main` está en GitHub y reescribirlo rompe el clon de cualquiera que lo tenga.

## Documentación

| Documento               | Para qué                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `README.md`             | Puerta de entrada del repo: qué es, cómo arrancarlo, arquitectura            |
| `docs/arquitectura.md`  | Cómo encaja todo y por qué. Léelo antes de tocar sesiones o server functions |
| `docs/base-de-datos.md` | Esquema tabla por tabla, migraciones y reglas de consulta                    |
| `docs/operacion.md`     | Para el equipo del sello: usar el panel y la puerta en un evento             |
| `roadmap.md`            | Qué falta y en qué orden                                                     |

## Skills del proyecto

Están en `.claude/skills/`. Invócalas con `/nombre` o deja que se activen solas.
Antes de escribir código, revisa si hay una que cubra la tarea.

| Skill          | Cuándo                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------- |
| `server-fn`    | Cualquier formulario o escritura: schema zod + server function + react-hook-form + sonner |
| `db`           | Supabase: tablas, migraciones, RLS, consultas                                             |
| `email`        | Enviar correo: proveedor, plantilla, lotes, baja                                          |
| `admin`        | Panel `/admin`: login, listados, envío del boletín, eventos                               |
| `security`     | Auth, secretos, RLS, rate limiting, datos personales                                      |
| `content`      | Añadir artistas, lanzamientos, eventos, imágenes                                          |
| `ui`           | Construir interfaz nueva dentro del sistema `nm-*`                                        |
| `visual-audit` | Auditar coherencia visual, tipografía, peso de imágenes, accesibilidad                    |
| `check`        | Ejecutar e interpretar `npm run check`                                                    |

## Estado actual

- **Reservas**: funcionando de punta a punta. Formulario público en el modal
  "Reservar cupo" con acompañantes que se abren solos según las entradas, y código
  de puerta de **4 caracteres** (`Q7F3`, sin vocales ni caracteres que se confundan
  al dictarlos). Al guardarse la reserva se manda **sola** la confirmación por correo
  (agradecimiento, código, nombre y eslogan del evento); es transaccional, así que no
  lleva enlace de baja. Si el envío falla, la reserva se guarda igual y la respuesta
  trae `correoEnviado: false` para no prometer un correo que no salió. El alta a mano
  desde el panel manda el mismo correo (quien pide el cupo por WhatsApp o Instagram
  también necesita su código), y el aviso del panel dice si salió. El envío está en
  `src/lib/email/reserva.ts`, compartido por las dos vías. Gestión completa en
  `/admin/reservas`.
- **Cierre automático de reservas**: cada evento tiene `reservations_close_at`
  (migración 0007, `NULL` = sin hora de cierre). Pasada esa hora el servidor rechaza
  reservas nuevas (`createReservation` lo comprueba, no solo la interfaz) y el evento
  sigue en la landing y en `/eventos` con «Las reservas ya cerraron. Los cupos se
  pagan en la puerta.» en vez del botón; el formulario tampoco deja elegirlo. Existe
  porque la reserva da el precio de preventa (15K) y en la puerta se cobra más (20K).
  `reservations_open` sigue siendo el interruptor manual, pero **esconde el evento de
  la landing**; el reloj no. Se fija a mano en el SQL Editor, con el desfase de
  Colombia (`-05`):

  ```sql
  update public.events set reservations_close_at = '2026-10-03 17:00:00-05'
  where slug = 'umbra' returning slug, reservations_close_at;
  ```

  Verifica con el `returning` que tocó una fila: un slug mal escrito no da error,
  solo no cambia nada. Las reservas ya hechas no se tocan.

- **Newsletter**: el formulario guarda **nombre y correo** en Supabase, con campo
  trampa contra bots. Gestión en `/admin/suscriptores`. El **envío** se redacta y se
  manda por lotes desde `/admin/boletin`, por el SMTP de Gmail con App Password
  (ver skill `email`), con baja por token en `/baja`.
- **Panel de admin**: `/admin` con login por clave compartida, sesión sellada
  (`nm_admin`, HttpOnly + Secure + SameSite=Lax, 8 h) y límite de intentos **por
  dispositivo** (cookie `nm_cid`), con un tope por IP más alto como red de seguridad.
  Un navegador que ya entró bien lleva un sello firmado (`nm_trust_*`) y queda fuera
  del tope por IP: así, si alguien ataca desde tu misma red, el bloqueo le cae a esa
  persona y no al equipo del sello.
  Secciones: Resumen (acceso de puerta y **qué evento sale en la portada**),
  Reservas, Suscriptores y Boletín; las dos de datos con alta, edición y borrado,
  para que el equipo no técnico gestione datos sin entrar a Supabase. Sin `SESSION_SECRET` ni
  `ADMIN_PASSWORD_HASH` el panel no rompe: redirige al login y ahí avisa de que
  falta configurarlo.
- **Control de entrada**: `/puerta`, con **clave propia** que se edita desde
  `/admin` (guardada como hash en `app_settings`, porque cambia en cada evento y
  una variable de entorno obligaría a redesplegar). Cookie aparte (`nm_door`, 12 h)
  para que no pueda confundirse con una sesión de admin. Busca por código, nombre o
  acompañante y marca ingreso y pago; **no puede editar nombres, entradas ni
  acompañantes**, que es justo el fraude que se quiere evitar. Se guarda el origen
  de cada marca (`paid_by`, `checked_in_by`) para poder cuadrar caja.
- **Pagos**: cada evento tiene `presale_price` (lo que paga quien reservó, aunque
  pague en la puerta) y `door_price` (informativo, para quien llega sin reserva).
  Una reserva debe `entradas x presale_price`. Los precios se editan en
  `/admin/reservas`.
- **Eventos**: viven en la tabla `events` y **la landing los lee de ahí** (loader
  SSR en `src/routes/index.tsx`). Un evento es **una fila**: ya no hay nada escrito
  a mano en el JSX, que era de donde salía el riesgo de enseñar el flyer de uno con
  el botón que reserva para otro. `#eventos` muestra **el destacado** (`featured`,
  uno solo — lo impide un índice parcial) y enlaza a `/eventos`, la agenda completa,
  donde cada tarjeta abre la reserva con ese evento ya elegido
  (`/eventos?reservar=<slug>` es un enlace compartible). Cuál se destaca se elige en
  **`/admin` → Resumen**: es una decisión de anuncio, no del día del evento. **Crear un evento sigue siendo un `insert` a mano** en el SQL
  Editor: el equipo habla antes de anunciar, así que no hay formulario de alta. El
  flyer y el eslogan pueden faltar; la tarjeta cae a un fondo con el nombre.
- **Server functions**: en `src/actions/`. `src/start.ts` deja activo el middleware
  CSRF. Cada acción llama por su cuenta a la guarda que le toca, de
  `src/lib/require-admin.ts`: `requireAdmin()` para lo del panel (rechaza incluso
  una sesión de puerta válida, porque `isAdmin()` mira otra cookie) y
  `requireDoorOrAdmin()` para marcar ingreso y pago, que además devuelve el origen.
  `beforeLoad` protege la navegación, no la API.

### Migraciones

Van de la 0001 a la 0007 y todas están aplicadas. Se aplican **a mano** desde el SQL
Editor de Supabase: la clave de servicio habla
por PostgREST, que no permite crear ni alterar tablas. Comprueba el estado con
`npm run db:status`, que dice qué archivo de `supabase/migrations/` falta por pegar.

## Próximo trabajo

**Siguiente cambio: la sección de trayectoria** (historia y recorrido del sello en
la landing). Aún sin diseño ni contenido: antes de escribir código, preguntar qué
hitos va (eventos, lanzamientos, fechas, fotos) y dónde va dentro de `index.tsx`. Es
contenido más que datos: seguir la skill `content` y, para el JSX/CSS, `ui` (clases
`nm-*`). Al añadirla, sumar su comprobación al array `CHECKS` de `scripts/smoke.mjs`.

### Decisiones ya tomadas (newsletter, reservas y panel — ya implementadas)

1. **Newsletter funcional**: guardar suscriptores en Supabase y enviarles correo.
   El envío es **manual desde el panel de admin**, con asunto y cuerpo libres, para
   anunciar sesiones, tracks, eventos o comunicados.
2. **Reserva de cupos**: formulario con evento, nombre, correo, teléfono y cantidad
   de entradas; si pide más de una, se abren campos para el nombre de cada
   acompañante. Todo se guarda en Supabase.
3. **Panel de admin** en `/admin`, con una única clave compartida con el grupo, para
   que los integrantes no técnicos consulten y editen datos sin entrar a Supabase.

| Decisión          | Resuelto                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de datos     | **Supabase** (Postgres). Acceso solo desde el servidor con la clave secreta (`sb_secret_…`, en `SUPABASE_SECRET_KEY`); RLS activo y sin policies                                              |
| Acceso del equipo | Panel de admin en la propia página + Table Editor de Supabase como respaldo                                                                                                                   |
| Auth del admin    | Una clave compartida. Hash en variable de entorno + sesión sellada de TanStack Start                                                                                                          |
| Notificaciones    | El boletín, manual desde el panel. La confirmación de reserva sí es automática: es transaccional, la pidió la persona                                                                         |
| Cédula            | **Fuera por ahora.** Se documentó cómo añadirla en el futuro si hace falta                                                                                                                    |
| Correo            | **SMTP de Gmail** con App Password de `nemorphictechno@gmail.com`: sin dominio propio es lo que mejor llega, porque lo firma Google. Migrar a Resend al comprar dominio es cambiar un archivo |

## Despliegue

**Orden al añadir una columna**: aplica la migración en Supabase **antes** de subir
el código que la lee. Si el código sale primero, la consulta pide una columna que no
existe y la agenda y las reservas se caen. `db:status` falla hasta que la migración
esté pegada; añade la nueva entrada a `scripts/db-status.mjs`.

**Dependencias de TanStack**: Vercel **bloquea el build** si detecta una versión
vulnerable de `@tanstack/react-start` (pasó con la 1.168.32; hoy 1.168.60). Al subir
`react-start`, sube también `@tanstack/react-router` y `@tanstack/router-plugin` a las
versiones que pide, o quedan dos copias de `router-core` y el build falla con
`MISSING_EXPORT`. Comprueba con `npm ls @tanstack/router-core`: debe haber una sola.
Nunca se usa `DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS=1`. `npm audit` está en
0; Vercel instala con `package-lock.json` (`bun.lock` está desactualizado y bun no
está instalado).

La página está en **Vercel**: `https://nemorphic.vercel.app`.

Detalle importante: `@lovable.dev/vite-tanstack-config` pasa a Nitro
`defaultPreset: "cloudflare-module"`, pero es un _default_. Nitro detecta el
proveedor por la variable de entorno `VERCEL` y en el build de Vercel gana el preset
`vercel`. Consecuencias:

- En producción el runtime es **Node**, así que `process.env` funciona y
  `node:crypto` está disponible.
- Un `npm run build` **local** genera un bundle de Cloudflare (`.output/` y
  `.wrangler/`). Es normal y no refleja lo que corre en producción; no intentes
  "arreglarlo".
- Los secretos se configuran en el dashboard de Vercel y en un `.env` local.
  Nunca con prefijo `VITE_`. `.env.example` documenta cuáles hacen falta.

**Verificado empíricamente (2026-09-08):** el servidor de desarrollo lee `.env`;
**no** lee `.dev.vars` (ese archivo es de Cloudflare Wrangler y aquí no se usa).
`.env` no estaba en `.gitignore` — se añadió, porque habría subido las claves al
repo público.
