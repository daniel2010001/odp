# Pre-proposal state — `2026-09-13-publication-lifecycle`

> **Status: product decisions CONFIRMED. The proposal may proceed.**
> Written by the orchestrator before prompting the user, per the pre-proposal gate.
> Owner: orchestrator prose (not a native status field). See §6 for the confirmed answers.

## 1. Where this stands

`explore.md` was written from a CKAN **2.12.0a0 source checkout** because that executor had no
shell. Its CKAN behavior claims were therefore unverified against the deployment that actually
runs, which is **CKAN 2.11.6**. A follow-up probe phase executed those checks against the running
stack. **`explore.md` is superseded by section 2 wherever the two disagree.**

## 2. Measured evidence (CKAN 2.11.6, running stack)

### 2.1 Corrections to `explore.md`

| Claim in `explore.md` | Measured reality |
|---|---|
| `package_change_state` is callable | **REFUTED.** It does not exist as an action: `Bad request - Action name not known: package_change_state`. It is only an internal auth-function name used by `ignore_not_package_admin`. |
| `state: "draft"` is not a viable lifecycle carrier | **PARTLY REFUTED.** The drop is a **create-time artifact**: `package_create` with `state: "draft"` yields `state: "active"` for every non-sysadmin (editor **and** org admin), while still reporting `success: true`. But on an **existing** package, `package_patch {"state":"draft"}` **is honored** for the same non-sysadmins. `state` is therefore usable as a carrier, just not at create time. |
| `ckan.auth.reveal_private_datasets` | **Never mentioned.** It is `false` here (`ckan.ini:106`), and source shows it is read only by the web views, never on the API path. |

### 2.2 Confirmed facts that shape any design

1. **The review is bypassable portal-side.** An org `editor` holds `update_dataset`
   (`authz.py:248-253`); `package_patch` / `package_update` authorize on it, and `private` is a
   plain field. Measured: an editor set `private: false` on its own org's dataset with its own
   token. Cross-organization is denied (403), and a read-only `member` is denied (403).
   → **A review implemented only in the portal is advisory, not enforced.**
2. **`private: true` means "readable by every member of the owning organization"**, not
   author-only. Measured: a non-creator member of the same org got HTTP 200 on `package_show`.
3. **Draft visibility.** A `state: "draft"` package is absent from `package_search` for anonymous
   and for org members by default; org members see it only with `include_private=true` **and**
   `include_drafts=true`. Anonymous `package_show` on a draft → 403.
4. **`extras_*` in Solr is stemmed with an English Snowball filter.** Measured: the stored value
   `approved` also matches `approve`/`approving`, and the distinct stored value `approval` matches
   `approved`. **English lifecycle values are unsafe as a filter key.** Spanish values do not
   collide (the stemmer is English-only), and hyphenated values (`in-review`) match their
   constituent tokens.
5. **The portal has no database of its own.** The recorded versioning designs (denormalized A /
   normalized B) are both blocked on a prior "where does that schema live" decision, which is
   itself downstream of this lifecycle model.
6. **2.11.6 vs 2.12.0a0 gap that matters:** `extras` was rewritten (2.12 adds a JSONB `extras`
   column; 2.11.6 uses the separate `package_extra` table). Any portal-owned `extras` schema
   should be written against 2.11.6 and revisited before an upgrade.
7. `ckanext-umss` is an **empty `IConfigurer` scaffold** — no permissions, no actions, no hooks.
8. `organization_purge` and `group_purge` **do** exist as API actions (`package_purge` does not).

### 2.3 A real, separate defect found while probing

`current_package_list_with_resources` returns **zero private datasets to a non-sysadmin, including
its own**, because CKAN sets `"include_private": authz.is_sysadmin(user)` (`get.py:143`).
The dev seed masks this by using a sysadmin. The dashboard's "My datasets" is therefore broken for
every ordinary user. Nothing in the current spec covers it.

## 3. Pending product decisions (why the proposal is not launched)

The following are genuine product choices, not harness mechanics. Each one changes the shape of the
implementation, so the proposal cannot honestly be written before they are answered.

| # | Decision | Why it is blocking |
|---|---|---|
| D1 | Must the review step be **unbypassable**, or is a portal-side convention enough? | Determines whether the change needs CKAN-side `IAuthFunctions` code (an own extension or a third-party one) or can stay inside SvelteKit. Everything else follows from this. |
| D2 | Is a **finer visibility level** needed than what CKAN already offers? | Today there are effectively two: public, and readable by the whole owning org. An author-only or "internal" tier needs a new permission mechanism, because CKAN has no third tier. |
| D3 | The **dashboard defect** in §2.3: fold it into this change or fix it separately? | It is a live bug independent of the lifecycle, but it is adjacent (both are about who can see a private dataset). |
| D4 | **First-slice scope**: a minimal "publish this" action, or the full draft → review → approved → published flow? | Defines the non-goals. The backlog records the full flow as `[v1]`, while the immediate pain is that nothing created in the portal can ever become visible. |

## 4. Known gaps, stated plainly

- **Option B (third-party workflow extension) remains unassessed.** No such extension is vendored
  or referenced in `odp` or `odp-docker`, there is no network access in the probe environment, and
  the SDD research lane is fail-closed in this runtime (no evidence grants). Any comparison would be
  fabrication. It must either be dropped **explicitly** with that reason, or given a research lane
  that actually has network and an evidence grant.
- The version comparison covered the **12 cited files**, not the whole tree.
- `ckan.auth.reveal_private_datasets = true` semantics were not probed.
- `openspec/specs/dataset-publishing/spec.md` is already stale in two places (the visibility
  choice, and "no extras are written"). This change must reconcile both.

## 5. Probe hygiene

All probe packages were deleted and purged, both probe organizations were hard-purged, all probe
tokens were revoked by `jti`, and all probe users were removed. **Residual:** CKAN 2.11.6 exposes no
user hard-delete, so five `state='deleted'` user rows remain (`probe-editor-x`, `probe-member-x`,
`probe-editor-y`, `probe-outsider`, `probe-admin-x`); their tokens are gone.
Pre-existing debris from earlier sessions (`pi-perm-*`, `probe-a`, `pi-upload-probe` and three
UUID-named deleted packages) was left untouched as out of scope.

## 6. Confirmed decisions (2026-09-13, answered by the user)

| # | Decision | Answer |
|---|---|---|
| D1 | Must the review be unbypassable? | **Yes. CKAN-side enforcement.** The change must include `IAuthFunctions` code so an org editor cannot publish around the review through the API. A portal-only convention was explicitly rejected. Implies writing Python inside `ckanext-umss` (today an empty `IConfigurer` scaffold). The third-party-extension option (B) stays **dropped explicitly** for the reason in §4: it could not be assessed in this environment. |
| D2 | A finer visibility level than CKAN offers? | **No.** Two levels only: public, and readable by the owning organization (`private: true`, whose meaning was measured). No custom permission labels. |
| D3 | The dashboard defect in §2.3 | **Separate.** It is a live bug independent of this change and gets its own fix, to keep this candidate small. |
| D4 | First-slice scope | **Minimal publishable.** A dataset must be able to go from private to published, with D1's enforcement. The full draft → review → approved → published state machine is an explicit non-goal for this slice. |

### Consequences the proposal must respect

- With D1 confirmed, the enforcement boundary is the deliverable's core: a portal-side button without the CKAN-side authorization change does not satisfy D1.
- With D2 confirmed, drafts are readable by the owning organization. That is accepted, not a gap to close.
- With D3 confirmed, `current_package_list_with_resources` and the dashboard's private-dataset listing are **out of scope** here.
- With D4 confirmed, the proposal must state the lifecycle states it deliberately does **not** implement.
- Any lifecycle status value stored in `extras` must not be an English stemmable word (§2.2.4).
