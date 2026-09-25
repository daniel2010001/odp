# Feature: restore the native API-tokens page (CKAN 2.12 regression)

**Status:** in progress · **Branch:** `feat/ckan-2.12-upgrade` · **Started:** 2026-09-24
**Evidence lives in:** `ckan-2.12-upgrade.md` (the upgrade slice that exposed it)

## Goal

`/user/<name>/api-tokens` returns **500** on CKAN 2.12.0. Restore it without forking CKAN and
without waiting on an upstream fix that does not exist yet.

## Why

The page is the only way to **list and revoke API tokens from the UI**, and the author uses the
native UI as an operational crutch. The portal is unaffected (it mints tokens through its own
server-side flow), but losing the listing is a real capability loss.

## Measured basis

- The template that fails is the one **bundled inside the CKAN 2.12.0 release**:
  `ckanext/expire_api_token/templates/user/snippets/api_token_list.html`, tracked at tag
  `ckan-2.12.0` and unmodified. It reads `token.plugin_extras.expire_api_token`.
- `api_token_dictize` is **identical in 2.11 and 2.12**: it drops `plugin_extras` and re-adds it
  **only when `context['include_plugin_extras']` is set**.
- **2.11's `ApiTokenView.get` set that flag; 2.12's does not.** The flag appears nowhere in 2.12's
  `views/user.py`, `lib/base.py` or the extension's `plugin.py`.
- Measured on the same stack: the page renders **200** for a user with no tokens and **500** for a
  user with tokens, because the loop body is evaluated per token.
- **Still broken upstream:** CKAN `master` carries the same pair, so there is no 2.12.1 to wait for.

Two of my own earlier claims were wrong and are recorded here so nobody repeats them: the dictize
**does** support `plugin_extras` (a grep had matched only a parameter name), and
`Dockerfile.dev.umss` **does** apply the patches directory (a partial read suggested otherwise).

## The fix

A patch through the repository's own mechanism, which already exists and is already applied by
**both** Dockerfiles (`RUN for d in $APP_DIR/patches/*` … `patch -p1`, run from
`$SRC_DIR/<basename>`):

`ckan-docker/ckan/patches/ckan/001_api_tokens_include_plugin_extras.patch`

It restores the flag in the context the view hands to `api_token_list`. One added line plus the
comment explaining why, because the failure mode is invisible otherwise.

**When upstream fixes it**, this patch will **fail to apply** and the image build will stop. That is
the intended behaviour — loud, not silent — and the answer is to delete the patch.

## Verification

1. `patch --dry-run -p1` against the pristine tree inside the container (proves the patch applies).
2. Apply it in the running container and reload: `/user/ckan_admin/api-tokens` must go **500 → 200**
   **and** show the "Expires at" column with a real value (proves the data reaches the template, not
   just that the page renders).
3. The durable path is an image rebuild, and in **dev** that needs `down -v`: `/srv/app` is the
   `home_dir` volume, so the image's patched source tree is only copied into a *fresh* volume.
   Without it, a rebuild changes nothing in the running container.

## Risks

- **A wrong hunk silently misapplies.** Mitigated by generating the patch from the pristine file
  rather than writing it by hand, and by the `--dry-run`.
- **The flag also exposes other plugins' token extras.** `api_token_dictize` is not sysadmin-gated
  for tokens (unlike `user_show`), and `api_token_list` already enforces owner-or-sysadmin, so the
  only thing exposed is the caller's own token metadata.

## Allowed edit surfaces

- `ckan-docker/ckan/patches/ckan/001_api_tokens_include_plugin_extras.patch` (new)
- `ckan-docker/Dockerfile.dev.umss`, `ckan-docker/Dockerfile.umss` (the patch loop runs as root, and
the dev image unblocks `test-core.ini`)
- `odp/odd/tasks/ckan-2.12-upgrade.md` (the finding it derives from)

## Verified in vivo (2026-09-24)

The patch was generated from the **pristine** file (`docker cp` out, edit, `diff -u` with `a/`/`b/`
labels) rather than written by hand, so the hunk cannot be off by a line.

1. `patch -p1 --dry-run` inside the container against the pristine tree: clean.
2. Applied for real and after the dev server reloaded: `/user/ckan_admin/api-tokens` went
   **500 → 200**, the `Expires at` column is present, and the cell carries a real value —
   `September 26, 2026, 5:23:48 AM UTC` for a token minted with the portal's `TOKEN_TTL`.

### The permission wall the dry-run exposed

`patch` warned *"File ckan/views/user.py is read-only; trying to patch anyway"*, and that is not
cosmetic: the file is `-rw-r--r-- ckan-sys:ckan-sys` while the container runs as `ckan`, whose
**group** is `ckan-sys`, and the directory is `drwxr-xr-x` — so the app user cannot create the temp
file `patch` needs. Measured, and the same cause produces the `PermissionError: [Errno 13]` on
`test-core.ini` that the upgrade slice recorded as finding 2.

⇒ Both Dockerfiles now run the patch loop as **root** and return to `USER ckan` afterwards, and the
dev image additionally does `chmod g+w` on `test-core.ini` — the one file its entrypoint rewrites on
every boot. That retires upgrade finding 2 as well, because it is the same cause in the same place.

## Durable path — verified (2026-09-24)

`down -v` + `up -d --build`, then checked **in the running container**: the flag is in the image's
source tree (`206: {'include_plugin_extras': True}`), `ckan/test-core.ini` comes out `-rw-rw-r--`,
the entrypoint logs **zero** `PermissionError`, the DebugToolbar is still off, and
`/user/ckan_admin/api-tokens` returns **200** with a real expiry value —
`September 26, 2026, 5:37:50 AM UTC` for a token minted with the portal's 24-hour `TOKEN_TTL`.
So the patch reaches the container **from the build**, not from a hand edit. Upgrade finding 2 (the
`test-core.ini` `PermissionError`) is retired by the same change, because it is the same cause.

### A mistake worth keeping

The first build **failed**: the `chmod` pointed at `${SRC_DIR}/ckan/ckan/test-core.ini`, and the file
is at `${SRC_DIR}/ckan/test-core.ini`. The correct path was written in plain sight in
`start_ckan_development.sh` (`ckan config-tool $SRC_DIR/ckan/test-core.ini`) and I did not read it
before inventing the path. The stack was down between the failed build and the fix.

## Still unverified

- The **production** image: it does not exist yet, so its `USER root` patch loop is reasoned, not
  measured.

## Draft upstream issue (not filed)

**Title:** `expire_api_token` template reads `plugin_extras`, but `ApiTokenView` no longer requests it
— `/user/<name>/api-tokens` returns 500

**Body:** On CKAN 2.12.0, `/user/<name>/api-tokens` raises
`jinja2.exceptions.UndefinedError: 'dict object' has no attribute 'plugin_extras'` as soon as the user
owns one token (with none, the page renders, because the loop body is only evaluated per token).
`api_token_dictize` pops `plugin_extras` and re-adds it only when `context['include_plugin_extras']`
is set; `ApiTokenView.get` sets that flag in 2.11 and **no longer does in 2.12** (it appears nowhere in
`views/user.py`, `lib/base.py` or the bundled extension). The bundled
`ckanext/expire_api_token/templates/user/snippets/api_token_list.html` still dereferences it, so the
release contradicts itself. Still present on `master`. Restoring the flag (or making the template
defensive) fixes it.
