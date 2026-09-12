# Apply Progress — Dataset Publishing (PR3)

## Resumen

PR3 (Fase 3 del wizard de publicación) implementado. Se absorben los 3 hallazgos de la
revisión de PR2 con TDD (RED→GREEN) y se entrega la página `/dashboard/datasets/new`
con su test de componente. La tarea 3.9 (CTA en `/dashboard`) queda **fuera de scope**:
se hace en PR4 junto con el dashboard real (decisión ya fijada en `design.md`).

## Estado de tareas (persistido en `tasks.md`)

Completadas y marcadas `[x]` en `openspec/changes/2026-09-11-dataset-publishing/tasks.md`:

- [x] 3.1 Wizard shell: guard de auth, loading, error-con-reintento, estado vacío
- [x] 3.2 Campos de metadatos con labels asociados (título, slug, descripción, organización, licencia, tags, visibilidad, landing page, maintainer, maintainer_email)
- [x] 3.3 Sugerencia de slug ligada al título, preservada al editar a mano
- [x] 3.4 Selector de archivos con validación de tamaño por archivo antes de enviar bytes
- [x] 3.5 Submit: `package_create` + subidas secuenciales con progreso y cancelación
- [x] 3.6 Fallo parcial: reporte por archivo, dataset conservado, reintento contra el dataset creado
- [x] 3.7 Navegación de éxito a `/dataset/[name]`
- [x] 3.8 Accesibilidad: labels, errores asociados, estado busy, sin scroll horizontal a 360 px
- [x] 3.10 Test de componente RED→GREEN (3 escenarios)

Quedan pendientes (sin marcar, fuera de PR3):

- [ ] 3.9 Replace the `src/routes/dashboard/+page.svelte` placeholder with a link to the wizard
- [ ] 4.1 `pnpm check` — 0 errors
- [ ] 4.2 `pnpm test` — full suite green
- [ ] 4.3 `pnpm lint` — no new findings
- [ ] 4.4 Against the dev stack: create a dataset from the wizard and upload a ~50 MB file; confirm the resource appears with the right size
- [ ] 4.5 Confirm no file bytes reach the SvelteKit server (upload path bypasses it; `BODY_SIZE_LIMIT` stays at its default)

## Archivos creados/modificados

| Archivo | Tipo | Descripción |
|---|---|---|
| `src/routes/dashboard/datasets/new/+page.svelte` | nuevo | Wizard completo (guard, orgs, formulario, archivos, submit, fallo parcial) |
| `src/routes/dashboard/datasets/new/wizard.test.ts` | nuevo | Test de componente (5 casos: guard, vacío, error+reintento, bloqueo, envío mínimo) |
| `src/lib/api/upload.ts` | modificado | `timeoutMs` (default 600000) + `ontimeout`; 200 no-JSON → código `nonjson` |
| `src/lib/api/upload.test.ts` | modificado | 5 tests nuevos (timeout default/explícito, ontimeout, nonjson-200) |
| `src/lib/utils/dataset-payload.ts` | modificado | `suggestSlug` limpia separador final tras el slice |
| `src/lib/utils/dataset-payload.test.ts` | modificado | 2 tests nuevos (límite exacto de 100 con `-` y `_`) |
| `openspec/changes/2026-09-11-dataset-publishing/tasks.md` | modificado | marcadas `[x]` 3.1–3.8 y 3.10 |

## Evidencia TDD (RED→GREEN)

### Hallazgos de PR2 (`upload.ts` + `dataset-payload.ts`)

RED (antes de implementar) — `pnpm test src/lib/utils/dataset-payload src/lib/api/upload`:

- 5 tests fallidos:
  1. `suggestSlug` dejaba `-` colgando al truncar en el límite de 100 (esperado `a*99`, recibido `a*99-`).
  2. `suggestSlug` dejaba `_` colgando (misma causa).
  3. `xhr.timeout` no se configuraba (0 en vez de 600000).
  4. `timeoutMs` explícito se ignoraba (0 en vez de 3000).
  5. `ontimeout` no existía → la subida colgada nunca rechazaba (test agotó timeout de vitest).
  6. 200 con cuerpo no-JSON se reportaba como `ckan` genérico en vez de `nonjson`.

GREEN (tras implementar): 38/38 tests verdes en ambos módulos.

### Componente del wizard (3.10)

RED: `./+page.svelte` no existía → el import del test fallaba (`Files prefixed with + are reserved`).

GREEN: 5/5 tests verdes tras crear el wizard. Los 3 escenarios exigidos por 3.10
(envío mínimo válido, bloqueo por campo faltante, estado sin organización escribible)
más el guard de redirección y el error-con-reintento.

## Gates (resultados exactos)

- `pnpm test` → **156 passed** (20 files). ✓
- `pnpm check` → **0 errors** (4 warnings preexistentes: ThemePlayground a11y, SearchBar `state_referenced_locally`, definición `node`). ✓
- `pnpm lint` → **0 errors** (4 warnings / 7 infos, todos preexistentes: `app.css` `noImportantStyles`, `search/+page.svelte`, `ThemePlayground`, `seed-ckan.mjs`). Sin hallazgos nuevos. ✓

## Desviaciones del diseño

- Ninguna material. Notas menores:
  - El test del componente se llama `wizard.test.ts` (no `+page.test.ts`) porque
    SvelteKit reserva el prefijo `+` dentro de `src/routes` y `pnpm check`/`sync`
    fallaba con `Files prefixed with + are reserved`. Sigue la convención existente
    de `src/routes/dashboard/dashboard.test.ts`.
  - `maintainer_email` se implementa además de `maintainer` (la tarea 3.2 solo
    menciona "maintainer", pero el spec y el PRD listan ambos campos nativos).

## Workload / límite de PR

PR3 entrega el wizard + absorción de 3 hallazgos. 3.9 y el dashboard real quedan para
PR4, tal como establece el "Suggested split" del `tasks.md`. Líneas nuevas (código +
tests) ≈ 600, por encima del presupuesto de 400 líneas revisables en una sola pasada;
la segmentación por PR ya está acordada en la cadena de 3 work units.

## Structured status consumido

`applyState: ready`, `isNonAuthoritative: false`, `actionContext.mode: repo-local` con
`allowedEditRoots: ["/home/danielblc/projects/odp"]`, sin warnings. Sin colisiones ni
dependencias bloqueantes. `nextRecommended` al terminar PR3 sigue siendo `sdd-apply`
hasta cerrar 3.9/4.x en PR4, momento en que pasa a `sdd-verify`.
