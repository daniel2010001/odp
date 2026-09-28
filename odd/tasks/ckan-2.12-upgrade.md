# Feature: CKAN 2.12 upgrade (dev stack)

**Status:** planned, **not executed** — the plan is awaiting the author's review.
**Lives here** (the portal repo, which is versioned) even though every edit in it lands in
`../odp-docker`: in that repository `odd/` is excluded through `.git/info/exclude`, so a plan
written there would not travel with the repo. Its two existing task files (`ci-checks.md`,
`umss-test-target-guard.md`) are unversioned for the same reason.
**Branch:** none yet (see S0: the branch must not mix with the pending fixes).
**Started:** 2026-09-24 · **Owner:** author (executes) + agent (prepares and measures)

## Goal

Move the development stack from CKAN **2.11.6** to **2.12.x**, with the portal's
measured assumptions re-verified against the new version, and without carrying
2.11-specific evidence into `v1`.

## Why

1. **Security is NOT the trigger.** Measured on 2026-09-24: the eight advisories
   announced with 2.12.0 (`GHSA-8frv-ccr7-4m2p`, `GHSA-5r6j-4c43-7mx6`,
   `GHSA-73fv-x47v-f4j5`, `GHSA-8hw7-23gj-5599`, `GHSA-3g5q-3wf6-p8rc`,
   `GHSA-6499-jgj4-2wpf`, `GHSA-jgwg-vp4m-5xw5`, `GHSA-p5rh-49m9-56vx`) are listed
   **in the 2.11.6 changelog too**. The running version is already fixed. Staying
   on 2.11.x is a patched position, not a debt.
2. **The real driver is the file/upload rework.** 2.12 makes files first-class
   entities: `Upload` and `ResourceUpload` are replaced by `FKUpload` and
   `FKResourceUpload`, configurable storages are introduced, and there are new file
   management API actions. That is exactly the portal's core domain (upload,
   download URL, preview embed). If the portal has to adapt, adapting now is
   cheaper than adapting after `v1` is built on top of 2.11 semantics.
3. **Waiting has a compounding cost.** The portal already carries 2.11-measured
   evidence in at least four places (see S5). Every new session adds more.
4. **There is a feature win:** DataStore gains range/nested filters and keyset
   pagination (`next_page`), which the preview panel could use.

## Measured basis (2026-09-24)

| Reading | Result |
|---|---|
| Running CKAN | **2.11.6** — `pip show ckan`, tag `ckan-2.11.6`, commit `a22d245`, editable at `/srv/app/src/ckan` |
| Latest 2.11 patch | **2.11.6** is the newest of its line (released 2026-08-26, same day as 2.12.0; 2.10 also got 2.10.11) |
| 2.12 release | **2.12.0**, 2026-08-26, stable |
| Python in the 2.12 images | tags are `2.12-py3.14` / `2.12.0-py3.14`; 2.10 and 2.11 publish `py3.10`. The changelog says "CKAN 2.12 supports Python 3.10 and later" |
| `site_packages` volume path | `ckan-docker/docker-compose.dev.yml:31` → `/usr/local/lib/python3.10/site-packages`; `ckan-docker/docker-compose.yml:47` → `/usr/lib/python3.10/site-packages`. Both are py3.10-specific |
| Solr image | `ckan/ckan-solr:2.12-solr9` exists; this stack uses `SOLR_IMAGE_VERSION=2.10-solr9` with a 2.11 CKAN — **that pairing is upstream's own** (its `.env.example` on `master` says the same), so it is not a local mistake |
| Datapusher image | `ckan/ckan-base-datapusher` publishes only `0.0.21`/`0.0.20`/`0.0.19`/`0.0.18` — **no per-CKAN-version tags**, so `DATAPUSHER_VERSION` does not change |
| PostgreSQL | running **16.15** (`ckan-docker/postgresql/Dockerfile` → `postgres:16-alpine`), not the upstream `ckan-postgres-dev` image ⇒ unaffected by the upgrade |
| Upstream packaging | `ckan/ckan-docker` **has no tags**, and its `master` is still `FROM ckan/ckan-base:2.11`. Going to 2.12 means **we** carry the packaging |
| 2.12 requirements | "requires a requirements upgrade on source installations", "requires a database upgrade with `ckan db upgrade`", "requires the DataStore database to be updated by running the SQL script produced by `ckan datastore set-permissions`" |
| Behaviour change that touches the portal | 2.12: "The internal `allow_partial_update` context parameter has been removed. Now normal API users may call `package_update` without passing resources and the existing resources will remain untouched instead of being deleted." Plus "unchanged resources are no longer revalidated" (#5713) |
| Another behaviour change | "Sysadmins can no longer demote themselves or the system user" (#8155) |
| CI pin | the `umss-tests` job runs on `ckan/ckan-dev:2.11` |

## Scope

- **In:** the four CKAN Dockerfiles, `SOLR_IMAGE_VERSION`, the `site_packages`
  volume paths, the CI job, and a re-measurement pass over the portal's documented
  2.11 assumptions.
- **Out:** the portal's UI, the production stack (which does not exist yet), the
  A/B public-origin decision, and the auth hardening (separate backlog item — see
  `BACKLOG.md`).

## Slices

### S0 — close the pending work first (do not mix) — **DONE 2026-09-24**

The leak fix, the `$host` → `$http_host` proxy fix and the `CKAN_VERSION` cleanup were
committed on `master` as three units — `9857186`, `44ac587`, `a128b4f` — and the
branch `feat/ckan-2.12-upgrade` was cut from that clean tree, so the upgrade diff
carries no foreign changes.

**Still pending, and best done with the fresh volume:** rotating the secrets that
were published on the LAN while the DebugToolbar was up. Measured scope: **the whole
`.env`**, not just the database — the config table exposed
`api_token.jwt.encode.secret` and `decode.secret` (enough to forge an API token for
any user), `SECRET_KEY`, `WTF_CSRF_SECRET_KEY`, `beaker.session.secret`, the
DataPusher token, the three database passwords in clear text and the sysadmin
password. `down -v` in S4 regenerates the ini-derived ones on its own (`SECRET_KEY`,
`WTF_CSRF_SECRET_KEY` and both JWT secrets are written back only when empty) and the
DataPusher token is re-minted at every start, so what remains is a single `.env`
edit: the three password keys plus their six echoes inside the `postgresql://` URLs
(lines 8, 12, 15, 17-19, the `TEST_*` group) and the sysadmin password.

### S1 — the official 2.12 migration notes — **READ 2026-09-24**

Read from the release's own `CHANGELOG.rst` (`.. _migration-notes-2.12:`), not from the
docs page: every historical release's notes sit on one URL, which makes matching a
heading to the wrong version the obvious mistake. **The newest 2.12 release is
2.12.0** — there is no 2.12.x patch yet, so the target is exactly one minor ahead of
the running 2.11.6.

What 2.12 actually requires:

- **`migrate_package_activity.py` and the revision tables were removed** (#8319):
  revision data must be migrated to activities **before** upgrading, "or the revision
  history will be lost". Irrelevant in dev (fresh volume, disposable data), **but it is
  a production precondition and it must not be forgotten there.**
- **`ckan datastore set-permissions` must be re-run** against an existing datastore
  database, to define the new `fast_table_row_count` function (#9234). The dev
  entrypoint already runs it on init, so a fresh volume covers it.
- **The unique user email index is now case insensitive** (#9178): on a site with data,
  run `ckan db duplicate_emails` first.
- **Minimum Python is 3.10** (#8998), so the py3.14 image is the default build, not a
  floor we need to meet.
- **Extensions must include the CSRF snippet in their forms**, and
  `ckan.csrf_protection.ignore_extensions` was removed (#8918). That is the warning the
  dev stack prints today. **Checked: `ckanext-umss` ships no templates and no forms,
  and the option is not in our config — nothing to do.**

Removals that could have hit this stack, and did not: the `PackageExtra` / `GroupExtra`
tables (#8273), `IDomainObjectModification.notify_after_commit()`, `Package.is_private`,
`h.truncate()`, `context["model"]` (deprecated, not removed), the `/api/1/snippet`
endpoint, and the blocks moved out of `templates/package/search.html`. A keyword pass
over `ckanext/umss/auth.py` found no use of any of them; the extension's own suite is
the confirmation, not the grep.

**The `who.ini` / `resource.config` / Activity Stream notes belong to much older
releases** — verified: those keywords have **zero occurrences** inside the 2.12.0
block. Do not apply them.

### S2 — decide the image pinning policy while changing the `FROM` line anyway

Today the four Dockerfiles float on the minor (`2.11`), which is deliberate: it
picks up patch releases without a commit, at the cost of byte-level
reproducibility. The `FROM` line changes in this slice regardless, so it is the
natural moment to decide. Either answer is defensible; it must be written down
next to the line.

### S3 — the image and volume changes — **DONE 2026-09-24** (except `.env`)

1. The four `FROM` lines and the comment in `Dockerfile.umss` → `2.12`, floating on the
   minor per S2.
2. `SOLR_IMAGE_VERSION` → `2.12-solr9`. **Author applies this one** (see below).
3. **The two `site_packages` targets.** Measured, not assumed: both 2.12 images run
   Python **3.14.7** and their path is `/usr/local/lib/python3.14/site-packages` (the
   local 2.11 dev image reports `/usr/local/lib/python3.10/site-packages`). The prod
   line was **wrong in two ways** — `/usr/lib/python3.10/...` instead of
   `/usr/local/lib/python3.10/...` — so that volume has been shadowing a directory no
   interpreter uses: a silent no-op. Both now point at the measured path.
4. `.github/workflows/checks.yml`: the `umss-tests` job moves to `ckan/ckan-dev:2.12`,
   `ckan/ckan-solr:2.12-solr9` and `ckan/ckan-postgres-dev:2.12`.
5. `ckan-docker/README.md`: it only carries upstream's own examples ("a different
   image eg `ckan/ckan-base:2.10.5`"), so there was nothing of ours to update.

**Deliberately not touched:** `ckan-docker/src/ckanext-umss/.github/workflows/test.yml`,
which still pins 2.11. It is a vendored copy of the extension's upstream CI and GitHub
never runs it here (it is outside the repository root's `.github/workflows/`), so
bumping it would deepen the drift from upstream for no gain.

`.env` and `.env.example` are **environment paths the agent cannot edit** (the harness
blocks them); the author applies those two files by hand.

### S4 — clean volume instead of a migration

`ckan db upgrade` and the `datastore set-permissions` script are for an install
with real data. Here the data is disposable, and a **fresh volume validates the
clean-install path**, which is what a new deployment would do anyway:

```sh
# from ../odp-docker
docker compose -f docker-compose.dev.unified.yml down -v   # destroys db, solr, ckan_storage
docker compose -f docker-compose.dev.unified.yml up -d --build
# the catalogue is repopulated by the portal's own seed script (idempotent)
CKAN_URL=http://localhost:5000 CKAN_SYSADMIN_NAME=ckan_admin \
  CKAN_SYSADMIN_PASSWORD=... node ../odp/scripts/seed-ckan.mjs
```

The seed script repopulates the catalogue, so **no dump/restore is needed**. A
`pg_dump` before `down -v` is cheap insurance only if the author wants to compare
old and new behaviour on the same data.

Note: the production upgrade, whenever it happens, **does** need `ckan db upgrade`
plus the datastore script, **plus `migrate_package_activity.py` run before the
upgrade** — 2.12 removes the revision tables, and skipping the activity migration
loses the revision history. This slice must not leave that impression behind.

### S5 — re-measure the portal's assumptions (the reason this slice exists)

Each item is a documented, measured behaviour that may have changed. Evidence is a
live probe, not a reading of release notes.

| # | Assumption in the portal | Where | What to check |
|---|---|---|---|
| 1 | A hosted resource's `url` is rebuilt by `resource_dictize` at read time, `[pkg]/resource/[rid]/download/[file]`, absolute, from `ckan.site_url` | `src/lib/components/resource/ResourcePreview.svelte`, `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte:314` | Highest risk: 2.12 introduces file entities and new file API actions |
| 2 | `user_show {}` with a dead token returns **404** (never 401/403) | `src/lib/api/session.ts` | Any auth-status change breaks the session probe |
| 3 | `api_token_create` requires `expires_in` + `unit` because `expire_api_token` is enabled | `src/lib/server/ckan-auth.ts` | That plugin must exist and behave the same |
| 4 | `package_update` semantics when resources are omitted | `src/routes/dashboard/datasets/new/+page.svelte` (wizard) | 2.12 removed `allow_partial_update`: absent resources are no longer deleted |
| 5 | Sysadmin automation (create/promote) | `ckan-docker/ckan/prerun.py`, seed script | 2.12 forbids sysadmin self-demotion |
| 6 | Login flow: session cookie + `X-CSRFToken` against `/api/3/action/api_token_create` | `src/lib/server/ckan-auth.ts` | Cookie auth on the API must still be accepted |
| 7 | `datastore_search` response shape | preview panel | New fields (`next_page`) are additive; verify nothing is positional |
| 8 | **The request `Host` is irrelevant to CKAN's own redirects** — 2.11 forced it from `ckan.site_url` for `/user/login\|logout\|logged_in\|logged_out` through `HostHeaderMiddleware`, which **2.12 removes** (#9123) | the `/api/` block of both nginx confs, which uses `$host` justified by exactly that measurement | Re-forge the `Host` on `POST /user/login` and see which origin the `Location` uses. If it now follows the request Host, `$host` turns into a login bug and the block needs `$http_host` |
| 9 | Validators see every resource | `ckanext-umss`, which chains the publication rule onto `package_create` / `package_update` | 2.12 no longer revalidates unchanged resources and omits them from the flattened data (#5713): a rule that reasons about *all* resources now sees only the changed ones |

Gates after the pass: `pnpm test`, `pnpm check`, `biome check`, and the
repository's own CI jobs.

### S6 — native review

The upgrade is a review candidate like any other slice, with its own `baseRef`.
Its risk tier will be driven by the image and volume changes plus whatever the
re-measurement forces in the portal.

## Known risks

- **`site_packages` mounted on a py3.10 path.** If the path is not updated, the
  image's own site-packages is shadowed by a volume built for another interpreter,
  and the failure mode is an import error at boot, not at build.
- **`ckanext-umss` on py3.14.** The extension is small (`auth.py`, `plugin.py`), so
  the risk is low but not zero; its test suite must pass on the new image.
- **DataPusher.** The image tag does not change, but the DataStore path changes
  upstream. Verify a real upload reaches `datastore_active: true`.
- **Solr configset change ⇒ reindex.** A fresh volume handles it, but the
  `search-index rebuild` step must be confirmed on a seeded catalogue.
- **Upstream drift.** `ckan-docker/` is a frozen upstream snapshot. Editing its
  Dockerfiles departs from upstream and makes future merges conflict — a reason to
  keep this slice's edits to the minimum the upgrade requires.
- **The portal's own measurements go stale silently.** That is risk #1 in S5, and
  the reason the re-measurement is not optional.

## Allowed edit surfaces

- `ckan-docker/ckan/Dockerfile`, `ckan-docker/ckan/Dockerfile.dev`,
  `ckan-docker/Dockerfile.umss`, `ckan-docker/Dockerfile.dev.umss`
- `ckan-docker/docker-compose.dev.yml`, `ckan-docker/docker-compose.yml`
- `ckan-docker/.env`, `ckan-docker/.env.example` — **author applies by hand**
- `.github/workflows/checks.yml`
- `ckan-docker/README.md`
- Portal side, only what the re-measurement forces: `src/lib/api/session.ts`,
  `src/lib/server/ckan-auth.ts`, `src/lib/components/resource/ResourcePreview.svelte`,
  `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`,
  `src/routes/dashboard/datasets/new/+page.svelte`

## Review status (2026-09-24) — **lineage 2 APPROVED**; lineage 1 orphaned

The slice went through the native review as its own candidate: lineage
`review-7e3ab346bc8b3f85`, tier **high**, 4 lenses (risk, resilience, readability,
reliability) plus one refuter run. It produced **one candidate-caused CRITICAL
finding**; the correction is applied and **not validated**.

**R4-001** (`ckan-docker/docker-compose.yml:47`, introduced, inferential) claims that
"CKAN 2.12 does not use Python 3.14, so the volume no longer covers the image's actual
site-packages… on container recreation the packages are missing and CKAN can fail to
import the `umss` extension".

- **Its premise is measured wrong.** `docker run --rm --entrypoint python
  ckan/ckan-base:2.12` reports **Python 3.14.7** and
  `/usr/local/lib/python3.14/site-packages`; the same probe on the local 2.11 dev image
  reports Python 3.10. The volume *does* cover the image's real path now — it did **not**
  before, when the target was `/usr/lib/python3.10/…`.
- **Its concern was real and unaddressed**, though: a *named* volume mounted over the
  interpreter's real site-packages means a **pre-existing, py3.10-populated volume**
  would sit at the new path and **hide** the image's packages — the same outage by a
  different route. `down -v` (S4) removes that volume, but the hazard returns on the next
  version bump.

**Correction applied** (plan accepted at 10 diff lines; the diff is exactly 10): the
volume is `site_packages_py314` in both compose files, with a one-line comment saying
why, so a stale volume can never be mounted at the new path.

**Blocked:** the provider then required a **targeted validation** of that correction, and
the provider-issued binding is rejected by **both** capture routes — one-slot
(`capture-binding-rejected`) and group (`capture-group-rejected`) — with *"unknown,
expired, or belong to different session routes"*. STATUS re-offered the same slot between
the attempts, and both attempts mutated nothing (`mutation_performed: false`). **No
verdict exists, so nothing is committed** and the lineage stays in `correction_required`.

### Outcome

- **Lineage `review-60ff70a8b0ca199c` (the corrected candidate): APPROVED**, acknowledged and
  burned (`gentle-ai.review-acknowledged/v1`). 4 lenses and **no refuter** — the group capture
  closed it, so the previous round's blocker did not recur on the renamed volume.
- **Three informational advisories**, all non-blocking and explicitly *not* a reason to re-review
  this candidate: `R2-001` (readability, `docker-compose.yml:48`), `R3-001` (reliability,
  `docker-compose.dev.yml:32`), `R3-002` (reliability, `docker-compose.yml:48`). The closure
  envelope exposes only id, lens, location and severity — not the text — and the reviewer states
  they are separate later work.
- **Lineage `review-7e3ab346bc8b3f85` (the pre-correction candidate) stays orphaned** in
  `correction_required`: its targeted validation was rejected by both capture routes and no
  recovery operation was available, so it produced no verdict and never will. Nothing depends on
  it, and the record is **left in place on purpose**: `ABANDON` discards the admitted findings
  (`discarded_work.findings_present`), and this lineage holds the only copy of six of them —
  cleaning the store would erase the evidence, not a dead transaction. The record is declared as
  debt instead, and the six findings are transcribed below because they exist nowhere else.

  | id | lens | severity | causal disposition | location |
  |---|---|---|---|---|
  | `R1-001` | risk | WARNING | introduced | `ckan-docker/docker-compose.yml:47` |
  | `R1-002` | risk | WARNING | introduced | `ckan-docker/docker-compose.dev.yml:31` |
  | `R4-001` | resilience | **CRITICAL** | introduced | `ckan-docker/docker-compose.yml:47` |
  | `R2-001` | readability | WARNING | introduced | `ckan-docker/docker-compose.yml:47` |
  | `R2-002` | readability | SUGGESTION | **pre-existing** | `ckan-docker/ckan/Dockerfile:1` |
  | `R3-VOLUME-PYTHON` | reliability | WARNING | introduced | `ckan-docker/docker-compose.yml:47` |

  Five of the six are the same concern — a volume target hard-coded to `python3.14` while nothing
  in the candidate established that the 2.12 image uses that interpreter — and it was resolved *in
  fact* by the correction lineage 2 approved. **`R2-002` is the one still open**, and it is a
  `pre-existing` follow-up: the CKAN release tag is a literal in eight places with no single source
  of truth. It is carried as its own item in `BACKLOG.md` rather than here.
  *(A closure envelope exposes only id, lens, location and severity for a finding, never its text;
  the disposition column above comes from the store record, not from the envelope.)*
- **Delivered.** The review gates *delivery*, not the files, so the commit was the author's call:
  the 8 files went in as `9cbdf25 feat(ckan): upgrade the stack to CKAN 2.12`, whose diff is the
  same **28 lines** — 15 insertions, 13 deletions — the provider froze for the approved candidate,
  and with the two files that later carried the tokens patch staged **hunk by hunk** so the commit
  reproducible the approved tree and nothing unreviewed. The slice reached `master` and the remote;
  see the delivery record at the end of this document.

## S4 + S5 executed (2026-09-24) — **the upgrade boots on 2.12**

`down -v` → `up -d --build` → re-seed, with `SOLR_IMAGE_VERSION=2.12-solr9` passed **as a shell
override on the compose invocation** (`docker compose` prefers the ambient value over `.env`), so
the target was verified whole without a second destroy. `.env` still says `2.10-solr9` and needs the
author's two-line edit to be reproducible.

Verified: **CKAN 2.12.0 on Python 3.14.7**, Solr `ckan/ckan-solr:2.12-solr9`, the fresh volume
`site_packages_py314` in use, `prerun` completed (datastore db, Solr schema, `ckan_admin` created and
promoted), catalogue re-seeded (**16 datasets / 5 orgs** — the earlier 17/7 included test datasets),
portal login works, and the DebugToolbar **still off** (`flDebug` 0, credentials 0) because the
entrypoint script survived the upgrade.

### Two findings S4 produced — neither could come from the review

1. **CRITICAL for production: the healthcheck command no longer exists.** The 2.12 images have **no
   `wget`**, so the healthcheck every compose file uses
   (`test: ["CMD", "wget", "-qO", "/dev/null", "http://localhost:5000…"]`) returns **rc=127** and CKAN
   reports `unhealthy` while serving fine. In dev that is a broken signal; **in production
   `nginx` has `depends_on: ckan: condition: service_healthy`, so nginx would never start — a full
   outage on the first deploy.** Fix: a probe that exists in the image, e.g.
   `python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/…')"`, in
   `ckan-docker/docker-compose.dev.yml` **and** `ckan-docker/docker-compose.yml`.
2. **The entrypoint's last step now fails:** `PermissionError: [Errno 13] Permission denied:
   '/srv/app/src/ckan/test-core.ini'` — in 2.12 that file is no longer writable by the container
   user, so `start_ckan_development.sh` cannot refresh the test config. It is not fatal (the script
   has no `set -e` and the server starts), but the dev test wiring goes stale, which touches the
   `test-umss` flow.

Also noted: `down -v` left `odp-dev_site_packages` behind — the *old* volume name, now unreferenced,
which is exactly the staleness the S4 correction was about.

### S5 re-measurement, partial

| # | Assumption | Result on 2.12 |
|---|---|---|
| 1 | Hosted resource `url` is rebuilt as `[pkg]/resource/[rid]/download/[file]`, absolute, from `site_url` | **Unchanged.** A real multipart upload returned `http://192.168.1.201:5000/dataset/<pkgid>/resource/<rid>/download/probe-s5.csv` with `url_type: upload` — the portal's embed and download button keep working |
| 2 | `user_show {}` with a dead token returns 404 | **Unchanged.** Junk token → 404, valid token → 200 |
| 3 / 6 | `api_token_create` needs `expires_in` + `unit`; cookie + `X-CSRFToken` on the API | **Works.** The re-seed used that exact flow and the portal login returned a token |
| 5 | Sysadmin automation | **Works.** `prerun` created and promoted `ckan_admin` |
| 8 | CKAN's own redirects ignore the request `Host` (the middleware 2.12 removed) | **Unchanged.** `POST /user/login` with a forged `Host: nada.example` still returns `Location: http://192.168.1.201:5000/dashboard/datasets`, i.e. from `site_url` — so the `$host` choice in the `/api/` blocks stays correct |
| — | DataPusher → DataStore | **Works.** The probe CSV reached `datastore_active: true` |

Not measured: #4 (`package_update` semantics, needs the wizard), #7 (`datastore_search` shape in
depth), #9 (validators receiving only changed resources — needs the extension's own suite).

### Still open

- ~~The healthcheck fix (finding 1)~~ — **closed** by `f37aac3`: both CKAN probes now use
  `python3 -c "import urllib.request; ..."` with an explicit 5s timeout, on the argument that
  Python cannot be missing while CKAN runs whereas `wget` is the proof that incidental tools
  disappear between image tags. Verified live: the container reports `healthy` after ~2 intervals.
- ~~`SOLR_IMAGE_VERSION=2.12-solr9` in `.env`/`.env.example` + the stale comment at `.env:31`~~ —
  **closed** by `5d47358`, applied by the author. Verified after recreating Solr with no shell
  override: the container runs `ckan/ckan-solr:2.12-solr9` and the core's `managed-schema`
  (`598a71da…`) matches the image's, where the two tags differ (`f0f5225a…` in 2.10-solr9).
- Rotating the secrets that the DebugToolbar published; the fresh volume already regenerated the
  ini-derived ones, so what remains is the passwords in `.env`. **Still open.**
- ~~The 8 files (28 diff lines) are **approved but still uncommitted**~~ — **delivered** in
  `9cbdf25` and pushed.

### Reported by the author after the upgrade: the native tokens page is broken (upstream bug)

`/user/<name>/api-tokens` returns **500**:
`jinja2.exceptions.UndefinedError: 'dict object' has no attribute 'plugin_extras'`.

The chain, measured:

- The template that fails is **CKAN's own bundled extension**:
  `ckanext/expire_api_token/templates/user/snippets/api_token_list.html` — tracked in the release
  (`git ls-files` at tag `ckan-2.12.0`, unmodified) — overriding the core snippet and reading
  `token.plugin_extras.expire_api_token`.
- **2.12 stops providing it — in the VIEW, not in the dictize.** `api_token_dictize` is
  **identical in 2.11 and 2.12**: it pops `plugin_extras` and re-adds it **only when
  `context['include_plugin_extras']` is set**. What changed is the caller: 2.11's
  `ApiTokenView.get` built its context with `u'include_plugin_extras': True` (line 220) and **2.12's
  no longer does** (`grep` over `views/user.py`, `lib/base.py` and the extension's `plugin.py` finds
  it nowhere) ⇒ the extras are dropped, the bundled template dereferences them, 500.
  *(An earlier note here claimed the dictize had no such path; that came from a grep that matched
  only a parameter name. Reading the function disproved it.)*
- **Measured, and it explains the confusing part:** the token loop is evaluated per token, so on the
  same stack the page **renders for a user with no tokens**
  (`/user/probe-sin-tokens/api-tokens` → **200**) and **fails for a user with tokens**
  (`/user/ckan_admin/api-tokens` → **500**). ⇒ **A `down -v` does not fix it, it only appears to:**
  after a reset the token table is empty (the seed revokes its own token), so the page works — until
  the first portal login mints one.
- **Still broken upstream:** CKAN `master` carries the same pair (the view without the flag and the
  template still reading `plugin_extras`), so there is **no fix to wait for in 2.12.1** as things
  stand. There *is* a `2.12` maintenance branch, and this stack floats on the `2.12` image tag, so a
  rebuild will pick the fix up whenever upstream ships it.

Impact: **only the native UI page.** Minting a token with `expires_in`/`unit` still works (the
re-seed did it, and the portal's login mints tokens on every sign-in), and the API can still list and
revoke. What is lost is listing and revoking tokens **from the UI**.

Options considered: **(a)** restore `include_plugin_extras` in the caller through the repository's
own patch mechanism; **(b)** report it upstream and wait for 2.12.1; **(c)** make the bundled
template defensive so the page renders with an empty column; **(d)** hold the upgrade and return to
2.11.6.

**Resolved with (a)**, in `affb4b4`: `ckan-docker/ckan/patches/ckan/001_api_tokens_include_plugin_extras.patch`
restores the flag with a comment explaining why, and it was generated from the pristine file
(`docker cp`, edit, `diff -u --label a/... --label b/...`) instead of being written by hand. `(b)`
stays weaker than it looked — with the flag missing from the context the data never reaches the
template either, so a defensive template would only render an always-empty column.

Applying it needed two permission changes in the same commit, both from one cause — the 2.12 images
ship the CKAN source tree owned by `ckan-sys` with group read-only, while the image has to write to
it: the patch loop runs as root and returns to `USER ckan` (as the `ckan` user, `patch` cannot even
create its temporary file in `ckan/views/`, which is `drwxr-xr-x`), and the dev image does
`chmod g+w ${SRC_DIR}/ckan/test-core.ini`.

**Two claims written earlier in this section are corrected here**: `api_token_dictize` *does*
support `plugin_extras` — what changed is who asks for it — and **both** Dockerfiles do apply the
patches, the dev one included. What was missing was write permission, not the loop. *(Both wrong
claims came from grep output read as if it were complete.)* One build failed along the way because
the `chmod` pointed at `${SRC_DIR}/ckan/ckan/test-core.ini`, a path that does not exist.

Verified end to end with `down -v` + `up -d --build`: the flag is present in the image's tree, there
is no `PermissionError` at startup, the debug toolbar stays off, and the page returns 200 with a real
expiry.

## Delivered (2026-09-27) — the whole slice on `master`, CI green

Six commits, every one through the native gate with the authority burned, all pushed:

| commit | what | gate |
|---|---|---|
| `9cbdf25` | `feat(ckan): upgrade the stack to CKAN 2.12` — the 8 files, 28 diff lines | `review-60ff70a8b0ca199c`, approved 2026-09-24 |
| `f37aac3` | `fix(dev): probe CKAN with Python, not wget, in the health checks` | `review-0698d001c56cd5b1` — medium, 1 lens, **zero findings** |
| `affb4b4` | `fix(ckan): apply the ApiTokenView patch on the 2.12 images` | `review-7745a4917e876308` — medium, 1 lens, 3 advisories |
| `5d47358` | `chore(config): point SOLR_IMAGE_VERSION at the Solr tag the stack runs` | `review-27800a64fece9457` — medium, 1 lens, **zero findings** |
| `91fcbc6` | `fix(umss): follow the driver's translation the 2.12 images ship` | `review-6d25b4f5d76dff1d` — high, 4 lenses, 1 advisory |
| `d861c95` | `ci: run the suite against the redis the stacks use` | same lineage: the provider freezes `base..HEAD`, so the last two shared one gate |

The three commits that predate the upgrade — `9857186` (the DebugToolbar leak), `44ac587` (the
proxy `Host`) and `a128b4f` (the dead `CKAN_VERSION` key) — were gated separately as the range
`856c060..a128b4f` on 2026-09-25, after the review store showed they had never been through a gate:
lineage `review-ff12fabe480c18a1`, high, 4 lenses, 11 advisories, none blocking.

**CI run `36369796656`: both jobs green, `53 passed`** in `ckan/ckan-dev:2.12`. That run is also what
found the last two defects, neither reachable from a static review:

- `test_the_database_name_comes_from_the_driver_translation` asserted the driver translation the
  2.11 images had. Under SQLAlchemy 2.0.51, which the 2.12 images ship, the two spellings swap:
  `...?database=ckandb` becomes ambiguous (`{'ckan_test','ckandb'}`) and `...?dbname=ckandb`
  overrides the path (`{'ckandb'}`). The guard's *outcome* did not change — an empty name is refused
  and `ckandb` is not test-scoped, so both spellings are refused — and
  `test_a_query_parameter_cannot_redirect_the_database` pins that refusal independently of the
  driver's internals. It passed even in the failing run, which is how the guard was cleared.
- The job pinned `redis:3` while both stacks render `redis:6`. CKAN 2.12's client (redis-py 8.0.1)
  sends `HELLO` for the RESP3 handshake and redis 3 answers `unknown command 'HELLO'`, so the suite
  ran without a cache and said so only in a log line.

`master` == `origin/master` == `d861c95`, working tree clean, and `feat/ckan-2.12-upgrade` left two
commits behind because the last two fixes were committed straight onto `master`.
