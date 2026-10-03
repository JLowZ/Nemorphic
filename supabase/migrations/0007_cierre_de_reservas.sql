-- 0007_cierre_de_reservas.sql
--
-- Hora a la que dejan de aceptarse reservas de un evento.
--
-- La reserva da el precio de preventa y en la puerta se cobra más, así que el
-- cierre tiene que ser automático: a esa hora el servidor rechaza reservas nuevas
-- sin que nadie tenga que entrar a apagar nada. `reservations_open` sigue siendo el
-- interruptor manual; esto es el reloj. Las reservas ya hechas no se tocan.
--
-- NULL = sin hora de cierre (solo manda `reservations_open`). Idempotente.

alter table public.events
  add column if not exists reservations_close_at timestamptz;

comment on column public.events.reservations_close_at is
  'A partir de esta hora no se aceptan reservas nuevas. NULL = sin hora de cierre.';

-- Para fijarla (hora de Colombia, -05), cambia el slug y la hora:
--
--   update public.events
--   set reservations_close_at = '2026-10-03 17:00:00-05'
--   where slug = 'el-slug-del-evento';
