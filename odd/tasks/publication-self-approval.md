# Publicación: la excepción de auto-aprobación (`c′`)

> Plan de implementación de la política que el autor eligió el **2026-10-15**: permitir que quien pidió la publicación
> la apruebe **sólo cuando el catálogo confirme que no hay ningún otro aprobador**. Es lo que destraba el caso de una
> organización con una sola persona **sin** apagar la regla de cuatro ojos donde sí hay segunda persona.
>
> **Este documento es el plan, no el trabajo hecho.** La implementación vive en `odp-docker` (el store) y en el portal.

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
| T2 | La lectura que el portal consume — **`decidable_by_caller`, ya implementado** (`DECIDABLE_KEY` en `logic/action/publication.py:90`, el helper `_decidable_by_caller` en `:146`, estampado en la fila en `:194`); T1 11/11 y T2 23/23 en el store | `odp-docker` + `src/lib/api/publication.ts` | Test del store (la fila trae el campo) + test del portal (lo lee) |
| T3 | La ficha y la cola reflejan la respuesta en vez de decidir por su cuenta | `src/lib/components/dataset/PublicationDecision.svelte`, `PublicationQueue.svelte`, `src/routes/dataset/[id]/+page.svelte` + tests | Tests de los componentes y de la ficha: la propia **se decide** cuando la excepción aplica, y sigue sin decidirse cuando no |

## El caso de aceptación (en vivo, ya existe)

`test-pdf` (`eb8a06b6-b0da-4b7e-9d71-75a6114d2c30`), en `direccion-investigacion`, solicitud
**`d9947c1a-7bcd-4ee3-8fdf-67bd2e57feef`**: **hoy** está `pending` desde el 2026-10-08 y **nadie** puede decidirla,
porque el único miembro de esa organización es `ckan_admin` —el solicitante y a la vez sysadmin—, así que el recuento de
personas **no-sysadmin** con `capacity = admin` en esa organización es **0** y la excepción aplica.
**Lo que hay que ver en la corrida en vivo:** la fila pasa a `approved`, `requested_by` y `approved_by` quedan con **el
mismo id** (`ckan_admin`) y el dataset queda **público**. Si la respuesta fuera `Four eyes`, el recuento está contando a
un sysadmin: es **defecto del store**, y se reporta con el estado de la fila antes/después.

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
