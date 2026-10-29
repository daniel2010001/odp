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

- **S11** — Story-based script for Thursday, accepted 2026-10-26 («Sí, escríbalo») on the agent's proposal: «2–3
  journeys: Planificación publishes enrollment — compares with UMSSSTAT; a lecturer looks for data; the Rectorado builds
  the accountability collection — answers the letter case». It also decides which screens get linked in Figma.

- **S12** — Collections list split (Q18, decided 2026-10-26), mocked as its own screen: «si, hagamoslo». Decision verbatim from
  Q18: «en el **menú principal**, sólo las públicas y sin filtro de visibilidad; «**Colecciones que cura**» en la ficha de cada
  organización; «**Mis colecciones**» en el panel, que es donde va el filtro de visibilidad». Visibility follows Q10.
- **S13** — Users mock, Q5 (2026-10-26), verbatim: "q5 por ahora solo activos, los bloqueados lo veremos en la implementación,
  creo que ni siquiera creo que podrán hacer el login, pero lo veremos después."

- **S14** — Prototype mode (2026-10-28). The author, verbatim: "me dijiste que podíamos "copiar" los pages que ya están, pero
  creo que no están porque revisando veo que faltan cosas como que el header tenga eso de las collections, las fichas del
  dataset tengan esa parte de las collections y cosas así, o me equivoco?" Chose option A, verbatim from the agent's offer:
  «Agrego a las páginas reales los accesos a lo nuevo, visibles sólo en desarrollo y nunca en producción: «Colecciones» en el
  menú, la sección en la ficha del dataset y los accesos del panel.»

- **S15** — The prototype is presented on the Gentle Design canvas instead of Figma (2026-10-28). The tribunal accepted
  it, the author verbatim: "creo que sí, les pregunté y dijeron que sí, mientras podamos compartirlo, como se puede hacer con
  figma." The tribunal wants the **design** process, not the implementation: "primero tenermos que presentar el proyecto, o sea
  qué es, para qué sirve, etc. luego son los prototipos, pero no como que ya está instalado, sino como que estamos "diseñando"
  sin implementar". The screens move to the canvas step by step, verbatim: "vamos paso a paso, te parece? algo como: tú haces
  algo como 3 pages, más o menos (o las que sugieras, no cerremos este número), y yo voy revisando para el feetback, te parece?
  algo como hicimos en las devs pages." Each screen is one self-contained artboard under `design/prototipo/`, shareable.

- **S16** — Inicio, second iteration (2026-10-28), verbatim: "04: En el hero, la descripción no termina de gustarme. Creo que
  deberíamos hacer más énfasis en que podemos tener diferentes tipos de documentos. Creo que, por lo general, las secciones
  están bien, pero solo en la idea, el diseño no termina de gustarme y tampoco el orden. Volver a iterar. Algo que me gustó
  mucho es eso de "Novedades", el nuevo diseño me gusta más que el anterior. Respecto a lo que dices que la section 2 y 3 se
  repiten, podemos unificarlas? algo así como unir ambas sections en uno solo. Respecto a la sección "para su
  investigación", no termina de gustarme el formato en lo que estamos presentando. Parece como si este fuera el resultado
  final, pero es diferente a la ficha de dataset que tenemos ahora mismo, no digo que la copiemos tal cual está ahora mismo,
  sino que la presentemos de otra forma."
- **S17** — Dataset sheet right panel (BACKLOG P1, P2), verbatim: "p1: la 1 y 3, el orden actual es: citar, resumen y
  organización, y si tiene historíal de solicitudes va al final y si tiene una solicitud creo que va despues de la cita.
  podemos reordenarlas? lo que propongas, pero quisiera verlas todas por ahora, sin importar el login. cuando se publica
  quisiera ver su historial, pero creo que esto estará solo para los logins, no para el annonimus" … "creo que sí [scroll
  para el panel], porque ahora mismo tenemos que bajar hasta abajo para poder ver las últimas cards, por ejemplo el del
  historial de solicitudes, esto no termina de gustarme y creo que depende mucho de la pantalla, podemos hacer algo como
  hicimos con las vistas de los gráficos? algo así como tener un alto responsive?" P2: "el botón de copiar links que copiamos
  de github … en la parte izquierda las cards tienen dos titles, pero en la parte [derecha] no, solo uno, quisiera que ambos
  estén en el mismo title, y que el botón sea con hover group, se puede? eso de estar esperando a que se haga hover en el
  title no termina de gustar, quisas nadie lo note". Request history: not for anonymous visitors; sin/con login become
  separate pages later.

- **S18** — Promote the dataset panel (T18), verbatim: "me gsuta mucho la propuesta del dataset panel, las acepto, las 4:
  unificado, propuesta, scroll propio, plegado. detalles: al bajar todo el panel y luego subir la page el scroll del panel sigue
  abajo, alguna forma de solucionarlo? algo como: cuando se suba toda la page el scroll del panel vuelva a subir? es solo
  detalle, otra cosa es que si se puede "ocultar" el scroll, ahroa mismo se lo ve, no es un bloqueante, pero me gustaría si se
  pudiera. aprobado por lo pronto las propuestas." H2-4: "bien, solo falta agregar los cambios nuevos."
- **S19** — Organizations proposal, verbatim: "h2-2: me gusta cómo se ve ahora, pero un detalle es si se puede sticky para el
  buscador y los filtros, y para los titles por sections, se puede? está listo para promover."
- **S20** — Search, verbatim: "h2-3: errores en el filter menu: sticky con top muy bajo. la barra no se anima, podemos tocar el
  hero? escucho propuestas. también me gustaría que mostremos la page sin resultados."
- **S21** — Resource, verbatim: "h2-5: bien, solo creo que las otras vistas no funcionan, intento ver los gráficos pero no dan,
  quisas sea por que es prototipo, no hay problema si no dan, solo decirme antes para no estar en aprietos cuando presente, me
  gustaría mostrar otros formatos más, no solo csv, quisas pdf, si no se puede usar el iframe podemos hacer ese ejemplo de html
  que hicimos en la dev page de las vistas."
- **S22** — Collections, verbatim: "h2-6b: me gusta, solo quisiera saber si se puede poner algo así como un filtro para ver las
  collections de una org en específico, algo como dijimos en el panel solicitudes, quisiera "reutilizarlo", de esta forma
  tenemos algo más "unificado", te parece? h2-7: sticky en el panel. en el hero hay una parte donde dice quién la curo, esto
  está bien? esto me genera una duda muy grande: las collections están ligadas a una org? porque creo que también dijimos que
  los user podrían crear sus collections, no? o me equivoco? encontes, cuándo es de un users y cuándo de una org? esto me
  confunde un poco. mismo problema de los tags: hay tag de "público", quitar, solo mostrar el tag si es privado, y usar el
  mismo estilo de los otros tags, este tag tiene un ícono, pero creo que los otros no lo tienen, corregir y unificar." …
  "Mis collections: me gusta. solo corregir eso del sellect de "cuaradas por...", esto es solo para el caso de una org, qué
  pasa cuando son muchas? podemos hacer algo similar a lo que tenemos para el panel/requests? cosa que sea unificado" … "h3-3:
  mismas observaciones que en h2-7, panel sin sticky y tag de "público" con ícono. veo el panel un poco vacío, podemos poner
  algo así como las orgs de los datasets? algo como una lista similar a la card de org de la ficha de los datasets, pero en
  lista. cosa que reutilicemos el mismo diseño y podamos unificarlo, se puede?"
- **S23** — Organization sheet, verbatim: "ficha de org: la noto un poco "vacía", cuando la org no tenga ni collections ni
  datasets se vería vacía, podríamos agregar más cosas? se puede? cosa que se vea más como una ficha de una org. escucho
  propuestas."

- **S24** — Search bar and hero (2026-10-28). «La barra no se anima», verbatim: "sí, eso de pasar de ocupar ambas columnas a
  colo una y mostrar el input del buscador." Hero: three directions on the canvas — «hazlo, me gusta este método». The sticky
  filter menu's top is too low (S20).

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
| T10 | S10 | Collection sheet: markdown description + public vs curator view | worker | `89a7d5a` — awaiting author review |
| T11 | S11 | Story-based script (`presentation/guion.md`) + Figma link map | inline | `01a10ed` — awaiting author review |
| T12 | S6, S11 | Collection mocks follow Q10 (Privada, viewer-aware lists) + matrícula aligned with the real dataset | inline | `f0c8b11` — awaiting author review |
| T13 | S12 | Public collections list (main menu) vs «Mis colecciones» (panel) as two mock screens | worker | `511df08` — awaiting author review |
| T14 | S13 | Users mock shows only active users (no «Bloqueado») | worker | `54900f9` (+ María Fernanda also Rectorado editor, consistent with the panel) — awaiting author review |
| T15 | S14 | Prototype mode: DEV-only entry points to the mocks in the real header, dataset sheet, panel and organization sheet | worker | `18e1409` — awaiting author review |
| T16 | S15 | Screens to the canvas, batch by batch (`design/prototipo/`), reviewed by the author on the canvas | worker | batch 1 `91611cd` (H2-4, H2-7, H3-1) — awaiting author review |
| T19 | S15 | Batch 2 (no login): H2-2 organizations proposal, H2-3 search, H2-5 CSV resource, H2-6b collections menu, organization sheet, H3-3 public collection | worker | `93890f1` — awaiting author review; pixel check: letter anti-aliasing only (≤63/255, 13 px at 129 on H2-2) |
| T17 | S16 | Inicio direction 05 (second iteration) | worker | `273603b` — awaiting author review |
| T18 | S17 | Playground `/dev/dataset-panel`: right-panel order, own scroll with responsive height, anchor button on card hover | worker | `39666ce` — awaiting author review |
| T20 | S18 | Promote the dataset panel to the real sheet (+ panel scroll resets at page top, scrollbar hidden at rest); delete the playground | worker | `f459f7f` — promoted |
| T21 | S19 | Organizations playground: sticky search/filters and sticky group titles (promotion after the presentation: needs type/acronym fields, Q11–Q13) | worker | `fac2965` — awaiting author review |
| T22 | S22 | Collections mocks: org filter reusing the requests org tabs (H2-6b, Mis colecciones), sticky panel, visibility tag only when not public and in the common tag style, H3-3 panel lists the owner organizations reusing the dataset sheet's org card | worker | `bc2a71b` — awaiting author review |
| T23 | S23 | Organization sheet: design directions on the canvas (`design/organizacion/`) | worker | (this commit) — awaiting author review |
| T24 | S20, S21 | Captures: chart tabs as their own artboards, a PDF resource (static first page instead of the iframe), the search without results | worker | `ddfc67a` — awaiting author review |
| T25 | S20, S24 | Search: fix the filter menu's sticky top; animate the bar from both columns to one with the search input revealed (playground first) | worker | `7ebce71` — fix in; animation awaiting author review |
| T26 | S24 | Search hero: three directions on the canvas (`design/busqueda/`) | worker | (see L22) — awaiting author review |
| T8 | S5 | Q&A sheet for the presentation (`presentation/preguntas.md`) | inline | committed — awaiting author validation of [validar] answers |

**Delivery.** One commit per screen; the branch is a stack of small slices (~170–350 lines each), reviewed
screen by screen in the browser. It is not merged to `main` before the presentation unless the author asks.

## Handoff (session closed 2026-10-26)

**Presentation: Thursday 2026-10-29, 16:00.** Branch `feat/prototype-presentation`, pushed, **not merged to `main`**.
Environment: `odp-dev` is up (`odp-demo` stopped, volumes kept). Give the author `https://odp.hs.lan/...` URLs.

**Awaiting the author's review** (screens are reviewed and captured at desktop 16:9 only, L6):
- Users (multi-org corrected after the first review): `https://odp.hs.lan/dev/prototype/users` and `?vista=nuevo`.
- Organizations playground (T9): `https://odp.hs.lan/dev/organizations` — mock names and acronyms need checking against the real UMSS.
- Dataset → collections (T5): `https://odp.hs.lan/dev/prototype/dataset-collections?d=matricula-por-carrera`.
- Collection sheet, public vs curator (T10): `https://odp.hs.lan/dev/prototype/collection?c=rendicion-cuentas-2025&vista=publica` / `&vista=curador`.
- Collections list and the first collection sheet: **reviewed, liked** (L7).

**Decisions pending from the author** (ask by file + topic, not by bare ID — L7). Resolved 2026-10-26 (L9, L10): collections
list location (Q18), script (S11, T11), Q16, Q10. Still open: the other questions in
`design-system/datos-umss/preguntas-abiertas.md`: Q3, Q4b, Q5, Q8, Q9, Q11–Q14, Q17.
Q18 mocked (T13): `/dev/prototype/collections?vista=publica|panel`. Still not mocked: «Colecciones que cura» on the
organization sheet.

**On the author's side:** finish re-reading `presentation/preguntas.md` and validate the **[validar]** answers; open UMSSSTAT and
confirm it has no data download; **test the html.to.design import with one page as soon as possible** (T7 — if it fails, the
pipeline changes).

**Next on the agent's side, after the reviews:** T3 organization management (members tab, one role per org, invitation), T4
dataset collaborators, T6 public profile `/user/<name>` (Q1) and versions (Q17); then Figma assembly support.

**Outside this repository:** `odp-docker` has the Q7 fix (`620fd73`) and the Q16 fix (`9b5eb55`, verified live 2026-10-26) merged into `master` (PR #40, merge `8ea8582`, 2026-10-26).
`odp-dev` runs with both; the stopped demo needs `up -d` of `ckan` and `ckan-worker` to pick them up. Delivery: this branch is ~4,000 lines in 31 commits; split into several PRs before
merging to `main` (after the presentation). GitHub Pages (enabled 2026-10-28) serves this branch at `https://daniel2010001.github.io/odp/design/`: after the merge,
switch its source to `main`. Before that merge, decide whether prototype mode (T15) stays: real pages import
the mock data from `src/routes/dev/prototype/collections/` (dead code in production, but a coupling to undo).

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
- **L8** (2026-10-26, author): "creo que vamos a cerrar la sesión por hoy, puedes dejar todo lo pendiente para la próxima
  sesión?" → Handoff section above.
- **L9** (2026-10-26, author): collections list — accepted the proposal (Q18). Script — «Sí, escríbalo» (S11). Q16 — «Sí,
  como Q7» (relayed to the `odp-docker` session). Q10, verbatim: "esto es un poco complicado de responder: un lado quisiera
  que los user tengan sus propias colecciones, algo como un grupo de datasets para que las pueda revisar, pero sin necesidad
  de publicarlo, pero por otro quisiera que las orgs también las tengan, entiendes?" → owner-based proposal in Q10.
  Script note: the demo instance has no Planificación organization and its test users are FCyT, so journey 1 uses the FCyT.
- **L10** (2026-10-26, author): Q10 — accepted the owner-based proposal («Sí, así»). Asked to align the mock matrícula dataset
  with the real one («Sí, alíneelo»). Applying Q10 surfaced that the dataset sheet and «También en» listed internal and private
  collections to a visitor; both now filter by who is looking (T12).
- **L11** (2026-10-26, author): push and merge of `odp-docker` `fix/org-create-sysadmin-only` — «hazlo» (relayed to the
  `odp-docker` session). Asked how to run the html.to.design import. Q18 mock — «si, hagamoslo» (S12, T13). Answers to the open
  questions, verbatim: "q3: lo admine, q4b: por ahora no lo pongamos en la presentación, solo en el doc y la respuesta es que sí
  se avisé, pero lo veremos a más detalle cuando lleguemos a eso en la implementación. q5 por ahora solo activos, los bloqueados
  lo veremos en la implementación, creo que ni siquiera creo que podrán hacer el login, pero lo veremos después. q8: esto era
  para cuando quedrámos exterionalizar (creo que así se dice) la plataforma, algo así como un padre para todos las orgs de la
  universidad que vedría siendo el nivel más bajo, ahora mismo no se lo tiene, pero esto tampoco está como para ser hecho ahora
  mismo, esto porque no sabemos si se aprueba el proyecto o no. q9: creo que está bien, respecto a lo de configurar un smtp creo
  que lo podemos ahacer, o es complicado? por ahora lo dejo abierto ya que creo que necesito más info sobre esto del smtp, si
  podemos hacer algo sencillo/básico para mostrar cómo funciona bien, creo que la uni tiene un servidor de correos, podemos
  simular el nuestro, pero esto lo hablamos después. q14: por mi podemos dejar esto de los users sin orgs para después, creo que
  esto generaria más dudas que respuestas en la presentación. q11 me gusta la propuesta, considero que mantener el select es
  cosa de los dev, algo así como dejarlo "hardcodeado", pero cosa que sea fácil modificarlo, se puede? q12: propongo algo así:
  intentar recuperar todos los grupos, aunque sea uno de cada uno, luego hacemos algo así como "ver más" y que eso active el
  filtro y muestre solo de su grupo, qué dices? q17 acepto la propuesta, anotala." Found: the html.to.design FREE plan allows
  «Up to 10 imports every 30 days» (html.to.design/docs/pro-plan); the script has 18 steps.
- **L12** (2026-10-28, author): Q3 — «si, usar tu sugerencia»; Q8 — «si» (RF-02 discarded); screenshots for the prototype,
  html.to.design only for the test — «si»; push the branch — «si» (pushed). Export to Figma: will try it. Raised S14 (built pages
  do not show the new entry points) → option A (T15). Presentation is tomorrow, 2026-10-29 16:00.
- **L13** (2026-10-28, author): the tribunal wants the design process (S15) and accepted the Gentle Design canvas if it can be
  shared like Figma. Asked to commit `design/` — «hazlo» (`624daa5`). Batch 1 of T16: H2-4 dataset sheet (built), H2-7
  collection of a person (mock), H3-1 «Mis colecciones» (mock, with selects). Design `design/prototipo/` links to this
  feature; `design/inicio/` (three home directions) is a standalone trial.
- **L14** (2026-10-28, author): present the stories from the portal in prototype mode — «si, mejor»; no backup PDF — «creo que
  no hará falta»; add «cómo diseñamos» to the script — «hazlo» (done, `presentation/guion.md`; the Figma sections were removed);
  citation on dataset sheets — «hazlo, pero no es necesario que funcione, solo mostrarlo» (the real sheet already shows «Citar
  como»). Canvas from the desktop: the canvas only accepts loopback (HTTP 421 to any other Host), so it needs an SSH tunnel
  or Gentle Shell on the desktop. Inicio feedback, verbatim: "inicio: 1: el hero no me termina de gustar, lo rescatable es eso
  que ponemos en el lado derecho, eso indica las partes de los datasets, también me gusta la parte de "novedades", es buena
  idea, no tanto así el diseño. 2: hero más formal, me gusta. la parte de "cómo llega un dato al catálogo" me gusta. índice de
  unidades también gusta, el de temas y sections no termina de gustar. el "para su investigación" me gusta mucho. 3: hero me
  gusta mucho, pero no esas cards de "por unidad", etc. "qué encontrará" me encanta, y el "para empezar" también es buena idea.
  Podemos iterar el inicio con estas preferencias?" → artboard 04. H2-4, verbatim: "podemos implementar las observaciones que
  hice anteriormente? creo que están como TODOs. y creo que faltaría eso de la card de publicación en la parte derecha." →
  candidates found in BACKLOG («Detalles» vs «Información técnica», hero tooltips, metadata card E4); asked which.
- **L15** (2026-10-28, author): S16 and S17 (verbatim above). P21/P22 belong to the resource sheet (DataStore resources).
- **L16** (2026-10-28, author) on Inicio 05, verbatim: "me gusta más, pero creo que el "quién publica" no me gusta, no por el
  diseño, que parece bonito, sino porque ahora estamos "cerrando" a que solo tendrá 5 orgs, qué pasa con otros nuevas orgs?
  respecto a lo de "rescatar" datos reales desde ckan, podemos hacerlo, pero quisiera que estén harcodeados, estamo haciendolo
  así? las cards del hero no termina de gustarme, me gusta la idea, pero no el diseño. me gusta mucho más ahora, qué más podemos
  hacer? por mi queda." → 05 is the chosen direction; edit 05 in place: «Quién publica» must not read as a closed set of five
  units, and a new design for the hero type cards. Data: every artboard is static HTML with the demo's values copied in
  (0 scripts, 0 fetch, checked).
- **L17** (2026-10-28, author): batch 2 with the six screens without login — «si, me gusta, cuándo arrancamos?» (T19).
- **L18** (2026-10-28, author): review of the dataset panel playground and of batch 2 → S18–S23 (verbatim there). Search hero and «la barra no se anima» asked before touching the real search page.
- **L19** (2026-10-28, author): curator icon — "el ícono del curador sí me gusta, pero no el que va dento del tag, esto rompe un
  poco lo que es los badges de las otras pages."; collection curator chosen at creation — «apecto tu propuesta de escoger quién
  lo cura, anota eso» (Q19, PRD RF-21); search bar and hero → S24 (T25, T26).
- **L20** (2026-10-28, design): `design/organizacion/` (T23) — three directions for the organization sheet, each with its empty state: `01-ficha-con-panel` + `01b-…-vacia`, `02-portada-con-pestanas` + `02b-…-vacia`, `03-dossier-con-indice` + `03b-…-vacia`; each ends with a feasibility note (nativo / implementable / no disponible).
- **L21** (2026-10-28, author) on `/dev/organizations`, verbatim: "me gusta, pero hay partes donde sobre salen del bg del sections
  title, creo que es por el import! o algo así, los que veo que hacen esto son: en las unidades pedendientes y dependiente de.
  corregir esto." Cause: the cards' hierarchy links are `relative z-10`, the same level as the sticky titles, and come later in
  the DOM; the titles now use `z-[15]` (below the bar's `z-20`).
- **L22** (2026-10-28, design): `design/busqueda/` (T26) — three search hero directions, each with «Al llegar» and «Al
  desplazarse» states: `01-banda-compacta`, `02-consulta-como-titulo`, `03-tarjeta-sobre-la-banda`.
- **L23** (2026-10-29, agent): full re-capture of the 14 prototype screens with every change of T20–T25 (`scripts/design-capture/batch-all.json`); verify at tolerance 64: 13 OK, the PDF differs by design (static stand-in). A first run aborted on the dev server's HMR recompilation and wrote nothing; the retry after the server settled passed.
