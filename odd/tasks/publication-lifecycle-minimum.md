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
- **2026-10-07 — Aviso operativo: `dataset` todavía NO está en el código.** El contrato aditivo está
  **decidido** (y el portal ya lo consume), pero la clave `dataset` llega en la unidad de seguimiento de A2
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
  1. **El contrato aditivo queda CONFIRMADO**: `publication_publish` y `decide {approve: true}` devuelven la
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
