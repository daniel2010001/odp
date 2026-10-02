# Explore — Dataset editing and deletion (native CKAN)

**Change:** `2026-10-02-dataset-edit-and-delete` · **Status:** exploration · **Author of the scope:** the
repo owner (2026-10-02) · **Base:** `main` @ `1fa46bc`

## Why this change exists

The portal can **create** datasets and nothing else. Fixing a wrong title, replacing a broken file or
retiring something published today means leaving the portal for CKAN's native UI. That is the gap the
owner chose to close first, ahead of organizations and users/roles, because it is the one that blocks
use of what already exists.

Module order agreed with the owner (2026-10-02): **edit/delete datasets → organizations → users and
roles**, all reachable with CKAN's native action API.

## Scope (decided, not inferred)

**In scope**

- Editing dataset metadata (title, description, summary, tags, license, and the rest of what the wizard
  already collects).
- Editing resources: replace metadata, change the file or link, delete a resource.
- **Soft delete** of a dataset — CKAN's `state = 'deleted'` — for the normal user path.

**Out of scope, declared**

- **Visibility changes** (`private` toggling, `public`/`internal`). The PRD makes visibility changes go
  through a mandatory request flow (RF-15.5), and the repo already carries a parked branch
  (`wip/pr2-directo-publicacion`, `6b53c64`) that exists precisely because the portal once allowed
  bypassing that flow. Doing it here would build something that must be undone.
- **Permanent deletion and any undo/restore.** Owner's decision: *«respecto al deshacer: esto creo que
  es con "purga" de ckan, por ahora eso lo dejamos como una feature aparte y para luego, por ahora solo
  la del lado de los user normales»*.
- Versions, approval states and audit tables (RF-14 to RF-17, RF-33 to RF-36): they need the
  `ckanext-umss` extension and are their own change.

## Measured: what CKAN actually does

Read from CKAN's own source **inside the running container** (`odp-dev-ckan-dev-1`). No credentials were
minted, no dataset was touched, nothing was mutated: the semantics and the permission model are in the
code.

| Question | Answer | Evidence |
|---|---|---|
| Is `package_delete` a logical delete? | **Yes.** Its docstring: *"Delete a dataset (package). This makes the dataset disappear from all web & API views, apart from the trash."* The action then calls `entity.delete()`, which sets `state='deleted'` | `ckan/logic/action/delete.py:71-97` |
| Who may call it? | **Whoever may update the dataset.** `package_delete` **defers to `package_update`**: *"Deletions are essentially changing the state field"* → `has_user_permission_for_group_or_org(owner_org, user, 'update_dataset')` → **an organization editor or admin** | `ckan/logic/auth/delete.py:17-20`; `ckan/logic/auth/update.py:15-24` |
| Who may purge? | **Only a sysadmin.** `dataset_purge` returns `{'success': False}` unconditionally; the sysadmin bypass happens before the auth function | `ckan/logic/auth/delete.py:23-25` |
| `resource_delete` / `resource_update` | They delegate to `package_delete` / `package_update`, so they inherit the same organization permission. **Trap:** the `resource_delete` docstring says *"You must be a sysadmin or the owner of the resource"*, and the code does **not** check that — the code governs | `ckan/logic/action/delete.py:162-193`; `ckan/logic/auth/delete.py:28-42`; `ckan/logic/auth/update.py:72-86` |

### Correction to the PRD (with evidence)

`PRD.md` §7's table lists `deleted_at` (soft-delete) as *"sin equivalente"* in CKAN and concludes that
RF-35 needs an extension. **That is imprecise:** CKAN has the `state` field, `package_delete` is a logical
delete, and the trash is where deleted datasets go; permanent removal is `dataset_purge`, sysadmin-only —
which is exactly what RF-35 asks for (hidden from everyone, permanent only by a superadmin). The PRD's
scope conclusion for RF-35 should be revisited when that requirement is planned; **this change does not
need an extension for deletion.**

### Not measured yet (declared, not assumed)

- The behavioural probe of `package_patch`'s partial-payload semantics (read from code and docstrings
  only).
- What happens to the **FileStore bytes** when a resource is deleted.
- The exact CKAN response (status and message) when an unauthorized user attempts a delete — the auth
  code was read, not exercised.

## Measured: what the portal already has

| Piece | State | Evidence |
|---|---|---|
| `search`, `tagSuggestions`, `show`, `create`, `byOrganization`, `currentUser` | **Used** | `src/routes/**` call sites |
| `resources.show`, `resources.create` | **Used** | `src/routes/dashboard/datasets/new/+page.svelte:615`, `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte:110` |
| `datasets.update` (`package_update`), `datasets.delete` (`package_delete`), `datasets.setState` (`package_patch` with `state`) | **Defined and unused** | `src/lib/api/datasets.ts:64`, `:69`, `:117` |
| `resources.update` (`resource_update`), `resources.delete` (`resource_delete`) | **Defined and unused** | `src/lib/api/resources.ts:29`, `:34` |
| Tests for those unused wrappers | **None.** `datasets.test.ts` has **zero** references to `update`, `delete`, `setState` or the action names, and there is **no `resources.test.ts` at all** | `src/lib/api/*.test.ts` listing; grep counts 0 |
| Edit/delete routes or UI | **None** | there is no route beyond `new/` and the dashboard |
| Honest handling of a dataset that is gone or forbidden | **Already exists** (403/404 mapping, session probe) | `src/routes/dataset/[id]/+page.svelte:98-120`; `src/lib/api/failure.ts` |

**The consequence that sizes this change: the write plumbing exists but has never run.** Dead, untested
wrappers are not a foundation — they are a hypothesis. Either they are verified against the live stack and
kept, or they are replaced. This is work the change must own, not assume.

The wizard (`src/routes/dashboard/datasets/new/+page.svelte`, **1747 lines**) is create-only by
construction: its submit path builds a payload, calls `datasetApi.create`, then uploads resources. It does
contain a resource "editing" state for the in-draft list (`editandoKey`), but nothing that edits a stored
dataset.

## Decisions handed over / taken

| Decision | Who | Value |
|---|---|---|
| Who may delete a dataset | **Owner, following CKAN** ("el PRD no indica exactamente quién puede borrar… sigamos lo de ckan") | Organization **editor or admin** (CKAN's `update_dataset`) |
| Soft vs permanent delete | Owner (following CKAN + RF-35) | **Soft** (`state='deleted'`); purge is a separate, later feature |
| Undo / restore UI | Owner | **Out of scope** — its own later feature |
| Visibility changes | Owner (earlier, and the parked branch) | **Out of scope** |

## Risks and open questions

1. **Unverified plumbing** (above). It must be tested against the live stack or replaced, and the tests
   must assert the real contract rather than the mock's shape — the family the repo already recorded:
   *a double that does not copy the real shape blesses instead of verifying*.
2. **Buttons that CKAN will reject.** The portal must fail closed: ask the real question (org role /
   `user_show`, the same pattern as the dashboard's `puedeCrear`) instead of rendering an edit or delete
   affordance that cannot succeed.
3. **What the reader sees after a soft delete**: the dataset disappears from CKAN's views, so the page
   falls into the 403/404 path that already exists. Confirm the copy is honest there (it is the same
   family as slice C).
4. **The wizard as the edit form.** Options: one page with a create/edit mode, an extracted shared form
   component, or a sibling page. Each costs different reviewable lines, and the wizard is 1747 lines
   already. To be decided in `design.md` with its measured cost, not here.
5. **Resource editing vs. the draft list.** Editing a stored resource is not the same as editing an entry
   in the creation draft; reusing the mini-form naively would blur the two.

## Forecast seed for `tasks.md` (to be measured, not guessed)

Per `openspec/config.yaml`, the forecast must declare `code_lines`, `test_lines` and
`review_material_lines` separately, and the **budget gate goes before apply**. A first honest seed:

- `code_lines`: ~400–700. Mostly a page with a lot of markup (`markup_heavy_page` ratio 0.38) plus form
  logic (which behaves like `dense_component`, 1.69).
- `test_lines`: derived, not invented — if the change is mostly markup, `0.38 × code` ≈ 150–270; if a
  shared form component with real logic is extracted, the dense ratio applies to that part and the total
  grows.
- `review_material_lines`: a `/dev` sheet for the edit/delete affordances (rule 8 of `AGENTS.md`), which
  is expected here and does not compete with the budget.

**Expected to exceed the 400-line review budget**, so slicing will be proposed in the proposal: the
likely cut is *metadata editing* / *resource editing* / *soft delete*, each a reviewable unit.

## Next step

`proposal.md` — the problem statement, the slices with their forecast, and the acceptance criteria that
`specs/dataset-editing/spec.md` will carry.
