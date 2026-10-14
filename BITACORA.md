# BITÁCORA — cuándo se hizo qué

> **Qué es.** Un **índice** del trabajo del portal: un bloque por día, del más reciente al más antiguo,
> con la **unidad** que aterrizó (PR, o rango de commits), el conteo de commits del día y una o dos
> líneas de qué significó, con el puntero a la fuente donde vive el detalle.
> **Qué no es.** No reemplaza al `git log` ni a los expedientes: no transcribe asuntos de commit ni
> copia `odd/tasks/*.md`. Es la puerta de entrada, no la copia.
> La fecha es la del commit en hora local; la unidad se lista en el día en que se mergeó su PR, que
> puede no ser el día de sus commits (p. ej. PR #11–#14: commits el 2026-08-25, merge el 2026-08-26 UTC).

## «Los commits ya resuelven el registro» — respuesta verificada

**No lo resuelven.** Los commits dan la mitad mecánica (qué cambió y cuándo) y no dan la unidad ni el
sentido. Evidencia:

- Un commit con justificación rica: **`2916b80`** (2026-10-10), `fix(header): the session is probed once
  per load, and the header stops asserting it`. Su cuerpo declara el escenario medido («a CKAN `db clean`
  erases the `api_token` table and every open session dies silently»), la decisión (terminar la sesión
  localmente en vez de redirigir), el RED/GREEN (23 tests) y por qué la sonda no se duplica.
- Un commit que es sólo una línea de asunto: **`10d0160`** (2026-08-09), `chore(design): update
  datos-umss page mockup layout`. Sin cuerpo: no dice qué cambió del mockup, ni por qué, ni qué reemplazó.

Quien lee sólo `git log` **pierde** el **PR** que nombra la unidad, las **decisiones y su motivo** (viven
en `BACKLOG.md`), los **avisos y la deuda de revisión** (viven en el store de linajes, fuera del árbol de
trabajo) y el **expediente** que reúne el caso. Y el squash de PR sólo a veces deja el `(#NN)` en el
asunto: ni el número de PR se recupera del log de forma fiable.

**Corrección de una premisa:** el log de `main` no arranca el 2026-09-04 sino el **2026-06-17** (`02668ef`),
y son **679 commits en 40 días**; septiembre y octubre concentran 584.

## Días de trabajo (más reciente primero)

### 2026-10-10 — 6 commits · PR #62, #63
Qué significó: cerró la sonda de sesión a nivel de app (la cabecera deja de afirmar una sesión muerta) y el PRD anotó por qué las specs no se cumplen. Dónde: `odd/tasks/v0-portal-honesty.md`, `odd/tasks/backlog-prd-reconciliation.md`; `BACKLOG.md` §«Decisiones del autor (2026-10-09)».

### 2026-10-09 — 18 commits · PR #58, #59, #60, #61
Qué significó: el autor fijó qué se posterga y qué se prioriza, y quedaron dos casos abiertos (el aprobador decide a ciegas; `dataset_id` por id o por nombre). Dónde: `BACKLOG.md` §«Decisiones del autor (2026-10-09)».

### 2026-10-08 — 18 commits · PR #51, #52, #53, #54, #55, #56, #57
Qué significó: se cerró `B1` —el ciclo de publicación cableado al catálogo, con una sola affordance y sin publicación directa para nadie— y la sonda `A5` midió el muro. Dónde: `BACKLOG.md` §«Estado al cierre (2026-10-08, madrugada)».

### 2026-10-07 — 77 commits · PR #47–#50 (merges `610c437`, `24b27f5`, `46db651`, `5b6ae97`)
Qué significó: se replanificó y se construyó el corte mínimo de publicación (privado → público), más la presentación de errores y la regla de cuatro ojos. Dónde: `odd/tasks/publication-lifecycle-minimum.md`, `odd/tasks/publication-guard-design.md`.

### 2026-10-06 — 12 commits · rango `2de6c07..0f5a4d8`
Qué significó: se decidieron los dos ítems parqueados del barrido —los tags se divulgan con el `Tooltip` vendorizado; el *scroll snapping* **no** se adopta— y se escribió la regla de copy. Dónde: `odd/tasks/snapping-and-tags-demos.md`; `BACKLOG.md` §«Barrido de pulido de UI (sesión paralela, 2026-10-03)».

### 2026-10-05 — 36 commits · rango `0b4b3c3..5f63cb6`
Qué significó: la interfaz se revisó en vivo, se promovieron dos diseños (hero y card) y se retiraron sus hojas de revisión; una sola página de error en todas las superficies. Dónde: `BACKLOG.md` §«Estado al cierre (2026-10-05, noche)» y §«Aprobaciones del autor (2026-10-05, tarde)»; `odd/tasks/error-surfaces.md`.

### 2026-10-04 — 12 commits · merge `d334c3f` (barrido `feat/ui-polish-sweep`)
Qué significó: las 1987 líneas del barrido de pulido de UI entraron a `main` revisadas por unidad, y se escribió la convención para dos sesiones en el mismo clone. Dónde: `odd/tasks/merge-ui-polish-sweep.md`.

### 2026-10-03 — 41 commits · rango `67f6998..ff52b7c`
Qué significó: se cerró la edición de datasets de punta a punta (catorce compuertas) mientras corría en paralelo la sesión de pulido de UI. Dónde: `BACKLOG.md` §«Estado al cierre (2026-10-03, noche)»; `openspec/changes/2026-10-02-dataset-edit-and-delete/apply-progress.md`.

### 2026-10-02 — 20 commits · PR #45, #46
Qué significó: el módulo de edición y borrado de datasets quedó en curso (SDD, cinco rebanadas) y el vacío del buscador se entregó como una sección con saltos `#id`. Dónde: `BACKLOG.md` §«Estado al cierre (2026-10-02)»; `odd/tasks/search-empty-anchors.md`.

### 2026-10-01 — 24 commits · rango `d251d79..a14b427`
Qué significó: el vacío del buscador se llenó y se promovió con sus tres bloques en el orden pedido por el autor (`v0` ya se había mergeado el 09-30, PR #43). Dónde: `BACKLOG.md` §«Estado al cierre (2026-10-01)».

### 2026-09-30 — 13 commits · PR #43, #44
Qué significó: se hizo el censo del barrido `v0` (113 → 98 pendientes) y se corrigió el wizard para no leer como ocupado un nombre que no lo está. Dónde: `odd/tasks/v0-portal-honesty.md`; `BACKLOG.md` §«Historial de cierre».

### 2026-09-29 — 13 commits · rango `0108e93..8a9666c`
Qué significó: la línea CKAN entregó las tres filas que faltaban de S5 y el portal cerró la unidad de metadatos y la de filtros aplicados. Dónde: `BACKLOG.md` §«Estado al cierre (2026-09-29)».

### 2026-09-28 — 23 commits · rango `3f9de1e..602a86f`
Qué significó: se arregló el CI que nunca había corrido, se cerró el breadcrumb elegido (A7) y se archivó el expediente de CKAN 2.12. Dónde: `odd/tasks/ckan-2.12-upgrade.md`; `BACKLOG.md` §«Historial de cierre».

### 2026-09-25 — 8 commits · rango `370784d..b937372`
Qué significó: siguieron las unidades del bloque E —el breadcrumb como chip de contexto en móvil y el salto entre recursos de un dataset—. Dónde: `odd/tasks/block-e-layout-polish.md`.

### 2026-09-24 — 40 commits · rango `cdd69dd..fac7cd3`
Qué significó: el bloque E cerró E1, E2, E2b, E3, E6 y E7; se sumaron los recibos de D1–D3, el endurecimiento de tokens y la decisión de CKAN 2.12, con dos sesiones en el repo. Dónde: `BACKLOG.md` §«Estado al cierre (2026-09-24)»; `odd/tasks/block-e-layout-polish.md`.

### 2026-09-23 — 4 commits · rango `4033357..21c968f`
Qué significó: cerró el bloque D completo (D0 la sonda, D1–D3) y se arregló el `localhost` en los dos repositorios, con verificación en vivo. Dónde: `BACKLOG.md` §«Estado al cierre (2026-09-23)»; `odd/tasks/localhost-urls.md`, `odd/tasks/block-d-data-preview.md`.

### 2026-09-22 — 27 commits · rango `9d7be01..4f8ad19`
Qué significó: cerraron los bloques A (el verbo «publicar» → «crear»), B (la página de error propia) y C (un recurso según su tipo), cada uno con su recibo. Dónde: `odd/tasks/block-a-verb-create.md`, `block-b-error-page.md`, `block-c-resource-kind.md`.

### 2026-09-21 — 32 commits · rango `075e3dc..1f60930`
Qué significó: se recuperó el entorno de dev y «no hay sysadmin» resultó un error de medición; quedó escrito el plan de la sesión siguiente. Dónde: registros de `BACKLOG.md` de esa sesión (p. ej. `dfb27db`, `6380c0d`).

### 2026-09-20 — 21 commits · rango `069c011..110e723`
Qué significó: los slices B y C de `v0` —el catálogo deja de reportar ausencia donde hubo fallo y la sonda de sesión alcanza el 403—. Dónde: `odd/tasks/v0-portal-honesty.md`.

### 2026-09-19 — 7 commits · rango `33158ee..537b9c0`
Qué significó: el slice A de `v0` —paginación de «Mis datasets» y el módulo de contrato de la sesión muerta—. Dónde: `odd/tasks/v0-portal-honesty.md`.

### 2026-09-17 — 1 commit · `b28757c`
Qué significó: se dejó el plan de la próxima sesión para el ciclo de vida de publicación. Dónde: `openspec/changes/2026-09-13-publication-lifecycle/`.

### 2026-09-16 — 6 commits · rango `1fa9a5c..e6efc82`
Qué significó: se documentó el modelo de publicación invertido, se especificaron los niveles de visibilidad y se hizo obligatorio el flujo de solicitud. Dónde: `PRD.md`; `openspec/changes/2026-09-13-publication-lifecycle/`.

### 2026-09-14 — 12 commits · rango `4e0a993..129ea35`
Qué significó: el cambio de publicación se partió en 24 tareas y se registraron las mediciones P0–P10 de la sonda; la licencia quedó en una sola opción «sin licencia». Dónde: `openspec/changes/2026-09-13-publication-lifecycle/tasks.md`.

### 2026-09-13 — 20 commits · rango `5cc168e..a90e0ae`
Qué significó: el **Plan C** —el asistente promovido, bits-ui vendorizado y el arreglo real de la acumulación de tokens—. Dónde: `BACKLOG.md` §«Plan C — pulido de UI (cerrado 2026-09-13)».

### 2026-09-12 — 8 commits · rango `f0d30f3..b26dfcf`
Qué significó: se archivó el cambio `dataset-publishing` y se promovió el workspace revisado del dashboard. Dónde: `openspec/changes/archive/2026-09-11-dataset-publishing/`; `BACKLOG.md` §«Plan B — dashboard + publicación (cerrado 2026-09-12)».

### 2026-09-11 — 17 commits · rango `304726d..f327c98`
Qué significó: aterrizaron el asistente de publicación y el dashboard real; se definieron los tiers de versión, el copy pasó a español neutro formal y se agregó la vista previa CSV. Dónde: `BACKLOG.md` §«Historial de cierre».

### 2026-09-10 — 8 commits · rango `3255ec5..9de9eaa`
Qué significó: se agregó el CI, el fallback a mock quedó sólo en dev, se escribió la spec de organizaciones y el login empezó a revocar tokens previos. Dónde: `BACKLOG.md` §«Historial de cierre».

### 2026-09-06 — 4 commits · rango `bd82765..8b49eaa`
Qué significó: nacieron `BACKLOG.md` y `AGENTS.md` como documentos canónicos y se consolidó el design system. Dónde: `BACKLOG.md`, `AGENTS.md`, `design-system/datos-umss/README.md`.

### 2026-09-05 — 1 commit · `210f127`
Qué significó: se archivó el cambio de autenticación con sus specs base. Dónde: `openspec/changes/archive/2026-08-24-authentication/`.

### 2026-09-04 — 4 commits · PR #40, #41, #42
Sin narrativa registrada: el `BACKLOG.md` no existía todavía; el hilo está en los títulos de los PR (pulido del detalle de dataset y del buscador).

### 2026-09-03 — 49 commits · PR #16–#39
Sin narrativa registrada: es la iteración visual del home y el buscador un PR por paso; sólo sobrevive en los asuntos de commit y en `design-system/datos-umss/`.

### 2026-09-01 — 2 commits · PR #15
Qué significó: la ronda real contra CKAN verificó el login y destapó el bug de CSRF, arreglado en el PR #15. Dónde: `BACKLOG.md` §«Historial de cierre».

### 2026-08-25 — 16 commits · PR #2, #3, #5, #11, #12, #13, #14
Qué significó: la implementación de la UI de OpenPencil (home, buscador, detalle de dataset y de recurso) sobre las rutas de organizaciones y la base de autenticación. Dónde: `openspec/changes/archive/2026-08-24-authentication/`.

### 2026-08-24 — 36 commits · PR #1, #4
Qué significó: la fundación de organizaciones, las unidades 1–5 de autenticación y la infraestructura de Vitest y Docker. Dónde: `openspec/changes/archive/2026-08-24-authentication/`.

### 2026-08-09 — 4 commits · rango `3dc3fe0..10d0160`
Qué significó: se archivó el cambio `resource-detail-view` y se rehízo la card del catálogo con el título primero. Dónde: `openspec/changes/archive/2026-08-09-resource-detail-view/`.

### 2026-07-02 — 1 commit · `1af346f`
Sin narrativa registrada.

### 2026-07-01 — 25 commits · rango `b40f3c3..08a6bf5`
Qué significó: se armó el design system multi-página y se iteró el detalle de recurso; ese día nació la propuesta del cambio `resource-detail-view`. Dónde: `openspec/changes/archive/2026-08-09-resource-detail-view/proposal.md`.

### 2026-06-20 — 6 commits · rango `14851a4..6ad38a4`
Sin narrativa registrada: pre-`BACKLOG`; el asunto dice qué, no por qué.

### 2026-06-18 — 3 commits · rango `8bcbb56..b9212da`
Sin narrativa registrada.

### 2026-06-17 — 4 commits · rango `02668ef..e3f32c5`
Qué significó: el primer commit, la migración inicial a SvelteKit con UI de búsqueda e integración con CKAN. Dónde: historia de git (`02668ef`).

## Trazas que no viven en git

- **Pendientes y cierres narrativos:** `BACKLOG.md` — 9 bloques §«Estado al cierre (…)» (2026-09-23, 09-24, 09-27, 09-29, 10-01, 10-02, 10-03, 10-05, 10-08), §«Decisiones del autor (2026-10-09)» y §«Historial de cierre (trazabilidad corta)».
- **Expedientes de unidad:** `odd/tasks/*.md` — 17 archivos (bloques A–E, `v0`, publicación, CKAN 2.12, barridos, reconciliación PRD/BACKLOG).
- **Cambios SDD archivados:** `openspec/changes/archive/` — 3 (`resource-detail-view`, 2026-08-09; `authentication`, 2026-08-24; `dataset-publishing`, 2026-09-12), cada uno con su `archive-report.md`.
- **Cambios SDD en curso:** `openspec/changes/2026-09-13-publication-lifecycle/` y `openspec/changes/2026-10-02-dataset-edit-and-delete/`, con `apply-progress.md` fechado.
- **Linajes de revisión (RDD):** `.git/gentle-ai/review-transactions/` — `v2/review-<linaje>/review-state.json` (7 vivos), `terminal-consumption/` y `quarantine/`. **No están en git y no viajan con un clone**, y el acuse borra los hallazgos.
- **PRs:** GitHub (`gh pr list --state all`) es la única fuente del nombre humano de la unidad y de su fecha de merge.
