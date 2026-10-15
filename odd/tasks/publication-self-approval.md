# Publicación: la excepción de auto-aprobación (`c′`)

> Plan de implementación de la política que el autor eligió el **2026-10-15**: permitir que quien pidió la publicación
> la apruebe **sólo cuando el catálogo confirme que no hay ningún otro aprobador**. Es lo que destraba el caso de una
> organización con una sola persona **sin** apagar la regla de cuatro ojos donde sí hay segunda persona.
>
> **Este documento es el plan, no el trabajo hecho.** La implementación vive en `odp-docker` (el store) y en el portal
> (**T3 entregada en el portal el 2026-10-15**, ver L6).

## Specs

- **S1 — La excepción.** La auto-aprobación se permite **sólo si no hay otra persona de la organización que pueda
  aprobarla**: otro miembro `active` con `capacity = admin` de la **misma** organización dueña del dataset. **La
  superadministración de la plataforma no cuenta** (S1-bis), y tampoco un admin de una organización relacionada (S2).
  En cualquier otro caso, cuatro ojos sigue negando como hoy.
- **S1-bis — Por qué la superadministración NO cuenta (decisión del autor, 2026-10-15).** Contar a un sysadmin como
  «otro aprobador» **rompe el caso real**: CKAN hace al **creador** `admin` de la organización que crea
  (`ckan/logic/action/create.py:740-751`), así que el sysadmin que crea las organizaciones queda **dentro de todas
  ellas**, y entonces el admin de una organización **nunca** podría aprobarse lo suyo —tendría que aprobarlo el sysadmin
  de la plataforma, que es lo contrario de lo que se busca: un cuello de botella único y ajeno a la organización—.
  «Otra persona que puede aprobarla» significa **otra persona de la organización**, no la administración de la
  plataforma.
  **Efecto colateral bienvenido:** `default` —la cuenta de sistema, que también es sysadmin— deja de ser un problema
  **sin excluirla por nombre ni por heurística de contraseña**: se excluye por rol, que es un hecho del sistema y no un
  dato de una instancia.
  **El precio, declarado:** si en una organización hay un administrador que *además* es sysadmin de la plataforma, el
  resto de esa organización podrá auto-aprobarse aunque esa persona pudiera revisar. Es el precio de no convertir a la
  plataforma en revisora; se documenta, y se revisa si alguna vez molesta.
- **S2 — La organización relacionada NO cuenta** (decisión del autor, 2026-10-15, textual en su intención): *«la
  jerarquía de organizaciones NO es un mecanismo de permisos… no se heredan permisos, no se tienen privilegios sobre
  organizaciones hijas… esto es solo figurativo, para demostrar que hay una org a la que pertenece o tienen más org
  relacionadas… está fuera del alcance»*. La excepción **no** puede contar a un admin de una organización relacionada.
- **S3 — La traza.** Una auto-aprobación tiene que quedar **visible en los datos**: la fila guarda `requested_by` y
  `approved_by`, así que el mismo id en las dos columnas es la marca. No se inventa un campo nuevo para eso.
- **S4 — El portal no puede ocultar lo que el catálogo concede.** Con la excepción aplicando, la ficha **no** debe mostrar
  «No puede aprobar su propia solicitud» ni esconder el control: la UI tiene que poder saber que la solicitud es
  auto-aprobable (o dejar de decidirlo ella y reflejar la respuesta del catálogo).
- **S5 — Nada más cambia.** La comprobación de que el **solicitante conserve capacidad** sobre el dataset sigue igual y
  **sin excepción** (si la perdió, la solicitud queda pendiente: eso es otro desenlace, no éste). La cola, la pared y el
  flujo de solicitud quedan como están.

## Las piezas

**En el store (`odp-docker`, `ckanext-umss`)** — es la autoridad, y es donde el cambio es más chico:

1. En `logic/auth/publication.py`, `publication_request_decide` (~línea 155-215): hoy, tras la comprobación de capacidad
   del solicitante, la rama de sysadmin niega si es el solicitante y la rama normal exige `admin` de la organización y
   niega si es el solicitante. La excepción entra **antes** de las dos negativas de cuatro ojos: si `is_requester` y
   **no hay otro aprobador**, se concede.
2. **«No hay otro aprobador» hay que medirlo, no suponerlo**: una consulta de membresías (`member` con
   `table_name = 'user'`, `capacity = 'admin'`, `state = 'active'`) acotada a la organización dueña **actual** del
   dataset, más los sysadmins activos distintos del solicitante. **Ojo con la cascada de CKAN (S2)**: el predicado que
   usa el store (`has_user_permission_for_group_or_org`) **sí casca** si el vínculo existe, así que la consulta de «otro
   aprobador» **no puede** preguntar por permiso efectivo — tiene que mirar **membresías de esa organización** —, o el
   admin de una organización relacionada contaría como aprobador contra la decisión del autor.
3. **Fallo cerrado**: si la consulta no se puede hacer, **no** hay excepción (se mantiene cuatro ojos). Un error de
   datos no puede conceder una aprobación.
4. Lo que el portal necesita para S4: **una lectura propia del store**, y ya está **implementada y congelada** (T2,
   2026-10-15). **El campo es `decidable_by_caller`** (booleano), y su semántica, textual: *`true` si y sólo si
   `publication_request_decide` autorizaría a **ese** caller sobre **esa** fila **y** la fila sigue `pending`*; `false`
   si la fila ya está decidida, porque la acción la rechaza con `409 "That request is no longer pending"` —un `true`
   ahí mandaría al portal derecho a una negativa—. Devuelve, sobre la misma solicitud pendiente: el **solicitante** →
   `true` si no hay otra persona en su organización y `false` si la hay; otro `admin` de la organización, un `admin` de
   una organización relacionada o un `sysadmin` → `true`; un `editor` u otro no-aprobador → `false`.
   **Tres detalles que importan al consumirlo:** (a) el campo está en **las cuatro caras** (create, cancel, decide y
   list), así que no importa de qué acción salga la fila; (b) `requested_by` sigue en la fila, así que distinguir «soy
   el solicitante y puedo» de «puedo como tercero» es comparar dos ids, **sin segundo campo**; (c) el **costo**: en la
   lista es **una sentencia para la página entera** —medida por test, no por fila— y en una fila suelta, una sentencia
   más.
   **El nombre está congelado por los tests del store** (`DECIDABLE_KEY`, `logic/action/publication.py:90`): consumir
   otro —mi `self_approvable` original— wirea lo equivocado.
5. Etiquetas: la excepción **concede**, así que no emite etiqueta de rechazo; `FOUR_EYES_LABEL` sigue siendo el
   vocabulario del caso negado y **no** se toca. Si se quiere distinguir en la traza *por qué* se concedió, la vía es la
   fila (mismo id en `requested_by`/`approved_by`), no una etiqueta nueva.

**En el portal (`odp`)**:

6. El lugar es la tarjeta «Solicitud de publicación» de la ficha (`src/routes/dataset/[id]/+page.svelte`) y el mismo
   control compartido (`PublicationDecision.svelte`), donde hoy cuatro ojos sustituye los botones por la nota.
   El componente deja de decidir por su cuenta que «la propia no se decide»: **recibe la respuesta** (el campo calculado,
   o la pregunta al catálogo) y sólo oculta los botones cuando la excepción **no** aplica.
7. La cola (`PublicationQueue`) muestra la misma fila con la misma respuesta: si aplica la excepción, la fila propia deja
   de decir «no decidible». **Un solo dueño de la regla**: el store; el portal refleja.

## Tareas (una sesión, tres unidades)

| ID | Unidad | Dónde | Cómo se prueba |
| --- | --- | --- | --- |
| T1 | La excepción en el predicado + la consulta de «otro aprobador» (con fallo cerrado y sin contar cascada) | `odp-docker`, `ckanext-umss/logic/auth/publication.py` + sus tests | Tests del store: **dos ramas** —con otro admin en la org → cuatro ojos; sin otro admin → concede—; y un caso con **vínculo padre/hijo** que debe seguir negando (S2) |
| T2 | La lectura que el portal consume — el store la declara (`DECIDABLE_KEY` en `logic/action/publication.py:90`, el helper `_decidable_by_caller` en `:146`, estampado en la fila en `:194`; T1 11/11 y T2 23/23 **según la sesión del store, no verificado acá**). En el portal el campo viaja en la fila del catálogo (`src/lib/api/publication.ts:100`) y en lo mínimo que el control necesita (`publication-decision.ts:29`, `PublicationQueue.svelte:25`) | `odp-docker` + `src/lib/api/publication.ts`, `src/lib/components/dataset/publication-decision.ts`, `PublicationQueue.svelte` | Store: la fila trae el campo. Portal: **hecho con T3** — los tests montan filas con y sin el campo y leen su efecto |
| T3 | **Hecho en el portal (2026-10-15)**: la ficha y la cola **reflejan la respuesta** en vez de deducir que la propia no se decide | `PublicationDecision.svelte:105-116` (el campo, la guarda y la nota), `PublicationQueue.svelte:169-172` (el plegado), `src/routes/dataset/[id]/+page.svelte:143` (la copia en memoria pasa a `false` al decidir) + tests | **6 tests nuevos** (`PublicationQueue.test.ts`, `dataset-page.test.ts`): la propia **se decide** con `true` y la decisión sale, sigue sin decidirse con `false`, **sin el campo** se comporta como antes, y el plegado la abre. Los tests de cuatro ojos anteriores quedaron **verdes sin cambios** |

## El caso de aceptación (en vivo, ya existe)

`test-pdf` (`eb8a06b6-b0da-4b7e-9d71-75a6114d2c30`), en `direccion-investigacion`, solicitud
**`d9947c1a-7bcd-4ee3-8fdf-67bd2e57feef`**: **hoy** está `pending` desde el 2026-10-08 y **nadie** puede decidirla,
porque el único miembro de esa organización es `ckan_admin` —el solicitante y a la vez sysadmin—, así que el recuento de
personas **no-sysadmin** con `capacity = admin` en esa organización es **0** y la excepción aplica.
**Lo que hay que ver en la corrida en vivo:** la fila pasa a `approved`, `requested_by` y `approved_by` quedan con **el
mismo id** (`ckan_admin`) y el dataset queda **público**. Si la respuesta fuera `Four eyes`, el recuento está contando a
un sysadmin: es **defecto del store**, y se reporta con el estado de la fila antes/después.

**Corrida hecha el 2026-10-15 por el autor, desde la ficha — y con una discrepancia medida, sin reconciliar.** El
proxy registró `POST /api/3/action/publication_request_decide` → `200` a las **18:30:07** con `referer
https://odp.hs.lan/dataset/eb8a06b6-…` (esta ficha) y otra a las **18:32:14** sobre
`observatorio-de-movilidad-urbana-cochabamba` (`fcyt`). **De las dos, sólo la segunda quedó pública**: medido con
peticiones anónimas al stack vivo el 2026-10-15, `package_show?id=observatorio-…` → `200`, `private: false`; y
`package_show?id=eb8a06b6-…` —también por nombre `test-pdf`, que resuelve al mismo id— → **`403` «Access denied: User
not authorized to read package eb8a06b6-…»**, con `package_search` anónimo en **count 1** (sólo el observatorio). Si la
fila de `test-pdf` está `approved` con el mismo id en `requested_by`/`approved_by` —como la midió la sesión del store
en la base—, entonces **el dataset no quedó público**, y eso contradice el contrato del store (*«`approved` … y cambia
`private` en la misma transacción»*) y este criterio. **La aceptación NO se cierra** hasta reconciliarlo: el pedido
concreto a la sesión del store quedó en L9. **El criterio, medido como se puede medir de verdad:** `package_show`
**anónimo** → `200` y el dataset presente en `package_list`. El estado de la fila dice que el catálogo concedió; **no**
dice que el dataset sea legible, y por eso la aceptación se mide sobre el valor guardado y no sobre la fila.

**Antes de correrla, un reinicio — corregido el 2026-10-15: en este stack no hace falta.** Esta sección decía que el
contenedor de CKAN tenía que reiniciarse porque *«Python cachea los imports al arrancar»*. Medido sobre el stack vivo
por la sesión del store: `USE_DEBUGPY_FOR_DEV` **no está seteado**, así que la línea de `start_ckan_development.sh` que
agrega `--disable-reloader` no se ejecuta y `ckan run` corre **con** el reloader de Werkzeug; los banners de arranque
del servidor (17:29:42 y 17:48:42) son **posteriores** a las últimas escrituras de fuente (17:29:36 y 17:48:24), y la
extensión entra por bind mount (`./src:/srv/app/src_extensions`). El proceso **ya sirve el código final**, así que lo
único que queda de la corrida es **aprobar la fila**. La lección general sigue en pie para cualquier otro despliegue:
sin reloader, un cambio de plugin no llega al servidor vivo. **Y la fila conviene aprobarla desde la ficha del
dataset** —no por API—: así la corrida ejerce las dos mitades, el store y el portal (S4).

## Riesgos y decisiones abiertas

1. **La cascada está encendida en este stack**: `ckan.ini:99` fija `ckan.auth.roles_that_cascade_to_sub_groups = admin`
   (el default de CKAN es `[admin]`, `config_declaration.yaml:584-592`). Hoy no hay ningún vínculo (0 filas de
   jerarquía), pero si alguien crea uno desde la UI de CKAN, el admin del padre **recibiría** permisos del hijo. Por eso
   la consulta de «otro aprobador» mira **membresías**, no permisos efectivos (S2, punto 2).
2. **Qué cuenta como «otro aprobador»** — a cerrar en T1: otro miembro **`active`** con **`capacity = admin`** de la
   **misma organización dueña actual** del dataset, **excluyendo a la superadministración de la plataforma** (S1-bis: un
   sysadmin no es la organización revisándose). Un miembro `pending`/`deleted` no cuenta, y **ningún sysadmin cuenta**
   —ni `default`, ni el creador al que CKAN le puso la membresía—, así que no hace falta ninguna lista de nombres ni
   ninguna heurística sobre contraseñas.
4. **El vínculo padre/hijo no cambia el comportamiento del store, y la excepción tampoco lo usa** (resuelve una
   incoherencia que la sesión par del store detectó el 2026-10-15): el predicado del store **sigue aceptando** a un
   admin de una organización relacionada si alguien se lo pide —lo afirma su test
   `test_a_parent_org_admin_can_decide_a_child_org_request`, con la config de cascada puesta—, y **eso no se toca**: la
   excepción decide **cuándo** se permite la auto-aprobación, **no revoca la capacidad de nadie**. Lo que cambia es el
   **recuento**: la excepción sólo mira a la organización dueña, así que el admin del padre **no cuenta como segunda
   persona**. El test del store se queda como está; el test **nuevo** se llama por lo que mide —«el admin de la
   organización relacionada no cuenta como segunda persona para la excepción»— y no «sigue negando», que se leería al
   revés.
3. **Cómo quedan las organizaciones hoy (medido, 2026-10-15):** al crear una organización, CKAN hace al **creador
   miembro `admin` de ella** (`ckan/logic/action/create.py:740-751`, con `ignore_auth` porque en ese momento todavía no
   es miembro), **también si el creador es sysadmin** — así se explica que `ckan_admin` sea admin en las cinco orgs—.
   Y **4 de las 5** (`direccion-investigacion`, `fcs`, `fcyt`, `rectorado`) tienen **un solo miembro**: son las que la
   excepción destraba. `fca` tiene tres admins, y ahí cuatro ojos manda. Un sysadmin **no necesita** membresía para
   administrar cualquiera, pero la membresía **igual se crea** — así que conviene no confundir «es miembro» con «es
   aprobador por membresía» al escribir la consulta.
3. **El caso del solicitante degradado no entra acá** (S5): es otra negativa y sigue como está.
4. **Si `c′` no alcanzara** (por ejemplo, si el despliegue exige una palanca explícita y auditable), la alternativa ya
   escrita es `c″`, la flag de despliegue en `v2+`.

## Log

- **L1 (autor, 2026-10-15, textual):** *«qué tan factible es eso de "dejar que un user apruebe las solicitudes de sus
  dataset"? … si en el futuro, cuando estemos empezando con user reales, no creo que haya muchos user por org y lo mejor
  sería que ellos mismo se aprueben y listo, y si llegamos a considerar volver a habilitar esta politica de gobernanza:
  "el que la crea no puede publicarla", entonces con la flag encendía podría ser posible»*.
- **L2 (autor, 2026-10-15):** *«vamos con tu recomendación»* → **`c′`**: la excepción decidida por el dato. La flag
  (`c″`) queda en `v2+`; la flag por organización, descartada.
- **L3 (autor, 2026-10-15):** la relación entre organizaciones es **figurativa** (S2). Razones que dio, además de la
  decisión: un admin del padre decidiendo contra los admins del hijo **sobrepasa su autoridad**; la ambigüedad de qué
  manda cuando alguien es `view` en una organización y `admin` en otra; y **la relación entre organizaciones todavía no
  está aceptada para `v1`** —se tiene porque la UI de CKAN lo permite, pero la UI nueva no lo tiene hasta `v1`/`v2`—. **No
  se descartó del todo**: puede volver como `v2+`.
- **L4 (medición, 2026-10-15):** la acción del store (`publication_request_decide`) exige, en orden, capacidad **actual**
  del solicitante (sin excepción de sysadmin), cuatro ojos **sin excepción**, y ser admin de la organización dueña **o**
  sysadmin activo; `ckanext-umss/logic/auth/publication.py:155-215`.
- **L5 (medición, 2026-10-15):** CKAN **sí** tiene jerarquía y cascada (`authz.get_roles_with_permission`,
  `get_children_group_hierarchy`, la clave `roles_that_cascade_to_sub_groups` con default `[admin]`), y esta instancia
  la tiene **activa**. La decisión del proyecto es **no depender de ella**.
- **L6 (implementación del portal, 2026-10-15):** T3 entregada en `odp` (sin commitear al escribir esta línea).
  **La regla que quedó:** el control bloquea la propia **sólo** si el catálogo no concedió la excepción
  (`isOwn && item.decidable_by_caller !== true`), y el plegado de la cola abre la propia cuando el catálogo la concede.
  **Sin el campo, cuatro ojos** —una fila que no dice nada no concede nada—: ése es el fallback, y por eso el campo es
  opcional. **Lo que NO se tocó, a propósito (S5):** un `editor` o un `admin` de una organización relacionada siguen
  viendo el control y el catálogo responde —hoy con su `403`—; el permiso de la ficha (`canAdministerOrganization`) y el
  camino de pedir/cancelar quedan igual. **Lo que queda abierto:** (a) el cambio del store ya está **commiteado** en la rama `unit/publication-self-approval` de `odp-docker`
  (`21b1bb7` T1, `c260d99` T2, `5250569` T3), **sin push y sin PR** —eso lo decide el autor—, así que el campo no está
  en `master`; `unit/handoff-refresh` sigue siendo de otra unidad (wirear contra ella encontraría otra cosa); (b) la **corrida de aceptación en
  vivo** (`test-pdf`) **no se hizo**: no exige reiniciar el contenedor —medido: el reloader de Werkzeug corre; ver la corrección del caso de
  aceptación— y aprueba una fila real, así que va con el autor delante y **desde la ficha**; (c) `/dev/publication` conserva su
  propia copia de la regla de cuatro ojos (`+page.svelte:385` y `:1311`) y **no** se alineó: sus fixtures no traen el
  campo, así que la hoja no muestra la excepción. Se alinea si el autor quiere revisar la variante ahí.
- **L7 (medición, 2026-10-15):** el portal **no** consumía el campo antes de T3: `grep -rn decidable_by_caller src/` no
  devolvía nada y `PublicationDecision.svelte` decidía por comparación de ids (`isOwn`). Por eso el reporte de la
  sesión del store —«T1+T2+T3 ya están implementados»— era **inexacto en su tercera parte**: con el store concediendo,
  la ficha y la cola seguían diciendo «No puede aprobar su propia solicitud.»
- **L8 (corrección de la sesión del store, 2026-10-15):** dos correcciones a este registro, medidas por la sesión de
  `odp-docker`. **(1) El reinicio del contenedor no hace falta:** `USE_DEBUGPY_FOR_DEV` sin setear deja encendido el
  reloader de Werkzeug y los banners de arranque son posteriores a sus últimas escrituras de fuente, así que el
  proceso ya servía el código final (corregida la sección del caso de aceptación). **(2) El cambio del store no está
  en `unit/handoff-refresh`** —esa rama es de otra unidad—, pero el cambio ya **está commiteado** en
  `unit/publication-self-approval` (`21b1bb7`, `c260d99`, `5250569`), sin push y sin PR: eso lo decide el autor. Este
  registro dijo «sin commitear en el working tree» y quedó viejo en horas, porque los mensajes se cruzaron: se anota
  así, en vez de borrarlo, porque es la clase de dato que envejece solo. **El nombre del campo quedó reconfirmado de su lado:
  `decidable_by_caller`, idéntico al que consume el portal.** Su pre-flight por API no pudo autenticarse
  (`400 "Bad request: Action name not known: login"` — este CKAN no registra una acción `login`), y el valor del campo
  en la fila de aceptación no depende de esa llamada: el único miembro de `direccion-investigacion` es `ckan_admin`
  (solicitante y sysadmin), así que el recuento de otras personas es 0 y `decidable_by_caller` es `true`.
- **L9 (discrepancia medida, 2026-10-15, sin reconciliar):** la corrida de aceptación **se hizo** el 2026-10-15 —el
  autor la ejecutó desde la ficha, y la sesión del store la reconstruyó del proxy: `200` a las 18:30:07 con `referer`
  de la ficha de `test-pdf` y otro a las 18:32:14 sobre `observatorio-de-movilidad-urbana-cochabamba`—, **pero de las
  dos sólo la segunda quedó pública**. Medición propia, anónima, sobre el stack vivo
  (`localhost:8082/api/3/action/…`): el observatorio → `200`/`private: false`/`state: active`; `eb8a06b6-…` → `403`
  `Access denied: User  not authorized to read package eb8a06b6-b0da-4b7e-9d71-75a6114d2c30` (y también por el nombre
  `test-pdf`, que resuelve al mismo id); `package_search` anónimo → `count 1`, sólo el observatorio. **Hipótesis
  abiertas, en orden de lo que explicaría la contradicción:** (a) la vuelta de `private` en la acción es
  **condicional** y no ocurre en la rama que concede la excepción (defecto del store en el camino de `c′`); (b) el
  dataset se volvió a privatizar después de las 18:30; (c) la fila que se aprobó no es la de `test-pdf`. **Pedido
  concreto a la sesión del store** (tiene la base; yo no): la fila `d9947c1a-…` (`status`, `decided_at`,
  `requested_by`, `approved_by`, `dataset_id`), `package.private`/`state` de `eb8a06b6-…`, y si la vuelta de
  `private` ocurre en la misma rama que concede la excepción o es condicional. **Lo que NO se puede afirmar**: que
  la corrida pasó. La única mitad verificada de punta a punta es la del observatorio.
  **Ampliación (misma tarde):** los **tres** caminos anónimos coinciden —el proxy del portal, CKAN directo en `:5000` y
  el **listado público** (`package_list`: **17** datasets, y `test-pdf` **no** está entre ellos)—, así que no es un
  artefacto de una ruta. Y aparece una firma que **reconciliaría las dos mediciones sin postular ningún defecto**: si en
  la base `private = false` pero `package.state` es **`draft`**, el anónimo recibe `403` y el dataset no figura en el
  listado público —exactamente lo medido acá, y exactamente lo medido en este stack el 2026-09-13 («`draft` → `403`
  anónimo; ausente del `package_search` anónimo»)—, mientras que la consulta de la sesión del store («cero privados en
  esas cuatro organizaciones») también daría cero. Por eso **`package.state` no es un detalle: distingue «el store no
  volteó `private`» de «volteó, y el dataset no es legible igual»**. **Consecuencia operativa:** `test-pdf` **ya no
  sirve como caso repetible** (su solicitud está aprobada y no se vuelve a aprobar), así que una corrida nueva usa un
  dataset privado **nuevo** en una de las cuatro organizaciones de una sola persona, y se mide **anónimo**
  (`package_show` → `200` y el dataset en `package_list`), nunca por el estado de la fila.
