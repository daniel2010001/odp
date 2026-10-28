# Guion por historias — presentación formal del prototipo (jueves 2026-10-29, 16:00)

En vez de recorrer las pantallas una por una, la presentación cuenta **tres historias**. Cada una sigue a una persona
que necesita algo y muestra las pantallas en el orden en que las usaría.

**Soporte (decidido el 2026-10-28):** el tribunal quiere ver el **proceso de diseño**, no la implementación, y aceptó el
lienzo de **Gentle Design** en lugar de Figma, siempre que se pueda compartir. Las historias se recorren **desde el portal
con el modo prototipo activado** (las páginas enlazan entre sí, como un prototipo de Figma); las pantallas como diseños
están en el lienzo y publicadas en `https://daniel2010001.github.io/odp/design/`. No hay PDF de respaldo.

**Duración:** unos 4 minutos por historia, más apertura y cierre: alrededor de **15 minutos**. **[validar]** cuánto
tiempo le dan para exponer.

**Honestidad (S6).** Cada paso dice si la pantalla está **construida** (funciona hoy, se captura de la página real) o es
una **maqueta** (diseño de lo que viene, sin funcionamiento). Conviene decirlo en voz alta al pasar a una maqueta:
*«esta pantalla todavía no funciona; es el diseño»*.

**Antes de presentar: active el modo prototipo** en `https://odp.hs.lan/dev/prototype` (interruptor «Modo prototipo»,
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

## Cómo diseñamos (2 minutos)

**Qué mostrar:** el lienzo de Gentle Design con el diseño `inicio` (`https://daniel2010001.github.io/odp/design/` si se
abre desde otro equipo).

1. **El sistema de diseño** (`system.html`): colores, tipografías y componentes. *«Todas las pantallas salen de estos
   tokens; el mismo archivo los usa el portal, así que lo que se diseña es lo que se implementa.»*
2. **Tres direcciones para el Inicio** (01, 02, 03): cada una con lo que gana y lo que pierde. *«No se diseña una sola
   opción: se comparan alternativas.»*
3. **La iteración** (04): *«Revisé las tres, me quedé con partes de cada una y salió esta síntesis.»* Nombrar uno o dos
   ejemplos concretos: el encabezado de la 03, «Cómo llega un dato al catálogo» de la 02, la ficha de ejemplo de la 01.
4. **Comentarios sobre el diseño:** se comenta sobre el elemento mismo y el cambio queda en el historial del repositorio.

Si preguntan **por qué no Figma**: el diseño vive en el repositorio, versionado junto al código, y usa los mismos tokens
que el portal; no hay un archivo aparte que se desactualice. Es gratuito, sin límite de uso y local.

---

## Cierre (1 minuto)

- **Lo que viene** (se menciona, no se muestra): gestión de miembros de la organización, colaboradores de un dataset,
  equipos, **versiones** de un dataset y registro de auditoría.
- **La pregunta al tribunal:** ¿los perfiles de usuario deben ser públicos? (`preguntas.md`, «Preguntas para hacerle al
  tribunal»).

> Gracias. Quedo atento a sus preguntas.

---

## Pendientes antes del jueves

1. Elegir o ajustar la dirección del Inicio (04) para la parte «Cómo diseñamos».
2. Validar la duración y las respuestas **[validar]** de `preguntas.md`.
