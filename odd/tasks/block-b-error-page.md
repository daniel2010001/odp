# Block B — the portal's own error page

**Feature.** The portal has **no `+error.svelte` anywhere** (measured: `find src -name "+error*"` →
empty), so every unknown route and every server error renders SvelteKit's default page: «404 Not
Found» in English, no institutional chrome beyond the layout, and no way back to the catalogue.

**Measured exposure (this is what the page actually has to cover).**

| Source of the error | Today |
|---|---|
| An unknown route (`/no-existe`) | SvelteKit's default 404 |
| A server error / a bug in a loader | SvelteKit's default 500 |
| `/dev/copy` in a production build | its `load` throws `error(404, "Not found")` → the default page |

**Only one route in the whole app throws**, and that is the DEV guard above: `dataset/[id]` and
`resource/[resourceId]` handle their own `403`/`404` **internally** (they render a state, they do not
throw). So this page must not try to re-do that job — its copy is generic by necessity.

A root `src/routes/+error.svelte` renders **inside** `src/routes/+layout.svelte`
(`<main class="flex-1">{@render children()}</main>`), so the header and the footer survive. That is
also the policy-sanctioned path to sign in: the resource-detail spec allows the *persistent* sign-in
affordance precisely because it carries no information about the requested resource.

## The policy constraint that shapes the copy

`src/lib/api/failure.ts` (reviewed with the existence policy) forbids two things here: affirming a
single cause when the observer cannot distinguish them, and offering a sign-in action **from the error
state**. Its anonymous sentence is the model:

> «No se encontró el {dataset|recurso} solicitado, o no tiene permiso para verlo.»

So the page has **two** states, never three:

| State | Status | Why |
|---|---|---|
| **4xx** (404, and equally 401/403/anything else in the 4xx range) | one identical state | distinguishing «does not exist» from «no permission» would disclose existence. **Same reasoning as the reviewed policy, so the error page never grows a «sin permiso» variant.** |
| **5xx** (and any other status) | a distinct state | the failure is ours; naming it leaks nothing and a retry is a real action |

The honest wording for the **identified** viewer belongs to the page that knows the subject, and those
pages already do it (`failure.ts` indexes its text by `AccessContext`). This page does not read the
session, and that is deliberate.

## Design (concrete; the playground is the review surface)

Presentation lives in **`src/lib/components/error/ErrorPage.svelte`**; `+error.svelte` will be a
three-line wrapper created **after** the author approves. The review sheet imports the real component,
so what you approve is what ships.

**Shared frame.** Centred column inside the layout's `<main>`, `max-w-xl`, `py-16` (section rhythm
60–80px), no card (the page is otherwise empty and a floating card reads as a dialog), `px-4` so it
never scrolls sideways at 375px. Actions stack `flex-col` on mobile, `sm:flex-row` from 640px.

| Element | 4xx state | 5xx state |
|---|---|---|
| Eyebrow (`text-xs font-semibold uppercase tracking-wider text-destructive` — the coral institutional accent the design system reserves for eyebrows) | `ERROR {status}` | `ERROR {status}` |
| Icon (Lucide, `size-10`, `aria-hidden`) | `FileQuestion`, `text-muted-foreground` | `TriangleAlert`, `text-destructive` |
| `<h1>` (`font-heading text-3xl sm:text-4xl font-bold text-primary`) | **No se pudo abrir esta página** | **Algo falló de nuestro lado** |
| Body (`text-sm leading-relaxed text-muted-foreground`) | **Puede que la dirección no exista o que usted no tenga permiso para verla. Vuelva al catálogo para buscar los datos que necesita.** | **No pudimos completar la operación. El problema está en el servidor, no en su equipo: intente nuevamente en unos minutos.** |
| Primary action (`ui/button`, `primary`) | **Volver al catálogo** → `/search` | **Reintentar** (`RotateCw`) → `<a href={path}>`, a real navigation: retrying *can* change a 5xx and can never change a 404, which is why the 4xx state offers no retry (`failureActions` reasons the same way) |
| Secondary action | **Ir a la página de inicio** → `/` | **Volver al catálogo** → `/search` |
| `<title>` | `Página no disponible — UMSS` | `Error del servidor — UMSS` |
| **No sign-in action.** The header carries it, and that is the whole point of the policy. | | |
| DEV-only diagnostic (`font-mono text-[11px] text-muted-foreground/70`) | `{status} · {path} · {message}` — the raw framework message is English and must never reach production. **Review point: say if you want it gone entirely.** | |

**Accessibility:** exactly one `<h1>`; every icon `aria-hidden="true"`; the two actions are the only
focusables inside the page and carry `focus-visible:ring`; no state transition is introduced, so there
is nothing to gate behind `prefers-reduced-motion`; contrast by token only.

**`404` vs other 4xx:** one state, and a test asserts they are **equal** (deep-equality of the
rendered heading and body), so a later session cannot quietly add a permission-flavoured variant.

## Tasks

- [ ] **B1 · RED.** Tests for the component contract before the component exists: the 4xx family
  renders one identical state (403 ≡ 404 ≡ 401), the 5xx state differs, no variant offers a sign-in
  action, the retry exists only in the 5xx state, and the `<title>` per status.
- [ ] **B2 · GREEN — `ErrorPage.svelte`.** Exactly the table above. Props: `status`, `message?`,
  `path?`. No SvelteKit import beyond what the `<title>` needs; no session read.
- [ ] **B3 · The review sheet.** `src/routes/dev/error/{+page.svelte,+page.ts}` — DEV-gated exactly
  like `/dev/copy` (`throw error(404, "Not found")` when `!import.meta.env.DEV`), rendering the real
  component for **401, 403, 404, 500, 503** side by side with a visible label, because the 5xx cannot
  be provoked by hand. Plus `dev-error.test.ts` fixing that the sheet covers every state.
- [ ] **B4 · Gates.** `pnpm test`, `pnpm check`, the direct-biome lint run, `pnpm build`.
- [ ] **B5 · Author review** of `/dev/error` at 375/768/1024/1440 and in dark mode. Then, and only
  then, **B6 · promotion**: `src/routes/+error.svelte` + the decision in the backtick below.

## Open decision for the author

**Does the sheet stay, or does it go?** `AGENTS.md` rule 8 says the `/dev/<page>` playground is
deleted at promotion; `/dev/copy` is the documented exception because its state cannot be reproduced
by hand. **A 5xx cannot be reproduced by hand either**, which is the same justification — but it is
your rule, so it is your call (asked at review time).

## Evidence

_(filled per task: commit identity + observed result.)_
