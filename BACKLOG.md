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

## v0 — core presentable

- [ ] **[v0] Techos de subida de archivos (bloquea RF-12: 50 MB)** — los tres están rotos hoy y
  cualquiera de ellos impide el requisito de 50 MB:
  1. `odp-docker/frontend-proxy/nginx.conf` **no tiene `client_max_body_size`** → default 1 MB.
     Es el único punto de entrada público (`8080:80`) y su `location /api/` hace
     `proxy_pass http://ckan:5000`, **salteando** el nginx de CKAN que sí tiene
     `client_max_body_size 140M`. Subidas >1 MB devuelven **413** hoy.
  2. **adapter-node limita el body a 512 KB** vía `BODY_SIZE_LIMIT` (default de SvelteKit).
     Sólo aplica si la subida pasa por un `+server.ts` propio; requiere `BODY_SIZE_LIMIT=52M`
     en el servicio `frontend` del compose.
  3. **CKAN: `ckan.max_resource_size`, default 10 MB** (env `CKAN_MAX_UPLOAD_SIZE_MB`). No está
     seteado en `.env.example`. Para 50 MB: `CKAN_MAX_UPLOAD_SIZE_MB=50`.

  Verificar end-to-end con un archivo de 50 MB. _Origen: diagnóstico 2026-09-11._

- [ ] **[v0] Método multipart en el cliente CKAN** — `src/lib/api/client.ts` hardcodea
  `Content-Type: application/json` más `JSON.stringify`, así que **no puede subir archivos**.
  CKAN exige `multipart/form-data` con la clave `upload` en `resource_create` / `resource_patch`
  (el resto de las acciones sí aceptan JSON). Regla de implementación: pasar el `FormData`
  intacto y **nunca** setear `Content-Type` a mano (se pierde el boundary y CKAN rechaza el
  archivo). _Origen: docs de CKAN FileStore + diagnóstico 2026-09-11._

- [ ] **[v0] Wizard de dataset (crear/editar) + gestión de recursos** — formulario por
  secciones: título, descripción, organización, licencia, etiquetas, visibilidad; editor de
  metadatos (Dublin Core / DCAT-AP); carga de recursos drag & drop multi-formato, límite 50 MB.
  `package_create` / `package_update` + `resource_create`. _Referencias: design-system §9 item
  10, PRD RF-09 a RF-13._

- [ ] **[v0] Dashboard real del usuario** — hoy `/dashboard` es un placeholder que promete
  "gestionar los datasets de tu organización" y dice "próximamente": es **deuda visible en
  producción**. Debe listar "Mis datasets" y "Mis organizaciones" desde la API de CKAN, más los
  accesos rápidos. _Referencias: design-system §9 item 7._

- [ ] **[v0] Vista previa del recurso (CSV)** — conectar la semilla existente: el panel
  "Vista previa" con pestaña "Tabla" y placeholder "Próximamente" en
  `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`, más `src/lib/utils/csv.ts`
  (parseo + preview de 20 filas, ya testeado). Falta decidir la fuente de datos (datastore de
  CKAN vs. fetch del archivo). _Referencias: design-system §9 item 4, PRD RF-31._

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
  `ckan.auth.disable_cookie_auth_in_api = true`. **Al implementarlo, la subida de archivos debe
  pasar a proxy server-side** (en `v0` puede ir directo del browser a `/api/`).
  _Origen: research 2026-09-10 (ckanext-passwordless_api)._

- [ ] **[v1] Gestión de organizaciones en el portal** — CRUD de organizaciones
  (`organization_create` / `organization_update`) y de miembros
  (`organization_member_create`). _Referencias: PRD RF-06 a RF-08._

- [ ] **[v1] Auditoría de operaciones críticas** — RF-33/RF-34 piden retención de 5 años y
  registro de logins/logouts; la `activity` nativa de CKAN es insuficiente. Evaluar
  `ckanext-event-audit`. Depende del ciclo de vida resuelto.

## v1+ — diferido de v1 o conveniente sin ser requerimiento

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

---

## Historial de cierre (trazabilidad corta)

Ítems cerrados recientemente que solían aparecer como pendientes (para no re-buscarlos):

| Ítem | Cómo se cerró |
|---|---|
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

- [ ] **[v1] Revisión nativa `escalated` sin cerrar** — la línea de revisión de la sesión
  2026-09-10/11 cerró en estado `escalated` (hallazgos severos inconclusos), no `approved`. El
  trabajo se commiteó igual porque el usuario lo pidió explícitamente. Los hallazgos severos
  quedaron sin resolver y **no están listados acá**: la acción del maintainer quedó como
  informativa. Si el maintainer quiere cerrarlos, hay que reinstanciar la revisión sobre el
  rango de commits correspondiente. _Origen: sesión 2026-09-10 (RDD)._
