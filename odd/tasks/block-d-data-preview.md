# Block D — the data preview tells the truth about what it can show

**Feature.** The resource page offers a «Vista previa» panel whose behaviour does not match what the
platform can actually do. Today: a single `Tabla` tab gated to `format === "csv"` (a gate **we** invented,
not CKAN's), two simulated tabs (`Gráfico`, `Mapa`) that render placeholder prose, and a `datastoreApi`
built **without the session token**, so the preview of a private dataset's resource answers `403` even
though the page itself loads.

**Status:** open · **Branch:** `feat/v0-portal-honesty` · **Started:** 2026-09-23

## Measured basis (all readings taken 2026-09-23 against the live dev stack)

| Measurement | Result |
|---|---|
| `datastore_search` on a resource that **exists** but has no DataStore table | `404` `Not Found Error` · «Not found: Resource "<id>" was not found.» |
| `datastore_search` on an **invented** id | `404` `Not Found Error` · «Not found: Resource "no-existe-xyz" was not found.» |
| `datastore_active` in the API response | **present**, `false` on all 35 resources |
| `resource_type` on all 35 resources | `None` on all 35 |
| `ckan.plugins` (dev container) | `image_view text_view datatables_view datastore datapusher envvars expire_api_token umss` |
| `ckan.datapusher.formats` | **unset** → CKAN default `csv, xls, xlsx, tsv, ods` (+4 MIME types) |
| `Content-Disposition` in CKAN's download path | **`inline; filename=…`** on CSV, PDF and PNG (measured on real uploads, D0) |

Consequences, all decisive:

1. **The `404` cannot discriminate.** CKAN returns the *same* error shape for "exists but has no table"
   and "does not exist". So classifying the `404` is impossible, and reading the `404` as "no table"
   would be a lie for a genuinely missing resource. `datastore_active` is the honest discriminator, and
   it **already arrives** in the `resource_show` response the page fetches — no extra request.
2. **The CSV-only gate is ours, and it produces a false negative.** The DataPusher default list includes
   `xls`, `xlsx`, `tsv` and `ods`, and `datastore_search` serves any table that exists regardless of the
   source file's format. A hosted XLSX that CKAN *did* load has a working table and our panel still says
   «únicamente para recursos CSV».
3. **`Gráfico` / `Mapa` are not preview kinds at all.** `PRD.md` (section «Modelo de vistas», decision of
   2026-09-13) separates them explicitly: *«Vista previa (render automático)»* is chosen by `format`
   (PDF → embed/iframe, image → `<img>`, TXT/JSON → text, CSV → table) and *«Los gráficos no son parte de
   la vista previa»* — they belong to the data-analysis module (RF-24/25/26). **The two simulated tabs
   contradict the PRD**, they are not merely unimplemented.
4. **RF-30 is unfulfilled.** `PRD.md:186` — «Los archivos PDF, imágenes, TXT y JSON se previsualizan en el
   navegador.» Today none of them are.
5. **The seeded links got submitted to the pusher and failed.** `ckanext/datapusher/plugin.py:88-92`
   submits when `format` is in the configured list **and** `url_type != 'datapusher'` — it does *not*
   require a hosted file. The 35 seeded resources declare `format: CSV` and a seeded URL
   (`https://data.umss.edu.bo/...`) that does not resolve, which is the honest explanation of
   `datastore_active: false` on all 35.

## Decisions (author, 2026-09-23)

- **D-a — what gates the table: `datastore_active === true` only.** The format stops deciding whether
  data exists; it does not belong to that question. `format === "csv"` is removed from the component.
  Accepted cost: in DEV nothing shows a table today (all 35 are `false`) unless the file fixtures declare
  it — the same precedent as `url_type` in C1.
- **D-b — the Data API section is gated by `datastore_active === true`** and shows the endpoint that
  actually works (`datastore_search`), replacing a gate (`resource_type === "api"`) that never renders.
- **D-c — the panel renders by type, per RF-30 / the PRD view model.** PDF → embed, image → `<img>`,
  TXT/JSON → text, table → 20 rows via `datastore_search`.
- **D-d — `Gráfico` and `Mapa` are removed from the preview**, not implemented: they are analysis views.
- **Open, not yet decided:** what the panel says when a *hosted file* has no preview at all (unknown
  format, no table).

## Slices

Each slice closes with its own work-unit commits and **its own native review** (the block-B lesson: 957
lines in one review is too much; keep every slice under the 400-line review budget).

### D0 — the live probe that closes two open questions *(MEASURED 2026-09-23, catalogue restored)*

Ran against the live dev stack (CKAN 2.11.6, `site_url=http://localhost:5000`): a throwaway org + public
dataset with three real uploaded files (CSV 89 B, PDF 587 B, PNG 3.7 KB), then purged
(`dataset_purge` → `organization_purge`, 4 probe tokens revoked). Catalogue back to **17 datasets / 7 orgs**.

| Question | Answer | Evidence |
|---|---|---|
| Does the DataPusher load an uploaded CSV end-to-end? | **YES, and fast.** | `datastore_active: true` on the first poll; `datastore_search` → `total=3`, fields `_id, municipio, anio, vehiculos` |
| Does a hosted file's download URL render **inline**? | **YES.** | `Content-Disposition: inline; filename=…` on all three (CSV/PDF/PNG), correct `Content-Type`, correct magic bytes, HTTP 200 **anonymously** |
| What does a genuinely hosted resource look like? | | `url_type: "upload"`, `mimetype` correct (`text/csv`, `application/pdf`, `image/png`), `size` set |

**Two corrections to earlier beliefs:**

- **The open unknown since 2026-09-21 is closed.** `BACKLOG.md` said «si la vista previa falla para archivos
  subidos, la causa es otra y todavía no está identificada». It is identified now: **the pusher works**; the
  failing previews were the seeded *links*, which never had a table to begin with.
- **`hash` is `null` even for a hosted file.** C1's reasoning listed “no `hash`” among the signs of a link;
  it is not a discriminator — `url_type` is. The shipped rule (`url_type === "upload"`) is unaffected.

**Consequence for D1:** RF-30 is implementable as written — `<img src>` and `<iframe src>` against the
resource's own download URL work. No alternative mechanism needed.

### D1 — the honest renderer, proposed in a playground *(RF-30 / RF-31)*

- New pure module `src/lib/resources/preview.ts`: `previewKind(resource)` returning
  `"table" | "pdf" | "image" | "text" | "none"`, mirroring the style of `resources/kind.ts` and
  `api/failure.ts` (one pure function, tested in both directions).
- `ResourcePreview.svelte` renders by kind; `isCsv` is deleted. Links keep C2's state (the page decides
  before the component).
- `datastore_active?: boolean` added to `CkanResource`.
- Playground sheet `src/routes/dev/preview/+page.svelte` per `AGENTS.md` rule 8: the **real** component
  with every kind, plus the states. The author reviews and iterates there; promotion comes after.

### D2 — absorb the four findings of `review-ca9abb1187a39513`

1. `R3-stale-search-race` (WARNING) — a stale `datastore_search` can resolve after a newer one.
2. `R3-cellvalue-object-stringify` — `String(obj)` renders `"[object Object]"`.
3. `R3-limit-prop-unenforced` — the `limit` prop is accepted and unused.
4. `R3-loading-state-untested` — the loading state has no test.

### D3 — the Data API section *(decision D-b)*

Replace the `resource_type === "api"` gate with `datastore_active === true`, and show the endpoint that
actually works: `{CKAN_URL}/api/3/action/datastore_search?resource_id=<id>` — not `resource_show`, which is
what the section computes today. The curl example follows the endpoint, and the extras-driven rows
(`api_base_url`, `docs_url`, `example_request`, `example_response`) stay as **optional additions inside the
new gate**: a table-backed resource that also carries docs still shows them.

**Considered and rejected:** gating on `resource_type === "api"` **or** `datastore_active`. `resource_type`
is a legacy label nothing writes (CKAN's own form has the field commented out; measured `None` on all 35
catalogue resources), so a branch on it cannot be verified against real data. If the portal ever creates
API-typed resources, that is its own decision.

**Spec reconciliation — two defects, not one:**
1. «Preview Placeholder» (`openspec/specs/resource-detail-view/spec.md:76-85`) requires «a clearly bounded
   area … reserved for a preview widget» that «indicates that preview is coming soon». The preview shipped
   in D1: the requirement is obsolete and contradicts the page. Replace it with what the page does — render
   by kind: a table when the resource has a DataStore table, an embed for PDF/image/text, and an explicit
   state when there is none.
2. «API Metadata» (`:27-43`) says the section appears «when a resource's `extras` indicate it is an
   API-type resource», while the code gates on `resource_type` — another spec/code mismatch, and neither
   matched reality. Restate it: the section appears when the resource has a DataStore table; the endpoint
   is `datastore_search`; the extras add the documentation link and examples **if present**.

Both requirements are reconciled **in place** (the file is the source of truth; no new file per session).

## Allowed edit surfaces

- **D0:** none (measurement only; dev CKAN catalogue is restored by purge).
- **D1:** `src/lib/resources/preview.ts`, `src/lib/resources/preview.test.ts`,
  `src/lib/components/resource/ResourcePreview.svelte`,
  `src/lib/components/resource/ResourcePreview.test.ts`, `src/lib/types/ckan.ts`,
  `src/routes/dev/preview/+page.svelte`, `src/lib/mock/data.ts`.
- **D2:** `src/lib/components/resource/ResourcePreview.svelte`,
  `src/lib/components/resource/DataPreviewTable.svelte`, `src/lib/api/datastore.ts`, and their `.test.ts`.
- **D3:** `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`,
  `src/routes/dataset/[id]/resource/[resourceId]/resource-page.test.ts`,
  `openspec/specs/resource-detail-view/spec.md`.

## Known risks

- **D1 depends on D0 in one point:** ~~whether CKAN's download URL renders inline~~ **ANSWERED: it does**
  (`Content-Disposition: inline`). The PDF and image kinds need no alternative mechanism.
- **A test that D1 breaks on purpose:** `resource-page.test.ts:408` asserts **exactly three** preview tab
  buttons (`toHaveLength(3)`). Removing `Gráfico`/`Mapa` must change that assertion by hand — that is the
  intent, so the change of behaviour forces a human edit.
- **`previewKind` must not re-derive the file/link question:** it consumes `resources/kind.ts`, so there
  is one rule for "is this a link", not two.

## Tasks

1. **D0** — live probe: upload CSV + PDF + PNG, measure, purge. **DONE 2026-09-23** (results above;
   catalogue restored to 17 datasets / 7 orgs).
2. **D1a** — `preview.ts` + tests (RED first). **DONE** — `8582120` · 84 + 140 lines · 40 tests.
3. **D1b** — `ResourcePreview.svelte` renders by kind; `datastore_active` in the type. **DONE** — same
   commit for the module, `c12a92b` for the component · 11 tests.
4. **D1c** — playground sheet `/dev/preview`. **DONE** — `c12a92b` · 444 lines + `+page.ts` (24) + four
   ASCII samples (61).
5. **D1d** — author review of the sheet, iterate. **DONE 2026-09-23** — reviewed via
   `http://localhost:5173/dev/preview`, approved with no observations.
6. **D1-promote** — the resource page drops the simulated tabs and sends its token. **DONE** — `ce8670a`.
7. **D2** — the four findings of `review-ca9abb1187a39513`. **DONE** — `faa62eb` · 4 files / +120/−9 · 5 new tests
   (588 → 593). Receipt `review-891f798293c18235` **approved** (medium, reliability, 129 lines, budget 65),
   two informational advisories, authority burned. The race test's power was verified the hard way: with the
   guard neutralised it **failed** (the stale row appeared), and the file was restored byte-identical by
   sha256. The `limit` prop was removed rather than implemented: what limits the rows is the fetch, and a
   prop that does nothing misstates the component's contract.
8. **D3** — the Data API gate + the spec reconciliation. **DONE** — `9443e0f` · 3 files / +126/−24. Receipt
   `review-03b5057b001e6f9b` **approved** (medium, reliability, 150 lines, budget 75), two informational
   advisories, authority burned. **Block D is closed: D0, D1, D2 and D3 all shipped and reviewed.**

## D1 receipt

**`review-4fb694e5160560c1` — APPROVED.** Tier `medium`, lens `review-reliability`, **12 files / 1 182
lines**, correction budget 200, **two informational advisories, zero blockers**. Range reviewed with an
explicit `baseRef` (`cdd69dd..HEAD`), so only block D's code — not the accumulated branch, which the
default inspection derives. Authority burned (`gentle-ai.review-acknowledged/v1`).

- `R3-001` · `reliability` · WARNING · informational · `src/lib/resources/preview.ts:18-23`
- `R3-002` · `reliability` · WARNING · informational · `src/lib/resources/preview.ts:29`

The closure states that neither opens a correction, neither reopens the review, and no correction
transition is offered for this candidate. Recorded in `BACKLOG.md` → «Deuda de revisión (RDD)».

**Budget deviation, disclosed:** 1 182 lines against the agreed 400. **529 of them are the review sheet
and its four samples** (dev-only surface with no production effect); the production surface is 653.
Same class of deviation as block B (957 lines, accepted as one `medium`).

### What D1 changed on the live page

1. A hosted PDF, image, TXT or JSON now **embeds** instead of reading «únicamente para recursos CSV».
2. A hosted CSV/XLS/XLSX/TSV/ODS **without** a DataStore table no longer calls `datastore_search` (so no
   CKAN `404` turned into «no se pudo cargar») and says the data is not loaded yet.
3. An unknown format says the portal cannot preview that kind of file.
4. Table error and empty states are compact; the loading state is unchanged.
5. The simulated `Tabla`/`Gráfico`/`Mapa` tabs are gone, and the DataStore client carries the session token.
