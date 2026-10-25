# Prototype for the formal presentation (Thursday 2026-10-29, 16:00)

**Feature.** A non-functional prototype of the **whole project** (built screens + screens not built yet),
imported into Figma and presented as a click-through prototype before the tribunal.
**Status:** in progress · **Branch:** `feat/prototype-presentation` · **Started:** 2026-10-23

## Specs

- **S1** — The prototype shows "todo lo que será el proyecto, o lo que alcancemos": the current pages **and**
  the screens not built yet, "como lo de las orgs, users, etc." — "todo lo que se pueda".
- **S2** — The screens are "las interfaces sin que estén funcionando", presented in Figma or a similar tool.
- **S3** — Workflow: "tu propones y yo corrijo, iteramos hasta que quede bien" (AGENTS.md rule 8).
- **S4** — The tribunal's letter example ("una carta puede ser presentada muchas veces a diferentes lugares")
  is answered with what the platform **does** cover — "hagamoslo con lo primero, lo que cumplimos" — and
  "adaptarlo para que no tenga malos entendidos": upload once, referenced from several places (collections,
  RF-22). Document circulation / tracking (gestión documental) is **not** promised.
- **S5** — Prepared answers for the questions the author could not answer: "qué busca solucionar la
  plataforma?", "por qué una plataforma todo en uno", "qué tipo de documentos" (by content, not format).

- **S6** — Every mock is checked against what CKAN offers: "no prometamos fotos de perfil para user si ckan no lo
  soporta, o comprobación de email y cosas así", but what we can implement (like the charts) may be shown, "siempre
  anotando y señalando esto".
- **S7** — Built pages are reviewed too: for each one the agent asks "si esta page va tal cual o hacer cambios o
  rehacerla" (e.g. the organizations grid) — not because they are wrong, but to improve the UI faster now.
- **S8** — Multi-organization membership and "qué user ve qué cosas" are designed explicitly, with cases (member of one
  org, member + admin of different orgs, no org, edge cases), including whether user profiles are public.

- **S9** — Organizations page (`/organizations`): the author chose **«Cambios: la propuesta»** (not as-is, not redo).
  The proposal, verbatim from the agent's message the author accepted: (1) «Buscador y filtro por tipo arriba
  (Facultad, Dirección, Instituto), con la cantidad de cada uno»; (2) «Agrupar por tipo, con un encabezado por grupo,
  en vez de una sola cuadrícula»; (3) «Mostrar la jerarquía: la tarjeta de una facultad indica "3 unidades
  dependientes" y las enlaza»; (4) «Agregar a la tarjeta la sigla y la fecha de la última actualización». It is built
  as a playground `/dev/organizations` that duplicates the real page (AGENTS.md rule 8): control panel with case
  presets, a per-section variant switch next to what it changes, so the author compares against the current grid.
  CKAN feasibility (S6): counts and dates are native; type and acronym would be organization `extras`
  (implementable, not present today); hierarchy needs `ckanext-hierarchy` (implementable; ties to Q6).

- **S10** — Collection sheet (`/dev/prototype/collection`), author's review 2026-10-25: "me gusta … quisas podamos darle
  más info, como un markdown como los datasets, pero como base me gusta, podemos probar con esto que te digo? también
  preguntar cómo se vería ya publicada y cómo se vería privada". On the right-hand «Publicación» card: "hay partes como
  "2 de 2 org aprobaron", esto parece algo así como si fuera un form o que no es la versión final o pública … creo que
  para el privado puede estar bien, pero en el público se ve raro." → (a) a markdown description like the dataset
  sheet (RF-39); (b) two views to compare: **public** (what any visitor sees: no approval progress) and **private /
  curator** (the approval block lives here).

## Approach (decided 2026-10-23)

- The author has a **free** Figma account. Penpot/OpenPencil cannot export to `.fig`, and the Figma MCP
  quota on the free plan is too low to depend on. So: **design in code → import into Figma with the
  html.to.design plugin + its Chrome extension (works on `localhost`) → link screens in Figma's prototype mode.**
- Built pages are captured as they are. Screens not built yet live as **static mock pages** under
  `src/routes/dev/prototype/<screen>` (DEV-only, 404 in production, same guard as `/dev/kind`), reusing the
  real layout, components and tokens, with hard-coded data. They are prototype sheets, not features.

## Screen inventory

Built (capture as is): home · search (results, empty) · organizations · organization detail · dataset ·
resource (CSV table, PDF, chart) · chart builder · login · dashboard · new / edit dataset · publication
requests queue · about · error page.

Not built — mock, in priority order (whatever is done by Wednesday enters):

| # | Screen | PRD |
|---|---|---|
| P1 | User administration (superadmin): list, roles, state, create user | §3 v1, RF-01..07 |
| P2 | Organization management: edit data + members and roles | RF-06..08 |
| P3 | Create organization (figurative hierarchy) | RF-06 |
| P4 | Dataset collaborators (viewer / editor / steward) | RF-18..20 |
| P5 | Collections: list, detail with datasets of several orgs, publication approval per org (S4) | RF-21..23 |
| P6 | Teams | RF-19..20 |
| P7 | Dataset versions: history, create version | RF-14..17 |
| P8 | User profile + API key | RF-37 |
| P9 | Audit log (superadmin, tier v2 — shown as future) | RF-33..34 |

## Tasks

| ID | Specs | Task | Route | Commit |
|---|---|---|---|---|
| T1 | S1, S2 | `/dev/prototype` index (map of every screen, built and mock) + DEV guard | inline | `75e02cf` ✓ |
| T2 | S1, S3 | P1 user administration (`?vista=nuevo` opens the create form) | inline | `9f29cad` — awaiting author review |
| T3 | S1, S3 | P2 + P3 organization management | inline | — |
| T4 | S1, S3 | P4 dataset collaborators | inline | — |
| T5 | S1, S3, S4 | P5 collections (list, sheet, dataset → collections) | worker | `4bf5a31` — awaiting author review |
| T6 | S1, S3 | P6–P9 (as time allows) | inline | — |
| T7 | S2 | Import pipeline check: author imports one page with html.to.design | author | — |
| T9 | S7, S9, S6 | Organizations playground `/dev/organizations` | worker | `8af97fc` — awaiting author review |
| T10 | S10 | Collection sheet: markdown description + public vs curator view | worker | — |
| T8 | S5 | Q&A sheet for the presentation (`presentation/preguntas.md`) | inline | committed — awaiting author validation of [validar] answers |

**Delivery.** One commit per screen; the branch is a stack of small slices (~170–350 lines each), reviewed
screen by screen in the browser. It is not merged to `main` before the presentation unless the author asks.

## Log

- **L1** (2026-10-23, author, verbatim): "dijeron que presente todo lo que será el proyecto, o lo que
  alcancenos, o sea que supongo que quiere que pase las pages actuales y las ponga en alguna herramienta para
  mostras, me dijo que todo lo que se pueda, supongo que esyo incluye vosas que no tocamos, como lo de las orgs,
  users, etc. respecto a lo de los dos casos: hagamoslo con lo primero, lo que cumplimos, creo que fue mas como
  un ejemplo que me involucra, podemos intentar "adaptarlo" para que no tenga malos entendidos, te parece?"
- **L2** (2026-10-23, author): has a Figma account without a paid plan; proposed "creamos en otra herramienta y
  luego la importamos a figma".
- **L3** (2026-10-23, author, verbatim): "lo de las collections es en ambos sentidos, es decir: ds1, ds2
  pertenecen a la cl1 y dl2 y dl3 a cl2, y podemos llegar a ds3 por: ds1 -> cl1 -> ds2 -> cls -> ds3, o algo
  así." Collections were "en principio algo extra". Also recalled, origin unsure: "poder clonar datasets, de
  una org en otra para que así la otra pueda hacer los cambios que quiera, o incluso users de la misma org,
  pero con una ref al dataset original". Recorded in `BACKLOG.md` under the collections item; whether cloning
  enters the prototype is pending the author's answer.
- **L4** (2026-10-23, author): cloning does **not** enter (was likely the previous project; clarified it would copy a
  specific version into an independent new dataset, with traceability of who/when, not a git-like merge). Users screen:
  "la ui de users me gusta". Asked for multi-org cases, who sees what, whether profiles are public, why «Lector» vs
  CKAN's `member`, and how to keep the design questions that arise visible ("un .md o una ventana ... o un dialog").
  Reviewing `presentation/preguntas.md` [validar] answers on their side.
- **L5** (2026-10-23, author): decisions — open questions in one `.md` (`design-system/datos-umss/preguntas-abiertas.md`);
  profiles public like CKAN; `member` shown as «Lector»; built pages reviewed one by one, starting with organizations.
  For organizations: «Cambios: la propuesta» (S9).
- **L6** (2026-10-24, author): answered the edge cases — (a) last admin: check what happens ("creo que el superadmin
  se queda"); (b) pending request of a removed user "tiene que morir como cascada … se resuelva como cancelada bajo la
  glosa de user fuera de la org", and the sole-editor case keeps "creator user id"; (c) asked what the PRD says about
  blocking vs CKAN; (d) hierarchy postponed, maybe figurative via org extras; Q7 "hay que corregirlo, dile a
  odp-docker que lo haga"; profiles: "usemos lo de ckan y hagamos como que es visible para todos como ckan", and ask the
  tribunal which they prefer. Organizations proposal: "me gusta", with open questions on org type (enum/select vs tag,
  exclusive), pagination with groups, acronym as extra and URL (Q11–Q13). Tooltips on org chips: leave for
  implementation. **Responsive: "por ahora no lo toquemos, solo en el dev … todo en 16x9"** — mocks and playgrounds
  are reviewed and captured at 16:9 desktop only; mobile is deferred to implementation.
- **L7** (2026-10-25, author): collections list "me gusta"; asks where the list lives (top nav like search/about, on each
  curator org's sheet, or both), whether it is a logged-in view, and "privados para quién exactamente?". Collection
  sheet: S10. Navigation between pages works in code but wiring it in Figma is hard ("eso de saber a dónde ir y de
  dónde ir"). The "same dataset in several collections" example "se puede mostrar con esto que hiciste". Q-IDs were
  hard to follow: the author did not know which file/number "Q10" referred to.

