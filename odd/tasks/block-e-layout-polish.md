# Block E — v0 layout and card polish

**Feature.** Six (plus one) small defects reported by the author across the v0 surfaces: a header that
eats vertical space on 720p, a dataset metadata card that does not match its resource counterpart, a
blank organization block in the wizard summary, an orphan-wrapped description on the dashboard,
duplicated format chips in the search cards, a breadcrumb with no mobile treatment, and a link view
that is mostly empty box.

**Status:** open · **Branch:** `feat/v0-portal-honesty` · **Started:** 2026-09-24

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
