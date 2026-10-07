# Diseño — la cola de publicación y la puerta única del guard

> **WU-2c** del expediente `odd/tasks/publication-lifecycle-minimum.md`. No es el `design.md` del cambio:
> es el **instrumento de decisión** que el autor pidió para elegir alcance mirándolo. Lo que se acepte se
> funde después en `openspec/changes/2026-09-13-publication-lifecycle/design.md` (WU-3).

## 1. La pregunta heredada, y por qué su formulación es la trampa

La pregunta que el `BACKLOG.md:1269-1272` llama «la decisión más difícil del rediseño» es **«cómo el guard
consulta la solicitud aprobada»**. Formulada así, la respuesta es mala por construcción, y conviene decirlo
antes de contestarla:

- El guard es una **función de autorización**: se ejecuta antes de la validación y de la persistencia
  (`auth.py:1-14`), y **puede llamarse más de una vez por request** para una misma acción.
- Si para autorizar el flip tiene que *verificar* una aprobación, la aprobación se vuelve un **token
  consumible**, y el consumo tiene que ocurrir en el guard. Eso pone una **escritura dentro de un predicado
  de lectura**, con dos consecuencias: el mismo request puede consumirlo dos veces, y el orden pasa a
  importar (aprobar y después publicar deja una ventana en la que cualquier `admin` puede publicar).
- Y hay un caso que no cierra: **`package_create` no tiene fila previa** a la que atar una solicitud.

La reformulación que sí cierra: **el guard no consulta nada — se convierte en una pared, y se agrega una
puerta.** Nadie pliega `private` a público ni cambia `state` por `package_update`, **ni el `admin`**; el
cambio se hace **sólo** por una acción dedicada que, en la misma transacción, escribe el registro y pliega
el valor.

## 2. Por qué la pared es más fuerte que la consulta

| | Guard **consultivo** (la pregunta heredada) | Guard **de pared** + puerta (este diseño) |
|---|---|---|
| Quién puede pliegar `private` | El `admin`, si hay una solicitud aprobada que lo cubra | **Nadie**, por `package_update`. Sólo la acción dedicada |
| Dónde vive el registro | En una fila que el guard lee y consume | En una fila que la acción **escribe**, en la misma transacción que el flip |
| Ventana de replay | Sí (aprobado y no consumido = token vivo) | **No**: no hay token, hay una transacción |
| Escritura en un predicado | Sí, inevitable | **No** |
| `package_create` con `private: false` | Caso especial sin fila previa | Sigue **refusado** (crear es siempre privado); el registro se ata a un dataset que ya existe |
| Testabilidad | Hay que probar orden, doble consumo y concurrencia | El guard es una **negación**: se prueba con 403 y con el valor intacto |

**Ninguna garantía se pierde.** `RF-15` paso 5 pide que ninguna visibilidad cambie por otro camino que la
degradación directa de `RF-42`. Con la pared, el **único** camino es la acción, y la acción siempre escribe
su registro. Es la misma garantía, obtenida de una forma que no necesita consumir nada.

## 3. El diseño concreto

### 3.1 La tabla

Esquema del PRD (`PRD.md:336`: `id, dataset_id, requested_visibility, status, requested_by, approved_by,
comments, created_at`) más **lo que la minería encontró que le falta**: `references/README.md:96-102` señala
que el esquema del PRD **no tiene el desenlace «anulada»** (una solicitud que quedó sin objeto se escribe
como `resolved/rejected`), y `RF-42` exige el **motivo** de la degradación directa.

| Columna | Para qué |
|---|---|
| `id` | PK |
| `dataset_id` | El dataset al que se ata (texto, el `id` del paquete) |
| `requested_visibility` | `public` \| `private` (la subida es `public`; la bajada es `[v1]`) |
| `status` | `pending` \| `approved` \| `rejected` \| `cancelled` \| `annulled` |
| `requested_by`, `approved_by` | Autoría y aprobación |
| `comments` | Lo que escribió quien pidió |
| `motive` | El motivo de la degradación directa (`RF-42`, `[v1]`) |
| `created_at`, `decided_at`, `consumed_at` | Cronología, y **el consumo** |

Índice parcial único: **una sola `pending` por dataset**. Es la regla que evita la cola duplicada.

### 3.2 La migración

**El mecanismo está medido, y no requiere una línea de plugin.** `ckan/cli/db.py:144-175` recorre
`config.get('ckan.plugins')`, y para cada plugin usa `_repo_for_plugin(plugin)` → `repo.upgrade_db(version)`;
existen `ckan db upgrade`, `ckan db downgrade`, `ckan db pending-migrations` y el flag `-p/--plugin`
(`ckan/cli/db.py:23,38,92-110`). El plugin de ejemplo de CKAN —`ckanext/example_database_migrations/plugin.py`,
medido: la clase es `pass`— **no implementa nada**: el registro es por **nombre de plugin** más la existencia
del árbol de migración.

Layout a copiar (medido en la imagen): `migration/umss/{alembic.ini, env.py, script.py.mako, versions/}`,
con `versions/0001_add_publication_requests.py`. `MANIFEST.in` **ya reserva** `ckanext/umss/migration`.

Consecuencias a declarar:

- `ckan -c <ini> db upgrade` pasa a ser un **paso de despliegue** en `odp-docker`.
- El montaje de dev y la imagen de producción **divergen** (`docker-compose.dev.yml` monta `./src`;
  `Dockerfile.umss` copia): en dev el código es vivo, en prod la migración viaja con la imagen y **hay que
  correr el comando al desplegar**.
- **Hazard heredado** (`tasks.md:51-75`): la suite de la extensión **nunca** se corre sin sobreescribir base
  de datos **y** site id — el 2026-09-14 borró las 16 datasets del seed.

### 3.3 Las acciones

Una sola puerta para publicar, y la cola alrededor. Todas se registran por `IActions`
(`logic/__init__.py:526-542`; el mecanismo de acciones encadenadas ya está medido por el propio guard).

| Acción | Autorización | Qué hace |
|---|---|---|
| `publication_request_create(dataset_id, comments?)` | Quien puede `update_dataset` en la organización, y el dataset está privado | Crea la fila `pending`. **Idempotente**: si ya hay una pendiente para ese dataset, la devuelve |
| `publication_request_cancel(request_id)` | Quien la pidió, o un `admin` | `pending` → `cancelled` |
| `publication_request_decide(request_id, approve, comments?)` | `admin` de la organización (de la propia o de una padre) o `sysadmin` — **nunca quien la pidió** | Rechaza (`rejected`, con `comments` **obligatorio**) o **aprueba**: marca `approved` + `consumed_at` y **pliega `private` en la misma transacción**; revalida el dueño actual del dataset y la capacidad actual del solicitante |
| `publication_publish(dataset_id, comments?)` | **solo `sysadmin`** | El camino directo **registrado** del sysadmin: **crea la fila y la aprueba/consume en el acto**, por encima del bypass sin flag que CKAN le da gratis |
| `publication_request_list(status?)` | Quien administra o edita en la organización | La cola. Devuelve las solicitudes de las organizaciones donde el invocante tiene capacidad, y las propias (las propias se listan, pero no las puede decidir) |

**Cuatro ojos: nadie aprueba su propia solicitud.** El store es una **puerta, no un registro**, y una puerta
exige un aprobador distinto del solicitante. Con la autopublicación, el alcance entero degenera en un
registro — y el repositorio ya había escrito el principio: en `BACKLOG.md:1705`, al aparcar el PR 2, dice
«en el modelo del PRD **el que pide no es el que aprueba**», que fue la razón declarada del aparcamiento.
Publicar decide sobre el dataset de **otro**: el camino directo del `admin` dejaba a un administrador
publicar un borrador que su autor todavía estaba trabajando, con datos provisionales o sensibles. La
negativa debe ser distinguible y nunca un no-op silencioso. **Costo aceptado y declarado:** una
organización cuyo único `admin` es el solicitante ahora necesita un `sysadmin` para publicar; el PRD ya
acepta el caso análogo («una organización con editores pero sin `admin` no puede publicar»). El `sysadmin`
sigue siendo la salida de emergencia — inevitable y no nueva, porque CKAN ya cortocircuita su autorización.

`publication_publish` es **solo `sysadmin`**: un `admin` de organización **no** tiene camino directo. El
`sysadmin` conserva y gana una puerta **registrada**: la acción escribe la fila, por encima del bypass de
`authz.py:224-228` (que cortocircuita salvo `auth_sysadmins_check`, flag que este diseño deliberadamente no
pone). El `comments` del aprobador es **obligatorio al rechazar** y opcional al aprobar.

**Cómo pliega la acción.** `helpers.call_action('package_patch', context={..., 'ignore_auth': True},
data_dict={'id':…, 'private': False})`. Dos hechos medidos lo sostienen:

- `ignore_auth` **es una clave real del contexto** que la capa de acciones honra (`logic/__init__.py:922`, y
  se usa internamente en `:946`).
- **Un cliente remoto no puede inyectarla**: `ckan/views/api.py:244-249` construye el contexto **en el
  servidor** y `:280` pasa el cuerpo del request como `data_dict`, no como contexto. Lo que el cliente envía
  no entra en `context`.

Y como `context.setdefault('session', model.Session)` (`logic/__init__.py:313`), la fila y el flip van por
**la misma sesión**: o se confirman los dos, o no se confirma ninguno.

### 3.4 El guard (la pared)

Cambios en `ckan-docker/src/ckanext-umss/ckanext/umss/auth.py`:

1. **`package_update`**: refusar **todo** pliegue `private`→público y **todo** cambio de `state`, **sin
   excepción de capacidad**. El mensaje se mantiene distinguible: distinto para quien no administra
   («Only an organization administrator can publish a dataset») y para quien administra (publicar va por el
   flujo, no por `package_patch`).
2. **`package_create`**: refusar **también para el `admin`** un `private` que no sea explícitamente `true`.
   Con la puerta, crear público deja de tener sentido: se crea privado y se publica.
3. **`bulk_update_public`**: nueva función encadenada que lo refusa. Los artefactos lo midieron como
   **bypass real** (`design.md:153`, sonda P8): escribe directo y **no** delega en `package_update`, así que
   la pared no lo cubre sola. `bulk_update_private` es la bajada: `[v1]`, con `RF-42`.
4. **Lo que no se toca:** `_as_bool` y la fidelidad a `boolean_validator` (medida: `'banana'` se guarda como
   **público**, así que «diferir un valor no interpretable» sería publicar), y `auth_allow_anonymous_access`
   (la cadena pierde el flag de core: medido en `apply-progress.md:402-407`).
5. **El bypass del sysadmin queda, declarado.** `authz.py:224-228`: un sysadmin pasa por delante de toda
   función de auth salvo que lleve `auth_sysadmins_check`. No se le pone el flag: es la salida de emergencia
   real del sistema y ya estaba aceptada (`design.md:129-131`). Su puerta **registrada** es
   `publication_publish` (3.3), que escribe la fila; el `package_patch` sin flag sigue como escape de
   emergencia.

### 3.5 La cola en el portal (sólo si entra el alcance con cola)

- **Sin ruta nueva para el pedido**: el control vive en la página del dataset, junto a las acciones del hero
  (`src/routes/dataset/[id]/+page.svelte:436-449`), con la capacidad leída por
  `puedeEditarDataset`/`listUpdatableOrganizationIds` (`organization_list_for_user {permission:
  "update_dataset"}`), que ya existe. El control de **publicación directa** es solo para el `sysadmin` y
  usa el flag que el portal ya calcula (`isSuperAdmin`, `src/lib/stores/auth.ts:96`) — sin plomería nueva;
  la capacidad `admin` de organización **no** habilita ese control, porque el camino directo es del
  `sysadmin`.
- **Ruta nueva para la cola del aprobador**: no existe ninguna candidata natural. El dashboard
  (`src/routes/dashboard/+page.svelte`, 743 líneas) es el anfitrión más barato; su sección «Mis datasets»
  (`:442-451`) es el vecindario.
- **El `PublishControl` aparcado no se tira**: su manejo honesto del `403` y sus dos
  máquinas de estado se conservan; su compuerta cambia de la lista de organizaciones `admin` al flag
  `isSuperAdmin` que el portal ya calcula, y la acción a la que llama (`package_patch` →
  `publication_*`).

## 4. Lo que este diseño obliga a enmendar

Si la pared se adopta, **el contrato vigente deja de ser cierto en dos sitios, y hay que escribirlo**:

- `specs/publication-lifecycle/spec.md` → `Requirement: Approver Capacity`: hoy dice que un `admin` **sí**
  puede pliegar `private`. Con la pared y la regla de cuatro ojos, la capacidad del `admin` se ejerce por
  `publication_request_decide` — nunca sobre su propia solicitud — y `publication_publish` pasa a ser solo
  del `sysadmin`. Los escenarios cambian de forma, no de intención.
- La **sonda** (`probe.sh`, 25/25 hoy) afirma que un `admin` publica con `package_patch` → **pasa a 403**;
  hay que agregar los casos de la puerta. La sonda es material de revisión, no presupuesto de código.

Sin ese ajuste, quedan dos documentos afirmando lo contrario del código — que es exactamente el defecto que
este expediente vino a cerrar.

## 5. Lo que NO está medido (y no se disimula)

| Punto | Estado | Cómo se cierra |
|---|---|---|
| La **capa de modelo** de la extensión (clase declarativa sobre el metadata de CKAN) | **Sin precedente local**: el ejemplo de migración de CKAN trae migraciones, no modelo | Se resuelve en el primer commit de B, con la sonda |
| Atomicidad real de «fila + flip» con `ignore_auth` | **Deducida** de la sesión compartida (`logic/__init__.py:313`), no medida | Una sonda: forzar el fallo del flip y comprobar que la fila no queda |
| Que la pared no rompa acciones nativas no inventariadas que escriban `private`/`state` | **Parcial**: `bulk_update_public` está medido; el resto no | Inventario por sonda antes de aplicar |
| La ruta de la cola en el portal | Decisión de diseño, no medición | La revisa el autor mirándola (regla 8) |

## 6. Consecuencia para la decisión de alcance

Con este diseño, **el alcance «mínimo» gana una opción que antes no existía** — y es la que conviene mirar:

| | **A plano** — no tocar el guard | **A′ — puerta única sin cola** | **B — con cola** |
|---|---|---|---|
| Quién publica | El `admin`, con `package_patch`, directo | El `sysadmin`, por `publication_publish` | El `editor` pide; un `admin` distinto del solicitante aprueba (o el `sysadmin` publica directo) |
| Backend | **0 líneas** | ~50 líneas (pared + 1 acción) + sonda | ~600 líneas (tabla, migración, 5 acciones, pared) + tests |
| Portal | **491+363 ya construidos**, sin tocar | Los mismos, con `publish()` apuntado a la acción nueva | + control de pedido y pantalla de cola (~350 / ~500 estimadas) |
| Salida de emergencia | Sí (`package_patch` por API; y el sysadmin) | **Sólo el sysadmin** | Sólo el sysadmin |
| Si después entra la cola | El guard y el componente **se rehacen** | **Aditivo**: se agregan tabla y acciones, la pared **no se toca** | — |
| Lo que enmienda | Nada | `Approver Capacity` + la sonda | Todo lo de A′ y más |
| Criterio de `v0` | Lo alcanza | Lo alcanza | Lo alcanza, más tarde |

**A′ no es B ni es A: es la forma de que B sea aditivo en vez de un rehacer.** Cuesta ~50 líneas y una
enmienda de contrato, y compra que la segunda mitad del trabajo no pise la primera.

El único argumento honesto en contra de A′: **quita la salida de emergencia por API.** Si el portal falla, un
`admin` ya no puede publicar con un `curl`. Queda el sysadmin. Es una pérdida real de operabilidad, no un
tecnicismo, y es la razón por la que esto es una decisión del autor y no una consecuencia técnica.
