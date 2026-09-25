# Block E — v0 layout and card polish

**Feature.** Six (plus one) small defects reported by the author across the v0 surfaces: a header that
eats vertical space on 720p, a dataset metadata card that does not match its resource counterpart, a
blank organization block in the wizard summary, an orphan-wrapped description on the dashboard,
duplicated format chips in the search cards, a breadcrumb with no mobile treatment, and a link view
that is mostly empty box.

**Status:** in progress · **Branch:** `feat/v0-portal-honesty` · **Started:** 2026-09-24 · **E1, E2, the E2 fix and E2b closed 2026-09-24**

**Why this document exists.** Every item below was measured on a different day (2026-09-13 to
2026-09-22) and the code has changed since (blocks A–D and the `localhost` work all touched these
surfaces). This file is the re-verification against the current tree plus the slicing that keeps each
review bounded. `BACKLOG.md` keeps only the pointer.

## Measured basis (re-verified 2026-09-24, read-only, current tree)

### E-item 1 — the site header is too tall at 720p

| Fact | Evidence |
|---|---|
| Header is a fixed `h-20` (80 px) at **every** width | `src/routes/+layout.svelte:39-40` |
| `HEADER_PX = 80` exists **only** in the dashboard | `src/routes/dashboard/+page.svelte:231-233` |
| …and feeds **only** the IntersectionObserver math | `+page.svelte:246`, `:248` |
| The sticky bar's real placement is an independent literal | `+page.svelte:346` (`top-20`) |
| …and so are the other derived offsets | `search/+page.svelte:293` (`sticky top-[81px]`), `search/+page.svelte:389` (`lg:top-40 lg:max-h-[calc(100vh-11rem)]`), `dataset/[id]/+page.svelte:558` (`lg:sticky lg:top-24`), `dashboard/datasets/new/+page.svelte:1540` (`lg:sticky lg:top-24`) |
| `scroll-mt-*` exists nowhere in the repo | repository-wide grep: zero matches |
| No test measures the header height | `layout-header.test.ts` covers only header **links** (2 tests); `dashboard.test.ts:234` asserts the bar's `opacity-0`, not its offset |

**This item is the root cause of two other backlog entries**, both `[v1]`: `BACKLOG.md:2069-2075`
(«si el layout del encabezado cambia de alto (`h-20`), `STICKY_TOP_PX` queda desincronizado y **nada lo
detecta**» — and it already names the fix: *move the offset to a CSS variable shared with the layout so
it cannot drift*) and `BACKLOG.md:1386-1391` (scroll snapping needs `scroll-mt-*` because the header
measures `h-20`). Fixing E2 as a single source closes all three.

### E-item 2 — the dataset metadata card

**The recorded text is wrong, and this is the first thing to correct: there are two cards.**

| Card | File:line | Padding | Structure |
|---|---|---|---|
| Dataset «Detalles» (main column) | `dataset/[id]/+page.svelte:527-554` | `p-6 sm:p-8` | eyebrow + `<h2>` + Campo/Valor table (`generalMetaRows`, `:248-256`) |
| Dataset «Metadatos» (sidebar) | `dataset/[id]/+page.svelte:608-624` | **`p-5`** | eyebrow + icon rows (`metadataItems`, `:182-199`), **no table** |
| Dataset «Organización» (sidebar) | `dataset/[id]/+page.svelte:629-655` | `p-5` | not in scope |
| Resource metadata (the reference) | `resource/[resourceId]/+page.svelte:619-692` | `p-6 sm:p-8` | eyebrow + `<h2>` + table (`fieldList`, `:228-256`) + footer strip |

The label class string is **already identical** in both pages (`text-xs font-medium uppercase
tracking-wider text-destructive`). So «Detalles» **already matches** the resource card; the gap the
author saw is the **sidebar** card. Which card is meant is a decision, not a measurement — see
«Decisions pending» below. No test asserts anything about either card.

### E-item 3 — the wizard summary shows a blank organization

`orgDisplayTitle = singleOrg ? singleOrg.title : (organizations.find((o) => o.name === ownerOrg)?.title ?? "")`
(`dashboard/datasets/new/+page.svelte:645-647`), consumed at `:1579` inside the «Ficha» card (`:1541`).

Verified rendering per state:

| State | Renders |
|---|---|
| No organization available | The «Necesita rol de editor…» block (`:736-748`); the form and the ficha are **not rendered** → not reachable |
| Exactly one available | Auto-selected (`:328-330`), title shows, field read-only (`:905-924`) |
| **Several available, none selected** | `orgDisplayTitle` is `""` → **blank block. This is the bug.** |
| One selected | Title shows |

`wizard.test.ts:129` mocks a **single** organization, so the reachable state has no coverage; the only
auto-select test is `:209`.

### E-item 4 — the dashboard organizations description wraps on one word

Both descriptions are inline `<p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">`:
organizations at `dashboard/+page.svelte:557-558`, «Mis datasets» at `:392-393`. Neither carries
`text-pretty`/`text-balance`, and those utilities appear **nowhere** in `src/`. No test asserts either
string.

### E-item 5 — duplicated format chips in the search cards

| Derivation | Line | Current code |
|---|---|---|
| `resourceFormats` | `search/DatasetCard.svelte:16-21` | `map(format → toUpperCase)` → `filter(Boolean)` → `slice(0, 4)` — **no dedupe** |
| `moreFormats` | `search/DatasetCard.svelte:23-25` | `dataset.resources.length - resourceFormats.length` |

Two defects, not one:

1. `[CSV, CSV, PDF]` renders **two** «CSV» chips.
2. `moreFormats` counts *resources*, so a naive chip-only dedupe would report `+1 más` for that same
   dataset — a hidden format that does not exist. The recount must be `uniqueFormats.length −
   resourceFormats.length` (clamped at 0), measured **before** the `slice(0, 4)` cap.
3. `filter(Boolean)` keeps a whitespace-only `format` (`" "` is truthy), so a blank chip is possible.

`DatasetCard.svelte` is the **only** surface that aggregates formats from `dataset.resources`
(repository-wide grep for `resourceFormats|moreFormats|slice(0, 4)`: complete). The dataset page renders
one `ResourceKindChip` **per** resource (no aggregation); the dashboard renders a resource *count*. So
the bug reaches users only through the two consumers of this component: `search/+page.svelte:542` and
`organization/[id]/+page.svelte:216`. There is **no** `DatasetCard.test.ts` and no test on either page.
Overlap to respect: `BACKLOG.md:1544-1566` (`[v1+]`) plans to change the **colors** of this same chip
map — different concern, same lines; do not fold them together.

### E-item 6 — the breadcrumb has no mobile treatment

`ui/breadcrumb/Breadcrumb.svelte:18-19` renders `<nav aria-label="Breadcrumb">` with
`<ol class="flex flex-wrap items-center gap-1 text-sm">`: no responsive class, no `truncate`, no
collapse (45 lines, matches the record). Single consumer: `resource/[resourceId]/+page.svelte:364`,
whose `breadcrumbItems` (`:165-177`) are four crumbs — Datasets → organization title → dataset title →
resource name — with the two long ones in the middle. Truncation exists only at the **wrapper** level
(`max-w-7xl`), never inside the component.

**Second inconsistency found while verifying:** the dataset page does **not** use this component at all;
it has its own inline `<nav aria-label="Breadcrumb">` with an `ArrowLeft` + «Catálogo» link
(`dataset/[id]/+page.svelte:308-328`). Two breadcrumbs, two behaviours. Whether to unify is a decision.

The component is vendored in the project's own style (inference: single hand-written file exposing a
custom `{ items }` API, no `index.ts`, no upstream `breadcrumb-*` parts; no provenance comment found).

### E-item 7 — the link view is mostly empty box

`resource/[resourceId]/+page.svelte` (around `:553`): `min-h-[220px]`, `p-10`, a `size-16` circle and a
`size-8` icon for one sentence. The record already states the direction («una nota compacta, sin ícono y
sin caja alta, diría lo mismo sin el hueco») and this entry's own note places it in the block E family.

## Slicing

Each slice = its own commits (one per work unit) + its own native review with an explicit `baseRef` +
its own entry in `BACKLOG.md`.

| Slice | Closes | Surface | Size | Author decision? | Playground? |
|---|---|---|---|---|---|
| **E1** | Item 5 (all three defects) | `DatasetCard.svelte` + new test | small | no | no — verifiable on the real `/search` |
| **E2** | Item 1 + the two `[v1]` entries it causes | 5 files, small diffs | medium | **yes** — the low-height threshold | **yes** — `/dev/header` with a viewport-height selector |
| **E3** | Items 3 and 4 | 2 files + test | small | copy of one string | no — verifiable on the real page |
| **E4** | Item 2 | `dataset/[id]/+page.svelte` | medium | **yes** — which card, and what detail it keeps | **yes** — before/after |
| **E5** | Item 6 | `Breadcrumb.svelte` + consumer | small | **yes** — collapse / truncate / back | **yes** — `/dev/breadcrumb` at 375px |
| **E6** | Item 7 | `resource/[resourceId]/+page.svelte` | small | direction already recorded | **yes** |

Recommended order: **E1** (no decisions, a real visible bug), then **E2** (largest leverage: one change
closes three backlog entries), then E3, E4, E5, E6.

## Decisions pending (the author's, not the agent's)

1. **E2 — the header at low viewport height.** The proposed mechanism is a single `--header-h` custom
   property in `src/app.css` consumed by the header and every derived offset, with a height-based media
   query lowering it for short viewports, and the dashboard observer reading the header element instead
   of a `HEADER_PX` constant (this is the fix `BACKLOG.md:2069-2075` already named). What needs the
   author's eye is the **threshold** and the **height**: which `max-height` breakpoint, and 4rem vs 5rem.
   The playground renders the header inside frames of known height (600 / 650 / 700 / 1080 px) so the
   choice is visual, not theoretical. Note that 720p *screen* height is not 720 CSS px of viewport —
   browser chrome takes a cut — which is exactly why the threshold is picked by looking, not by assuming.
2. **E4 — which dataset card, and what detail survives.** The record points at the sidebar card while its
   wording («la card de metadatos del dataset») reads as the main one, and the main one already complies.
3. **E5 — the breadcrumb strategy.** Three options are already on record: collapse the middle crumbs
   behind an ellipsis, truncate the middle crumbs, or show only the immediate parent with a «back»
   affordance. A fourth is now visible: fold the dataset page's inline nav into the same component.

## Registration corrections made with this document

1. **The dataset metadata card item is re-worded** (`BACKLOG.md:1178`) to name both cards and to record
   that «Detalles» already complies — otherwise the next reader re-measures the same thing.
2. **The breadcrumb is de-duplicated**: it was listed both in the block E table (`BACKLOG.md:90`) and
   again under the `v1+` items (`BACKLOG.md:94`). It stays in block E.
3. **The block E table row loses the claim «Cero decisiones»** — three of its items need the author, as
   recorded above.
4. **The logout advisories of review `review-344a93dbb8243ef2` carry a measured correction**: the
   recorded recommendation (b) rested on a premise that measurement refutes. Evidence is in that entry;
   the decision itself stays **open** (the author deferred it on 2026-09-24).

## Verification recipe (unchanged from block D)

- Gates: `pnpm test` · `pnpm check` · `./node_modules/.bin/biome check <touched files>` (`pnpm lint` is
  intermittent and its 11 diagnostics are the 11 unsafe fixes).
- Native review bounded per slice: `inspect` → `start` with the **full 40-char** `baseRef` of the
  previous commit plus `committedOnly: true` → `status` → capture (the first capture returns a forecast
  and runs nothing; resubmit the same binding with `reviewerRunAcknowledged: true`) →
  `acknowledge-approved`.
- Dev playground convention: `src/routes/dev/<page>/{+page.svelte,+page.ts}` where `+page.ts` throws
  `error(404)` unless `import.meta.env.DEV`. A **playground** is throwaway (deleted on promotion); the
  permanent **sheets** (`/dev/kind`, `/dev/copy`, `/dev/error`) render real components and stay.

## Progress

| Slice | Status | Receipt | Notes |
|---|---|---|---|
| **E1** | closed 2026-09-24 | `review-35a2937ca35fd6fc` · medium · reliability · 3 files / 130 lines · 0 blockers | Three defects, not one: the chips were not deduplicated, `moreFormats` counted **resources** instead of unique formats, and `filter(Boolean)` let a whitespace-only `format` through as a blank chip. The derivation moved to a pure `formatChips()` in `src/lib/resources/formats.ts` (`src/lib/resources/formats.test.ts`, 10 tests, 8 of which fail against the old behaviour). Measured live on the dev catalogue: `observatorio-de-movilidad-urbana-cochabamba` had 5 resources and 4 unique formats, and the card showed a duplicate chip plus `+1 más`. |
| **E2** | closed 2026-09-24 | `review-aae5dd97579ec543` · medium · reliability · 7 files / 124 lines · 0 blockers · 1 informational (`R3-1`) | **The author's decision on item 1 was: do NOT reduce the height.** It stays `5rem` at every viewport. The reported 720p problem was measured in the `/dev/header` frames (600 / 650 / 760 / 1080 px of viewport) and did not justify the shrink. What shipped is the single source: `--header-h` in `app.css`, every offset derived from it, the observer measuring the real element instead of a constant, and 5 anti-drift assertions in `src/routes/layout-header.test.ts` (RED measured: 5 of 7 fail with the implementation reverted). Verified beyond jsdom by reading the CSS **compiled by Vite**, which contains `height: var(--header-h)`, `top: var(--header-h)`, `top: calc(var(--header-h) + 1px)` and the `calc(+1rem)` inside `@media (width >= 64rem)`. |
| **E2 fix** | closed 2026-09-24 | `review-8caa93a99e7dc4a6` · medium · reliability · 2 files / 48 lines · 0 blockers · 0 findings | **Regression the E2 commit introduced, found by the author in light mode.** The token was declared inside the `.dark` block: light mode (the default) had no `--header-h`, so `height: var(--header-h)` fell back to `auto` (the header measured half) and every `top:` fell back to `auto`, breaking all four sticky offsets. Dark mode worked, so it read as a theme bug. Both E2 verifications checked presence instead of scope — the test counted declarations, the compiled-CSS check didn't inspect the enclosing selector. Now the test requires the token inside a `:root` block and never inside `.dark` (RED measured), and the compiled CSS is read by locating the enclosing block. |
| **E2 residual** | open | `R3-1` | The height is read **once**, at mount: if it changed later (a height media query, a late font, a layout change) the observer's `rootMargin` and threshold would go stale — the same failure as the old constant, minus the constant. Proper fix: a `ResizeObserver` on the header rebuilding the observer. Recorded, not fixed: informational advisory, and the receipt was already burned when it arrived. |
| **E2b** | closed 2026-09-24 | `review-6e034ec319f46e52` · medium · reliability · 7 files / 195 lines · 0 blockers · 2 informational suggestions (`R3-001` `dashboard/+page.svelte:290-293`, `R3-002` `+layout.svelte:63-68`) | The author's reopening of item 1, as a **different mechanism** from the one E2 rejected: not a viewport-height media query but a **shrink on scroll**. A 1px sentinel at the top of the layout (compensated with a negative margin, so it costs no layout) plus an `IntersectionObserver` whose 48px `rootMargin` is the threshold; the state is written on the **document** (`data-header-shrunk`), not on the header, because `--header-h` has to reach the sticky consumers that are **siblings** of the header. The token drops `5rem` → `4.5rem` (−8px) and every offset follows for free — which is exactly what E2 bought. Transitions: `height` on the header and `top` on the four consumers, 200ms, neutralised by the existing `prefers-reduced-motion` block. **`R3-1` is fixed here**, which is where it became required: an `IntersectionObserver`'s `rootMargin` cannot change after construction, so a `ResizeObserver` rebuilds it whenever the height changes. Tests: 3 new, RED measured at 4 of 10 failing; one of them caught a real mistake — the sentinel state variable was declared but never bound. |
| **E3–E6** | open | — | unchanged, see the slicing table above. |

**Promoted and deleted:** the `/dev/header` playground was the decision instrument for item 1 and was deleted
on promotion, as the block C/D playgrounds were (rule 8). No slice's diff contains it.

**Residual observation from E2, deliberately not acted on:** the search aside keeps
`lg:top-40 lg:max-h-[calc(100vh-11rem)]`. That offset looks like header + results bar, but the results bar's
height is content-driven and was never measured, so no derivation was invented for it. If the results bar's
height ever changes, that pair drifts with it — and nothing links them.

## Close of the session (2026-09-24)

| Slice | Status | Receipt | Notes |
|---|---|---|---|
| **E3** | closed | `review-29ba39931af7f59a` | The wizard's summary named the missing organisation (test first, 1 of 28 failing) and both dashboard descriptions got `text-pretty`. One advisory: the missing state is derived from the resolved title rather than from the selection, which would misreport an organisation whose title is empty. |
| **E7** | closed | `review-c918f32f7c87a968` | The breadcrumb is a **context chip** on mobile (the current level, with its type icon, and the trail inside its dropdown) and one single component in both pages - the dataset page's own inline nav is gone. Four advisories, two of them fixed later in E8. The test caught a real bug before committing: `GroupHeading` needs a `Group` wrapper and without it the dropdown crashed on open. |
| **E8** | code closed, **gate pending** | — | The author corrected their choice: the resource jump is the dropdown in the breadcrumb (a second group with the siblings, each with its format, the current one without an `href`) plus previous/next with `Recurso 4 de 5`. Order and extremes live in the pure `resourceNeighbours` with eight tests. **The review could not run**: the parallel session's untracked file makes the bounded START ask for the untracked selection, and both routes failed. Resume in a fresh process with `baseRef=448190a`, `committedOnly: true`. |

**New items from the author, both design, both measured (they are in `BACKLOG.md`):**
the previous/next buttons are too small to be noticed (`p-1.5`, `size-4` icon, counter hidden below `sm`); and
**on desktop there is no way to see or jump to the sibling resources**, because that group lives in the chip,
which is `lg:hidden` — the sidebar variant was discarded by the author, so the solution has to live somewhere
else.

**Defect introduced by E2b, measured by the browser itself:** scroll anchoring is disabled in the container
because the header changes its **in-flow height** by 16px when it shrinks and the browser compensates on every
transition; after ten consecutive adjustments it turns anchoring off. Three options are recorded in the item.
**Measure first whether it produces a visible jump**; if it does, the fix is to shrink without touching the
flow.

**Still blocked from earlier in the session:** the E5 correction plan (`review-5ab16f231f1adb49` in
`correction_required`, fix already committed as `e5d2411`, 25 diff lines to declare in a fresh process) and
**E4**, which needs the author's decision on which of the two dataset metadata cards is the one to normalise.
