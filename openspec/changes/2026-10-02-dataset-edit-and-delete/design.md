# Design — Dataset editing and deletion

**Change:** `2026-10-02-dataset-edit-and-delete` · **Status:** design · **Proposal:** `proposal.md`
**Base:** `main` @ `c9e477d` · **Budget gate:** before apply, per slice

## 1. The form: one component with a mode

### Options and their real cost

| Option | What it costs | What it leaves behind |
|---|---|---|
| **A. Extract `DatasetForm` with `mode: "create" \| "edit"`** (chosen) | One refactor of a working path: ~450 lines move, ~250 are new. The creation flow's tests are the safety net | One form, one validation, one resource list. The creation page becomes an orchestrator |
| B. A sibling edit page that duplicates the layout and imports the field controls | Cheaper *today*, and it does not touch the creation flow at all | Two layouts to keep in sync, two places where the payload shape lives, and the "same fields" promise decays |
| C. One page handling both modes | No new route | A page that is already 1747 lines would grow and keep both lifelines tangled |

**Why A despite the regression risk:** the repo already recorded the decision it depends on
(`BACKLOG.md:1151`: the form must *be* a component with a mode, and it must be decided *before* the
creation UI is frozen). Option B is the tempting shortcut that leaves the portal with two forms that
drift — and drift is exactly what the item warns about. The risk is real and is bounded by moving the
markup **without** rewriting behaviour: the creation path must pass unchanged (its tests, plus a live
creation run before the slice closes).

### The extraction, step by step (so the diff stays reviewable)

1. Move the field markup, the validation wiring, the field-error map and the resource list into
   `src/lib/components/datasets/DatasetForm.svelte`, with props: `mode`, `initial` (a dataset for edit),
   `organizations`, `licenses`, and callbacks `onsubmit` / `oncancel`.
2. The page keeps what is NOT the form: session probe, organization loading, submit orchestration,
   navigation, and the `/dev`-visible state.
3. **No behaviour change in this step.** The creation route renders the component in `mode="create"` and
   must produce the identical payload. Evidence: the existing wizard tests pass untouched, plus a live
   creation of a throwaway dataset, purged afterwards.
4. Only then the edit route appears, in `mode="edit"`.

**Review note (declared in the commit body):** step 1 inflates the diff with *moved* lines. The reviewer
must be told, and the slice's commit body says which lines moved and how to check it
(`git diff -w`, and the tests that must stay green without edits).

## 2. The payload: patch, never replace

Measured in CKAN's source: `package_patch` merges the top level and leaves everything else alone,
while `package_update` *"deletes all parameters not explicitly provided"*. A portal that saves an edit
with the same full payload it uses for creation would destroy anything the portal does not know about
(extras written by CKAN plugins, DCAT extras, and anything added from CKAN's own UI).

Design consequences, all testable:

- `src/lib/utils/dataset-payload.ts` grows a **mode-aware** shape: `buildPackagePayload(input, "create")`
  returns the full dict (as today); the `"edit"` path returns **only the fields the form owns** and
  hands it to `datasetApi.patch` (a new wrapper on `package_patch`).
- A test asserts the edit payload **does not contain** keys the form does not own, and that the create
  payload is byte-for-byte what it is today (the two shapes are deliberately different).
- **Resources never travel inside a package patch.** Their list would be replaced wholesale. Each
  resource is written with `resource_patch` (metadata) or `resource_update` (file), one at a time.

## 3. Who sees the affordance: fail closed, and the portal does not guess

The dashboard already asks CKAN a real question before offering its create action
(`organization_list_for_user(permission="create_dataset")`, fail closed). The edit/delete affordances
follow the same rule with `permission="update_dataset"`: the portal computes, per dataset, whether the
caller's role in `owner_org` allows `update_dataset`, and only then renders the actions. No affordance
is rendered that CKAN would reject, and the portal never treats "the button was hidden" as the security
boundary — CKAN is.

Out of scope here: the CKAN-native *collaborator* case (`ckan.auth.allow_dataset_collaborators`), which
would grant edit rights outside the organization. If that flag is on, a collaborator would see no
affordance even though CKAN would allow the edit: **declared as a known limitation**, to be checked
before the slice closes (and the probe says whether the flag is on in this stack).

## 4. Soft delete

- Action: `package_delete` (logical; `state='deleted'`). The existing `datasets.delete` wrapper is one
  of the never-run wrappers, so it is either verified against the stack or rewritten with its test.
- **The copy states the truth**, and the truth here has three parts: the dataset leaves the portal and
  the catalogue; **the portal offers no undo** (permanence is a sysadmin operation in CKAN, and it is a
  separate later feature); and **the slug stays taken** — `package_name_key` is unique on `name` alone,
  so recreating with the same name fails.
- **Probe before the copy is written** (slice 3, first task): create → delete → recreate the same name
  against the live stack, and record the real CKAN error. The copy may not promise behaviour we have not
  measured.
- After deleting: the dashboard list refreshes, and the dataset's page falls into the honest 403/404
  path that already exists.

## 5. Replacing a resource's file (option A)

- The portal computes **SHA-256 in the browser** (`crypto.subtle.digest`) and sends it as `hash`.
  CKAN stores the column and does not compute it, so an unsent hash means no change detection at all.
- `resource_update` with the new file replaces the bytes and CKAN refreshes `mimetype`/`size`.
- The reason is **required** when the hash changes (the same discipline RF-42 imposes on direct
  degradations) and is refused otherwise: replacing a file with the identical bytes is a no-op, and the
  UI says so instead of writing a pointless change.
- **Size guard, honest:** the file passes through memory to be hashed. Declared threshold and behaviour
  (hash it, or skip the hash and say so) to be decided with the owner in the `/dev` sheet, not silently.
- Resources created before this change have no hash; the UI says "sin hash registrado" rather than
  implying the file never changed.

## 6. Audit: what this change does and does not do

- Every mutating path carries an **actor** (from the session) and a **reason** where the PRD requires
  one (file replacement now; degradations later).
- The `audit_logs` table (RF-33/34) stays out: it is the extension's own change.
- Interim trail: CKAN's own activity (`package_activity_list`) already records who changed what and
  when. Slice 3 evaluates showing it as the dataset's history — cheap, native, and the UI that a real
  audit module would later feed.

## 7. Testing strategy

- **Unit/component:** Vitest + Testing Library, with the API mocks. The two shapes of the payload and
  the mode-aware form are the primary unit-level guards.
- **The never-run wrappers are the exception:** a mock would bless whatever shape the wrapper happens to
  send. So each wrapper this change starts using gets a **live check against the dev stack** as part of
  its slice (create a throwaway dataset, edit it, delete it, purge it), with the raw responses recorded
  in the slice's evidence. *A double that does not copy the real shape blesses instead of verifying* —
  the repo already paid for that lesson once.
- **The `/dev` sheet** (rule 8): the form in edit mode, the delete affordance and its confirmation, and
  the file-replacement flow, reviewed by the owner before anything is promoted.

## 8. Slices and the budget gate

Per `openspec/config.yaml`, the forecast is checked **before** apply. The proposal's forecast stands:
slice 1 (extraction + edit route) is the one at risk of crossing 400 reviewable lines on its own, and
if the extraction plus the route exceeds it, slice 1 splits into **1a (extraction, no behaviour change)**
and **1b (the edit route)** — two gates, two commits, same design.

## Open questions carried into the tasks

1. Is `ckan.auth.allow_dataset_collaborators` on in this stack? (Decides whether the fail-closed rule
   needs the collaborator path or a declared limitation.)
2. The real CKAN error when recreating a deleted dataset's slug (probe, slice 3).
3. The hash threshold behaviour for large files (owner, in the `/dev` sheet).
