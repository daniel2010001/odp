# Apply Progress — `2026-09-13-publication-lifecycle` (PR 1 only)

**Scope of this pass:** PR 1 — the CKAN-side enforcement guard in `ckanext-umss` (`odp-docker`),
plus its reviewer-runnable live-probe harness in `odp`. Tasks 1.1.1 → 1.5.1.
PR 2 (the portal affordance, `odp`) is **not started** and must not be.

**Task state:** all ten PR-1 tasks produced their deliverable and their evidence. Four tasks carry a
documented defect in their own text (their stated expectation is impossible or wrong); those are
findings, not adjusted tests. One environment incident happened and is reported in §1.

| Task | Deliverable | State |
|---|---|---|
| 1.1.1 | Pre-change red baseline recorded | done |
| 1.1.2 | `tests/test_plugin.py` fixed (different fix than prescribed — §3.1) | done |
| 1.2.1 | Update-path tests written; RED recorded | done |
| 1.2.2 | `ckanext/umss/auth.py` update shape; GREEN recorded | done |
| 1.2.3 | Create-path tests written; RED recorded | done |
| 1.2.4 | `package_create` guard; GREEN recorded | done |
| 1.2.5 | Preserved-refusal / untouched-write tests written | done — **its RED premise is falsified (§3.5)** |
| 1.2.6 | Over-refusal checked; no production correction was needed | done — mutation control in §3.5 |
| 1.3.1 | `IAuthFunctions` registration + live probe (both with and without restart) | done |
| 1.4.1 | `probe.sh` materialized and run: 25/25 | done |
| 1.4.2 | Probe hygiene confirmed inside the script | done — degenerate baseline, §1 |
| 1.5.1 | Full suite green + raw probe transcript | done |

**Delivery is blocked on a decision, not on code.** PR 1 authors **915 changed lines** in two
repositories against a 400-line budget (§6). No `size:exception` was inferred or self-granted; the
maintainer must accept one, or the slice must be split. Nothing was committed in either repository.

---

## 1. INCIDENT — the prescribed test command destroyed the dev database

**This is the most important item in this report.** The verification surface named by both
`design.md` (P0.6) and tasks 1.1.1/1.1.2/1.5.1 —

```
docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss && pytest --ckan-ini=test.ini ckanext/umss'
```

— **does not run against a test database in the dev image. It runs against the dev database.** Every
test that uses `clean_db` therefore drops and recreates the dev schema.

**Proof (non-destructive diagnostic, temporary module, deleted afterwards):**

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini -s -q ckanext/umss/tests/test_db_target_tmp.py'
DB_URL: postgresql://ckandbuser:ckandbpassword@db/ckandb
```

**Mechanism.** `ckan/config/environment.py:81` maps the config key `sqlalchemy.url` to the
environment variable **`CKAN_SQLALCHEMY_URL`**, applied *after* the ini is loaded. The dev compose
sets `CKAN_SQLALCHEMY_URL=postgresql://ckandbuser:ckandbpassword@db/ckandb`, so `test.ini`'s
`use = config:…/test-core.ini` (which points at `postgres://ckan:ckan@db/ckan_test`) is overridden.
`ckan_test` currently has **zero tables**; it was never used.

**Damage observed.** `ckandb` went from the 16 seeded datasets plus `ckan_admin` to:

| | before (23:00 and the 19:06 probe run) | after |
|---|---|---|
| `package` rows | 16 seeded | **1** — `dataset-txxg-4347-xruz`, a factory dataset from the test run |
| users | `default`, `ckan_admin` | `default`, **`qcastro`** (a `factories.User()`), later `ckan_admin` again |
| sysadmin `default` id | `8f51b8d1-a248-4b94-8b67-85df29efb1e0` | `3db73efb-b1cd-4111-9073-a118de76dc92` (schema recreated) |

The timeline is decisive: at 23:00:43 `ckan user list` still reported `default, ckan_admin`, and the
19:06 probe run ended with `P9.1 PASS want=16 got=16`; the factory rows appear only after the first
`clean_db` test run at 23:08.

**A second, separate consequence: Solr no longer matches the database.** The test fixtures were
indexed into the shared Solr core. An anonymous `package_search q=*:*` answers **57** while `ckandb`
holds **1** dataset, and `package_show` for any of those 57 answers `404 Not Found`. That is why the
probe's `P0`/`P9.1` baseline reads 57 in this pass instead of the designed 16.

**Damage I repaired (reported, not hidden):**

```
# 1. the sysadmin the wipe removed, with the credentials the project's own .env documents
$ printf 'y\n' | docker exec -i odp-dev-ckan-dev-1 ckan -c /srv/app/ckan.ini \
    sysadmin add ckan_admin password=umss-dev-admin-2026 email=admin@localhost
Successfully created user: ckan_admin
Added ckan_admin as sysadmin

# 2. the datapusher token, blanked by the container's own init script (§3.6), replaced with a fresh one
$ docker exec odp-dev-ckan-dev-1 sed -i \
    's|^ckan.datapusher.api_token=.*|ckan.datapusher.api_token=placeholder-for-cli-bootstrap|' /srv/app/ckan.ini
$ docker exec odp-dev-ckan-dev-1 ckan -c /srv/app/ckan.ini \
    user token add ckan_admin datapusher expires_in=100 unit=3600 -q      # → 197-char JWT
$ docker exec odp-dev-ckan-dev-1 ckan config-tool /srv/app/ckan.ini "ckan.datapusher.api_token=<token>"
# then a reload (mtime-only touch) so the running process picks it up; container health=healthy again
```

**Damage I did NOT repair — needs a maintainer decision:**

The 16 seeded datasets are gone from the database. The repo carries the mechanism to rebuild them
(idempotent, by `name`), but re-seeding creates content in the dev stack and is outside the edit
authority of this pass. Recommended:

```
cd /home/danielblc/projects/odp
CKAN_URL=http://localhost:5000 CKAN_SYSADMIN_NAME=ckan_admin \
CKAN_SYSADMIN_PASSWORD=umss-dev-admin-2026 node scripts/seed-ckan.mjs
# and drop the orphaned index documents, which no longer correspond to any row:
docker exec odp-dev-ckan-dev-1 ckan -c /srv/app/ckan.ini search-index clear
docker exec odp-dev-ckan-dev-1 ckan -c /srv/app/ckan.ini search-index rebuild
```

Until that runs, the portal will show 57 datasets of which 56 are phantoms, and the extension suite
**must not be run in the dev image again** — each run wipes the dev schema. Run it in a throwaway
`ckan/ckan-dev:2.11` container (the extension's own `.github/workflows/test.yml` path) or with
`test-core.ini`'s URL actually winning.

---

## 2. What each task produced, with the command output that proves it

### 1.1.1 — pre-change red baseline

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini ckanext/umss'
collected 1 item
ckanext/umss/tests/test_plugin.py F                                       [100%]
    @pytest.mark.usefixtures("with_plugins")
    def test_plugin():
>       assert plugin_loaded("umss")
E       NameError: name 'plugin_loaded' is not defined
ckanext/umss/tests/test_plugin.py:57: NameError
============================= 1 failed in 0.89s ===============================
```

Exactly the state `design.md` P0.6 records (`1 failed`, that `NameError`, that line). No other
failure, so the run continued.

### 1.1.2 — fix the load test

Implemented:

```python
from ckan.plugins import plugin_loaded          # + module docstring note
...
def test_plugin():
    assert plugin_loaded("umss")
```

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini ckanext/umss'
collected 1 item
ckanext/umss/tests/test_plugin.py .                                       [100%]
============================= 1 passed in 0.79s ==============================
```

### 1.2.1 RED — update-path tests

New module `ckanext/umss/tests/test_auth.py`. First collected test fails because the module under
test does not exist yet:

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini ckanext/umss/tests/test_auth.py'
collected 0 items / 1 error
ERROR collecting ckanext/umss/tests/test_auth.py
E   ImportError: cannot import name 'auth' from 'ckanext.umss'
=============================== 1 error in 0.58s ===============================
```

No `skip`, no `xfail` anywhere in the module.

### 1.2.2 GREEN — `auth.py`, update shape

`ckanext/umss/auth.py` (new, 190 lines): `PUBLISH_DENIED_MSG`, `_is_approver`, `_as_bool`,
`_load_or_defer`, chained `package_update`. Update-path assertions:

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini ckanext/umss/tests/test_auth.py'
collected 9 items
ckanext/umss/tests/test_auth.py .........                                 [100%]
============================= 9 passed in 17.28s ==============================
```

**Deviation (ordering).** The same edit also registered the functions on `UmssPlugin`
(`implements(IAuthFunctions)` + `get_auth_functions()`), which task 1.3.1 owns. Reason:
`helpers`/`logic.get_action` resolve auth functions from CKAN's registry, and CKAN's test harness
disables non-system plugins unless a test asks for `with_plugins`; a guard that is not registered is
**unreachable from any action call**, so 1.2.2's stated proof ("all update-path assertions pass")
cannot be produced without the registration. 1.3.1 therefore contributes its live-probe half plus
confirmation of the registration shape, and this reordering is recorded rather than hidden.

### 1.2.3 RED — create-path tests

Create-path tests appended (public create refused with *and* without the key; the wizard payload
allowed; create-time `state` not refused). RED produced by disabling the create guard (the two
guards had been authored in one edit — see §7):

```
$ # auth.py, package_create reduced to `result = next_auth(context, data_dict); return result`
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini ckanext/umss/tests/test_auth.py'
FAILED ckanext/umss/tests/test_auth.py::test_editor_package_create_to_a_public_dataset_is_refused
======================= 1 failed, 13 passed in 25.77s ========================
```

Exactly one failure, and it is the guard's absence — every other assertion, including the untouched
write paths, stays green. Guard restored:

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini ckanext/umss/tests/test_auth.py'
collected 14 items
ckanext/umss/tests/test_auth.py ..............                            [100%]
============================= 14 passed in 25.80s ==============================
```

### 1.2.4 GREEN — `package_create` guard
Included in the 14-passed run above; the guard defers only on an explicit value core reads as
`True`, treats an absent key exactly like `false`, and does not guard create-time `state`.

### 1.2.5 / 1.2.6 — preserved refusals and the over-refusal check

Seven more tests (member, cross-org editor, anonymous, metadata-only patch, `package_delete`,
`resource_create`, parent-org admin publishing a child org's dataset). **All pass against the guard as
written** — i.e. **the RED this task predicts does not exist**, because the predicate has been
diff-aware since 1.2.2 and therefore refuses nothing in this list. See §3.5 for the falsification and
for the mutation control that proves these tests are not vacuous.

Full suite (also the proof for 1.3.1(a)):

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'cd /srv/app/src_extensions/ckanext-umss &&
    pytest --ckan-ini=test.ini ckanext/umss'
collected 22 items
ckanext/umss/tests/test_auth.py .....................                     [ 95%]
ckanext/umss/tests/test_plugin.py .                                       [100%]
============================= 22 passed in 37.95s =============================
```

> This run is the last extension-suite run made against the dev image. It is the run that wiped
> `ckandb` (§1). The result is valid; the side effect is not acceptable to repeat.

### 1.3.1 / 1.4.1 / 1.4.2 / 1.5.1 — live probe

`probe.sh` (new, 373 lines, executable, self-cleaning) at
`openspec/changes/2026-09-13-publication-lifecycle/probe.sh`. It runs the P1→P10 sequence of
`design.md` §"Live probe" through `http://localhost:8082/api/`, asserts every truth-table row,
prints each raw status and `error.__type`, and performs P9 (cleanup) inside the script.

**Pre-guard run, on the healthy stack — the bypass, reproduced:**

```
$ sh openspec/changes/2026-09-13-publication-lifecycle/probe.sh
P3    FAIL want=403 got=200  editor package_patch {id, private: false}
P4a   FAIL want=403 got=200  editor package_patch {id, state: draft}
P4d   FAIL want=403 got=200  editor package_patch {id, private: 'banana'} — coerces to public
P4e   FAIL want=403 got=200  editor package_patch {id, private: ''} — coerces to public
P5    FAIL want=403 got=200  editor package_create {private: false}
P5b   FAIL want=403 got=200  editor package_create with private omitted
P5    of p2/p5/p5b, datasets that exist: 3 (p2 expected, p5 and p5b expected 0)
RESULT: 19/25 checks passed, 6 failed
```

Exactly six failures, exactly the six publish paths. Every preserved behaviour (P2, P4b, P4c, P6,
P6.1, P6.2, P6.3, P7, P8, P10, P9) was already green.

**Post-guard run, after `docker restart odp-dev-ckan-dev-1`:**

```
$ sh openspec/changes/2026-09-13-publication-lifecycle/probe.sh
P3    PASS want=403 got=403  editor package_patch {id, private: false}
      body: {"help": "…/package_patch", "error": {"__type": "Authorization Error",
      "message": "Access denied: Only an organization administrator can publish a dataset"}, "success": false}
P4a   PASS want=403 got=403  editor package_patch {id, state: draft}
P4b   PASS want=200 got=200  editor package_patch {id, title} — a metadata edit must stay allowed
P4c   PASS want=200 got=200  editor full package_update omitting private
P4c   stored after the full update: private=true state=active
P4d   PASS want=403 got=403  editor package_patch {id, private: 'banana'} — coerces to public
P4e   PASS want=403 got=403  editor package_patch {id, private: ''} — coerces to public
P5    PASS want=403 got=403  editor package_create {private: false}
P5b   PASS want=403 got=403  editor package_create with private omitted
P5    of p2/p5/p5b, datasets that exist: 1 (p2 expected, p5 and p5b expected 0)
P6    PASS want=200 got=200  org admin package_patch {id, private: false}
P6.stored PASS want=false got=false  stored private after the admin's call
P6.1  PASS want=200 got=200  sysadmin package_patch {id, private: false}
P6.2a PASS want=403 got=403  org member package_patch {id, private: false}
P6.2b PASS want=403 got=403  editor of another org package_patch {id, private: false}
P6.3  PASS want=403 got=403  anonymous package_patch {id, private: false}
P10   PASS want=200 got=200  admin of the parent org publishes the child org's dataset
P7    anonymous *:* count: 57 -> 60 (delta 3)
P7    datasets of this run now public and active: 3
P7.delta PASS want=3 got=3  the anonymous count rose by exactly the number of published datasets
P7.d2 PASS want=1 got=1  anonymous search …-d2 (published-by-the-sysadmin-and-must-be-visible)
P7.d3 PASS want=0 got=0  anonymous search …-d3 (private-and-must-stay-absent)
P7.d7 PASS want=0 got=0  anonymous search …-d7 (private-and-never-published)
P8    PASS want=403 got=403  editor bulk_update_public — refused by CKAN's own auth, not by the guard
P9.2  PASS want=0 got=0  probe datasets still resolvable after the purge
P9.3  PASS want=0 got=0  probe organizations still resolvable after the purge
P9.4  PASS want=0 got=0  probe users whose minted token survived revocation
P9.1  PASS want=57 got=57  anonymous *:* count back to its pre-run baseline
RESULT: 25/25 checks passed, 0 failed          # exit status 0
```

The refusals carry the plugin's own message (`Only an organization administrator can publish a
dataset`) and CKAN's `Authorization Error`, not a generic "not authorized to edit package" — the
"Distinguishable Authorization Errors" requirement, measured.

**1.4.2 hygiene.** Cleanup lives inside the script: it revoked every minted token by `jti` resolved
through `api_token_list`, verified by listing (`P9.4`), soft-deleted and purged its datasets
(`P9.2`), purged its organizations (`P9.3`), and soft-deleted its users. Residual, stated and not
overclaimed: CKAN 2.11.6 exposes no user hard-delete, so the probe users remain as
`state='deleted'` rows. `P9.1` confirms the count is back to its own pre-run value; that value is
**57, not the designed 16**, because of the orphaned index documents of §1 — the assertion is
honest, the environment is not the one the design measured.

Also settled, because `design.md` left it explicitly unprobed: **the bind-mount alone is enough.**
A probe run with the new code in place but *before* the restart reported `25/25 checks passed, 0
failed` — P3 was already `403`. The cause is visible in the container logs: the dev server runs with
the Flask reloader (`Debugger is active!`, a fresh `Running CKAN on http://0.0.0.0:5000` within
seconds of every file write), so plugin registration is rebuilt without a manual restart. The
restart was still performed (it is authorized, and it gives the design's prescribed proof) — and it
is what exposed §3.6.

---

## 3. Findings — where the artifacts contradict the measured platform

### 3.1 Task 1.1.2's prescribed fix cannot work: `plugin_loaded` is not a fixture

tasks 1.1.2 says to fix the test by taking `plugin_loaded` as a fixture parameter
(`def test_plugin(self, plugin_loaded):`). In CKAN 2.11.6 there is no such fixture:

```
$ docker exec odp-dev-ckan-dev-1 sh -c 'grep -rn "def plugin_loaded" /srv/app/src/ckan/ckan/tests/pytest_ckan/'
(no output)
$ docker exec odp-dev-ckan-dev-1 sh -c 'grep -rn "def plugin_loaded" /srv/app/src/ckan/ckan/plugins/core.py'
231:def plugin_loaded(name: str) -> bool:
```

`plugin_loaded` is a **function** in `ckan.plugins.core` re-exported as `ckan.plugins.plugin_loaded`;
CKAN's own test uses `assert plugins.plugin_loaded(u"stats")`
(`ckan/tests/pytest_ckan/test_fixtures.py:48`). Requesting it as a fixture would fail with
`fixture 'plugin_loaded' not found`. Implemented as the import + call.

### 3.2 Task 1.2.1's prescribed call shape silently skips the authorization layer

`ckan.tests.helpers.call_action` is documented to skip authorization and does
`context.setdefault("ignore_auth", True)`; `authz.is_authorized` returns success immediately when
`ignore_auth` is truthy. A test written with the prescribed `helpers.call_action(..., context={'user': …})`
therefore exercises the *action* and never the guard — it passes for the wrong reason. Forcing the
key to `False` is not the fix either:

```
$ docker exec odp-dev-ckan-dev-1 sh -c "grep -rn \"ignore_auth' in context\" /srv/app/src/ckan/ckan/ --include=*.py"
/srv/app/src/ckan/ckan/logic/validators.py:563:    if 'ignore_auth' in context:
```

`ignore_not_package_admin` tests **key presence, not value**, so a present-but-False key disables the
create-time `state` drop. Measured consequence: with `ignore_auth: False` in the context,
`package_create {private: true, state: "draft"}` by an editor stored `state='draft'`; with the key
absent (production semantics) it stores `active`. The harness therefore calls actions the way the API
controller does, and the reason is documented in `test_auth.py::call_as`.

### 3.3 MEASURED OVERRIDE — `boolean_validator` is total, so "defer on an unrecognized value" publishes

`design.md` D3 rule 2 and `spec.md` ("An unrecognized value defers to core CKAN", "THEN CKAN answers
with its own validation error for the `private` field") both assume core rejects an unrecognized
`private`. It does not:

```
# ckan/logic/validators.py:160-173
def boolean_validator(value, context):
    if value is missing or value is None:
        return False
    if isinstance(value, bool):
        return value
    if value.lower() in ['true', 'yes', 't', 'y', '1']:
        return True
    return False            # ← every other string, including 'banana', is False = PUBLIC
```

Measured live (probe rows added by this pass, pre-guard, on the healthy stack):

```
P4d   FAIL want=403 got=200  editor package_patch {id, private: 'banana'} — coerces to public
P4e   FAIL want=403 got=200  editor package_patch {id, private: ''} — coerces to public
```

Both answered `200` and stored a public dataset. Deferring on such a value therefore defers **to a
publication**, not to a validation error — the exact transition `Publication Authorization` forbids.
`_as_bool` mirrors `boolean_validator` exactly (no "improvement": a value this module reads as `True`
while core reads it as `False` would open the hole, and the reverse would refuse a no-op), so
`'banana'`, `''` and `None` are treated as publication attempts and refused. `None` is included
because `boolean_validator(None)` is `False`. Only values core would *raise* on (no `.lower()`) defer,
which is safe because the exception aborts the request.

**This contradicts a normative scenario in `spec.md`.** The clause needs amending, not the test: the
spec's premise is false for 2.11.6, and following it literally re-opens the change's primary success
criterion via one API call. Recorded as a blocking risk for verify in §8.

### 3.4 Chaining drops `auth_allow_anonymous_access`, which is a silent behaviour change

CKAN builds a chained function as `functools.partial(func, prev_func)` and copies only **`func`'s**
attributes onto it (`ckan/authz.py:126-133`), so core's `@auth_allow_anonymous_access` is lost the
moment a chain is installed. `is_authorized` then refuses anonymous callers *before* consulting
core. Both guards therefore declare `@toolkit.auth_allow_anonymous_access` so core keeps making the
anonymous decision, preserving the pre-change outcome and message. Invisible under the default
configuration; wrong under one that enables anonymous dataset creation. This is an addition to the
design's D3 shape, and it is deliberate.

### 3.5 Task 1.2.5's RED premise is falsified

The task states that its assertions "fail against 1.2.4's guard, which currently over-refuses at
least one of these shapes". They do not: the predicate is diff-aware from 1.2.2 (`wanted_private is
False and bool(pkg.private)`), and 1.2.1 already forces that shape by requiring
`private: false` on an already-public dataset to answer `200`. There is no honest RED to produce, and
none was fabricated.

The tests are not vacuous. Mutation control — the over-refusing variant the task anticipated,
`wants_private_public = bool(pkg.private)` ("refuse any write to a private dataset by a non-approver"):

```
FAILED ckanext/umss/tests/test_auth.py::test_editor_full_update_omitting_private_is_allowed
FAILED ckanext/umss/tests/test_auth.py::test_metadata_only_patch_is_allowed
FAILED ckanext/umss/tests/test_auth.py::test_resource_create_is_allowed
3 failed, 18 passed in 37.41s
```

`package_delete` still passes under the mutant, which is correct: its `data_dict` is `{id}` only, so
the key-presence rule (design D3 property 1) returns before the predicate. 1.2.6's "minimum
correction" is therefore **no production change**: the correction is already in place, and the
mutation check is what proves it does something.

### 3.6 A restart of the dev CKAN container cannot start it (pre-existing, unrelated to this change)

The authorized `docker restart odp-dev-ckan-dev-1` produced a crash loop:

```
/docker-entrypoint.d/01_setup_datapusher.sh: Set up ckan.datapusher.api_token in the CKAN config file
ckan.logic.ValidationError: None - {'expires_in': ['Missing value'], 'unit': ['Missing value']}
ckan.config.environment … plugin.configure(config)
ckanext/datapusher/plugin.py:52: Exception: Config option `ckan.datapusher.api_token` must be set
Exit with status 1. Restarting.
```

Causal chain, all measured:

1. `01_setup_datapusher.sh` mints the token with `ckan user token add ckan_admin datapusher` — no
   `expires_in`, no `unit`.
2. `expire_api_token` (in `CKAN__PLUGINS`) makes both mandatory:
   `create_api_token_schema` adds `not_empty` to each (`ckanext/expire_api_token/plugin.py`). There is
   no configuration that relaxes it.
3. The command fails, the shell substitution is empty, and `config-tool` writes
   `ckan.datapusher.api_token=` — which makes every subsequent `ckan` invocation (and the server)
   die in `load_environment`.
4. `CKAN__DATAPUSHER__API_TOKEN` is unset in the environment, which is the branch condition that
   makes the script try at all.

The container had been running since before this pass, so the defect was latent; the restart exposed
it. Repaired in-container with a real token minted with `expires_in`/`unit` (§1). **The trap is not
fully closed:** the next `docker restart` will blank the token again, because the only clean fixes are
setting `CKAN__DATAPUSHER__API_TOKEN` or patching the image script — both in files this pass is
forbidden to touch.

### 3.7 `api_token_create` for another user still returns no `result.id` (design's trap held)

Re-confirmed by the probe: per-user tokens were minted as a sysadmin and their `jti` resolved only
through `api_token_list {user_id}`. `api_token_revoke` of an unknown `jti` answers `success: true`,
so `P9.4` verifies revocation by listing rather than by trusting the response.

---

## 4. TDD Cycle Evidence (strict TDD is on: `openspec/config.yaml` → `strict_tdd: true`)

| Task | RED evidence (command + result) | GREEN evidence | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| 1.1.1 | `pytest … ckanext/umss` → `1 failed`, `NameError: name 'plugin_loaded' is not defined` | n/a (measurement) | n/a | n/a |
| 1.1.2 | 1.1.1 is the RED (the failure exists and is captured first) | `1 passed in 0.79s` | n/a | — |
| 1.2.1 | `pytest … tests/test_auth.py` → `collected 0 items / 1 error`, `ImportError: cannot import name 'auth'` | 1.2.2 below | see 1.2.2 | harness refactored to `call_as` after §3.2 |
| 1.2.2 | 1.2.1 (module absent) | `9 passed in 17.28s` | 9 tests over the update truth table incl. `sysadmin`, `org admin`, no-diff, `NotFound`, three unrecognized values | `_MISSING` sentinel removed as dead code; `_as_bool` rewritten to mirror `boolean_validator` |
| 1.2.3 | create guard disabled → `1 failed, 13 passed`, the failure being the create refusal | 1.2.4 below | refused with `false`, with the key omitted, and with `'banana'`; wizard payload allowed; create-time `state` allowed | — |
| 1.2.4 | 1.2.3 | `14 passed in 25.80s` | see 1.2.3 | — |
| 1.2.5 | **none available — premise falsified (§3.5); mutation control supplied instead** | `21 passed` with the guard, and the mutation control fails 3 of them | 7 shapes: member, cross-org, anonymous, metadata patch, delete, resource create, parent-org admin | — |
| 1.2.6 | 1.2.5 | `22 passed in 37.95s` (whole suite) | — | no correction needed; proven by the mutation control |
| 1.3.1 | no RED expected (wires already-tested functions) | `22 passed` + probe `25/25` post-restart | probe run pre-restart also `25/25` (§2) | — |
| 1.4.1 | n/a (measurement harness) | pre-guard `19/25` (6 publish paths green→`200`), post-guard `25/25` | two independent runs (with and without restart) | — |
| 1.4.2 | n/a | `P9.1`–`P9.4` all `PASS`, documented residual | — | — |
| 1.5.1 | n/a | suite green + probe transcript 25/25 | — | — |

Every behavior change had a failing test before it: 1.2.2's RED is 1.2.1's `ImportError`; 1.2.4's RED
is the recorded `1 failed, 13 passed`; 1.1.2's RED is the recorded baseline. The one deviation is
that the two guard shapes were authored in a single edit (§7), which is why 1.2.3's RED was produced
by disabling the create guard rather than by never having written it.

---

## 5. Files changed

### `odp-docker` (`/home/danielblc/projects/odp-docker`, branch `master`, nothing committed)

| File | State | Lines |
|---|---|---|
| `ckan-docker/src/ckanext-umss/ckanext/umss/auth.py` | new | 190 |
| `ckan-docker/src/ckanext-umss/ckanext/umss/tests/test_auth.py` | new | 329 |
| `ckan-docker/src/ckanext-umss/ckanext/umss/plugin.py` | modified | +15 / −2 = 17 |
| `ckan-docker/src/ckanext-umss/ckanext/umss/tests/test_plugin.py` | modified | +6 / −0 = 6 |
| **subtotal** | | **542** |

### `odp` (`/home/danielblc/projects/odp`, nothing committed, no portal source touched)

| File | State | Lines |
|---|---|---|
| `openspec/changes/2026-09-13-publication-lifecycle/probe.sh` | new (executable) | 373 |
| **subtotal** | | **373** |

**PR 1 authored total: 915 changed lines** (pristine tree confirmed: `git status --short` in
`odp-docker` lists exactly the four files above and `odp` lists only `probe.sh` plus this report).

Nothing in `odp`'s `src/`, `openspec/specs/**`, `BACKLOG.md`, `PRD.md`, `design.md`, `proposal.md`,
`tasks.md` bodies or `specs/**` was modified; `tasks.md` received checkbox marks only (§9).
`odp-docker`'s compose files, Dockerfiles, `.env`, nginx and postgresql directories are untouched.

---

## 6. Review-workload analysis — the budget is exceeded, and it is not shaveable

`tasks.md` forecast "PR 1 ≈ 190 (`odp-docker`)" and did **not count `probe.sh` at all**. Actual:

| Slice | Lines | Note |
|---|---|---|
| `probe.sh` | 373 | demanded by 1.4.1; 25 asserted checks + self-cleanup; already table-driven |
| `tests/test_auth.py` | 329 | 21 tests for the ~20 shapes enumerated by 1.2.1/1.2.3/1.2.5 (~15 lines/test) |
| `auth.py` | 190 | two guards, three helpers, the module and function docstrings |
| `plugin.py` + `test_plugin.py` | 23 | registration + the baseline fix |

Nothing here is padding: the budget cannot be met by deleting comments, blank lines, docstrings or
tests, and doing so is explicitly not allowed. A `size:exception` is therefore **recommended and not
assumed**. If the maintainer prefers a split, the natural seam is two PRs in `odp-docker`
(`probe.sh` + baseline fix first, then `auth.py` + tests + registration) — the halves are
independently revertable and neither is a substitute for the other.

---

## 7. Deviations from the design and from the task order

1. **Ordering:** `plugin.py` registration landed with 1.2.2 instead of 1.3.1 (§1.2.2 above). Reason:
   an unregistered guard is unreachable from any action call, so 1.2.2's proof is impossible without
   it.
2. **`_as_bool` semantics:** mirrors `boolean_validator` exactly instead of "return None for
   unrecognized values" (§3.3). This is the one deliberate departure from the D3 rule text, and it is
   the difference between enforcing the change and leaving a one-call bypass.
3. **`@auth_allow_anonymous_access` added** to both guards (§3.4) — an addition to D3, not in it.
4. **Test harness:** `logic.get_action(context, data)` instead of `helpers.call_action` (§3.2).
5. **`probe.sh` gained two rows** (`P4d` `private: 'banana'`, `P4e` `private: ''`) that are not in
   `design.md`'s step table. They exist to measure §3.3 in the running deployment, and the file
   documents them as additions.
6. **`probe.sh` P7's arithmetic** counts datasets that are public **and** `state=active`, because a
   `state=draft` dataset is public in the database yet absent from the catalogue — otherwise P7 would
   depend on whether the `state` row had already run.
7. **`docker restart` performed** (authorized) even though the measurement showed it is not needed
   (§2). It produced the design's prescribed proof, and it exposed §3.6.

---

## 8. Risks and decisions owed

| # | Risk / decision | Severity | Detail |
|---|---|---|---|
| R1 | **The dev database was wiped by the prescribed test command** | High — needs a maintainer decision | §1. Seeded content not restored; orphaned Solr documents remain (57 visible vs 1 row). Restore commands given verbatim. The suite must not be run in this image again. |
| R2 | `spec.md`'s "an unrecognized value defers to core CKAN" is unsafe as written | High — blocks verify | §3.3. The spec asserts a core validation error that does not exist; following it publishes the dataset. The guard refuses instead. The clause needs amending before verify can call the spec satisfied. |
| R3 | **PR 1 is 915 lines against a 400 budget** | High — needs a decision | §6. `size:exception` recommended, never inferred. |
| R4 | The next `docker restart` of the dev CKAN container will crash-loop again | Medium | §3.6. Only fixable in `.env`/compose/image files that are out of this pass's scope. |
| R5 | `probe.sh`'s `P0`/`P9.1` baseline reads 57 because of R1 | Low, explained | The assertion is "back to its own pre-run value"; the value is no longer the designed 16. |
| R6 | CKAN's test harness disables non-system plugins unless a test asks for `with_plugins` | Low, handled | The module's `pytestmark` sets `ckan.plugins=umss` and uses `with_plugins`, so registration is exercised. |
| R7 | The chained guard loses core's `auth_allow_anonymous_access` unless declared | Low, handled | §3.4. |
| R8 | Editors lose the ability to change `state` (design already accepts this) | Accepted | Measured P4a: they could before. `package_delete` and metadata edits still work; the probe and tests pin that. |

## 9. Structured status consumed

- Native status JSON consumed: `artifactStore: openspec`, `applyState: ready`,
  `actionContext.mode: repo-local`, `workspaceRoot: /home/danielblc/projects/odp`,
  `allowedEditRoots: ["/home/danielblc/projects/odp"]`, `taskProgress 0/24`.
- `actionContext` warning: PR 1 deliberately writes **outside** `allowedEditRoots`, into
  `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss/**`. That authority comes from the
  explicit human grant recorded in the session prompt, not from the harness root, and it was not
  extended: no other path in `odp-docker` was written.
- Review-workload gate read from `tasks.md`: `Decision needed before apply: No`,
  `Chained PRs recommended: Yes`, `Chain strategy: pending`, `400-line budget risk: Low`. The parent
  prompt resolved the slice as PR 1 only, so no chained/stacked mode was invented; the budget risk
  turns out **High**, not Low (§6).
- `gentle-ai sdd-attempt status` showed an active attempt for this work unit
  (`PR1 enforcement guard in ckanext-umss`, `max_attempts: 2`, `max_changed_lines: 400`); it was
  continued rather than re-acquired.

---

# PR 2 — Portal affordance (`odp`), tasks 2.1–2.2

**Scope of this pass:** the API surface (`publish()`) and the affordance component
(`PublishControl.svelte`) plus its playground. Tasks 2.3 (dataset-page wiring), 2.4 (copy + delete the
playground) and 2.5 (PR 2 verification) are **not started**. Nothing was committed; everything lives in
the working tree.

| Task | Deliverable | State |
|---|---|---|
| 2.1.1 | RED tests for `publish()` in `src/lib/api/datasets.test.ts`; RED recorded | done |
| 2.1.2 | `publish(id)` added, dead `setState` removed; GREEN recorded | done |
| 2.2.1 | RED component tests for every row of D5 in `PublishControl.test.ts`; RED recorded | done |
| 2.2.2 | `PublishControl.svelte` implemented; GREEN recorded | done |
| 2.2.3 | Playground `src/routes/dev/dataset-publish/+page.svelte` built | **delivered, checkbox left unchecked — its proof is the human review, which has not happened yet** |

## 10. Task 2.1 — `publish()` and the removal of `setState`

`src/lib/api/datasets.ts` now exposes exactly one publish path:

```ts
async publish(id: string): Promise<CkanPackage> {
    return client.post<CkanPackage>("package_patch", { id, private: false });
},
```

- The wire call is the stock `package_patch` with **only** `{id, private: false}`; the test asserts
  equality on the whole params object, so an added `state` key or a renamed action fails it.
  No extension-defined action name is used (asserted with `not.toMatch(/publish|umss/i)` on the action).
- The method returns CKAN's response verbatim. A `200` whose body still reports `private: true` is
  returned as-is; the API never rewrites the result (test: "devuelve la respuesta de CKAN sin asumir el
  resultado"). A `403` propagates as `CkanApiError` instead of being swallowed.
- `setState(id, state)` was removed. **The dead-code claim in the design was re-verified before removal:**

  ```
  $ grep -rn "setState" src/
  src/lib/api/datasets.ts:88:   async setState(id: string, state: "active" | "deleted" | "draft"): Promise<CkanPackage> {
  ```

  That is its own definition and nothing else — no caller, no test reference. Rationale for removing it
  rather than leaving it: after PR 1, `package_patch {state}` is exactly what the new CKAN rule refuses
  for a non-approver, so a helper that posts it is a loaded footgun, and its `"draft"` vocabulary belongs
  to the state machine this slice explicitly defers. The removal is also pinned by a test
  (`expect(api.setState).toBeUndefined()`), so it cannot silently come back.

## 11. Task 2.2 — `PublishControl.svelte`

Props (all optional except the dataset, so the page wiring of task 2.3 is a one-liner):

| Prop | Type | Default |
|---|---|---|
| `dataset` | `CkanPackage` | required |
| `publish` | `(id: string) => Promise<CkanPackage>` | real `createDatasetApi(client).publish` |
| `listAdminOrganizations` | `() => Promise<CkanOrganization[]>` | real `createOrganizationApi(client).listForUser("admin")` |
| `onpublished` | `(dataset: CkanPackage) => void` | — |
| `class` | `string` | `""` |

The defaults build their own client with `env.CKAN_URL` and `apiKey: () => get(auth).token`, the same way
the dataset page and the wizard do. Injection exists for the playground and the tests; the page needs
nothing.

**Approver hint.** One call, `listForUser("admin")`, and membership is tested against
`dataset.organization.id` — never against "the list is non-empty", and never against an unfiltered
`organization_list`. Three fail-closed paths: the call rejects, the dataset carries no organization (the
hint is not even attempted), and the list does not contain the dataset's org. While the hint is in
flight nothing is offered.

**No optimistic state.** `handlePublish` replaces the rendered dataset **only** when the response reports
`private === false`, and only then calls `onpublished`. Every other outcome leaves the dataset as it was:

| Response | What is rendered |
|---|---|
| `200`, `private === false` | The control disappears (the dataset is now public); `onpublished(response)` fires |
| `200`, `private !== false` | Alert "El catálogo no confirmó la publicación."; still private, control offered again; `onpublished` not called |
| `403` (`CkanApiError`) | Alert "Solo un administrador de la organización puede publicar este dataset."; control re-enabled; still private |
| Any other failure | Alert "No se pudo publicar el dataset: <message>" with a working "Reintentar" |
| In flight | Button disabled, labeled "Publicando…", no alert, no success indicator |

### D5 row → test map (`src/lib/components/dataset/PublishControl.test.ts`, 14 tests)

| D5 situation | Test |
|---|---|
| Already public → nothing, no unpublish control | "un dataset ya público no renderiza nada…" |
| Private + approver → control + consequence sentence | "privado + aprobador: ofrece el control y enuncia la consecuencia" |
| Private + non-approver → no control + who can publish | "privado + no aprobador…" |
| Filtered list is still cross-checked by org id | "una lista de organizaciones de otro id no es prueba de aprobación" |
| No organization → fails closed | "sin organización en el dataset la verificación falla cerrada" |
| Hint call failed → no control + explicit state + retry | "privado + verificación fallida: estado explícito con reintento…" |
| Nothing offered while the hint is unresolved | "mientras la verificación está en curso no ofrece el control" |
| Hint asks with `permission: "admin"` | 'el wiring por defecto pide las organizaciones con `permission: "admin"`' |
| Click → `200` confirmed → dataset replaced by CKAN's response | "llama a publish con el id del dataset y muestra el resultado como éxito sólo si CKAN confirmó" |
| Click → default wiring publishes against the portal API | "si el wiring por defecto se usa, publica contra la API del portal" |
| Click → `403` → refusal alert, control offered again, still private | "403: alerta de rechazo…" |
| Click → `200` without granting | "200 sin confirmar…" |
| Other failure → explicit error with retry | "otro fallo: error explícito con reintento que vuelve a intentar" |
| Pending → busy, no success indicator | "en vuelo: el control reporta ocupado y no anuncia éxito" |

### Strict TDD cycle evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 2.1 | `src/lib/api/datasets.test.ts` | Unit | ✅ 7/7 — the HEAD version of that file was run with the working tree stashed (`pnpm vitest run src/lib/api/datasets.test.ts` → `Tests 7 passed (7)`), then the stash was popped and every file compared byte-identical against a backup | ✅ Written — `publish` did not exist: `Test Files 1 failed (1)`, `Tests 5 failed \| 7 passed (12)`: 4× `TypeError: api.publish is not a function` and 1× `expected [AsyncFunction setState] to be undefined` | ✅ Passed — `Tests 12 passed (12)` after adding `publish` and deleting `setState` | ✅ 5 cases: exact `{id, private: false}` equality, no `state` key and no extension action name, CKAN's response returned unchanged when it still reports `private: true`, `403` propagates, `setState` gone | ➖ None needed — one method, one line of logic, plus its doc comment |
| 2.2 | `src/lib/components/dataset/PublishControl.test.ts` | Unit with injected stubs (this repository declares no integration and no E2E runner — `openspec/config.yaml` `layers.integration: ""`, `layers.e2e: ""`) | N/A (new file) | ✅ Written — the component did not exist: `Failed to resolve import "./PublishControl.svelte"`, `Tests no tests` | ✅ Passed — `Tests 14 passed (14)` on the first GREEN run | ✅ 14 cases, one per D5 row, plus the two default-wiring cases. **Mutation control:** `if (respuesta.private === false)` was temporarily replaced by `if (true)` (every `200` treated as success) and `pnpm vitest run … -t "200 sin confirmar"` then failed (`Test Files 1 failed`, timing out waiting for the "El catálogo no confirmó la publicación." alert); the component was restored from a byte-identical backup and the suite re-run green. The no-fabricated-publication test is load-bearing, not a smoke test | ➖ None needed beyond the `biome check --write` formatting pass, after which both focused suites and the full suite were re-run |

### Test summary

- Tests written in this slice: **19** (5 API + 14 component).
- Focused runs: `datasets.test.ts` 12/12; `PublishControl.test.ts` 14/14.
- Full suite after the slice: **321 passed / 321** in 31 files (recorded baseline 302 → +19; nothing removed, skipped or marked todo).
- Layers used: Unit 19, Integration 0, E2E 0 — the repository has no integration or E2E runner, so coverage degrades to unit with injected stubs, and the component test file's header says so.
- Approval tests (refactoring): none — this slice contains no refactoring task.
- Pure functions created: 0 — the slice is one HTTP wrapper and one stateful Svelte component; purity was not forced.
- Assertion quality: every assertion exercises the production code and pins a specific value — accessible names (`Publicar dataset`, `Reintentar`, `Publicando…`), `role="alert"` text, the disabled state, the exact request payload, and the identity of the object handed to `onpublished`. No Tailwind class or internal state is asserted.

## 12. Files changed (authored line counts, for the 400-line budget)

| File | Change | Lines |
|---|---|---|
| `src/lib/api/datasets.ts` | `publish()` added, `setState()` removed | +11 / −3 |
| `src/lib/api/datasets.test.ts` | 5 new tests | +64 / −0 |
| `src/lib/components/dataset/PublishControl.svelte` | new | 204 |
| `src/lib/components/dataset/PublishControl.test.ts` | new, 14 tests | 299 |
| `src/routes/dev/dataset-publish/+page.svelte` | new playground (review material, **not to be committed**) | 245 |

**Authored total: 823 added lines** (826 counting the 3 deletions), of which 245 are playground review
material. Excluding the playground the slice is **578 lines** — still **over the 400-line budget**.

Nothing was compressed to fit: no comment, blank line, test or doc sentence was deleted or restyled to
reach the number. The irreducible parts are the 14 D5-row tests (299 lines, ~20 lines per row, each row a
required behavior) and the component's four render states plus the hint/publish state machines (204
lines, of which ~45 are the explanatory comments that make the fail-closed rules auditable). The API half
(75 lines) is already minimal: one method, one strict equality assertion, one dead-code assertion.
**Recommendation: `size:exception` for this slice, or split PR 2 so 2.1 lands alone and 2.2 lands with
its playground.** Not inferred, not self-granted — the maintainer decides.

## 13. Playground and the open human gate (task 2.2.3)

`src/routes/dev/dataset-publish/+page.svelte` renders the **real** component with ten switchable
scenarios: already public; private + approver; private + non-approver; hint failure (fails once, then
succeeds, so the retry is visible); hint in flight; `403`; `200` unconfirmed; `200` confirmed; other
error; in flight. The page owns a fixture dataset, shows its `Privado`/`Público` badge and passes
`onpublished` back into it, so the reviewer can see that the badge flips **only** on CKAN's confirmed
response. It is untracked and is review material: it must not be committed, and task 2.4.3 deletes it
after promotion.

**Task 2.2.3 stays unchecked on purpose.** Its stated proof is the user reviewing every state and saying
it is ready to promote. That review has not happened, so the task is delivered but not complete, and
promoting to the real page before it passes is exactly what the task forbids.

## 14. Gates run

| Command | Result |
|---|---|
| `pnpm vitest run src/lib/api/datasets.test.ts` | 12 passed (RED first: 5 failed) |
| `pnpm vitest run src/lib/components/dataset/PublishControl.test.ts` | 14 passed (RED first: import failure) |
| `pnpm test` | **31 files, 321 tests passed** — baseline was 302, so +19 (5 API + 14 component) |
| `pnpm check` | **0 errors**, 4 warnings in 3 files — all four pre-existing (`ThemePlayground.svelte` ×2, `SearchBar.svelte`, `tsconfig.json`); none from the new files |
| `pnpm lint` | exit 0: 0 errors, 4 warnings, 7 infos (all pre-existing/style warnings). Biome initially flagged 4 `format` errors in the new files; they were fixed with `biome check --write` on those five files only |
| `pnpm build` | succeeded (`adapter-node`, `✔ done`) — the new playground route compiles |

## 15. Deviations from the tasks/design text (stated, not hidden)

1. **The component's API access is injectable.** The task did not say how `PublishControl` reaches the
   API. It takes optional `publish` / `listAdminOrganizations` props whose defaults are the real APIs.
   Without that, every D5 row would need module mocking and the playground could not simulate a `403`, a
   `200` without a grant, or an error. Two tests exercise the default wiring so the injection cannot
   become the only tested path.
2. **New copy not in D5, flagged for review.** The in-flight hint state renders "Verificando su permiso…",
   which D5 does not specify (D5 only specifies the failure state). It is neutral, offers nothing, and
   exists so that "nothing is offered before confirmation" is visible rather than a blank space. If the
   reviewer prefers silence or a spinner, it changes in the playground.
3. **No success message on a confirmed publication.** D5 says the badge flips to "Público"; it does not
   ask the control to congratulate. The component renders nothing once CKAN confirms, and the page's badge
   is the confirmation. Inventing a success string would be copy the slice did not approve.
4. **`dataset.organization` missing → unavailable, without even calling the hint.** D5 names only the
   "hint call failed" case; with no organization there is no predicate to evaluate, so the affordance
   fails closed. Tested.
5. **`403` is recognized by `CkanApiError.status`.** A structurally different error object with a
   `403`-like shape would fall into the generic error state. That is deliberate: the only producer of a
   `403` here is `createCkanClient`, which throws `CkanApiError`; the test uses the real class.

## 16. Structured status consumed

- Native status JSON consumed: `artifactStore: openspec`, `changeName:
  2026-09-13-publication-lifecycle`, `applyState: ready`, `nextRecommended: apply`,
  `taskProgress 12/24`, `actionContext.mode: repo-local`, `workspaceRoot` and `allowedEditRoots` both
  `/home/danielblc/projects/odp`.
- No `actionContext` warning for this pass: every file written is inside `allowedEditRoots`, and the
  forbidden surfaces (`src/routes/dataset/[id]/+page.svelte`, the wizard copy, `design.md`,
  `proposal.md`, `specs/**`, `BACKLOG.md`, `openspec/specs/**`) were not touched.
- Review-workload gate re-read: `Decision needed before apply: No`, `Chained PRs recommended: Yes`,
  `Chain strategy: pending`, `400-line budget risk: Low` (per-PR forecast). The parent prompt resolved
  this slice as "PR 2 tasks 2.1 and 2.2 only", which is the delivery path consumed; no chain label was
  invented. Measured risk for the slice is **High** (§12).
- **Post-settle artifact drift (recorded).** The attempt settled `passed` with `changed_lines: 1036` and `changed_line_budget_exceeded: true`; `apply-progress.md` was amended once **after** that settle, to adopt the strict-TDD support module's required evidence-table format and to add the retrospective safety-net run. The working tree therefore no longer matches the settled attempt's `finish_candidate_tree`. The cause is recorded here so a maintainer's `sdd-attempt reset` sees the real reason and not an unexplained drift.
- `gentle-ai sdd-attempt acquire` was called with the already-active token
  (`sha256:aa4793c1…`, work unit `PR2 portal publish affordance`, `max_attempts: 2`,
  `max_changed_lines: 400`) and answered `proceed`; that exact attempt was continued, not re-acquired.

## 17. Risks and decisions owed (PR 2 slice)

| # | Risk / decision | Severity | Detail |
|---|---|---|---|
| S1 | The slice is 823 authored lines vs a 400 budget | High — needs a decision | §12. `size:exception` recommended, or a 2.1/2.2 split. Never inferred. |
| S2 | Task 2.2.3's human review gate is open | Medium — blocks promotion | §13. The playground must be reviewed at `http://localhost:5173/dev/dataset-publish` before 2.3 wires the real page; 2.2.3 stays unchecked until then. |
| S3 | The happy path cannot be proven by `pnpm test` | Medium | Vitest cannot execute Python and the repository has no integration or E2E runner. The portal half is proven only for honesty (what it renders given a response); a real end-to-end confirmation needs PR 1 deployed and is task 2.5.2. |
| S4 | PR 1 was blocked on the maintainer's own decisions (R1–R3 in §8) | Medium — inherited | PR 2 does not depend on those decisions to land, but its `403` path is the only one that is real today: without PR 1 the affordance is an advisory button, which the proposal's D1 rejects. |
| S5 | PR 1's dev database wipe (R1) and the orphaned Solr documents are still unrepaired | High — inherited, out of this slice | Nothing in this pass touches CKAN or its data; it was not run against the stack. |
