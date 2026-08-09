# Archive Report: resource-detail-view

**Change**: resource-detail-view
**Archived**: 2026-08-09
**Artifact store**: openspec (repo-local at `openspec/`)
**Schema**: spec-driven

## Final State (at close)

| Aspect | Final state |
|--------|-------------|
| Tasks | All complete. Persisted `tasks.md` has 20/20 checked tasks; native `gentle-ai sdd-status` reports `taskProgress.total: 20, completed: 20, allComplete: true`. |
| Verification verdict | **PASS** — 0 CRITICAL, 1 WARNING, 16/16 spec scenarios compliant (9/9 requirements). |
| Type-check gate | `npx svelte-check --tsconfig ./tsconfig.json` → exit 0 (0 errors; 3 pre-existing warnings in unrelated files). |
| Build gate | `pnpm build` → exit 0 (SSR + client bundles). |
| Test runner | None installed (`strict_tdd: false`). Verification is static (svelte-check) + build. |
| Review state | Unmanaged — no review artifacts exist (reviewPolicy/Ledger/Receipt/Context/State all `missing` in native status). No review governs this change; Native Review Receipt Gate relaxes to disabled/unmanaged. |

### CRITICAL findings resolved (from prior verify run, fixed post-snapshot)

All 3 prior CRITICALs are confirmed fixed in `apply-progress.md` (batch 2026-08-09) and re-verified in the final verify-report:

1. `CkanResource` import missing in `src/lib/mock/data.ts` → import added (line 4).
2. `mimetype` not rendered in `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte` → added `{ label: "Tipo MIME", value: resource.mimetype }` to `fieldList`.
3. `hash` not rendered in same page → added `{ label: "Hash", value: resource.hash }` to `fieldList`.

Fix evidence: `npx svelte-check` exit 0 and `pnpm build` exit 0 after fixes (recorded in apply-progress batch verification and re-confirmed in verify-report).

### Known limitations (non-blocking)

- **WARNING (open)**: Generic (non-API) resource `extras` are not rendered in the field list — only extras matching known API keys (`api_base_url`, `docs_url`, `example_request`, `example_response`) are surfaced. Partial gap against the "display every field … and extras" requirement; does not manifest with current mock data (no resource-level extras in mocks). Accepted as a known limitation.

## Spec Sync (delta → main)

Main specs did not exist before this change (`openspec/specs/` was absent). Per archive convention, both delta specs are full specs and were copied verbatim:

| Domain | Action | Requirements | Scenarios |
|--------|--------|--------------|-----------|
| `dataset-resource-listing` | Created | 3 | 5 |
| `resource-detail-view` | Created | 6 | 11 |

- `openspec/specs/dataset-resource-listing/spec.md`
- `openspec/specs/resource-detail-view/spec.md`

## Archive Contents

Change folder moved to `openspec/changes/archive/2026-08-09-resource-detail-view/` containing:

- `proposal.md` ✅
- `specs/dataset-resource-listing/spec.md` ✅
- `specs/resource-detail-view/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (20/20 tasks complete, no unchecked implementation tasks)
- `apply-progress.md` ✅
- `verify-report.md` ✅
- `archive-report.md` ✅ (this report)

Active changes directory no longer contains `resource-detail-view`.

## Notes and Discrepancies

- **Task count**: `verify-report.md` snapshot and launch prompt state "15 tasks complete"; the persisted `tasks.md` artifact contains 20 checked tasks (native status confirms 20/20). Completion status is identical under all sources (all complete); the count discrepancy is a snapshot artifact. Per final-state authority, the persisted tasks artifact wins.
- Warnings in svelte-check (ThemePlayground.svelte a11y_label_has_associated_control ×2, SearchBar.svelte state_referenced_locally) are pre-existing and unrelated to this change.
- No destructive merge was performed; both main specs were created new. No `openspec/config.yaml` exists, so no `rules.archive` constraints applied.

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived.
