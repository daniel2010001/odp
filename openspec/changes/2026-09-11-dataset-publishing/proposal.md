# Proposal: Dataset Publishing

## Intent

The portal is read-only. `/dashboard` currently promises "La publicación de datasets estará disponible próximamente", and there is no way to create a dataset or upload a resource from the portal: CKAN's own web UI is the only path. That breaks the `v0` goal of a single UMSS-branded front end and blocks the PRD §8 publication flow, and it leaves the verified 50 MB upload path (2026-09-11) with no consumer.

This change adds the portal's dataset creation wizard with resource upload, writing directly to CKAN's action API from the browser.

## Scope

### In Scope

- Wizard route `/dashboard/datasets/new` for creating a dataset
- Metadata: title, slug, description, organization, license, tags, visibility, landing page, maintainer, and the interoperability fields that map onto **native** CKAN fields
- Resource upload: multiple files, browser-to-CKAN multipart, 50 MB per file, visible progress, per-file failure reporting
- Resource links: attach an external URL as a resource, without uploading bytes (PRD RF-11 and RF-13: a resource is a file **or** a link)
- Dashboard call to action replacing the "próximamente" placeholder
- Client-side authentication guard

### Non-Goals

- Editing or deleting an existing dataset (separate change)
- Approval workflow `draft → review → approved` — CKAN has no API for it; tracked in `BACKLOG.md` as `v1`
- Collaborators, teams, collections (`v1`)
- Server-side upload proxy — deferred to the `v1` httpOnly-cookie hardening, which is when the browser loses the token
- **DCAT `extras` entirely.** Deferred to the change that adopts a DCAT profile; the spec records the evidence and the reason
- Drag-and-drop reordering, resumable uploads, chunked uploads

## Capabilities

### New Capabilities

- `dataset-publishing`: creating a dataset and attaching resources to it from the portal, including the metadata contract, the slug contract, visibility, and resource upload behavior.

### Modified Capabilities

- None. (`authentication` is reused as-is: the wizard consumes the existing token from the auth store.)

## Approach

Browser-direct writes. The browser talks to CKAN through the same-origin `/api/` proxy; the SvelteKit server never handles dataset payloads or file bytes.

```
browser ──POST /api/3/action/package_create   (JSON)  ─┐
   │                                                    ├─> nginx ──> CKAN
   └──POST /api/3/action/resource_create  (multipart)  ─┘
```

Three deliberate transport decisions, each with a measured reason:

1. **JSON for `package_create`.** Every CKAN action accepts JSON except file uploads.
2. **`multipart/form-data` with the `upload` key for `resource_create`.** Required by CKAN's FileStore; `url` is then set by CKAN, which is why the existing `resourceApi.create()` (which requires `url`) is not used here.
3. **The `Content-Type` header is never set on the upload.** Setting it by hand drops the multipart boundary and CKAN rejects the file. The browser must be allowed to set it.

Uploads use `XMLHttpRequest` rather than `fetch`, because `fetch` cannot report upload progress: progress feedback matters for a 50 MB file, and a SvelteKit form action cannot show progress either.

| Area | Impact | Description |
|------|--------|-------------|
| `src/routes/dashboard/datasets/new/+page.svelte` | New | The wizard: metadata form, org/license selects, file picker, progress, errors |
| `src/lib/utils/dataset-payload.ts` | New | Pure: form state to CKAN payload, slug suggestion, file validation |
| `src/lib/api/upload.ts` | New | Multipart resource upload with progress, abort, and typed errors |
| `src/lib/schemas/dataset.ts` | Modified | `owner_org` must accept a slug as well as a UUID (it currently demands a UUID) |
| `src/routes/dashboard/+page.svelte` | Modified | Replace the "próximamente" block with a link to the wizard |
| `openspec/changes/2026-09-11-dataset-publishing/**` | New | This change's artifacts |

## Assumptions

- `organization_list_for_user` with `permission="create_dataset"` returns the organizations where the logged-in user may create datasets. **Verified by measurement on the dev instance (2026-09-11):** an `editor` sees the organization and a plain `member` gets an empty list, which is the filtering the wizard needs. Without the parameter a plain `member` also sees the organization, so the permission argument is load-bearing: falling back to the unfiltered list would offer organizations where `package_create` fails.
- CKAN accepts `owner_org` as either a slug or a UUID, so the select can submit either.
- CKAN's own limit is 100 MB (`CKAN_MAX_UPLOAD_SIZE_MB`), and nginx allows 55M for `/api/` since 2026-09-11, so a 50 MB file fits. The application policy is 50 MB (PRD RF-12).
- The token stays in `localStorage` for `v0`; the wizard reads it from the existing auth store. The XSS risk is already accepted and tracked for `v1`.
- **No DCAT `extras` are written in `v0`.** Verified against the ckanext-dcat source on 2026-09-11: its extras vocabulary differs between its own legacy profile (`dcat_issued`, `dcat_publisher_name`, bare `language`, `guid`) and its scheming profile (first-level custom fields). Freezing key names now would force a migration of every dataset created in between, so the deferral is deliberate. What `v0` needs is covered natively — `issued`/`modified` fall back to `metadata_created`/`metadata_modified`, publisher falls back to the owning organization, creator falls back to `author`.

## Rollback Plan

Frontend-only change; no CKAN schema or configuration is touched. Revert the commit and the wizard route disappears. Datasets already created stay in CKAN and can be removed with `package_delete` or from CKAN's UI. No migration, no data loss.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Partial failure: dataset created but a file upload fails | Med | Keep the dataset, report failure **per file**, link to the created dataset, let the user retry that file |
| Slug collision (`package_create` conflict) | High | Suggest a slug from the title; surface the conflict explicitly and let the user edit it |
| Oversized file rejected by a proxy, not by the app | Med | Validate size client-side before sending, with an explicit message; never let it surface as a generic validation error |
| `extras` key names drift or force a migration | Removed | Not applicable in `v0`: no extras are written, so there is nothing to migrate when a DCAT profile is chosen |
| Token in `localStorage` (XSS) | Med | Accepted `v0` risk; already tracked as the `v1` hardening item |
| Uploading a `.csv` queues datapusher and slows the response | Low | Accepted; datapusher runs asynchronously and does not block `resource_create` |

## Success Criteria

- [ ] An authenticated user can create a dataset from the portal
- [ ] The organization select lists only organizations where the user can create datasets
- [ ] Files up to 50 MB upload with visible progress; larger files are rejected before any bytes are sent
- [ ] The created dataset is reachable in the catalog and shows its resources
- [ ] No file bytes and no dataset payload pass through the SvelteKit server
- [ ] Partial failure is reported per file and never silently swallowed
