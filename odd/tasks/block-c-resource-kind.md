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

_(filled per slice: commit identity, gates, live measurement, review receipt.)_
