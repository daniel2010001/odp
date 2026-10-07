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
  ya autoriza. La etiqueta «actor equivocado» del `BACKLOG:1653-1656` aplica al modelo del PRD (donde el que
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
  reparto: **la par hace `odp-docker` (A1/A2/A3/A5); esta sesión hace `odp` (B1/B2)**. Está escrito en
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
