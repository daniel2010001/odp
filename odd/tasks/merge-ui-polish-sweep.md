# Expediente ODD — merge de `feat/ui-polish-sweep` a `main` (2026-10-04)

> Unificar en `main` el trabajo que quedó en la rama del barrido de pulido de UI
> (worktree `~/projects/odp-ui-polish`), y cerrar el registro de «dos sesiones en este clone».

## Goal

Integrar los 14 commits de `feat/ui-polish-sweep` en `main` **sin conflicto**, verificar el
árbol resultante, correr la compuerta nativa por unidad (los commits de la rama nunca pasaron
por ella), y retirar la rama y su worktree.

## Decisiones del autor (2026-10-04)

1. **Ejecutar el merge ahora, con verificación** (`pnpm test`, `pnpm check`, `pnpm lint`).
2. **Quitar la rama y el worktree** después del merge.
3. **Una compuerta nativa por unidad (~3)**, acotada con `baseRef` explícito — no una sola
   compuerta del delta completo, y no dejar las 1987 líneas como deuda sin revisar.

## Preflight medido (antes de tocar nada)

| Qué | Valor |
|---|---|
| `main` | `291674b` — 1 commit por delante del merge-base, solo `BACKLOG.md` (+4/−2) |
| `feat/ui-polish-sweep` | `c7d0435` — 14 commits por delante del merge-base |
| Merge-base | `d2f53ce` |
| Dry run `git merge-tree --write-tree --name-only main feat/ui-polish-sweep` | **exit 0, cero paths en conflicto** |
| Única superposición desde el base | `BACKLOG.md`, en regiones distintas (por eso el merge sale limpio) |
| Contenido de la rama | 16 archivos, **+1987 / −58** |
| Árboles | los dos worktrees limpios, **cero no versionados** |
| Deduplicación del `BACKLOG` | **ya hecha por la rama** (`21d3c0b`, el merge que resolvió el archivo compartido) |
| Compuerta nativa sobre la rama | **nunca corrida** — los 14 commits entran sin linaje |

## Plan

1. Merge de `feat/ui-polish-sweep` en `main` desde el worktree principal.
2. Reconciliar el registro en `BACKLOG.md`: la nota «no es durable hasta el merge» pasa a ser
   falsa, y la sección «Primero: HAY DOS SESIONES EN ESTE CLONE» deja de ser cierta.
3. Verificación del árbol mergeado (delegada a `gentle-ai-verify`).
4. Compuerta nativa por unidad, acotada: (a) diagnósticos de Biome, (b) la hoja `/dev/error` y
   su instrumento, (c) la página de error promovida.
5. Retiro de la rama y del worktree.
6. Cierre: evidencia en este expediente y en `BACKLOG.md`.

## Desviación declarada

- **No hay rama de feature para este trabajo**: es un *merge* hacia la rama por defecto, y el
  autor lo autorizó así. Crear una rama para integrar una rama sería circular, así que el
  merge y los commits de registro van directo a `main`, como el resto de este repo.

## Evidencia

### Merge (2026-10-04)

- `main` antes: `291674b` · rama: `c7d0435`.
- Merge ejecutado con `git merge --no-ff feat/ui-polish-sweep` desde el worktree principal.
- **Resultado: limpio, sin conflictos.** `Auto-fusionando BACKLOG.md` — git resolvió solo el único archivo
  compartido, porque los hunks caían en regiones distintas. La deduplicación ya la había hecho la rama en
  `21d3c0b`.
- **Merge commit: `d334c3f`.** 16 archivos, **+1987 / −58**, 7 archivos nuevos (`contrast.ts` + test,
  `background.ts` + test, `measures.ts` + test, `odd/tasks/ui-polish-sweep.md`).
- `main` después: 44 commits sin pushear (`origin/main` = `42711a2`).
- **El dry run predijo el resultado**: `git merge-tree --write-tree --name-only` había dado exit 0 con cero
  paths en conflicto, y el merge real coincidió.

### Registro reconciliado en `BACKLOG.md`

Tres afirmaciones habían quedado con fecha de vencimiento y se corrigieron en el lugar donde un lector las
encuentra, sin borrar el registro histórico:

1. La nota «no es durable hasta el merge» de la sección del barrido → ahora declara que el merge la cumplió.
2. El encabezado «HAY DOS SESIONES EN ESTE CLONE» → corregido con la fecha y el commit; el cuerpo queda como
   registro y las tres reglas siguen vigentes.
3. El ítem «El merge de `feat/ui-polish-sweep`» de la lista del autor → cerrado, y el pendiente real que queda
   es **el push** (44 commits).

### Verificación del árbol mergeado (delegada a `gentle-ai-verify`)

Sobre el árbol exacto en `c3869ac`, sin mutaciones (`git status --porcelain` vacío antes y después):

| Compuerta | Resultado |
|---|---|
| `pnpm test` | **GREEN** — `Test Files 55 passed (55)` · `Tests 858 passed (858)` · 202 s |
| `pnpm check` | **GREEN** — `svelte-check found 0 errors and 4 warnings in 3 files` |
| `pnpm lint` (repo entero) | **NO VERIFICABLE** — 4/4 intentos (inicial + 3 reintentos) con `[warn] Linter process terminated abnormally`, exit 254 |
| `biome check` **acotado a los 14 archivos del merge** | **exit 0** — `Checked 14 files in 137ms. No fixes applied.` |

Los 4 warnings de `check` son **preexistentes** y ajenos al merge: `SearchBar.svelte:26` (`state_referenced_locally`),
`ThemePlayground.svelte:198` y `:258` (`a11y_label_has_associated_control`) y `tsconfig.json` (tipos de `node`).
El aborto 254 del lint de repo entero es el cuelgue transitorio ya medido en este repo; **acotado a los archivos
del merge, Biome sale 0**, así que la compuerta A queda respaldada por una medición más fina en vez de por una
excepción.

### Compuertas nativas: tres, por unidad, todas aprobadas y con autoridad quemada

| Unidad | Linaje | Archivos / líneas | Tier | Lentes | Presupuesto | Resultado |
|---|---|---|---|---|---|---|
| A — diagnósticos de Biome | `review-236918db1f135803` | 5 / 32 | medium (`configuration_change`: `biome.json`) | `review-reliability` | 16 | **approved**, quemada |
| B — hoja `/dev/error` + instrumento | `review-44dbd42660f4154f` | 9 / 1887 | medium (`executable_change`) | `review-reliability` | 200 | **approved**, quemada |
| C — página de error promovida | `review-7ad1e9b391960117` | 3 / 516 | medium (`executable_change`) | `review-reliability` | 200 | **approved**, quemada |

Cada una costó **una corrida de modelo** (`pi_host_relay`), precedida de su pronóstico. Los tres acuses
devolvieron `gentle-ai.review-acknowledged/v1` y `mutation_outcome: committed`.

**Cómo se acotó cada candidata** (la trampa evitada): el `inspect` ofrece por defecto
`--base-ref=42711a2a…` = `origin/main`, o sea **la rama acumulada entera** (33 a 41 paths, según la unidad);
seguir esa transición al pie de la letra habría revisado todo el trabajo de las dos líneas. Cada `START` fue con
**`baseRef` explícito al commit padre de la unidad** y `committedOnly: true`, y el proveedor devolvió exactamente
los paths de esa unidad (`actor_binding.candidate_paths`).

**Dónde corrieron y por qué**: el candidato de una compuerta es `baseRef..HEAD`, así que para gatear por unidad
hace falta que `HEAD` **sea** el commit de la unidad. Con `HEAD` ya en el merge eso no es expresable, así que el
worktree `~/projects/odp-ui-polish` —que se iba a retirar de todas formas— se usó como banco: `git checkout
--detach` sobre `81581c2`, `11842c3` y `417bd61`, una unidad por vez, con `workspaceRoot` en ese worktree. El
worktree principal nunca se movió de `main`.

**Desviación declarada:** la compuerta B revisa el **estado intermedio** de `ErrorPage.svelte` y de
`dev/error/+page.svelte`, porque la unidad C los reescribió después. Su núcleo —`contrast.ts` y el instrumento—
es estado final y eso es lo que se revisó; los dos archivos superseded son ruido acotado, y su versión final la
revisó la compuerta C.

### Hallazgos informativos (no bloqueantes, ninguno abre corrección)

| Hallazgo | Lente | Ubicación tal como se emitió | Severidad |
|---|---|---|---|
| `R3-001` | reliability | `src/routes/dev/error/+page.svelte:259` | WARNING |
| `R3-002` | reliability | `src/routes/dev/error/+page.svelte:277-302` | WARNING |
| `R3-003` | reliability | `src/routes/dev/error/+page.svelte:232-233` | SUGGESTION |
| `R3-001` | reliability | `src/lib/components/error/ErrorPage.svelte:118` | SUGGESTION |

**Lo que hay en esas líneas del árbol mergeado** (transcripto, para poder releerlas sin confiar en el número):

- `+page.svelte:232-233` — `requiredRatio(Number.parseFloat(computed.fontSize) || 16, computed.fontWeight || "400")`:
  los dos valores de respaldo del instrumento.
- `+page.svelte:259` — `const root = card?.firstElementChild instanceof HTMLElement ? card.firstElementChild : null;`:
  el respaldo que decide si hay algo que medir.
- `+page.svelte:277-302` — el `<div data-testid="error-sheet" bind:this={sheetRoot} class:dark={theme === "dark"}>`,
  su encabezado y la nota de «página sólo para desarrollo».
- `ErrorPage.svelte:118` — `<p class="text-xs font-semibold uppercase tracking-wider text-destructive">ERROR {status}</p>`:
  el eyebrow coral.

**Advertencia medida, y la lección de esta sesión:** el sobre de cierre trae id, lente, ubicación, severidad y
disposición, **pero nunca el texto del hallazgo**; y el `review-state.json`, que **sí** lo tiene mientras el
linaje vive, **lo borra el acuse**. En las tres compuertas acusé antes de leerlo, así que **el texto de estos
cuatro hallazgos no existe más** y lo que queda es la ubicación con su severidad. La receta ya estaba escrita en
`BACKLOG.md` para la línea CKAN («leer el `review-state.json` **entre el cierre y el acuse**») y no se aplicó:
**la próxima compuerta lee primero, acusa después.** Nada bloqueante se perdió —las cuatro son informativas y
ninguna abrió corrección—, pero la evidencia se degradó de «texto reclamado con su prueba» a «coordenada».

### Retiro de la rama y del worktree

- `git worktree remove /home/danielblc/projects/odp-ui-polish` — sin `--force`.
- `git branch -d feat/ui-polish-sweep` — borrado seguro, aceptado porque la rama estaba **contenida en `main`**
  (verificado con `git merge-base --is-ancestor`).
- Estado final: **un solo worktree** (`~/projects/odp`) y las ramas `main` y `wip/pr2-directo-publicacion`
  (la aparcada a propósito).
