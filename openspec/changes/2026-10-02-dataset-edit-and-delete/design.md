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

## 2. The payload: partial, and nested values are never replaced

Measured in CKAN's source: `package_patch` merges **the top level only** and leaves everything else alone,
while `package_update` *"deletes all parameters not explicitly provided"*. A portal that saves an edit
with the same full payload it uses for creation would destroy anything the portal does not know about
(extras written by CKAN plugins, DCAT extras, and anything added from CKAN's own UI).

**Correction found by the `/dev/dataset-edit` sheet, and it invalidates the first version of this
section.** "Patch merges the top level" is not enough, because **`extras` and `resources` *are* top-level
keys, and they are lists**: a patch that carries `extras` **replaces the whole list**. That matters here
because the portal's own `summary` lives in `extras` (RF-40, `SUMMARY_EXTRA_KEY`), so editing the summary
with a naive patch would drop every extra the portal does not manage (`frequency`, `language`, `spatial`,
…). The first draft of this design promised those fields would survive; the promise was wrong.

The corrected rule:

- **Top-level scalars** (title, notes, url, maintainer, license, tags): `package_patch` is correct and
  cheap. It leaves unlisted keys alone.
- **Anything inside a list — `extras` today, `resources` always — goes through `package_revise`**, which
  CKAN recommends for exactly this (*"To partially update resources or other metadata not at the top level
  of a package use `package_revise`"*). It updates nested values with flattened keys
  (`update__extras__<index>__value`, `update__resources__<id>__description`, `…__extend` to append), so the
  fields it is not asked to touch are not touched **by construction** instead of by client-side merging.
- **`package_revise` also gives compare-and-set:** its `match` argument aborts with a `ValidationError`
  unless the current values match what the caller expected (*"all values provided must match the current
  dataset values or a ValidationError will be raised"*). That is the honest answer to the two-tabs race
  that made "read, merge, write" unsafe — and it is an **open decision for the owner** (below).
- `src/lib/utils/dataset-payload.ts` grows a **mode-aware** shape: `"create"` keeps the full payload it
  sends today, untouched; the edit path produces only the fields the form owns, routed to the action that
  matches their shape: `patch` for scalars, `revise` for anything nested.
- Tests: the create payload is byte-for-byte what it is today; the edit payload contains no key the form
  does not own; and **an unmanaged extra survives an edit of the summary** (the scenario the sheet forced
  into the spec).
- **Resources never travel inside a package-level write.** Their list would be replaced wholesale. Each
  resource is written individually (`resource_patch`, `resource_update`, or `package_revise` when several
  must change together).

### Open decision this correction creates

When the dataset changed between loading the form and saving it, should the portal **abort and tell the
user** (`match` semantics — nothing is lost, one retry) or **last write wins** (no extra work, and a
concurrent edit can be silently overwritten)? `match` costs almost nothing here and turns a silent loss
into a visible conflict; that is the recommendation, and it is the owner's call because it is a user-facing
behaviour.

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
