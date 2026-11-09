-- 0010_la_nocturna.sql
--
-- Próximo evento: La Nocturna (Manizales), viernes 20 de noviembre de 2026,
-- 8:00 PM a 3:00 AM. El flyer dice «Cover 20K», que es el precio de puerta.
--
-- Solo cambia datos, no esquema. Idempotente: se puede pegar dos veces.
--
-- ANTES DE PEGAR confirmar tres cosas que el flyer no dice:
--   * presale_price: se asume 15000 (la preventa de UMBRA). Cambiarlo si es otro.
--   * reservations_close_at: queda sin hora de cierre. Ver el update del final.
--   * capacity: sin límite de aforo.
--
-- ORDEN: pegar justo DESPUÉS de desplegar el código con el flyer
-- (public/Assets/eventos/la-nocturna/flyer.jpg).

-- Solo puede haber un evento destacado (índice parcial): se suelta el anterior.
update public.events set featured = false where featured and slug <> 'la-nocturna';

insert into public.events (
  slug, name, tagline, starts_at, ends_at, venue, address, poster_url,
  reservations_open, featured, presale_price, door_price
)
values (
  'la-nocturna',
  'La Nocturna',
  null,
  '2026-11-20 20:00:00-05',
  '2026-11-21 03:00:00-05',
  'La Nocturna Ecosistema Musical',
  'Av. Santander #55-04, Manizales, Caldas',
  '/Assets/eventos/la-nocturna/flyer.jpg',
  true,
  true,
  15000,
  20000
)
on conflict (slug) do update
  set name = excluded.name,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      venue = excluded.venue,
      address = excluded.address,
      poster_url = excluded.poster_url,
      reservations_open = excluded.reservations_open,
      featured = excluded.featured,
      presale_price = excluded.presale_price,
      door_price = excluded.door_price
returning slug, starts_at, featured, presale_price, door_price;

-- Opcional: cierre automático de las reservas (el precio de preventa deja de valer).
-- update public.events set reservations_close_at = '2026-11-20 17:00:00-05'
-- where slug = 'la-nocturna' returning slug, reservations_close_at;
