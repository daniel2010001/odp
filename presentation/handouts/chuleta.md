# Chuleta · Presentación del prototipo · jueves 29, 16:00

**Antes de empezar.** Modo prototipo activo (`odp.hs.lan/dev/prototype`) · contraseñas de `editor-fcyt`, `admin-fcyt` y
`editor-rectorado` en una ventana que **no** se proyecta · pestañas: Inicio, búsqueda «matrícula», panel y el índice de
diseños (`daniel2010001.github.io/odp/`) · **no** hacer clic en «Pruebe con» de una búsqueda sin resultados · la solicitud
pendiente sirve para **un** ensayo · los diseños con índice fijo, en Chrome.

**Al pasar a una maqueta, decirlo:** *«esta pantalla todavía no funciona; es el diseño»*.

## Apertura (1 min)

*Cada unidad produce datos, pero los publica en lugares distintos o no los publica, y casi nunca para que otro los
reutilice. La plataforma es **un solo catálogo** donde cada unidad publica sus datos como tablas descargables, con
descripción, licencia y una aprobación previa. Tres historias de uso.*

## Historia 1 · Una unidad publica sus datos (FCyT, ~4 min)

| # | Pantalla | Qué decir |
|---|---|---|
| 1 | Alta de usuario *(maqueta, opcional)* | El administrador **invita**; la persona define su contraseña. |
| 2 | Inicio de sesión | Entra con su cuenta. |
| 3 | Panel | Ve los datasets de **su** unidad, nada más. |
| 4 | Nuevo dataset | Descripción, etiquetas, **licencia**, archivos. Nace **privado**. |
| 5 | «Solicitar publicación» | Nadie publica solo: el editor **pide** («Asistencia a laboratorios…»). |
| 6 | Solicitudes (`admin-fcyt`) | El administrador **aprueba o rechaza** con motivo: cuatro ojos. |
| 7 | Ficha pública | Se ve, se **descarga** y se lee por **API**. |

**Mensaje:** *UMSSSTAT muestra una tabla en una página; acá se publica el dato mismo: se descarga, tiene licencia, tiene
una aprobación detrás y lo lee otro sistema.*

## Historia 2 · Un docente busca datos (sin cuenta, ~4 min)

| # | Pantalla | Qué decir |
|---|---|---|
| 1 | Inicio | Buscar, o explorar por unidad o por tema. |
| 2 | Organizaciones *(opcional)* | Unidades agrupadas por tipo, con la fecha de su último dato. |
| 3 | Búsqueda «matrícula» | Datos de **varias unidades** en un solo lugar. |
| 4 | Ficha de la matrícula | Qué contiene, quién, cuándo, con qué licencia. Abajo: **varias colecciones**. |
| 5 | Recurso CSV | Se ve antes de descargar; el gráfico, sin programar; copiar el acceso por API. |
| 6 | Colecciones del menú *(maqueta, opcional)* | Las públicas, de personas y de unidades. |
| 7 | Colección de una persona *(maqueta)* | Una investigadora juntó datos de **tres unidades**. |

**Mensaje:** *No hace falta saber qué oficina tiene el dato. Y lo que alguien ya reunió le sirve al siguiente.*

## Historia 3 · El Rectorado arma la rendición de cuentas (~4 min, `editor-rectorado`)

| # | Pantalla | Qué decir |
|---|---|---|
| 1 | Mis colecciones *(maqueta)* | Las que cura María Fernanda y las del Rectorado, con su visibilidad. |
| 2 | Colección, vista del curador *(maqueta)* | **Privada** mientras se prepara; **cada unidad dueña aprueba**: van 2 de 3. |
| 3 | Colección, vista pública *(maqueta)* | Así la ve cualquiera cuando las tres aprueban. |
| 4 | Ficha de la matrícula | Se publica **una vez** y aparece en **varias** colecciones: nadie lo copia. |

**Mensaje (el caso de la carta):** *Se publica una vez; cada instancia lo incluye en su colección; todos ven la misma
versión oficial.* El **seguimiento** de un trámite es gestión documental: otro producto.

## Cómo diseñamos (2 min)

Sistema de diseño (los mismos tokens que el portal) → **H2-1 · Inicio** 01, 02, 03 (alternativas, cada una con lo que
gana y pierde) → 04 síntesis → **05 elegida** → *(opcional)* ficha de organización, séptima dirección → del diseño al
portal: página de pruebas, revisión, página real (la barra de la búsqueda). **¿Por qué no Figma?** Vive en el
repositorio, con los mismos tokens; gratuito y local.

## Cierre (1 min)

Lo que viene: miembros de la organización, colaboradores, equipos, **versiones**, auditoría. **Pregunta al tribunal:**
¿los perfiles de usuario deben ser públicos? — *Gracias. Quedo atento a sus preguntas.*

**Si piden acortar (≈10 min):** sin los opcionales → historia 3 sólo pasos 2 y 3 → «Cómo diseñamos» sólo Inicio →
historia 1 desde el panel.

## Respuestas en una línea

- **¿Qué soluciona?** Información dispersa, sin versión oficial ni aprobación → un lugar con metadatos, aprobación y acceso.
- **¿Todo en uno?** Una copia oficial y las mismas reglas; cada facultad gobierna lo suyo.
- **¿Qué documentos?** Académicos, estadísticos, de gestión, financieros, de investigación, normativos. No: correspondencia.
- **¿Quién publica?** El editor pide; el administrador de su unidad aprueba.
- **¿Y si se publica algo por error?** El administrador baja la visibilidad de inmediato, con motivo; queda registrado.
- **¿Licencias?** La regla de qué puede hacer otro con el dato. Por defecto CC BY (citar a la UMSS).
- **¿Varias organizaciones?** Lo habitual; el rol es por organización.
- **¿Bloquear a un usuario?** Dejó la universidad, cuenta comprometida o suspensión; no borra sus datos.
- **¿Por qué CKAN?** Estándar de portales de datos abiertos; el portal es propio, encima de su API.
- **¿Diferenciador?** UMSSSTAT se consulta pero no se descarga (lo revisado). **No decir:** «muchas universidades usan
  CKAN», ni cifras. Portales bolivianos universitarios: *«no encontré»*, no «no existe».
