---
marp: true
theme: datos-umss
paginate: true
lang: es
title: Portal de datos abiertos UMSS · Demostración v0.1.1
description: Presentación de la demostración del portal (diapositivas para proyector y chuleta del presentador)
---

<!-- _class: portada -->
<!-- _paginate: false -->

# Portal de datos abiertos de la UMSS

## Demostración de la versión 0.1.1

Universidad Mayor de San Simón

<!--
(00:00 · 1 min) Saludo y agradecimiento. Presentarse. Decir la duración: unos 50 minutos, con la demostración en vivo
en el centro y espacio para preguntas al final; se puede interrumpir en cualquier momento.
Mostrar esta diapositiva mientras se abre el navegador en otra ventana, ya con el portal cargado.
SI ALGO FALLA: el PDF también se puede proyectar; las diapositivas de demostración traen el recorrido paso a paso.
-->

---

## Qué veremos hoy

1. **El problema** y por qué un portal de datos abiertos para la UMSS.
2. **Cómo está construido**: una interfaz propia sobre CKAN, y el flujo de publicación con aprobación.
3. **La demostración en vivo**: catálogo, vistas previas, gráficos, acceso por API, publicación.
4. **Lo que viene**: lo que el proyecto ya tiene previsto.
5. **Preguntas.**

<!--
(01:00 · 1 min) Decir el orden y que lo técnico es breve: unos diez minutos de arquitectura y, después, lo que se ve.
Aclarar que se hablará con algo de detalle técnico porque el público conoce el tema web de la universidad, y que
puede pedir más profundidad en cualquier punto.
-->

---

<!-- _class: seccion -->

# 1 · El problema

<!--
(02:00) Separador de sección. Respirar; pasar de inmediato.
-->

---

## Por qué un portal de datos abiertos

- La información de la universidad existe, pero está **dispersa**: archivos sueltos, enlaces que cambian, sin metadatos.
- Quien la busca no sabe **quién la publicó, cuándo, con qué licencia ni si sigue vigente**.
- Quien publica no tiene un **proceso**: cualquiera sube lo que quiere, o nadie se anima a publicar.
- Un portal da un **lugar único**, con catálogo, metadatos, licencias y un proceso de aprobación antes de publicar.

<!--
(02:30 · 3 min) Explicar el problema con ejemplos concretos de la universidad (informes en PDF enviados por correo,
hojas de cálculo en carpetas compartidas, el mismo dato en tres versiones). No inventar cifras. Conectar con el
interés del departamento: el portal es una página más del ecosistema web de la universidad y hereda sus
exigencias de identidad, accesibilidad y mantenimiento.
Pregunta posible: «¿no lo resuelve ya la página institucional?» Respuesta: la página institucional comunica; el portal
organiza datos que se pueden descargar, citar, consultar por programa y reutilizar.
-->

---

## Qué entendemos por «datos abiertos»

- Datos que cualquiera puede **encontrar, descargar y reutilizar**, con una **licencia** explícita.
- En formatos **abiertos y procesables**: CSV, JSON, GeoJSON, hojas de cálculo; no sólo PDF.
- Con **metadatos** suficientes para entenderlos: título, descripción, organización, etiquetas, fecha, licencia.
- Con **acceso por programa** (API), no sólo por pantalla.

<!--
(05:30 · 2 min) Definición breve. Si el público lo pide, mencionar que el modelo de metadatos de CKAN es el estándar
de facto de los portales de datos del sector público. DCAT / Dublin Core: está previsto para más adelante (ver «Lo que viene»).
-->

---

<!-- _class: seccion -->

# 2 · Cómo está construido

<!--
(07:30) Separador. Esta sección dura unos diez minutos. Es la parte técnica; mantener el ritmo.
-->

---

## CKAN, pero «sin cabeza» (headless)

<div class="cols"><div>

**CKAN** es la plataforma de datos abiertos más usada por gobiernos y universidades: catálogo, metadatos, usuarios,
organizaciones, almacenamiento y **API** (`/api/3/action/…`).

Se usa **sólo como motor de datos**: la interfaz de CKAN no se ofrece.

</div><div>

**La interfaz es nuestra**: SvelteKit 2 (Svelte 5), TypeScript estricto, TailwindCSS 4.

- Identidad visual propia y accesible.
- Mensajes y flujos en español.
- Cambios de interfaz sin tocar CKAN.

</div></div>

<!--
(07:30 · 3 min) Decir por qué headless: la interfaz nativa de CKAN es difícil de adaptar a la identidad de la
universidad y de mantener entre versiones; con el motor detrás de una API y la interfaz aparte, cada parte se actualiza
sola. El costo asumido: hay que reconstruir en el portal cada pantalla que se necesita (por eso la administración de
usuarios y organizaciones se hace por ahora con CKAN, la «muleta operativa» del alcance v0).
Versión de CKAN: 2.12. Mencionar que se revisan las versiones de todos los servicios antes de desplegar (está en lo que viene).
Pregunta posible: «¿por qué no el tema de CKAN?» Respuesta de arriba.
-->

---

## Arquitectura en contenedores

```text
 navegador ──► proxy ──► portal (SvelteKit) ──► CKAN (API) ──► PostgreSQL
                │                                  │            Solr (búsqueda)
                └── /api/… (acceso público) ───────┘            Redis · DataStore
```

- Todo corre en **contenedores** (Docker Compose): desarrollo, demostración y producción comparten la misma receta.
- El **proxy** publica el portal y la API bajo un mismo dominio.
- Las **credenciales** nunca llegan al navegador: el portal las guarda en el servidor.

<!--
(10:30 · 2 min) Recorrer el diagrama de izquierda a derecha. Insistir en dos ideas: (1) el navegador nunca habla con
CKAN con credenciales; el portal es quien guarda la sesión del lado del servidor; (2) la API pública de lectura
queda disponible para terceros, y la veremos en la demostración.
No entrar en el detalle de cada servicio salvo que pregunten. Los contenedores viven en el repositorio hermano
«odp-docker»; el portal no los define.
-->

---

## El flujo de publicación, con cuatro ojos

<div class="cols"><div>

1. Un **editor** crea el dataset: queda **privado**.
2. El editor **solicita la publicación**.
3. Un **administrador de la organización** revisa y **decide**: aprobar o rechazar.
4. Si se aprueba, el dataset pasa a ser **público**.

</div><div>

**Regla de los cuatro ojos**: quien pide no aprueba su propio pedido.

Excepción declarada: una organización con **una sola persona** que puede aprobar.

El camino directo **no existe**: cambiar `private` por API responde `403`.

</div></div>

<!--
(12:30 · 3 min) Es la idea central del proyecto, tómese el tiempo. Explicar: la publicación es un proceso, no un
botón; hay un pedido, un revisor y un registro de quién decidió.
Técnicamente: el control está en la capa de CKAN (un guardián de escritura), no en la interfaz, así que no se salta
con una llamada directa a la API. Lo mostraremos al final de la demostración: package_patch con private=false → 403.
Si preguntan por la excepción: se decidió el 2026-10-15; la auto-aprobación sólo se permite cuando el catálogo confirma
que no hay otro administrador en la organización (la superadministración de la plataforma no cuenta).
-->

---

## Roles de la demostración

| Usuario | Organización | Capacidad | Para qué |
|---|---|---|---|
| `editor-fcyt` | FCYT | editor | crea y solicita publicar |
| `admin-fcyt` | FCYT | administrador | revisa y decide |
| `miembro-fcyt` | FCYT | miembro | sólo lectura: no ve «Solicitudes» |
| `editor-fcs` | FCS | editor | otra organización: no ve lo de FCYT |

Sin sesión: el visitante sólo ve lo **público**.

<!--
(15:30 · 1 min) Contraseñas: NO se muestran ni se dictan; están en el archivo de credenciales de la demostración
(odp-docker/.demo-users) y se tienen abiertas en otra ventana que NO se proyecta. Dejar claro quién es quién para que
el público siga el cambio de usuarios durante el flujo.
-->

---

<!-- _class: seccion -->

# 3 · Demostración en vivo

<!--
(16:30) Separador. Pasar a la ventana del navegador. Ruta recomendada: recorrer en el orden de las diapositivas
siguientes; cada una trae, en su nota, el qué decir, el qué pulsar y el plan B. Si el tiempo se acorta, saltar:
gráficos avanzados, búsqueda con paginación y el cierre por API (son los puntos «opcionales»).
-->

---

## Demo 1 · El catálogo

- Inicio del portal y **búsqueda** con facetas (organización, etiquetas, formato, licencia).
- Entrar a un dataset: **resumen**, organización, licencia, **información técnica**.

<div class="captura">CAPTURA PENDIENTE · inicio y búsqueda con facetas</div>

<!--
(16:30 · 4 min) SIN SESIÓN iniciada (ventana de incógnito o cerrada la sesión). Abrir http://localhost:8082
(o la URL de la demostración). Mostrar el inicio; escribir una palabra en el buscador (p. ej. «matrícula»); en los
resultados, filtrar por organización. Entrar a un dataset: señalar la tarjeta «Resumen» a la derecha, la organización y
la licencia. Abrir «Información técnica».
QUÉ DECIR: es lo que ve cualquier ciudadano; no hay que iniciar sesión.
SI FALLA: «No hay resultados» o error de catálogo → CKAN no responde; comprobar con docker ps los contenedores y
volver a lanzar la búsqueda. Plan B: mostrar las capturas de esta diapositiva (cuando estén).
-->

---

## Demo 2 · Búsqueda con paginación

- El catálogo de demostración tiene **51 conjuntos de datos**, en tres páginas de 20.
- Combinar **texto + filtros**; limpiar los filtros; **ordenar**.
- La URL **conserva** la búsqueda: se puede compartir.

<div class="captura">CAPTURA PENDIENTE · resultados paginados (página 2 de 3)</div>

<!--
(20:30 · 3 min · OPCIONAL) Requiere que el seed de la rama feat/seed-more-files esté corrido (51 datasets); sin él
sólo habrá ~25 y no habrá tres páginas: en ese caso omitir y decir «el catálogo real tendrá cientos».
Ir a /search, desplazarse hasta el paginador, pasar a la página 2, aplicar un filtro de formato (CSV) y mostrar que
vuelve a la página 1. Copiar la URL y abrirla en otra pestaña para mostrar que guarda el estado.
Si preguntan por rendimiento: el buscador es Solr (el de CKAN); la prueba de carga está prevista (ver «Lo que viene»).
-->

---

## Demo 3 · Vistas previas

Sin descargar nada, el portal muestra el archivo:

- **Tablas** (CSV, hojas de cálculo) · **PDF** · **imágenes** · **texto** · **JSON**
- **GeoJSON** y otros formatos sin vista previa: se informa con claridad, sin descarga automática.

<div class="captura">CAPTURA PENDIENTE · vista previa de un PDF y de una tabla</div>

<!--
(23:30 · 4 min) Abrir un dataset con CSV (p. ej. «Matrícula por facultad»): mostrar la tabla. Después el PDF
(informe-matrícula ficticio): se ve dentro de la página; usar el control de enfoque (#vista-previa) para llevar la vista
previa al centro de la pantalla. Después una imagen y un TXT si existen en el seed ampliado.
Mostrar un recurso GeoJSON: dice que no hay vista previa y NO descarga solo (decisión del autor, 2026-10-18).
QUÉ DECIR: los archivos son reales, subidos al portal; la previsualización es local, sin servicios externos.
SI FALLA: «Archivo no encontrado» en un PDF/imagen → el dataset es uno de los antiguos con enlaces en vez de archivos;
saltar a uno con archivo subido. Plan B: capturas.
-->

---

## Demo 4 · Gráficos sobre un CSV

- Desde la tabla de un CSV, **«Crear gráfico»**: barras, líneas o torta.
- Se guardan como **vistas del recurso** y aparecen como pestañas.
- **«Insertar»**: código para incrustar el gráfico en otra página (la del departamento, por ejemplo).

<div class="captura">CAPTURA PENDIENTE · gráfico de barras con el botón «Insertar»</div>

<!--
(27:30 · 5 min) Es el primer paso del módulo de análisis, el «núcleo diferencial» del proyecto. Con el CSV
«Monto ejecutado por unidad»: abrir las pestañas de gráficos ya sembrados (2–3 por dataset); mostrar cómo las etiquetas
largas del eje se giran o se parten según el espacio. Pulsar «Insertar», copiar el fragmento y pegarlo en una página de
prueba (preparada en el apéndice) para ver el gráfico incrustado.
PARA EL PÚBLICO TÉCNICO: el gráfico se sirve en /embed/charts/<id>; el resto del portal bloquea el framing
(X-Frame-Options / frame-ancestors) y sólo esa ruta se puede incrustar.
Para crear uno nuevo en vivo hace falta sesión con permiso de edición: entrar como editor-fcyt (se hace en la demo 6).
SI FALLA: «sin gráficos» → el seed de vistas no corrió (ver apéndice). Plan B: capturas.
-->

---

## Demo 5 · Acceso por API y botones de copiar

- Cada recurso muestra su **dirección de acceso por API** y un ejemplo de consulta.
- Botones de **copiar** para la dirección web, el identificador, el hash y el ejemplo.
- Cualquier programa puede consumir los datos: **sin interfaz, sin permisos especiales** para lo público.

```text
curl "http://localhost:8082/api/3/action/package_show?id=<dataset>"
```

<div class="captura">CAPTURA PENDIENTE · bloque «Acceso por API» con el botón de copiar</div>

<!--
(32:30 · 4 min) En la página de un recurso, ir al bloque de acceso por API, pulsar «Copiar» y pegar el ejemplo en una
terminal ya abierta (fuera del proyector, o proyectada si el tamaño de letra es grande): muestra el JSON de CKAN.
Mostrar que los botones de copiar tienen etiqueta cuando hay espacio y quedan sólo con ícono cuando no cabe
(reducir la ventana si hay tiempo).
Aclarar: la sección completa para desarrolladores (ejemplos de consumo en varios lenguajes) está en «Lo que viene».
OJO: en producción la dirección copiada debe funcionar tal cual; hoy se verificó en la demostración, no en producción.
SI FALLA: el portapapeles necesita HTTPS o localhost; en un dominio http el botón puede no copiar → escribir el curl a mano.
-->

---

## Demo 6 · Iniciar sesión y crear un dataset

- Entrar como `editor-fcyt`; menú de usuario y **panel** con «Mis datasets».
- **Asistente de creación**: datos, recursos (un **archivo** y un **enlace**), revisión.
- El dataset queda **privado**: sólo lo ve su organización.

<div class="captura">CAPTURA PENDIENTE · asistente de creación, paso de recursos</div>

<!--
(36:30 · 6 min) Iniciar sesión como editor-fcyt (contraseña del archivo de credenciales, sin mostrarla). Abrir el menú
de usuario (Panel, Solicitudes, Cerrar sesión). Ir a «Crear dataset»: título, descripción, etiquetas, licencia;
en recursos subir un archivo pequeño (hay uno de prueba en el escritorio, ver apéndice) y agregar un enlace.
Publicar como borrador privado. Comentar los íconos de tipo de archivo y la validación de formularios.
SI FALLA: la subida falla por tamaño o por permisos → usar el archivo de prueba del apéndice; si persiste, editar un
dataset ya existente en lugar de crear (no demuestra la subida, pero sigue el flujo).
-->

---

## Demo 7 · Solicitar la publicación

- En la ficha del dataset privado: **«Solicitar publicación»**, con un comentario.
- La ficha muestra el **estado de la solicitud**; el panel, la lista de pendientes.
- El **historial** de la solicitud: cuándo, quién y con qué motivo.

<div class="captura">CAPTURA PENDIENTE · tarjeta de solicitud con su estado «Pendiente»</div>

<!--
(42:30 · 3 min) Sigue como editor-fcyt. Pulsar «Solicitar publicación», escribir un motivo corto. Mostrar el estado
«Pendiente» en la ficha. Aclarar que el editor NO puede aprobar su propio pedido (cuatro ojos): mostrar que no hay
botón de decidir.
SI FALLA: «sin organización» → la instalación no está provisionada (apéndice). Plan B: usar un dataset privado ya sembrado.
-->

---

## Demo 8 · Decidir como administrador

- Cerrar sesión y entrar como `admin-fcyt`.
- **Solicitudes**: la cola, con filtro por organización; abrir el dataset **desde la fila**.
- **Aprobar** (o rechazar con motivo): el dataset pasa a **público**.

<div class="captura">CAPTURA PENDIENTE · cola de solicitudes con el botón «Decidir»</div>

<!--
(45:30 · 5 min) Cerrar sesión; entrar como admin-fcyt. Menú → Solicitudes. En la cola, mostrar la fila de la solicitud
y el enlace al dataset. Abrir el dataset, revisar, volver y decidir: aprobar. Mostrar el historial de la solicitud.
Opcional: antes, rechazar una solicitud con motivo (preparada) y mostrar el estado «rechazada» y el motivo.
También: entrar como miembro-fcyt para mostrar que NO ve «Solicitudes» (el menú sólo ofrece lo que se puede usar).
SI FALLA: si el admin no ve la solicitud, comprobar que el dataset es de la misma organización (fcyt). Si el aprobar
devuelve «no puede aprobar su propia solicitud», se creó con el mismo usuario por error: repetir con editor-fcyt.
-->

---

## Demo 9 · Verlo público

- Cerrar sesión: el dataset aparece en el **catálogo público**.
- La ficha ya **no ofrece** ningún control de publicación.
- *(Cierre opcional)* El camino directo **no existe**:

```text
curl -X POST …/api/3/action/package_patch -d '{"id":"…","private":false}'   →   403
```

<div class="captura">CAPTURA PENDIENTE · dataset recién aprobado visible sin sesión</div>

<!--
(50:30 · 4 min) Cerrar sesión (o ventana de incógnito). Buscar el dataset por su título: aparece. Entrar y mostrar que la
ficha es igual a las demás públicas. Cierre opcional (para el público técnico): en la terminal, llamar a package_patch
con private=false usando un token de editor → 403 con el rótulo del flujo. Explicar que el control está en el servidor.
SI FALLA: el dataset no aparece → el índice de búsqueda tarda unos segundos; recargar. Plan B: capturas.
-->

---

<!-- _class: seccion -->

# 4 · Lo que viene

<!--
(54:30) Separador. Insistir: no es un compromiso de fechas, es lo que el proyecto ya tiene previsto.
-->

---

## Lo que ya está previsto

- **Colaboradores por dataset (RF-18)**: CKAN lo trae; el portal necesita su pantalla para administrarlos.
- **Módulo de análisis de datos**: más allá de los gráficos de hoy (RF-24).
- **Sección para desarrolladores**: ejemplos de consumo de la API (RF-37 y RF-38).
- **Administración dentro del portal**: usuarios, organizaciones y permisos (hoy por CKAN).
- **Versionado, auditoría y colecciones.**

<!--
(54:30 · 3 min) Tomado de «lo que viene» (odd/tasks/backlog-prd-reconciliation.md, anotado el 2026-10-16). El orden de
las features de valor lo decidió el autor: primero gráficos sobre un CSV (ya está), después la sección para desarrolladores.
No prometer fechas.
-->

---

## Antes de salir a producción (v1)

- **Seguridad**: revisión integral; qué hace el cierre de sesión con el token.
- **Calidad de datos**: cargador del DataStore que normalice tipos, números locales y fechas.
- **Operación**: revisión de versiones de todos los servicios y prueba de carga.
- **Interoperabilidad**: metadatos DCAT / Dublin Core.
- **Experiencia**: paginación en la vista previa, vista previa de GeoJSON, chips y etiquetas que lleven al buscador.
- **Documentación y manuales.**

<!--
(57:30 · 2 min) Titulares del BACKLOG en el nivel v1 / v1+. Elegir tres según el público: seguridad, calidad de datos y
operación suelen interesar a quien mantiene sitios web. Aclarar que v1 es la entrega del proyecto: documentación,
manuales y defensa.
-->

---

<!-- _class: seccion -->

# Cierre y preguntas

## Gracias

<!--
(59:30) Resumir en una frase: un portal propio sobre CKAN, con un proceso de publicación con cuatro ojos, vistas previas,
gráficos y API. Abrir las preguntas. Dejar esta diapositiva en pantalla.
PREGUNTAS PROBABLES: (1) ¿cómo se despliega y quién lo mantiene? → contenedores, receta en odp-docker; (2) ¿cómo se
integra con el dominio y el inicio de sesión institucional? → no está en v0; queda como decisión para v1; (3) ¿y los
datos sensibles? → los privados sólo los ve su organización; la política de existencia está en revisión de seguridad.
-->

[//]: # (apendice)

---

<!-- _class: apendice -->

## Apéndice A · Antes de presentar

Esto **no se muestra** en el proyector; sólo está en el PDF.

- [ ] **Provisión**: las organizaciones y los usuarios existen (`admin-fcyt`, `editor-fcyt`, `miembro-fcyt`, `editor-fcs`).
- [ ] **Seed corrido**: datasets, archivos y gráficos de ejemplo; **51 datasets** si la rama `feat/seed-more-files` ya se ejecutó.
- [ ] **Contraseñas** a mano en otra ventana (no proyectada), archivo `odp-docker/.demo-users`.
- [ ] **Contenedores arriba**: `docker ps` y `http://localhost:8082` responde.
- [ ] **Navegador**: ventana limpia, sin sesión, zoom adecuado para el proyector, notificaciones apagadas.

<!--
Comprobación rápida: abrir /search (debe haber resultados), un dataset con CSV y pestañas de gráficos, un PDF con vista
previa, y probar el inicio de sesión de los cuatro usuarios antes de empezar.
-->

---

<!-- _class: apendice -->

## Apéndice B · Material de apoyo

- [ ] **Archivo de prueba** pequeño (CSV o PDF) para la subida de la demo 6.
- [ ] **Página de prueba** con un `<iframe>` para pegar el código de «Insertar» (demo 4).
- [ ] **Terminal** abierta con `curl` y un token de editor (demo 9, cierre opcional).
- [ ] **Capturas** de plan B en `presentation/` (reemplazan los recuadros «CAPTURA PENDIENTE»).
- [ ] **Hora acumulada**: 16:30 inicio de demo · 54:30 fin de demo · 60:00 cierre.
- [ ] Si el tiempo se acorta, omitir la demo 2 y el cierre por API.

<!--
Plan por tiempo: con 45 minutos, omitir la demo 2 (búsqueda con paginación), la demo 5 en vivo (dejarla como captura)
y el rechazo opcional de la demo 8.
-->
