-- 0011_ingreso_por_persona.sql
--
-- Ingreso y pago POR PERSONA dentro de una reserva de grupo.
--
-- Hasta ahora una reserva de 4 entradas se marcaba entera: «entró» y «pagó» eran de
-- todo el grupo. En La Nocturna llegaron grupos partidos (2 y luego 2) y no había
-- forma de llevar la cuenta. La reserva sigue siendo una sola, con un único código;
-- lo que cambia es que cada persona del grupo tiene su propio ingreso y su propio pago.
--
-- Dónde vive cada cosa:
--
--  * El TITULAR sigue en `reservations`: sus columnas `paid`, `paid_at`, `paid_by`,
--    `checked_in_at` y `checked_in_by` pasan a ser solo suyas.
--  * Cada ACOMPAÑANTE gana esas mismas columnas en `reservation_guests`.
--  * `reservations.status` se mantiene como resumen: 'checked_in' cuando ya entró
--    todo el grupo, 'confirmed' mientras falte alguien, 'cancelled' si se canceló.
--    Lo recalcula el servidor cada vez que se marca a alguien.
--
-- Se aplica ANTES de desplegar el código que la usa: ese código pide columnas que
-- no existen hasta pegar esto, y sin ellas la puerta y el panel no cargan.

alter table public.reservation_guests
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by text
    check (paid_by is null or paid_by in ('admin', 'door')),
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text
    check (checked_in_by is null or checked_in_by in ('admin', 'door'));

comment on column public.reservation_guests.paid is
  'Si este acompañante ya pagó su entrada. La del titular está en reservations.paid.';
comment on column public.reservation_guests.checked_in_at is
  'Cuándo entró este acompañante. Null = todavía no ha entrado.';

comment on column public.reservations.paid is
  'Si el TITULAR pagó su entrada. Cada acompañante tiene la suya en reservation_guests.';
comment on column public.reservations.checked_in_at is
  'Cuándo entró el TITULAR. Cada acompañante tiene la suya en reservation_guests.';
comment on column public.reservations.status is
  'confirmed = falta alguien por entrar; checked_in = entró todo el grupo; cancelled.';

-- ---------------------------------------------------------------------------
-- Reservas ya hechas: lo que se marcó para el grupo entero vale para cada persona.
--
-- Antes de esta migración, «pagado» y «entró» eran del grupo completo. Se copia a
-- cada acompañante para que los eventos pasados cuadren igual que antes. Solo toca
-- a quien aún no tiene nada marcado, así que reaplicarla no pisa nada.
-- ---------------------------------------------------------------------------
update public.reservation_guests g
set paid = true,
    paid_at = r.paid_at,
    paid_by = r.paid_by
from public.reservations r
where g.reservation_id = r.id
  and r.paid
  and not g.paid;

update public.reservation_guests g
set checked_in_at = coalesce(r.checked_in_at, r.created_at),
    checked_in_by = r.checked_in_by
from public.reservations r
where g.reservation_id = r.id
  and r.status = 'checked_in'
  and g.checked_in_at is null;

-- Un titular de una reserva marcada como 'checked_in' desde el panel antiguo podía
-- quedar sin hora de ingreso (el panel solo cambiaba el estado). Ahora la hora es lo
-- que dice si entró, así que se rellena.
update public.reservations
set checked_in_at = created_at
where status = 'checked_in'
  and checked_in_at is null;
