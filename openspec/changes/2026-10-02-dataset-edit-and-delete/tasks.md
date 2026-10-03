# Tasks — Dataset editing and deletion

Slices are applied in order; each is its own work unit with its own commit range and its own native
review gate. Per `openspec/config.yaml`, the **budget gate runs before apply**, with the forecast
declared in three separate lines and the repo's measured test:code ratios
(`markup_heavy_page: 0.38`, `dense_component: 1.69`).

## Slice 1a — extract the form (a move, not a behaviour change)

The riskiest step, and the one that must land alone: moving the form out of a 1747-line page while the
creation path keeps behaving exactly as it does today.

- [ ] **1a.1** Create `src/lib/components/datasets/DatasetForm.svelte` with the field markup, the
      validation wiring, the field-error map and the resource list moved from the wizard, taking
      `mode: "create" | "edit"`, `initial`, the organization and license data, and callbacks for submit
      and cancel.
- [ ] **1a.2** The wizard renders it in `mode="create"` and keeps everything that is not the form:
      session probe, organization loading, submit orchestration, upload with progress, navigation.
- [ ] **1a.3** Evidence, in this order:
  - the wizard's existing tests pass **untouched** (no assertion edited to fit the move);
  - `pnpm check` and Biome on baseline;
  - the commit body **lists which lines moved**, so a reviewer is not made to read moved lines as
    authored ones;
  - a real creation of a throwaway dataset, purged afterwards, with a token minted and revoked inside
    the container and **no `.env` file read** (the parent runs it if the writer cannot).

**Forecast:** `code_lines` = the moved lines + ~40 new (props, types, the mode branch);
`test_lines` = **0 new**; `review_material_lines` = 0 (the sheet is already reviewed).

**Declared deviation from `strict_tdd`:** a pure move has no RED to observe — there is no new behaviour
to fail first. The honest evidence is the existing suite passing unchanged plus the live creation run.
This is written down rather than silently skipped, and it applies **only** to 1a.

## Slice 1b — the edit route

- [ ] **1b.1** `/dashboard/datasets/[id]/edit`: loads the dataset, seeds the form in `mode="edit"`, and
      saves.
- [ ] **1b.2** The mode-aware payload: `buildPackagePayload(input, "create")` unchanged;
      the edit path sends only the fields the form owns — scalars through `package_patch`, anything
      inside a list (`extras`, `resources`) through `package_revise`. Tests first: the create payload is
      byte-identical to today, the edit payload carries no key the form does not own, and an unmanaged
      extra survives an edit of the summary.
- [ ] **1b.3** The **fail-closed** permission question (`update_dataset` on the owning organization,
      three states: may, may not, could not be asked) and the entry points — the dashboard row and the
      dataset page. Verify `ckan.auth.allow_dataset_collaborators` in this stack and either handle the
      collaborator path or record the declared limitation.
- [ ] **1b.4** Concurrency: the save asserts the state the form was built from and, when the dataset
      changed, aborts with the visible conflict notice. No locking, no multi-editor presence.
- [ ] **1b.5** The organization is a fact, never written.

- [ ] **1b.6** Build the `LoadedDataset` the payload builder takes **with an explicit check**: if the loaded
      package does not return `extras` as an array, refuse with an honest message instead of substituting `[]`.
      An absent list would read an existing summary as missing and **append a duplicate**; that is why the type
      is required, and the caller is what makes the case impossible. (Advisory `R3-001` of
      `review-5b851d86ae1bc07c`, recorded and not chased: the builder's failure is loud, which is the direction
      this project prefers, and a runtime guard belongs here if this check ever stops existing.)

**Forecast:** `code_lines` ≈ 200–250; `test_lines` ≈ 150–200 (`markup_heavy_page` for the route,
`dense_component` for the payload rules and the permission decision); `review_material_lines` = 0.

## Slice 2 — resource editing, including file replacement (option A)

- [ ] **2.1** Edit a resource's metadata with `resource_patch`/`resource_update`, one resource at a time.
- [ ] **2.2** Replace a file: SHA-256 computed **in the browser** (WebCrypto) and sent as `hash`; a
      **required reason** when the bytes change; identical bytes refused with an explicit message.
- [ ] **2.3** A resource with no recorded hash says so, and never implies the file never changed.
- [ ] **2.4** Tests first for the hash comparison and the reason gate; a live replacement against the
      stack, with the raw responses recorded (the wrapper has never run — a mock would bless it).

**Forecast:** `code_lines` ≈ 150; `test_lines` ≈ 200 (`dense_component`: digest and validation logic);
`review_material_lines` = the sheet's replacement flow, already reviewed.

## Slice 3 — logical delete

- [ ] **3.1** The affordance and the confirmation with its three truths (leaves the portal and the
      catalogue; no undo here; the slug stays taken, named in its own block).
- [ ] **3.2** `package_delete` — the existing wrapper either verified against the stack or rewritten with
      its test.
- [ ] **3.3** **The slug probe before the copy is frozen**: create → delete → recreate the same name
      against the live stack, and record CKAN's real error. The copy may not promise unmeasured
      behaviour.
- [ ] **3.4** After deleting: the dashboard list refreshes and the dataset's page shows the portal's
      honest not-found state.
- [ ] **3.5** Evaluate CKAN's `package_activity_list` as the dataset's interim history (the audit-lite
      the design records).

**Forecast:** `code_lines` ≈ 120; `test_lines` ≈ 90 (`markup_heavy_page`); `review_material_lines` = the
sheet's confirmation, already reviewed.

## Gate, per slice

Before applying a slice, compare its forecast against the 400-line review budget. If a slice exceeds it,
**split it** — the whole point of slicing is that each gate covers something a reviewer can hold in their
head. No exception is requested with the work already done.

## Slice 1a is next

Everything else waits until the extraction lands green and its gate closes.
