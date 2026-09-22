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

## Open decision — RESOLVED

**The sheet stays, as a permanent review tool**, with the same documented criterion as `/dev/copy`: a
5xx cannot be provoked by hand, so the sheet is the only way to read that state without breaking code
on purpose. Decided by the author at review time.

## Evidence

**Commits.** `716af7e` (the presentation component + its tests) · `ce15382` (the review sheet) ·
`07803f5` (the promotion: `+error.svelte`, its test, the stub) · `34bba4f` (this plan).

**Gates — measured by the parent, never taken from the writer's report.**

| Gate | Result |
|---|---|
| `pnpm test` | **520 passed / 520** (40 files) |
| `pnpm check` | **0 errors**, 4 pre-existing warnings |
| direct Biome: `$(readlink -f node_modules/.bin/biome) check .` | **129 files, exit 0**; 4 warnings + 7 infos, all pre-existing |
| `pnpm build` | exit 0 |
| **Live** (`http://localhost:8082/no-existe`) | **HTTP 404** and the **client** state (1 occurrence) with **no** server state (0); `<title>Página no disponible — UMSS</title>`; the DEV diagnostic prints `404 · /no-existe · Not Found`; the layout header survives; `/dev/error` and `/` still 200 |

**The defect found on the way — and it was this plan's error.** The wrapper first read
`$page.error.status`. Verified against `node_modules/@sveltejs/kit/types/index.d.ts`: `Page.status:
number` («HTTP status code of the current page»), `Page.error: App.Error | null` («Filled from the
`handleError` hooks»), and the default `App.Error` is `{ message: string }` — this repo does not widen
it (`src/app.d.ts` has `// interface Error {}`). That read is therefore `undefined` in production, and
**every** error — a 404 included — would have rendered the server state. The delegated writer refused
to apply content that failed `pnpm check` and escalated with the evidence; the parent verified the types
before accepting, and chose `$page.status`, with no `App.Error` widening and no `handleError` hook
(unnecessary: `page.status` already carries it). The writer's RED reproduced the defect: three tests
expected the client state and received the server state.

**Why the tests did not catch it — the durable part.** The specified test double declared
`error: { status: number; message: string }`, **wider than the framework's**, so it fabricated the field
the runtime never provides and the suite stayed green over broken behaviour. *A double that does not copy
the framework's real shape does not verify: it blesses.* The stub now mirrors `App.Error`
(`{ message: string }`), and a test pins the classification **with the message absent**, so reading the
status from the wrong place cannot come back green.

**Live versus unit, stated honestly.** The live measurement covers the 404 — the case the defect broke.
The 5xx branch is covered by the wrapper test and by the reviewed sheet variant, not live: no route in
this app can be made to fail on demand.

**Review.** `review-13d22ebddf82eef0` — **APPROVED, receipt burned** (tier `medium`, lens
`review-reliability`, 9 files / 957 lines, correction budget 200, one reviewer, zero blockers), over the
block's committed range only (`baseRef=3a334bf`). **Two advisory findings, recorded and deliberately NOT
fixed**: fixing them would need their own review, and this receipt is burned.
- The retry target uses `$page.url.pathname`, which **drops the query string and the fragment**: a 5xx
  on `/search?q=salud` would retry `/search` and lose the search.
- The icon assertion takes the **first** `<svg>`, but the 5xx state renders **two** (the state icon and
  `Reintentar`'s), so the assertion is brittle and the second icon's `aria-hidden` is unasserted.

**Measured deviation, recorded so it does not surprise anyone: this block is 957 diff lines against an
agreed review budget of 400.** Production code is ~315 of them; tests are 531 and the sheet 121. The
review took it as one `medium` review anyway. Lesson for the blocks that follow: split the component, the
sheet and the promotion into separate reviews when the diff passes 400 again.
