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

### S0 — close the pending work first (do not mix)

The leak fix (Flask-DebugToolbar), the `$host` → `$http_host` proxy fix and the
`CKAN_VERSION` cleanup are **verified and unrelated to the upgrade**. They must be
committed as their own work unit(s) on `master` **before** the upgrade branch
exists, or the diff of the upgrade will contain foreign changes.

**Also pending and best done with the fresh volume:** rotating the database
credentials that were exposed on the LAN while the DebugToolbar was public. The
new credentials belong in `ckan-docker/.env`, which is exactly the file S3 edits.

### S1 — pin the exact target and read the official notes

- Confirm whether a `2.12.x` patch exists by the time of execution; prefer the
  newest patch over `2.12.0`.
- Read `https://docs.ckan.org/en/2.12/changelog.html#migration-notes` in full
  **before** touching anything. The top-level requirements are measured above; the
  detailed notes are not, and this plan must not pretend otherwise.
- **Do not apply the `who.ini` / `resource.config` / Activity Stream notes** that
  appear further down that page: they belong to much older releases (they arrive
  with a `paster`-era vocabulary and this stack is 2.11). Matching headings to the
  wrong version is the easy mistake here.

### S2 — decide the image pinning policy while changing the `FROM` line anyway

Today the four Dockerfiles float on the minor (`2.11`), which is deliberate: it
picks up patch releases without a commit, at the cost of byte-level
reproducibility. The `FROM` line changes in this slice regardless, so it is the
natural moment to decide. Either answer is defensible; it must be written down
next to the line.

### S3 — the image and volume changes

1. The four `FROM` lines (`ckan-docker/ckan/Dockerfile`,
   `ckan-docker/ckan/Dockerfile.dev`, `ckan-docker/Dockerfile.umss`,
   `ckan-docker/Dockerfile.dev.umss`).
2. `SOLR_IMAGE_VERSION` → the 2.12 tag, in `.env` and `.env.example`.
3. The two `site_packages` volume targets (py3.10 → py3.14), in
   `ckan-docker/docker-compose.dev.yml` and `ckan-docker/docker-compose.yml`.
4. `.github/workflows/checks.yml`: the `umss-tests` job's image.
5. `ckan-docker/README.md` if it states a version.

`.env` and `.env.example` are **environment paths the agent cannot edit** (the
harness blocks them); the author applies those two files by hand.

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
plus the datastore script. This slice must not leave that impression behind.

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
