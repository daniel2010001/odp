# BACKLOG — Pendientes y para-futuro de ODP

> Fuente **única y canónica** de pendientes del portal (Plataforma de Datos Abiertos UMSS).
> Cualquier cosa que quede "para después" en una sesión se anota acá antes de cerrar; no se
> deja solo en memoria de sesión. Al cerrar un ítem, **borralo del backlog** (git conserva el
> historial); al arrancar un cambio SDD, movelo a `openspec/changes/`.
>
> Convención de estado: `[ ]` abierto · `[~]` a medias · `[x]` hecho (se elimina al commitear).

## Backend CKAN / `odp-docker` (repo hermano)

- [ ] **Token en cookie httpOnly + nginx (endurecimiento)** — hoy el JWT vive en `localStorage`
  (vulnerable a XSS). Patrón más seguro: guardar el API token en una cookie httpOnly/secure/
  samesite y que el reverse proxy la convierta en header `Authorization`
  (`proxy_set_header 'Authorization' $cookie_<nombre>`). Combinar con
  `ckan.auth.disable_cookie_auth_in_api = true`. Candidato para cuando se implemente el CRUD.
  _Origen: research 2026-09-10 (ckanext-passwordless_api)._

## Datos y contenido

- [ ] **Seed CKAN a escala** — poblar CKAN con ~1.500–2.000 datasets realistas para afinar la UI
  de search/facetas/paginado en condiciones cercanas a producción. Quedó en fase de
  planificación **sin decidir el camino**: (A) mock a escala arreglando el paginado del mock,
  (B) seed real vía `package_create` en paralelo, (C) insert directo + rebuild (descartado).
  Recomendación previa: B + A como colchón. _Origen: plan 2026-09-01._

## Gestión de contenido (CRUD) y vistas

> Área "de visión": **documentada** en PRD §3 (dentro de alcance v1) y en el inventario de
> páginas del design-system (sección 9, páginas privadas), pero **sin specs OpenSpec** y **sin
> implementar** en el frontend (hoy el frontend es solo lectura + login; el dashboard dice
> "La publicación de datasets estará disponible próximamente"). Nada de esto es urgente.

- [ ] **Decidir la estrategia de CRUD: UI custom vs UI nativo de CKAN** — CKAN ya trae su propio
  CRUD (crear/editar datasets, orgs, etc.). Hay que decidir si este frontend construye el CRUD
  como UI propia contra la API de CKAN (como sugiere el inventario del design-system) o si la
  gestión queda en el UI nativo de CKAN y este frontend sigue siendo solo lectura pública. Es la
  decisión que destraba todo lo demás de esta sección. _Referencias: PRD §3, design-system §9._

- [ ] **CRUD de datasets / recursos / organizaciones en el frontend** — páginas privadas del
  inventario del design-system que no existen como rutas hoy: formulario de dataset crear/editar
  (wizard, metadatos Dublin Core/DCAT-AP, carga drag & drop multi-formato límite 50 MB),
  gestión de recursos, gestión de organizaciones. _Referencias: design-system §9 items 10–11._

- [ ] **Dashboard del usuario real** — hoy `/dashboard` es un placeholder tras login. El
  inventario lo define como panel con "Mis datasets", "Mis organizaciones", solicitudes
  pendientes y accesos rápidos. _Referencias: design-system §9 item 7._

- [ ] **Vista previa del recurso (CSV)** — conectar la semilla existente: el panel "Vista previa"
  con pestaña "Tabla" y placeholder "Próximamente" en
  `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte` más `src/lib/utils/csv.ts`
  (parseo + preview 20 filas, ya testeado). Falta decidir fuente de datos (datastore de CKAN vs
  fetch del archivo) y renderizar la tabla real. _Referencias: design-system §9 item 4 ("área
  Vista previa"), PRD módulo Previsualización y Exportación._

- [ ] **Módulo de Análisis de CSV** — página 11 del inventario: cargar CSV, tabla normalizada,
  selector de columnas X/Y, gráficos (barras/líneas/pastel) con export PNG/CSV. Sin nada de
  código hoy. _Referencias: PRD §3 (módulo de análisis), design-system §9 item 11._

- [ ] **Gestión de colaboradores/equipos y colecciones** — paneles de permisos por rol; PRD
  también lista versionado/aprobación, soft-delete, auditoría como alcance v1. _Referencias:
  PRD §3, design-system §9 items 12–13._

## Para futuro (ideas, sin compromiso)

- [ ] **Roles / perfiles de usuario** — profundizar la gestión de roles más allá de
  `isSuperAdmin`. Se haría vía delta specs sobre `openspec/specs/authentication/spec.md`
  (agregar requerimientos), no reescribiendo la spec.
- [ ] **Mockup OpenPencil** — `design-system/datos-umss/pages/datos-umss.op` queda como referencia
  visual pasiva (no tocado).
- [ ] **Registro público de usuarios** — si algún día se quiere auto-registro, va en contra de
  PRD RF-03; decidir conscientemente antes de habilitarlo.
- [ ] **Features "fuera de alcance v1" del PRD (candidatas v2)** — registradas como decisión en
  PRD §3 pero sin seguimiento: SSO/LDAP, mapas interactivos (datos geoespaciales), motor IA para
  sugerencia de gráficos/preguntas, extracción automática de metadatos (OCR/lectura de cabeceras),
  edición masiva de metadatos, integración con repos externos (Drive/Dropbox), auto-registro.
  _Referencias: PRD §3 "Fuera del alcance (v1)"._

---

## Historial de cierre (trazabilidad corta)

Ítems cerrados recientemente que solían aparecer como pendientes (para no re-buscarlos):

| Ítem | Cómo se cerró |
|---|---|
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
| `ckan.auth.create_user_via_api=false` | **Aplicado** — agregado a `ckan-docker/.env` y `.env.example` (aplicado por el usuario + verificado). |
| Plugin `expire_api_token` | **Aplicado** — agregado a `CKAN__PLUGINS` + `expire_api_token.default_lifetime=86400` (1 día) en `.env`/`.env.example` (aplicado por el usuario + verificado). |
| Versionar `ckan-docker/` | **Resuelto** — trackeado dentro de `odp-docker` (decisión "inline"); `.env` queda ignorado, se versionan `.env.example`, Dockerfiles y `ckanext-umss`. |
