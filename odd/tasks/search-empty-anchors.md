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

## Decisions (author, 2026-10-01 — read off the sheet, not inferred)

| Question | Decision |
|---|---|
| Reading | **A** — the jumps live inside the notice card, under the message and above «Limpiar búsqueda y filtros» |
| Treatment of the jump links | **V3 — secondary button** (`h-9 rounded-lg border border-border bg-card px-3 text-sm font-semibold`, hover `bg-accent`) |
| Destination highlight (`:target`) | **None** — the jump only scrolls; no background, no ring, no marked text |
| Visible label on the row | **None** — destinations only, no «Saltar a:» |
| Which blocks enter | **Parked** — the three exits stay as they are; the author will decide later |

Why V3 and not the text link: measured in the browser, the old link shared **both** `color`
(`oklch(0.52 0.085 257)`) and `text-decoration-line` (`none`) with the «Limpiar búsqueda y filtros»
button — the same visual object for two different actions. V3 separates them on colour, background,
border and height, and reads the destination as a control — which is what a jump to a section of the
same page is. The chip (V2) was rejected as the pick because its shape is the «Pruebe con» chip shape,
and those chips **navigate away** while the jumps **stay on the page**: same language, different behaviour.

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

## Open for the author

- Which of the three blocks enter the section: **parked on purpose** (the author's instruction was to settle the
  design first and decide that later). Nothing else is open from this round: reading, treatment, destination
  highlight and label were all decided on 2026-10-01 — see the Decisions table above.

## Evidence log

- 2026-10-01: feature opened; measured basis re-verified against `6f95775`; branch created.
- 2026-10-01: sheet built (`src/routes/dev/search-empty/{+page.ts,+page.svelte}`, 625 lines) by a delegated
  writer. Parent re-verified the tree: only those two files are new, nothing else touched.
- 2026-10-01: **the writer's lint gate crashed and the file was never formatted.** `pnpm exec biome`
  terminates abnormally (exit 254) as a direct child of the session shell — with `env`, with `-u` of a
  variable that does not exist, and with `env -i`, the same command exits 0, so the trigger is the
  invocation shape, not the environment. Fixed with the native binary:
  `node_modules/.pnpm/@biomejs+biome@2.5.0/node_modules/@biomejs/cli-linux-x64/biome check --write` → 1 file
  fixed, re-check exit 0. The pre-commit hook is **not** broken: run as git runs it (`sh .husky/pre-commit`)
  it exits 0, so no `--no-verify` is needed.
- 2026-10-01: sheet verified live in a browser **before** asking for a decision: hydration works with real pointer
  input, one link per rendered block (3 / 1 / 0 across the presets, and no empty row when there are no
  destinations), the sticky bar's real height measured at 68 px, and both jumps landing **14 px below** the chrome.
- 2026-10-01: **the author decided off the sheet** — reading **A**, treatment **V3** (secondary button), **no**
  `:target` destination highlight, **no** visible label. The chip shape (V2) was rejected as the pick because those
  chips **navigate away** while the jumps **stay on the page**: same language, different behaviour. Which blocks enter
  the section stays parked on purpose.
- 2026-10-01: promoted to `src/routes/search/+page.svelte` with tests, **test-first** — six tests captured failing
  before the implementation (`43940ae`). Live on the real page: bar **68 px**, computed `scroll-margin-top` **148 px**
  with the shrunk header (**164 px** at the top of the page, so the margin follows the token), and both jumps landing
  **13.6 px below** the sticky chrome. With results, the section, the row and the anchors are absent, and the console is
  clean.
- 2026-10-01: **three receipts, all approved, 0 blocking findings**: `review-4b0bfe7ead4517a1` (2 files / 233 lines,
  2 advisories → `57eeb74`), `review-5c51328ff49347d3` (1 file / 80 lines, 1 advisory → `6cf996e`), and
  `review-98fbf65d694a6a49` (1 file / 14 lines, 1 advisory **recorded and not chased**, with the reason in the
  `BACKLOG`). Gates: `pnpm test` **704/704**, `svelte-check` 0 errors / 4 warnings, Biome exit 0.
- 2026-10-01: the sheet was deleted after promotion (rule 8).
- 2026-10-01: **a fourth gate, on the whole branch range, found a CRITICAL the three unit gates could not.** The jump
  targets only exist after the lazy empty-assist calls resolve and their margin is 0 until the bar is measured, so a
  fresh load of a copied deep link (`…/search?q=x#organizaciones`) never landed: the browser resolved the fragment before
  the block existed and nothing re-applied it. Fixed in `775e350` under the authority's correction route (80-line plan,
  56 real): the fragment is re-applied once per value, only when the target exists and the margin is usable, reading
  `$page.url.hash`. Test-first, with the positive test failing before the effect existed. The provider's targeted
  validator approved the corrected candidate with **0 findings** (receipt `review-fda3530895a9b51f`).
- 2026-10-01: **why the unit gates and the live check missed it**: the defect lives in the composition (lazy load +
  measured margin + fragment on first load), not in any single unit — and the live verification measured the **click** on
  an already-painted page, never the **load** with a fragment. Probing the path that already works is not verification.
- 2026-10-01: **the deep-link measurement found a second defect, and it made the first fix honest.** The landing was fixed,
  but the fragment was being stripped from the address bar about 1.4 s after load: `syncUrl()` rebuilt the URL and called
  `replaceState` without the hash. Worse, the fix landed only because SvelteKit's `replaceState` never updates `page.url`,
  so `$page.url.hash` stayed stale at `#organizaciones` while the real location had lost it — the effect passed its gate on
  a value that no longer matched the address bar. Fixed in `8edced4`: `syncUrl()` now preserves the fragment (reading
  `$page.url.hash` with `untrack`, as `$page.state` already does), so the address bar and the app's URL model agree.
  Test-first with a real RED, and the assertion is on the **exact URL** — a `toContain` would have been satisfied by the
  stale hash, which is the accident being removed. Final live measurement: the fragment survives as a single value for
  15.8 s (`#organizaciones`) and 14.9 s (`#pruebe-con`), the landing stays at **+13.625 px**, changing the sort keeps the
  anchor, and with no fragment there is no scroll and no trailing `#`. Receipt `review-7135c0450f94bdce` (approved, 0
  blocking findings, 1 advisory **recorded and not chased**: the new test could assert a non-final URL, and its failure mode
  is a loud flake rather than a false green — one line of `waitFor` on the exact URL closes it).
