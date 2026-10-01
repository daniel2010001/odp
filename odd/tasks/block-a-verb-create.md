# Block A — the verb: «publicar» → «crear»

**Feature.** The portal labels the *creation* of a dataset «Publicar dataset», and the wizard creates
it `private: true`. A user who presses that button believes the dataset is already visible to
everyone. A second reason makes the fix mandatory now: the **real** publish action — the future
approver control — is specified as a control labeled `"Publicar dataset"`
(`openspec/changes/2026-09-13-publication-lifecycle/specs/publication-lifecycle/spec.md:246`), so the
wizard's submit button currently occupies the label of the action that is still to come.

**Why now.** The `BACKLOG.md` block plan makes this block A, and it is the only one that needs no
product decision. It is a work unit of copy plus the two identifiers that encode the same defect.

**Decisions (author).**
- 2026-09-21: the verb `«publicar» → «crear»` needs no product decision (recorded in `BACKLOG.md`).
- This session: fix **every** user-visible instance of the verb when it means *create*, not only the
  four enumerated ones — a button that says «Crear» on a page whose heading and requirement
  sentences say «publicar» is still a lie. And rename the identifiers that carry the same defect:
  `canPublish` → `canCreate`, `puedePublicar` → `puedeOfrecerCreacion`.

## What stays untouched (correct, not a missed instance)

| Text | Why it stays |
|---|---|
| «Todos los datasets se crean como **privados**: el flujo de publicación es el que decide cuándo pasan a ser públicos.» (wizard summary tooltip) | it describes the real publication flow |
| «la visibilidad del dataset la definirá el flujo de publicación» (×2) | idem |
| `openspec/changes/2026-09-13-publication-lifecycle/**` | the **real** publish control of the future PR 2; the colliding string is the point, not a defect |
| `openspec/changes/archive/**` | immutable history |
| `src/routes/about/+page.svelte` «la publicación y el descubrimiento de datos» | the portal's purpose, not an action on a dataset |

No OpenSpec spec asserts the dashboard-empty-state or wizard strings (measured: grep over
`openspec/` finds only the publication-lifecycle control and archived history), so **this block
changes no spec**.

## The rename, exactly

The four strings of `src/lib/copy/dashboard.ts`:

| Constant | Today | New |
|---|---|---|
| `EMPTY_STATE_HEADING` | `Publique su primer dataset` | `Cree su primer dataset` |
| `EMPTY_STATE_PRIMARY_ACTION_LABEL` | `Publicar dataset` | `Crear dataset` |
| `EMPTY_STATE_NO_ORGANIZATION_REQUIREMENT` | `Publicar un dataset requiere pertenecer a una organización.` | `Crear un dataset requiere pertenecer a una organización.` |
| `EMPTY_STATE_NO_CREATE_PERMISSION_REQUIREMENT` | `Publicar un dataset requiere rol de editor o administrador en una organización.` | `Crear un dataset requiere rol de editor o administrador en una organización.` |

Identifiers: `EmptyStateFlags.canPublish` → `canCreate`; `dashboard/+page.svelte` `puedePublicar` →
`puedeOfrecerCreacion` (**not** `puedeCrear`: that name is already taken at line 56 and means the
CKAN permission alone, while the derived one also requires the organization load to be finished);
the `/dev/copy` case id `can-publish` → `can-create`.

Verbs: `Publicar dataset` → `Crear dataset` (page title, `h1`, grid CTA, submit button);
`Publicando...` → `Creando...`; `puede publicar` → `puede crear`; `antes de publicar` → `antes de
crear`; `no bloquean la publicación` → `no bloquean la creación`; `después de publicarlo` →
`después de crearlo`; `para publicar datasets` → `para crear datasets`. Comments follow the code
they describe (`Ficha de publicación` → `Ficha de creación`, «las tres superficies que ofrecen
publicar» → «…que ofrecen crear»).

## Tasks

- [ ] **A1 · RED.** Update the test expectations to the new copy and the renamed field, and capture
  the failing run. Touched: `src/lib/copy/dashboard.test.ts`, `src/routes/dashboard/dashboard.test.ts`
  (role-name matchers `/publicar dataset/i` → `/crear dataset/i`), `src/routes/dev/copy/dev-copy.test.ts`,
  `src/routes/dashboard/datasets/new/wizard.test.ts`. RED evidence is the transcript, not the diff.
- [ ] **A2 · GREEN — the copy module.** `src/lib/copy/dashboard.ts`: four strings, `canPublish` →
  `canCreate`, comments. **Work unit 1.**
- [ ] **A3 · GREEN — the dashboard page.** `src/routes/dashboard/+page.svelte`: grid CTA title,
  `para publicar datasets`, `puedePublicar` → `puedeOfrecerCreacion`, the flags wiring, comments.
  Plus the two comments in `src/lib/api/organizations.ts` that say «ofrecer publicar».
  **Work unit 2.**
- [ ] **A4 · GREEN — the wizard.** `src/routes/dashboard/datasets/new/+page.svelte`: `<title>`, `h1`,
  the no-organization requirement, the license note, both resource notes, the recommended-fields note,
  the error counter, the submit button and its two states, the post-submit note, the summary comment.
  **Work unit 3.**
- [ ] **A5 · GREEN — the review sheet.** `src/routes/dev/copy/+page.svelte`: case id, labels, prose.
  This sheet imports the real strings, so it must not restate them by hand. **Work unit 4.**
- [ ] **A6 · Gates.** `pnpm test`, `pnpm check`, `pnpm lint`, `pnpm build`. Then an independent grep of
  the whole `src/` for the verb, to confirm every remaining hit is one of the rows of the
  «stays untouched» table.

## Evidence

**A1 · RED.** After editing only the four test files: `Test Files 3 failed | 1 passed (4)` / `Tests 11
failed | 84 passed (95)`. `copy/dashboard.test.ts` 5 (the literals), `dashboard/dashboard.test.ts` 4
(the heading and the link matchers), `dev/copy` 2 (the sheet rendered `empty-state-can-publish` while
the test looked for `empty-state-can-create` — the anti-drift property doing its job). `wizard.test.ts`
stayed green: no assertion there depended on the renamed strings.

**A2–A5 · GREEN, one work unit per commit.**

| Work unit | Commit | Scope |
|---|---|---|
| 1 · copy module | `9d7be01` | the four strings, `canPublish` → `canCreate`, comments |
| 2 · dashboard | `e3136a9` | grid CTA, the no-organization sentence, `puedeOfrecerCreacion`, comments in the page and in `organizations.ts` |
| 3 · wizard | `4265137` | title, h1, five notes, error counter, submit button and its two states |
| 4 · review sheet | `8081260` | case id `can-create`, in lockstep with its test |

Diff: **88 insertions / 88 deletions**, all inside the allowed edit surfaces. `openspec/` and
`src/routes/about/+page.svelte` untouched (`git diff --name-only` → 0 files).

**A6 · Gates — measured by the parent, not taken from the writer's report.**

| Gate | Result |
|---|---|
| `pnpm test` | **472 passed / 472** (37 files), exit 0 |
| `pnpm check` | **0 errors**, 4 warnings, all pre-existing (`ThemePlayground` ×2, `SearchBar`, `tsconfig` node types), exit 0 |
| `pnpm build` | exit 0, `@sveltejs/adapter-node` done |
| `pnpm lint` | **exit 254**, «Linter process terminated abnormally» — **not the code**: the same Biome 2.5.0 invoked directly over the same tree reports **122 files, 0 errors, 4 warnings, 7 infos** (exit 0), and `pnpm exec biome --version`, which reads no file, fails the same way. Known environment issue (`BACKLOG.md`, «Advertencias de entorno»); the four commits were made with `--no-verify` **after** reproducing the hook's exact command (`biome check --staged --write --no-errors-on-unmatched`) with the direct binary: 2-3 files checked each time, no fixes applied. |

**Verification grep.** `grep -rn "publicar\|Publicar\|Publicando" src/` → **no output** (exit 1): no
imperative of the verb survives anywhere. Every remaining hit of the family is prose about the real
publication flow, about the institution's activity, or about a string *being published* to users —
never a control that promises visibility.

| Hit | Classification |
|---|---|
| `datasets/new/+page.svelte:922`, `:948`, `:1599` | the real publication flow — the rows the plan protects |
| `organization/[id]/+page.svelte:211` «no tiene datasets publicados» | honest: `byOrganization` calls `package_search` **without** `include_private`, so the list it heads holds public datasets only |
| `about:24`, `organizations:77,116`, `search:271`, `+page.svelte:78,85,123,156,219`, `mock/data.ts:104,196` | institutional prose about organizations publishing data, or the catalogue's published datasets |
| `copy/dashboard.ts:8`, its test, `dev/copy` ×3 | «una cadena distinta de la que se publica» — publishing a *string* |
| `datasets/new/+page.svelte:1072` «el sitio de la unidad que lo publica» | the unit that releases the dataset, not the user's create action. **Judgment call, flagged to the author** |

**Two strings changed beyond the enumerated list**, under this block's own decision («every
user-visible instance of the verb when it means create»): the dashboard intro «Desde aquí publica
datasets» → «crea datasets», and the multi-organization wizard note «elija dónde publicar» → «elija
dónde crear». Both user-visible, both inside allowed surfaces, both coherent with the sentence that
follows them about the publication flow.

## Review

**`review-169119db13ffab2c` — APPROVED, receipt burned** (tier `medium`, lens `review-reliability`, 11
files / 350 lines, correction budget 175, one reviewer). Reviewed range: `baseRef=1f60930` with
`committedOnly: true` — **the block only**, not the accumulated branch. **One advisory finding, no
blockers, no correction transition:**

- **R3-001** (reliability, WARNING, informational) — `src/routes/dashboard/datasets/new/wizard.test.ts:238`.
  The test is titled «no muestra el campo de visibilidad y crea siempre como privado», but its body only
  asserts the **absent** visibility field; `private: true` is asserted in a *different* test (`:203`). The
  mismatch is **pre-existing** — the old title promised the same thing — and this block's rename made it
  visible. Recorded as a `TODO:` in `BACKLOG.md`; it does not reopen this review.

The candidate is public: `origin/feat/v0-portal-honesty` at `356d42a`.

## Second round — the author's copy review (2026-09-22)

`187b5ba` (the copy) · `c823e37` (the backlog TODO quote). Receipt `review-11cc383a48faf9e7` —
**APPROVED, ZERO findings** (tier `medium`, 5 files / **37 lines**, correction budget 19), over the
slice's committed range only (`baseRef=41b8670`).

**Two decisions.** (1) «El asistente lo guía paso a paso» is **removed**: the word named something the
portal never labels that way (that screen's `h1` says «Crear dataset») and it collided with the
still-undecided onboarding idea. The path is still offered by the «Crear dataset» button right below, and
the same word left the grid action's description. (2) The requirement sentences became **causal** —
«**Para crear el primero**, necesita pertenecer a una organización.» — so the first sentence describes what
the reader sees and the second explains why they cannot change it, instead of piling three claims with no
stated relation.

**An agent error, with its lesson.** The parent asserted that «asistente» appeared in **one user-visible
string**; that was false — it had truncated its own `grep` with `head -12` and the output had reached
exactly the limit, hiding a second occurrence in the grid action's description
(`src/routes/dashboard/+page.svelte:216`). Thence the rule: **never truncate a search and then claim
completeness over it**; the detector is comparing `grep … | wc -l` against `grep … | head -N | wc -l`.

**The trap the tests had to survive.** Six assertions in `dashboard.test.ts` assert the requirement's
**absence**, so a stale matcher would have left them **green by vacuity** — passing without checking
anything. All were migrated, and each keeps a positive witness in the branch where the sentence must
appear (`:460` for «pertenecer», `:411` for «rol»).
