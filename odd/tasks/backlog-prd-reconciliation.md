# Expediente ODD — reconciliación del `PRD.md` y del `BACKLOG.md` (tiers y divergencias)

**Autorizado por el autor el 2026-10-09** («me gustaría hacer el barrido del backlog, una revisión del doc en
general, junto al prd si se puede» → **GO**).

## Goal

Dejar el `PRD.md` y el `BACKLOG.md` **coherentes con lo que se construyó**, y **recortar `v1`**: censo de los ítems
`[v0]`, cruce requerimiento por requerimiento, re-tiering explícito, y una carilla «qué es `v0` y qué no es» que sirva
además de guion de presentación.

## La regla que el autor fijó (2026-10-09)

**El PRD no es la fuente de verdad de lo construido**: es un documento que alguien escribió en un momento, y puede
contradecir lo que hoy existe. Donde el PRD declara un módulo «con las features Y y Z completas» y `v0` tomó **sólo Y**,
**Z parcial**, o **Z con cambios hechos durante el desarrollo**, la **divergencia se registra en el propio PRD** —con
fecha y motivo— en vez de dejarla al lector deducirla. La misma regla vale para el `BACKLOG`.

Consecuencia directa, y es la que originó la autorización: **una contradicción entre el PRD y el portal no se resuelve
silenciosamente a favor del PRD**. Se mide qué existe y se escribe la diferencia.

## Los cuatro pasos

1. **Censo de los `[v0]` abiertos** (`13` al 2026-10-09) con medición por ítem (`path:line`, comando o URL) y **cierre de
   los stale**. Los dos primeros sospechosos ya identificados: el «`403` pintado como *Recurso no encontrado*» (la
   página ya renderiza `ErrorPage`) y la sonda de sesión (ya existe `src/lib/session-guard.ts`).
2. **Cruce `PRD` ↔ `BACKLOG` ↔ código**, requerimiento por requerimiento, con cuatro estados posibles: **hecho**,
   **parcial**, **ausente**, **sin equivalente en CKAN**.
3. **Re-tiering explícito de `v1`**: lo que no entra se mueve **con el motivo escrito**, y el destino puede ser `v1+`
   **o `v0`** — el autor lo precisó: no sólo se recorta hacia arriba, también se puede **traer a `v0`** lo que hoy está
   mal ubicado.
4. **Una carilla «qué es `v0` y qué no es»**: los tres estados anteriores en una página, más el **guion de la
   presentación**, incluida la **provisión de una instalación vacía** (sin organizaciones no hay dataset posible: la
   muleta aceptada es CKAN / `scripts/seed-ckan.mjs`).

## Reglas de trabajo

- **Las citas de código del **otro** repo van por **ancla** (función, símbolo, escenario), no por número de línea.** Una
  ruta ajena **envejece sin que su dueño se entere**, y el número de línea es lo primero que se corre: es la misma
  lección que este repo ya pagó con las citas del PRD, aplicada al otro repo. Lo mismo vale para el path cuando el
  ancla alcanza; el path se conserva sólo como procedencia de la medición. **Las tres citas con número de línea del
  otro repo que había el 2026-10-09 se corrigieron en el mismo movimiento** —el paso 2 no debería encontrar ninguna.
  *Origen (2026-10-09): la sesión par se negó a citar rutas nuestras en su contrato por esta misma razón (una ruta de
  otro repo envejece y su doc quedaría mintiendo por algo que no es suyo), y el criterio se aplicó de vuelta acá.*

- **Un archivo canónico por tema.** Los cambios al PRD van **al PRD**; los de pendientes, al `BACKLOG`. No se crea un
  archivo nuevo por sesión ni por decisión.
- **Ninguna afirmación de «hecho» sin medición.** Un `path:line`, un comando o una URL por afirmación.
- **No se toca código del portal en esta unidad** (es documentación; si un hallazgo pide código, se anota).
- El tier final lo define el autor: el agente propone con la medición delante.

## Estado

**Pasos 1 y 2 HECHOS (2026-10-09).** Los pasos 3 (re-tiering y enmiendas) y 4 (la carilla) siguen pendientes. La
medición la hizo **exploración delegada** ese día, celda por celda con su `path:line`; **dos de los trece ítems del
paso 1 los re-verifiqué yo** y coinciden (la página de recurso renderiza `ErrorPage`; la sonda vive en
`src/lib/session-guard.ts` y la corren las pantallas que pintan datos). Ninguna fila se re-verificó una por una.

---

## Paso 1 · Censo de los `[v0]` abiertos (2026-10-09)

Los **13** ítems que el `BACKLOG` tiene abiertos con etiqueta `[v0]`, medidos **contra el código de hoy** —no contra su
danotación del 2026-09-30, que ya estaba vieja—.

| # | Ítem (corto) | Estado hoy | Evidencia | Lectura |
|---|---|---|---|---|
| 1 | Sin organizaciones, no ofrecer crear | **STALE** | `dashboard/+page.svelte:214,513` · `api/organizations.ts:49` | El CTA se dibuja sólo con `puedeOfrecerCreacion`; sin org, `puedeCrear` es falso. **Se cierra.** |
| 2 | Sesión muerta degrada a anónimo en silencio | **STALE** | `api/session.ts:63` · `lib/session-guard.ts:31` | La sonda expulsa al login en las pantallas que pintan datos. Lo que queda es el ítem 13. **Se cierra.** |
| 3 | Recurso privado → «no encontrado» | **STALE** | `resource/[resourceId]/+page.svelte:141` · `api/failure.ts:124,137` | El mock ya no enmascara un 403/404 definitivo, y la **fusión para el anónimo es política declarada**. **Se cierra como política.** |
| 4 | Normalizar la card de metadatos | **PARCIAL — decisión del autor** | `dataset/[id]/+page.svelte:744` vs `:921-922` | La del cuerpo ya cumple; la del sidebar no, y cuál sobrevive no está decidido. |
| 5 | Descarga apunta a la URL de CKAN | **VIVO — diferido por decisión** | `resource/[resourceId]/+page.svelte:385,550` | Decisión del 2026-10-08: funciona, no bloquea `v0`, se retoma **antes de `v1`**. |
| 6 | Colaboradores por dataset | **VIVO — y la etiqueta no coincide** | `api/organizations.ts:77` (bandera en `false`) | Está taggeado `[v0]` y lo medido es `[v1+]`. **Es un descuadre de etiqueta**, no un pendiente de `v0`. |
| 7 | Página de la organización | **VIVO — decisión del autor** | `organization/[id]/+page.svelte:172-223` | Encabezado + grilla; frena en el alcance que sólo el autor define. |
| 8 | Responsive del salto secuencial | **NO MEDIDO** | `resource/[resourceId]/+page.svelte:546` | Falta **el síntoma concreto y la anchura**: sin eso no hay nada que medir. |
| 9 | Los pegados no comparten el aire | **VIVO — diseño** | `search/+page.svelte:521,624` · `app.css` (sin `--sticky-air`) | Los aires siguen distintos; frena en «tarjeta flotante o barra a ras». |
| 10 | Rotar credenciales de la base | **NO MEDIDO — operación** | `ckan-docker/.env.example:12,17-19` | El template conserva los valores expuestos; el `.env` vivo no es legible desde acá. |
| 11 | Higiene de versión (`CKAN_VERSION`) | **PARCIAL** | cuatro `Dockerfile` con `FROM …2.12` | La variable ya no aparece en archivos versionados, pero el `FROM` sigue flotando en el minor. |
| 12 | Las vistas previas son chicas | **VIVO — criterio del autor** | `ResourcePreview.svelte:131,138,151` | Topes fijos (`520px`, `360px`) sin medición del alto libre; el criterio es del autor. |
| 13 | El encabezado miente con sesión muerta | **VIVO — defecto real y barato** | `+layout.svelte:132-133` · `UserMenu.svelte:59` | El encabezado monta `UserMenu` según el store y éste imprime el nombre **sin sondear**. **El único de los trece que es un defecto puro y de arreglo chico.** |

**Lo que el censo deja:** **3 cerrados** (1, 2, 3 — dos por trabajo hecho, uno por política), **2 parciales** (4 y 11),
**6 vivos** (5, 6, 7, 9, 12, 13 — de los cuales **cuatro son decisiones del autor** y **uno es un descuadre de
etiqueta**), **2 sin medir** (8 necesita el síntoma del autor, 10 es operación). Queda **un solo defecto de `v0`** que
no depende de una decisión: **el 13**.

---

## Paso 2 · Cruce `PRD` ↔ `BACKLOG` ↔ código (2026-10-09)

Los **42 requerimientos** de `PRD.md` §5 (`RF-01`…`RF-42`), cruzados con el tier que el PRD declara, el ítem del
`BACKLOG` que los registra y el código que los implementa —o no—.

| RF | Módulo | Qué exige | Tier según el PRD | Registro en el BACKLOG | Evidencia en el código | Nota |
|---|---|---|---|---|---|---|
| RF-01 | Usuarios | Roles de org **y** por dataset | v1 (§3, §9) | `[x]` roles L2368 | `types/ckan.ts:49` | Sólo capacidad de org; los roles por dataset no existen |
| RF-02 | Usuarios | Usuario pertenece a una org principal | v1 | **sin registro** | `api/organizations.ts:124` | Multi-org vía `member` de CKAN |
| RF-03 | Usuarios | Creación de usuarios por `superadmin`/`org_admin` | v1 (§3) | `[v1+]` gestión de usuarios L2950 | `ausente` | **PRD dice v1; el BACKLOG dice v1+** |
| RF-04 | Usuarios | Email + contraseña, sesión **JWT** | v1 | **sin registro** | `api/auth.ts:24` + `auth/login/+server.ts` | **El PRD dice JWT; corre con tokens/sesiones de CKAN** |
| RF-05 | Usuarios | Login desacoplado para SSO futuro | v1 (SSO → v2) | **sin registro** | `api/auth.ts:3` | Cumple |
| RF-06 | Organizaciones | Org: nombre, slug, descripción, jerarquía, metadatos | v1 (§3) | `[v1]` orgs L2863 | `api/organizations.ts:27` | `parent_id` no es nativo |
| RF-07 | Organizaciones | Toda org tiene al menos un `org_admin` | v1 | `[v1]` orgs L2863 | `ausente` | — |
| RF-08 | Organizaciones | Dataset de una única org | v1 | `[v1]` orgs L2863 | `schemas/dataset.ts:150` | Mapea a `owner_org` |
| RF-09 | Datasets | Estado editorial `draft/review/approved/published` + **3 niveles** de visibilidad | v1; el «privado — solo autor» → v1+ (§3) | **sin registro** | `schemas/dataset.ts:131` | **2 de 3 niveles; sin ciclo editorial** |
| RF-10 | Datasets | Metadatos en JSONB | v1 | **sin registro** | `utils/dataset-payload.ts:95` | Mapea a `extras` |
| RF-11 | Datasets | Recursos con nombre, tipo, tamaño, **hash**, URL | v1 | `[x]` RF-11/13 L1664 | `api/resources.ts:14` | El hash lo calcula el portal |
| RF-12 | Datasets | Tope de 50 MB por recurso | v1 | `[x]` techos L3166 | `utils/dataset-payload.ts:12` | CKAN permite 100 MB |
| RF-13 | Datasets | Recurso = archivo **o** enlace | v1 | `[x]` RF-11/13 L1664 | `schemas/resource.ts:51` | Se infiere de `url_type` |
| RF-14 | Versionado | Versiones explícitas con estado y visibilidad propias | v1+ (§7: sin API nativa) | `[v1+]` versionado L2958 | `ausente` | `activity` no alcanza |
| RF-15 | Versionado | `draft→review→approved` + solicitud de visibilidad | v1 (§3) | cambio `2026-09-13-publication-lifecycle` L1877; RF-41/42 `[v1]` L1403 | `api/publication.ts:113` | **La máquina editorial (pasos 1–3) quedó fuera de alcance** |
| RF-16 | Versionado | Aprobación genera versión para auditoría | v1+ (§7) | `[v1+]` versionado L2958 | `ausente` | — |
| RF-17 | Versionado | Cambios menores: sólo auditoría | v1+ (§7) | **sin registro** | `ausente` | — |
| RF-18 | Colaboradores | Colaboradores por dataset (`view/edit/admin`) | v1 (§3) | **`[v0]`** colaboradores L2452 | `api/organizations.ts:77` | **Etiqueta `[v0]` contra un tier `v1`; bandera apagada** |
| RF-19 | Colaboradores | Permisos por usuario **o** por equipos | v1+ (§7) | `[v1+]` colaboradores L2912 | `ausente` | `teams` sin equivalente |
| RF-20 | Colaboradores | Equipos con org y miembros | v1 (§3) | `[v1+]` L2912/L2979 | `ausente` | §7 sólo difiere RF-19 |
| RF-21 | Colecciones | Colección con nombre, descripción, visibilidad | v1 (§3) | `[v1+]` colecciones L2947 | `ausente` | Mapea a `group` |
| RF-22 | Colecciones | Colección con datasets de varias orgs | v1 (§3) | `[v1+]` colecciones L2947 | `ausente` | — |
| RF-23 | Colecciones | Pública exige aprobación de cada `org_admin` | v1+ (§7) | `[v1+]` colecciones L2947 | `ausente` | No es nativo |
| RF-24 | Análisis | CSV: tipos, tabla, frecuencias y gráficos | v1 (§3) | `[v1+]` análisis L2939 | `utils/csv.ts:38` (sin llamadores) | **PRD dice v1; el BACKLOG dice v1+** |
| RF-25 | Análisis | Mapas (lat/long, geocodificación) | v2 (§3) | **sin registro** | `ausente` | — |
| RF-26 | Análisis | IA para sugerencias | v2 (§3) | **sin registro** | `ausente` | — |
| RF-27 | Catálogo | Todo se indexa en Solr | v1 (§3) | **sin registro** | `api/datasets.ts:12` | CKAN indexa |
| RF-28 | Catálogo | Filtros por org, tags, visibilidad, fechas, tipo | v1 (§3) | **sin registro** | `search/+page.svelte:22` | La visibilidad depende del backend |
| RF-29 | Catálogo | Facetas por filtro | v1 (§3) | **sin registro** | `api/datasets.ts:19` + `FacetFilter.svelte` | — |
| RF-30 | Preview | PDF, imagen, TXT y JSON en el navegador | **el PRD no lo declara** | `[v0]` vistas previas L2646 | `resources/preview.ts:26` | Requerimiento **sin tier** |
| RF-31 | Preview | CSV: tabla con las primeras 20 filas | **el PRD no lo declara** | `[v0]` vistas previas L2646 | `api/datastore.ts:32` | Decidido por `datastore_active` |
| RF-32 | Preview | Gráficos exportables y datos a CSV | **el PRD no lo declara** | **sin registro** | `ausente` | Sólo «Descargar recurso» |
| RF-33 | Auditoría | Auditar CUD, visibilidad, aprobaciones, logins | v1 (§3) **y** v1+ (§7) | `[v1]` auditoría L2867 | `ausente` | **Contradicción dentro del PRD** |
| RF-34 | Auditoría | `audit_logs` propio con triggers | v1+ (§7) | `[v1]` auditoría L2867 | `ausente` | Idem |
| RF-35 | Auditoría | Soft-delete con `deleted_at` | v1+ (§7) | **sin registro** | `api/datasets.ts:108` | Nativo (`state='deleted'`) |
| RF-36 | Auditoría | Bloqueo `access_status` reversible | v1+ (§7) | **sin registro** | `ausente` (sólo el tipo) | Sin equivalente |
| RF-37 | API pública | API REST propia para consultar | v1 (§3) | **sin registro** | `api/client.ts:15` | El portal **no** expone API propia |
| RF-38 | API pública | Acceso con **API Key** | v1 (§3) | **sin registro** | `api/client.ts:23` | Usa token de sesión |
| RF-39 | Datasets | Markdown sin HTML crudo, con vista previa | v1 | `[x]` markdown L1760 | `utils/markdown.ts:22` | Decisión: markdown, no HTML |
| RF-40 | Datasets | Resumen corto para las cards | **el PRD no lo declara** | `[x]` summary L1828 | `utils/dataset-summary.ts:11` | Extra propio |
| RF-41 | Versionado | Degradación **solicitada** | v1 (§3) | RF-41/42 `[v1]` L1403 | `api/publication.ts:52` | Sin UI de bajada |
| RF-42 | Versionado | Degradación **directa** con motivo | v1 (§3) | RF-41/42 `[v1]` L1403 | `ausente` | La única excepción al flujo |

### Lecturas del cruce

- **El PRD no asigna NADA a `v0`: cero de 42.** El tier `v0` no existe en la lista de requerimientos —existe como
  **criterio de salida** en §3 y como **etiquetas en el `BACKLOG`**—. Es la contradicción de forma que el autor
  intuía, y es la primera que hay que resolver: **el PRD y el BACKLOG no hablan del mismo `v0`.**
- **Conteo por tier según el PRD**: `v0` **0** · `v1` **27** · `v1+` **9** · `v2` **2** · **sin declarar 4** (RF-30/31/32/40).
- **Ausentes en el código** (sin una línea en `src/`): RF-03, 07, 14, 16, 17, 19, 20, 21, 22, 23, 25, 26, 32, 33, 34,
  36, 42. Las pesadas: versionado/editorial, equipos, colecciones, auditoría y degradación directa.
- **Parciales**: RF-09 (3 niveles → 2), RF-11 (hash del portal), RF-15 (sólo el flujo de solicitud), RF-18 (bandera
  apagada), RF-24 (`parseCsv` sin cablear), RF-41 (`requested_visibility` sin UI), RF-35 (soft-delete nativo).
- **Sin equivalente en CKAN** (§7): RF-14/16/17, RF-19/20, RF-23, RF-33/34, RF-36; `publication_requests` es custom.
- **Desajustes `PRD` ↔ `BACKLOG`**: RF-03 y RF-24 (el PRD los pone en `v1`, el BACKLOG en `v1+`); RF-33/34 (el PRD se
  contradice entre §3 y §7); **RF-18** (etiqueta `[v0]` con tier real `v1`); RF-15 (sin tag de tier).
- **16 de 42 sin registro en el `BACKLOG`** (RF-02, 04, 05, 09, 10, 17, 25, 26, 27, 28, 29, 32, 35, 36, 37, 38): la
  mayoría ya implementados o fuera del alcance del PRD. **Un requerimiento cumplido sin registro es deuda de registro**,
  no un logro: no se puede auditar lo que no está anotado. **Mapeados en `BACKLOG.md` (2026-10-09)**, sección
  «Requerimientos del PRD sin ítem propio», con su tier y su estado medido; dos de ellos (**RF-37/RF-38**, la API propia y
  su API Key) quedaron **a decisión del autor**: hoy la API la expone CKAN, no el portal.
  *(Corrección de conteo: este documento decía **15** y listaba **16**; el número correcto es **16**.)*

---

## Paso 3 · Re-tiering y enmiendas al `PRD` — EN CURSO (2026-10-09)

**El modelo de versiones se precisó (2026-10-09), y eso cambia la vara.** Las definiciones del autor: **`v0`** es la
**demo** que se presenta para decidir si el proyecto va («core plus»); **`v1`** es **la entrega del proyecto terminado**,
lista para la infra del cliente, **con documentación, manuales y defensa ante tribunal**; **`v1+`** son **detalles que NO
son requerimientos fuertes** (a veces ni están en el PRD) que entran en `v1`; **`v2`** son **requerimientos de este PRD
que no pudieron completarse para `v1`**, movidos **con su justificación escrito** para informar a los futuros
desarrolladores; **`v2+`** es lo mismo que `v2` más lo que no se tomó en `v2`. `PRD.md` §3 y la convención de
`BACKLOG.md` se reescribieron con esto (antes `v1+` decía «requerimientos diferidos de `v1`» y `v2` decía «mejoras **no
solicitadas**», que es lo contrario), y esa corrección **retieró la auditoría a `[v2]`** (era `[v1+]` tras la ronda
anterior) y **devolvió `RF-03` a `v1`**.

**Las cuatro sin tier declarado** eran `RF-30` (vista previa de PDF/imagen/TXT/JSON), `RF-31` (tabla de las primeras 20
filas del CSV), `RF-32` (exportar gráficos y datos) y `RF-40` (resumen corto para las cards). **Decisión del autor
(2026-10-09): las cuatro van a `v1+`** —son un plus: «no era lo que pedí, pero es mejor»—, y su aclaración de concepto
queda escrita porque corrige la mía: **no es que esos requerimientos «no estén en un tier», es que no se tomaron en
cuenta durante la planificación inicial**, que es otra cosa. **Bandera medida:** de las cuatro, **`RF-32` (exportar
gráficos y datos) NO existe** —depende del módulo de análisis (RF-24)—, así que su `v1+` significa «plus pendiente» y cae
con `RF-24` si ese se va a `v2`. Las otras tres están construidas y medidas.

**Los siete objetivos específicos de §2** están **mapeados abajo**, con la decisión del autor de que el mapeo lo haga yo
y lo revise él.
*(Nota de conteo, resuelta: el autor los llamó «los 8 requerimientos fuertes» porque **eran ocho y unió dos en uno**;
§2 tiene **siete**, y son siete.)*

**Hecho antes, en el mismo paso: las enmiendas de COHERENCIA** (la regla del autor: *no borrar especificaciones
incumplidas, sino especificar por qué no se cumplen*), que no requieren ninguna decisión de tier y dejan el PRD hablando
con un solo relato: **RF-03** (creación de usuarios: **`v1`**, hoy la hace CKAN), **RF-04 y §6** (no hay JWT: es el token
API de CKAN, y la exigencia de autenticarse se cumple igual), **RF-09** (de tres visibilidades existen dos; el `private`
del PRD —permiso explícito— es el que falta, y **el `private` de CKAN no es el `private` del PRD**), **RF-15** (de los
cinco pasos del flujo se construyeron el 4 y el 5; los pasos 1–3 son la máquina editorial, fuera de alcance), **RF-24**
(**`v1`**, con `v2` como destino justificado si no alcanza), **RF-33/RF-34 + §3** (la contradicción interna se resuelve a
**`v2`** con el motivo de §7) y la **nota de reconciliación** que encabeza §5.

### Pendiente del paso 3 (decisiones del autor)

1. **`RF-18` (colaboradores por dataset): requiere el análisis que el autor pidió.** El equivalente es
   `package_collaborator` de CKAN —**nativo desde 2.9** detrás de `ckan.auth.allow_dataset_collaborators`, hoy en
   **`false`**—, **no** los `group` (que son las colecciones, `RF-21`/`RF-22`). Encender la bandera es barato; lo que falta
   es la **UI en el portal** y el mapeo de permisos (`view`/`edit`/`admin` del PRD contra los `read`/`edit` que da CKAN).
   Con el modelo precisado es un **requerimiento de este documento que hoy no existe en el portal**: `v1` si entra, `v2`
   con su motivo si no.
2. **La metodología, para la documentación y la defensa** (ver abajo): hay que **declararla**, porque hoy está en la
   práctica y no en un documento.

**Ya resueltos** (no volver a preguntar): cómo se declara `v0` → **opción (b)**, la sección «Dentro del alcance (`v0`)»
que ya está en `PRD.md` §3; las cuatro sin tier → **`v1+`**; `RF-03` → **`v1`**; la auditoría → **`[v2]`**; `RF-37`/`RF-38`
→ **`v1+` con la explicación de abajo**; los siete objetivos → **mapeados abajo**.

### Los siete objetivos específicos, mapeados a una entrega (2026-10-09)

El autor pidió el mapeo y lo revisa él. Así queda:

| # | Objetivo (§2) | Tier | Estado medido |
|---|---|---|---|
| 1 | **Módulo de Organizaciones** (entidades, permisos, datasets) | `v1` | **Parcial**: la **lectura** está (lista y ficha de organización); la administración (CRUD, permisos, jerarquía) no existe en el portal y la jerarquía no es nativa de CKAN. **Fuerte: si no entra en `v1`, va a `v2` con su motivo** |
| 2 | **Carga de recursos** (PDF, CSV, imágenes, JSON, TXT y enlaces) | `v0` | **Hecho**: el wizard sube archivos y enlaces, valida y calcula el hash en el navegador |
| 3 | **Gestión de metadatos** (editor con esquema extensible, historial y aprobación) | `v1` | **Parcial**: el editor existe (crear y editar); el **historial de versiones y la aprobación por metadatos** no (RF-14/16/17 → `v2`) |
| 4 | **Análisis de datos** (CSV → visualizaciones) | `v1` con reserva | **Ausente**: `parseCsv` sin cablear. Decisión del autor: queda en `v1`, y si no alcanza su destino justificado es `v2` |
| 5 | **Catálogo con búsqueda facetada** | `v0` | **Hecho**: Solr por CKAN, facetas y filtros |
| 6 | **Previsualización y exportación** | `v0` (previsualizar) · `v1+` (exportar) | **Parcial**: la vista previa está; la **exportación** (PNG/JPEG/CSV) no existe y es `v1+` |
| 7 | **Grupos y colaboración** (colecciones y equipos) | `v1` | **Ausente**: los `group` de CKAN cubren las colecciones (RF-21/22); los **equipos** no tienen equivalente (RF-19/20) y los colaboradores por dataset están con la bandera en `false`. **Fuerte: `v2` con justificación si no entra en `v1`** |

**Lectura del mapeo:** dos de los siete ya están en la demo (**2** y **5**), tres dependen de `v1` con trabajo real (1, 3,
7) y dos son módulos que hoy no existen o existen a medias (4, y la mitad de 6). Los que **no** alcancen para `v1` son los
candidatos naturales a `v2` **con su motivo escrito**, que es lo que el modelo pide.

### `RF-37`/`RF-38`: qué significan, aclarado por el autor (2026-10-09)

Se referían al **apartado para consumir los datasets por API** que tienen los portales del estilo (`data.gov.sg`):
**ejemplos listos para copiar en Python, JS, cURL**. La precisión técnica, medida: en CKAN hay **dos** APIs y responden a
cosas distintas.

- La **API de acciones** (`/api/3/action/…`) responde **metadatos** (`package_show`) y **ya existe** —la usa el portal
  entero—; su **API Key** también es nativa de CKAN.
- El **DataStore** (`datastore_search`, `datastore_search_sql`) responde **las filas** de un recurso tabular, que es lo que
  hace posible el apartado de consumo con consultas. **El portal ya lo consume** para la tabla de 20 filas del CSV
  (`src/lib/api/datastore.ts`).

**Alcance real del DataStore:** sólo lo que esté cargado en él —los recursos tabulares que pasan por el datapusher (CSV, y
XLSX si está configurado) o lo que se empuje por API—; **no** aplica a PDF, imágenes ni JSON. O sea: el autor **no se
equivoca** al recordar que era «sólo para los datos de CSV», con el matiz del XLSX procesado.

**¿Es implementable? Sí, y es sobre todo UI**: detectar `datastore_active` en el recurso, mostrar el endpoint y **ejemplos
copiables por lenguaje** con filtros, campos y paginación. Como no estaba en la planificación y es un plus: **`v1+`**.
Queda registrado así, con esta explicación, y ya no es un ítem «a decidir».

### El modelo de tiers no viene del autor, y la metodología hay que declararla (2026-10-09)

**Medido en el historial:** el modelo `v0 / v1 / v1+ / v2 / v2+` **no estaba en el PRD original** —entró el
**2026-09-11** en el commit `304726d` («define version tiers and reconcile PRD with CKAN»), en una sesión que reconcilió el
PRD con CKAN—. El autor lo aclara: **su forma de ordenar era por `Sprints`**, con los ítems/HUs ordenados por importancia
—lo que llamaba *Backlog*—, y **la palabra «sprint» no aparece hoy en ningún documento del repo** (grep vacío sobre
`PRD.md`, `BACKLOG.md`, `odd/` y `openspec/`).

**Qué hay en la práctica**, y no está declarado en ningún lado, que es el problema para la entrega: **OpenSpec**
(`openspec/specs/` con cinco capacidades en GIVEN/WHEN/THEN y `openspec/changes/` para los cambios en curso) es
**desarrollo guiado por especificaciones**; las **compuertas de revisión** por unidad de trabajo, con su linaje y su
autoridad quemada, son **control de calidad por unidad**; la **regla del playground** de `AGENTS.md` es la **iteración de UI
revisada por el autor**; y **los tiers y el `BACKLOG` no son la metodología**: son la **agrupación por entrega** y el
registro de pendientes.

**Pendiente para `v1`:** declarar la metodología en la documentación (con su nombre y sus artefactos), que es lo que el
autor pide para presentar y defender el proyecto.

## Paso 4 · La carilla «qué es `v0` y qué no es» — DESBLOQUEADO (2026-10-09)

El insumo que faltaba ya está: **la declaración de `v0`** se resolvió con la opción **(b)** —la sección «Dentro del
alcance (`v0`)» de `PRD.md` §3, con el recorrido de la demo— y los siete objetivos están mapeados arriba. La carilla sale
de juntar: (1) esa sección nueva, (2) el censo del paso 1 —un solo defecto puro de `v0`, ya corregido; tres ítems
cerrados; cuatro decisiones del autor—, y (3) el mapeo de los objetivos. **No se escribió todavía.**

