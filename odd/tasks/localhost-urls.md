# The stack calls itself localhost

**Feature.** The portal and CKAN both generate URLs that name `localhost`, so anything served to a
machine other than the server points at the wrong host. Reported by the author on 2026-09-23; traced
and measured the same day.

**Status:** open · **Branch:** `feat/v0-portal-honesty` (+ `odp-docker`) · **Started:** 2026-09-23

## Measured basis

| Reading | Result |
|---|---|
| `ckan.site_url` (dev container) | `http://localhost:5000` — `/srv/app/ckan.ini:79` **and** the `CKAN_SITE_URL` env var |
| Where that value comes from | `odp-docker/ckan-docker/.env` (`CKAN_SITE_URL=http://localhost:5000`), injected by `env_file: .env` |
| `curl http://192.168.1.201:5000/` | returns links to **`http://localhost:5000/`** — the live symptom |
| A hosted resource's `url` (probe D0) | `http://localhost:5000/dataset/<id>/resource/<rid>/download/<file>` — CKAN rewrites it to `site_url` |
| `ckan.datapusher.callback_url_base` | `http://ckan-dev:5000` (set in the container env) |
| Pusher → `http://ckan-dev:5000` | resolvable and reachable (`getent hosts` → `172.19.0.4`, `wget` rc=0) |
| Pusher → `http://192.168.1.201:5000` | **not reachable** (the request never completes) |
| Portal on the LAN IP | `http://192.168.1.201:8082/` → HTTP 200 |
| `CKAN_INTERNAL_URL` in `odp/.env` | **absent** — only `PUBLIC_CKAN_URL` and `PUBLIC_APP_URL` |
| `env.APP_URL` consumers | **none** in app code |

Two consequences that shape the fix:

1. **`site_url` is load-bearing for what block D just shipped.** The PDF `<iframe>` and the image
   `<img>` embed the resource `url`, which CKAN builds from `site_url`. In LAN they load nothing; they
   work only on the server. The same reaches the download button and the whole CKAN UI.
2. **Changing `site_url` cannot break the DataPusher.** `ckanext/datapusher/logic/action.py:67-71` uses
   `ckan.datapusher.callback_url_base` and only falls back to `site_url` when that option is unset —
   and here it is set to the internal service name. That is why the D0 upload succeeded with
   `site_url = localhost`: the pusher never used it.

## Decisions (author, 2026-09-23)

- **D-a — fix `CKAN_SITE_URL` to the publicly reachable URL** (`http://192.168.1.201:5000` in this dev
  box) and document in `.env.example` why it must not be `localhost`.
- **D-b — the portal keeps a dev-only fallback, not a silent one.** `CKAN_INTERNAL_URL` configured →
  use it; **unset + dev** → `http://localhost:5000` (the host `pnpm dev` convenience, and the same
  pattern this project already uses for the mock fallback); **unset + production** → **fail loudly**
  instead of quietly pointing at localhost.
- **D-c — remove the unused `APP_URL`** rather than leave a validated env var that no one reads. The
  `.env`/`.env.example` keys stay until the author removes them (harmless), noted below.

## Slices

### L1 — the portal's internal URL (this repo) — **DONE, reviewed, approved**

Commit `4f06bbf`. Receipt **`review-344a93dbb8243ef2` — APPROVED**, tier `high` (the provider raised it for
the auth path), **4 lenses**, 10 files / 139 lines, budget 70, **four informational findings, zero
blockers**, authority burned. Range `23d4f3c..HEAD` with an explicit `baseRef`.

Gates, verified by the parent: `pnpm test` **598/598** (593 + 5), `pnpm check` 0 errors, `biome check` exit 0
on the 11 touched files.

- One rule in `src/lib/server/ckan-internal-url.ts`: configured wins; unset **in dev** falls back to the dev
  CKAN; unset outside dev throws, naming the variable. Pure on purpose — `$env/dynamic/private` and
  `$app/environment` are virtual modules Vitest does not resolve, so the value arrives as a parameter and
  the decision is testable without mocking either. 5 tests over the three branches.
- Both auth routes consume it and lost the `|| "http://localhost:5000"`.
- `APP_URL` removed (unused) plus its `PUBLIC_APP_URL` declaration in `.env` and `.env.example`.
- **A bad acceptance criterion of mine, corrected:** I asked for `grep -rn "localhost:5000" src/routes/ src/lib/env.ts`
  to be empty. It is not, because it also matches three **inert test fixtures** (`CKAN_URL` stubs and a mocked
  `resource_show` url) in the two dataset test files. Those are legitimate and rewriting them would be churn for
  a criterion that was wrong, not code that was wrong. The right criterion is the one that matters, and it passes:
  `grep -rn "localhost:5000" src/routes --include="+server.ts"` → empty, and the only non-test occurrence left in
  `src/` is the single exported `DEV_CKAN_INTERNAL_URL` constant.
- **Route-level test not possible, and disclosed rather than forced:** importing the route in Vitest fails at
  `vite:import-analysis` («Failed to resolve import `$app/environment`»), because only `$app/navigation` and
  `$app/stores` are aliased. Making it work needs new aliases in `vitest.config.ts`, which was outside the
  authorized surfaces. Coverage stays at the pure-function level, which exercises the same decision.

### L2 — `odp-docker` (separate repository) — **DONE and verified live**

- `ckan-docker/.env`: `CKAN_SITE_URL=http://192.168.1.201:5000`. The edit is surgical and proven — `diff`
  against a backup shows **exactly one changed line** out of 79, and the file holds credentials.
- `ckan-docker/.env.example`: the `https://localhost:8443` example replaced with a real placeholder plus the
  reason.
- **Operational finding worth keeping: `docker restart` is not enough.** The container's environment is fixed
  when it is created, so `env_file` changes need a **recreate**:
  `docker compose -p odp-dev -f docker-compose.dev.unified.yml up -d ckan-dev`. After the recreate the
  container env is right while `/srv/app/ckan.ini:79` still reads `http://localhost:5000` — the ini is baked and
  the env wins, which is why the emitted links changed.

### L3 — verification *(DONE)*

- `curl http://192.168.1.201:5000/` → **7 links to `http://192.168.1.201:5000`, zero to `localhost`**.
- A repeated D0-style probe (three real uploads, then purge) shows the hosted resources' `url` now carrying the
  LAN origin — so the PDF iframe and the image img resolve off-server — and **the DataPusher still works after the
  recreate** (`datastore_active: true` on the first poll, `datastore_search` with the rows), which retires the
  callback risk. Catalogue restored to **17 datasets / 7 orgs**, probe tokens revoked.

## Open follow-up decision

Three of L1's four advisories converge on `logout/+server.ts:29` — the route now answers `500` when
`CKAN_INTERNAL_URL` is missing outside dev, which contradicts its documented best-effort contract. Recommendation:
keep the loud failure on **login** (actionable, and the entry point) and return logout to best-effort, logging the
config error without failing the response. That needs its own slice and its own review.

## Allowed edit surfaces

- **L1:** `src/lib/server/ckan-internal-url.ts`, `src/lib/server/ckan-internal-url.test.ts`,
  `src/routes/auth/login/+server.ts`, `src/routes/auth/logout/+server.ts`,
  `src/lib/env.ts`, `src/routes/dashboard/dashboard.test.ts`,
  `src/routes/dashboard/datasets/new/wizard.test.ts`,
  `src/routes/dataset/[id]/dataset-page.test.ts`,
  `src/routes/dataset/[id]/resource/[resourceId]/resource-page.test.ts`.
- **L2:** `odp-docker/ckan-docker/.env`, `odp-docker/ckan-docker/.env.example` — **outside this
  repository**; the author authorized it explicitly on 2026-09-23.

## Known risks

- **A restart of `ckan-dev` re-mints the DataPusher token** (the entrypoint does it when
  `CKAN__DATAPUSHER__API_TOKEN` is absent). That is the designed fix and the catalogue survives, because
  `prerun` runs `init_db` idempotently and does not re-seed.
- **Mixed content, later:** the embed needs CKAN's origin on the same scheme as the portal. An `https`
  portal with an `http` `site_url` gets its iframe and img blocked by the browser. When the public URL is
  set, both must be set together.
- **`site_url` is not the portal's own URL.** The portal serves through its own origin; only CKAN's
  generated URLs change here.
- **The `.env` file holds credentials** (`CKAN_SQLALCHEMY_URL`, datastore URLs). Any edit must be
  surgical — one line — with the rest of the file byte-identical.
