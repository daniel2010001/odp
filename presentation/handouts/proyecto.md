<div class="portada">

# Portal de datos abiertos de la UMSS

<p class="sub">Documento del proyecto · Versión 0.1.1 (demostración) · Universidad Mayor de San Simón</p>

</div>

Este documento describe el proyecto para quien administra las páginas web de la universidad: para qué existe, qué incluye y qué no, cómo funciona, con qué está construido y qué falta antes de ponerlo en producción. Nivel mixto: lo esencial se entiende sin conocimientos técnicos; las secciones 4 y 6 traen el detalle para quien lo necesite.

> **Los datos de la demostración son ficticios.** Los conjuntos de datos, las organizaciones y los usuarios de la versión 0.1.1 se crearon para probar el portal; no representan información real de la universidad.

## 1. Propósito y objetivos

La información de la universidad existe, pero está **dispersa**: archivos sueltos, enlaces que cambian, sin metadatos. Quien la busca no sabe quién la publicó, cuándo, con qué licencia ni si sigue vigente; quien publica no tiene un proceso. El proyecto propone un **lugar único** con catálogo, metadatos, licencias y un proceso de aprobación antes de publicar.

**Objetivo general.** Desarrollar e implementar una plataforma digital centralizada de gestión y publicación de archivos académicos y administrativos en la UMSS, que facilite el almacenamiento, la búsqueda, la colaboración y el intercambio de información de forma segura, auditable y accesible, conforme a los estándares de datos abiertos (FAIR).

**Objetivos específicos** (del documento de requerimientos del proyecto):

1. **Organizaciones**: facultades, departamentos, institutos y unidades, cada una con su propia gobernanza sobre sus datasets.
2. **Carga de recursos**: archivos en varios formatos y enlaces externos, con validación de tamaño y tipo.
3. **Metadatos**: un esquema mínimo extensible (Dublin Core / DCAT-AP), con historial y aprobación.
4. **Análisis de datos** (núcleo diferencial): procesar archivos CSV y generar visualizaciones interactivas configurables.
5. **Catálogo con búsqueda facetada**: filtros por organización, etiquetas, fecha y otros.
6. **Previsualización y exportación** de documentos y tablas.
7. **Grupos y colaboración**: colecciones transversales a las organizaciones y permisos granulares.

## 2. Alcance

El proyecto se planifica en niveles acumulativos: cada uno incluye lo anterior.

| Nivel | Qué es |
|---|---|
| **v0** | **La demostración**: el recorrido mínimo que se puede mostrar funcionando, para decidir si el proyecto continúa. No pretende cubrir todos los requerimientos. |
| **v0.1.x** | Pulido de la demostración (la versión 0.1.1 es la que se presenta). |
| **v1** | **La entrega del proyecto**, lista para desplegar en la infraestructura de la universidad, con su documentación, sus manuales y su defensa. |
| **v1+ / v2** | Lo diferido, cada ítem con su motivo escrito: lo conveniente pero no exigido (v1+) y los requerimientos que no alcancen para v1 (v2). |

**Dentro de la demostración (v0 / v0.1.x).** Catálogo (inicio, búsqueda con filtros, páginas de organización); ficha de dataset y de recurso con vista previa; inicio de sesión; creación y edición de datasets con archivos y enlaces; el flujo de publicación completo (solicitar, revisar, decidir y verlo público); gráficos sobre CSV; acceso por API.

**Previsto para la versión 1.** Gestión de organizaciones y de usuarios dentro del portal, gestión completa de datasets, colaboradores por dataset, equipos y colecciones, soft-delete y bloqueo, API pública documentada, búsqueda facetada y el módulo de análisis de datos. Además, documentación y manuales.

**Fuera de alcance de la versión 1.** Inicio de sesión institucional (SSO/LDAP, previsto para v2); extracción automática de metadatos desde el contenido de los archivos; edición masiva de metadatos; motor de IA para sugerir gráficos; mapas interactivos (v2); integración con repositorios externos (Google Drive, Dropbox y similares). La **auditoría completa** (registro de operaciones con retención de 5 años) está diferida a **v2**, con su motivo escrito en el documento de requerimientos.

**Lo que la demostración no incluye todavía** (se menciona, no se muestra): paginación en la vista previa de tablas (hoy se ven las primeras 20 filas), editar un recurso ya guardado desde la edición del dataset, gráficos incrustables en otras páginas, vista previa de audio y video, y vista previa de GeoJSON.

## 3. Cómo funciona

### Roles

| Rol | Qué puede hacer |
|---|---|
| **Visitante** (sin sesión) | Buscar, ver y descargar lo **público**. |
| **Miembro** de una organización | Sólo lectura: ve lo privado de su organización, pero no la lista de solicitudes. |
| **Editor** | Crea datasets, sube recursos, edita metadatos y **solicita la publicación**. |
| **Administrador de la organización** | Revisa las solicitudes de su organización y **decide**: aprobar o rechazar con motivo. |

La **administración** de usuarios y organizaciones se hace por ahora con CKAN, como «muleta operativa» de la demostración; llevarla al portal es trabajo de la versión 1.

### Flujo de publicación, con cuatro ojos

1. Un **editor** crea el dataset: queda **privado**, visible sólo para su organización.
2. El editor **solicita la publicación**, con un comentario.
3. El **administrador de la organización** revisa el dataset y **decide**. Sólo un administrador de la organización puede decidir; la superadministración de la plataforma no.
4. Si se aprueba, el dataset pasa a ser **público**. La ficha conserva el **historial** de solicitudes: cuándo, quién y con qué motivo.

**Regla de los cuatro ojos**: quien pide no aprueba su propio pedido. Excepción declarada: una organización con **una sola persona** que puede aprobar. El camino directo **no existe**: cambiar la visibilidad por la API sin pasar por una solicitud responde `403`; el control está en el servidor, no sólo en la pantalla.

### Formatos abiertos y vistas previas

Los archivos que se pueden subir son **datos** (CSV, TSV, XLSX, XLS, ODS, JSON, GeoJSON, XML), **documentos** (TXT, PDF) e **imágenes** (PNG, JPG), además de ZIP. El servidor rechaza otros tipos, por ejemplo un script, aunque se le cambie la extensión.

Sin descargar nada, el portal muestra **tablas** (CSV y hojas de cálculo), **PDF**, **imágenes**, **texto** y **JSON**. Para los formatos sin vista previa, como GeoJSON, lo informa con claridad y no descarga nada por su cuenta.

### Gráficos sobre un CSV

Desde la tabla de un CSV se crea un gráfico de **barras, líneas o pastel**. Cada gráfico se guarda como una **vista del recurso** y aparece como pestaña. Es el primer paso del módulo de análisis de datos, el núcleo diferencial del proyecto.

### API

Todo lo público se puede consultar por programa, sin permisos especiales: el portal expone la API de CKAN bajo el mismo dominio. Cada recurso muestra su dirección de acceso y un ejemplo de consulta, con botones para copiarlos. Por ejemplo:

```text
curl "https://demo.odp.hs.lan/api/3/action/package_show?id=<dataset>"
```

## 4. Arquitectura y tecnología

**CKAN 2.12 como catálogo «sin cabeza» (headless).** CKAN, la plataforma de datos abiertos más usada por gobiernos y universidades, aporta catálogo, metadatos, usuarios, organizaciones, almacenamiento y API. Se usa **sólo como motor de datos**: su interfaz no se ofrece. La **interfaz es propia**: un portal en **SvelteKit 2 (Svelte 5)**, con TypeScript estricto y TailwindCSS 4, con identidad visual propia, accesible y en español. Cada parte se actualiza por separado; el costo asumido es reconstruir en el portal cada pantalla que se necesita.

```text
navegador ──► proxy ──► portal (SvelteKit) ──► CKAN (API) ──► PostgreSQL
                │                                  │            Solr (búsqueda)
                └── /api/… (acceso público) ───────┘            Redis · DataStore
```

- **Contenedores** (Docker Compose): desarrollo, demostración y producción comparten la misma receta, que vive en un repositorio hermano, `odp-docker`.
- **El proxy** publica el portal y la API bajo un mismo dominio.
- **El puente del servidor del portal**: el navegador no habla con CKAN con credenciales. Al iniciar sesión, el servidor del portal canjea usuario y contraseña por un token de CKAN; **la contraseña nunca queda en el navegador**, y el token se revoca al cerrar sesión.
- **Gráficos incrustables**: cada gráfico tiene una dirección propia para incrustarlo en otra página. El resto del portal bloquea el *framing*; sólo esa ruta se puede incrustar.
- **Búsqueda**: Solr, el índice de CKAN. **Datos tabulares**: DataStore de CKAN, sobre PostgreSQL.

## 5. Estado actual y qué se verificó en la versión 0.1.1

La versión 0.1.1 es una **demostración**: el recorrido completo funciona sobre datos ficticios. Qué contiene:

- **Catálogo**: búsqueda con filtros que conserva su estado en la dirección web, etiquetas y chips que llevan al buscador filtrado, colores por formato, barra de búsqueda pegajosa y licencias unificadas.
- **Fichas**: resumen, información técnica, botones de copiar, bloque de acceso por API e historial de solicitudes.
- **Publicación**: solicitud, cola de solicitudes con filtro por organización, decisión por el administrador de la organización y regla de los cuatro ojos.
- **Gráficos** sobre CSV, con sus pestañas de vistas.

**Qué se verificó** (en la instancia de demostración reconstruida, `https://demo.odp.hs.lan`):

- El recorrido completo —solicitar, decidir, verlo público— con los usuarios de la demostración.
- La carga de datos de ejemplo, **sin errores**: 13 gráficos creados en 11 datasets.
- La gobernanza: el administrador de la organización puede decidir una solicitud pendiente y la superadministración recibe `403`.
- El filtro de archivos: un archivo `.sh` y un script renombrado como `.csv` son rechazados.
- Las vistas de recurso respondieron en las 336 consultas de una prueba.
- Revisión del autor sobre la versión reconstruida, con las correcciones resultantes.

El código del portal cuenta con pruebas automatizadas, verificación de tipos y análisis de estilo.

## 6. Riesgos y pendientes antes de producción (versión 1)

| Área | Pendiente |
|---|---|
| **Seguridad** | Revisión de seguridad integral del portal y de la política de existencia (qué revela una respuesta sobre un dato privado). |
| **Calidad de datos** | Cargador del DataStore que normalice tipos, números locales y fechas (hoy, por ejemplo, una hoja XLSX se carga con todo como texto). |
| **Operación** | Revisión de versiones de todos los servicios (incluida la 2.12.x de CKAN), prueba de carga, fijar la dirección pública real del sitio y comprobar en producción que la dirección de «Acceso por API» funciona tal cual se copia. |
| **Interoperabilidad** | Metadatos DCAT / Dublin Core. |
| **Administración** | Usuarios, organizaciones y permisos dentro del portal (hoy, por CKAN); colaboradores por dataset. |
| **Experiencia** | Vista previa de GeoJSON, paginación de la vista previa de tablas, edición de un recurso guardado, aviso al publicador cuando la carga de una tabla falla, revisión del diseño responsive de todas las páginas y rediseño de «Solicitudes». |
| **Identidad** | Integración con el inicio de sesión institucional: **no está en la versión 0**; queda como decisión para la versión 1 (SSO/LDAP figura para v2 en los requerimientos). |
| **Documentación** | Manuales de uso y de administración, y defensa del proyecto. |

## 7. Próximos pasos

- **Colaboradores por dataset**: CKAN lo trae; el portal necesita su pantalla.
- **Módulo de análisis de datos**, más allá de los gráficos de hoy.
- **Sección para desarrolladores**, con ejemplos de consumo de la API.
- **Administración dentro del portal**: usuarios, organizaciones y permisos.
- **Versionado, auditoría y colecciones.**
- **Antes de producción**: los pendientes de la sección 6, y la entrega de documentación y manuales.

No hay fechas comprometidas: es lo que el proyecto tiene previsto.

<div class="cierre">
<div>
{{QR_DEMO}}
<p class="rotulo">Demostración</p>
<p>https://demo.odp.hs.lan</p>
<p class="nota">Sólo se accede desde la red donde está instalada.</p>
</div>
<div>
{{QR_REPO}}
<p class="rotulo">Repositorio público</p>
<p>https://github.com/daniel2010001/odp</p>
</div>
<div class="autoria">
<p class="rotulo">Autoría y contacto</p>
<p class="pendiente">[Nombre y apellido — completar]</p>
<p class="pendiente">[Cargo / unidad — completar]</p>
<p class="pendiente">[Correo — completar]</p>
</div>
</div>
