# Guion por historias — presentación formal del prototipo (jueves 2026-10-29, 16:00)

En vez de recorrer las pantallas una por una, la presentación cuenta **tres historias**. Cada una sigue a una persona
que necesita algo y muestra las pantallas en el orden en que las usaría. Las historias deciden también **qué frames se
enlazan en Figma**: los enlaces se arman a mano (ver «Importar a Figma»), así que sólo se enlazan los pasos de estos
recorridos. El resto de las pantallas se importa igual y se muestra desde el índice si alguien la pide.

**Duración:** unos 4 minutos por historia, más apertura y cierre: alrededor de **15 minutos**. **[validar]** cuánto
tiempo le dan para exponer.

**Honestidad (S6).** Cada paso dice si la pantalla está **construida** (funciona hoy, se captura de la página real) o es
una **maqueta** (diseño de lo que viene, sin funcionamiento). Conviene decirlo en voz alta al pasar a una maqueta:
*«esta pantalla todavía no funciona; es el diseño»*.

**Antes de capturar: active el modo prototipo** en `https://odp.hs.lan/dev/prototype` (interruptor «Modo prototipo»,
arriba de «Pantallas construidas»). Con él, las páginas reales muestran los accesos a lo nuevo: «Colecciones» en el menú,
«Aparece en las colecciones» en la ficha de la matrícula, «Colecciones que cura» en la ficha de una organización y «Mis
colecciones» y «Usuarios» en el panel. Sólo existe en desarrollo; en producción no aparece. Se queda activado (cookie)
hasta que lo apague.

Las rutas se abren en `https://odp.hs.lan`. Las respuestas largas están en `preguntas.md`; acá sólo se cita cuál
responde cada historia.

---

## Apertura (1 minuto)

> Hoy cada unidad de la universidad produce datos —matrícula, presupuesto, investigación—, pero los publica en lugares
> distintos o no los publica, y casi nunca de forma que otro pueda **reutilizarlos**. La plataforma es **un solo
> catálogo** donde cada unidad publica sus datos como tablas descargables, con su descripción, su licencia y una
> aprobación previa. Les voy a mostrar tres historias de uso.

Responde: «¿Qué busca solucionar la plataforma?» (`preguntas.md`).

---

## Historia 1 · Una unidad publica sus datos

**Quién.** Un editor de la Facultad de Ciencias y Tecnología (FCyT) y el administrador de la misma facultad.
**Qué necesita.** Publicar las **tasas de graduación por cohorte**, que hoy sólo se ven como tabla en páginas de
consulta.

> En el handoff la historia era «Planificación publica la matrícula». La instancia de demostración no tiene una
> organización de Planificación y sus usuarios de prueba son de la FCyT, así que la historia usa la FCyT. Se cuenta
> igual: *una unidad* publica sus datos.

| # | Pantalla | Estado | Ruta | Qué decir |
|---|---|---|---|---|
| 1 | Administración de usuarios: alta | maqueta | `/dev/prototype/users?vista=nuevo` | *(opcional)* Las cuentas no se abren solas: el administrador **invita** a la persona, que recibe un correo para definir su contraseña. |
| 2 | Inicio de sesión | construida | `/auth/login` | El editor entra con su cuenta institucional. |
| 3 | Panel | construida | `/dashboard` | Ve los datasets de **su** unidad, nada más. |
| 4 | Nuevo dataset | construida | `/dashboard/datasets/new` | Descripción, etiquetas, **licencia** y archivos. Nace **privado**. |
| 5 | Ficha con «Solicitar publicación» | construida | ficha del dataset recién creado | Nada se publica por decisión de una sola persona: el editor **pide**. |
| 6 | Solicitudes de publicación | construida | `/dashboard/requests` (como administrador) | El administrador de la facultad revisa y **aprueba o rechaza** con motivo. Son cuatro ojos. |
| 7 | Ficha pública | construida | ficha del dataset, sin sesión | Cualquiera lo ve, lo **descarga** y lo consume por **API**. |

**Mensaje.** *«UMSSSTAT muestra una tabla en una página. Acá la unidad publica el dato mismo: se descarga, tiene
licencia, tiene una aprobación detrás y se puede leer desde otro sistema.»*
**[validar]** que UMSSSTAT no tenga descarga (está pendiente en `preguntas.md`).

Responde: «¿Quién puede publicar?», «¿Y si se publica algo por error?», «¿Por qué licencias?», «¿Quién administra los
usuarios?», «¿Cuál es el diferenciador?».

---

## Historia 2 · Un docente busca datos

**Quién.** Un docente que prepara una clase o dirige una tesis. **No necesita cuenta.**
**Qué necesita.** Datos de matrícula para trabajar con sus estudiantes.

| # | Pantalla | Estado | Ruta | Qué decir |
|---|---|---|---|---|
| 1 | Inicio | construida | `/` | La puerta de entrada: buscar, o explorar por unidad o por tema. |
| 2 | Organizaciones (propuesta) | maqueta | `/dev/organizations` | *(opcional)* Las unidades agrupadas por tipo —facultades, direcciones— con su sigla y la fecha de su último dato. |
| 3 | Búsqueda «matrícula» | construida | `/search?q=matrícula` | Encuentra datos de **varias unidades** en un solo lugar. |
| 4 | Ficha del dataset | construida | `Matrícula estudiantil por carrera y gestión` | Qué contiene, quién lo publicó, cuándo, con qué licencia. |
| 5 | Recurso CSV: tabla y gráfico | construida | el CSV de esa ficha | Se ve antes de descargar; el gráfico se arma sin programar. Botón para copiar el acceso por API. |
| 6 | «Aparece en las colecciones» | construida + maqueta | la misma ficha real de la matrícula, más abajo (modo prototipo) | Este dato está **reunido con otros** en colecciones. Sin sesión sólo se ven las **públicas**. |
| 6b | Colecciones (menú principal) | maqueta | `/dev/prototype/collections` | *(opcional)* Desde el menú: todas las colecciones **públicas**, de personas y de unidades. |
| 7 | Ficha de colección de una persona | maqueta | `/dev/prototype/collection?c=indicadores-academicos` | Una investigadora juntó datos de **tres unidades** para su tesis. Desde aquí se salta a otro dataset, y de ese a otra colección. |

**Mensaje.** *«No hace falta saber qué oficina tiene el dato: se busca en un solo lugar. Y lo que alguien ya reunió
le sirve al siguiente.»*

Responde: «¿Por qué una plataforma "todo en uno"?», «¿Qué tipo de documentos se suben?», «¿En qué se diferencia del
repositorio institucional?».

---

## Historia 3 · El Rectorado arma la rendición de cuentas

**Quién.** El Rectorado, que **cura** una colección, y los administradores de las facultades que son dueñas de los
datos.
**Qué necesita.** Reunir en un solo lugar lo que va a la **rendición pública de cuentas 2025**: datos propios y de dos
facultades.

| # | Pantalla | Estado | Ruta | Qué decir |
|---|---|---|---|---|
| 1 | Mis colecciones (panel) | maqueta | `/dev/prototype/collections?vista=panel` | En su panel, María Fernanda Rojas Vargas, editora del Rectorado, ve las colecciones que cura ella y las del Rectorado, con su visibilidad: una lista de trabajo **privada** suya, que nadie más ve, y la de rendición de cuentas. |
| 2 | Ficha de colección, vista del curador | maqueta | `/dev/prototype/collection?c=rendicion-cuentas-2025&vista=curador` | Mientras se prepara es **privada**: sólo la ven los miembros del Rectorado. Reúne datasets del Rectorado, la FCyT y la FCS; para publicarla, **cada unidad dueña aprueba**: van 2 de 3. |
| 3 | Ficha de colección, vista pública | maqueta | `/dev/prototype/collection?c=rendicion-cuentas-2025&vista=publica` | Así la ve cualquiera cuando las tres aprueban: sin el tablero de aprobaciones. |
| 4 | Un dataset en dos colecciones | maqueta | `/dev/prototype/dataset-collections?d=informe-gestion-2025-fcyt&como=rectorado` | El informe de gestión de la FCyT se publicó **una vez** y está en la colección del Rectorado **y** en la de la Dirección de Investigación. |

**Mensaje — el caso de la carta.** *«La unidad publica el documento una sola vez y cada instancia que lo necesita lo
incluye en su colección. Nadie lo copia, todos ven la misma versión oficial y queda registrado quién lo publicó.»*
Si preguntan por el **seguimiento** de un trámite: es gestión documental, otro producto (`preguntas.md`, «El caso de la
carta»).

Responde: «El caso de la carta», «¿Quién ve qué?». Si preguntan por las colecciones privadas: una persona puede
tener las suyas para revisar datos sin publicarlas, y una organización las suyas, que ven sólo sus miembros.

> **Al capturar:** la franja punteada de arriba («Vista», «Quién mira») es de revisión, no del producto. No entra en
> el frame.

---

## Cierre (1 minuto)

- **Lo que viene** (se menciona, no se muestra): gestión de miembros de la organización, colaboradores de un dataset,
  equipos, **versiones** de un dataset y registro de auditoría.
- **La pregunta al tribunal:** ¿los perfiles de usuario deben ser públicos? (`preguntas.md`, «Preguntas para hacerle al
  tribunal»).

> Gracias. Quedo atento a sus preguntas.

---

## Enlaces en Figma

Un frame por paso; el nombre del frame es `H<historia>-<paso>` (por ejemplo `H1-4 Nuevo dataset`). El enlace sale del
elemento que se pulsaría en la página real.

| Desde | Elemento | Hacia |
|---|---|---|
| H1-1 Alta de usuario | botón «Enviar invitación» | H1-2 |
| H1-2 Inicio de sesión | botón «Iniciar Sesión» | H1-3 |
| H1-3 Panel | «Crear dataset» | H1-4 |
| H1-4 Nuevo dataset | botón «Crear dataset» | H1-5 |
| H1-5 Ficha del editor | «Solicitar publicación» | H1-6 |
| H1-6 Solicitudes | «Aprobar» | H1-7 |
| H2-1 Inicio | «Organizaciones» en el menú | H2-2 |
| H2-1 / H2-2 | buscador, con «matrícula» escrito | H2-3 |
| H2-3 Resultados | el título del dataset | H2-4 |
| H2-4 Ficha | el recurso CSV | H2-5 |
| H2-5 Recurso | «Volver al dataset» | H2-6 (la ficha, en la sección de colecciones) |
| H2-1 Inicio | «Colecciones» en el menú | H2-6b |
| H2-6 Colecciones del dataset | «Indicadores académicos para tesis» | H2-7 |
| H1-3 Panel | «Mis colecciones» | H3-1 |
| H3-1 Mis colecciones | «Rendición pública de cuentas 2025» | H3-2 |
| H3-2 Vista del curador | selector de vista, «Pública» | H3-3 |
| H3-3 Vista pública | «Informe de gestión 2025 — FCyT» | H3-4 |

## Importar a Figma

**Límite que manda:** el plan gratuito de html.to.design permite **10 importaciones cada 30 días** (ventana móvil;
`html.to.design/docs/pro-plan`). Este guion tiene 18 pasos. Cada captura es una importación, también las de prueba.

Hay dos formas de llevar una pantalla a Figma; para un prototipo que se recorre con clics, las dos sirven igual:

| | html.to.design | Captura de pantalla (imagen) |
|---|---|---|
| Resultado en Figma | capas editables (textos, colores, auto layout) | una imagen |
| Costo | 1 de las 10 importaciones | ninguno |
| Enlaces | a mano | a mano, con zonas pulsables sobre la imagen |
| Si la pantalla cambia | otra importación | otra captura |

Como los cambios se hacen en el código (regla 8 de `AGENTS.md`) y no en Figma, editar en Figma no hace falta para
presentar.

### Las herramientas, comparadas (2026-10-26)

| | html.to.design | Export to Figma (Eftikharul Alam Shoun) |
|---|---|---|
| Navegador | Chromium (Chrome, Edge, Brave) | Chrome y **Firefox** (en Firefox figura como «vista previa») |
| Cómo llega a Figma | extensión → plugin de Figma | extensión → **copiar y pegar** (`Ctrl+V`), sin plugin |
| Gratis | **10 importaciones cada 30 días** | **10 exportaciones por mes** |
| Pago | PRO | Pro: **US$ 1 al mes** (precio de lanzamiento), ilimitado |
| Páginas locales | sí (con la extensión) | sí («localhost and local HTML files») |

Fuentes: `html.to.design/docs/pro-plan`, `exporttofigma.com/pricing`, ficha de la Chrome Web Store. Su ficha declara que
maneja «Website content»; su política dice que no guarda los datos de las páginas capturadas, pero no aclara si las procesa
en su servidor. Las pantallas del prototipo sólo tienen datos de ejemplo; **no capture** una página con una contraseña o una
clave de API escrita.

**Los `<select>` salen vacíos** (observado por el autor con Export to Figma). Los desplegables nativos los dibuja el
navegador, no la página, y estas herramientas no los leen bien. Están en: H1-1 (organización y rol del alta), H1-4
(organización y licencia), H1-6 (estado de las solicitudes), H2-3 (orden de los resultados) y H3-1 (filtros de «Mis
colecciones»). Para esos frames: **captura de pantalla**, o escribir el texto encima en Figma.

### Con html.to.design (la prueba de T7)

1. **Plugin de Figma.** En un archivo de diseño de Figma: menú *Actions* (o *Plugins*) → buscar **html.to.design** →
   *Run*. La primera vez se instala desde Figma Community.
2. **Extensión del navegador.** Instalar la extensión **html.to.design** desde la Chrome Web Store. Funciona en navegadores
   Chromium (Chrome, Edge, Brave); **no en Firefox**. Hay que tener la sesión de Figma abierta en ese mismo navegador.
3. **Abrir la página** en ese navegador, con la ventana a ancho de escritorio (16:9, por ejemplo 1920 × 1080). Para la
   prueba: `https://odp.hs.lan/dev/prototype/users`.
4. **Capturar.** Abrir la extensión → elegir **Send to Figma plugin** → **Capture**. Para dejar afuera la franja punteada de
   revisión de las maquetas, capturar **una selección** (el área de producto) en vez de la página entera. Chrome avisa que la
   extensión «está depurando este navegador»: es normal, la usa para leer la página tal como se ve.
5. **Importar.** En Figma, en el plugin, pestaña **Extension**: la captura aparece ahí (o se importa sola). Importar.
6. **Revisar:** las tipografías (EB Garamond, Poppins y JetBrains Mono están en Figma; si el plugin dice que falta alguna,
   ofrece reemplazarla), los colores, los iconos y que nada se haya desarmado.

Si algo falla, la alternativa sin plugin es la captura de pantalla.

### Con captura de pantalla (sin límite)

1. Abrir la página en Chrome y pulsar `F12` (herramientas de desarrollo).
2. `Ctrl+Shift+M` → arriba, *Responsive* → escribir **1920 × 1080**.
3. `Ctrl+Shift+P` → escribir **Capture full size screenshot** → `Enter`. Se descarga un PNG de la página entera.
4. En Figma: crear un frame de 1920 de ancho, arrastrar el PNG adentro y nombrarlo como el paso (`H1-4 Nuevo dataset`).

### Enlazar en Figma (para las dos formas)

En el modo *Prototype* (arriba a la derecha): seleccionar el elemento o dibujar un rectángulo transparente sobre el botón de
la imagen → arrastrar el círculo que aparece hasta el frame de destino → *On click* → *Navigate to*. El orden está en la
tabla «Enlaces en Figma».

## Decisión de captura (2026-10-26)

Pantallas como **captura de pantalla** en frames de Figma; html.to.design sólo para la prueba de T7.

## Orden en Figma

Un archivo de Figma con tres páginas (las «páginas» del panel izquierdo de Figma):

1. **Historias**: los frames de la presentación, **una fila por historia**, de izquierda a derecha en el orden de los
   pasos: fila 1 `H1-1` … `H1-7`, fila 2 `H2-1` … `H2-7`, fila 3 `H3-1` … `H3-4`. El punto de partida del prototipo
   (*Flow starting point*) va en `H1-1`, o en `H1-2` si se salta el alta de usuario. Son **19 frames**.
2. **Otras pantallas**: lo que no está en las historias, para mostrar si alguien lo pide (organización, acerca de, página
   de error, constructor de gráficos, la búsqueda sin resultados, la vista pública de una colección ya publicada).
3. **Pruebas**: las importaciones de prueba; se borra antes de presentar.

Qué capturar primero, si las importaciones no alcanzan: las **maquetas** de las historias (son lo nuevo y lo que el
tribunal no vio): `H1-1`, `H2-2`, `H2-6`, `H2-6b`, `H2-7`, `H3-1` … `H3-4` (9). Las páginas construidas (`H1-2` … `H1-7`,
`H2-1`, `H2-3` … `H2-5`, 10) pueden ir como captura de pantalla.

## Pendientes antes del jueves

1. **Probar la importación con html.to.design** con una página (T7). Si falla, cambia todo el camino a Figma.
2. Capturar los frames de cada historia a **16:9 de escritorio**, con el usuario que corresponde a cada paso.
3. Validar la duración y las respuestas **[validar]** de `preguntas.md`.
