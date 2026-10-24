# Preguntas y respuestas — presentación formal del prototipo (jueves 2026-10-29, 16:00)

Hoja de apoyo para el presentador, **no** para el proyector. Recoge las preguntas de la charla del 2026-10-23 que
quedaron sin una respuesta preparada, más las que es razonable esperar. Las marcadas **[validar]** son borradores: el
autor las confirma con lo que conoce de la UMSS antes del jueves. El plan del prototipo está en
`odd/tasks/prototype-presentation.md`.

Regla para todas: **responder con lo que la plataforma hace o tiene planificado en el `PRD.md`**. Si la pregunta apunta a
algo que no está, se dice que no está y se anota; no se improvisa una promesa.

**Lo que el tribunal necesita oír (lectura del autor, 2026-10-24).** En la charla del 2026-10-23 **no se mostró la demo**:
sólo se habló del proyecto. Para el tribunal, el prototipo del jueves **es** la demo, y lo que quiere saber es **si les
sirve**. Todavía no le encuentran el valor, o no lo terminan de entender. Por eso cada respuesta conviene anclarla en
**un caso de uso concreto de la universidad**, no en una lista de funciones.

**Es una plataforma administrativa.** Publican **las unidades** (facultades, direcciones, institutos) por medio de su
personal; los estudiantes y el público **consultan**. No es un lugar donde cualquiera sube lo que quiera.

---

## Las que ya hicieron (2026-10-23)

### ¿Qué busca solucionar la plataforma? **[validar]**

> Hoy la información de la universidad existe, pero está **dispersa**: planillas que circulan por correo, PDFs en carpetas
> de cada unidad, el mismo dato en varias versiones. Quien la busca no sabe **qué existe, cuál es la versión oficial,
> quién la publicó ni si sigue vigente**. Y quien publica no tiene un **proceso**: no hay quién apruebe qué se hace
> público.
>
> La plataforma da **un lugar único** donde cada unidad publica su información con **metadatos, aprobación y control de
> acceso**, para que se pueda **encontrar, reutilizar y, en el caso de las tablas, analizar** sin descargarla.

Ejemplo concreto para tener a mano (elegir uno real): el número de matriculados por carrera, que hoy cada facultad
reporta a su manera.

### ¿Por qué una plataforma «todo en uno»? **[validar]**

> Porque el problema es justamente que **la misma información vive en muchos lugares a la vez**. Si cada unidad tiene su
> propio sistema, el problema se repite: varias copias, ninguna oficial. Una sola plataforma da **un catálogo, una
> búsqueda y unas mismas reglas** para todas las unidades. Cada documento tiene **una copia oficial**, con su responsable
> y su historial.
>
> «Todo en uno» no quiere decir «todo centralizado en una oficina»: **cada facultad gobierna lo suyo** (sus datasets, sus
> editores, sus aprobaciones) dentro del mismo sistema.

### ¿Qué tipo de documentos se suben? (por contenido, no por formato) **[validar]**

Respondido el 2026-10-23: informes y tesis. Para el «¿qué más?», tener la lista entera:

| Categoría | Ejemplos |
|---|---|
| Académicos | Tesis y trabajos de grado, planes de estudio, programas de materias |
| Estadísticos | Matriculados, titulados y deserción por carrera y gestión; anuarios estadísticos |
| De gestión | Informes de gestión, memorias anuales, planes operativos (POA) y su cumplimiento |
| Financieros | Presupuesto y su ejecución |
| De investigación | Datos de proyectos, informes de institutos, encuestas |
| Normativos | Reglamentos, resoluciones, convocatorias |

Lo que **no** es: correspondencia y trámites internos (cartas, solicitudes, notas). Eso es gestión documental (ver la
siguiente).

### El caso de la carta: «una carta se presenta muchas veces a diferentes lugares»

Decisión del autor (2026-10-23): responder con lo que la plataforma **cumple** — subir una vez, aparecer en varios
lugares — sin prometer el seguimiento de un trámite. Precisión (2026-10-24): **el estudiante no es usuario de la
plataforma**; quien publica es **la unidad**. El ejemplo se adapta así:

> El estudiante entrega su carta, como hoy. Pero lo que la universidad **produce** con esas cartas —el informe, la
> resolución, la estadística— hoy también se copia a varias instancias. En la plataforma, **la unidad que lo emite lo
> publica una sola vez**, y cada instancia que lo necesita **lo incluye en su colección**. No se duplica, todos ven
> **la misma versión oficial**, y queda registrado quién lo publicó y cuándo.

Si insisten en el **seguimiento** («saber si la carta llegó, en qué oficina está, quién la observó»):

> Eso es un sistema de **gestión documental** (trámites), que es otro producto. Esta plataforma es de **publicación**:
> su aprobación decide qué se hace público, no hace circular un documento entre oficinas. Si es una necesidad de la
> universidad, lo anotamos para evaluarlo.

Y una pregunta de vuelta, si el clima lo permite: *«¿El caso de la carta es que el documento se reutilice en varios
lugares, o que se le haga seguimiento como trámite?»*

---

## Las que es razonable esperar

### ¿En qué se diferencia del repositorio institucional o de la página web?

> La **página institucional comunica**; el **repositorio** guarda documentos (tesis, artículos) para consultarlos. Esta
> plataforma publica **datos**: tablas que se pueden filtrar, graficar y descargar, con **licencia**, **versiones** y
> **aprobación por organización**, y con acceso por **API** para que otros sistemas los usen.

### ¿Quién puede publicar? ¿Cualquiera sube lo que quiere?

> No. Un **editor** de la organización crea el dataset, que queda **privado**. Para hacerlo público, **solicita la
> publicación**, y un **administrador de la organización** la aprueba o la rechaza con un motivo. Son cuatro ojos: quien
> sube no es quien aprueba. *(Funcionando hoy; se mostró en la demo.)*

### ¿Y si se publica algo por error?

> El administrador de la organización puede **bajar la visibilidad de inmediato**, sin esperar una solicitud, indicando el
> motivo; queda registrado. *(PRD RF-42.)*

### ¿Quién ve qué? ¿Hay información que no sea pública?

> Sí. Hoy hay dos niveles: **público** (cualquiera) e **interno de la organización** (sólo sus miembros). Está previsto un
> tercero, **privado del autor**. *(PRD §3; el tercero es `v1+`.)*

### ¿Qué pasa cuando un dato se actualiza? (versiones)

> El dataset tiene **versiones**: «Matrícula 2024 v1», «v2»… Una versión es **una entrega aprobada de los datos**: la
> crea el editor cuando cambia el contenido y pasa por la misma revisión que la primera publicación. Corregir un error de
> escritura en el título no es una versión; reemplazar el archivo de datos, sí. El historial queda: se puede ver qué se
> publicó antes. *(PRD RF-14 a RF-17; no está construido; la frontera exacta entre «menor» y «versión» es una pregunta
> abierta, Q17 en `design-system/datos-umss/preguntas-abiertas.md`.)*

### ¿Por qué licencias? ¿Qué son?

> Una licencia es **la regla escrita de qué puede hacer otro con el dato**: copiarlo, modificarlo, usarlo con fines
> comerciales, y si debe citar a la fuente. Sin licencia, legalmente **nadie sabe si puede reutilizarlo**, y entonces
> nadie lo reutiliza: un dato publicado sin licencia es un dato «abierto» sólo de nombre. Cada dataset declara la suya
> al publicarse. Lo habitual en datos públicos es **CC BY**: se puede usar libremente **citando a la UMSS**; para
> datos que se entregan al dominio público, **CC0**.

El formulario ofrece las licencias estándar de datos abiertos (CC BY, CC BY-SA, CC0, ODbL, ODC-BY, entre otras; ver
`src/lib/utils/licenses.ts`). **[validar]** si la universidad tiene una política de licencias propia.

### ¿Quién administra los usuarios y las organizaciones?

> Las **organizaciones** las crea sólo el **superadministrador**. Las **personas** entran por **invitación**: el
> administrador de una organización (o el superadministrador) escribe el correo y elige el rol; la persona recibe un
> correo para definir su contraseña y queda dentro de esa organización. Cada administrador gestiona a los miembros de
> **su** organización; nadie se registra solo. *(PRD RF-01 a RF-08; se muestra en el prototipo. La invitación es nativa
> del motor, pero necesita un servidor de correo configurado.)*

### ¿Por qué CKAN y no algo hecho desde cero?

> CKAN es el estándar de los portales de datos abiertos del sector público. Lo usamos **sólo como motor** (su API): toda
> la interfaz es propia, con la identidad de la UMSS. Así no reinventamos el catálogo, la búsqueda ni el almacenamiento.

### ¿Se integra con el inicio de sesión de la universidad?

> Está previsto. El inicio de sesión está **desacoplado** para poder conectarlo al sistema central (SSO/LDAP) más adelante.
> *(PRD RF-05; SSO es `v2`.)*

### ¿Qué falta? ¿Qué está funcionando y qué es prototipo?

> **Funcionando** (la demo): catálogo, búsqueda, fichas con vista previa, gráficos sobre CSV, inicio de sesión, creación de
> datasets y el flujo de publicación completo. **Prototipo** (lo de hoy): administración de usuarios y organizaciones,
> colaboradores, colecciones, equipos, versiones, perfil con clave de API y auditoría.

Tener claro, pantalla por pantalla, cuál es cuál: el índice `/dev/prototype` las separa en «construidas» y «nuevas».

---

### ¿En qué casos un usuario pertenece a más de una organización? **[validar]**

> Es lo habitual en una universidad: la misma persona trabaja para varias unidades. Por ejemplo, un **docente** de la
> Facultad de Ciencias y Tecnología que además **investiga** en un instituto publica en las dos; una **directora de
> carrera** administra los datos de su carrera y sólo consulta los de su facultad; un funcionario de **Planificación**
> carga los datos que le envían varias unidades. Por eso el rol se asigna **por organización**: la misma persona puede
> ser administradora en una y lectora en otra, y cada rol vale sólo donde se le dio.

### ¿Por qué se bloquearía a un usuario? **[validar]**

> Porque **dejó la universidad** (fin de contrato, jubilación, egreso), porque su cuenta **se vio comprometida**, o por
> una **suspensión temporal**. Bloquear no borra nada: los datos que publicó **son de su organización**, siguen
> publicados y queda registrado quién los creó. El bloqueo se puede revertir.

### ¿Cuál es el diferenciador frente a lo que ya tiene la universidad?

Investigación del 2026-10-24 (fuentes abajo). **Comprobado en la página:** UMSSSTAT. **El resto, por búsqueda**, con lo
no verificado marcado.

> Lo que hoy existe **muestra** información o **guarda documentos**; ninguno **publica datos reutilizables** de todas las
> unidades. UMSSSTAT muestra estadísticas en la página, el SAGAA los horarios de la FCyT, el repositorio guarda tesis y
> artículos, Moodle es para enseñar y Drive guarda archivos sueltos. La plataforma es **el catálogo único donde cada
> unidad publica sus datos en tablas descargables, con metadatos, licencia, aprobación previa y acceso por API**.
> **No reemplaza** a esos sistemas: los **complementa**, y lo que ellos ya producen puede publicarse acá como datos.

| Sistema | Para qué sirve | ¿Datos reutilizables (tabla descargable, API)? | Diferencia |
|---|---|---|---|
| **UMSSSTAT** (DPA + DTIC) | Estadísticas: matrícula, rendimiento, docentes | Tablas **en la página**; no se ve descarga, API ni licencia (sólo un manual de usuario) | Lo publica una sola unidad; la plataforma deja publicar a todas, y como datos descargables |
| **SAGAA** (FCyT) | Oferta académica: grupos y horarios | Páginas de consulta; descarga o API no vistas | Un tema, una facultad |
| **Repositorio UMSS** (DSpace) | Tesis, libros, artículos | Documentos, no tablas | Guarda documentos; la plataforma publica datos |
| **Moodle** (aulas virtuales) | Cursos | No | Su fin es enseñar |
| **Google Drive** | Guardar y compartir archivos | Archivos sueltos | Sin catálogo, metadatos, licencia ni aprobación |
| **Sitio de la FCyT, umss.edu.bo** | Comunicar: avisos, noticias | No verificado | Comunican; no son catálogos de datos |
| **datos.gob.bo** (AGETIC) | Datos abiertos del Estado | Sí | Es el nivel **nacional**; la plataforma sería el nivel **institucional** y podría alimentarlo |

**El contexto nacional, con cuidado.** El DS 5340 (26/02/2025) crea la plataforma «gob.bo» con un componente de **datos
abiertos del Estado**, con lineamientos de AGETIC. **No está verificado** que obligue a una universidad autónoma («podrán
solicitar su inclusión»): decirlo como **alineación**, no como obligación, hasta leer su art. 3.

**No decir:** «muchas universidades usan CKAN» (no hay fuente), ni cifras de ahorro o de adopción. Ninguna universidad
boliviana con portal de datos abiertos apareció en la búsqueda: decirlo como **«no encontré»**, no como «no existe».
Ejemplos de fuera: el portal de datos abiertos de la UNAM y el repositorio de datos de investigación de la Universidad de
Chile (Dataverse, que es otra cosa: datos de investigación, no institucionales).

**[validar]** Antes del jueves, abrir UMSSSTAT y confirmar que no tiene botón de descarga: es la comparación más probable
y la más fuerte.

Fuentes: UMSSSTAT `https://umssstat.umss.edu.bo/site/index` · SAGAA `https://sagaa.fcyt.umss.edu.bo/oferta/` · Repositorio
`http://bibliotecas.umss.edu.bo/site/php/index.php`, `http://ddigital.umss.edu/handle/123456789/48821` · Moodle
`https://www.umss.edu.bo/plataformas-educativas-estudiantes/` · AGETIC
`https://agetic.gob.bo/tramites-y-servicios/herramientas-y-servicios-digitales/datos-abiertos` · DS 5340
`https://www.lexivox.org/norms/BO-DS-N5340.xhtml` · UNAM `https://datosabiertos.unam.mx/` · U. de Chile
`https://datos.uchile.cl/`.

---

## Preguntas para hacerle al tribunal

- **¿Los perfiles de usuario deben ser públicos?** Hay portales que los muestran (como el motor que usamos: nombre,
  organizaciones y datasets publicados, **nunca el correo**) y otros que los reservan para usuarios con sesión. La
  propuesta es que sean públicos; se adapta a lo que prefieran. *(Decisión del autor, 2026-10-24.)*

---

## Ideas que **no** se presentan como parte del proyecto

- **Clonar un dataset** a otra organización conservando la referencia al original: está anotada en `BACKLOG.md`, sin
  origen confirmado ni requerimiento en el PRD. Si sale, se menciona como idea a evaluar.
- **Seguimiento de trámites** (gestión documental): otro producto.
