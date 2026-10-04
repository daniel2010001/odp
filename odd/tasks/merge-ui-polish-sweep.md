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
