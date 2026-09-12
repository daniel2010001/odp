# Archive Report: dataset-publishing

**Change**: 2026-09-11-dataset-publishing
**Archived**: 2026-09-12
**Artifact store**: openspec (repo-local `openspec/`)
**Schema**: spec-driven
**Status**: CLOSED

## Change Summary

Add the portal's dataset publishing wizard (`/dashboard/datasets/new`) plus a real dashboard (`/dashboard`) to the ODP portal. The wizard collects native CKAN metadata only (no DCAT `extras` in `v0`), builds the `package_create` payload in the browser, and uploads resources browser-direct to CKAN's `resource_create` action via the same-origin `/api/` proxy — no dataset payloads or file bytes ever pass through the SvelteKit server. Files are validated against a 50 MB limit before any bytes are sent, uploads show per-file progress with cancellation, partial failures are reported per file with a retry path, and external links can be attached as resources without uploading bytes. The dashboard replaces the "próximamente" placeholder with "Mis datasets", "Mis organizaciones", and a call to action to the wizard. Scope also absorbs the 3 PR2 review findings.

## Final State (at close)

Final-state facts below are the terminal record of the cycle and outrank intermediate snapshots (`apply-progress`, `verify-report`) wherever they disagree.

| Aspect | Final state |
|--------|-------------|
| Status | **CLOSED** — fully planned, implemented, verified, archived |
| Verification verdict | **PASS** — verify-report admitted by `gentle-ai sdd-verify-validate` (valid: true, verdict pass). Evidence revision `sha256:ea4e4dc65743ed03f0c6a3a46dd0e3edde48e7490e2ecb1b56118a146041f235`. |
| Requirements / Scenarios | 13/13 requirements, 35/35 scenarios compliant, 0 blockers, 0 CRITICAL findings |
| Tests | **162 passed / 162 (20 files)**, `pnpm test` exit 0 |
| Type-check gate | `pnpm check` → 0 errors (4 pre-existing warnings unrelated to the change) |
| Build gate | `pnpm build` → exit 0 (`@sveltejs/adapter-node`) |
| Lint | Biome clean — `pnpm lint` → 0 errors, 4 warnings, 7 infos (all pre-existing) |
| Tasks | 37/37 complete. Persisted `tasks.md` (archived) has every task checked `[x]` (Phase 1: 7, Phase 2: 9, Phase 3: 15, Phase 4: 6); 0 unchecked implementation task markers. |
| RDD reviews | 4 native reviews, authority burned: PR3 `review-c9dee8d0f9b7ef4a` **approved**; PR4 `review-076d16ba6c6ee758` **approved**; PR5 `review-16c7b879f44c6b95` **escalated** (2 findings, corrected) then `review-656da6beeca5d9e9` **approved** on the corrected candidate. |
| Dev-stack E2E | `package_create` OK; `resource_create` multipart of a 52 428 800-byte file through the same-origin proxy → `size=52428800`; dataset purged and temp token revoked. Confirmed `/api/` proxies to `ckan-dev:5000` (not Node) and `BODY_SIZE_LIMIT` is unset. |
| Commits | `1a055b0` (chore gitignore) · `157d6d2` (wizard) · `1dfa399` (dashboard real) · `f327c98` (backlog) · `f0d30f3` (enlaces por URL) |

### Remediation closed during the cycle

- **PR5 escalation (`review-16c7b879f44c6b95`)**: the candidate was escalated with 2 findings — `R3-link-remove-during-submit` and `R3-link-validation-coverage`. Both were corrected on the candidate, which then passed `review-656da6beeca5d9e9` **approved**.
- The prior failing verify scenario **"Link resource instead of a file"** is implemented and covered by a dedicated component test (JSON `resource_create`, no multipart, `http:`/`https:` scheme allowlist rejecting `javascript:`/`data:`, plus a failure/retry path).
- PR2 review findings (`R3-no-timeout`, `R3-nonjson-200`, `R3-slug-boundary`) were absorbed in PR3 with RED→GREEN TDD, as contracted in `design.md`.

### Advisory findings from reviews (non-blocking, no coverage inflation)

- PR3: `R3-001`, `R3-002`, `R3-003` — advisory.
- PR4: `R3-reactive-auth`, `R3-untested-dataset-failure` — advisory.
- PR5 (corrected, closed approved): `R3-link-remove-during-submit`, `R3-link-validation-coverage`.

### Known limitations / pre-existing debt (non-blocking, deferred)

- **Unsanitized output scheme (pre-existing, NOT corrected here)**: `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte:391` renders `href={resource.url}` without sanitizing the scheme. A resource already persisted with a `javascript:` URL remains a vector. The wizard now restricts input to `http:`/`https:`, but output sanitization stays pending.
- **`describeCreateError` over-trigger**: it matches `/already in use|url/i`, so the `url` alternative can mislabel an unrelated error whose message contains "url" as a slug conflict. Low severity.
- **"No horizontal scroll at 360px"** (Form Accessibility scenario 3) verified only by static inspection of responsive classes, not an automated test.
- **DCAT `extras`**: deliberately deferred to the change that adopts a DCAT profile; the spec records the ckanext-dcat evidence and reason.

## Spec Sync (delta → main)

Main spec for domain `dataset-publishing` did not exist. Per archive convention the delta spec is a full spec and was copied verbatim (already in canonical format: `# Dataset Publishing Specification`, `## Purpose`, `## Requirements`):

| Domain | Action | Requirements | Scenarios |
|--------|--------|--------------|-----------|
| `dataset-publishing` | Created | 13 | 35 |

- `openspec/specs/dataset-publishing/spec.md`

No destructive merge was performed (new canonical spec created). No ADDED/MODIFIED/REMOVED requirement operations were needed.

## Archive Contents

Change folder moved to `openspec/changes/archive/2026-09-11-dataset-publishing/` containing:

- `proposal.md` ✅
- `specs/dataset-publishing/spec.md` ✅ (13 requirements / 35 scenarios)
- `design.md` ✅
- `tasks.md` ✅ (37/37 tasks complete, 0 unchecked implementation tasks)
- `apply-progress.md` ✅ (WU1–WU4, commits, TDD evidence)
- `verify-report.md` ✅ (admitted bytes, evidence revision `ea4e4dc6…`)
- `archive-report.md` ✅ (this report)

Active changes directory no longer contains `2026-09-11-dataset-publishing`. The ephemeral `.gentle-ai-instance` marker (gitignored) was removed rather than archived, matching the existing archive convention (no hidden files).

## Notes and Discrepancies

- **Archive-time sync fallback**: `sync-report.md` was absent (native status `dependencies.sync: blocked`, `artifacts.syncReport: missing`). The parent prompt explicitly approved archive-time sync by instructing the canonical spec to be created from the delta spec; the sync was performed at archive time and recorded above.
- **Stale-checkbox reconciliation**: `apply-progress.md` retains historical `- [ ]` lines inside its PR3/PR4 "quedan pendientes" narrative sections (3.9, 4.1–4.5), and `proposal.md` keeps unchecked Success Criteria `- [ ]` lines. Neither is an implementation task: the authoritative `tasks.md` shows all 37 implementation tasks `[x]`, and `verify-report.md` (37/37, 0 unchecked) proves completion. Informational only; does not block archive.
- **Native status vs. terminal facts**: the status engine marked `archive`/`sync` blocked (no `sync-report.md`, `verify: ready`). The terminal facts supplied by the parent — clean verify (13/13, 35/35, 0 blockers, admitted valid), 0 unchecked tasks, and explicit archive-time sync approval — take precedence and are recorded as the final state above.
- **No `openspec/config.yaml`** exists, so no `rules.archive` constraints applied.
- **No commit** was made: the parent owns the commit. The move and canonical spec are left as uncommitted working-tree changes.
- **Destructive merge guard**: not triggered — the canonical spec was new, so no REMOVED/MODIFIED requirements and no approval needed beyond the parent's explicit archive-time sync instruction.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
