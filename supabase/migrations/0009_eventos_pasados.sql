-- 0009_eventos_pasados.sql
--
-- Cada evento tiene su carpeta: public/Assets/eventos/<slug>/, con su flyer
-- (`flyer.jpg`) y, cuando exista, su media (fotos y vídeos de Trayectoria).
--
-- Esta migración hace dos cosas:
--   1. Apunta UMBRA y Sembrando Conciencia a la ruta nueva de su flyer (vivían
--      sueltos en public/Assets/ con nombres distintos).
--   2. Crea los dos eventos pasados que faltaban: Opening Nemorphic y Nemorphic Pool
--      Party. Se crean cerrados (`reservations_open = false`) y ya pasados, así que
--      no aparecen en la agenda ni en el formulario de reservas: solo en Trayectoria.
--
-- ORDEN: aplícala justo DESPUÉS de desplegar el código con los archivos movidos.
-- Antes, la web en producción buscaría un flyer que aún no existe en la ruta nueva.
--
-- Solo cambia datos, no esquema. Idempotente: se puede pegar dos veces, y si algún
-- dato está mal, se corrige aquí y se vuelve a pegar.

-- ---------------------------------------------------------------------------
-- 1. Flyers de los eventos que ya existían
-- ---------------------------------------------------------------------------
update public.events
set poster_url = '/Assets/eventos/umbra/flyer.jpg'
where slug = 'umbra'
returning slug, poster_url;

update public.events
set poster_url = '/Assets/eventos/sembrando-conciencia/flyer.jpg'
where slug = 'sembrando-conciencia'
returning slug, poster_url;

-- ---------------------------------------------------------------------------
-- 2. Eventos pasados
-- ---------------------------------------------------------------------------

-- Opening Nemorphic — 16 de enero de 2025 (el flyer no lleva fecha; la dio el equipo).
-- Arrancó a las 11:30 PM según el flyer. Hora de cierre y lugar: sin confirmar, y el
-- flyer solo dice «Ubicación con los contactos». Quedan vacíos y la web no los pinta.
insert into public.events (slug, name, starts_at, ends_at, venue, poster_url, reservations_open)
values (
  'opening-nemorphic',
  'Opening Nemorphic',
  '2026-01-16 23:30:00-05',
  null,
  null,
  '/Assets/eventos/opening-nemorphic/flyer.jpg',
  false
)
on conflict (slug) do update
  set name = excluded.name,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      venue = excluded.venue,
      poster_url = excluded.poster_url
returning slug, starts_at;

-- Nemorphic Pool Party — 6 de junio, desde las 6:00 PM. El flyer no trae el año:
-- se asumió 2026 (el 6 de junio de 2026 fue sábado). CONFIRMAR antes de pegar.
-- El lugar es lo único que dice el flyer: «a 5 minutos de la Fonda de Santágueda».
insert into public.events (slug, name, starts_at, ends_at, venue, poster_url, reservations_open)
values (
  'nemorphic-pool-party',
  'Nemorphic Pool Party',
  '2026-06-06 18:00:00-05',
  null,
  'A 5 minutos de la Fonda de Santágueda',
  '/Assets/eventos/nemorphic-pool-party/flyer.jpg',
  false
)
on conflict (slug) do update
  set name = excluded.name,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      venue = excluded.venue,
      poster_url = excluded.poster_url
returning slug, starts_at;

-- Cada `returning` debe devolver una fila. Si devuelve 0, el slug no existe (solo
-- pasa en los dos `update` de arriba).
