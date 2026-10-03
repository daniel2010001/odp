# Apply progress — dataset edit and delete

Record kept per slice: what landed, the evidence behind it, the receipt, and what the receipt's
advisories produced.

## Slice 1a — extract the form (a move, not a behaviour change)

**Commit:** `d6c693c` · **Receipt:** `review-ff8d537a39fa1a81` — **approved**, tier medium, one lens
(`review-reliability`), 3 files / **2966 changed lines**, **0 blocking findings, 1 advisory**.

### What landed

`src/lib/components/datasets/DatasetForm.svelte` (1486 lines) holds the field markup, the validation
wiring, the field-error map, the resource mini-form and list, the summary panel and the submit guard,
and takes `mode`, `initial`, the organization and license data and callbacks. The wizard page went from
**1747 to 369 lines** and keeps what is not the form: the session probe, organization and license
loading, resource upload execution, package creation and navigation. Net repo delta ≈ **108 lines** of
glue; the diff is overwhelmingly moved lines, and the commit body says so for the reviewer.

### Evidence

| Check | Result |
|---|---|
| Wizard tests | **30/30**, with the test file **byte-identical** |
| Full suite | **709/709** |
| `pnpm check` | 0 errors / 4 preexisting warnings |
| Biome | exit 0 |
| Live creation against CKAN | throwaway dataset created with the payload shape the form builds (title, notes, owning org, private, license, tags, `summary` as an extra) **plus a resource**; read back with both; purged; database count verified back to baseline (21 → 20) |
| Credentials | temporary token minted and revoked **inside the container**, never from a `.env` file; revocation proved by behaviour (0 tokens left in the list, the token's requests now answer 404) |
| Anti-drift anchor | `layout-header.test.ts` moved to the panel's new home **and extended** — the component is now also asserted not to drift back to a literal offset — instead of deleting the assertion |

### Declared deviation from `strict_tdd`

A pure move has no RED to observe: there is no new behaviour to fail first. `tasks.md` 1a declares this
and it applies only to this slice.

### The advisory, and why it was not chased

`R3-001` (WARNING): the new component concentrates submit validation and callback wiring, and this
candidate adds no test that mounts it directly, so its behaviour is proved only through the wizard's page
tests.

**Assessed and recorded, not chased.** The behaviour *is* exercised — the component renders inside the
wizard, and its 30 tests cover validation, resource add/edit, submit/cancel/retry, and pass untouched —
and the real path was proved end-to-end against CKAN. What the advisory points at is the component's
**own contract** (props, callbacks, mode), and that contract is exactly what slice 1b must pin: its spec
requires tests for the edit-mode payload and validation. If 1b's tests do not naturally cover the
component's contract, this becomes a task there rather than a footnote. The failure mode here would be a
loud one (the page tests would break), not a silent false green — which is the distinction this project
uses to decide what to chase.

### Also measured while verifying (worth keeping)

Two CKAN behaviours that cost time and will cost it again if forgotten:

- `ckan user token add` **ignores `--json`** in this version and prints `API Token created:` plus the
  token, with the CLI's `INFO` logs mixed into **stdout**; parsing the output as JSON fails.
- **`api_token_revoke` can return `{"success": true}` without revoking anything.** The token stayed
  alive and listed. The CLI (`ckan user token revoke <jti>`) is what actually revoked it, verified by
  effect: gone from the list, and its requests now answer 404.

## Slice 1b-A — the partial edit payload and the revise wrapper

**Commits:** `2a7cc51` (the unit) + `67f6998` (the hardening its receipt asked for) · **Receipts:**
`review-4542f91dce1819a4` (4 files / 402 lines) and `review-5b851d86ae1bc07c` (2 files / 47 lines), both
**approved**, 0 blocking findings each.

### What landed

`buildRevisePayload` produces CKAN's `package_revise` arguments for an edit: `match` carries the `id` and the
`metadata_modified` the form was loaded with — the compare-and-set precondition behind the conflict notice —
and `update` carries only the fields the form owns. The summary (RF-40) lives inside `extras`, which is a
**list**, so it is written with a flattened key against the loaded index instead of the array (which would
replace the list and drop every extra the portal does not own). `datasetApi.revise` wraps the action. The
creation payload is untouched and pinned byte-for-byte by a regression test.

**Clearing is explicit**: every owned optional is written, `""` included, because omitting a key in
`package_revise` means "leave the current value" — a save that ignored an erasure would lie about what it
did. The creation path keeps omitting empties and its test keeps that promise. Tests first: 12 failures
captured before the implementation. Suite: **728/728**.

### The two advisories, and what each produced

- `R3-1` of `review-4542f91dce1819a4` (WARNING): `LoadedDataset.extras` was optional, so a caller could omit
the loaded list, and a non-empty summary would then be **appended as a duplicate** instead of updated — a
silent corruption guarded only by caller discipline, in a type whose caller was about to be written.
**Fixed, not recorded** (`67f6998`): `extras` is now **required**, so the mistake is a compile error, and the
four test fixtures that omitted the list now say `extras: []` explicitly. The rule used here: a failure mode
that corrupts silently gets fixed; one that is merely loud gets recorded.
- `R3-001` of `review-5b851d86ae1bc07c` (WARNING): the same change turned "omitted list" from a silent
duplicate into a `TypeError`, and types are erased, so an untyped caller would crash instead of degrade.
**Recorded, not chased** — between a silent corruption and a loud crash, the loud one is the direction this
project prefers — and carried into **1b.6** as the caller's job: build the `LoadedDataset` with an explicit
check and refuse honestly when the package does not return the extras, instead of substituting `[]`. A
runtime guard goes in if that check ever stops existing.

## Slice 1b-B0 — the form's edit mode, and the component's own contract test

**Commits:** `c69a91d` (the unit) + `f74a51a` (the fix its receipt asked for) · **Receipts:**
`review-9ce0dea883d3ddb9` (2 files / 376 lines, approved, 1 advisory → fixed) and `review-ab686f565730b0f9`
(2 files / 33 lines, approved, **0 findings**).

### What landed

With `mode="edit"` the form pre-fills once from the loaded dataset (deliberately with `untrack`, so the
capture is a one-time read instead of a reactive dependency), shows the slug as a fixed value behind an
explicit unlock — because changing it breaks every existing link — shows the owning organization as a
**fact**, and submits «Guardar cambios». Create mode is behaviourally untouched: the wizard's test file
stayed **byte-identical** with its 30 tests green, which is the evidence that matters for the creation path.

This slice also **closes the advisory that slice 1a left behind**: the extracted component concentrated
validation and callbacks with no test mounting it directly, and it now has its own contract test file
(ten tests: pre-fill, the slug lock and unlock, the organization as a fact, the mode-dependent action copy,
the validated hand-off, the invalid case, and that the form never calls the API — it imports no client and
never fetches, which is what keeps the two modes from drifting apart).

### The advisory, and what it produced

`R3-001` of `review-9ce0dea883d3ddb9` (WARNING, `behavior-activated`): in edit mode `orgDisplayTitle` still
preferred the caller's single organization without checking that it was the dataset's owner, so a one-item
list holding a **different** organization would have shown an organization the save was not going to use.
**Fixed, not recorded** (`f74a51a`): in edit mode the fact is resolved directly against the loaded
`owner_org`, and the one-item heuristic stays in create mode, where there is no fact yet. A test pins it:
with a one-item list that is not the owner, the box shows the owner and the other organization appears
nowhere. Same family as the clearing rule — the UI may not show something the write will not do.

### Two flags from the worker, carried into the tasks

- **1b.7**: the route must pass `initial.owner_org` **and** the organization object, or the fact box falls
  back to the slug and `owner_org` validation fails against a control that no longer exists.
- **1b.8**: the approved sheet's **edit-specific resource list** is not implemented — the resource section
  is still create-shaped — and that belongs to slice 2 with resource editing. Declared rather than
  improvised outside the slice, and the edit mode must not offer resource creation as if publishing anew.

## Slice 1b-B1 — the edit route, and the measurement that changed the design

Eight work units, eight receipts, all approved with their authority burned. The commit that matters most is
none of the ones that added a feature: it is the one that corrected the write shape after a live CKAN said the
designed one did nothing.

| unit | commits | receipt | outcome |
|---|---|---|---|
| **WU-1** — the loaded-dataset guard (1b.6) | `e502fce` + `0bdcf36` | `review-6b517157db5f4274` → `review-3a7f68d873c12deb` | approved, burned — **1 CRITICAL found and corrected**, 2 advisories |
| **WU-2a** — the conflict predicate and the raw error payload | `fbd2ff9` | `review-e8f0ee94a4727eee` | approved, burned — 1 advisory |
| **WU-2** — the fail-closed permission question (1b.3) | `a5b3c6f` | `review-c3ce326617625939` | approved, burned — **0 findings** |
| **WU-3** — the route (1b.1/1b.4/1b.5/1b.7/1b.8) | `7d0209d` | `review-36abfa3fd7da4de0` | approved, burned — 2 WARNINGs |
| **WU-4** — the route's first two warnings | `3c620db` | `review-bae55e6ce9710e3c` | approved, burned — 1 WARNING |
| **WU-5** — the loads sequenced | `78f507d` | `review-567820789e233375` | approved, burned — 2 WARNINGs |
| **WU-6** — the write shape, corrected | `3574c1b` → `67c53a3` | `review-4e40a5f6909e67d5` | approved, burned — 1 WARNING |
| **WU-7** — the route's load flags | `75ddf04` | `review-dfab596fdb93734a` | approved, burned — 1 WARNING + 1 SUGGESTION |

The artifacts were corrected against the measurements in `ec3d2e1`, `7f64d2e` and `8918583`. I first left
them **ungated**, invoking the entry rule's exemption for passive documentation; that was a shortcut, not this
repo's practice -- its own closing recipe records that a documentation commit **does** get a gate, and that the
gate approves it cheaply. The range was gated as `review-13403b98e062aa50` (approved, burned). Two things worth
keeping from it: the documentation commits are **interleaved** with code commits, so no committed range isolates
them -- the candidate necessarily included WU-7's already-gated code; and the gate returned **the same advisory
WU-7's had, at the same location**, which is what re-reviewing approved content buys.

### The measurement that changed the design

Three live probes against CKAN **2.12.0** settled what no mock could, and the third one invalidated the
mechanism this change had been designed around.

1. **The permission premise holds.** `organization_list_for_user(permission="update_dataset")` is valid and
discriminating: an org editor gets the organization, a member does not, a nonsense permission returns `[]`.
`get_roles_with_permission('update_dataset')` resolves to `['admin','editor']`. Two quirks are recorded in
the code: a sysadmin's token makes CKAN ignore the `permission` argument entirely, and an unknown permission
returns `[]` with HTTP 200 — so a typo would fail **closed and silently**, which is why a test pins the
literal.
2. **The conflict predicate is `error.match`, not the status.** A stale `match` answers 409 with
`{"match":["metadata_modified"], "__type":"Validation Error"}` — and an ordinary schema error answers the
**same 409 with the same `__type`**. They are distinguishable only by the key. A failed `match` is a true
no-op (nothing stored, `metadata_modified` unmoved), so the reader's draft survives a conflict.
3. **The write shape was a silent no-op.** `update__extras__<i>__value` **inside** `update` returns HTTP 200
with `"success": true`, stores nothing, and is not even echoed: CKAN reads flattened `update__*` keys at the
**request top level**. The portal said it saved and the summary never changed. The same key at the top level
works — but a wrong index corrupts a *different* extra in silence, and CKAN reorders `extras` on writes, so a
position is not an address. `update.extras = [list]` merges by index instead of replacing, and `tag_string`
is additive, so `""` never cleared the tags.

**The shape that works** is `filter: ["-extras","-tags"]` plus every loaded extra carried back verbatim with
the portal's summary resolved in place, and `tags` exactly as the form holds them. Three consequences are now
design rules: there is **no safe partial merge** (list order is not stable, so to leave an entry alone the
write must carry it back); the loaded list is therefore **load-bearing** — substituting `[]` would **delete**
every unmanaged extra, which is why `toLoadedDataset` refuses a package whose `extras` is not an array; and the
`match` precondition is what makes the wholesale rewrite safe, because a change that landed between load and
save is refused rather than lost.

The rule for empties belongs to the caller: `DatasetForm` encodes "the reader left it empty" as `undefined`,
so absent means clear for the summary and the tags. The safety argument is what the reader sees — the form
shows exactly what the write will do.

### The advisories, each with its task

Eight, all non-blocking, none chased with the work already done:

- **WU-1 R3-001** (`dataset-payload.ts:185`): the thrown guard's reason lives only inside the message, so a
  caller must string-match it. The route uses the structured path, so no caller does. *Task: give the error a
  typed `reason` if a caller ever catches it.*
- **WU-1 R3-002** (`dataset-payload.ts:153`, **pre-existing**): the guard validates the container but not the
  elements of `extras`; a `null` element dies with a raw `TypeError`. Measurement says CKAN always returns a
  well-formed list, so it is not reachable through the API. *Task: validate the element, or record the limit.*
- **WU-2a R3-001** (`datasets.ts:176`): the `Array.isArray(payload.match)` guard has no test. *Task: add the
  case when that file is next touched.*
- **WU-3 R3-001** (`+page.svelte`): the route loaded once from `onMount` and never reacted to the id. **Fixed
  in WU-4.** *WU-3 R3-002*: a cosmetic tag call could leave the page loading for ever. **Fixed in WU-4.**
- **WU-4 R3-001**: the reactive reload made an overlap reachable, so a stale response could rebind the form to
  the previous dataset. **Fixed in WU-5.**
- **WU-5 R3-001** (`+page.svelte:191`): the conditional `finally` could leave `licensesLoading` true for ever.
  **Fixed in WU-7.** *WU-5 R3-002*: the later load stages have no overlap test. **Covered in WU-7.**
- **WU-7 R3-1** (`edit.test.ts:355`) and **R3-2** (`+page.svelte:119-122`): both say the same thing from two
  sides — the reset of `licensesLoading`, `licenses`, `licensesError` and `tagSugerencias` is **not proved by
  a test**. The worker had already declared the reason, and the review confirms it: every window-specific
  guard runs while the page is loading and the form is unmounted, so **no DOM assertion can separate guarded
  from unguarded**. That is not a weak test, it is **state with no testable surface from the page** — the
  same design signal as the four consecutive findings above. *Task: extract the load into a testable unit (or
  collapse the flags into one state object); adding more DOM assertions cannot close it.*
- **WU-6 R3-001** (`dataset-payload.test.ts:479`): the new `package_revise` contract is asserted only against
  mocked clients; a regression in CKAN's semantics would still pass. **Answered by measurement, not by a
  test**: the shape it asserts is the shape the live probe verified, and this repo has no integration runner
  — its own `config.yaml` says dev-stack checks are manual scripts. *Task: none until an integration lane
  exists; the probe is the evidence.*

### What the gates were worth

Every one of the eight gates found something, and the last four found something on the same file: the route's
load is hand-coordinated state, and each fix left one new inconsistency behind. Two of those were regressions
introduced by the fix that preceded them. That is a design signal, not an effort signal, and it is recorded
here so the next slice does not inherit it silently.

### Declared deviation (with its reason)

WU-3 is **615 diff lines** against this change's 400-line review budget. The remedy the budget prescribes —
split — cannot produce a working increment here: the page and its eight required tests are one cohesive unit,
and even the smallest functional version (load, ask, refuse, save) exceeds 400. Declared rather than hidden,
like slice 1a's deviation from `strict_tdd`.

**And the forecast was wrong, in a way worth fixing for next time.** Slice 1b was forecast at 350–450 lines
in total; it landed at roughly a thousand. The cause is not scope creep: it is that the forecast counted the
behaviour and not the **fixed cost of tests, fixtures and states**, which every unit pays again.

### One lineage left behind, deliberately

`review-6b517157db5f4274` is **immutable in `correction_required`** against the pre-correction candidate. Its
correction could not be admitted: committed, the candidate identity changes and the captured artifacts stop
verifying; uncommitted, a committed-only projection cannot see it; and `repair` refuses explicitly
(`repaired: false`, `compact_authority: immutable-untouched`). The corrected content was approved and burned
under a **new** transaction, so the code is gated — what remains is an unconsumed record, and its disposition
(abandon, or leave it) belongs to the maintainer.

### Found by the author's live review, after the slice closed (2026-10-03)

The browser review did what no gate could: it found a bug in the one place where the suite's doubles disagreed
with CKAN. Pressing **Guardar cambios** navigated to `/dataset/undefined`.

`package_revise` answers `{"success": true, "result": {"package": {…}}}` -- the package nested under
`result.package` -- while `revise` declared a bare `CkanPackage`. Every caller read `undefined`, and the route
built a URL from it. `357e2d6` unwraps the envelope and throws an exported `MalformedReviseResponseError` when
it does not carry one, so the silent `undefined` becomes a named failure. Receipt `review-0647040d0ce10fbc`,
approved and burned.

**The write path was never broken.** The same save was verified by effect afterwards: the notes changed, the
summary was updated **in place**, the unmanaged `frequency` extra survived, and the resource survived. That is
the measured shape working end to end, from a real browser against the real stack -- the strongest evidence
this change produced.

**Why the doubles missed it, and what changed:** the route's test resolved a *bare package*, a shape CKAN never
sends, so a wrapper reading the wrong field of the right response passed. The double now carries the measured
envelope, and the route test runs the **real wrapper over a doubled HTTP boundary** instead of mocking the API
module. Third instance in this change of *a double that does not copy the real shape blesses instead of
verifying* -- and the first one fixed structurally rather than case by case.

Its three advisories, all informational, recorded with their task:

- **R3-1** (`datasets.ts:94`): the guard checks that `id` and `name` are strings, not that the envelope carries
a whole package; a minimal `{id, name}` passes. The `/dataset/undefined` path is closed, because the route
navigates by `name`; the general case is not. *Task: none, unless a caller starts reading other fields -- the
alternative is re-implementing CKAN's contract inside the client.*
- **R3-2** (`edit.test.ts:43`): the route test wires the real wrapper but never resolves a **malformed**
envelope, so the route's visible handling of the new error is unproved. *Task: add that case.*
- **R3-3** (`datasets.ts:166`): the error message says the result had no `package`, but the guard also throws
when `package` exists with a non-string `id` or `name`. The message misreports the cause. *Task: one line, next
time that file is touched.*

### The stragglers after the close (2026-10-03, same day)

Five more units landed after the slice closed, three of them because **using** the feature found what the
suite could not. All gated and burned.

| unit | commit | receipt |
|---|---|---|
| the envelope bug: `/dataset/undefined` on save | `357e2d6` | `review-0647040d0ce10fbc` — 3 advisories |
| the tags field says what Retroceso does | `9bf844a` | `review-9b0385fbe91d9a3d` — approved, **0 findings** |
| the entry points to the edit route (1b-B2) | `8ebae13` | `review-2eeee36b8358df5d` — 1 WARNING + 1 SUGGESTION |
| the permission loaders cannot throw | `1e8b8fe` | `review-572e2901f6915923` — 2 WARNINGs, both test quality |
| the rejection tests clean up after themselves | `11de1ee` | `review-da98ae6f80c35afb` — approved, **0 findings** |

**A change of write semantics made an old gesture destructive.** The tags input has always removed the
last chip on Backspace-with-an-empty-field, and that was harmless while the write was partial — omitting a
key meant "leave the current value". Saving now installs the **exact** list, so a stray keypress followed
by a save deletes tags on the server, with nothing telling the reader. The author lived it. The convention
stays — it is what every chip input does — and the help text now says so, with a comment in the markup so
nobody deletes the line as noise. **The rule worth keeping: when saving installs exact state, the
affordance that empties it has to be visible.**

**The entry points asked a question the pages could not afford to ask per row.**
`listUpdatableOrganizationIds` asks once per page and answers `known: ids` or `unknown`, and `unknown` is
treated as **no**. The field it compares against — `owner_org` — was not declared in `CkanPackage`, so
three copies of the same cast had grown; it is declared now and one shared `ownerOrgIdOf` replaces them.
That de-duplication nearly lost a runtime `typeof` guard the edit route had and the shared helper's first
version did not — caught in the worker's own handoff rather than by a test, and restored with two tests
that fail without it.

### Operational lessons from the same day (they cost real time)

- **The review lifecycle's calls must be made directly, never from inside `codemode`.** Twice a script's
  timeout cancelled a pending call; one of those left a **cancelled `START`**, resolved by asking the
  provider for the target-scoped status exactly once — and no lineage had been created.
- **A consent envelope expires after ten minutes.** One expired unanswered and returned
  `consent-binding-stale`; the continuation is a fresh `START` for the same candidate, never resending the
  old binding.
- **Always pass an explicit `baseRef` for a unit's gate.** Without it the derivation uses the branch base
  and offers **every path of the session** — 27 files, twelve units already burned — instead of the unit's
  diff.
- **The accumulated session range is not a review candidate.** Every unit above was gated on its own,
  which is why no gate ever had to hold more than a few hundred lines.

## Next

**Slice 2 (resources)**, built on the write shape this slice measured and never on the pattern its plan
assumed — and on the same rule that closed this one: measure the effect, not the response. Before that,
two decisions belong to the author: the live browser review of the entry points, and the disposition of
the lineage left immutable in `correction_required`.

**1b-B2** — the entry points (done): the dashboard row and the dataset page. Before that, two things the author's
decision left pending: the live browser review of `/dashboard/datasets/[id]/edit` (the four refusal states and
the conflict notice are copy proposed by the agent, and rule 8 says interface copy is the author's call), and
the unstaged decision on the stuck lineage. Then **slice 2** (resources), whose writes must be built on the
measured shape above and never on the pattern this slice's own plan assumed.

Other open items, recorded so they are not lost: the unguarded `await response.json()` in `client.ts` (a
409 with a non-JSON body loses its status and reads as a transport failure), the `CkanPackage` type missing
`owner_org` (the route reads it through a cast), and `datasetApi.revise` still accepting a hand-built payload
— caller discipline is the only thing keeping the route on the builder's path.
