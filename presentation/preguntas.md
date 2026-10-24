# Preguntas y respuestas — presentación formal del prototipo (jueves 2026-10-29, 16:00)

Hoja de apoyo para el presentador, **no** para el proyector. Recoge las preguntas de la charla del 2026-10-23 que
quedaron sin una respuesta preparada, más las que es razonable esperar. Las marcadas **[validar]** son borradores: el
autor las confirma con lo que conoce de la UMSS antes del jueves. El plan del prototipo está en
`odd/tasks/prototype-presentation.md`.

Regla para todas: **responder con lo que la plataforma hace o tiene planificado en el `PRD.md`**. Si la pregunta apunta a
algo que no está, se dice que no está y se anota; no se improvisa una promesa.

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
lugares — sin prometer el seguimiento de un trámite.

> Hoy un mismo documento se entrega **en copias** a varias instancias. En la plataforma se publica **una sola vez**, en
> la organización que lo emite, y cada instancia que lo necesita **lo incluye en su colección**. No se duplica, todos ven
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

> El dataset tiene **versiones**: «Matrículas 2024 v1», «v2»… Cada versión la crea el usuario a propósito, con su fecha,
> su autor y su propia aprobación. Corregir un título no crea una versión; cambiar los datos, sí. *(PRD RF-14 a RF-17;
> se muestra en el prototipo, no está construido.)*

### ¿Quién administra los usuarios y las organizaciones?

> Un **superadministrador** crea las cuentas y las organizaciones; cada **administrador de organización** gestiona a sus
> miembros y sus roles (lector, editor, administrador). *(PRD RF-01 a RF-08; se muestra en el prototipo.)*

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
