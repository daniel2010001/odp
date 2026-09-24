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

### D3 — the Data API section *(D-b)*

Replace the `resource_type === "api"` gate with `datastore_active === true`; show
`datastore_search?resource_id=<id>`. Reconcile `openspec/specs/resource-detail-view/spec.md`, whose
«Preview Placeholder» requirement («reserve a visible placeholder for a future data preview widget …
preview is coming soon», lines 76-85) is now obsolete and contradicts the shipped behaviour.

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
2. **D1a** — `preview.ts` + tests (RED first).
3. **D1b** — `ResourcePreview.svelte` renders by kind; `datastore_active` in the type; fixtures declare
   `datastore_active` / `url_type`.
4. **D1c** — playground sheet `/dev/preview`.
5. **D1d** — author review of the sheet, iterate.
6. **D2** — the four findings.
7. **D3** — Data API gate + the spec reconciliation.
8. **D-promote** — promote the approved sheet, delete the playground, gates green.
