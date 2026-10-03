import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { eventoDestacado, getOpenEvents } from "../actions/events";
import { Modal } from "../components/nemorphic/Modal";
import { PosterEvento } from "../components/nemorphic/PosterEvento";
import { ReservationForm } from "../components/nemorphic/ReservationForm";
import { NewsletterForm } from "../components/nemorphic/NewsletterForm";
import {
  ChevronIcon,
  InstagramIcon,
  SoundcloudIcon,
  YoutubeIcon,
} from "../components/nemorphic/SocialIcons";
import { HERO_BG, LOGO, artistas, lanzamientos } from "../data/nemorphic";
import { fechaLarga, horario, lugarCompleto } from "../lib/fechas";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nemorphic - Techno label" },
      {
        name: "description",
        content:
          "Nemorphic es un sello techno que impulsa artistas locales y emergentes: sesiones, lanzamientos y cultura underground. Más que groove, cultura.",
      },
      { property: "og:title", content: "Nemorphic - Techno label" },
      {
        property: "og:description",
        content: "Más que groove, cultura. Sesiones, artistas y lanzamientos del sello Nemorphic.",
      },
    ],
  }),
  // La agenda se resuelve en el servidor: llega dentro del HTML, sin un salto
  // visual al cargar y sin que el buscador vea un hueco donde va el evento.
  loader: () => getOpenEvents(),
  component: Index,
});

const navLinks = [
  { href: "#inicio", label: "Inicio" },
  { href: "#quienes", label: "Quiénes somos" },
  { href: "#artistas", label: "Artistas" },
  { href: "#lanzamientos", label: "Lanzamientos" },
  { href: "#eventos", label: "Eventos" },
];

const artistasOrdenados = [...artistas].sort((a, b) => a.nombre.localeCompare(b.nombre));

function Index() {
  const eventos = Route.useLoaderData();
  const destacado = eventoDestacado(eventos);

  const [navVisible, setNavVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<null | "noticias" | "tienda" | "contacto" | "reservar">(null);
  const [fallbacks, setFallbacks] = useState<Record<string, boolean>>({});
  // El formulario de suscripcion vive escondido en Noticias hasta que lo piden.
  const [noticiasNewsletter, setNoticiasNewsletter] = useState(false);
  // Cual llega preseleccionado al formulario. Null = que elija la persona.
  const [reservaSlug, setReservaSlug] = useState<string | null>(null);
  const [releasesBgOffset, setReleasesBgOffset] = useState(0);

  useEffect(() => {
    document.body.classList.add("nm-body");
    return () => document.body.classList.remove("nm-body");
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const inicio = document.getElementById("inicio");
      const altura = inicio ? inicio.offsetHeight : window.innerHeight;
      setNavVisible(window.scrollY > altura);

      const section = document.getElementById("lanzamientos");
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const offset = Math.max(-120, Math.min(120, (window.innerHeight - rect.top) * 0.18));
      setReleasesBgOffset(offset);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <>
      {/* NAVBAR */}
      <header>
        <nav
          className={`nm-nav ${navVisible ? "is-visible" : ""}`}
          aria-label="Navegación principal"
        >
          <div className="nm-container flex items-center justify-between gap-4 py-3">
            <a href="#inicio" className="flex items-center gap-3">
              <img
                src={LOGO}
                alt="Logo Nemorphic"
                width={44}
                height={44}
                className="nm-logo-mark"
                style={{ width: 44, height: 44 }}
              />
              <span className="nm-display text-lg tracking-wide">Nemorphic</span>
            </a>

            <div className="lg:hidden">
              <button
                type="button"
                className="nm-btn px-4 py-2"
                aria-expanded={menuOpen}
                aria-controls="nm-menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? "Cerrar" : "Menú"}
              </button>
            </div>

            <div
              id="nm-menu"
              className={`${menuOpen ? "flex" : "hidden"} absolute left-0 right-0 top-full flex-col gap-4 border-b border-white/10 bg-[rgba(5,3,8,0.97)] px-[4vw] py-6 lg:static lg:flex lg:flex-row lg:items-center lg:gap-8 lg:border-0 lg:bg-transparent lg:p-0`}
            >
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="nm-nav-link"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <button
                type="button"
                className="nm-nav-link nm-nav-link--accent text-left"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("noticias");
                }}
              >
                Noticias
              </button>
              <button
                type="button"
                className="nm-nav-link nm-nav-link--accent text-left"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("tienda");
                }}
              >
                Tienda
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main>
        {/* INICIO */}
        <section id="inicio" className="nm-hero nm-grain">
          <div
            className="nm-hero-bg"
            aria-hidden="true"
            style={{ backgroundImage: `url("${HERO_BG}")` }}
          />
          <div className="nm-hero-veil" aria-hidden="true" />
          <div className="nm-hero-inner">
            <img
              src={LOGO}
              alt="Logo Nemorphic"
              className="nm-logo-mark nm-hero-logo mx-auto"
              width={138}
              height={138}
            />
            <h1 className="nm-display nm-hero-title">Bienvenidos a Nemorphic</h1>
            <p className="nm-hero-tagline">Más que groove, cultura.</p>
          </div>
        </section>

        {/* QUIÉNES SOMOS */}
        <section id="quienes" className="nm-section nm-section--about nm-grain">
          <div className="nm-container">
            <p className="nm-eyebrow">01 — Sello</p>
            <h2 className="nm-display nm-section-title mt-3">Quiénes somos</h2>
            <div className="nm-rule" />

            <div className="mt-12 grid gap-8 md:grid-cols-2">
              <article className="nm-panel">
                <h3 className="nm-subtitle">Visión</h3>
                <p className="nm-body-text mt-3">
                  Consolidar a Nemorphic como un referente del techno underground en Colombia y más
                  allá, creando un ecosistema donde la innovación sonora, la comunidad y la cultura
                  se articulen para ampliar la escena electrónica con identidad, autenticidad y
                  proyección internacional. Aspiramos a ser un espacio donde el arte, la música y la
                  cultura convergen para redefinir la experiencia sonora contemporánea.
                </p>
              </article>

              <article className="nm-panel">
                <h3 className="nm-subtitle">Misión</h3>
                <p className="nm-body-text mt-3">
                  Impulsar artistas locales y emergentes del techno a través de la difusión,
                  producción y curaduría de contenido de alto valor cultural y artístico. A través
                  de sesiones, lanzamientos y experiencias de comunidad, buscamos fortalecer una
                  escena auténtica, conectar a la audiencia con propuestas de alta calidad y
                  contribuir al crecimiento sostenido de la cultura electrónica en su forma más
                  esencial.
                </p>
              </article>
            </div>

            <div className="nm-inline-socials" aria-label="Redes sociales de Nemorphic">
              <a
                href="https://www.instagram.com/nemorphic_th?igsh=N3pvOXdjbmdvZ3Rx"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <InstagramIcon />
              </a>
              <a
                href="https://on.soundcloud.com/f8F7NRYeYPHd3yvRDR"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="SoundCloud"
              >
                <SoundcloudIcon />
              </a>
              <a
                href="https://www.youtube.com/channel/UC4OLVzfXHWhQ_wk1FYzOUwg"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <YoutubeIcon />
              </a>
            </div>
          </div>
        </section>

        {/* ARTISTAS */}
        <section id="artistas" className="nm-section nm-section--artists nm-grain">
          <div className="nm-container">
            <p className="nm-eyebrow">02 — Roster</p>
            <h2 className="nm-display nm-section-title mt-3">Artistas</h2>
            <div className="nm-rule" />

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {artistasOrdenados.map((artista) => (
                <article key={artista.nombre} className="nm-panel nm-artist-card">
                  <div className="nm-artist-img-wrap">
                    {fallbacks[artista.nombre] ? (
                      <span className="nm-artist-initial" aria-hidden="true">
                        {artista.nombre.charAt(0)}
                      </span>
                    ) : (
                      <img
                        src={artista.imagen}
                        alt={artista.nombre}
                        className="nm-artist-img"
                        width={340}
                        height={340}
                        loading="lazy"
                        decoding="async"
                        ref={(el) => {
                          if (el && el.complete && el.naturalWidth === 0) {
                            setFallbacks((prev) => ({ ...prev, [artista.nombre]: true }));
                          }
                        }}
                        onError={() =>
                          setFallbacks((prev) => ({ ...prev, [artista.nombre]: true }))
                        }
                      />
                    )}
                  </div>

                  <h3 className="nm-artist-name">{artista.nombre}</h3>

                  <details className="nm-details mt-3">
                    <summary>
                      Ver Info <ChevronIcon />
                    </summary>
                    <div className="nm-bio">
                      <p>{artista.descripcion}</p>
                    </div>
                  </details>

                  <a
                    href={artista.soundcloud}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nm-btn mt-auto"
                    style={{ marginTop: "auto", paddingTop: "0.6rem", paddingBottom: "0.6rem" }}
                  >
                    <SoundcloudIcon className="h-4 w-4" />
                    SoundCloud
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* LANZAMIENTOS */}
        <section id="lanzamientos" className="nm-section nm-section--releases nm-grain">
          <div className="nm-releases-fixed-bg" aria-hidden="true">
            <div
              className="nm-releases-bg"
              style={{ transform: `translate3d(0, ${releasesBgOffset}px, 0)` }}
            />
          </div>

          <div className="nm-container nm-releases-content">
            <p className="nm-eyebrow">03 — Catálogo</p>
            <h2 className="nm-display nm-section-title mt-3">Lanzamientos</h2>
            <div className="nm-rule" />

            <div className="mt-8 flex justify-center">
              <a
                href="https://on.soundcloud.com/aFdfOtNl7lBho5Xygy"
                target="_blank"
                rel="noopener noreferrer"
                className="nm-btn nm-btn--solid"
              >
                <SoundcloudIcon className="h-4 w-4" />
                Escuchar en SoundCloud
              </a>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-1">
              {lanzamientos.map((item) => (
                <article key={item.titulo} className="nm-panel">
                  <h3 className="nm-release-title">{item.titulo}</h3>
                  <div className="nm-release-embed-shell">
                    <iframe
                      title={item.titulo}
                      className="nm-release-frame nm-release-frame--playlist"
                      scrolling="no"
                      frameBorder="no"
                      allow="autoplay; encrypted-media"
                      loading="lazy"
                      src={item.embed}
                    />
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* EVENTOS */}
        <section id="eventos" className="nm-section nm-grain">
          <div className="nm-container">
            <p className="nm-eyebrow">04 — Agenda</p>
            <div className="nm-section-titulo-fila">
              <h2 className="nm-display nm-section-title mt-3">Eventos</h2>
              {eventos.length > 1 && (
                <Link to="/eventos" className="nm-btn nm-eventos-todos">
                  Ver todos los eventos ({eventos.length})
                </Link>
              )}
            </div>
            <div className="nm-rule" />

            {destacado ? (
              <article className="nm-event-feature mt-12">
                <div className="nm-event-poster-wrap">
                  <PosterEvento
                    posterUrl={destacado.posterUrl}
                    nombre={destacado.name}
                    alt={`Flyer del evento ${destacado.name}, ${fechaLarga(destacado.startsAt)} de ${horario(
                      destacado.startsAt,
                      destacado.endsAt,
                    )}${
                      lugarCompleto(destacado.venue, destacado.address)
                        ? ` en ${lugarCompleto(destacado.venue, destacado.address)}`
                        : ""
                    }`}
                  />
                </div>

                <div className="nm-event-info">
                  <p className="nm-eyebrow">Próximo evento</p>
                  <h3 className="nm-display nm-event-title">{destacado.name}</h3>
                  {destacado.tagline && <p className="nm-event-tagline">{destacado.tagline}</p>}
                  <dl className="nm-event-details">
                    <div>
                      <dt>Fecha</dt>
                      <dd>{fechaLarga(destacado.startsAt)}</dd>
                    </div>
                    <div>
                      <dt>Horario</dt>
                      <dd>{horario(destacado.startsAt, destacado.endsAt)}</dd>
                    </div>
                    {/* Un evento recién anunciado puede no tener sitio cerrado. */}
                    {lugarCompleto(destacado.venue, destacado.address) && (
                      <div>
                        <dt>Lugar</dt>
                        <dd>{lugarCompleto(destacado.venue, destacado.address)}</dd>
                      </div>
                    )}
                  </dl>

                  {destacado.reservasCerradas ? (
                    <p className="nm-body-text nm-event-cta">
                      Las reservas ya cerraron. Los cupos se pagan en la puerta.
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="nm-btn nm-btn--solid nm-event-cta"
                      onClick={() => {
                        setReservaSlug(destacado.slug);
                        setModal("reservar");
                      }}
                    >
                      Reservar mi cupo
                    </button>
                  )}
                </div>
              </article>
            ) : (
              // Sin eventos abiertos la sección se queda, pero dice la verdad en
              // vez de enseñar un botón que no lleva a ninguna parte.
              <p className="nm-body-text nm-eventos-vacio mt-12">
                Estamos cocinando lo próximo. Suscríbete al boletín y te avisamos antes que a nadie.
              </p>
            )}
          </div>
        </section>
      </main>

      {/* BOTÓN FLOTANTE DE CONTACTO */}
      <button
        type="button"
        className="nm-floating"
        onClick={() => setModal("contacto")}
        aria-label="Conecta con Nemorphic"
      >
        <img src={LOGO} alt="" aria-hidden="true" width={40} height={40} />
      </button>

      {/* MODAL RESERVA */}
      <Modal open={modal === "reservar"} onClose={() => setModal(null)} title="Reservar cupo">
        <ReservationForm eventoInicial={reservaSlug} onDone={() => setModal(null)} />
      </Modal>

      {/* MODAL CONTACTO */}
      <Modal
        open={modal === "contacto"}
        onClose={() => setModal(null)}
        title="Conecta con Nemorphic"
      >
        <div className="text-center">
          <h3 className="nm-subtitle">Newsletter</h3>
          <p className="nm-body-text mt-2">Suscríbete para recibir novedades y lanzamientos.</p>
          <NewsletterForm />
        </div>

        <hr className="my-10 border-0 border-t border-[rgba(210,156,204,0.18)]" />

        <div className="text-center">
          <h3 className="nm-subtitle">Contacto Directo</h3>
          <p className="nm-body-text mt-2">Escríbenos directamente a nuestro correo.</p>
          <a href="mailto:nemorphictechno@gmail.com" className="nm-btn mt-4">
            nemorphictechno@gmail.com
          </a>
        </div>
      </Modal>

      {/* MODAL NOTICIAS */}
      <Modal
        open={modal === "noticias"}
        onClose={() => {
          setModal(null);
          setNoticiasNewsletter(false);
        }}
        title="Noticias"
      >
        <div className="space-y-8">
          <article>
            <h3 className="nm-subtitle">Nuevo EP en camino</h3>
            <p className="nm-body-text mt-2">
              Estamos trabajando en los últimos detalles del próximo lanzamiento. Mantente atento a
              nuestras redes.
            </p>
            {noticiasNewsletter ? (
              <div className="mt-4">
                <NewsletterForm />
              </div>
            ) : (
              <button
                type="button"
                className="nm-btn mt-4"
                onClick={() => setNoticiasNewsletter(true)}
              >
                Suscríbete y mantente conectado
              </button>
            )}
          </article>

          <article>
            <h3 className="nm-subtitle">Nemorphic Session #017 - Abrut</h3>
            <p className="nm-body-text mt-2">
              Ya disponible en SoundCloud. Un viaje de 2 horas y 40 minutos lleno de percusiones
              intensas e hipnóticas.
            </p>
            <a
              href="https://soundcloud.com/nemorphic/nms-017-abrut"
              target="_blank"
              rel="noopener noreferrer"
              className="nm-btn mt-4"
            >
              Escuchar ahora
            </a>
          </article>
        </div>
      </Modal>

      {/* MODAL TIENDA */}
      <Modal open={modal === "tienda"} onClose={() => setModal(null)} title="Tienda">
        <div className="text-center">
          <p className="nm-body-text">
            Apoya a nuestros artistas comprando su música en alta calidad.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <a
              href="https://bandcamp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="nm-btn"
            >
              Bandcamp
            </a>
            <a
              href="https://beatport.com"
              target="_blank"
              rel="noopener noreferrer"
              className="nm-btn"
            >
              Beatport
            </a>
          </div>
          <p className="nm-body-text mt-6 text-sm opacity-50">Próximamente: Merch oficial</p>
        </div>
      </Modal>

      {/* FOOTER */}
      <footer className="nm-footer nm-grain">
        <div className="nm-container">
          <div className="nm-footer-top">
            <div className="nm-footer-brand">
              <img
                src={LOGO}
                alt="Logo Nemorphic"
                width={52}
                height={52}
                className="nm-logo-mark"
              />
              <div>
                <span className="nm-display nm-footer-brand-name">Nemorphic</span>
                <p className="nm-footer-tag">Techno label / Más que groove, cultura</p>
                <div className="nm-social" aria-label="Redes sociales de Nemorphic">
                  <a
                    href="https://www.instagram.com/nemorphic_th?igsh=N3pvOXdjbmdvZ3Rx"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram"
                  >
                    <InstagramIcon />
                  </a>
                  <a
                    href="https://on.soundcloud.com/f8F7NRYeYPHd3yvRDR"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="SoundCloud"
                  >
                    <SoundcloudIcon />
                  </a>
                  <a
                    href="https://www.youtube.com/channel/UC4OLVzfXHWhQ_wk1FYzOUwg"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="YouTube"
                  >
                    <YoutubeIcon />
                  </a>
                </div>
              </div>
            </div>

            <div className="nm-footer-links">
              <h3>Navegación</h3>
              <ul className="nm-footer-list">
                <li>
                  <a href="#inicio">Inicio</a>
                </li>
                <li>
                  <a href="#quienes">Quiénes somos</a>
                </li>
                <li>
                  <a href="#artistas">Artistas</a>
                </li>
                <li>
                  <a href="#lanzamientos">Lanzamientos</a>
                </li>
              </ul>
            </div>

            <div className="nm-footer-contact">
              <h3>Contacto</h3>
              <a href="mailto:nemorphictechno@gmail.com">nemorphictechno@gmail.com</a>
              <a href="https://wa.me/573186121615" target="_blank" rel="noopener noreferrer">
                318 612 1615
              </a>
              <a href="https://wa.me/573026369050" target="_blank" rel="noopener noreferrer">
                302 636 9050
              </a>
            </div>
          </div>

          <div className="nm-footer-bottom">
            <p className="nm-footer-copy">© 2025 Nemorphic — Todos los derechos reservados</p>
          </div>
        </div>
      </footer>
    </>
  );
}
