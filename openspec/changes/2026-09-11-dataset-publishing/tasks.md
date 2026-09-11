# Tasks: Dataset Publishing

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,200 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 artifacts + schema fix → PR2 pure modules + tests → PR3 wizard UI + dashboard CTA |
| Delivery strategy | ask-on-risk |
| Chain strategy | **agreed 2026-09-11: chain of 3 work units** |

400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Change artifacts + `owner_org` schema fix | PR1 — **done** | `pnpm test src/lib/schemas` | N/A — docs and a Zod schema | revert artifacts and the schema change |
| 2 | Pure payload builder + multipart upload transport | PR2 — **done** | `pnpm test src/lib/utils/dataset-payload src/lib/api/upload` | `curl` multipart against the dev stack (verified 2026-09-11) | revert both modules; nothing imports them yet |
| 3 | Wizard UI + dashboard call to action | PR3 | `pnpm test src/routes/dashboard` | dev stack at `http://localhost:8082` | revert the route; API layer untouched |

## Phase 1: Artifacts and Schema — complete

- [x] 1.1 Write `proposal.md` for this change
- [x] 1.2 Write the delta spec with requirements and scenarios
- [x] 1.3 Write `tasks.md` with the review workload forecast
- [x] 1.4 RED: test that `owner_org` accepts a slug as well as a UUID — 4 failing tests proved the bug
- [x] 1.5 Relax `owner_org` to a non-empty slug-or-UUID string — GREEN
- [x] 1.6 Verify the organization-scope assumption against the dev instance (see 4.6)
- [x] 1.7 Decide the interoperability metadata question — **no `extras` in `v0`**, deferred with the ckanext-dcat evidence recorded in the spec

## Phase 2: Pure Modules — complete

- [x] 2.1 RED: payload tests — minimum submission, optional values omitted when empty, optional values in native fields
- [x] 2.2 RED: payload test asserting the payload contains **no** `extras` entries
- [x] 2.3 RED: slug tests — accents and punctuation dropped, separators collapsed, 100-char cap, empty result when nothing is usable
- [x] 2.4 RED: file validation tests — the 50 MB boundary is inclusive, oversize names the file and its size, format inferred from the extension
- [x] 2.5 Implement `dataset-payload.ts`: `MAX_RESOURCE_BYTES`, `suggestSlug`, `inferResourceFormat`, `validateResourceFile`, `buildPackagePayload`
- [x] 2.6 RED: upload tests with a stubbed `XMLHttpRequest` — transport, success, CKAN error, HTTP error, network error, progress, unknown total, abort, pre-aborted signal
- [x] 2.7 Implement `upload.ts`: `uploadResourceFile` over `XMLHttpRequest` with progress, abort and typed errors
- [x] 2.8 Assert in the tests that no `Content-Type` header is ever set on the upload path
- [x] 2.9 GREEN: 32 tests pass across both modules

## Phase 3: Wizard UI

- [ ] 3.1 Wizard shell: client-side auth guard redirecting to `/auth/login`, loading, error-with-retry, and the empty case when the user has no writable organization (`src/routes/dashboard/datasets/new/+page.svelte`)
- [ ] 3.2 Metadata fields with associated labels: title, slug, description, organization select, license select, tags, visibility, landing page, maintainer
- [ ] 3.3 Slug suggestion wired to the title, preserved once edited by hand
- [ ] 3.4 File picker with per-file size validation before any bytes are sent
- [ ] 3.5 Submit flow: `package_create`, then sequential uploads with per-file progress and cancellation
- [ ] 3.6 Partial failure: report per file, keep the dataset, offer retry against the created dataset
- [ ] 3.7 Success navigation to `/dataset/[name]`
- [ ] 3.8 Accessibility: labelled fields, errors associated with their field, busy submit state, no horizontal scroll at 360 px
- [ ] 3.9 Replace the `/dashboard` placeholder with a link to the wizard
- [ ] 3.10 RED then GREEN: component test covering the minimum valid submission calling `package_create` with the expected payload, blocked submit on a missing required field, and the no-writable-organization state

## Phase 4: Verification

- [ ] 4.1 `pnpm check` — 0 errors
- [ ] 4.2 `pnpm test` — full suite green
- [ ] 4.3 `pnpm lint` — no new findings
- [ ] 4.4 Against the dev stack: create a dataset from the wizard and upload a ~50 MB file; confirm the resource appears with the right size
- [ ] 4.5 Confirm no file bytes reach the SvelteKit server (upload path bypasses it; `BODY_SIZE_LIMIT` stays at its default)
- [x] 4.6 Smoke-check `organization_list_for_user` with `permission="create_dataset"` against the dev instance — **assumption holds**: an `editor` sees the organization, a plain `member` gets `[]`. Without the argument a plain `member` also sees the organization, which is why the permission argument is required by the spec. Probe used two users with different roles in one organization, then cleaned up (users, organization and tokens removed).

## Advisory Findings From the PR1 Review

The PR1 candidate was reviewed as `high` risk across all four lenses and closed approved. The findings below were **non-blocking** (`informational`): none opened a correction and none reopens that review. They were folded into PR2, whose candidate carries the fixes.

| ID | Lens | Where | Resolution |
|---|---|---|---|
| `R3-owner-org-whitespace` | reliability | `dataset.ts` | **Fixed in PR2.** `owner_org` now uses `.trim()`, so an organization of spaces only is rejected instead of reaching CKAN. Two tests added: whitespace-only is rejected, a padded valid value is trimmed. |
| `R2-002` | readability | `dataset.ts:17-19` | **Fixed in PR2.** The rationale moved above the schema declaration; the field list is contiguous again. |
| `R4-owner-org-local-validation-loss` | resilience | `dataset.ts` | **Documented in PR2.** Relaxing UUID to a plain string lost local validation that the organization exists. Kept deliberately: the select is populated from `organization_list_for_user`, so a fabricated value can only arrive through a hand-built request, and CKAN rejects it. Recorded in the schema's docblock. |
| `R2-003` | readability | `tasks.md:14-17` | **Fixed in PR2.** The artifact said a decision was still pending while the chain had already been agreed; the forecast now states the agreed chain of three units. |
| `R2-001` | readability | `tasks.md:29` | **Fixed in PR2.** The change's tasks no longer explain what is *not* part of the change; that belongs in the commit message and `BACKLOG.md`, where it already lives. |
