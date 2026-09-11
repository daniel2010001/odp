# Tasks: Dataset Publishing

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,250 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 artifacts + schema fix → PR2 pure modules + tests → PR3 wizard UI + dashboard CTA |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Change artifacts + `owner_org` schema fix | PR1 — **done** | `pnpm test src/lib/schemas` | N/A — docs and a Zod schema | revert artifacts and the one-line schema change |
| 2 | Pure payload builder + multipart upload transport | PR2 | `pnpm test src/lib/utils/dataset-payload src/lib/api/upload` | `curl` multipart against the dev stack (already verified 2026-09-11) | revert both modules; nothing imports them yet |
| 3 | Wizard UI + dashboard call to action | PR3 | `pnpm test src/routes/dashboard` | dev stack at `http://localhost:8082` | revert the route; API layer untouched |

### Out of Scope for This Change

The UI copy normalization from voseo to neutral formal Spanish was decided in the same session but is **not** part of this change: it touches unrelated pages (`/`, `/search`, `/auth/login`, `/organizations`, dataset and resource detail) and is delivered as its own commit. Its closure is recorded in `BACKLOG.md`.

## Phase 1: Artifacts and Schema — complete

- [x] 1.1 Write `proposal.md` for this change (`openspec/changes/2026-09-11-dataset-publishing/`)
- [x] 1.2 Write the delta spec with requirements and scenarios (`specs/dataset-publishing/spec.md`)
- [x] 1.3 Write `tasks.md` with the review workload forecast
- [x] 1.4 RED: test that `owner_org` accepts a slug as well as a UUID (`src/lib/schemas/dataset.test.ts`) — 4 failing tests proved the bug
- [x] 1.5 Relax `owner_org` to a non-empty slug-or-UUID string (`src/lib/schemas/dataset.ts`) — GREEN, 10/10
- [x] 1.6 Verify the organization-scope assumption against the dev instance (see 4.6)
- [x] 1.7 Decide the interoperability metadata question — **no `extras` in `v0`**, deferred with the ckanext-dcat evidence recorded in the spec

## Phase 2: Pure Modules

- [ ] 2.1 RED: payload tests — the minimum submission carries `title`, `name`, `owner_org`, `private`, empty optional values are omitted, optional values land in native fields
- [ ] 2.2 RED: payload test asserting the payload contains **no** `extras` entries
- [ ] 2.3 RED: slug tests — suggestion from a title drops accents and punctuation, respects the 2–100 char range, and is not overwritten once edited
- [ ] 2.4 RED: file validation tests — the 50 MB boundary is inclusive, oversize reports name and size, format is inferred from the extension
- [ ] 2.5 Implement `dataset-payload.ts`: `MAX_RESOURCE_BYTES`, `suggestSlug`, `inferResourceFormat`, `validateResourceFile`, `buildPackagePayload` (`src/lib/utils/dataset-payload.ts`)
- [ ] 2.6 RED: upload tests with a stubbed `XMLHttpRequest` — success returns the created resource, `success:false` maps to a typed error, no `Content-Type` is set, `Authorization` is sent, abort rejects as cancelled, progress events reach the callback (`src/lib/api/upload.test.ts`)
- [ ] 2.7 Implement `upload.ts`: `uploadResourceFile` over `XMLHttpRequest` with progress, abort and typed errors (`src/lib/api/upload.ts`)
- [ ] 2.8 Confirm no `Content-Type` header is ever set on the upload path (assert in the test, not only in a comment)

## Phase 3: Wizard UI

- [ ] 3.1 Wizard shell: client-side auth guard redirecting to `/auth/login`, loading, error-with-retry, and the empty case when the user has no writable organization (`src/routes/dashboard/datasets/new/+page.svelte`)
- [ ] 3.2 Metadata fields with associated labels: title, slug, description, organization select, license select, tags, visibility, landing page, maintainer
- [ ] 3.3 Slug suggestion wired to the title, preserved once edited by hand
- [ ] 3.4 File picker with per-file size validation before any bytes are sent
- [ ] 3.5 Submit flow: `package_create`, then sequential uploads with per-file progress and cancellation
- [ ] 3.6 Partial failure: report per file, keep the dataset, offer retry against the created dataset
- [ ] 3.7 Success navigation to `/dataset/[name]`
- [ ] 3.8 Accessibility: labelled fields, errors associated with their field, busy submit state, no horizontal scroll at 360 px
- [ ] 3.9 Replace the `/dashboard` placeholder with a link to the wizard (`src/routes/dashboard/+page.svelte`)
- [ ] 3.10 RED then GREEN: component test covering the minimum valid submission calling `package_create` with the expected payload, blocked submit on a missing required field, and the no-writable-organization state (`src/routes/dashboard/datasets/new/page.test.ts`)

## Phase 4: Verification

- [ ] 4.1 `pnpm check` — 0 errors
- [ ] 4.2 `pnpm test` — full suite green
- [ ] 4.3 `pnpm lint` — no new findings
- [ ] 4.4 Against the dev stack: create a dataset from the wizard and upload a ~50 MB file; confirm the resource appears with the right size
- [ ] 4.5 Confirm no file bytes reach the SvelteKit server (upload path bypasses it; `BODY_SIZE_LIMIT` stays at its default)
- [x] 4.6 Smoke-check `organization_list_for_user` with `permission="create_dataset"` against the dev instance — **done 2026-09-11, assumption holds**: an `editor` sees the organization, a plain `member` gets `[]`. Without the argument a plain `member` also sees the organization, which is why the permission argument is required by the spec. Probe used two users with different roles in one organization, then cleaned up (users, organization and tokens removed).
