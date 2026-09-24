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

### L1 — the portal's internal URL (this repo)

- One rule in a shared server module so `login` and `logout` cannot diverge:
  `src/lib/server/ckan-internal-url.ts`.
- `src/routes/auth/login/+server.ts` and `src/routes/auth/logout/+server.ts` consume it and lose their
  duplicated `|| "http://localhost:5000"`.
- Tests for the three branches: configured, unset-in-dev, unset-in-production (the last must fail
  loudly, not return a URL).
- Remove `APP_URL` from `src/lib/env.ts` and from the four test stubs that declare it.
- **Not** a test gap to skip: no test touches these two `+server.ts` routes today.

### L2 — `odp-docker` (separate repository)

- `ckan-docker/.env`: `CKAN_SITE_URL=http://192.168.1.201:5000`.
- `ckan-docker/.env.example`: replace the `https://localhost:8443` example with a real placeholder plus
  a comment saying it must be the URL visitors actually use, because CKAN bakes it into every absolute
  URL — including the download URL the portal embeds.
- Restart `ckan-dev` and verify **live** that the LAN origin stops emitting `localhost`.

### L3 — verification

- `curl http://192.168.1.201:5000/` must no longer return `localhost` links.
- A real hosted file's `resource_show` must report the LAN origin (a tiny upload, then purge, exactly
  like probe D0 — the catalogue has no hosted files otherwise).

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
