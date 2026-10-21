-- 0008_trayectoria.sql
--
-- Fotos y vídeos de los eventos pasados, para la sección «Trayectoria».
--
-- Cada fila es UNA pieza de media de un evento. Los archivos viven en
-- public/Assets/eventos/<slug>/ (los genera scripts/optimize-media.mjs, que también
-- escribe el SQL de carga); aquí solo se guarda dónde están y cómo describirlos.
--
-- Un evento pasado aparece en la web SOLO si tiene al menos una fila aquí. Así se
-- puede subir el código antes de tener la media: mientras la tabla esté vacía, la
-- landing no enseña la sección ni el enlace a /trayectoria.
--
-- Idempotente: se puede pegar dos veces.

create table if not exists public.event_media (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  -- 'photo' = imagen WebP con varios anchos; 'video' = MP4 con imagen de portada.
  kind        text not null check (kind in ('photo', 'video')),
  -- Foto: la variante mediana (la que usa el navegador si no entiende srcset).
  -- Vídeo: el MP4.
  src         text not null,
  -- Solo fotos: valor listo para el atributo srcset ("/ruta-480.webp 480w, ...").
  srcset      text,
  -- Solo vídeos: imagen que se ve antes de darle a reproducir.
  poster      text,
  -- Dimensiones de `src`. El navegador reserva el hueco antes de descargar la
  -- imagen, así que la página no salta al cargar.
  width       integer not null check (width > 0),
  height      integer not null check (height > 0),
  -- Descripción para quien no ve la imagen, y para el buscador.
  alt         text not null,
  -- Quién sale en la pieza, con el NOMBRE ARTÍSTICO (nunca el real). Es el pie de foto
  -- de cada foto o vídeo. Ver «Artistas» en CLAUDE.md.
  artists     text[] not null default '{}',
  -- Orden dentro del evento, de menor a mayor.
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  -- Una foto sin srcset o un vídeo sin portada son datos a medias: se rechazan.
  constraint event_media_foto_completa  check (kind <> 'photo' or srcset is not null),
  constraint event_media_video_completo check (kind <> 'video' or poster is not null),
  -- Cargar dos veces el mismo archivo no debe duplicar la pieza.
  constraint event_media_unica unique (event_id, src)
);

comment on table public.event_media is
  'Fotos y vídeos de eventos pasados. Un evento sin filas aquí no aparece en Trayectoria.';

create index if not exists event_media_por_evento
  on public.event_media (event_id, position);

-- Sin policies a propósito: RLS activo y sin policy = acceso denegado para anon y
-- authenticated. Solo el servidor, con la clave secreta, lee esta tabla.
alter table public.event_media enable row level security;
