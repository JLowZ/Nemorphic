# Roadmap

Estado a **9 de noviembre de 2026**.

---

## Hecho

- [x] Rediseño del sitio en TanStack Start, con el sistema visual `nm-*`
- [x] Artistas y lanzamientos con reproductores de SoundCloud
- [x] **Reserva de cupos**: formulario público con acompañantes dinámicos, código de
      puerta de 4 caracteres y confirmación automática por correo
- [x] **Cierre automático de reservas** por evento (`reservations_close_at`)
- [x] **Panel de administración** (`/admin`) con clave compartida y sesión sellada
- [x] Gestión de reservas: alta manual, edición, cancelación y borrado
- [x] Gestión de suscriptores del boletín
- [x] **Envío del boletín** desde `/admin/boletin`, por lotes, con baja en `/baja`
- [x] **Control de entrada** (`/puerta`) con clave propia por evento, sin permiso
      para editar
- [x] **Control de pagos**: precio reservando y en puerta, cuánto debe cada reserva,
      y registro de dónde se cobró
- [x] **Eventos en la base de datos**: la landing y `/eventos` los leen de `events`;
      el evento destacado se elige en `/admin` → Resumen
- [x] **Trayectoria** (`/trayectoria` y `#trayectoria`): eventos pasados con flyer y
      carrusel de fotos y vídeos, con pie de foto de los artistas
- [x] **Cron anti-pausa de Supabase** (GitHub Actions, dos veces al día) que además
      cuenta los suscriptores nuevos
- [x] Verificación automática: `npm run check` y `npm run test:panel`
- [x] Imágenes optimizadas

---

## Siguiente

### 1. Pasar La Nocturna a Trayectoria

Después del viernes 20 de noviembre de 2026: cargar su media (ver «Añadir un evento
pasado nuevo a Trayectoria» en `CLAUDE.md`), crear o destacar el siguiente evento y
comprobar que `npm run smoke` vuelve a pasar (necesita un evento con reservas abiertas).

### 2. Opening Nemorphic: el lugar

El flyer solo dice «Ubicación con los contactos». Falta el dato; la web no pinta lo
que está vacío.

### 3. Analítica de la web

Pendiente de decidir. Recomendación: empezar por **Vercel Analytics** (un clic, sin
cookies, sin datos personales) y valorar después Microsoft Clarity para mapas de
calor — pero Clarity exige añadir un aviso de privacidad, porque hoy el formulario
de reservas promete que los datos no se comparten con nadie.

---

## Más adelante

- **Dominio propio** (`nemorphic.co` o similar). Mejora la imagen y la entrega del
  correo. Para enviar basta verificar el dominio; no hace falta buzón ni otro Gmail.
- **Formulario para crear eventos en el panel.** Hoy se crean con un `insert` a mano
  (o por la API con la clave de servicio); el equipo habla antes de anunciar, así que
  no urge.
- **Aforo a prueba de reservas simultáneas**. Hoy dos personas podrían llevarse las
  últimas entradas a la vez. Solo importa cuando haya un aforo ajustado; se
  resuelve con una función en Postgres.
- **Exportar a CSV** las reservas y los suscriptores.
