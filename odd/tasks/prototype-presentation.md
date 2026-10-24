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
| T5 | S1, S3, S4 | P5 collections | inline | — |
| T6 | S1, S3 | P6–P9 (as time allows) | inline | — |
| T7 | S2 | Import pipeline check: author imports one page with html.to.design | author | — |
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
