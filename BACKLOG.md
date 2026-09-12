# BACKLOG — Pendientes y para-futuro de ODP

> Fuente **única y canónica** de pendientes del portal (Plataforma de Datos Abiertos UMSS).
> Cualquier cosa que quede "para después" en una sesión se anota acá antes de cerrar; no se
> deja solo en memoria de sesión. Al cerrar un ítem, **borralo del backlog** (git conserva el
> historial); al arrancar un cambio SDD, movelo a `openspec/changes/`.
>
> Convención de estado: `[ ]` abierto · `[~]` a medias · `[x]` hecho (se elimina al commitear).
>
> **Convención de tier:** `[v0]` core presentable · `[v1]` producto usable en producción ·
> `[v1+]` diferido de v1 o conveniente sin ser requerimiento · `[v2+]` mejora futura no
> solicitada. Definición completa de los tiers y su criterio de salida: `PRD.md` §3.
>
> **Arquitectura vigente:** CKAN como backend **headless** (sólo su API REST). El portal
> SvelteKit es dueño de toda la interfaz, incluida la administración. El UI web nativo de CKAN
> se acepta únicamente como muleta operativa durante `v0`. Ver `PRD.md` §3, §7 y §10.

## Plan B — dashboard + publicación (cerrado 2026-09-12)

> Ejecutado y cerrado. «Plan B» = las features pendientes del plan S-A…S-E, ahora completas:
> S-A ✅ · S-B ✅ · S-C PR1+PR2+PR3 ✅ · S-D ✅ · S-E ✅. El «Plan A» (alineamiento visual del
> portal) quedó cerrado antes.

- [x] **PR3 de `dataset-publishing`** — wizard en `/dashboard/datasets/new` + CTA del dashboard
  (commit `157d6d2`). Absorbidos los 3 hallazgos de PR2 (`R3-no-timeout`, `R3-nonjson-200`,
  `R3-slug-boundary`). Revisión RDD `approved` (lineage `review-c9dee8d0f9b7ef4a`, tier medium,
  lente reliability); 3 hallazgos advisory informativos.
- [x] **S-D · Dashboard real** — `/dashboard` lista "Mis datasets"
  (`current_package_list_with_resources`) y "Mis organizaciones" (`organization_list_for_user`),
  con estados independientes de carga/vacío/error (commit `1dfa399`). Revisión RDD `approved`
  (lineage `review-076d16ba6c6ee758`, tier medium, lente reliability); 2 hallazgos advisory.
- [x] **Recursos por enlace (RF-11/RF-13)** — el wizard ahora adjunta un recurso como URL externa
  (`resource_create` en JSON, sin bytes). Commit `f0d30f3`. La verificación destapó que el PRD exige
  enlaces y el proposal los había sub-escopeado. La primera revisión cerró en `escalated` (2
  hallazgos: allowlist de esquema `http`/`https` y test del camino de fallo) y el candidato corregido
  cerró `approved` (lineage `review-656da6beeca5d9e9`).
- [x] **Verificación Fase 4 + archivado** — verificación nativa `pass` (13/13 requisitos, 35/35
  escenarios, 37/37 tareas); E2E contra el stack dev con `package_create` + `resource_create`
  multipart de 50 MB exactos por el proxy. Cambio archivado en
  `openspec/changes/archive/2026-09-11-dataset-publishing/` (commit `1b7c33d`) y spec promovida a
  `openspec/specs/dataset-publishing/spec.md`.

## Próxima sesión (Plan C — pulido de UI)

> Acordado al cierre del 2026-09-12. «Plan C» = pulir la UI del track recién cerrado (dashboard +
> wizard). **Proceso acordado** (ver `AGENTS.md` regla 8): el agente propone un diseño concreto, el
> usuario lo revisa, y se itera hasta que quede — mismo patrón que el Plan A (playground
> `/dev/<page>` → iterar → promover → borrar).
>
> **Orden sugerido:** dashboard primero, wizard después. Nada de esto bloquea `v0`: es calidad
> percibida, no funcionalidad faltante.

## En curso (cambios SDD)

> Al arrancar un cambio SDD, el ítem se mueve desde este backlog a `openspec/changes/`.

Sin cambios activos. El último (`2026-09-11-dataset-publishing`: wizard de publicación + dashboard
real + recursos por enlace) quedó **archivado** el 2026-09-12 y su spec canónica vive en
`openspec/specs/dataset-publishing/spec.md`.

## v0 — core presentable

- [ ] **[v0] Dashboard (`/dashboard`) — pulir la UI** — hoy no conforma (feedback directo del
  usuario, 2026-09-12):
  1. la card/botón de **publicar dataset** no encaja (revisar jerarquía, texto y forma);
  2. la **lista de datasets** "se ve rara" (densidad, contenedores, separación);
  3. "Mis datasets" y "Mis organizaciones" **se parecen demasiado** → confusión al distinguirlas
     (dar identidad visual propia a cada sección: encabezado, icono, conteo, contenedor).
  _Referencias: design-system §9 item 7. Proceso de UI: `AGENTS.md` regla 8._

- [ ] **[v0] Wizard (`/dashboard/datasets/new`) — pulir la UI** — misma revisión iterativa que el
  dashboard. Puntos conocidos: claridad de "archivo **o** enlace" por recurso (RF-13: son
  excluyentes y va uno por recurso), estados de carga/error y densidad general del formulario.
  _Origen: feedback directo del usuario (2026-09-12)._

- [ ] **[v0] Wizard — completar y endurecer la validación** — el submit ya valida con
  `datasetCreateSchema` (Zod v4, ya en el stack) y muestra errores por campo, pero:
  1. el schema **no cubre** `url` (landing page), `maintainer` ni `maintainer_email`, y `tag_string`
     no valida formato: esos campos viajan sin validar hacia `package_create`;
  2. no hay validación en vivo (al escribir / al perder foco), ni resumen de errores, ni foco al
     primer campo inválido;
  3. `describeCreateError` usa `/already in use|url/i`, demasiado amplio (ver Deuda de revisión).
  Decisión: **mantener Zod** (ya es el estándar del repo) en vez de adoptar `sveltekit-superforms`,
  que asume form actions server-side y choca con el transporte browser-directo.
  _Referencia: PRD RF-09 a RF-13. Origen: feedback directo del usuario (2026-09-12)._

- [ ] **[v0] Endurecer la vista previa CSV (hallazgos de revisión)** — 4 hallazgos informativos
  no bloqueantes de la revisión de la vista previa (lineage `review-ca9abb1187a39513`, lente
  reliability). Sólo el primero es sustantivo:
  1. `R3-stale-search-race` (WARNING): `ResourcePreview.svelte` puede resolver un
     `datastore_search` viejo después de uno nuevo si el recurso cambia rápido (carrera de
     estados → filas de un recurso distinto).
  2. `R3-cellvalue-object-stringify`: `DataPreviewTable` hace `String(obj)` → `"[object Object]"`.
  3. `R3-limit-prop-unenforced`: prop `limit` aceptada pero sin uso.
  4. `R3-loading-state-untested`: estado de carga sin test.

- [ ] **[v0] Sección "Data API" para recursos CSV** — la sección "Acceso por API" de la página
  de recurso hoy está gateada a `resource_type === "api"` (oculta para archivos). Lo correcto,
  como data.gov.au y otros portales CKAN: mostrar una "Data API" con `datastore_search` para
  recursos tabulares (CSV) en el DataStore, en lugar de un `resource_show`. Diferido durante la
  revisión de la UI de recurso (2026-09-11). _Origen: observación del usuario + verificación.

- [ ] **[v0] Habilitar colaboradores por dataset** — `ckan.auth.allow_dataset_collaborators` no
  está en `.env.example`. La funcionalidad es nativa desde CKAN 2.9 pero está apagada, así que
  el modelo de permisos por dataset (RF-18) no funciona hoy. _Referencias: PRD RF-18, PRD §7._

## v1 — producto usable en producción

- [ ] **[v1] Estrategia del ciclo de vida de publicación** — decidir y documentar cómo se
  implementa `draft → review → approved → published` (RF-15). **CKAN no tiene API para esto.**
  Opciones evaluadas el 2026-09-11:
  - (A) Custom liviano en el portal: `package.extras.lifecycle_status` + `private` + endpoint
    server-side propio con las transiciones. Menor costo y control total.
  - (B) Extensión CKAN de terceros: `ckanext-workflow` / `ckanext-datasetapproval` /
    `ckanext-approvalworkflow`. Trae el flujo resuelto, pero ata el proyecto a extensiones de
    madurez dispar y hay que verificar compatibilidad con CKAN 2.10 y con `ckanext-umss`.
  - (C) Extensión propia (`ckanext-umss`) que agregue el ciclo de vida.

  Preferencia expresada por el usuario: extensión propia, con algo más liviano si conviene.
  **Bloquea RF-14 a RF-17, RF-23 y RF-33.**

- [ ] **[v1] Token en cookie httpOnly + nginx (endurecimiento)** — hoy el JWT vive en
  `localStorage` (vulnerable a XSS). Patrón más seguro: guardar el API token en una cookie
  httpOnly/secure/samesite y que el reverse proxy la convierta en header `Authorization`
  (`proxy_set_header 'Authorization' $cookie_<nombre>`). Combinar con
  `ckan.auth.disable_cookie_auth_in_api = true`.

  **Efecto obligado sobre las subidas:** al sacar el token del browser, el archivo ya no puede ir
  directo a `/api/`; pasa a un `+server.ts` propio y por lo tanto aparecen dos requisitos:
  1. `BODY_SIZE_LIMIT` en el servicio `frontend` del compose (default de adapter-node: **512 KB**).
     Trampa medida el 2026-09-11 sobre el build real: al excederlo el adapter **no devuelve 413**,
     devuelve **HTTP 400 con el mensaje de error de la propia app** (un `request.json()` que falla
     al leer el body), así que parece un error de validación y no un límite de tamaño. Con
     `BODY_SIZE_LIMIT=55M` el mismo body de 2 MB se leyó completo.
  2. Un método multipart en `src/lib/api/client.ts`, que hoy hardcodea `Content-Type:
     application/json` + `JSON.stringify` y por eso no puede subir archivos. CKAN exige
     `multipart/form-data` con la clave `upload` y pasar el `FormData` intacto, **sin** setear
     `Content-Type`.

  Mientras tanto el límite de adapter-node queda **deliberadamente sin subir**: en `v0` ningún
  route de Node recibe archivos, y ampliarlo sin consumidor agranda el body aceptado en todas las
  rutas del servidor. _Origen: research 2026-09-10 (ckanext-passwordless_api) + medición
  2026-09-11._

- [ ] **[v1] Gestión de organizaciones en el portal** — CRUD de organizaciones
  (`organization_create` / `organization_update`) y de miembros
  (`organization_member_create`). _Referencias: PRD RF-06 a RF-08._

- [ ] **[v1] Auditoría de operaciones críticas** — RF-33/RF-34 piden retención de 5 años y
  registro de logins/logouts; la `activity` nativa de CKAN es insuficiente. Evaluar
  `ckanext-event-audit`. Depende del ciclo de vida resuelto.

## v1+ — diferido de v1 o conveniente sin ser requerimiento

- [ ] **[v1+] Metadatos de interoperabilidad (DCAT/Dublin Core)** — agregar los campos que no
  tienen equivalente nativo en CKAN: idioma (`dct:language`) y periodicidad de actualización
  (`dct:accrualPeriodicity`). **Decisión 2026-09-11: se difiere a propósito y `v0` no escribe
  `extras`.** Motivo medido contra el código de `ckanext-dcat`: su vocabulario de `extras` **no es
  estable entre sus propios perfiles** — el perfil legacy `euro_dcat_ap` escribe `dcat_issued`,
  `dcat_modified`, `dcat_publisher_name`, `dcat_creator_name`, `guid` y `language` (sin prefijo,
  unido por comas), mientras que el perfil basado en `ckanext-scheming` guarda lo mismo como
  campos de primer nivel. Congelar nombres antes de elegir perfil obliga a migrar los extras de
  todos los datasets creados entre medio. Lo que `v0` necesita ya está cubierto: `issued` y
  `modified` caen a `metadata_created`/`metadata_modified`, el publisher cae a la organización
  dueña y el creator a `author`. **Antes de implementar esto hay que decidir el perfil DCAT.**
  _Origen: verificación contra la fuente de ckanext-dcat, 2026-09-11._

- [ ] **[v1+] Módulo de Análisis de CSV** — página 11 del inventario: cargar CSV, tabla
  normalizada, selector de columnas X/Y, gráficos (barras/líneas/pastel) con export PNG/CSV. Sin
  nada de código hoy. Es el **diferencial real del portal** frente al UI de CKAN.
  _Referencias: PRD §3 (módulo de análisis), PRD RF-24, design-system §9 item 11._

- [ ] **[v1+] Colecciones (grupos de datasets)** — mapea a `group` + `group_member`. El flujo de
  aprobación por cada organización propietaria (RF-23) es custom y depende del ciclo de vida.

- [ ] **[v1+] Gestión de usuarios y roles en el portal** — RF-03 pide que un `org_admin` cree
  usuarios de su organización. **Choca con el endurecimiento ya aplicado:** la autorización de
  `user_create` depende de `ckan.auth.create_user_via_api`, que hoy está en `false`. Además, en
  CKAN nativo un `org_admin` sólo puede *agregar usuarios existentes* a su organización, no
  crearlos. Decisión: en `v0`/`v1` los usuarios se gestionan en el UI de CKAN; llevarlo al
  portal exige reverir ese hardening o construir una capa de usuarios aparte.
  _Origen: análisis 2026-09-11._

- [ ] **[v1+] Versionado con estados de aprobación** — RF-14/RF-16. Sin API nativa.
  `ckanext-versions` declara compatibilidad sólo con CKAN 2.9; `ckanext-datasetversions` es una
  alternativa aparte. Depende de la estrategia del ciclo de vida.

- [ ] **[v1+] Gestión de colaboradores y equipos (UI)** — paneles de permisos por rol. Los
  colaboradores por dataset son nativos (ver `v0`); los equipos multi-organización son custom.
  _Referencias: PRD RF-19/RF-20, design-system §9 item 12._

## v2+ — mejoras futuras no solicitadas

- [ ] **[v2+] Roles / perfiles de usuario** — profundizar la gestión de roles más allá de
  `isSuperAdmin`. Se haría vía delta specs sobre `openspec/specs/authentication/spec.md`
  (agregar requerimientos), no reescribiendo la spec.
- [ ] **[v2+] Mockup OpenPencil** — `design-system/datos-umss/pages/datos-umss.op` queda como
  referencia visual pasiva (no tocado).
- [ ] **[v2+] Registro público de usuarios** — si algún día se quiere auto-registro, va en contra
  de PRD RF-03; decidir conscientemente antes de habilitarlo.
- [ ] **[v2+] Features "fuera de alcance v1" del PRD (candidatas v2)** — registradas como
  decisión en PRD §3 pero sin seguimiento: SSO/LDAP, mapas interactivos (datos geoespaciales),
  motor IA para sugerencia de gráficos/preguntas, extracción automática de metadatos
  (OCR/lectura de cabeceras), edición masiva de metadatos, integración con repositorios externos
  (Drive/Dropbox), auto-registro. _Referencias: PRD §3 "Fuera del alcance (v1)"._

## Datos y contenido (habilitador de QA, no es feature)

- [ ] **[v1+] Seed CKAN a escala** — poblar CKAN con ~1.500–2.000 datasets realistas para afinar
  la UI de search/facetas/paginado en condiciones cercanas a producción. Quedó en fase de
  planificación **sin decidir el camino**: (A) mock a escala arreglando el paginado del mock,
  (B) seed real vía `package_create` en paralelo, (C) insert directo + rebuild (descartado).
  Recomendación previa: B + A como colchón. _Origen: plan 2026-09-01._

  **Seed ligero de dev (no es el ítem a escala):** `scripts/seed-ckan.mjs` (2026-09-11) puebla
  el CKAN dev con 5 organizaciones + 16 datasets espejados de `src/lib/mock/data.ts`; idempotente
  por `name`, sin secretos en el repo (la contraseña admin se lee del entorno). Es contenido de
  desarrollo para que el portal no muestre listas vacías; el seed a escala de este ítem sigue
  pendiente.

- [ ] **[v1+] Datos de muestra para las vistas (contenido en el DataStore)** — la vista previa
  CSV lee de `datastore_search`, pero los recursos del seed son url-only (sin filas). Falta
  contenido durable en el DataStore para demoear las vistas. Decidir la fuente (CSVs chicos
  commiteados vs. generador determinista vs. upload real + datapusher) y hacerlo idempotente y
  determinista. _Origen: sesión 2026-09-11 (diferido); relacionado con "Endurecer la vista previa CSV"._

---

## Historial de cierre (trazabilidad corta)

Ítems cerrados recientemente que solían aparecer como pendientes (para no re-buscarlos):

| Ítem | Cómo se cerró |
|---|---|
| **Saneamiento del `href` de recursos (borde de salida)** | **Implementado** (2026-09-12). Política única de enlaces externos en `src/lib/utils/external-url.ts` (`safeExternalUrl` / `unsafeUrlReason`, allowlist `http:`/`https:` fail-closed) aplicada en los dos bordes de salida de la página de recurso (`resource.url` y el extra `docs_url`) y reusada por el wizard en la entrada. Primer test de componente de la página de recurso (`resource-page.test.ts`; el RED reprodujo el `href="javascript:..."` real) gracias a un stub de `$app/stores` en `vitest.config.ts`. Gates: check 0 errores, 169 tests, lint 0 errores, build 0. |
| **Recursos por enlace (RF-11/RF-13) + archivado del cambio `dataset-publishing`** | **Implementado, verificado y archivado** (2026-09-12). La verificación destapó que el PRD exige que un recurso sea archivo **o** enlace y el proposal lo había sub-escopeado. El wizard ahora adjunta enlaces externos (`resource_create` en JSON, sin bytes) y restringe el esquema a `http:`/`https:` para cerrar el vector de XSS almacenado vía `javascript:`. Commit `f0d30f3`. Verificación nativa `pass` (13/13 requisitos, 35/35 escenarios, 37/37 tareas) y cambio archivado (`1b7c33d`), con la spec promovida a `openspec/specs/dataset-publishing/spec.md`. |
| **Dashboard real del usuario (S-D)** | **Implementado** (2026-09-12, commit `1dfa399`). `/dashboard` dejó de ser el placeholder "próximamente": ahora lista "Mis datasets" (`current_package_list_with_resources`) y "Mis organizaciones" (`organization_list_for_user`), con estados independientes de carga/vacío/error y CTA "Publicar dataset" al wizard. Revisión RDD `approved` (lineage `review-076d16ba6c6ee758`, tier medium, lente reliability), authority quemada; 2 hallazgos advisory informativos anotados. Gates: check 0 errores, 159 tests, lint 0 errores. |
| **Wizard de publicación de datasets (PR3)** | **Implementado** (2026-09-12, commit `157d6d2`). Ruta `/dashboard/datasets/new`: guard de auth client-side, organizaciones escribibles vía `organization_list_for_user(permission="create_dataset")` con estados de error/vacío, formulario con sugerencia de slug, selector de archivos con validación previa de tamaño, `package_create` + subidas secuenciales con progreso y cancelación, fallo parcial con reintento y navegación al dataset creado. Absorbidos los 3 hallazgos advisory de PR2 (`R3-no-timeout`, `R3-nonjson-200`, `R3-slug-boundary`). Revisión RDD `approved` (lineage `review-c9dee8d0f9b7ef4a`, tier medium, lente reliability), authority quemada; 3 hallazgos advisory informativos anotados. Gates: check 0 errores, 156 tests, lint 0 errores. |
| **Vista previa del recurso (CSV)** | **Implementada** (2026-09-11). Fuente decidida: **DataStore de CKAN** (`datastore_search`), no fetch del archivo. Nuevos `src/lib/api/datastore.ts` y `src/lib/components/resource/{DataPreviewTable,ResourcePreview}.svelte` (+ tests); el placeholder "Próximamente" de `resource/[resourceId]/+page.svelte` se reemplazó por el componente. Revisión RDD **approved** (tier medium, lente reliability), authority quemada; 4 hallazgos informativos anotados como ítem v0 de seguimiento. Gates: check 0 errores, 145 tests, lint 0 errores. |
| **Copy de UI: voseo → español neutro formal** | **Normalizado** (2026-09-11). La convención estaba en voseo rioplatense (AGENTS.md regla 6 + design-system §10) y el producto tenía 18 strings en voseo en 10 archivos. Se actualizaron las dos convenciones a "trato de usted, sin voseo ni regionalismos" y se reescribieron todos los strings de UI: home (5), search (4), organizations (1), login (2), dashboard (2), detalle de dataset (1), detalle de recurso (3), y el error de rate-limit del login en `src/lib/server/auth-server.ts` (+ su test). Se corrigió además una referencia obsoleta en el inventario del design-system ("Empezá a explorar" → "Empiece a explorar") y un posesivo informal ("tus investigaciones" → "sus investigaciones"). Verificado: `grep` de marcadores de voseo sobre `src/` → 0 coincidencias. Nota: quedan instrucciones internas para desarrolladores en voseo (AGENTS.md regla 3, design-system §12); no son copy de plataforma y quedaron fuera de alcance. |
| **Techos de subida de archivos (RF-12, 50 MB)** | **Resuelto y verificado end-to-end** (2026-09-11). Estado real medido: (1) `frontend-proxy/nginx.conf` y `frontend-proxy/dev-nginx.conf` no tenían `client_max_body_size` → default 1 MB → **413** medido con 2 MB y con 50 MB por el proxy, y 200 con 2 MB directo a CKAN. Se agregó `client_max_body_size 55M` **acotado a `location /api/`** en ambos. (2) CKAN **ya permitía 100 MB** (`CKAN_MAX_UPLOAD_SIZE_MB=100` en `ckan-docker/.env.example:50`) — la afirmación previa de que estaba en el default de 10 MB era **incorrecta**. (3) `BODY_SIZE_LIMIT` de adapter-node (default 512 KB) se midió sobre el build de producción: existe y se dispara, pero **no está en el camino de v0**, así que se dejó sin subir a propósito. Verificación final: archivo de 50 MB (52 428 800 bytes) subido por el proxy, HTTP 200 en ~450-750 ms, `size` reportado por CKAN correcto y **sha256 del archivo descargado igual al local**; 2 MB a `/` sigue devolviendo 413 (alcance acotado correcto). |
| **Estrategia de CRUD: UI propia vs. UI nativo** | **Decidida** (2026-09-11) — CKAN headless; el portal es dueño de toda la UI, incluida la administración. El UI de CKAN se acepta sólo como muleta operativa en `v0`. PRD §3 y §7 reconciliados con el esquema real de CKAN. |
| **Definición de tiers de versión (v0/v1/v1+/v2+)** | **Escrita** — `PRD.md` §3 (tabla de tiers con criterio de salida por tier) y etiquetado por tier de cada ítem de este backlog. |
| PRs de authentication #5–#10 "OPEN" | En realidad **todos mergeados** a `main` (el archive-report los listó OPEN al momento de archivar; entraron después). Código verificado en `main` 2026-09-06. |
| Live CKAN round-trip (follow-up 3 de auth) | **Cerrado** — login real verificado contra CKAN dev (200 + JWT, 401 con credenciales inválidas) el 2026-09-01; destapó y arregló el bug CSRF (PR #15). |
| Ruta `/about` | Existe (`src/routes/about/+page.svelte`). |
| `bun.lock` stale | Eliminado; se usa pnpm. |
| Placeholder "Recursos indexados" | Eliminado. |
| Tests sin runner | Vitest + testing-library configurados; 13 archivos de test. |
| PRD desactualizado (decía React/backend-custom) | **Corregido** — PRD §10 ya refleja SvelteKit + CKAN (7 menciones de CKAN); verificado 2026-09-06. |
| README raíz genérico "sv" | **Corregido** — README.md ya documenta stack real, setup, estructura y mock data. |
| `getCkanClient()` muerto | **Eliminado** — `src/lib/ckan.ts` borrado (sin callers). |
| CI/CD inexistente | **Agregado** — `.github/workflows/ci.yml` (lint + typecheck + vitest). |
| `ThemePlayground` leftover | **Conservado** — tool dev-only gated por `import.meta.env.DEV`; decisión de mantenerlo. |
| 9 apuntes de comparación de cards | **Obsoleto** — memoria engram #232 perdida y `/dev/cards` eliminado; absorbido por DatasetCardV2 (PR #39). |
| Política de fallback a mock en producción | **Corregido** — mock solo con `import.meta.env.DEV`; en prod error explícito en las 6 páginas. Además: stats del home (orgs/formats) ahora reales y "Recursos" ya no se inventa en prod. |
| Spec de organizations | **Escrita** — `openspec/specs/organizations/spec.md` desde el código implementado. |
| Divergencia doc↔código en el home | **Corregido** — design-system README §9 actualizado al home real (CTA + stats + organizaciones). |
| `CKAN_INTERNAL_URL` en compose prod | **Corregido** — `docker-compose.unified.yml` inyecta `CKAN_INTERNAL_URL: http://ckan:5000` en el servicio frontend. |
| Housekeeping: ramas remotas mergeadas | **Borradas** — 14 ramas eliminadas de `origin` (11 mergeadas por ancestría + 3 superseded). Quedan solo `main` y `HEAD`. |
| Token accumulation en login repetido | **Resuelto (código)** — `ckanLogin` ahora lista (`api_token_list`) y revoca (`api_token_revoke`) los tokens previos del portal antes de mintear el nuevo (best-effort); +3 tests. |
| `ckan.auth.create_user_via_api=false` | **Aplicado** — agregado a `ckan-docker/.env` y `.env.example` (aplicado por el usuario + verificado). Nota: esto bloquea la creación de usuarios por API (ver ítem `v1+` de usuarios). |
| Plugin `expire_api_token` | **Aplicado** — agregado a `CKAN__PLUGINS` + `expire_api_token.default_lifetime=86400` (1 día) en `.env`/`.env.example` (aplicado por el usuario + verificado). |
| Versionar `ckan-docker/` | **Resuelto** — trackeado dentro de `odp-docker` (decisión "inline"); `.env` queda ignorado, se versionan `.env.example`, Dockerfiles y `ckanext-umss`. |

## Deuda de revisión (RDD)

- [ ] **[v0] Hallazgos advisory de las revisiones del track dashboard + publicación** —
  informativos, no bloqueantes, sin corrección abierta. Verlos como trabajo posterior, nunca como
  motivo para re-correr la revisión sobre esos candidatos:
  - `review-c9dee8d0f9b7ef4a` (PR3 wizard): `R3-001`, `R3-002`, `R3-003`.
  - `review-076d16ba6c6ee758` (PR4 dashboard): `R3-reactive-auth`, `R3-untested-dataset-failure`.
  - `review-656da6beeca5d9e9` (PR5 enlaces): `R3-link-remove-during-submit` (`+page.svelte:789`),
    `R3-link-validation-coverage` (`+page.svelte:218`).

- [ ] **[v0] `describeCreateError` sobre-dispara** — el regex `/already in use|url/i` del wizard
  etiqueta como conflicto de slug cualquier error cuyo mensaje contenga "url". Acotarlo al mensaje
  real de CKAN. _Origen: verificación de `dataset-publishing`._

- [ ] **[v1] Verificación estática pendiente del wizard** — "sin scroll horizontal a 360 px" quedó
  verificado solo por inspección de código, sin test automatizado.

- [ ] **[v1] Revisión nativa `escalated` sin cerrar** — la línea de revisión de la sesión
  2026-09-10/11 cerró en estado `escalated` (hallazgos severos inconclusos), no `approved`. El
  trabajo se commiteó igual porque el usuario lo pidió explícitamente. Los hallazgos severos
  quedaron sin resolver y **no están listados acá**: la acción del maintainer quedó como
  informativa. Si el maintainer quiere cerrarlos, hay que reinstanciar la revisión sobre el
  rango de commits correspondiente. _Origen: sesión 2026-09-10 (RDD)._
