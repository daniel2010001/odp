# Publicación: la excepción de auto-aprobación (`c′`)

> Plan de implementación de la política que el autor eligió el **2026-10-15**: permitir que quien pidió la publicación
> la apruebe **sólo cuando el catálogo confirme que no hay ningún otro aprobador**. Es lo que destraba el caso de una
> organización con una sola persona **sin** apagar la regla de cuatro ojos donde sí hay segunda persona.
>
> **Este documento es el plan, no el trabajo hecho.** La implementación vive en `odp-docker` (el store) y en el portal.

## Specs

- **S1 — La excepción.** La auto-aprobación se permite **sólo si no existe otro aprobador**: ni otro **admin de la misma
  organización** dueña del dataset (miembro `active` con `capacity = admin`), ni **otro sysadmin activo** distinto del
  solicitante. En cualquier otro caso, cuatro ojos sigue negando como hoy.
  **Contar bien a los sysadmins (medido, 2026-10-15):** la instancia de desarrollo tiene **dos** filas de sysadmin
  activas —`ckan_admin` y **`default`**, la **cuenta de sistema de CKAN**, sin credenciales usables y usada para
  contenido sin atribución—. Si `default` contara como «otro aprobador», **la excepción no aplicaría nunca** en el caso
  que viene a resolver (`test-pdf`), porque esa fila siempre existe. **La cuenta de sistema se excluye del recuento**,
  con el motivo escrito al lado.
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
4. Lo que el portal necesita para S4: **una lectura propia del store**. Dos formas, y la recomendación es la primera:
   (i) que la fila de `publication_request_list` traiga un campo calculado, por ejemplo `self_approvable: true|false`
   para quien mira; (ii) una acción de lectura aparte (`publication_request_decide_preview` o similar). Con (i) el portal
   no reimplementa la política —la lee—, que es la regla de la casa: **el portal ofrece, el catálogo decide**.
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
| T2 | La lectura que el portal consume (campo calculado en la lista, recomendado) | `odp-docker` + `src/lib/api/publication.ts` | Test del store (la fila trae el campo) + test del portal (lo lee) |
| T3 | La ficha y la cola reflejan la respuesta en vez de decidir por su cuenta | `src/lib/components/dataset/PublicationDecision.svelte`, `PublicationQueue.svelte`, `src/routes/dataset/[id]/+page.svelte` + tests | Tests de los componentes y de la ficha: la propia **se decide** cuando la excepción aplica, y sigue sin decidirse cuando no |

## El caso de aceptación (en vivo, ya existe)

`test-pdf` (`eb8a06b6-b0da-4b7e-9d71-75a6114d2c30`), en `direccion-investigacion`: **hoy** su solicitud está `pending`
desde el 2026-10-08 y **nadie** puede decidirla porque el único miembro es `ckan_admin`, que además es el solicitante y
el sysadmin. Con `c′` implementado, **esa misma solicitud** tiene que poder aprobarse desde la ficha (y la fila mostrará
el mismo id en las dos columnas). Es la comprobación de punta a punta, y sirve además para la demo.

## Riesgos y decisiones abiertas

1. **La cascada está encendida en este stack**: `ckan.ini:99` fija `ckan.auth.roles_that_cascade_to_sub_groups = admin`
   (el default de CKAN es `[admin]`, `config_declaration.yaml:584-592`). Hoy no hay ningún vínculo (0 filas de
   jerarquía), pero si alguien crea uno desde la UI de CKAN, el admin del padre **recibiría** permisos del hijo. Por eso
   la consulta de «otro aprobador» mira **membresías**, no permisos efectivos (S2, punto 2).
2. **Qué cuenta como «otro aprobador»** — a cerrar en T1: sólo `active`; sólo `capacity = admin`; sólo la organización
   **dueña actual** del dataset; sysadmins **activos** distintos del solicitante **excluyendo la cuenta de sistema
   `default`** (si no, la excepción no aplica nunca: esa fila siempre existe). Un miembro `pending`/`deleted` no cuenta.
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
