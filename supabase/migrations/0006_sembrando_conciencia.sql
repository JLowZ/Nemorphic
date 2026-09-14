-- 0006_sembrando_conciencia.sql
--
-- Datos definitivos de Sembrando Conciencia, ya con flyer.
--
-- La 0005 lo creó con lo que se sabía entonces, y dos cosas estaban mal: el
-- nombre (es "Conciencia", sin s — así lo escribe el flyer) y la fecha (es el 26
-- de septiembre, no el 27). Se corrige aquí en vez de editar la 0005, que ya está
-- aplicada: una migración aplicada no se toca.
--
-- Solo cambia datos, no esquema. Es idempotente: se puede pegar dos veces.

update public.events
set
  -- El slug también se corrige. Las reservas apuntan al evento por su id, no por
  -- el slug, así que cambiarlo no suelta ninguna; y el evento aún no se había
  -- anunciado, así que no hay enlaces con el slug viejo circulando.
  slug          = 'sembrando-conciencia',
  name          = 'Sembrando Conciencia',
  tagline       = 'Frecuencias que florecen en algún lugar',
  -- 26 de septiembre de 2026, de 9 PM a 3 AM (termina ya el 27). Hora de Colombia.
  starts_at     = '2026-09-26 21:00:00-05',
  ends_at       = '2026-09-27 03:00:00-05',
  venue         = 'Club privado Sembrando Conciencia',
  address       = null,
  poster_url    = '/Assets/flyersembrando.jpeg',
  -- $5.000 por persona. No se dio precio distinto para quien llega sin reserva,
  -- así que queda vacío: se pone desde /admin/reservas si hace falta.
  presale_price = 5000
where slug in ('sembrando-consciencia', 'sembrando-conciencia');
