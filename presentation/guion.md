# Guion por historias — presentación formal del prototipo (jueves 2026-10-29, 16:00)

En vez de recorrer las pantallas una por una, la presentación cuenta **tres historias**. Cada una sigue a una persona
que necesita algo y muestra las pantallas en el orden en que las usaría. Las historias deciden también **qué frames se
enlazan en Figma**: html.to.design importa las páginas sin enlaces, así que sólo se enlazan a mano los pasos de estos
recorridos. El resto de las pantallas se importa igual y se muestra desde el índice si alguien la pide.

**Duración:** unos 4 minutos por historia, más apertura y cierre: alrededor de **15 minutos**. **[validar]** cuánto
tiempo le dan para exponer.

**Honestidad (S6).** Cada paso dice si la pantalla está **construida** (funciona hoy, se captura de la página real) o es
una **maqueta** (diseño de lo que viene, sin funcionamiento). Conviene decirlo en voz alta al pasar a una maqueta:
*«esta pantalla todavía no funciona; es el diseño»*.

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
| 6 | «Aparece en las colecciones» | maqueta | `/dev/prototype/dataset-collections?d=matricula-por-carrera` | Este dato está **reunido con otros** en colecciones. Sin sesión sólo se ven las **públicas**. |
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
| 1 | Colecciones (las del panel) | maqueta | `/dev/prototype/collections` | Las colecciones que ve un miembro del Rectorado: las suyas, las internas y las públicas. |
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
| H2-5 Recurso | «Volver al dataset» (abajo, la sección de colecciones) | H2-6 |
| H2-6 Colecciones del dataset | «Indicadores académicos para tesis» | H2-7 |
| H3-1 Colecciones | «Rendición pública de cuentas 2025» | H3-2 |
| H3-2 Vista del curador | selector de vista, «Pública» | H3-3 |
| H3-3 Vista pública | «Informe de gestión 2025 — FCyT» | H3-4 |

## Pendientes antes del jueves

1. **Probar la importación con html.to.design** con una página (T7). Si falla, cambia todo el camino a Figma.
2. Capturar los frames de cada historia a **16:9 de escritorio**, con el usuario que corresponde a cada paso.
3. Validar la duración y las respuestas **[validar]** de `preguntas.md`.
