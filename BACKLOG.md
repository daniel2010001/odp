# BACKLOG — Pendientes y para-futuro de ODP

> Fuente **única y canónica** de pendientes del portal (Plataforma de Datos Abiertos UMSS).
> Cualquier cosa que quede "para después" en una sesión se anota acá antes de cerrar; no se
> deja solo en memoria de sesión. Al cerrar un ítem, **borralo del backlog** (git conserva el
> historial); al arrancar un cambio SDD, movelo a `openspec/changes/`.
>
> Convención de estado: `[ ]` abierto · `[~]` a medias · `[x]` hecho (se elimina al commitear).

## Frontend (repo `odp` — SvelteKit)

- [ ] **CI/CD inexistente** — no hay `.github/` en el repo. No corre lint/test/build en ningún
  lado. Definir si se agrega GitHub Actions (lint + typecheck + vitest) o si se deja deliberado.
  _Origen: audit 2026-08-24._

- [ ] **`getCkanClient()` muerto** — `src/lib/ckan.ts` define un singleton `getCkanClient()` que
  nadie llama; todo el código usa `createCkanClient()` directo. Decidir: borrar `ckan.ts` o
  migrar los callers. _Origen: audit 2026-08-24; verificado sin callers 2026-09-06._

- [~] **`ThemePlayground` leftover** — componente dev-only de cambio de colores, importado y
  montado en `src/routes/+layout.svelte:285` dentro de `{#if import.meta.env.DEV}`. Decidir si
  se conserva como herramienta de dev o se elimina. _Origen: audit 2026-08-24._

- [ ] **Verificar los 9 apuntes de comparación de cards** — feedback del usuario comparando
  DatasetCard vs DatasetCardMockup en `/dev/cards` (2026-09-03), pedido "NO implementar aún,
  solo recordar". Varios quedaron absorbidos por la DatasetCardV2 oficial (PR #39); falta
  revisar punto por punto cuáles siguen vivos (p. ej. hover del actual). Ver detalle en memoria
  engram #232. _Origen: 2026-09-03._

- [ ] **Housekeeping: borrar ramas remotas ya mergeadas** — `fix/facetfilter-mobile-collapsed`,
  `feat/dataset-detail-polish`, `fix/search-resultsbar-favicon`, `feat/search-card-title-hierarchy`,
  `feat/auth-04-ui`, `feat/auth-02-server`. _Verificado 2026-09-06._

- [ ] **Política de fallback a datos mock en producción** — cada página
  (`+page.svelte`, `search`, `dataset/[id]`, `resource/[resourceId]`, `organizations`) hace
  fallback silencioso a `getMock*` cuando CKAN falla, **sin distinguir dev de prod**. Si CKAN cae
  en producción, la app muestra datasets falsos y stats infladas como si fueran reales. Decidir:
  ¿mock solo con `import.meta.env.DEV` y error visible en prod, o estado explícito "CKAN no
  disponible"? _Origen: audit de consistencia 2026-09-06; el README lo presenta como solo-dev pero
  el código no discrimina._

## Documentación y trazabilidad

- [ ] **Spec de organizations nunca promovida a OpenSpec** — el cambio `organizations-catalog` se
  archivó en modo engram (sin filesystem), por lo que la feature implementada (listado/detalle de
  orgs) **no tiene spec en `openspec/specs/`** (hoy solo authentication, dataset-resource-listing,
  resource-detail-view). Contradice la convención de AGENTS.md (specs = contratos de features).
  Decidir: promover spec desde el archive engram o documentar por qué no aplica.
  _Origen: audit 2026-09-06._

- [ ] **Divergencia doc↔código en el home** — el design-system README (§9, página Home) describe
  una sección "¿Qué podés hacer?" con grid de 6 features (buscar, visualizar, analizar CSV,
  colaborar, publicar, API pública). El home real **ya no tiene esa sección** (quedó CTA + stats +
  organizaciones tras la reestructura de septiembre). Decidir si el doc quedó desactualizado o si
  la sección se perdió deliberadamente, y alinear. _Origen: audit 2026-09-06; ver PR #19 y
  design-system §9 item 1._

## Backend CKAN / `odp-docker` (repo hermano)

- [~] **`CKAN_INTERNAL_URL` en compose de producción** — `docker-compose.unified.yml` (prod) NO
  tiene la variable; el frontend prod no podría loguear contra CKAN. El compose dev
  (`docker-compose.dev.unified.yml`) sí la tiene pero **sin commitear** (working tree).
  _Origen: follow-up 1 del archive de authentication; estado verificado 2026-09-06._

- [ ] **`ckan.auth.create_user_via_api=false`** — recomendar/configurar en CKAN para que no haya
  auto-registro público por API (requisito PRD RF-03). Cambio del lado backend.
  _Origen: follow-up 2 del archive de authentication._

- [ ] **Token accumulation en login repetido** — cada login crea un `api_token` nuevo en CKAN y
  los viejos quedan vivos. Evaluar dedupe con `api_token_list` o revocar tokens previos al
  mintear. _Origen: follow-up 4 del archive de authentication (open question del design)._

- [ ] **Plugin `expire_api_token`** — considerar habilitarlo en CKAN para que los tokens expiren
  solos (fue non-goal de la propuesta original). _Origen: follow-up 5 del archive de
  authentication._

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
