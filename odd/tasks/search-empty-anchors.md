# Search empty state — one section, with `#id` jumps

**Feature.** The author's request of 2026-10-01: the three exits of the empty search («Pruebe con»,
«Mientras tanto, lo más reciente», «Explorar por organización») should live **inside the same section
as the notice**, with **jump links** — «algo así como los "saltos" que tienen algunas páginas, creo que
es algo con el `#id` en la url» — like the home hero's.

**Status:** in progress · **Branch:** `feat/search-empty-anchors` · **Started:** 2026-10-01

**Origin.** `BACKLOG.md`, `## v0` — «El vacío del buscador: las tres salidas, dentro de la misma
sección que el aviso» (`c61d4c6`), recorded as **ambiguous** on purpose. Rule 9 of `AGENTS.md` was
applied: the author was asked before anything was touched.

**The author's answer (decided, not inferred):** *misma sección, con saltos `#id`* — one section whose
own header is the notice, with links that jump to each block. Not a single card with everything inside
(that was the other reading), and not a bare visual grouping.

## Measured basis (2026-10-01, read-only, current tree at `6f95775`)

| Fact | Evidence |
|---|---|
| The three exits already live in one branch of the empty state, but as **separate cards** | `src/routes/search/+page.svelte:743-812` (`{:else if total === 0 && !error}`) |
| The wrapper is a plain `<div class="space-y-8">` — visually separated, semantically anonymous | `+page.svelte:745` |
| The notice is a `<p class="font-heading text-xl">`, **not a heading** | `+page.svelte:750` |
| The notice's card is forced to `min-h-[24rem]` and centres its content (the height unit of `a4119e82b86ac72e`) | `+page.svelte:747` |
| «Limpiar búsqueda y filtros» is a `<button>` that resets state, **not a link** | `+page.svelte:756-763` |
| `scroll-behavior: smooth` is already global, with a `prefers-reduced-motion` override | `src/app.css:146`, `:180` |
| **`scroll-mt-*` does not exist anywhere in the repo** — a jump target needs it, or it lands under the sticky chrome | repo-wide grep: 0 matches |
| The header height is a token (`--header-h`: `5rem`, `4rem` shrunk) — the single source | `src/app.css:127`, `:143` |
| The **ResultsBar is always rendered** and sticky right under the header | `+page.svelte:471-515` (`top-[calc(var(--header-h)+1px)] z-20`) |
| ⇒ the anchor offset must clear **header + ResultsBar**, not just the header | the two measurements above |
| `syncUrl()` rebuilds the URL from state and **drops any hash** | `+page.svelte:64-86` |
| The three blocks are loaded **lazily** (only while the empty state is on screen), so a target may not exist yet | `$effect` at `+page.svelte:303`; `loadEmptyAssist()` |
| Each block is conditional: `suggestionChips`, `recentDatasets`, `topOrganizations` may be empty | `+page.svelte:767`, `:786`, `:798` |

## Design proposal (to be reviewed in `/dev/search-empty`, then promoted)

One `<section>` whose accessible name is the notice, the three blocks inside it, each with a stable
`id` and enough scroll margin. The open question the sheet has to settle is **where the jump row
lives**:

- **A — the jumps inside the notice card**, under the message and above/below «Limpiar búsqueda y
  filtros»: the links are the last thing the eye reads when it lands.
- **B — a jump bar of the section**, outside the notice card, right above the three blocks: it does not
  move the centred content of the `min-h-[24rem]` card, and it reads as a table of contents.

Fixed by the proposal, in both readings:

1. **Real anchors**, `<a href="#pruebe-con">`, not buttons: they are copyable and linkable, which is
   what the author asked for.
2. **Only the links whose block exists.** The three blocks load lazily and can come back empty; a link
   to a block that is not rendered is a dead link (the same rule as the disabled previous/next control
   of D5: no dead affordances).
3. **`scroll-mt` from the token**, so the target lands below the sticky header **and** the ResultsBar.
   The value is measured in the container, not guessed.
4. **The notice becomes a heading** (`<h2 id="…">`), so the section has a real accessible name; the
   blocks keep their `<h3>`. Heading order is preserved and no visible copy changes.
5. **The hash is not silently eaten.** `syncUrl()` drops it today; a filter change after a jump would
   leave the URL without the anchor while the page stays scrolled. Either preserve it or declare it.

## Tasks

1. `/dev/search-empty` sheet with readings **A** and **B**, presets (today / the three blocks / only
   one block, to exercise the partial anchors), a reproduction of the sticky ResultsBar, and a live
   instrument that reports, on `hashchange`, **how many px below the viewport top the target landed**.
2. Author's review in the container (`http://localhost:8082/dev/search-empty`).
3. Promote the chosen reading to `src/routes/search/+page.svelte`, with tests.
4. Verify: `pnpm test`, `pnpm check`, `pnpm lint`, plus a live measurement of the landing offset.
5. Native review gate on the promoted work unit; work-unit commit; delete the sheet.

## Open for the author (the sheet answers these, nothing else is asked first)

- Reading **A** or **B**.
- Whether the jump row should carry a visible label («Saltar a:») or just the links.

## Evidence log

- 2026-10-01: feature opened; measured basis re-verified against `6f95775`; branch created.
