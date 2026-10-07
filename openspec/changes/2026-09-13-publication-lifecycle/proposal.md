# Proposal: Publication Lifecycle — the wall and the single door

## Intent

**Problem.** Every dataset the portal creates is stored `private: true, state: active`, and nothing in
the product can make it public. The wizard hardcodes `private: true`, the visibility control was removed
from the form, and the only state-transition helper that existed (`setState` in
`src/lib/api/datasets.ts`) has no caller. The wizard's own copy admits the gap: "Todos los datasets se
crean como privados: el flujo de publicación es el que decide cuándo pasan a ser públicos". That flow
does not exist, so nothing created in the portal ever reaches the catalogue, and the `v0` exit criterion
— "publicar un dataset con recursos y verlo reflejado en el portal" (PRD §3) — is unreachable.

**Second problem, measured and sharper than the first.** The review step cannot be left to the portal.
An organization `editor` holds `update_dataset` (`ckan/authz.py:248-253`), and both `package_patch` and
`package_update` authorize on it. `private` is a plain field of `package_update`, so an editor can
publish around any portal-side review with its own token. Measured against the running CKAN, not
inferred: an org editor flipped `private` to `false` on its own organization's dataset and got `200`,
stored public (`apply-progress.md:253`). A portal-only convention is advisory, not a control.

**Third problem, and the one that decides the scope.** The PRD makes the request flow mandatory:
`RF-15` step 5 says no visibility changes except through an approved request, recorded in a
`publication_requests` table and approved by an `org_admin` (`PRD.md:150-152`, `PRD.md:336`). An earlier
revision of this proposal designed the smaller model — an organization admin publishing directly with
stock `package_patch`, no store, no request — and the author **reverted it on 2026-09-14** in favor of
the PRD. This proposal is the scope-B rewrite of that document: the PRD model, on top of the guard that
is already merged.

**The guard is already there.** The `odp-docker` commit `86f130b`
(`feat(umss): refuse publication by non-approvers`, 2026-09-14) is merged and pushed. It closed the
editor bypass, but its contract is "the org admin publishes with `package_patch`", which the wall below
removes. It is the **base that changes**, not the finished rule.

## Scope

### In Scope

- **A single authorized publication transition.** A dataset's stored `private` value changes to `false`
  through exactly one carrier: a dedicated CKAN action that writes a durable `publication_requests` row
  and flips `private` **in the same transaction**. The action has two authorized paths: the
  **approval path** (`publication_request_decide`), an organization `admin` (of the owning or a parent
  organization) and a `sysadmin`, under **four eyes** — nobody approves a request they created — and,
  for the **direct path** (`publication_publish`), a `sysadmin` only. An organization `admin` has
  **no** direct publish path. `package_update`, `package_patch` and `package_create` no longer
  publish — **for anyone, including the org admin**. The guard in `ckanext-umss` becomes a **wall**;
  the action is the **single door**, and its two keys are the approval path and the sysadmin's
  recorded path.
- **A durable request store.** The `publication_requests` table (the PRD schema plus the `annulled`
  outcome and `motive` column the downgrade will need), with a partial unique index enforcing one
  `pending` request per dataset, in `ckanext-umss` (`odp-docker`), delivered by a CKAN migration.
- **The request flow and its approval queue.** Five actions: request, cancel, decide, publish (the
  `sysadmin`'s recorded direct path) and list (the queue). An `editor` may request; an organization
  `admin` decides, but never a request they created (**four eyes**). The direct path is
  `sysadmin`-only; an organization `admin` has no direct publish path. The approver's comment is
  required to reject and optional to approve.
- **The portal affordances — controls with distinct gates.** An **editor's request control** (and the
  cancel of the caller's own pending request) on the dataset page, offered on the same `update_dataset`
  capacity the request action demands; a **sysadmin's direct publish control**, offered on the portal's
  existing sysadmin flag (`isSuperAdmin`, `src/lib/stores/auth.ts:96` — no new plumbing); and an
  **admin-only approval queue** that enforces four eyes and requires a reject comment. All of them call
  the publication actions and report CKAN's answer honestly (`403` is an authorization condition, a
  `200` that does not grant publication is not a success). The two controls never share a gate: without
  the editor's request control the portal has no path by which an editor without admin capacity can
  request anything.
- **The canonical specs.** A new `publication-lifecycle` capability and the `dataset-publishing`
  `Visibility` requirement rewritten so the wizard creates private and publication is a separate
  authorized transition.

### Out of Scope — explicit non-goals, not silent deferrals

| Non-goal | Reason |
|---|---|
| `RF-41`/`RF-42` — the visibility **downgrade**, requested and direct (`PRD.md:156-164`) | Deferred to **`[v1]`** by the author's decision of 2026-10-07: it belongs to the full lifecycle and arrives with it. The store already reserves the `annulled` outcome, the `motive` column and the `decided_at`/`consumed_at` timestamps they need, and `bulk_update_private` is their future carrier. This is a **deferral, not an exclusion**. |
| The editorial lifecycle machine of `RF-15` steps 1–3 (`draft` → `review` → `approved`, `PRD.md:143-148`) | Out of this cut and stays **marked** as such. The visibility transition is the only lifecycle step this change implements; the state vocabulary stays unimplemented rather than simulated. |
| A third visibility tier (`internal`) or author-only visibility | CKAN has two levels; `private: true` was measured to mean "readable by every member of the owning organization", which is what the PRD calls "interno". `DatasetVisibility = "private" \| "internal" \| "public"` in `src/lib/types/dataset.ts` has no CKAN counterpart and stays declared and unimplemented. |
| Versioning (`RF-14`, `RF-16`, `RF-17`) | The portal has no database of its own; the versioning designs stay parked downstream of this model. |
| A collection-level approval gate (`RF-23`) | Depends on the lifecycle model this change starts; `v1+` in `BACKLOG.md`. |
| A search or facet filter by publication status (`RF-28`) | Not needed to make a published dataset visible; `SearchParams.visibility` stays declared and unread. |
| The `current_package_list_with_resources` dashboard defect (`ckan/logic/action/get.py:143`) | A live bug independent of the lifecycle; fixed separately to keep this candidate reviewable. |
| CKAN's own visibility selector (enabling or hiding it) and production deployment of the extension image | Operational, not part of the transition contract. |

## Capabilities

### New Capabilities

- `publication-lifecycle`: the contract of the **visibility transition itself** — the wall, the
  `publication_requests` store, the request flow and its five actions, and the portal's editor request
  control, sysadmin direct publish control and approval queue. It is specified separately from `dataset-publishing` because the guarantee lives
  in CKAN's authorization layer in `ckanext-umss` (`odp-docker`), while the portal only offers an
  affordance and reports CKAN's answer.

### Modified Capabilities

- `dataset-publishing`: the `Visibility` requirement changes from "an explicit private/public choice by
  the creator" to "datasets are created private for everyone; publication is a separate, authorized
  transition through `publication-lifecycle`", and the metadata/`extras` statements are corrected to
  match the shipped `summary` extra and the removed visibility control.

## Decisions and their reasons

The author's frozen decisions (2026-10-07), the product-level inputs to `design.md`:

1. **Scope B — the full PRD visibility model.** The `publication_requests` store, the request flow and
   the approval queue are in scope; the guard becomes a wall with exactly one door. *Reason:* the PRD is
   authoritative and `RF-15` step 5 is mandatory; the portal-only and direct-publish models leave it
   unimplemented.
2. **`RF-41`/`RF-42` are `[v1]`.** *Reason:* the downgrade belongs to the full lifecycle and arrives
   with it; the store reserves its columns so the later transition is additive.
3. **The editorial lifecycle machine is out and stays marked.** *Reason:* it is `RF-15` steps 1–3, a
   distinct contract that this cut does not specify; shipping its vocabulary or a status marker would
   promise a step the platform does not implement.

The **architecture** those decisions accepted is `odd/tasks/publication-guard-design.md`, folded into
`design.md` (D1–D9). Two of its choices are load-bearing enough to state here without restating it:

- **The door, not a consultative guard.** The inherited question — "how does the guard read the approved
  request?" — is answered by **not** reading it: a read predicate that consumes an approval is a write
  inside a read, with a replay window and no row for `package_create` to attach a request to. The wall
  has none of those failure modes.
- **One transaction.** The action writes the record and flips `private` through the same session, so
  either both writes commit or neither does.

The detailed decisions, the rejected alternatives and the tradeoffs are in `design.md`; they are not
repeated here.

## Measured evidence this change keeps

All measured against the running CKAN unless marked otherwise; the version drift below is
load-bearing.

| Fact | Where |
|---|---|
| An org `editor` published its own dataset with `package_patch {private: false}` → `200`, stored public | `apply-progress.md:253` |
| An org `editor` changed `state` to `draft` → `200`, stored `draft` | `apply-progress.md:254` |
| `package_create {private: false}` **and** `package_create` with `private` omitted → `200`, stored public | `apply-progress.md:257-258` |
| `package_patch {private: "banana"}` and `{private: ""}` → `200`, stored public: `boolean_validator` is total and coerces every other value to `false` | `apply-progress.md:255-256,363-399` |
| A full `package_update` omitting `private` left `private: true` (omission is a publication attempt only at create time) | `apply-progress.md:275-276` |
| An `admin` of a **parent** org published a **child** org's dataset → `200`; the cascade is measured, not inferred | `apply-progress.md:288` |
| A `member`, a cross-org editor and an anonymous caller were already refused `403` | `apply-progress.md:284-287` |
| A published dataset reaches the anonymous catalogue; a private one stays absent | `apply-progress.md:289-299` |
| `bulk_update_public` writes `private: false` directly and does **not** route through `package_update`, so the update guard alone does not cover it | `design.md` §Measured baseline; `apply-progress.md:295` |
| `ignore_auth` is a real context key the action layer honors, and the API view builds the context server-side, so a remote client cannot inject it | `design.md` D5 |

**Version drift, stated because it is load-bearing.** The running stack answers CKAN **2.12.0**
(`status_show`, measured 2026-10-07); the guard was built and probed against **2.11.6** on 2026-09-14.
The applied guard's docstrings still cite the 2.11.6 path `ckan/logic/schema.py:160-161` (in 2.12.0,
`ckan/logic/schema/__init__.py`). Re-running the live probe against 2.12.0 is a task, not an assumption
(`tasks.md` Phase A5).

## Rollback condition

This change **does** introduce a schema. The old rollback ("two reverts, no migration") no longer holds,
and this section is rewritten as the old proposal required:

- Reverting the portal commit removes the publication control and the queue; the CKAN rule keeps working.
- Reverting the `ckanext-umss` change removes the wall and the actions; stock CKAN authorization returns,
  and the `publication_requests` table becomes an inert table.
- **The migration must be rolled back explicitly.** `ckan -c <ini> db downgrade` drops the table; the
  down-migration ships in the same `migration/umss/` tree as the up-migration. A deploy that skips it
  leaves a table nothing reads, which is harmless, but the rollback must name the command rather than
  claim there is nothing to undo.
- **Datasets already published stay public** — the flip is a data change, not a UI change. The rollback
  must accept that or explicitly un-publish the affected datasets with an admin token.
- **Once the table exists, removing the wall without removing the actions leaves an approved row with no
  consumer.** The downstream migration step is the safe order.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **The review budget is exceeded by a wide margin.** The measured test:code ratios give ~1,579 code + ~2,587 test lines, 10.4× the 400-line budget (`tasks.md` Forecast) | High | The gate is reported honestly before apply; the split-or-exception decision belongs to the human. Scope is not shrunk to fit. |
| **The API emergency path is gone.** If the portal is down, an org admin can no longer publish with a `curl`; only a `sysadmin` remains | Accepted | The author accepted this as the single argument against the wall (`design.md` Tradeoffs). |
| **The wall and the door must ship together.** Once the wall is in, the portal has no way to publish until the action exists | High | The action and the wall are one backend slice; the portal affordance follows. |
| **An existing contract becomes false and must be amended in writing.** The live `Requirement: Approver Capacity` and `probe.sh` both assert the org admin publishes with `package_patch`; the wall flips that to `403` | High | The spec is already reconciled; the probe rewrite is a first-class task (`tasks.md` Phase A5). |
| **The migration is a deployment step.** Dev hot-mounts the extension; production bakes it, so the table does not appear until `ckan db upgrade` runs at deploy | High | The command is recorded in the `odp-docker` deploy path (`tasks.md` A6.1). A deploy that skips it walls every dataset. |
| **The migration's atomicity is asserted, not measured.** Record + flip is deduced from the shared session | Med | A probe forces the flip to fail and asserts the row is absent (`tasks.md` A2.5/A5.4). |
| **The extension suite has already destroyed the dev database once** (2026-09-14) | High | Never run it without the database **and** site-id overrides (`tasks.md` Hazard 1). |
| **The running stack is 2.12.0; the guard is proven on 2.11.6** | Med | Re-run every measured row on the running image during apply (`tasks.md` A5.5). |
| **The queue's portal route is a design choice, not a measurement** | Low | The author reviews it per `AGENTS.md` rule 8. |
| **Cross-repository change: Python + CKAN plugin work is not part of `pnpm test`** | High | The live probe is the only evidence that covers the running image; the portal suite proves honesty, not enforcement. |
| **No approver available: an organization with editors but no admin cannot publish** | Med | Explicit: such a dataset requires a `sysadmin`. The copy says so; no portal role or override grants it. |
| **Four eyes removes the self-approval shortcut.** An organization whose only admin is the requester needs a `sysadmin` to publish, and an `admin` no longer has a direct publish path | Accepted | The store is a **gate, not a log** (`design.md` D4); the PRD already accepts the analogous "editors but no admin" case, and the `sysadmin` remains the emergency path. |

## Success Criteria

- [ ] An org **editor**, with its own token, cannot set `private: false` or change `state` on a dataset
      it can edit. Measured API result: `403`. Today this returns `200`.
- [ ] An editor without admin capacity can request publication from the portal and cancel their own
      pending request; the request control and the direct publish control are offered on distinct gates
      (`update_dataset` capacity versus the sysadmin flag).
- [ ] An org **admin** is refused through `package_patch` too, has **no** direct publish path
      (`publication_publish` is `sysadmin`-only), and approves only requests they did not create.
- [ ] Cross-organization, read-only-`member` and anonymous attempts remain denied (no regression).
- [ ] `bulk_update_public` is refused by this capability's own rule, not by CKAN's own authorization.
- [ ] A `publication_requests` row is written by the door, and the record and the `private` flip commit
      together or not at all.
- [ ] A dataset published through the flow appears in anonymous `package_search` with no portal-side
      query change; a private one stays absent.
- [ ] The portal never reports a publication CKAN did not grant and never asserts a lifecycle value at
      `package_create` time; the publication control and the queue call the publication actions, never
      `package_patch`.
- [ ] No user-facing string promises a lifecycle step this cut does not implement.
- [ ] `pnpm test`, `pnpm check`, `pnpm lint` and `pnpm build` pass in `odp`; the `ckanext-umss` suite
      passes and covers the new rule; the live probe passes against the running image.
- [ ] No dataset, resource, token or user created while verifying is left behind in CKAN.
