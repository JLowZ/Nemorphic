# Guía de operación

Para el equipo de Nemorphic. **No hace falta saber programar para usar esto.**

Aquí está todo lo que se hace desde el navegador: mirar reservas, cobrar, preparar
la entrada de un evento y gestionar la lista del boletín.

---

## Las dos páginas privadas

|            | Panel                              | Entrada                                                |
| ---------- | ---------------------------------- | ------------------------------------------------------ |
| Dirección  | `nemorphic.vercel.app/admin`       | `nemorphic.vercel.app/puerta`                          |
| Para quién | El equipo del sello                | Quien atiende la puerta el día del evento              |
| Clave      | La compartida del grupo. No cambia | Una distinta, que **se cambia en cada evento**         |
| Puede      | Todo                               | Solo buscar reservas y marcar quién entró y quién pagó |

Quien está en la puerta **no puede editar nombres, entradas ni acompañantes**. Es a
propósito: si pudiera cambiar un nombre, bastaría con eso para dejar entrar a otra
persona con una reserva ajena.

La sesión del panel dura 8 horas y la de la puerta 12. Después piden la clave otra
vez.

---

## Antes de un evento

### 1. Comprobar los precios

Entra a **`/admin` → Reservas**. Debajo de los números aparece algo como:

> Reservando: $ 15.000 por persona · En puerta sin reserva: $ 20.000

Si no son los precios reales, pulsa **"Cambiar precios"** y corrígelos. Es
importante: son los que verá quien cobre en la entrada, y de ahí sale lo que el
sistema dice que debe cada persona.

### 2. Abrir el acceso de la puerta

En **`/admin` → Resumen**, apartado _Acceso de puerta_:

1. Escribe una clave nueva para este evento (mínimo 6 caracteres). La vas a dictar,
   así que que sea fácil: `umbra-octubre` sirve.
2. **Guardar clave.**
3. Pásale a quien atienda la entrada la dirección `nemorphic.vercel.app/puerta` y
   esa clave.

**Usa una clave distinta a la del panel.** Y cámbiala en cada evento: quien tuviera
la anterior queda fuera la próxima vez que entre.

---

## Durante el evento — la página de entrada

Quien atiende abre `/puerta`, mete la clave y ve la lista de reservas.

**Buscar.** El campo de arriba busca por código, por nombre del titular o por
nombre de un acompañante. No importan tildes ni mayúsculas: escribir `jose`
encuentra a _José_.

**Cada reserva muestra:**

- El **código** de 4 caracteres, grande.
- El nombre del titular y cuántas entradas trae.
- Si ya entró o no.
- Si pagó, o **cuánto debe** (`Debe $ 30.000`).
- Los nombres de los acompañantes, si los hay.

**Dos botones:**

- **Marcar que entró** — cuando la persona pasa. Si te equivocas, _Deshacer ingreso_.
- **Marcar como pagado** — cuando cobras.

Arriba se ve el total **por cobrar** del evento, que baja según vas marcando.

> **Reserva cancelada:** aparece marcada en rojo y sin botones, con el aviso de que
> no debe entrar con ese código.

La lista se actualiza sola cada 30 segundos, así que dos personas pueden estar
marcando a la vez sin pisarse.

---

## Después del evento

En **`/admin` → Reservas** te queda el registro: cuántas entradas se
comprometieron, cuántas personas entraron, cuánto se cobró y cuánto quedó pendiente.

El sistema guarda **desde dónde** se marcó cada cobro, así que en el panel verás
"Pagado en puerta" cuando lo marcó quien atendía la entrada. Sirve para cuadrar caja.

Cuando termine el evento, entra a **`/admin` → Resumen** y pulsa **"Cerrar el
acceso"**. Así nadie puede volver a entrar a la página de puerta hasta el próximo
evento.

---

## Eventos: cuál se ve en la web

La landing muestra **un solo evento**, el destacado. Los demás están en la página
**Eventos** (`/eventos`), a la que se llega con el botón que hay junto al título de
la sección. Cada tarjeta de esa página abre la reserva **con ese evento ya elegido**,
así que su enlace se puede mandar por WhatsApp o Instagram:
`nemorphic.vercel.app/eventos?reservar=la-nocturna`.

Para cambiar cuál se destaca: **`/admin` → Resumen → Evento principal**, y pulsa
**"Mostrar este"** en el que quieras. Solo puede haber uno; al marcar el nuevo, el
anterior deja de estarlo al instante.

Un evento **sin flyer** no se ve roto: en su lugar sale su nombre sobre el degradado
de la marca. Lo mismo con el eslogan, el lugar y la hora de cierre — la web enseña lo
que haya. Así se puede anunciar una fecha en cuanto se confirma, sin esperar al arte.

---

## Reservas: el correo automático

Quien reserva desde la web recibe **al instante** un correo con el agradecimiento, su
código de entrada, y el nombre y el eslogan del evento. No hay que hacer nada: sale
solo al guardarse la reserva.

Las reservas que **añades tú a mano** desde el panel mandan el mismo correo, así que
quien te escribió por WhatsApp o por Instagram recibe su código sin que se lo tengas
que dictar. Al guardarla, el aviso de arriba te dice si el correo salió; si no salió,
pásale el código tú.

Lo que **no** manda correo: **cambiar el correo de una reserva no reenvía nada**, y el
código nunca cambia. Si alguien lo perdió, búscalo en _Reservas_ y díselo.

Si el envío falla, la reserva **se guarda igual**: el código sigue en pantalla y en el
panel. La persona ve un aviso de que no le llegó el correo.

---

## Reservas: añadir y corregir a mano

En **`/admin` → Reservas**.

**Añadir a alguien que te escribió por WhatsApp:** botón _"Añadir reserva a mano"_.
Rellena los datos igual que el formulario público; el sistema genera el código.

**Corregir una reserva:** botón _Editar_. Puedes cambiar nombre, correo, teléfono,
número de entradas y acompañantes. **El código no cambia**, porque la persona ya lo
tiene apuntado.

**Cancelar vs. Eliminar:**

- _Cancelar_ deja la reserva visible pero libera las entradas. Es lo normal cuando
  alguien avisa que no va. Se puede reactivar.
- _Eliminar_ la borra del todo, sin vuelta atrás. Solo para reservas hechas por
  error o duplicadas.

---

## Boletín: la lista de suscriptores

En **`/admin` → Suscriptores** están quienes se apuntaron desde la web.

Puedes buscar, **añadir a alguien a mano**, editar su nombre o correo, marcarlo como
_Dado de baja_ (deja de recibir correos pero no se borra) o eliminarlo del todo.

Se guarda el nombre además del correo para que el boletín llegue encabezado con el
nombre de cada persona, aunque el texto sea el mismo para todos.

El **envío** se hace desde **`/admin` → Boletín**, con asunto y cuerpo libres.

---

## Cosas que hay que pedirle al programador

Estas no se pueden hacer desde el navegador:

| Qué                                     | Por qué                                                                                 |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| **Crear un evento**                     | Es una fila en la base. Pásale los datos al programador y te devuelve el SQL ya escrito |
| **Poner el flyer de un evento**         | La imagen vive en el repo, así que entra con un despliegue                              |
| **Cambiar la clave del panel**          | Está en la configuración de Vercel, no en la base                                       |
| **Añadir artistas o lanzamientos**      | Están en el código del sitio                                                            |
| **Cambiar textos o imágenes** de la web | Igual                                                                                   |

> La web lee los eventos de la base, así que un evento creado en Supabase aparece
> solo. Aun así **pásale los datos al programador**: es un `insert` con fechas en
> hora de Colombia y un `slug` sin espacios ni tildes, y equivocarse ahí deja el
> evento invisible o con la hora corrida.

---

## Si algo va mal

**"No puedo entrar al panel."** Comprueba que la clave es la correcta. Tras 8
intentos fallidos el sistema bloquea 15 minutos desde esa conexión; espera y vuelve
a probar.

**"La puerta dice que el acceso no está activado."** Nadie ha puesto clave para este
evento. Se hace en `/admin` → Resumen.

**"No aparece una reserva que sé que existe."** Mira que estés en el evento correcto
con el selector de arriba, y prueba a buscar por el código en vez de por el nombre.

**"Se ve una pantalla de error."** Recarga. Si sigue, avisa al programador con una
captura: los errores quedan registrados en Vercel y se puede ver qué pasó.

**Nunca compartas** la clave del panel fuera del equipo, ni la clave de la puerta
después del evento.
