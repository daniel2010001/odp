# Block C — a resource according to its kind

**Feature.** The portal presents every resource as a file: a format badge, data views (Tabla /
Gráfico / Mapa) and a «Descargar recurso» action. The seeded catalogue proves that wrong on 35 of 35
resources — they are **external URLs** (`https://data.umss.edu.bo/...`) with `url_type` absent,
`mimetype` absent and no `hash`, dressed up with a `format` (CSV, XLSX, GeoJSON, PDF) and an invented
`size`. A link is not a file, and the portal should not offer it a file's affordances.

**How a link is detected — MEASURED, not inferred.** CKAN already answers this, in its own source:

```
ckan/lib/uploader.py:301          resource['url_type'] = 'upload'   # a file was uploaded
ckan/lib/uploader.py:324          resource['url_type'] = ''         # no upload
ckan/lib/dictization/model_dictize.py:132
    if resource.get('url_type') == 'upload' and not context.get('for_edit'):
```

`model_dictize` uses exactly that test to decide whether to rewrite `url` to the download path. So
**`url_type === "upload"` means «hosted file»**, and everything else — `''` when an upload was
cleared, absent when the resource was created with a plain URL — is an **external reference**. Two
live facts complete the picture: the 35 seeded resources carry no `url_type` at all, and the portal
currently has **no reader of `url_type` anywhere in `src/`** (the local `CkanResource` type does not
even declare the field).

**The wizard already knows, and throws it away.** `src/routes/dashboard/datasets/new/+page.svelte`
tracks `tipo: "archivo" | "enlace"` in its own state and renders `FileText`/`Link` icons for it, but
`createLinkEntry` posts only `package_id`, `name`, `url`, `description` — no marker is persisted. So
the distinction exists in the form and dies at write time. This is why the classifier reads CKAN's
rule instead of inventing a marker of our own: a marker would only cover resources created after it
ships, and the portal would carry two sources of truth for one fact.

**Decisions (author, 2026-09-22).**
1. **Detection**: `url_type === "upload"` → file; anything else → link. No marker written to CKAN, no
   re-seed.
2. **Where the rule lives**: one pure shared module, the same shape as `src/lib/api/failure.ts` and
   `src/lib/copy/dashboard.ts` — both already reviewed — so there is exactly one place to get it wrong.
3. **Deferred, and recorded as a `TODO:`**: whether a link deserves its own page at all. This block
   keeps the page (it carries the link's metadata) and does not touch it.
4. **The kind chip is exclusive, in both places**: a resource that is not a hosted file shows only
   `Enlace` and does **not** keep its format chip. A link is a link; the accepted cost is that the
   declared format stops being visible for it. (The dataset-level format chips in the search card are
   a different surface — a dataset aggregates several resources — and are out of this block's scope.)

**Slices, split deliberately.** The previous block measured 957 diff lines against a 400-line review
budget; this one is cut to avoid repeating that.

| Slice | What | Review |
|---|---|---|
| **C1** | The rule, the type, honest fixtures, and the **link badge** on the dataset's resource list and on the resource detail header | its own |
| **C2** | **Hiding the data views** for a link (the Tabla/Gráfico/Mapa tabs and `ResourcePreview`'s gate) | its own |

**Surfaces that present a resource kind** (mapped by exploration, for C2 and for whoever comes next):

| Site | Reads |
|---|---|
| `resource/[resourceId]/+page.svelte:221` header badge | `format` |
| `resource/[resourceId]/+page.svelte:237-248` metadata rows | `url`, `format`, `size`, `mimetype`, `resource_type`, `created`, `hash` |
| `resource/[resourceId]/+page.svelte:508-547` view tabs (Tabla/Gráfico/Mapa) | local state only — **always shown today** |
| `resource/[resourceId]/+page.svelte:309,490-498` «Descargar recurso» | `url` |
| `resource/[resourceId]/+page.svelte:551` «API · Endpoint» block | `resource_type === "api"` |
| `dataset/[id]/+page.svelte:508-520` «Archivos disponibles (n)» | `state`; heading says *Archivos* for everything |
| `components/dataset/ResourceCard.svelte:88-91` format badge | `format`, with an English `"FILE"` fallback |
| `components/resource/ResourcePreview.svelte:15` | `format === "csv"` gates the datastore query |
| `components/search/DatasetCard.svelte:16-24` dataset format chips | `format` per resource |
| `search/+page.svelte:459` «Formato» facet | Solr `res_format` — dataset level, not a resource kind |

**A consequence that must not be forgotten**: no fixture in `src/lib/mock/data.ts` declares
`url_type`, so without touching them **every mock resource becomes a link** and the DEV surfaces would
lie in the other direction.

## Tasks

- [x] **C1** · the rule (`src/lib/resources/kind.ts` + its test), the `url_type` field in
  `CkanResource`, honest mock fixtures, and the link badge in `ResourceCard` and in the resource
  detail header.
- [ ] **C2** · hide the view tabs and the preview for a link (delegated separately).
- [ ] `TODO:` decide whether a link deserves its own page (author, deferred in this block).

## Evidence

**C1 — CERRADO (2026-09-22).** `ed0b171` (this plan) · `fa96d5c` (the rule, the `url_type` field, the
honest fixtures) · `15b016d` (the chip in the resource list and in the detail header).

| Gate | Result |
|---|---|
| `pnpm test` | **531 passed / 531** (41 files) |
| `pnpm check` | **0 errors**, 4 pre-existing warnings |
| direct Biome | **131 files, exit 0**; 4 warnings + 7 infos, all pre-existing |
| `pnpm build` | exit 0 |

**Review.** `review-c282f17baf9309ea` — **APPROVED, receipt burned, ZERO findings** (tier `medium`,
lens `review-reliability`, 9 files / 342 lines, correction budget 171, one reviewer), over the slice's
committed range only (`baseRef=f4fe203`). **Under the 400-line review budget** — the C1/C2 split is why,
after block B ran 957.

**The decision the author made while reviewing.** The kind chip is **exclusive in both places**. The
first implementation was asymmetric — exclusive in the card, additive in the detail header — because
this plan's wording was ambiguous. The author chose one meaning per chip: a link is a link. The accepted
cost, stated at the time: the declared format stops being visible in those two surfaces (it remains in
the metadata table), and since every seeded resource is a link, the list shows no format chips.

**Two verifications worth keeping.** (1) The live check of the resource list needs a browser: the
dataset page renders that list client-side, so its initial HTML is a loading shell — a `curl` that finds
no chips is blind, not negative, and this plan's author nearly recorded it as a false negative.
(2) The classifier's test includes the **seeded shape** (an external URL with `format: "CSV"` and a
`size` but no `url_type` → link), so a declared format can never promote a link to a file.

**C1 — segunda vuelta (2026-09-22).** `6191b1d` (the shared chip) · `ee6086b` (the `/dev/kind` sheet) ·
`d650a64` (the two `v1+` TODOs). Receipt `review-5f36113f971853de` — **APPROVED, ZERO findings** (tier
`medium`, lens `review-reliability`, 9 files / 493 lines, correction budget 200). Of those 493 lines,
**309 are the DEV sheet** and the production change is ~150.

The author reviewed the chip and reported two defects, both fixed: the `Link` icon made the link chip
taller than the format chip, and the variable width (`CSV` vs `GEOJSON`) shifted everything after it in
the row. The chip is now one component used by both surfaces, with no icon and a uniform `w-20`.

**A loss this round caused, and its decision.** This plan's own specification replaced `ResourceCard`'s
per-format colour map with a neutral chip — the map lived inside the component with raw `oklch` literals,
two documented violations (`AGENTS.md` rule 3 and the design-system's hardcoded-colour anti-pattern) and
ten saturated hues where the system allows two per screen. The author decided to **keep the chip neutral
for now** and define the format palette in the detail pass, as tokens in `src/app.css` with their roles in
the design-system README. **Do not restore the raw map** without that decision: it would reinstate both
violations.

**Why the colour slipped past both the writer and the reviewer.** This plan specified *classes*, and a
muted class is a perfectly valid chip, so nothing failed and nothing warned. What was lost — that the
list encoded format by colour — was only visible by **reading the file being replaced**, not the line
being cited. That is the lesson of the round, and it is the same shape as the two earlier spec defects of
this session.

## Slice C2 — an external reference has no preview to offer (2026-09-22)

`83412f5`. Receipt `review-74d83299cafabe6f` — **APPROVED, ZERO findings** (tier `medium`, 2 files /
87 lines, correction budget 44), over the slice's committed range only (`baseRef=ee11794`).

The same rule as the kind chip decides it: `resourceKind(resource)`, derived once per render. For a link
the tabs and the `ResourcePreview` body are not rendered, and a short state explains the absence, because a
blank panel is an anti-pattern in this project's own design system. A hosted file is untouched — removing
the simulated views belongs to block D, and mixing it in here would have emptied the meaning of that
block's receipt.

**Verified in both directions by test**, and one limit recorded honestly: **the live measurement was not
possible**. The resource page renders its content client-side, so its initial HTML is a loading shell and
`curl` sees neither branch. That is an instrument that cannot reach, not a negative result — the same trap
this block already recorded for the dataset page.

**A test block D will break on purpose.** The hosted-file direction asserts exactly three tab buttons
(`toHaveLength(3)`). When D removes the simulated views that assertion must change, and that is the intent:
a change of behaviour should force a deliberate change of the test that pins it.

