# Expediente ODD — el corte mínimo de publicación (privado → público)

> Origen: **punto 1 de la hoja de ruta** (handoff del 2026-10-06), autorizado por el autor el 2026-10-07
> con una decisión explícita de alcance: **replanificar primero, sin escribir código de producción**.
> El motivo de esa decisión está abajo, y no es prudencia genérica: el repo sostiene hoy **dos posiciones
> irreconciliables sobre este mismo cambio**, y la diferencia entre las dos es **días contra semanas**.

## Goal

Dejar el cambio del ciclo de vida de publicación **en condiciones de aplicarse**:

1. **El alcance decidido con números medidos**, no estimados.
2. Los cuatro artefactos SDD **realineados** (`proposal → spec → design → tasks`) y la marca de obsolescencia
   puesta donde falta.
3. Las decisiones de producto que hoy están abiertas, **cerradas por el autor**.
4. El forecast del presupuesto de revisión con las **tres líneas separadas** que exige `openspec/config.yaml`
   (`code_lines`, `test_lines`, `review_material_lines`).

**Esta unidad no entrega código de producción.** La entrega es una decisión fundada y los artefactos que la
hacen aplicable.

## El bloqueo, medido

El problema de origen sigue en pie: **hoy nada de lo creado en el portal puede llegar al catálogo.** El
wizard crea todo `private: true` (`src/lib/components/datasets/DatasetForm.svelte:246`) y no hay ninguna
forma de publicarlo.

Pero el repo describe **dos soluciones distintas y excluyentes** para ese mismo problema:

| Fuente | Qué manda | Consecuencia |
|---|---|---|
| `openspec/changes/2026-09-13-publication-lifecycle/specs/publication-lifecycle/spec.md:15-22` + `tasks.md:1-12` | Corte **deliberadamente mínimo: privado → publicado**. Declara **fuera de alcance** «a `publication_requests` store or any other durable approval record». PR 1 = el guard · PR 2 = sólo la *affordance* del portal | El trabajo es **portal-only**, ~491 líneas de código + 363 de tests, ya medido |
| `BACKLOG.md:1254-1310` («Replanificación pendiente», 2026-09-16, corregido hasta 2026-09-29) | Eso quedó **obsoleto**: manda el PRD, **RF-15 paso 5 es obligatorio** (ninguna visibilidad cambia sin solicitud aprobada), el PR 1 es **insuficiente**, y su paso 1 es replanificar con `publication_requests` (tabla + migración + cola + guard consultando la aprobación) | El trabajo es **cross-repo y de otro orden**: store durable, acciones, migración y un guard que hoy no tiene nada de eso |

**Los dos no pueden ser ciertos a la vez.** Y el delator es preciso: `proposal.md` **lleva el aviso de
obsolescencia al inicio**; `spec.md` y `tasks.md` **no lo llevan**, pese a estar igual de obsoletos si la
posición del PRD es la vigente. Un artefacto obsoleto **sin marca se lee como vigente** — y eso es
exactamente el trabajo `proposal → spec → design → tasks` que el plan dejó pendiente.

## Hechos verificados el 2026-10-07 (no heredados)

- **El guard `86f130b` está commiteado y pusheado** en `odp-docker`. El resumen de la sesión anterior decía
  «el guard vive sin commitear»: es **falso**. Medido: `git status --short --branch` → `## master...origin/master`
  sin ahead/behind, árbol limpio; `git log --oneline origin/master..HEAD` → vacío.
- **El PR 1 existe y hay que leerlo, no escribirlo**: `ckanext-umss/ckanext/umss/auth.py` (190 líneas) +
  `plugin.py` (29). Hace cumplir «sólo el `admin` de la organización publica o cambia `state`».
- **La rama aparcada `wip/pr2-directo-publicacion` (`6b53c64`) es el PR 2 completo del modelo mínimo**, no un
  borrador: `PublishControl.svelte` 204 + playground `/dev/dataset-publish` 273 + `datasets.ts` 14 = **491 de
  código**; `datasets.test.ts` 64 + `PublishControl.test.ts` 299 = **363 de tests**. Coincide línea a línea
  con lo que `openspec/config.yaml` registra como real medido del PR 2 (480 de código + 363 de tests).
- **`ckanext-umss` no tiene hoy ninguna infraestructura de modelo ni de migración**: su árbol es
  `plugin.py`, `auth.py`, `tests/`, `setup.py`, `setup.cfg`, `test.ini`, `conftest.py`. Eso es lo que hace
  que el alcance «con cola» no sea sólo más código, sino **infraestructura que hoy no existe**.
- **El alance del modelo mínimo ya está construido para el actor correcto**: el PR 2 aparcado es «botón de
  publicación directa para el aprobador», que es el `admin` de la organización — el mismo actor que el guard
  ya autoriza. La etiqueta «actor equivocado» del `BACKLOG:1705` aplica al modelo del PRD (donde el que
  pide no es el que aprueba), no al modelo mínimo.

## Los dos alcances del primer corte

Las cifras de abajo son las que dejó **WU-1** (reconocimiento cerrado el 2026-10-07). Cada una está marcada
como **medida** o **estimada**, y no se mezclan.

| | **Alcance A — sin cola** | **Alcance B — con cola (PRD)** |
|---|---|---|
| Quién publica | El `admin` de la organización, directo desde el portal | El `editor` pide; el `admin` aprueba; el guard exige solicitud aprobada |
| Repos | `odp` (portal) | `odp-docker` + `odp` |
| Código | **491 medidas y construidas** (204 `PublishControl` + 273 playground + 14 API), escritas para el actor correcto | **Backend: infraestructura que hoy no existe** — modelo + `migration/umss/{alembic.ini,env.py,script.py.mako,versions/0001_*}` + registro en el plugin (hoy 29 líneas) + una capa de acciones + la consulta en el guard (190 líneas). **Portal: estimado** — control del pedido + una pantalla de cola que no existe |
| Tests | **363 medidos y construidos** | Proporciones medidas disponibles: componente denso **1.69**, página con mucho marcado **0.38**. Portal estimado en ~400-600 |
| Material de revisión | Playground `/dev/dataset-publish`, **273 medidas** | Por medir; el playground del pedido y de la cola |
| Riesgo principal | Contradice **RF-15.5** → el PRD hay que ajustarlo **explícitamente**, no en silencio. El componente se rehace si después entra B | La decisión difícil **no es el acceso a datos** —el guard ya importa `ckan.model` y lee el paquete (`auth.py:104-112`)— sino la **semántica**: la aprobación tiene que existir antes del flip, atarse al dataset *y* a la visibilidad destino, y no ser re-aplicable; y `package_create` no tiene fila previa a la que atar |
| Mutua exclusión | **Sí**: con el store en el guard, el publicar directo deja de estar autorizado | **Sí**: el store no puede desplegarse junto con el publicar directo; o se quita el botón, o el guard no exige solicitud |
| Lo que se tira si después se adopta el otro | El componente y su playground; sobreviven el manejo honesto del `403` y las dos máquinas de estado | Nada |

## Decisiones del autor pendientes

> **Estado (2026-10-07, noche): las cuatro cerradas.** 1 → **alcance B**, como cadena de unidades. 2 →
> `RF-41`/`RF-42` en **`[v1]`**. 3 → **sí se anula** la solicitud pendiente cuando un `admin` degrada
> directo, y **sí exige motivo** la degradación. 4 → **reconciliado**: el «por ahora sólo subir» era la
> decisión del corte de `v0` —«para `v0` hacemos esto que es más fácil y dejamos lo demás para `v1`», en
> palabras del autor—, y el PRD conserva las dos direcciones **marcadas `[v1]`**, que es la verdad del
> documento: la bajada **está especificada** y **no está en el corte**. La lista de abajo queda como
> histórico de la replanificación, no como estado.

1. **El alcance del primer corte** (A o B). Es la decisión que este expediente habilita con números.
2. **El tier de `RF-41`/`RF-42`** (degradación de visibilidad: por solicitud y directa del admin) — hoy **sin
   asignar**, y el `BACKLOG:1264` lo declara abierto.
3. **Dos detalles del PRD** redactados sin objeción pero sin confirmación explícita: ¿una solicitud
   **pendiente se anula** si un admin degrada directo? ¿la degradación **exige motivo**?
4. **La bajada de visibilidad**: el 2026-09-14 el autor dijo «por ahora sólo subir» y que la bajada quedaba
   pendiente de escribirse en el PRD; después se escribieron `RF-41`/`RF-42`. Las dos cosas no se
   reconciliaron.

## Unidades de trabajo

| # | Unidad | Entregable | Prueba / cierre |
|---|---|---|---|
| WU-1 | **Reconocimiento para el forecast** (read-only) | Los números por alcance: qué toca cada opción, qué infraestructura falta, y las opciones reales para «cómo consulta el guard la solicitud aprobada» | Cada cifra con su `path:line`; ninguna estimada |
| WU-2 | **Brief de decisión** | Los dos alcances costeados, riesgos y la recomendación, para que el autor decida | Las 4 decisiones de arriba, cerradas por el autor |
| WU-2c | **Diseño del store y de la consulta del guard** | El diseño concreto de «cómo consulta el guard la solicitud aprobada»: tabla, migración, acciones, semántica de consumo, y los modos de falla de cada opción | El diseño tiene que permitir decidir A/B **mirándolo**: si B no se puede diseñar sin agujeros, se elige A con ese motivo escrito |
| WU-3 | **Reconciliación de artefactos** | `proposal.md`, `specs/publication-lifecycle/spec.md`, `specs/dataset-publishing/spec.md`, `design.md`, `tasks.md` realineados al alcance decidido, y la obsolescencia marcada donde falta | Coherencia cruzada artefacto a artefacto (lo que hoy falla) |
| WU-4 | **Forecast y gate de presupuesto** | `tasks.md` con `code_lines`, `test_lines`, `review_material_lines` separadas y la proporción medida que se usó | Gate **antes** de aplicar (`openspec/config.yaml`) |
| WU-5 | **Cierre** | Handoff en `BACKLOG.md` y este expediente completo | `pnpm check` + `pnpm test` en verde si se tocó código del portal |
| WU-6 | **Playground `/dev/publication` + los dos controles y la cola** (no bloqueado por A2) | La hoja de revisión con el control del pedido (`editor`), el de publicación (`admin`) y la cola de aprobación, contra **llamadas inyectadas** | Se revisa **mirando** la hoja en vivo (regla 8); el cableado a las acciones reales es B1 y espera a A2 |
| WU-9 | **Gobernanza: el aprobador revisa antes de decidir** (decisión del autor, 2026-10-09) | (a) el título de la fila de la cola **enlaza** a `/dataset/<id>` en **pestaña nueva** — hoy el aprobador puede leer el dataset pero no tiene ningún camino hasta él, y está privado, así que no aparece en el catálogo; (b) la ficha elige la pendiente **más reciente** por `created_at` (no «la primera») y **dice** que hay más de una | (a) y (b) con su prueba; la **variante de diseño** —controles de decidir en la ficha— va a **playground `/dev/…`** y **no se promueve** sin la revisión del autor (regla 8) |
| WU-8 | **Los dos avisos de la compuerta del badge** (linaje `review-24164b1645f385df`, 2026-10-09) | (a) el derivado de la insignia pierde el `default: return null;` que **anulaba su propia garantía**: se enumeran `undefined`, `approved` y `cancelled`, y cualquier estado no nombrado cae en un `never` que **no compila**; (b) la prueba que fija que **el motivo del rechazo se lee en la tarjeta**, única superficie que lo muestra desde el 2026-10-08 | La mutación de la concatenación **tiene que poner la prueba en rojo** (si no, no prueba nada); `pnpm test` focalizado + `pnpm check` en verde; compuerta nativa propia sobre el rango commiteado |
| WU-7 | **Iteración de la hoja `/dev/publication`** (feedback del autor, 2026-10-07, tras la primera revisión visual) | (a) el botón de publicar en sus **dos colocaciones** —hero y `aside`— con el conteo de acciones del hero a la vista; (b) la cola con **pendientes y resueltas**, el primer ítem **decidible** abierto y el resto **plegado**; (c) la cola como **page propia** con las formas multi-org para comparar; (d) la entrada en el menú de usuario **con y sin contador**; (e) el bloque de referencia en el panel | Se revisa **mirando** la hoja en vivo (regla 8); `pnpm test` + `pnpm check` + `pnpm build` en verde; **sólo UI del portal: la API no se toca** |

## WU-2 · Brief de decisión (2026-10-07)

### Lo que ya está medido, y no hay que estimar

**El alcance A está construido.** La rama aparcada es el PR 2 completo y **para el actor correcto**:
`PublishControl.svelte` consulta `listForUser("admin")` y se ofrece sólo si el usuario administra la
organización dueña (`6b53c64:src/lib/components/dataset/PublishControl.svelte:54-59,91`), y publica con
`package_patch {id, private: false}` (`6b53c64:src/lib/api/datasets.ts` → `publish()`).

**El backend de A no necesita una sola línea.** `auth.py:118-160` ya resuelve exactamente lo que A necesita:
sólo un `admin` de la organización pliega `private` a público; cualquier otro recibe `403` con mensaje propio.
Las cuatro garantías de autorización de la spec están aplicadas y medidas por la sonda (**25/25**,
`apply-progress.md`).

**La infraestructura que B necesita no existe, pero el patrón sí.** `ckanext-umss` tiene hoy `plugin.py`
(29 líneas), `auth.py` (190) y tests: **ningún modelo, ninguna migración, ninguna acción**. CKAN trae el
ejemplo canónico dentro de la propia imagen — `ckanext/example_database_migrations/`, con `plugin.py`,
`migration/example_database_migrations/{alembic.ini,env.py,script.py.mako}` y **dos versiones de ejemplo**
que crean tablas. B no inventa el mecanismo: lo copia. Pero **estrena en este repo una capa entera**.

**Y la decisión difícil de B no es la que se temía.** El guard ya importa `ckan.model` y lee el paquete
(`auth.py:104-112`), así que consultar un registro es una consulta más, no un salto arquitectónico. Lo
difícil es la semántica, no el acceso.

### La asimetría que decide

**Publicar un dataset no requiere la cola.** La cola agrega dos cosas, y ninguna es «que el dataset llegue al
catálogo»: (a) que un **editor sin capacidad de admin pueda pedir**, y (b) que quede **registro de quién
aprobó qué**. Como `RF-15` permite que el mismo `admin` pida y apruebe, para una organización con un solo
administrador la cola es **dos clics y una fila**: governance, no capacidad.

Del otro lado, y con el mismo peso: **A deja el flujo obligatorio sin cumplir**, y el PRD hoy lo exige. Eso
no se arregla con código — se arregla **ajustando el PRD de forma explícita** y diciendo que el flujo entra
con `v1`, o sosteniendo el PRD y pagando B.

### Recomendación

**A, con el PRD ajustado a la vista.** No por conveniencia: por el criterio de salida de `v0`, que es
«publicar un dataset con recursos y verlo reflejado en el portal». A entrega exactamente eso, apoyado en una
garantía **ya aplicada y medida** en otro repo, y reusa un artefacto **ya construido y ya costeado**. B no lo
entrega más rápido: lo entrega más tarde, y agrega governance que `v0` no pide.

La condición que la hace honesta: **el ajuste del PRD se escribe, no se omite.** `RF-15` paso 5, la matriz de
§9 y `RF-41`/`RF-42` pasan a `v1` con su motivo —la cola necesita un store durable y una extensión que hoy no
tiene ninguno—, y el guard queda documentado como la garantía que **sí** rige en `v0`.

Si en cambio se sostiene el PRD tal como está, **B es el único camino honesto**, y su primer entregable es el
**store**, no el portal: sin él la cola no tiene dónde vivir, y con el store en el guard el publicar directo
deja de estar autorizado — o sea, el portal se queda **sin ninguna forma de publicar** hasta que la cola
tenga su UI.

## Registro

- **2026-10-07** — Expediente abierto. Decisión del autor: replanificar primero, sin código. **WU-1 cerrado**:
  reconocimiento medido, con dos hallazgos que cambian el brief — el PR 2 aparcado está escrito para el actor
  correcto y el guard ya lo autoriza, y el mecanismo de migración de extensión está disponible en la imagen
  de CKAN aunque la infraestructura no exista en el repo. **WU-2 entregado** (este brief). Pendiente: la
  decisión de alcance del autor (WU-2b).
- **2026-10-07** — **Decisiones del autor (WU-2b)**: (1) **el alcance A/B no se elige todavía**: producir
  primero el **diseño concreto** de «cómo consulta el guard la solicitud aprobada» y decidir con él delante.
  (2) **`RF-41`/`RF-42` = `[v1]`**: la degradación de visibilidad pertenece al ciclo de vida completo y se
  construye con él, no en el corte de `v0`. **WU-2c abierto**.
  *Nota de coherencia:* el diseño de WU-2c se decide **antes** del tier, así que el `[v1]` de `RF-41`/`RF-42`
  no debe usarse para dar por sentado que el store queda en `v1+` — el store es lo que habilita la cola de
  la **subida**, que sí está en juego acá.
- **2026-10-07** — **WU-2c entregado**: `odd/tasks/publication-guard-design.md`. La pregunta heredada («cómo
  consulta el guard la solicitud aprobada») se **reformula**: el guard no consulta — **se convierte en pared**
  y se agrega **una puerta**. Una consulta obligaría a consumir un token dentro de un predicado de lectura
  (doble consumo, ventana de replay) y deja `package_create` sin fila previa a la que atar. La pared no tiene
  ninguno de los tres problemas. El diseño trae, con evidencia medida: la tabla con el desenlace **«anulada»**
  que al PRD le falta (`references/README.md:96-102`), el mecanismo de migración (`ckan/cli/db.py:144-175`;
  registro **por nombre de plugin**, el plugin de ejemplo es `pass`), las **cinco acciones**, la pared y sus
  cuatro cambios de guard, la prueba de que `ignore_auth` no es inyectable desde el cliente
  (`views/api.py:244-280`), y lo que obliga a **enmendar** (`Approver Capacity` + la sonda: hoy afirman que un
  `admin` pliega con `package_patch`). **Aparece una tercera opción de alcance: `A′` — puerta única sin cola**,
  que hace la cola **aditiva** en vez de un rehacer. Decisión de alcance pendiente.
- **2026-10-07** — **Decisiones del autor (WU-2d):** (1) **alcance B** — el modelo del PRD completo: el store
  `publication_requests`, el flujo de solicitud obligatorio y la cola **entran**. (2) **Gate cerrado como
  cadena de unidades** (`A1 → A2 → A3 → A5 → B1 → B2`), cada una con su compuerta nativa, **sin
  `size:exception`**. (3) La reconciliación se **commitea a `main`**.
- **2026-10-07** — **WU-3 cerrado: los cinco artefactos reconciliados a una sola posición.**
  `design.md` **401** (D1–D9) · `specs/publication-lifecycle/spec.md` **636** (13 requisitos, 73 escenarios)
  · `specs/dataset-publishing/spec.md` **148** · `tasks.md` **520** · `proposal.md` **193**.
  El ruteo de agentes SDD está **retirado** en este harness (`sdd-*` devuelve «retired SDD delegation»):
  se usó `gentle-ai-worker` con `## Allowed edit surfaces` acotadas a los archivos del artefacto.
  - **Defecto propio, declarado:** la primera pasada **sacó del cut el control del pedido del `editor`**
    —la razón misma por la que el autor eligió B sobre `A′`— al resolver una contradicción interna de
    `design.md` (el control estaba gateado con `listForUser("admin")`, heredado del componente aparcado,
    que era de publicación directa). Se detectó **cruzando el riesgo que reportó un escritor contra la
    opción que el autor había elegido**, no por una prueba. Corregido en los cuatro artefactos: **dos
    affordances con dos gates** — pedir/cancelar con `update_dataset` (que el portal ya calcula vía
    `listUpdatableOrganizationIds` → `puedeEditarDataset`), publicar/aprobar con `admin`.
- **2026-10-07** — **WU-4 cerrado: gate de presupuesto.** Forecast: **1.579** de código (765 `odp-docker`
  + 814 `odp`) · **2.587** de tests, derivados de ratios **medidos** (2,20 backend —`test_auth.py` 418 /
  `auth.py` 190—; 1,69 componente denso; 0,38 página con marcado) · ~**973** de material de revisión.
  **Falla**: 3,9× el presupuesto solo en código, 10,4× con tests. `size:exception` **no pedida ni inferida**.
  - **Ambigüedad de convención, reportada y sin resolver:** `openspec/config.yaml` dice que
    `review_material_lines` no compite con el presupuesto, pero `apply-progress.md` contó las 373 líneas de
    `probe.sh` dentro de las 915 del PR 1 y declaró el presupuesto excedido.
- **2026-10-07** — **WU-5: cierre.** Handoff escrito en `BACKLOG.md`: la sección «Replanificación pendiente»
  pasó a **«Replanificación HECHA»** con el bloque viejo conservado y marcado como histórico, y el estado
  «EN CURSO» del cambio actualizado. Commit a `main`. **Siguiente: la unidad A1** (modelo + migración +
  registro en `ckanext-umss`).
- **2026-10-07 — Reparto declarado y escrito.** Una sesión par preguntó si había que tocar `odp-docker`
  (creía que el corte podía ser A, 0 líneas). Se le confirmó el **alcance B** con los punteros a los
  artefactos y los hechos ya medidos (registro de la migración por nombre de plugin, `MANIFEST.in`,
  `bulk_update_public` sin delegar, los dos hazards, la deriva 2.11.6 → 2.12.0), y el autor confirmó el
  reparto: **la par hace `odp-docker` (A1/A2/A3); esta sesión hace `odp` (A5 la sonda + B1/B2)**. Está escrito en
  `BACKLOG.md` → «Replanificación HECHA», porque **los mensajes entre sesiones son notificaciones, no
  registros** — y `orchestrator_send_message` devuelve «accepted for delivery», no acuse de lectura.
  **Dependencia declarada: B1 queda esperando a que A2 fije las firmas de las cinco acciones.**
- **2026-10-07 — WU-6 abierto** (decisión del autor). Mientras B1 espera a A2, se construye **lo que no está
  bloqueado**: los dos controles (pedido/cancelar del `editor`, publicar del `admin`), la cola de
  aprobación y el playground `/dev/publication`, con las llamadas **inyectadas** — no se llama a ninguna
  acción real porque todavía no existe. La hoja se arma sobre el playground `/dev/dataset-publish` de la
  rama aparcada (273 líneas medidas, que ya resolvió el panel de presets) y muestra los tres estados del
  flujo más los dos de fallo (`403` honesto; un `200` que no concede no es un éxito).
  **Riesgo declarado:** si A2 cambia el payload de alguna acción, se retoca el **doble** del playground,
  no los componentes — que es exactamente por lo que las llamadas van inyectadas.
- **2026-10-07 — A1 entregada por la sesión par** (`odp-docker` `27b8ab8`, 509 líneas: modelo 73 +
  migración 213 + 15 tests en 223). Suite **69 passed** (54 + 15), `db upgrade` aplica, índice parcial
  confirmado. **Sin pushear todavía.** Verificado acá: el commit existe con ese `--stat`, y **dos
  correcciones que reportó se confirmaron contra la fuente**, no se heredaron:
  1. **La migración no es opcional en los tests.** Medido en `ckan/tests/pytest_ckan/fixtures.py:390-400`:
     `clean_db` **no** crea tablas de extensión, y el fixture `migrate_db_for("umss")` aplica el árbol
     de migración dentro del test — su propio docstring documenta el patrón, y llama a
     `ckan.cli.db._run_migrations`, el mismo camino que `ckan db upgrade`. Consecuencia: **el artefacto
     tenía una excepción a TDD que no correspondía**, y la migración queda ejercitada por la suite en vez
     de sólo por el CLI. Corregido en `tasks.md` (A1.3).
  2. **La auth a encadenar para `bulk_update_public` es su propia función**
     (`ckan/logic/auth/update.py:261`), no `package_update` — medido: es una función aparte que consulta
     `has_user_permission_for_group_or_org(org_id, user, 'update')`, que es exactamente **por qué** la
     cadena de `package_update` no lo cubre. Corregido en `tasks.md` (A3.2).
  **Y la primera medición real del forecast del backend:** el código se estimó bien (80 → 73 y 220 → 213,
  apenas 3-10% arriba), pero el **ratio de tests 2,20 fue 3,0× pesimista** para este material (223 tests
  en vez de ~660). El ratio real de A1 es **0,78** — el valor atípico que el propio artefacto había
  anticipado para el boilerplate de alembic. Se mantiene 2,20 para la auth densa (A3) y **no se revisa el
  total con una sola muestra**.
- **2026-10-07 — A1 CERRADA y pusheada por la sesión par** (`odp-docker` `82ae6b6..01aabc7`, 3 commits,
  **CI verde en los dos jobs**, run `37564700222`; árbol de `master` limpio y en sync). Suite de la
  extensión **54 → 79**. Medido acá, no heredado: **663 líneas** finales — modelo 101, árbol de migración
  232 (alembic.ini 52, env.py 89, script.py.mako 24, `versions/0001_*` 67), tests 330 con 17 funciones —
  y **cinco compuertas nativas**, la última con cero hallazgos. A1 entregó **más** que el plan: la suite
  ejercita el **downgrade** y las restricciones `CHECK` de la migración llevan pruebas de nulabilidad.
  - **Corrección propia, declarada:** el bloque de re-medición del forecast en `tasks.md` había quedado
    con una **instantánea a mitad de camino** (509 líneas sobre `27b8ab8`). El estado final es 663.
    Corregido con los números finales y con la lección escrita: **una unidad se mide cuando cierra, no
    mientras se mueve** — la misma familia que «no mandar correcciones a un verificador que corre»
    (2026-10-06) y que «medir el artefacto contra lo que corre» (`diff`, 2026-09-21).
  - Con los números finales, el veredicto del forecast cambia de signo en la mitad del código: **el código
    se estimó 11% corto** (300 → 333) y **el ratio de tests fue 2,0× pesimista** (330 reales vs ~660
    previstos con 2,20). El ratio propio de A1 es **330 / 333 = 0,99**. Se mantiene 2,20 para la auth densa
    y **no** se aplica a boilerplate ni a modelo declarativo, cuyo ratio medido es ~1,0.
  - **Nada pendiente del lado de la par hasta A2** (las cinco acciones). Faltan los **identificadores de
    linaje** de las cinco compuertas para el registro del repo (la convención los anota).
- **2026-10-07 — GOBIERNO: el autor corrige el diseño, y el defecto era mío.** Reportó que **un `org_admin`
  NO debe poder publicar directo** («rompe la gobernanza al sobrepasar los deseos de los que crean los
  datasets») y pidió justificación si yo creía lo contrario. **No te la pude dar**, y el análisis la
  desmiente en tres pasos:
  1. `design.md:189` justificaba `publication_publish` para el `admin` con «what `RF-15` step 5 already
     grants» — convertí una permisión del PRD en un atajo.
  2. **El repo ya tenía escrita la frase que lo condena**: `BACKLOG.md:1705`, al aparcar el PR 2 viejo:
     «en el modelo del PRD **el que pide no es el que aprueba**». Esa frase fue **la razón** de aparcar
     aquella rama, y mi diseño permitía exactamente la auto-aprobación que descarta.
  3. La consecuencia que faltaba ver: **con auto-aprobación el store es un registro, no una compuerta.**
     Gastamos pared + store + cinco acciones por una propiedad de gobernanza que devolvíamos por la puerta
     de atrás. Y el camino directo permite **publicar un dataset que el admin no creó** — un borrador con
     datos provisorios o sensibles que su autor estaba trabajando.
  **Decisión del autor (2026-10-07), en dos parámetros:**
  - **Cuatro ojos**: nadie aprueba su propia solicitud. Aprueba otro `admin` de la organización dueña, un
    `admin` de una organización **padre**, o un `sysadmin`. Costo aceptado: una organización con un solo
    `admin` necesita a un `sysadmin` (precedente en el propio PRD: «una organización con editores pero sin
    admin no puede publicar» ya está aceptado).
  - **`publication_publish` (publicación directa) queda sólo para el `sysadmin`** — que ya la tiene de
    hecho, porque CKAN le cortocircuita toda autorización salvo que la función pida `auth_sysadmins_check`
    (y el diseño deliberadamente no lo pide). La diferencia es que pasa a ser una **puerta que registra**
    (deja fila), en vez de un bypass silencioso.
  - **El comentario del aprobador: obligatorio al RECHAZAR, opcional al aprobar** (antes era «(opcional)»
    en las dos). Un rechazo sin motivo deja al solicitante sin saber qué corregir y a la auditoría sin nada
    que leer. Entra **ahora**, con A2 todavía sin escribir: sale gratis como contrato.
  **Casos nuevos que abre la regla** (anotados para la hoja): el **único admin es el solicitante** → la
  pantalla debe decir «no podés aprobar tu propia solicitud» en vez de ofrecer un `403`; y la **solicitud
  anulada**, que es el desenlace que el esquema del PRD no tiene.
  **Medido, y mejor de lo que había escrito:** el portal **ya conoce el flag de `sysadmin`** —
  `src/lib/stores/auth.ts:93` exporta `isSuperAdmin = derived(auth, ($auth) => $auth.user?.sysadmin === true)`,
  y `src/lib/server/ckan-auth.ts:120` lo parsea de la respuesta de login. Y `src/lib/stores/auth.test.ts:58-63`
  **ya prueba la distinción que esta regla necesita**: es `false` aunque `capacity === 'admin'` — exactamente
  el par que separa «administra la organización» de «publica directo». **La regla no necesita plumbing nuevo.**
  *Corrección de un error propio:* en el bloque de arriba escribí que el portal **no** conocía el flag, **en el
  mismo bloque en que corría la medición que lo desmiente**. Es la cuarta vez en esta sesión que afirmo antes
  de medir, así que la regla pasa a ser operativa: **la medición y la afirmación no van en el mismo bloque.**
- **2026-10-07 — Añadido el TODO del `cyber-check`** al `BACKLOG.md` (`[v1]`), como **paraguas** y sin
  duplicar los agujeros ya anotados, con el momento recomendado **después** de que cierre el ciclo de
  publicación: la pared y el store **cambian la superficie de autorización**, así que una revisión hecha
  antes mide un sistema que ya no existe.
- **2026-10-07 — El escritor corrigió dos cosas de las mías, y las dos eran ciertas.** (1) Mi cita
  **`BACKLOG.md:1653-1656` estaba vencida**: la frase vive en **`:1705`**, verificado contra
  `git show HEAD:BACKLOG.md`. La había propagado desde el reporte de un explorador **sin medirla**, y ya la
  había usado en dos mensajes y en este documento. **Quinta vez en la sesión que afirmo antes de medir**,
  y la primera en que el error entra en un artefacto por herencia y no por lectura propia: la regla crece —
  **una cita que se propaga se verifica, no se hereda.** (2) Dio por falsa una afirmación de
  `specs/dataset-publishing/spec.md` («el administrador publica después por la acción de publicación») que la
  regla nueva volvía mentira, y la corrigió.
- **2026-10-07 — `annulled` tiene dos disparadores, y solo uno se difiere.** El PRD define el desenlace en
  `PRD.md:164` (RF-42): *«Si existía una solicitud pendiente sobre ese dataset, queda **anulada** y no puede
  aplicarse después»* — atado a la **degradación directa**, que es `[v1]`. Pero el store necesita el **mismo
  desenlace por otra razón y en este corte**: si el dataset se **borra** o ya quedó **público** por otra vía
  (el `sysadmin`), una fila `pending` colgada **bloquea para siempre** el índice «una sola pendiente por
  dataset» y miente en la cola. **Confirmado: la anulación por pérdida de objeto entra en este corte; la
  degradación de un dataset publicado (RF-42) sigue `[v1]`.** Comparten el nombre del desenlace, no el
  disparador — y el artefacto tiene que decirlo así para que nadie lea la segunda como reabierta.
- **2026-10-07 — La par corrigió una contradicción interna de mi registro**, y tenía razón: el bloque del
  reparto le asignaba **`A5` (la sonda reescrita)** a la columna de `odp-docker` **y en el mismo bloque**
  prohibía que esa sesión toque el `openspec/**` ajeno — donde vive el artefacto. Medido acá:
  `openspec/changes/2026-09-13-publication-lifecycle/probe.sh` son **373 líneas**, y `git ls-files` confirma
  que está **en este repo**. Corregido en los tres lugares donde estaba (los dos bullets de `BACKLOG.md`, la
  línea «magnet» que le escribí a la par, y este expediente), con la corrección declarada en el propio texto
  y el crédito a quien la encontró. **La dependencia sigue en pie y es real:** la sonda corre contra el stack
  que A2/A3 construyen, así que va después de `A3` en la cadena aunque el archivo sea mío.
  *La lección, que es la de esta sesión otra vez:* **un reparto y una regla de frontera escritos en el mismo
  bloque se leen juntos o no sirven** — y el error lo encontró la parte que no lo escribió. Un registro que
  se contradice a sí mismo no se detecta releyéndolo con la misma cabeza que lo escribió.
- **2026-10-07 — WU-6c cerrado: la hoja muestra dónde vive la cola.** Dimensión nueva **`colocacion`**
  (se compone con `vista`/`caso`/`fallo`/`cola`/`panel`, y todo sigue en la URL): **sección en el
  dashboard** (con el ritmo de «Mis datasets»), **ruta propia** alcanzable desde una entrada de navegación,
  **contador de pendientes** —incluido el **caso cero**, porque una navegación sin insignia no debe verse
  rota— y **aviso en la página del dataset** para quien puede actuar. Las cuatro renderizan la
  `PublicationQueue` **real** dentro de una miniatura fiel de su contexto, y las anclas de la navegación y
  del aviso son **anclas reales** hacia la propia hoja, así que la **alcanzabilidad es demostrable** en vez
  de afirmada. **+387 / −22 en un solo archivo**; `pnpm check` 0 errores / 4 warnings preexistentes; suite
  **61/951** sin moverse; las cuatro URLs responden **200**.
  **Por qué no es acabado:** si la cola no se descubre, el editor pide y **nada pasa** porque el `admin`
  nunca ve la solicitud — la pared se vuelve un **bloqueo silencioso**. La descubribilidad de la cola es
  **parte de la correctitud del gate**, no del pulido.
  **Verificado acá, no heredado:** ningún componente de `src/lib/components/**` **importa** de
  `src/routes/dev/**` — sólo hay **dos menciones en comentarios** preexistentes en `components/error/**`, que
  explican su propia hoja —, así que borrar la hoja **no toca el producto**.
  **Pendiente de la revisión del autor:** la pregunta que quedó abierta de la iteración anterior —si un
  `admin` debe ver **las dos** affordances o sólo la cola— y el `err.message` crudo en las alertas.
- **2026-10-07 — Hallazgo grave, y era mío: la regla de cuatro ojos estaba INERTE en producción.** La par
  reportó las cinco firmas de A2 y, entre los datos para el portal, que `requested_by`/`approved_by` son
  **ids de usuario, no nombres**. Cruzado con el componente: la cola defaulteaba el espectador a
  `$currentUserStore?.name` —el **nombre de usuario**— y comparaba `item.requested_by === viewer`. Con ids
  del lado del catálogo, **la comparación nunca da igual**: `isOwn()` siempre `false`, el bloqueo de cuatro
  ojos **nunca se activa**. Implementado, **en verde**, y muerto.
  - **Por qué las pruebas no lo vieron**: los fixtures usaban `"editor.tecnologia"`, un **nombre** — la
    misma forma que producía el default. La prueba no era falsa: era **incompleta**, porque afirmaba la
    regla sobre una forma que la API no devuelve. Un fixture que coincide con el default propio es un
    **espejo**, no una prueba.
  - **Arreglado**: la comparación es por **id**; la fila renderiza una **persona**, no un identificador
    (campo de presentación aparte, etiqueta neutral cuando no viene, y **nunca** el id crudo). Y las dos
    pruebas que faltaban existen: una recorre el **camino real** (sesión sin inyección, con su `id` igual al
    de la fila) y otra guarda el **falso positivo** (un `name` igual al `id` de la fila **no** bloquea).
    Suite **951 → 954**; cuatro REDs de comportamiento antes del arreglo.
  - **Lección generalizada, escrita porque ya van dos veces en esta sesión** (las cuatro aserciones de
    `403` y esto): **una suite verde puede esconder una regla muerta cuando los datos de prueba se eligen
    para coincidir con la implementación en vez de con el contrato.** La regla operativa: **el fixture se
    escribe con la forma que la API realmente devuelve**, y se pregunta explícitamente «¿qué forma produce
    el otro lado?» antes de darla por buena.
- **2026-10-07 — A2 aprobada, pero contra el contrato derogado en dos puntos.** La par reporta
  `review-5f706892311805c8` (tier high, 4 lentes, con ronda de corrección) sobre `1a2d6c2` (**local, sin
  pushear**). Dos de las cinco firmas **contradicen la decisión del autor del mismo día**: `publication_publish`
  autoriza «admin o sysadmin» (el contrato vigente lo quiere **sólo `sysadmin`**, `design.md:194,207`) y
  `publication_request_decide` no menciona la exclusión del solicitante (`spec.md:284`, «**never the
  requester**»). **La causa no es un error de ellos: el autor cambió la regla mientras A2 corría**, y el
  canal entre sesiones —ya medido como no confiable— puede no haber entregado el aviso a tiempo. Reportado
  con las citas y reenviado. **Los dos deltas necesitan su propia compuerta**, no repetir la misma: no es
  reabrir A2, es un delta acotado.
  **Y una lección de autoría propia, declarada:** el **valor de retorno** de las cinco acciones **nunca se
  especificó en el artefacto** — asumí que devolvían el dataset y no lo escribí. La par devuelve la **fila**,
  y eso es legítimo. **Me adapto yo**: el portal **re-lee el dataset** después de la acción, lo que hace la
  regla «un `200` que no concede no es un éxito» **más fuerte** (verifica el efecto, no la respuesta).
  **Pendiente de la par:** los 8 *advisory* de su ronda (`wip/a2-advisories`), y después A3/A5/A6.
- **2026-10-07 — Lección de método, mía, y me la corrigió la par: un ref remoto local es una medición cacheada.**
  Afirmé «`27b8ab8` no está pusheado» **repitiendo el «sin push todavía» de la par**, sin medirlo y **sin
  fecharlo**: era cierto cuando ellos lo dijeron y ya no lo era cuando yo lo escribí. Medido con
  `git fetch` + `git merge-base --is-ancestor`: **sí es ancestro de `origin/master`**, y el `FETCH_HEAD`
  tenía ~2,5 h. Regla operativa: **una afirmación heredada se fecha y se re-mide antes de repetirla sin
  atribución**, y **para afirmar estado de push hay que fetchear primero**. Segundo error propio de la misma
  ronda: inferí «probablemente A2 en curso» sobre dos archivos modificados, y era **A1.5** — la conjetura
  sobraba, lo correcto era decir que no sabía qué unidad era.
  **Y la precisión que el episodio deja, para no confundir dos cosas:** *el estado del push no es el
  contenido del código.* El hallazgo de gobernanza se re-verificó **leyendo `origin/master` directamente**
  (`git show origin/master:…/logic/auth/publication.py`): `publication_request_decide` (114-121) **sin
  comprobación de cuatro ojos** —la única condición es la capacidad `admin`— y `publication_publish`
  (124-131) **autorizando al `admin` de organización**, con el docstring «on their own authority». El
  hallazgo no dependía del push: depende de las líneas del archivo publicado.
- **2026-10-07 — Los linajes de las compuertas, que era lo que faltaba para el registro del repo.** Reportados
  por la sesión par (su store de revisión vive en el otro clon; se anotan **atribuidos**, no verificados acá):
  **A1** — `review-04308fb1e12fe578` (2 SUGGESTION) · `review-256de69ad107978d` (2 WARNING + 2 SUGGESTION) ·
  `review-32bb63b000a52fcb` (1 WARNING) · `review-bffb15b83bcefbd9` (1 WARNING) · `review-2945fa36b804f1d9`
  (cero hallazgos). **Cinco, todas `approved` con la autoridad quemada**, y **7 hallazgos no bloqueantes,
  los 7 cerrados dentro de la unidad** — no diferidos. **A2** — `review-5f706892311805c8`, tier high, 4
  lentes, `correction_required` → **approved** tras la ronda de corrección.
- **2026-10-07 — El ratio del forecast, tercera corrección en un día, y la buena es que la predicción era
  falsable.** Predije —y escribí la predicción— que A2, siendo lógica densa como `auth.py`, se acercaría al
  **2,20**; si salía muy por debajo, el ratio estaba midiendo otra cosa. **Salió 1,20.** Medido acá con
  `git diff --stat 01aabc7..1a2d6c2`: código **427** (acción 249 + auth 142 + plugin +36/−3) y tests **513**.
  La par reportó 404 y 485 (otra convención de conteo); **el ratio coincide: 1,20 en los dos casos**, y ése
  es el número que viaja.
  **Consecuencia: el ratio NO es propiedad de una clase de material.** El 2,20 midió la densidad particular
  de `auth.py`, y extrapolarlo a «lógica densa» —el refinamiento que este mismo expediente propuso tras
  A1— está mal por el mismo factor. Con cuatro mediciones (A1 **0,99** · A2 **1,20** · componente denso del
  portal **1,69** · `auth.py` **2,20**), la guía revisada es **pronosticar `test_lines` como un rango de
  1,0–1,7 × código** y **retirar el 2,20 como default del backend**.
  **La lección de fondo es sobre la regla, no sobre el número:** **una regla derivada de dos muestras es una
  hipótesis, y ésta quedó escrita como regla.** Hicieron falta la tercera y la cuarta para verlo.
- **2026-10-07 — Aviso operativo: `dataset` todavía NO está en el código.** **[SUPERADO: el contrato terminó
  siendo **uniforme** —nadie devuelve `dataset` y el portal re-lee—; ver la entrada de la cuarta y última
  decisión, más abajo. Se conserva porque describe un estado que fue cierto.]** El contrato aditivo estaba
  **decidido** (y el portal lo consumía entonces), y la clave `dataset` llega en la unidad de seguimiento de A2
  con su propia compuerta. **Contra la acción desplegada, el portal leería cada publicación exitosa como
  fallo.** Por eso **B1 espera esa clave, no sólo a A2** — y el doble inyectado de la hoja es, por ahora,
  la única forma de ejercitar la regla.
- **2026-10-07 — La par confirma el hallazgo y consolida la dependencia: NO cablear B1 contra A2.**
  Verificaron mi `41de6c2` en `origin/main` y concluyen que **A2 quedó no conforme** con D4. El riesgo que
  marcan es concreto y es el **espejo** del de `dataset`: **`publication_publish` pasa a ser sólo `sysadmin`,
  así que un `admin` de organización recibe `403`** — un control del portal cableado contra A2 **haría fallar
  cada publicación de un `admin`**.
  **La unidad de seguimiento quedó DEFINIDA por la par (2026-10-07), y la agrupación es suya, no mía**:
  **`unit/a2-governance`, una sola compuerta**, con (1) **las cuatro deltas de gobernanza** —`publish` sólo
  `sysadmin`; `decide` nunca el solicitante y **comparando ids, no nombres**; `comments` obligatorio al
  rechazar; la re-verificación del estado actual (**A2.6**) y la anulación de la `pending` huérfana
  (**A2.7**)—; (2) la clave **`dataset`** en `publish` y en `decide{approve:true}`; (3) los campos
  **`requested_by_name`/`approved_by_name`**, batcheados en **una consulta por llamada**; y (4) **el archivo
  *tracked* con el contrato de las cinco acciones** — que es donde voy a leer la firma, **no en un mensaje**.
  Los **8 *advisory* van aparte**, en `unit/a2-advisories` (`57fb1a6`), con su **propia** compuerta:
  **conformidad y calidad no se mezclan**, que es lo que el autor pidió.
  *(Mi registro anterior agrupaba esto como «siete cosas»: era **mi** lectura, no la suya. La agrupación
  autoritativa es la de arriba, y la dejé corregida.)*
  Y **`dataset` entra en esa unidad en lugar de diferirse**, precisamente porque **B1 lo espera**: el motivo lo
  confirmó la par — no es una comodidad del consumidor, es lo que impide cablear contra una forma incompleta.
  **`A5` queda mío, y ellos lo verificaron**: revisaron que `probe.sh` es de **este** repo y que el registro
  está corregido, y no lo pueden reescribir porque **corre contra el stack que construyen**. Su trabajo
  abierto: esa unidad, A3 y A6.
  **Y el orden se sostuvo por disciplina, no por suerte:** los dos riesgos que aparecieron hoy —`dataset`
  ausente y `publish` no conforme— nacen los dos de **adoptar el contrato nuevo antes de que el código lo
  cumpla**. Lo que evitó que el portal rompiera publicaciones fue la regla de **no cablear contra una forma
  que todavía no existe**.
- **2026-10-07 — Decisión del autor: las solicitudes NO vencen, y la cola muestra la antigüedad.** El hueco
  estaba declarado y sin decidir; se cerró **como decisión, no como olvido** — que es la diferencia entre un
  ítem que no reaparece y uno que reaparece cada sesión. La forma elegida: **nada expira automáticamente**, y
  la cola dice **hace cuánto** está pendiente cada solicitud, con **énfasis visual** pasado un umbral
  (**90 días**, declarado como **elección de presentación, no política**). La razón: el problema real no es
  que la solicitud exista, sino que **nadie note su edad**; un vencimiento automático decidiría *por* el
  usuario cuando la organización está en pausa, y habría exigido un estado nuevo o una transición por tiempo.
  **Implementado:** `formatRelativeAge` en `src/lib/utils/ckan.ts` (pura, con `now` inyectable, y **agregada
  al barril** `src/lib/utils.ts` porque así importa la cola — el escritor la había importado directo del
  módulo y eso rompía la convención del propio archivo); la fila muestra **fecha absoluta y antigüedad**; y
  la hoja tiene el preset «Solicitud antigua» para revisarlo mirando. Suite **956 → 967**; `pnpm check` 0
  errores / 4 warnings preexistentes. Registrado en `design.md` (la decisión y su porqué), en `spec.md` (la
  lista de no-objetivos **y** el requisito de la cola, con escenario propio) y en el mapa de cobertura de
  `tasks.md`.
- **2026-10-07 — La par mide lo mismo que yo: la comprobación de cuatro ojos NO existe.** Lo confirmó en su
  propio código: `publication_request_decide` sólo evalúa capacidad de `admin` sobre la org dueña, y
  `requested_by` aparece **una sola vez** en el archivo de auth —en `_cancel`, para el solicitante—: **en
  `decide` no hay comparación con el solicitante**, así que hoy un `admin` que pidió **puede aprobarse su
  propia solicitud**. Es la **segunda medición independiente del mismo código** (yo lo había leído en
  `origin/master`), y dos mediciones por caminos distintos valen más que cualquiera de las dos sola. Va en su
  `unit/a2-governance`, con base limpia sobre `1a2d6c2` y compuerta propia.
  - **Su chequeo comparará ids, no nombres** —el error fácil de cometer de los dos lados, y el que yo
    cometí— y agregará `requested_by_name`/`approved_by_name` **en una sola consulta batcheada** para todos
    los ids distintos de la página: por fila sería N+1 y en una página con veinte pendientes se nota.
- **2026-10-07 — El valor de retorno quedó EN RECONSIDERACIÓN, y el portal no se cablea hasta que se
  confirme.** El autor había decidido **aditivo** (fila + `dataset`) y la par lo consulta de nuevo a partir
  de mi argumento de re-leer. **Mi recomendación, registrada con su contra:** **contrato uniforme —las cinco
  acciones devuelven la fila— y el portal re-lee el dataset**, por tres razones: (1) la re-lectura verifica
  **el efecto en la fuente** y no el autorreporte de quien lo escribió, que es la misma disciplina de
  «medir, no heredar» aplicada al payload; (2) un contrato uniforme no tiene casos especiales; (3) `dataset`
  es una comodidad **del consumidor** metida en el contrato del productor. **La contra, entera:** agrega un
  modo de fallo —una **segunda llamada que puede fallar**—, así que el portal debe distinguir **tres**
  estados (*la acción falló* · *funcionó y no pude confirmar* · *confirmado*) y exhibirlos por separado;
  mezclarlos convierte un error de red en un «no se publicó», que es peor que no mostrar nada.
  **Estado real de mi código, para que no sorprenda:** el portal **hoy asume el aditivo**
  (`result.dataset.private === false`), está en `main` y **no está cableado** — sólo lo consumen los **dobles
  de la hoja**. Si el contrato cae al uniforme, el cambio es de **una sola frontera** (dejar de leer `dataset`
  y re-leer). **La diferencia no es de corrección sino de dónde se verifica; lo que no conviene es cambiar de
  forma después de cablear B1.**
- **2026-10-07 — Confirmaciones de la par, y una corrección de criterio mía que acepto.**
  1. ~~**El contrato aditivo queda CONFIRMADO**~~ **[SUPERADO: el autor lo pasó a uniforme en la cuarta
     decisión; ver la entrada de más abajo.]** `publication_publish` y `decide {approve: true}` devolvían la
     fila **más** `dataset`, y **no hay que volver atrás nada** de lo ya commiteado. El portal estaba en lo
     correcto y su doble también.
  2. **Los campos de presentación entran**: `requested_by_name` y `approved_by_name` (username de CKAN),
     **resueltos en una sola consulta batcheada por llamada** y **uniformes en las cinco acciones**.
  3. **Las dos deltas de autorización van a `unit/a2-governance`, rama aparte de los *advisory*, con su
     propia compuerta.** Yo había pedido meterlas juntas en la unidad de los advisories;
     **ellos prefieren no mezclar y tienen razón: `conformance` y calidad son dos preguntas distintas, y una
     compuerta que las mezcla no puede decir qué aprobó.** Retiro mi sugerencia — la suya es mejor.
  4. **`A5` queda cerrado**: verificaron `7f4bf86` en `origin/main` y el bloque con su razón escrita.
  5. Confirman el fondo del asunto: **la garantía es del servidor y el portal es consultivo** — que es
     exactamente lo que arreglan los deltas.
  **Consecuencia para el portal:** se agrega `approved_by_name` al tipo de la fila y **se muestra quién
decidió en las filas ya decididas** (`approved`/`rejected`; en `cancelled` canceló el solicitante y en
`annulled` no hubo decisión), con la misma regla de respaldo neutral y **nunca el id crudo** que ya rige para
el solicitante. Es completar el contrato de presentación, no una funcionalidad nueva.
- **2026-10-07 — El intercambio con la par cierra, y cierra bien.** Aceptan la distinción: su corrección era de
  **estado** (ref cacheado, `FETCH_HEAD` de 01:21) y el hallazgo de gobernanza es de **contenido** — leído de
  `origin/master`, líneas 114-131 del archivo publicado — así que **no lo invalida**. Y adoptan la regla del otro
  lado: **«una afirmación heredada se fecha y se re-mide antes de repetirla sin atribución»**.
  **Los dos pendientes quedan encolados, cada uno con su propia compuerta**: los cuatro deltas en
  `unit/a2-governance` (cuatro ojos comparando **ids**, `comments` obligatorio al rechazar) y los campos de
  presentación `requested_by_name`/`approved_by_name`, **batcheados**. Avisan con la firma real cuando estén, y
  con la frase que más vale del intercambio: **«esta vez la forma queda escrita en un archivo *tracked*, no en un
  mensaje»** — que es la conclusión operativa de todo lo que hoy falló en el canal entre sesiones.
  **Consecuencia de mi lado, ya hecha:** el contrato de presentación completo —los **dos** nombres, batcheados y
  uniformes en las cinco— quedó escrito en `spec.md`, con el escenario que fija que una fila `cancelled` o
  `annulled` **no** declara decididor. **Un contrato que vive sólo en un mensaje no es un contrato.**
- **2026-10-07 — El contrato del retorno pasó a UNIFORME, y ganó el argumento más fuerte, no el más cómodo.**
  **Cuarta y última decisión del día sobre este punto: las cinco acciones devuelven SÓLO la fila**; ninguna
  devuelve `dataset`. El portal **re-lee el dataset** después de una acción que pliega y confirma desde **el
  valor almacenado**. Lo que decidió el punto fue un dato que a la par le faltaba y que es mío: **el portal
  asume el aditivo en `main` pero NO está cableado**, así que caerlo cuesta **una frontera, no trabajo**; más
  el criterio — **una excepción en un contrato público vive para siempre, mientras el costo de la re-lectura
  vive en un solo consumidor**, y medir el valor almacenado es más fuerte que creerle a la respuesta del que
  lo escribió.
  **Mi contra quedó registrada tal cual, y ahora es parte del contrato:** la re-lectura agrega **una llamada
  que puede fallar**, así que el portal **no puede colapsar tres estados en dos** — *la acción falló* ·
  *funcionó y la confirmación no se pudo establecer* (la re-lectura dice que sigue privado, **o** la
  re-lectura misma falla) · *confirmado*. **Mostrar el del medio como fallo es falso**, y no se hace.
  **Reemplazo, no agregado:** la redacción aditiva se **sustituyó** en `design.md` y en `spec.md`, con una
  línea que dice qué la reemplazó — dejar las dos afirmaciones vivas es exactamente la incoherencia que este
  cambio se pasó el día eliminando. Verificado con `grep` propio **antes** de commitear: ninguna frase
  aditiva sobrevive.
  **Implementado:** los dos componentes con la **segunda llamada inyectada** (`readDataset`) como **única**
  concesión; en la cola, la aprobación sale **sólo si la re-lectura confirma** el pliegue, y el rechazo sale
  por el estado de la fila **sin** re-lectura; los dobles de la hoja devuelven filas y tienen un caso nuevo de
  **re-lectura que falla**, para que el estado del medio sea revisable mirándolo. REDs de comportamiento
  (ocho fallos contra los componentes sin cambiar); suite **971 → 973**.
- **2026-10-07 — Primera re-sincronización bajo la regla de propiedad, y sirvió.** La par cortó el bucle y
  escribió el contrato entero en un archivo *tracked*: `ckan-docker/src/ckanext-umss/PUBLICATION-ACTIONS.md` en
  `odp-docker` `master`, commit `f78f66a`, con un **banner de estado** que dice que el código entregado
  (`1a2d6c2`) es **anterior** a la enmienda `41de6c2` y que **no se cablea hasta que la unidad cierre**. Lo leí
  **de ahí** —y no de sus mensajes, que cruzaron cinco veces— y **re-sincronicé mi `spec.md` contra él**, que es
  la obligación que yo mismo me había escrito en el `BACKLOG`.
  **Tres divergencias reales, las tres cerradas:**
  1. **La regla de existencia no estaba en mi espejo**: un `request_id`/`dataset_id` irresoluble responde
     **`NotFound` (404), nunca `403`** — reportar algo que no existe como capacidad faltante es falso, y es lo
     que impide que una fila sobreviva a su dataset. Con el mecanismo: **las funciones de auth responden
     `success` a propósito** ante un id irresoluble (una búsqueda fallida no contesta la pregunta de
     autorización) y **las acciones** son donde se comprueba existencia. Es además un **defecto latente del
     portal**: mis componentes mandan cualquier error no-403 a la rama genérica, así que un `404` se leería
     como «no se pudo».
  2. **La cascada de `publication_request_list`** (la capacidad `update_dataset` de la org, que cascadea por la
     jerarquía) no estaba dicha.
  3. **`publication_request_list` es de lectura** (`side_effect_free`) y tampoco estaba — y eso es contrato, no
     detalle: una lectura no muta.
  **El resto del espejo ya coincidía**: el uniforme con sus tres estados, cuatro ojos por id, los nombres
  batcheados con respaldo neutral, el motivo obligatorio al rechazar, y `annulled` ≠ `cancelled`.
  **La regla de propiedad funcionó, y ésa es la noticia:** leer el archivo autoritativo en vez de los mensajes
  convirtió «¿quién dijo qué y cuándo?» en **una lista concreta de tres cosas que faltaban**.
- **2026-10-07 — Cierre verificado por la par, y una observación suya que generaliza el hallazgo.** Verificaron
  `f5fcfce` en `origin/main` —mi spec sin frases aditivas, y las tres re-sincronizaciones dichas— y aportaron el
  punto fino: **las tres claves ya estaban en su archivo porque su código ya hacía eso.** No las descubrí porque
  el archivo dijera de más, sino porque **el archivo dejó de esconder lo que el código ya hacía.**
  **La generalización, que es lo que vale:** **un descubrimiento de interfaz no agrega información — hace
  visible lo que ya estaba pasando.** Un mensaje transmite lo que el emisor *sabe*; una referencia de interfaz
  expone lo que el sistema *hace*. Por eso ningún mensaje lo habría dado: **no hay nadie que sepa lo que el
  sistema hace sin mirarlo.**
  **Mi hallazgo del `404` leído como «no se pudo publicar» es de la misma familia que el nombre contra el id:**
  **una suposición del consumidor que sólo se ve al cruzar la interfaz.** Y como va a B1, **quedó escrita en el
  contrato** (`spec.md` → `No Fabricated Publication`): el `NotFound` es una **tercera condición** y no puede
  reportarse como fallo de publicación ni como capacidad faltante — colapsarla en el error genérico es una
  afirmación falsa sobre lo que pasó. Con su escenario.
  **Estado del contrato: cerrado y coincidente en los dos repos.** El mío enmendado, el suyo con el banner de
  estado vigente; **la unidad `unit/a2-governance` es lo próximo**, contra ese archivo y con una sola compuerta.
  *(**Corrección posterior, y el error es mío:** la par verificó que **`f5fcfce` es un commit de **estilo** del
  hook —19 líneas sobre `PublishControl.svelte`—, no el del uniforme.** El commit que hizo el cambio es
  **`d24860a`** («the contract is uniform, and the confirmation is a re-read») y la re-sincronización del espejo
  es **`fa0688d`**. Yo les había dado `f5fcfce` porque era el **HEAD del push** con el que aterrizó: **el ref
  apunta al final y el cambio está adentro.** Tercera cara del mismo defecto del día —un *snapshot* leído como
  estado—, y la pagó la par con una vuelta de verificación. **Una cita mal copiada obliga al otro a re-medir**,
  que es exactamente lo que estuvimos corrigiéndonos todo el día.)*
  **Y anotaron de mi spec lo que `A5` va a tener que re-medir**: el **baseline medido con la deriva 2.11.6 →
  2.12.0 declarada**, y **`P6` identificado como la fila que la pared retira** (un `admin` publicando con
  `package_patch`).
- **2026-10-07 — Cierre con la par, y una precisión suya que mejora mi regla.** Verificaron `9d71981` en
  `origin/main` (el ítem 4 está en los dos lugares) y **admitieron el rezago como propio**: reconciliaron contra
  mi **lista vieja de siete** y me corrigieron **con un *snapshot*** — la misma falla que me señalaron a la
  mañana, del otro lado. Y **aceptaron la regla de propiedad con una precisión mejor que mi redacción**:
  **el `spec.md` sigue siendo el artefacto de requisitos** (ahí vive el *qué*) y **se enmienda**, no se
  reemplaza; **su `PUBLICATION-ACTIONS.md` es la referencia de interfaz para las firmas** y la spec **apunta a
  él**; si difieren **en la firma gana el archivo**, y si difieren **en el *qué* decide el autor**. Mi primera
  redacción decía que la spec «**espeja**» al archivo, y **eso la degradaba a copia**: `mirrors` era la palabra
  equivocada.
  **Y confirmaron el punto de `A5`**: necesita **la pared de A3 *y* la autorización de la puerta de su unidad**;
  sin las dos no hay nada nuevo que medir.
  **Síntesis de la jornada, que vale más que los seis hallazgos juntos:** los seis —el ref cacheado, el nombre
  contra el id, el reparto de `A5`, el agrupamiento de las deltas, la cita de un commit superado y el patrón
  atado al idioma— **son la misma falla**: **leer un *snapshot* —un commit, un ref, una lista, un mensaje, una
  redacción— como si fuera el estado vivo.** Y los seis se corrigieron con el mismo movimiento: **contrastar la
  afirmación contra su fuente.** Ninguno se corrigió releyendo lo propio con más atención.
  **Y la par unificó el día con una ley que cubre más que esos seis**: *lo que se verifica es el
  **significado**, no la forma en que uno lo escribió.* Es la misma ley detrás de las cuatro instancias de
  «prueba verde que no prueba lo que dice» —mi `grep` atado al inglés, la regla de cuatro ojos comparando un
  nombre contra un id, y las aserciones de `403` que no podían fallar— **y la registraron como cuarta regla
  operativa del cambio**. Con un corolario que le agregué, porque es la mitad accionable: **el significado no se
  puede verificar desde adentro.** Las cuatro se encontraron **cruzando un borde** — el otro repositorio, la
  mutación, el otro artefacto, el otro idioma—, y ninguna se encontró mirando mejor lo propio. **La ley dice
  qué está mal; el borde dice dónde se ve.**

- **2026-10-07 — Revisión visual del autor de la hoja, y la unidad WU-7.** El autor revisó `/dev/publication`
  y dejó cuatro direcciones. (1) **Los roles se leen bien**: la distinción entre los distintos roles quedó
  clara, sin cambios que pedir. (2) **El botón de publicar**: quiere verlo en **dos colocaciones** —junto a los
  botones de edición del hero, o en el `aside` debajo de la card de organización— y **comparar** cuál queda
  mejor. (3) **La cola**: quiere que sea **page propia** (pendientes primero, después las resueltas), y que
  **sólo el primer ítem** muestre la vista de aprobar/rechazar, con los siguientes **plegados** —«ocultos» en
  sus palabras, pero **conservando la acción**, no borrándola—; quiere además la entrada en el **menú de
  usuario** debajo de «Panel», quizás **con el contador** de pendientes, y **contenido de referencia en el
  panel** apuntando a esa page. (4) **Preguntó por el flujo editorial** (`RF-15` pasos 1–3).
  **Respuestas de método que la unidad deja escritas** — dos son restricciones duras, no preferencias:
  1. **«El primer ítem» es el primer ítem *decidible*, no el primero.** La regla de cuatro ojos prohíbe
     decidir la solicitud propia; en una lista multi-organización la primera fila puede ser del propio
     solicitante. Abrir «el primero» sin esa distinción pondría el flujo en contradicción con la gobernanza
     justo en la pantalla donde se ejerce.
  2. **Plegado, no oculto**: filas alcanzables con teclado y `aria-expanded` en el disparador. Este proyecto
     ya pagó el defecto opuesto (BACKLOG:2122, un estado que sólo vivía en hover y no se podía revisar).
  3. **El flujo editorial está en `[v1]`, y no se pierde**: `RF-15` pasos 1–3 (`draft` → `review` →
     `approved`, con `RF-16`/`RF-17`) son la **máquina editorial**, fuera de este ciclo
     (`BACKLOG:1259`); este ciclo cubre los pasos **4–5**. **Aviso para cuando llegue**: bajo esa máquina
     publicar no es una pregunta de permiso sino una **transición de estado del dataset**, así que modelar
     «solicitar publicación» como sinónimo de «solicitar visibilidad» obligará a desarmarlo después.
  4. **El contador del menú tiene un costo sin verificar**: hoy la acción de la cola devuelve **filas**, no un
     conteo. Un contador global obliga a decidir entre pagar una llamada por página o agregar un conteo — a
     **verificar en la unidad**, no a asumir.
  **Autorización**: el autor pidió **iterar primero** —«quizás cambiemos algunas cosas ahora que afecte a la
  API, por ahora sólo iterar»—, así que esta unidad **no toca `odp-docker`** y no decide gobernanza.

- **2026-10-07 — WU-7 entregada** (sin commit: el autor pidió sólo iterar, y commitear no se hace sin que
  lo pida). **Dos archivos de producto y uno de hoja**:
  1. **`PublicationQueue.svelte`** — dos props **opt-in** (`secciones`, `expansion`) con los defaults de
     siempre. `expansion="primera"` abre **una sola** fila: la primera `pending` que quien mira **puede
     decidir** (nunca una propia), y las demás quedan **plegadas con su disparador** —`<button>` con
     `aria-expanded` y `aria-controls`, nombre accesible con el título del dataset—. Plegar **no** vacía la
     fila: dataset, organización y quién la pidió siguen a la vista. `secciones` agrupa en **Pendientes** y
     después **Resueltas**, cada grupo con su conteo, y **no titula un grupo vacío**.
  2. **`PublicationQueue.test.ts`** — **+6 tests** (RED observado: 6 fallas, 25 verdes; después GREEN).
  3. **`/dev/publication`** — control nuevo para **dónde vive el botón de publicar** (`?boton=hero|aside|ambos`)
     con la ficha del dataset duplicada en su estructura real (hero con sus acciones + grilla con `aside` y
     las cards de metadatos y organización), el **instrumento** del reparto del hero (`?boton=`), la **page
     propia** de la cola con las tres formas multi-organización (`?orgs=plana|agrupada|filtro`), los grupos y
     el plegado (`?secciones=`, `?expansion=`), la entrada en el **menú de usuario** con y sin contador, y el
     bloque de **referencia** en el panel —que ya **no** repite la cola: la cola entera vive en su page—.
  **Evidencia verificada**: suite **979/979 en 61 archivos** (973 antes de esta unidad), `pnpm check` **0
  errores** (4 avisos preexistentes en `ThemePlayground` y `tsconfig`), `pnpm build` OK, Biome limpio en los
  182 archivos. Y **en navegador real** (Chromium headless contra el stack de dev, que es el único lugar donde
  la cola existe: se carga en un `$effect`, así que el SSR sólo muestra el estado de carga): con
  `?colocacion=ruta` las **3 filas**, **1** con la vista de decidir y **2** con «Ver el detalle»; con
  `orgs=agrupada`, los dos grupos con sus títulos reales (Facultad de Tecnología con 1 fila, Facultad de
  Medicina con 2); con `orgs=filtro`, los chips; con `cola=resueltas`, el grupo **Resueltas** con sus
  desenlaces; y con `?boton=hero&vista=editor`, **cero** ocurrencias de «Publicar dataset» contra dos con
  `vista=sysadmin`.
  **Dos desviaciones declaradas.** (a) **Ruteo**: esta unidad se delegó a `gentle-ai-worker` y el escritor
  volvió **incompleto** —agregó los dos props al tipo del test y se detuvo, con el RED pendiente— después de
  ~10 minutos sin progreso; la recuperé **inline**, que es la ruta de recuperación de una unidad delegada
  fallida. (b) **Alcance**: el instrumento del hero **cita** la regla (`dataset/[id]/+page.svelte:302-305`) en
  vez de extraerla a un módulo compartido; la extracción queda para **B1**, porque hacerla ahora tocaría una
  página ya entregada y el autor pidió sólo iterar.
  **Dos preguntas que la unidad deja abiertas para B1**: (1) **el contador del menú** — `PUBLICATION-ACTIONS.md`
  confirma que `publication_request_list` devuelve «a list of rows», **no** un conteo, así que un contador
  global obliga a decidir entre pagar una llamada por página o agregar un conteo; (2) **la clave de
  agrupación** — la fila del componente trae `organization_title` y **no** `organization_id`, así que las
  formas agrupada y con filtro agrupan por **título**; si B1 quiere una clave estable, el tipo del ítem
  necesita el id y eso se confirma contra la fila real.
  **Nota de revisión**: el diff del componente es grande (**+320/−112**) porque la fila se movió a un
  `{#snippet}` para no duplicarla entre el grupo de pendientes y el de resueltas: es **movimiento**, no
  reescritura, y conviene leerlo con eso en mente.

- **2026-10-07 — La compuerta nativa de WU-7: aprobada, con dos avisos.** Preflight (`inspect`) → `start` con
  el consentimiento resuelto en el host → linaje **`review-987226edb496082e`**, **tier medium**, **una lente**
  (`review-reliability`), 4 archivos, **944 líneas** candidatas, presupuesto de corrección 200. Un primer
  `start` devolvió **`consent-binding-stale`** (`consent_binding` expirado por diez minutos sin respuesta,
  `lineage_created: false`, `mutation_performed: false`): **no había linaje ni autoridad cuando eso pasó**, y
  la continuación que el propio diagnóstico indicaba —relanzar `start` para obtener un sobre fresco— fue la
  que se siguió. La captura devolvió su previsión (**1 corrida**, transporte **relé del host Pi**) y su
  corrida **aprobó** el candidato. **Autoridad quemada** (`gentle-ai.review-acknowledged/v1`), y la entrega
  queda en la política ordinaria del repositorio: **no se commitea sin que el autor lo pida**.
  **Los dos avisos —los dos reales, y los dos arreglados después de la aprobación**, que el recibo declara
  como trabajo posterior y **no** como motivo para repetir la revisión:
  1. **`R3-duplicate-section-ids`** (`PublicationQueue.svelte:512`): los grupos de pendientes y resueltas
     llevaban `id` **estáticos**, así que **dos instancias del componente en una página los duplicaban** —
     que es exactamente lo que hace la forma **agrupada** de la hoja, con una cola por organización. Es la
     cara general del defecto que ya se había razonado para los `id` de las filas: un componente reusable no
     puede llevar identificadores fijos. Arreglado **quitando los `id`** y nombrando cada sección con
     `aria-label`: el nombre accesible se conserva y no queda ninguna referencia colgante.
  2. **`R3-unused-fixture-imports`** (`+page.svelte:84`): dos importaciones de fixtures que dejaron de usarse
     al derivar las organizaciones **de los datos cargados** en vez de una lista escrita a mano. Arreglado.
  **Declaración honesta, porque la autoridad ya está quemada**: después de esos dos arreglos el árbol **ya no
  es** el candidato aprobado (`sha256:59de51a5…`). No se repite la revisión sobre este candidato —el recibo
  lo prohíbe— así que los arreglos **viajan dentro de la próxima ronda**, la que salga de la revisión visual
  del autor. Verificación posterior: **31/31** en la prueba del componente, `pnpm check` **0 errores**, Biome
  limpio, y en el navegador la forma agrupada **sin** ningún `id="cola-*"`.

- **2026-10-07 — Disposición sobre el candidato posterior a la aprobación (no se arranca segunda ronda).**
  Después de los dos arreglos, la extensión de RDD avisó de un candidato nuevo
  (`sha256:a15f5f98…`). El `inspect` lo midió y la evidencia es concluyente: **`paths_digest`
  `sha256:bf135debb8…` — byte por byte el mismo** que el de la ronda aprobada, los mismos 4 `paths` y el
  mismo `base_tree`. O sea: **el alcance no cambió**; lo que cambió es el árbol, por los dos arreglos de los
  avisos y este registro. Como **nada está commiteado**, una ronda nueva no revisaría un **delta**: volvería a
  correr la lente sobre las mismas ~944 líneas.
  **No se arranca**, por el propio recibo de la ronda aprobada y por el estado del árbol:
  1. El recibo dice de los avisos que son «*separate later work*, nunca un motivo para repetir la revisión
     sobre este candidato». El delta **es** el arreglo de esos avisos: convertir eso en otra ronda es
     exactamente lo que el recibo prohíbe.
  2. El alcance es **el mismo** (arriba), así que no hay delta que revisar.
  3. **El árbol va a moverse otra vez**: la revisión visual del autor sobre la hoja está pendiente y él ya
     dijo que quizá cambie cosas. Congelar ahora un candidato que va a cambiar gasta una corrida de lente
     para nada.
  4. Los dos arreglos **no cambian comportamiento**: quitar dos importaciones sin uso, y cambiar dos `id`
     estáticos por un `aria-label` equivalente. Verificado: 31/31, `pnpm check` 0 errores, Biome limpio y el
     navegador mostrando las secciones nombradas sin ningún `id="cola-*"`.
  **No se creó linaje** (el `review-3fc7847f6db24b5d` que ofrecía el preflight queda sin arrancar) y **no se
  quemó autoridad**. Los arreglos **viajan en la próxima ronda**, la que salga de la revisión visual del
  autor. Si el autor pide revisar este objetivo exacto antes de su pasada visual, se arranca con esa palabra;
  y si pide commitear las unidades, la ronda siguiente pasa a revisar un **delta** en vez del diff entero,
  que es el arreglo estructural de este costo.

- **2026-10-07 — WU-7.1: el panel de la hoja queda liviano, y las opciones se van a su sección.** El autor
  lo dijo sin rodeos: «me perdí con tantas opciones», «ese panel tiene demasiadas opciones, no me gusta eso
  que esté muy cargado». Nueve grupos de interruptores en una barra fija es una hoja que se lee de arriba
  abajo buscando un botón, no una hoja que se mira. **Regla adoptada: cada interruptor vive en la sección
  donde aplica.** `vista` queda en la sección de la ficha (la de las compuertas del hero), `colocacion`,
  `cola`, `orgs`, `secciones` y `expansion` en la sección de la cola —que es donde la cola se renderiza, en
  cualquiera de sus colocaciones—, y `boton` en su propia sección. El **panel general conserva sólo lo
  global**: los presets de caso, la solicitud vigente (`caso`) y el resultado de las llamadas (`fallo`), que
  es de los **dobles** y no de una sección, más el reinicio y la nota de la URL. La lectura de estado del
  panel se recorta a esos dos, porque el resto se lee donde se usa.
  **El contrato de la hoja no cambia**: los parámetros de la URL siguen siendo los mismos
  (`?vista=&caso=&fallo=&cola=&colocacion=&boton=&orgs=&secciones=&expansion=&panel=`), porque lo que
  cambia es **dónde están los botones**, no lo que la hoja guarda. Un enlace ya escrito sigue funcionando.

- **2026-10-07 (noche) — La par corrigió, y era el defecto del día otra vez: mi handoff estaba viejo.**
  `unit/a2-governance` **arrancó, se entregó y se mergeó** (PR #1, `27c9c5b`) y encima aterrizó
  `unit/a2-advisories-v2` (PR #2, `f036e56`). Tres afirmaciones de este expediente quedan **falsas**, y se
  corrigen acá sin borrar lo que decían —el registro de lo que se verificó es parte de la historia—:
  1. **«`unit/a2-governance` sigue sin arrancar»** (WU-7.4, arriba) — **falso**: está entregada y en `master`.
     Lo mismo vale para cualquier variante de «la unidad que falta».
  2. **«`B1` no puede empezar hasta que A2 fije el nombre y el payload»** — **cumplido**, y el propio contrato
     lo dice: la tabla **se puede cablear** y la advertencia anterior ya no aplica.
  3. **«`A5` necesita la pared de A3 *y* la autorización de la puerta»** — **la autorización ya no falta**:
     `A5` depende **sólo de `A3`**, que está en curso (`unit/a3-wall`, 138 tests verdes).
  **El mecanismo, porque es el del día y ahora del otro lado:** leí un **handoff** —un snapshot— como si fuera
  el estado, y la par lo había actualizado en `6aa8501`. **No lo encontré releyendo lo mío: lo encontró el
  otro repositorio.** Es el corolario de la ley del día funcionando en reversa.
  **Tres cosas nuevas de cara al consumidor** (entraron en el PR #2 y **no** estaban en la tabla que leí):
  (a) `publication_publish` es `sysadmin`-only **y sólo sobre un dataset privado**: publicar uno ya público se
  **rechaza** (`403`, «That dataset is already public»), y **la capacidad se evalúa antes que el estado**, así
  que la negativa a un no-sysadmin **no revela la visibilidad**; (b) las filas llevan
  `requested_by_name`/`approved_by_name` batcheados por llamada, con **los dos vacíos distintos**: id sin
  asignar → `None`, id asignado que no resuelve → el token **`"unknown"`**, nunca el id; (c) `motive` lleva
  tokens estables (`dataset_deleted`, `published_by_another_path`) que el portal puede leer.
  **Lo que `B1` tiene que resolver ahora —dos cosas, no una—:** el **costo declarado del `403`**, porque la
  negativa de cuatro ojos sigue siendo un `403` y el consumidor tiene que **leer el mensaje** para
distinguirla de otras; y **la tabla del store en la base de dev**, que hoy no está: sin ella
  `publication_request_list` devuelve **`500`** ahí (medido por la par), así que el cableado real **no se puede
  verificar contra la API** hasta que corra la migración (**`A6`**) o alguien la aplique en el entorno
  compartido — decisión de **las dos sesiones**, porque el stack es el mismo.
  **Y una nota que le mandé a la par:** su `master` local está **3 commits detrás de `origin/master`** (medido
  con `git rev-list --left-right --count`); no rompe nada mientras nadie lea ese ref, pero es la misma clase de
  referencia vieja que este expediente acaba de corregir.

- **2026-10-07 (noche, segunda vuelta) — La par corrigió una medición nuestra, y venía de un checkout viejo.**
  `bulk_update_public` **no** escribe directo: en el CKAN que corre (2.12.0, contenedor vivo,
  `/srv/app/src/ckan` detached en `0058b2eb`) `_bulk_update_dataset` **recorre `package_patch`**
  (`ckan/logic/action/update.py:1212-1216`), así que **sí** llega a `package_update`. La frase vieja —«escribe
  `private: false` directamente y no pasa por `package_update`»— venía de un **checkout 2.12.0a0 de este
  disco** (`/home/danielblc/backup-windows/universidad/c4/ckan`), cuya versión sí hace un `UPDATE` directo.
  **Lo verifiqué yo en el contenedor antes de corregir nada.**
  **Corregido en cuatro artefactos**: `design.md` (la bala, la fila `P8` del baseline, el punto 3 del muro, y
  una **nota de procedencia** al inicio del baseline), `spec.md` (el requisito), `probe.sh` (el rótulo y un
  comentario), y `apply-progress.md` (una nota junto al transcript, que se conserva). **`tasks.md` ya decía lo
  correcto** —es el artefacto más nuevo— y ése es el hallazgo de forma: dos copias de la misma decisión, una
  al día y tres atrás. El `explore.md` **ya declaraba** haber leído ese checkout, así que la procedencia estaba
  escrita y la frase se propagó igual. La regla queda en el baseline: **no derivar comportamiento de CKAN de
  ese backup.**
  **Lo que cambia para `A5` no es el resultado —un editor recibe `403`— sino el motivo:** la negativa es
  **nuestra** (encadenada a la auth propia de `bulk_update_public`, antes de que corra el cuerpo), no de CKAN.
  Y la aserción actual **no puede distinguirlas**: pide `403` y el cuerpo del error contiene «Authorization
  Error» en los dos casos. Cuando `A5` reescriba esa fila tiene que afirmar **el mensaje del plugin**. Es la
  misma forma de la «prueba verde que no prueba lo que dice», y era justo lo que la sonda debía cazar.
  **Dos huecos del inventario que la par declaró fuera de su alcance** y que entran en nuestro mapa para `B1`:
  `package_create` **sin `owner_org`** —hoy inalcanzable sólo porque `create_unowned_dataset = false` está
  apagado en `ckan.ini`— y `package_delete`, que escribe `state='deleted'` a nivel modelo y es una **excepción
  intencional** (el spec pide que el borrado siga funcionando).

- **2026-10-07 (noche) — La tabla del store ya está en la base de dev, y el camino para lograrlo tenía un
  no-op silencioso.** La par autorizó aplicar la migración (con tres razones medidas, entre ellas que su
  verificación corre contra `ckan_test` y **nunca** contra la base de dev, así que no nos pisamos).
  **Resultado verificado:** `publication_request_list` anónimo responde **`200` con
  `{"success": true, "result": []}`** — antes devolvía **`500`** por falta de tabla. O sea: **`B1` ya se puede
  verificar contra la API**, no sólo construir contra el contrato.
  1. **`--skip-core` junto con `-p <plugin>` es un no-op silencioso en el CLI de CKAN**, y lo pagué yo: imprimió
     **`Upgrading DB: SUCCESS`** sin escribir **nada**. En `ckan/cli/db.py`, `if not skip_core:
     _run_migrations(plugin, version)` es la **única** llamada que recibe `plugin`, y el bucle de plugins sólo
     corre **si no hay `-p`**: con los dos flags **no queda nadie que trabaje**, y el `SUCCESS` es
     incondicional. El comando correcto para «sólo la extensión» es **`-p umss` sin `--skip-core`** —
     `_run_migrations` cambia la config de alembic al repo del plugin (`_repo_for_plugin`) y no toca el core.
     Con eso: `CKAN database version upgraded: base -> 0001 (head)`.
     **Le toca a `A6`:** un camino de despliegue que use los dos flags va a **reportar éxito sin hacer nada**, y
     el síntoma va a ser exactamente el `500` de antes. Se le pasó a la par.
  2. **La base efectiva no es la del ini.** El `ckan.ini` dice `…@localhost/ckan_default` y **esa base no
     existe**: gana `CKAN_SQLALCHEMY_URL` del compose → **`ckandb`**. Me costó una vuelta de verificación
     (la tabla «aparecía» sólo en `ckan_test`, que es la de los tests) — la misma forma de siempre: leer una
     referencia y creerle.
  **Y la lección de forma:** un `SUCCESS` **incondicional** es una referencia que no prueba nada. La
  verificación honesta fue **la tabla y la acción**, no el mensaje del comando.

- **2026-10-07 (noche) — `B1` arranca, y con qué suelo.** Con la autorización aterrizada y la tabla en la base,
  `B1` deja de estar bloqueado. **Decisión del autor** (llegó por la par): el rechazo de cuatro ojos se
  distingue por **literal pinneado por test y declarado como interfaz**, no con un token nuevo — el costo ya se
  pagó con los tokens del `motive` y **la protección real es la gobernanza**, no el mecanismo. **Los cinco
  literales que son interfaz**: cuatro ojos; capacidad del solicitante (la fila queda `pending`); `publish`
  sobre un dataset **ya público**; y los dos del muro (el que nombra el flujo de publicación y el genérico).
  **El límite de forma, dicho por la par y no descubierto:** un fallo de autorización de CKAN llega siempre como
  `{"__type": "Authorization Error", "message": …}` — **no hay campo libre para un código**. El **único** caso
  que ya es distinguible por máquina es el rechazo **sin comentario**: es un `ValidationError` con la clave
  `comments`, no un `403`. Y eso el portal lo puede leer **sin plomería nueva**, porque su tipo de error ya
  lleva `ckanType` y `payload` (los usa para el conflicto de `package_revise`). **Consecuencia de diseño:**
  si ese `ValidationError` llega, hay que presentarlo como «falta el motivo» y **no** como «no se pudo registrar
  la decisión»: el portal ya valida el motivo antes de mandar, así que el del servidor es respaldo — y un
  respaldo mal presentado es una mentira.
  **Orden de la unidad**, y por qué arranca por ahí: la capa de API del portal **no tiene ninguna de las cinco
  acciones** (los componentes lo dicen en sus propios comentarios: entran inyectadas). Sin ella no hay cableado
  posible, y es lo único de `B1` que se puede probar **sin UI** contra el contrato. Después: los componentes
  importan el **tipo de fila** de la capa de API (hoy lo definen ellos, que es la dirección equivocada), la
  ficha del dataset con el botón en el hero y la tarjeta del estado, y la page de solicitudes.

- **2026-10-07 (noche) — La ley del día, en su forma más filosa: declarar la procedencia no es verificarla.**
  La par la formuló a partir de la deriva del `bulk_update_public`, y es **mejor que mi descripción del
  error**: el `explore.md` de ese cambio **ya declaraba** haber leído el checkout viejo de CKAN, y la frase
  falsa **viajó igual** a tres artefactos. La declaración era honesta y **no era un chequeo**. La ley del día
  decía «lo que se verifica es el significado, no la forma en que uno lo escribió»; esto la **aterriza**: hay
  un paso que **parece** verificación —anotar de dónde salió el dato— y no lo es. Lo que verifica es
  **contrastarlo contra la fuente** antes de repetirlo.
  **Y una consecuencia de método para el trabajo entre las dos sesiones**, que la par también aportó: el puente
  entrega **cuando puede, no en orden** —dos de sus mensajes se cruzaron con los míos, uno de ellos
  autorizándome a hacer algo que ya había hecho y reportado—. Lo útil cuando un mensaje contesta algo ya
  mandado no es repetirlo: es **decir el estado**.
  **De nuestro lado, el par del muro, visto desde el otro extremo:** su test de la cadena de
  `bulk_update_public` se apoya en que la auth del core contesta `{'success': False}` **sin mensaje**; si el
  core empezara a mandar texto, esa aserción se cae. Es la misma fragilidad que la nuestra, del otro lado del
  borde, y la está revisando dentro de la verificación de `A3`.

- **2026-10-07 (noche) — El disparador del token, afinado por la par, y con el filo correcto.** Mi condición
  era «si aparece un **segundo** rechazo que el consumidor tenga que distinguir». La par la corrigió midiendo
  **qué se cuenta**: como **mensajes** ya hay cinco (cuatro ojos, capacidad del solicitante, ya-público y los
  dos del muro), así que la regla se habría disparado **hoy** por mensajes que **no ramifican**; como **ramas
  del consumidor** —los lugares donde el portal tiene que *cambiar de comportamiento* según cuál rechazo es—
  hay **una sola**: cuatro ojos. Y su segundo argumento cierra el asunto: con «segundo mensaje» alguien podría
  discutirlo después («éste es el tercero, no el segundo»); con **rama** no hay ambigüedad — o el consumidor
  bifurca, o no.
  **La regla queda escrita así, y rige este lado:** *el disparador es la **segunda rama del consumidor**, y el
  día que el portal tenga que bifurcar por un rechazo distinto de cuatro ojos, el token se diseña **antes de
  cablear**, aunque la prosa siga funcionando.*
  **Y una fila nueva para `A5`, de un agujero real que encontró la verificación de `A3`:** su guard no era el
  espejo fiel de `boolean_validator` que su propio docstring afirmaba — **`private: 0` publicaba**. De este lado
  **medí ejecutando** la función en el contenedor vivo (ya no leyéndola) y el dato viejo que le pasé era
  **falso**: `boolean_validator` **no lanza con nada**. `0`, `0.0`, `[]`, `{}`, `'banana'`, `''`, `'false'` y
  `None` dan **`False`** — o sea **intento de publicación** — y `1` y `'true'` dan `True`. El cuerpo del
  2.12.0 protege con `isinstance(value, (bool, int))` y `isinstance(value, str)` antes de `.lower()`.
  **La procedencia del dato falso, y es la misma copia de siempre:** el checkout **`2.12.0a0`** de este disco
  llama a `value.lower()` **sin condición** después de `isinstance(value, bool)`, así que **sí lanza** con un
  `int`. De ahí salió mi «sólo lanza para valores sin `.lower()`». **Un solo checkout viejo produjo los DOS
  datos falsos de este cambio**: el de `bulk_update_public` (ayer) y el de `boolean_validator` (hoy). Y es la
  ley del día en su forma más concreta: la procedencia estaba declarada en `explore.md` y los dos datos
  viajaron igual.
  **Lo que esto le suma a `A5`:** los valores límite de `private` tienen que estar **medidos**, y el
  resultado esperado **no** es una excepción del validador sino **intento y negativa del muro**. Con un
extra contraintuitivo que la par marcó: **`'false'` también es intento**, porque `'false'` no está en la lista
  de verdaderos y entonces se guarda como **público**.
  **Y una consecuencia para el arreglo de la par, declarada como procedencia y no como diagnóstico:** su
  `_as_bool` era «espejo fiel de `boolean_validator`», y el espejo se escribió contra la versión que **ya no
  corre** — la que lanza. Por eso era verde y publicaba: el espejo era fiel a 2.12.0a0 y la realidad es
  2.12.0. Es exactamente el modo de falla que la ley del día nombra, y por eso la corrección se hizo
  **ejecutando** los doce casos en vez de citarlos.

- **2026-10-07 (noche) — Un hueco de contrato, medido **antes** de cablear la page.** Al preparar la page de
  solicitudes medí la forma real de la fila en `origin/master`
  (`logic/action/publication.py:119-131`) en vez de confiar en la tabla resumida del contrato: `_row_dict`
  devuelve las **columnas de la tabla** más los dos nombres, y esas columnas son `id`, `dataset_id`,
  `requested_visibility`, `status`, `requested_by`, `approved_by`, `comments`, `motive`, `created_at`,
  `decided_at`, `consumed_at`. **No hay `dataset_title` ni `organization_title`**, y la fila de la cola **se lee
  por el título del dataset** —es su línea principal— y por la organización, que es lo que dice de dónde viene
  cada solicitud cuando quien mira administra varias.
  **La asimetría que lo vuelve un pedido y no una queja:** el contrato ya resuelve los **nombres** de las
  personas en una consulta batcheada por llamada, con el argumento correcto («que la cola no resuelva N por
  página»). El título del dataset es el mismo problema un campo más abajo, del lado que ya tiene el
  `dataset_id` en la mano: un `_titles_for(dataset_ids)` análogo.
  **Y el momento importa:** el contrato dice que **la forma no cambia una vez que un consumidor está
  cableado**. No lo estaba, así que **se pidió ahora**, con las tres alternativas que evalué y descarté:
  N `package_show` (justo lo que la regla 3 existe para evitar), un `package_search` con los ids (otra
  semántica de permisos metida en el camino de la cola) y mostrar el `dataset_id` (el identificador no es para
  el usuario).
  **Lo que sí se hizo en el acto, sin esperar a nadie:** el **tipo** del portal se completó con las columnas
  que **sí** existen (`requested_visibility`, `decided_at`, `consumed_at`) y su comentario declara el hueco y el
  pedido. **La page no se cablea contra campos que no existen**: una lista con la línea principal vacía **se ve
  terminada y no lo está**.
  *(Y un dato del mismo paso que sirve para la bajada: `requested_visibility` **sí** está en la tabla aunque
  `RF-41`/`RF-42` estén en `[v1]`, así que el día que se construya la degradación el portal puede mostrar la
  dirección pedida sin inventar nada.)*

- **2026-10-07 (noche) — Un literal de interfaz cambia **antes** de que lo hardcodee, y eso es el sistema
  funcionando como se diseñó.** La compuerta de `A3` dejó un aviso (`R2-approver-message-names-wrong-action`): el
  mensaje del muro decía «…not **`package_patch`**», y el muro también niega por `package_create` (público),
  por `package_update` completo y por `bulk_update_public` — a **tres de los cuatro** caminos les decía que no
  usaran una acción que **no usaron**.
  **Valor nuevo, exacto** (`PUBLISH_VIA_FLOW_MSG`):
  `Publication goes through the publication flow, not a direct dataset write`.
  **Lo que respondí como consumidor:** del lado del portal ese literal es un **discriminador, no un mensaje**
  —la oración que el usuario lee la escribe el portal en español—, así que sólo necesita ser **único y
  estable** entre los cinco, y lo es. No pedí más precisión.
  **Y el cambio mejora una propiedad que el aviso no nombra:** el literal viejo **nombraba una acción**, y un
  literal que nombra una acción le enseña al consumidor que el rechazo **describe el intento**. El nuevo
  describe **la regla**, que es lo correcto para un rechazo que cubre cuatro caminos distintos.
  **Regla operativa que deja, y es del día:** **no hardcodear un literal declarado como interfaz hasta que
  aterrice la unidad que lo cambia**; y el momento de pedir precisión es **antes** de la compuerta, no después.
  **Estado de la par:** `A3` está en **PR #3** de `odp-docker`, CI verde y compuerta aprobada
  (`review-5180621e3e08ad50`, tier high, **4/4 lentes**, autoridad quemada), con el **inventario de escritores
  nativos** (18 acciones, transcript literal con su veredicto de cobertura) en el cuerpo del PR — es donde
  quedó resuelto `P8` y donde están nombrados los huecos (`package_create` sin `owner_org`, `package_delete`
  como excepción intencional). **Cuando mergee, `A5` corre contra ese muro**, y el inventario pasa a ser el
  **mapa de sus filas**: en vez de inventar cobertura, medir cada acción que ellos ya identificaron, más los
  límites de `private` y la fila de `'false'`. **Y ese PR cierra además el agujero del espejo de
  `boolean_validator` que estaba vivo en `master`** —`private: 0` publicaba, para un **editor**—, lo que
  convierte a `private: 0` de observación interesante en **regresión a pin**ear desde el lado del consumidor.

- **2026-10-07 (noche) — `A3` aterrizó, `A5` se desbloqueó, y la sonda ya está medida contra el muro nuevo.**
  Verificado en `origin/master` de `odp-docker`: **`6472e48 Merge pull request #3`** — la pared está puesta. Y el
  literal viejo sigue vivo donde estaba (`auth.py:109` y la tabla del contrato), así que la unidad del literal
  nuevo está pendiente, como la par avisó.
  **La sonda corrió dos veces contra el stack y el resultado es el mapa de `A5`:** **22/25**, y las tres fallas
  son **exactamente** las expectativas que `A3` invalidó — o sea, la sonda está haciendo su trabajo:
  | fila | esperaba | mide | cuerpo |
  |---|---|---|---|
  | `P6` | `200` | **`403`** | «Publication goes through the publication flow, not package_patch» |
  | `P6.stored` | `false` | **`true`** — el dataset **no** se publicó, que es la parte que importa |
  | `P10` | `200` | **`403`** | el mismo, para el admin de la organización **padre** |
  **Y una confirmación de mi `P8` en vivo:** la sonda ahora imprime el cuerpo, así que se ve **de quién** es la
  negativa — `bulk_update_public` recibe el mensaje **genérico** del muro («Only an organization administrator
  can publish a dataset»), no el del flujo. Antes eso no se podía distinguir; era exactamente lo que el `P8`
  afirmaba sin poder probar.
  **Alcance de `A5`, derivado de esto y no de la imaginación:** (1) dar vuelta `P6`/`P6.stored`/`P10` a `403`
  con el mensaje del muro; (2) `P8` pasa a afirmar **el mensaje**, no sólo el código; (3) los **valores límite
  de `private`** (`0`, `0.0`, `[]`, `{}`, `'banana'`, `''`, `'false'`, `null`, omitida) contra el muro, con
  `'false'` como fila propia por contraintuitiva; (4) las **18 acciones del inventario** del PR #3 como mapa
  de filas, separando **lo que el muro cierra** de **lo que no**; (5) la gobernanza de las **cinco acciones**
  (`publish` sólo `sysadmin` y sólo sobre privado, cuatro ojos **con su mensaje**, rechazo sin motivo como
  `ValidationError` con la clave `comments`, anulación, `NotFound` y no `403`, y la lista anónima en `200` con
  `[]`).
  **Una dependencia dura, declarada:** las filas que afirman el literal del **flujo** no se escriben contra el
  texto viejo. Se escriben cuando la par mande el commit del literal nuevo — regla que quedó de esta misma
  noche: **no pinear un literal que está por cambiar**.
  **Lo que la par me ahorró, y lo anoté como método:** la distinción «lo que el muro cierra vs lo que no» está
  **línea por línea en el transcript del inventario**, así que las filas se mapean contra ese transcript sin
  volver a medir la fuente de CKAN. Y su advertencia sobre `private: 0` cambia qué mide la fila: el muro ahora
  lo **rechaza**, así que la fila mide **la negativa**, y el síntoma a detectar si alguien afloja el muro es
  **`200` con el dataset público** — peor que una excepción, porque **no se ve**.

- **2026-10-07 (noche) — La precedencia del rechazo de decidir, medida por la par, y la decisión de interfaz que abre.**
  Medición suya, **verificada de este lado en la fuente y en la base**: el orden de `publication_request_decide` es
  **capacidad primero, cuatro ojos después** — `_requester_holds_capacity(row)` →
  `DECIDE_REQUESTER_CAPACITY_MSG`; rama de sysadmin con `is_requester` → `DECIDE_FOUR_EYES_MSG`; y para el resto,
  `_allowed(..., ADMIN_PERMISSION)` → `DECIDE_DENIED_MSG` **y recién después** `is_requester` → cuatro ojos.
  Consecuencia: **un editor que es solicitante nunca ve el literal de cuatro ojos** — el rechazo que le toca es el
  de capacidad—, y el token de cuatro ojos lo ve **sólo un solicitante con capacidad de admin**. El caso vivo
  quedó en la base (`pending` de `admin2`), y lo confirmé consultando la tabla.
  **Y la consecuencia que abre una decisión: el consumidor enfrenta TRES rechazos en el camino de decidir, no
  uno**, y cada uno es un hecho distinto —«usted no es aprobador» / «el solicitante perdió permiso» / «no puede
  aprobar su propia solicitud»—. Tres `403` que **sólo el literal separa**; sin separarlos, el portal **miente en
  dos de los tres casos**.
  **Por eso apliqué la regla de la segunda rama en vez de esquivarla: el disparador es la segunda rama del
  consumidor, y acá hay tres.** Se llevó a la par con las tres opciones y su costo: (1) forma nueva de su lado
  —preguntando si existe un `__type` propio barato, porque el portal **ya lee `ckanType`** y el costo del
  consumidor sería **cero**—; (2) quedarse con los literales, aceptando tres comparaciones de prosa; (3)
  **colapsar dos en un mensaje honesto** («esta solicitud no se puede decidir desde su cuenta»), que pierde
  precisión y no verdad. **Recomendación: 1 si existe barato; si no, 3.** Y **retiré mi recomendación de anoche
  para este caso**: defendía el literal contando **una** rama donde hay **tres**.
  **Nada está bloqueado por esto**: la page de solicitudes no se cablea hasta que aterricen los dos títulos, así
  que la decisión de forma tiene lugar y es del autor. **Por eso `A5` suma los valores límite de `private`
  (`0`, `"false"`, `"banana"`, `""`, `null`, omitida) como filas a medir, no a suponer**: ahí es donde un
  espejo y su original se separan en silencio.

- **2026-10-07 — WU-7.2: las decisiones del autor sobre los diseños, y lo que no le gustó.**
  **Decisiones cerradas:** (1) **las opciones en su sección se adoptan como diseño de la hoja en adelante**
  («me gusta más este tipo de opciones… prefiero que sea de este diseño de aquí en adelante»); ya está como
  convención en `AGENTS.md` regla 8. (2) La cola cuando quien mira administra varias organizaciones se
  resuelve **con filtro por organización**, y el filtro **no se muestra cuando sólo hay una**: un filtro que
  no filtra es ruido. (3) La cola se lee **pendientes y después resueltas** — **el diseño de las resueltas se
  mejora después**, anotado como pendiente. (4) **Sólo el primero** desplegado.
  **Correcciones de diseño:** (5) **El aviso en la ficha no lleva el formulario de aprobar.** El autor
  preguntó si ese lugar era `/dataset/[id]` — **sí, es esa página** (la ficha del dataset) — y pidió que ahí
  se vea **el estado** de la solicitud: pendiente o resuelta, sin los controles de decidir. El formulario de
  aprobar o rechazar es una opción de **su propia page**, «donde la decisión es el trabajo principal y no un
  accesorio de otra página». (6) **El control de publicar en el panel no va dentro de una card**: «se ve
  redundante». Va **como botón**, con el dibujo del botón de los formularios de crear y editar dataset. (7)
  **En el hero el control no combina** con las otras acciones: «tendríamos que copiar el mismo diseño, algo
  así como el tamaño y demás». Eso es una **presentación de acción** del componente —mismo alto y misma forma
  que «Copiar enlace» y «Editar»—, o sea un cambio de componente, y va con **B1**; la hoja muestra el estado
  real de hoy y lo declara. (8) **La sección del panel no lo convence** («no termina de gustarme este
  diseño») y queda **abierta**; la **ruta propia** y el **contador** le parecen bien. Y **hero contra panel
  sigue sin decidirse**: primero quiere ver el hero con el mismo dibujo que el resto.
  **Nada de esto toca `odp-docker`**: sigue siendo iteración de la hoja.

- **2026-10-07 — WU-7.3: las tres decisiones de la segunda revisión, y la primera que toca los componentes.**
  (1) **La sección del panel se quita como bloque y entra como acción**: el panel no hospeda la cola ni una
  card que la referencie; lleva una **acción**, como el CTA de crear datasets. (2) **El aviso de
  `/dataset/[id]` pasa a ser una card** después de la información textual del dataset, y sigue sin el
  formulario de aprobar. (3) **El botón se queda en el hero**, con el diseño de sus hermanos: sin el texto de
  ayuda debajo y con la explicación **como tooltip**.
  **La (3) es la primera decisión de esta iteración que obliga a tocar los componentes de producto**
  (`PublishControl`, `RequestPublicationControl`): se les agrega una prop **opt-in** `apariencia`
  (`"bloque"` por defecto = hoy, `"accion"` = la forma del hero). En `"accion"` el control dibuja **sólo el
  botón**, con la clase de las acciones del hero —`h-9`, `border-input`, `bg-background`, `px-3`, `text-sm`,
  las mismas que usan «Copiar enlace» y «Editar» en `src/routes/dataset/[id]/+page.svelte:436-451`—, y la
  frase que hoy va debajo del botón pasa al **`title`**: es el mecanismo que ya usa el hermano «Copiar
  enlace», así que no se estrena nada. Los **estados** (pendiente, anulada, rechazada) **no cambian**: son
  información, no la acción, y el hero es para la acción.
  **Dos deudas declaradas de este cambio.** (a) La clase de acción de los botones del hero queda **duplicada**
  dentro de cada control: es el mismo riesgo de deriva que ya se anotó para la regla del conteo de acciones, y
  se resuelve igual —extrayéndola a un módulo compartido— **con `B1`**, que es cuando la ficha real cablea los
  controles. (b) El `title` nativo **no se alcanza con el teclado**, sólo con el puntero; es lo que ya hace el
  hermano «Copiar enlace», así que no es una regresión, pero el `Tooltip` vendorizado (bits-ui) sí alcanza el
  foco. Queda como pendiente en el `BACKLOG` para los **tres** botones del hero, no sólo para el nuevo.

- **2026-10-07 — WU-7.4: las nueve preguntas, contestadas, y el nombre del disparador arreglado.**
  **(1) Las dos affordances: cerrado.** El control directo se dibuja **sólo** para quien la acción acepta
  (`sysadmin`); el `admin` de organización ve en ese lugar **«Solicitar publicación»** y su camino es la cola.
  Es lo que la hoja ya renderiza, y es coherente con la enmienda que él mismo hizo el mismo día.
  **(2) Los mensajes de error: corregidos en regla, no en detalle.** Decisión del autor: los mensajes **pueden
  llevar la parte técnica** —el código, para poder consultar con soporte, «como servicio al cliente cuando pide
  algún código de error»—, **pero el foco no puede ser la parte técnica**: siempre una frase entendible por
  cualquiera, con el código como dato secundario («El dataset no existe, error 404»). Cambia el patrón de los
  fallos: `failure.ts` tiene que exponer el **código** junto al texto humano y las superficies que los muestran
  —las páginas de error y las alertas de los controles— lo renderizan como dato secundario. **Es la próxima
  unidad**, y de paso cierra el defecto latente de que un `404` se leyera como «no se pudo».
  **(3) `RF-41`/`RF-42`, los dos detalles: cerrados.** La solicitud pendiente **se anula** cuando un `admin`
  degrada directo, y la degradación **exige motivo**. (El contrato de las acciones ya implementaba la
  anulación por publicación directa: `annulled`, regla 6 de `PUBLICATION-ACTIONS.md`.)
  **(4) «Sólo subir» contra el PRD: reconciliado como `[v1]`.** El autor aclaró que el «sólo subir» era la
  decisión del **corte de `v0`** —«hacemos esto que es más fácil y dejamos lo demás para `v1`»— y preguntó si
  conviene hacerlo completo ahora. **Recomendación registrada: no adelantarlo.** La bajada no es lo que el
  criterio de salida de `v0` pide, y agregarle **dirección** al store y a las acciones de la cola es trabajo en
  el **otro repo**, donde la unidad que falta (`unit/a2-governance`) sigue sin arrancar: adelantar la bajada
  hoy no acelera `v0`, lo posterga. *(**Corregido el mismo día, más abajo: esa unidad ya está entregada y
  mergeada.** El argumento del corte de `v0` sigue en pie, pero su segunda mitad —«la unidad que falta»— ya no.)* Lo que sí se cierra ahora es **la contradicción del documento**, que era el
  pendiente real: el PRD conserva las dos direcciones, marcadas `[v1]`, con el motivo escrito.
  **(5) «Detalles» contra «Información técnica»: marco adoptado.** Fórmula del autor: **detalles = resumen,
  información técnica = completo**, y el que manda es el de la izquierda. Con una precisión mía, declarada:
  el resumen **no** debe ser una versión más corta de la misma lista —eso es redundancia—, sino otra
  **pregunta**: el `aside` responde «¿me sirve esto?» (quién lo mantiene, cada cuánto se actualiza, cuándo fue
  la última vez, con qué licencia) y la izquierda responde «¿qué es exactamente?» (identificadores, formato,
  origen, tamaño y todo lo que hoy se pierde). Hoy el `aside` compite por el mismo contenido y por eso se ven
  mal los dos. Queda como TODO, con su prioridad (abajo).
  **(6) El nombre del disparador del plegado: arreglado.** Era el aviso `R3-trigger-name-collision`, el único
  que quedaba abierto. Ahora el disparador se llama **«Detalles de {dataset}»** —estable— y el estado lo lleva
  `aria-expanded` con el chevron: un control, un nombre, dos estados. Las pruebas ya no buscan dos nombres
  distintos para el mismo botón.
  **(7) El tooltip de las acciones del hero: propuesta registrada**, para que la decida: el `Tooltip`
  vendorizado alcanza el foco del teclado y el `title` no; la propuesta es usarlo **sólo donde la etiqueta no
  alcanza** —el botón de copiar enlace, que es un ícono, y la consecuencia de publicar— y **no** en «Editar»,
  que ya dice lo que hace. Va con el cableado de `B1`.
  **(8) Prioridad invertida: primero promover.** El autor decidió que el diseño del grupo **Resueltas** se
  mejora **después de promover** la hoja, porque promover tiene más prioridad. Con un dato que le dije: la
  promoción (`B1`) está **bloqueada del lado del otro repo**, así que la prioridad queda fijada y el trabajo
  de esa prioridad no puede empezar todavía.
  **(9) Entrega autorizada:** commit, push, PR y merge. El trabajo se cierra **en unidades de trabajo** sobre
  una rama, no en un commit único: es lo que hace que la próxima revisión sea un **delta** en vez del diff
  entero — 1423 líneas cada vez, medido.

- **2026-10-07 (noche) — La respuesta a mi pregunta sobre la forma, medida, y una tercera opción mejor que las mías.**
  Pregunté si existía un `__type` propio barato. La par **fue a medirlo** en vez de contestar de memoria:
  **no existe.** El mapeo de errores de la API es una **tabla fija de `except`** (`ckan/views/api.py:298`):
  `except NotAuthorized` → `{"__type": "Authorization Error", …}` con `403`, **no derivado del nombre de la
  clase**, así que un subtipo cae en la misma rama. El único camino con payload propio es `ValidationError`, y
  devuelve **`409`** — usarlo rompería el spec, que pide que el rechazo sea **falla de autorización**. Un
  `__type` propio exigiría editar el **core**: no es la extensión, no es de ellos, no es barato.
  **Y encontraron la tercera forma, que es la que hacía falta: congelar la ETIQUETA y liberar la prosa.** Cada
  negativa empieza con un **rótulo estable** que el consumidor matchea y después va la oración humana, que puede
  cambiar **sin romper nada**: `Four eyes:` · `Requester capacity:` · `Not an approver:` · `Already public:` ·
  `Publication flow:` · `Publish denied:`.
  **Por qué es mejor que mis tres opciones:** el `403` sigue siendo una falla de autorización (spec y contrato se
  sostienen), el consumidor distingue por un **prefijo corto y congelado** en vez de por prosa completa, y
  **mejorar la redacción deja de romper nada**. Mi opción 2 (tres comparaciones de prosa) queda muerta por su
  argumento, y la 3 también: **no hace falta perder precisión**. El costo es cosmético y acotado —el rótulo se ve
  en los contextos que muestran su texto crudo (la UI de CKAN, un `curl`), **no en el portal**, que escribe su
  propio copy—.
  **Las dos consecuencias del lado del consumidor que declaré:** (1) **el portal descarta la etiqueta**: la
  matchea y **no** la renderiza, porque el copy visible es suyo y en español, así que el rótulo no tiene que ser
  *legible* — sólo **único como prefijo**—; y (2) **la unicidad del prefijo es toda la condición**, así que lo que
  va pinneado por test son **seis prefijos y no seis oraciones**, y su test se vuelve **más barato de mantener**.
  **Y mejora una unidad mía, que es el efecto colateral bueno:** las filas de `A5` iban a afirmar la **oración
  entera** de cada negativa; con etiquetas afirman **la etiqueta**. Eso elimina el falso positivo que quise
  evitar —una mejora de redacción poniendo la sonda en rojo— sin perder lo único que importa: que la sonda
  distinga **de quién** es la negativa, que era todo el punto de `P8`.
  **Estado: decide el autor.** Si dice sí, los seis rótulos llegan junto con los dos títulos; si dice no, se
  aplica la opción 2 y se declara. Y la cuenta de las dos correcciones de hoy, que la par nombró: fueron **la
  misma cosa en direcciones opuestas** —su medición corrigió un dato mío contra una versión que no corre; la mía
  corrigió un conteo de casos—, y en las dos lo que faltaba era lo mismo: **contar o medir antes de fijar la
  conclusión**, y ninguna se vio releyendo lo propio.

- **2026-10-07 (noche) — `A5`, segundo bloque: los valores límite de `private`, medidos contra el muro.**
  Siete filas nuevas y **todas verdes**, sonda **33/33**. `0`, `0.0`, `[]`, `{}`, `null` y **`'false'`** dan
  **`403`** del muro —o sea **intento de publicación negado**, no excepción del validador—; un parche que **no**
  toca `private` ni `state` da **`200`**, porque el muro no se pasa de listo y un muro que refusa todo rompe el
  portal; y la comprobación que cierra el bloque: después de negar **todos** los valores límite, el dataset
  **sigue privado** — una negativa que publicara igual pasaría las filas de arriba y sería el peor resultado
  posible.
  **Y esto es la falsificación en vivo de mi dato viejo, medida y no argumentada:** `private: 0` —**el valor
  que publicaba** para un editor antes del PR #3— ahora es una negativa; y **ninguna** fila lanzó excepción,
  que es exactamente lo contrario de lo que afirmaba mi medición contra el checkout `2.12.0a0`. La fila de
  `'false'` quedó como propia, por ser la contraintuitiva: no está en la lista de verdaderos, así que se guarda
  como **público**.

- **2026-10-08 (madrugada) — Decisión del autor: no hay publicación directa en el portal. Y la ruta del portal era la única en español.**

  **(1) Sin publicación directa, para nadie.** Un `admin` de organización ve **sólo el botón de solicitar**; el botón de
  publicar **no lo ve nadie, incluido el `sysadmin`**; y el único camino es **solicitud → decisión en la cola**. Palabras
  suyas: «no importa que el camino sea largo (request-resolver), así es el flujo. SIN publicar directo». **Reemplaza** la
  decisión del 2026-10-07 («la publicación directa pasa a ser sólo del `sysadmin`», anotada arriba), y con ella cae el par
  de affordances con dos gates del `D7` del diseño: el portal queda con **una** affordance y **una** compuerta.

  **Consecuencia de borde, declarada y NO resuelta acá:** el contrato tracked de `odp-docker` describe
  `publication_publish` como «el camino directo **registrado** del `sysadmin`: crea la fila y la aprueba/consume en el acto»,
  así que **la decisión queda cumplida en el portal y no en la API**: un `curl` con token de `sysadmin` sigue publicando
  sin solicitud. Se le pasó a la sesión par como pregunta abierta (**su** repo, **su** compuerta) y queda anotado como
  riesgo vivo, con la lectura propuesta: si «sin publicar directo» es una regla del **flujo**, la acción debe dejar de
  conceder y el `sysadmin` resolver con `publication_request_decide {approve: true}`.

  **(2) La ruta del portal estaba en español, y era la única.** `/dashboard/solicitudes` pasa a `/dashboard/requests`.
  Era el **único** directorio de ruta no inglés de `src/routes/` (medido), en un repo cuya convención es que los
  identificadores y los artefactos técnicos van en inglés: el **copy visible** sigue en español, la **ruta** no. Defecto
  mío, introducido con la page en `B1`.

  **El mecanismo del error, que es lo que más importa de esta entrada.** Al autor se le preguntó «¿un `admin` ve las dos
  affordances o sólo la cola?» **cuatro veces**. La causa no fue falta de respuesta: fue que **la respuesta no reemplazaba
  la pregunta** —quedaba anotada en el registro de la sesión, mientras el ítem seguía **abierto** en la lista de pendientes
  del `BACKLOG.md`, que es donde se lee—. Regla que se adopta: **cuando el autor responde una decisión abierta, se cierra
  el ítem abierto en el mismo movimiento**; anotar la respuesta no alcanza si la pregunta sigue listada. Un registro que
  sólo agrega obliga a cada sesión siguiente a volver a preguntar lo mismo.

  **La duda que esta unidad traía, medida y cerrada en el mismo paso** (la pregunta heredada era: al caer la rama del
  `sysadmin`, el botón de solicitar queda detrás de `puedeEditarDataset`, que sale de
  `organization_list_for_user {permission: "update_dataset"}` — ¿incluye esa pregunta a un `sysadmin`?). **Sí, y por una
  rama explícita.** Medido en el CKAN **2.12.0 que corre** (`/srv/app/src/ckan/ckan/logic/action/get.py:678-683`), no en un
  checkout viejo:
  `sysadmin = authz.is_sysadmin(user)` y `if sysadmin: orgs_and_capacities = [(org, 'admin') for org in orgs_q.all()]` —
  el filtro por permiso **no se evalúa** para un `sysadmin`: recibe **todas** las organizaciones activas. Por lo tanto
  `listUpdatableOrganizationIds()` lo incluye, `puedeEditarDataset` da `true` y el `sysadmin` **recibe el botón de
  solicitar** en cualquier dataset privado, que es exactamente lo que el autor decidió. Queda anotado que la medición es
  **lectura del artefacto vivo** y no una ejecución contra la API: lo que la cierra del todo es verlo en el navegador con
  sesión de `sysadmin` (paso de verificación de la unidad).

- **2026-10-08 (tarde) — El autor decide que la regla vale también en la API. Y aparece el agujero que retirar la acción NO cierra.**

  **La confirmación, con evidencia, de la sesión par:** `publication_publish` es una **puerta viva** de la API. Su auth
  (`logic/auth/publication.py`) lleva `auth_sysadmins_check`, así que **corre hasta para el `sysadmin`** y le devuelve
  `success` sobre un dataset privado; la acción anula cualquier `pending` del dataset, crea la fila ya `approved` **y**
  `consumed`, y voltea el valor. El muro no la intercepta porque **ninguna** de sus tres funciones lleva ese flag: CKAN
  cortocircuita al `sysadmin` antes de que corran. Conclusión de la sesión par, textual: **la decisión del 2026-10-07
  quedaba cumplida en la UI y no en la API.**

  **La decisión del autor:** *«La regla vale también en la API: se retira el camino directo»*. `publication_publish` deja
  de conceder **para todos, incluido el `sysadmin`**, y el `sysadmin` resuelve con `publication_request_decide {approve:
  true}` **como cualquiera**. **Reemplaza** la decisión del 2026-10-07 («`publish` sólo `sysadmin`»). La unidad de
  implementación es de la sesión par (su repo, su compuerta) y **todavía no arrancó**.

  **Lo que se enmendó acá:** el requisito `Approver Capacity` (no hay camino directo para nadie; el `sysadmin` decide como
  cualquiera), los escenarios (el del camino directo del `sysadmin` se invierte a `403`, y se agrega el que describe su
  camino real), la fila de la tabla de acciones, `Publication Request Actions` (misma frase, más el `Return shape` sin esa
  acción) y la referencia del `Measured baseline`. **Y se declaran, en vez de dejarlas implícitas, las dos consecuencias**
  que la sesión par midió en el código: (i) un `sysadmin` **que es el solicitante** no puede decidir su propia solicitud
  (cuatro ojos, sin excepción) y (ii) un solicitante **que perdió capacidad** deja una solicitud que **nadie** puede
  aprobar. En los dos casos la salida sancionada es **cancelar y volver a solicitar**, y una instalación cuyo único
  aprobador es el solicitante **no publica ese dataset**: limitación **declarada**, que ocupa el lugar de la salida que se
  retira («el `sysadmin` sigue siendo el camino de emergencia»).

  **El agujero que la unidad, tal como está planteada, NO cierra — y es decisión abierta del autor.** Retirar la
  *concesión de la acción* deja intacto el **bypass de stock del `sysadmin`**: `package_patch {private: false}` responde
  `200` y publica, porque el muro **no corre** para un `sysadmin`. Hay entonces un **segundo** camino directo, **no
  registrado**, que la regla «sin publicar directo» también alcanza si se la lee entera. Cerrarlo exige que la pared
  **corra también para el `sysadmin`** (`auth_sysadmins_check` en sus tres funciones), y su costo es explícito: el
  `sysadmin` pierde su camino de emergencia por API. El requisito `Sysadmin Bypass` hoy **declara** ese bypass como
  intencional, así que las dos posiciones están escritas y en tensión: quedó marcado **como decisión abierta** dentro del
  propio requisito —no lo reescribí por mi cuenta— y **se le preguntó al autor**.

  **Y la respuesta del autor, el mismo día:** *«La pared corre para el `sysadmin` también.»* La spec quedó enmendada en
  consecuencia —`Sysadmin Bypass` invierte su signo: la guarda **declara** `auth_sysadmins_check`, la pared **corre**
  para el `sysadmin` y le refusa la escritura de visibilidad; la negativa queda **acotada a la transición, no al
  invocante** (un `package_patch` sólo de metadatos del mismo `sysadmin` sigue dando `200`); y `package_create` con
  `private` no explícitamente privado también se refusa para él—. Consecuencia declarada, y es la que vuelve **real** la
  limitación de arriba: **el `sysadmin` no tiene ningún camino de emergencia por API**; toda publicación pasa por una
  solicitud decidida, así que los dos callejones sin salida **no tienen bypass detrás**. El cortocircuito de CKAN fuera
  de esta capacidad no se toca: cambian las tres funciones de la guarda, nada más. La sesión par ya tiene la posición y
  su unidad suma el flag, el inventario de puertas del muro, el contrato y las filas de `A5` con el resultado esperado
  **invertido** (`200` → `403`).

  **Learned (lo transferible).** Retirar una puerta **sancionada** no retira la que el sistema deja abierta: la que se
  borra y la que CKAN mantiene son objetos distintos, y confundirlos produce un «ya está cerrado» falso. El chequeo que
  lo detecta es preguntar **por qué esa puerta funcionaba**: si su razón de ser era otra puerta ausente y esa otra sigue
  ahí, retirarla no cambia el resultado — sólo cambia **quién queda registrado**. Y en la spec, la consecuencia de una
  regla nueva se **escribe**: dejarla implícita es lo que hizo que la misma pregunta volviera cuatro veces.

  **Actualización de alcance (misma tarde, la sesión par).** El cierre es **total** y el alcance creció: `publication_publish`
  **deja de existir** —se retiran la acción, su auth y sus dos registros en `plugin.py`; un nombre no registrado responde
  `400 "Action name not known"`, medido—; el muro pasa a **cuatro** acciones, no cinco; las tres funciones llevan
  `auth_sysadmins_check`, y el `sysadmin` **conserva** la administración de `state` (`bulk_update_delete`), que **no** es
  publicar: las dos reglas de `package_update` se separan a propósito; la selección de rótulo pasa a ser **por hecho y no
  por rol** (`Publication flow: …` para quien puede actuar por el flujo, `Publish denied: …` para el resto) y los rótulos
  congelados pasan de **nueve a ocho** (se retira `Not a sysadmin`), con la oración de `Publish denied` cambiada porque
  «only an organization administrator can publish a dataset» pasó a ser falsa. El test que **afirmaba el bypass como
  diseño** (`test_auth.py`, A3.3) queda en rojo por decisión, que es lo que se busca. **De mi lado**: la spec del cambio ya
  lo refleja (acción **removida**, cuatro acciones, corte de `state` escrito como deliberado, y los dos callejones con su
  «sin red»), los rótulos **no** están pinneados en mi spec (verificado con `grep` sobre todo el directorio del cambio), y
  queda pendiente **re-cortar la sonda**: `probe.sh` tiene tres toques a `publication_publish` (`P11.nf.dataset`,
  `P13.pub.sysadmin`, `P13.pub.editor`) que mueren o invierten —la negativa pasa a ser `400` por nombre no registrado— y
  el bypass de stock del `sysadmin` invierte su resultado esperado. Se corre **después** del merge de la sesión par,
  contra el stack, como unidad propia.

- **2026-10-08 (noche) — La unidad de la API aterriza, y su compuerta ESCALA sobre la limitación declarada.**

  **La unidad:** rama `unit/no-direct-publish`, commit **`b63b00c`** (8 archivos, +437/−552), **sin pushear** (el push y el
  merge son del autor). Suite **168 passed / 0 failed** (venía de 171: se retiraron 14 tests y se agregaron 11), medida por
  un **verificador independiente** con `ckan-docker/bin/test-umss`. Y verificación independiente del registro: **cuatro**
  acciones, siete funciones de auth, **`publication_publish` ausente de las dos listas**, y `auth_sysadmins_check`
  **True/True/True** en `package_update`, `package_create` y `bulk_update_public`.

  **Los ocho rótulos congelados** (valores, verificados con `grep` sobre las constantes `*_LABEL`): `Four eyes`,
  `Requester capacity`, `Not an approver`, `Already public`, `Cannot request`, `Cannot cancel` —los seis de
  `logic/auth/publication.py`— más `Publication flow` y `Publish denied` —los dos de `auth.py`—. Se retiró **`Not a
  sysadmin`** con la acción. La **oración** de `Publish denied` es ahora `only an organization administrator can decide a
  publication request`: exactamente el texto que mi spec hizo normativo.

  **Los insumos medidos para el re-corte de `A5`** (todo contra `b63b00c`, medido o ejecutado, nada leído): (a)
  `publication_publish` → **`400 "Bad request: Action name not known"`**, ni 403 ni 404; (b) `package_patch
  {private: false}` del `sysadmin` → **403**, `private` intacto y sin fila; (c) el `sysadmin` conserva **200** en un patch
  **sólo de metadatos** y en un cambio de **`state`** (`bulk_update_delete`), la capacidad preservada a propósito; (d) el
  `sysadmin` que intenta publicar directo ahora lee **`Publication flow`**, no `Publish denied`; (e) un **admin de
  organización** en `bulk_update_public` sigue leyendo `Publication flow` — la sesión par tuvo que **corregir su propia
  instrucción al escritor** ahí, que lo había degradado a `Publish denied` (frase falsa para él); lo detectó **releyendo el
  diff contra el original**, no con un test—.

  **Y la compuerta nativa del otro lado ESCALÓ, no aprobó.** Linaje `review-67e5ce17ce2b4bcb` sobre `02893f7..b63b00c`
  (tier high, 4 lentes): estado **`escalated`**, transición **terminal** `native_stop_required`, causa `unknown_causality`,
  atada a **`R4-001`** (lente **resilience**, `severity: CRITICAL`, `evidence_class: deterministic`), ubicación
  `ckanext/umss/logic/auth/publication.py:121-123`. Su texto, verbatim: *«Removing publication_publish and the sysadmin
  escape hatch leaves publication requests permanently undecidable when the requester loses capacity or is the only
  approver; the changed comment states the request stays pending with no escape hatch, so the dataset can never be
  published.»*

  **Cómo se lee eso, y es lo importante:** el revisor independiente leyó **el comentario que declara la limitación** y lo
  levantó como CRITICAL. **No es un defecto accidental: es la consecuencia que el autor aceptó** al elegir cerrar todo, y
  es **exactamente la limitación que mi spec declara** desde la primera enmienda. O sea: el código hace lo que el
  requisito pide y el desacuerdo es de **política**, no de hecho — el proveedor degradó el hallazgo por
  `unverified_location` y la sesión par **verificó que la ubicación es real** (el comentario existe y dice eso).
  Proceduralmente la escalada es correcta (causalidad `unknown` sobre un CRITICAL escala, y es terminal) y **la herramienta
  no firma sola una consecuencia de política: la firma es del mantenedor**. No corresponde reintentar la compuerta sobre
  ese candidato.

  **Consecuencia para esta casa:** el re-corte de `A5` espera esa firma, **no más código**. Y si el autor elige la otra
  rama —abrir salida para los dos casos bloqueados—, la sesión par avisó que **cambiaría `Approver Capacity` otra vez**, así
  que la spec no se toca hasta que decida.

  **Cierre de `A5` (2026-10-08, madrugada): la sonda re-cortada, `81/81`, y el mapa de rótulos COMPLETO.**
  La sonda pasó de **`52/56`** con las expectativas viejas a **`81/81`** con las nuevas, y el delta tiene cuatro piezas:
  (1) las filas de `publication_publish` **repuestas** a `400` por nombre no registrado; (2) `P6.1` **invertida** —el
  `package_patch {private: false}` del `sysadmin` esperaba `200` y publicaba de verdad y ahora espera `403`—; (3) **el
  fixture público dejó de fabricarse por el bypass**: el editor pide y un admin decide, que es la única puerta que queda
  (y sus filas dependientes —`P7.d2`, `P14.create.public`— caían en cascada por eso, lo que mide cuánto sostenía esa
  puerta: **la usaba mi propio andamiaje**); y (4) **la capa de rótulos que el encabezado prometía desde el 2026-10-07 y
  nunca se había implementado**, con dos helpers: `label()` afirma la forma `Access denied: <Rótulo>: …` y el rótulo
  propio, y `notwall()` afirma lo inverso donde la negativa es de CKAN.

  **El mapa de los ocho, con invocante medido (nada razonado):** `Publication flow` → admin de la dueña, admin de una
  **padre** y `sysadmin`; `Publish denied` → el **editor** por `package_patch` y **también un `member` por
  `bulk_update_public`** (la única puerta donde el muro no delega en `next_auth`, así que alcanza a todo invocante
  autenticado); `Not an approver` → un editor decidiendo su propia solicitud; `Four eyes` → un admin decidiendo la suya;
  `Already public`, `Cannot request`, `Cannot cancel` → sus filas; y **`Requester capacity` → un `sysadmin` que decide una
  solicitud cuyo solicitante perdió la membresía**, donde se midió el **orden** que la sesión par razonó: ese chequeo corre
  **antes** de cuatro ojos y antes de la rama del `sysadmin`. Y una fila que afirma **el inverso**: para un `member`, un
  ajeno y un anónimo en `package_patch` la negativa es **de CKAN**, sin rótulo del muro, porque corta antes.

  Dos correcciones mías que la corrida impuso y quedaron escritas en el archivo: `Publish denied` **no** es «el resto»
  (es del editor, y de un member por la puerta en bloque), y un editor decidiendo su propia solicitud lee **`Not an
  approver`**, no `Requester capacity`.

  Y un defecto propio que la corrida destapó: **la higiene se tragaba el motivo** de una purga fallida
  (`>/dev/null 2>&1` más una nota a mano), así que un fallo era indistinguible de un misterio — así quedó un dataset
  atrás. Ahora imprime el motivo. La invariante de la base compartida se sostiene: **`0` datasets, `0` organizaciones,
  `0` tokens**, y el conteo anónimo de vuelta en `19 → 19`.

  **Dos correcciones de la sesión par sobre cómo leer esas corridas, aceptadas y anotadas acá:** (1) **los totales NO
  son comparables** —`52/56`, `81/81` y `77/85` no miden el mismo conjunto, porque las filas se agregaron entre corridas—,
  así que lo que sostiene la afirmación es la **lista fila por fila** de los rojos, nunca la diferencia de totales: quien
  lea sólo los números creería que se midió dos veces el mismo conjunto; y (2) la asimetría que el protocolo dejó a la
  vista: si la corrida del tercer cuadrante hubiera caído **al otro lado** de la ventana, las filas nuevas habrían salido
  **todas verdes** y yo habría concluido que el re-corte **no discrimina** — el control `404`/`400` evitó el falso verde
  **dos veces**, la segunda incluso con la suerte de mi lado. Regla de método: **el control no es trámite, es lo que
  convierte la corrida en prueba**, y verificar el estado **después** es el orden frágil. La atribución de build no se
  hace por creencia: se hace por **las respuestas de las propias filas** (`200` en el `package_patch` del `sysadmin`,
  `404` en el id irresoluble, `403` en el chequeo de capacidad son del build viejo) más el discriminador.

  **Y el autor firmó el mismo día: acepta la limitación declarada y sigue.** Lo que eso significa, dicho sin adorno: la
  escalada **queda como registro**, no como obstáculo —no se reintenta la compuerta sobre `b63b00c`, y el push y merge de
  esa unidad son política ordinaria—, y **no hay corrección de código pendiente**, porque el hallazgo describe la
  consecuencia aceptada y no un defecto. Lo que sí queda anotado como costo: en una instalación cuyo único aprobador es el
  solicitante, **ese dataset no se publica**, y la mitigación es operativa (otro aprobador, u otra organización
  administradora en el camino), no de código. Y mi re-corte de `A5` deja de esperar una decisión y pasa a esperar **un
  hecho**: que el stack corra el código nuevo (el contenedor no recarga en caliente, así que hoy el servidor tiene el muro
  viejo en memoria), que es del lado de la sesión par.

## WU-8 · Los dos avisos de la compuerta del badge (2026-10-09)

**Por qué existe esta unidad.** El arreglo del badge (commit `8fef9bf`, PR #58) **se mergeó sin compuerta**: el linaje no
existía y se descubrió al reconstruir el estado, no al revisar. La compuerta corrió **después**, sobre el **rango
commiteado** `f9224aa..a4b2124` —idéntico al merge `fc62cb8` de `origin/main`, verificado con `git diff --stat` de los dos
rangos, no asumido—, con `committedOnly: true`.

**El resultado**: linaje **`review-24164b1645f385df`**, tier **medium**, lente única `review-reliability`, 6 archivos,
**165 líneas**, presupuesto de corrección 83. Estado **`approved`** con **2 avisos** no bloqueantes, y autoridad **quemada**
(`review-24164b1645f385df` → `gentle-ai.review-acknowledged/v1`).

**Los dos avisos, con su texto rescatado del `review-state.json` ANTES del acuse** (el recibo sólo conserva id, severidad
y ubicación; el texto se pierde con el linaje):

1. **`R3-001`** (SUGGESTION, determinístico, `src/routes/dataset/[id]/+page.svelte:198`): el derivado de la insignia
   termina en `default: return null;`, así que **el JSDoc de arriba miente**: promete que un estado nuevo de
   `publication_requests` no compila hasta nombrarlo, y con el `default` presente **sí compila** y el hero se queda sin
   insignia. Es la degradación silenciosa que el comentario declaraba cerrada. **El hermano `estadoDeLaSolicitud` sí
   tiene la forma buena** (`const exhaustivo: never = …`), así que el arreglo copia la forma que ya estaba en el archivo.
2. **`R3-002`** (WARNING, determinístico, `src/routes/dataset/[id]/+page.svelte:161`): el motivo del rechazo llega al
   usuario **sólo** por esa concatenación en la tarjeta —la fila de acciones dejó de mostrarlo el 2026-10-08— y **ninguna
   aserción lo prueba**: la prueba de la página sumó únicamente la insignia pendiente, y la del componente afirma la
   **ausencia** del motivo en la acción. Si esa concatenación regresa, el motivo desaparece de la página sin que falle
   nada.

**Decisión del autor (2026-10-09):** arreglar los dos en una unidad corta con su compuerta, y **no** dejarlos como nota.

**Lo que esta unidad exige para cerrarse:** (a) el `never` de verdad en el derivado, con `undefined`, `approved` y
`cancelled` enumerados explícitamente —para que agregar un estado **rompa la compilación**—; (b) la aserción que fija el
motivo en la tarjeta, **con su mutación medida**: quitar la concatenación tiene que poner la prueba en rojo (si no, la
prueba no prueba); (c) `pnpm test` focalizado y `pnpm check` en verde; (d) compuerta nativa propia sobre el rango
commiteado.

**Lección de método, registrada acá porque costó trabajo:** **mergear antes de revisar no ahorra tiempo, lo agrega** —el
candidato deja de ser un diff vivo y pasa a ser un rango sobre el que ya se movió `main`, y hay que **demostrar** la
equivalencia con el merge en vez de suponerla—. Y un aviso informativo **no es «nada»**: los dos de esta ronda son deuda
accionable, encontrada por una lente que leyó el JSDoc contra el código.

**Cierre de WU-8 (2026-10-09, rama `fix/hero-badge-advisories`).** El commit `4d6c1ed` cierra los dos avisos: el
discriminante de la insignia se ata a una `const` antes del `switch` —sobre `solicitudVigente?.status` TypeScript no
angosta el `default`— y los estados sin insignia (`approved`, `cancelled`) y la **ausencia** de solicitud se nombran
para que el `never` sea alcanzable, medido con un miembro falso en la unión que hace fallar `pnpm check` en **las dos**
funciones; y la prueba que afirma la frase completa del motivo en la tarjeta, con su **mutación observada en rojo**
(quitar «Motivo:») y restaurada byte a byte. Verificación independiente: suite **1011**, `pnpm check` 0 errores / 4
avisos (baseline intacta), Biome limpio sobre 185 archivos.

**La compuerta de esa unidad (linaje `review-fc19b705503a55a7`: 4 archivos, 100 líneas, tier medium, lente
`review-reliability`) salió aprobada, y su único aviso es un FALSO POSITIVO, verificado contra el código.** La lente
leyó el `case "cancelled":` nuevo (retirada → sin insignia) como duplicado del arm anterior que devuelve la insignia
**«Solicitud anulada»**, y ese arm es `case "annulled":` — **dos miembros distintos** de la unión
(`"pending" | "approved" | "rejected" | "cancelled" | "annulled"`). La ubicación citada (`+page.svelte:206`) es
`case undefined:`. **No se toca nada**, y hay una razón medida: quitarlo haría **fallar la compilación** —el
discriminante queda sin agotar y el `never` deja de ser alcanzable—, o sea que **el guardián que esta unidad puso es
lo que detendría un arreglo equivocado**. El aviso queda como registro; no se reintenta la compuerta sobre un candidato
ya aprobado. Regla de método que se lleva la sesión: **un aviso de una revisión aprobada se verifica contra el código
antes de tratarlo como deuda** —uno de esta ronda era real; éste no.

## WU-9 · Gobernanza: el aprobador revisa antes de decidir (2026-10-09)

**El caso, planteado por el autor.** La aprobación **no es un trámite**: antes de aceptar la solicitud hay que
**revisar** el dataset, porque la gobernanza exige comprobar que la información es correcta para ser pública.

**Lo medido el 2026-10-09, y son tres hechos distintos:** (1) el aprobador **sí puede leer** el dataset —admin de la
organización dueña que no es el solicitante: `package_show` → `200`, `private=true`, con recursos, medido el
2026-10-08—; (2) **no tiene cómo llegar a él**: `PublicationQueue.svelte` muestra el **título como texto** y el
componente **no tiene un solo `href`** (verificado), y el dataset está **privado**, así que **no está en el catálogo**;
(3) los controles de decidir viven **sólo en la cola**; la ficha tiene el control del solicitante y una tarjeta de
estado de sólo lectura. La caminata de punta a punta del criterio de `v0` se hizo, por lo tanto, **aprobando a ciegas**.

**Decisión del autor (2026-10-09):** va la **(a)** —el título enlaza al dataset en pestaña nueva— y quiere **ver la
(b)**, los controles de decidir en la ficha, para juzgar si le gusta: por eso la (b) **va a un playground** y **no se
promueve** hasta que la revise. Y en el mismo movimiento, la decisión de `dataset_id`: **(a) ahora** —elección
determinista por la pendiente más reciente, y la ficha dice que hay más de una—, **(b) para `v1`** (quitar la
resolución por nombre y migrar las filas viejas es trabajo del otro repo). El detalle de las dos decisiones quedó en
`BACKLOG.md`, sección «Decisiones del autor (2026-10-09)».

**Entregado y con compuerta cerrada (2026-10-09): rama `fix/approval-review-path`, PR #61, cuatro commits.**
`6633ba5` (el título de la fila enlaza al dataset en pestaña nueva, con el aviso `sr-only` y el enlace **hermano** del
disparador), `abb423e` (la ficha elige la pendiente más reciente y dice cuántas hay), y dos commits que cerraron los
dos avisos que la propia compuerta devolvió. Suite **1016**, `pnpm check` 0 errores / 4 avisos, Biome limpio.

**Los dos avisos, los dos verificados contra el código antes de tratarlos como deuda, y los dos verdaderos.**
1. Linaje `review-0be0a83062f8b75f` (medium, `review-reliability`, 4 archivos, 133 líneas) → **aprobado**, con un
   aviso: la selección comparaba `created_at` con un `>` **estricto**, así que dos pendientes con el mismo instante
   las decidía el **orden del arreglo** — exactamente la dependencia que el comentario vecino decía haber quitado, y
   sin prueba. Cerrado en `1474120` con un desempate **total** por `id`, con **RED observado**: con los ids en orden
   `req-a`/`req-b` y timestamps iguales, la tarjeta mostraba `req-a` (la primera del arreglo).
2. Linaje `review-dc933c4c6ddb7cdc` → **aprobado**, con otro aviso verdadero: la prueba del enlace lo buscaba con
   `name: /Matrícula 2026/`, un `match` que pasa **con o sin** el aviso de pestaña nueva, así que el aviso `sr-only`
   no lo probaba nada. Cerrado en `749ad99` afirmando el **nombre accesible completo**, con la **falsificación
   medida**: borrar el `sr-only` la pone en rojo y restaurarlo la vuelve a verde.
3. Linaje `review-1e13581e93d61147` (sobre el rango final) → **aprobado SIN hallazgos**.

**Lección de método que dejó esta unidad, y es la que acota el bucle:** los avisos informativos de una compuerta
**aprobada** se cierran uno por uno mientras el arreglo sea chico y verdadero —los dos de acá eran ciertos y se
verificaron **antes** de aceptarlos como deuda—, pero **cada arreglo crea un candidato nuevo y por lo tanto otra
compuerta**. El bucle no se agota por insistencia: se corta cuando el aviso es falso, cuando el arreglo es caro, o
cuando el rango vuelve limpio — como acá.

**Estado de la sonda `A5` tras la respuesta de la sesión par (2026-10-09).** La **pared quedó medida con
credenciales** por ellos: `ckan_admin` + `package_patch {private: false}` sobre `test-pdf` → **`403 Access denied:
Publication flow: …`**, con **paridad antes/después** (`private` True→True y el store **6→6** filas) y el token
**revocado** al terminar. Mi medición anónima (`publication_publish` → `400`) probaba **qué build** corre, no que la
pared **actúe**: las dos juntas cierran la pregunta, y la de ellos es la fuerte. Además: el contenedor sirve el **árbol
de trabajo en disco**, no un commit — hoy ese árbol es **`master`**.

**Y no hay desbloqueo pendiente de este lado:** pidieron explícitamente **no correr el re-corte por ellos** —el muro
está mergeado (su PR #6) y no tienen ningún pendiente que ese hecho desbloquee—. Si la sonda se corre, su valor hoy es
**medir el delta del PR #12** (el store guarda el **id canónico** y la cola resuelve por **id o nombre**; una solicitud
creada **por nombre** pasó de **0** a **1** fila visible para el aprobador), y ese delta mueve **las filas de creación y
listado**, que hay que revisar **antes** de correr. La corrida sigue donde estaba: **después de `v0`**.
