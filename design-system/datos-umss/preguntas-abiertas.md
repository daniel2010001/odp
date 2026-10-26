# Preguntas abiertas de diseño

Las dudas que surgen al diseñar las pantallas (prototipo de la presentación y lo que siga), en un solo lugar para que
el autor las vea. Cada pregunta tiene un ID que no se reutiliza, la pantalla a la que pertenece y su estado.

- **Abierta**: falta la decisión del autor.
- **Decidida**: la decisión ya está tomada; se registra en su lugar canónico (`PRD.md` para producto, `README.md` de
  este directorio para diseño y copy) y acá queda sólo la referencia.

Toda afirmación sobre CKAN dice si fue **medida** (contra la instancia `odp-dev`, CKAN 2.12.0) o es **a verificar**.

---

## Usuarios, roles y visibilidad

| ID | Pantalla | Pregunta | Estado |
|---|---|---|---|
| Q1 | Usuarios, perfil | ¿Los perfiles de usuario son públicos? | **Decidida (2026-10-23, confirmada 2026-10-24): públicos, como CKAN.** El perfil es una vista pública `/user/<nombre>` (la ruta de CKAN), sin correo; la **administración** de usuarios sigue en el panel. Como hay portales que hacen las dos cosas, se le **pregunta al tribunal** cuál prefiere (`presentation/preguntas.md`). Medido: `user_list` anónimo responde, sin el campo `email` (sólo `email_hash`); `ckan.auth.public_user_details = true`. |
| Q2 | Todas | ¿Cómo se llama en pantalla el rol `member` de CKAN? | **Decidida (2026-10-23): «Lector».** El valor interno sigue siendo `member`. Ver `README.md` §10. |
| Q3 | Gestión de la organización | ¿Qué pasa si el último administrador de una organización se quita o cambia de rol? El PRD exige al menos uno (RF-07). | Abierta. **Medido (2026-10-24): CKAN no lo impide** — `member_delete` borra la membresía sin mirar el rol (`logic/action/delete.py`). La organización no queda inaccesible: **el superadministrador puede todo** en cualquier organización (`authz.py`, «Sys admins can do anything»). Falta decidir si el portal bloquea quitar al último administrador (RF-07) o sólo lo advierte. |
| Q4 | Gestión de la organización, solicitudes | ¿Qué pasa con una solicitud de publicación pendiente si a quien la pidió lo quitan de la organización? | **Dirección decidida (2026-10-24): resolución en cascada, no borrado.** La solicitud pendiente se cierra como **cancelada** con un motivo del sistema («el solicitante ya no pertenece a la organización»), y queda en el historial. Es la primera de una familia de casos (ver Q4b). Implementable: una acción encadenada (`chained_action`) sobre `organization_member_delete` en la extensión propia. |
| Q4b | Gestión de la organización | Un usuario deja la organización con datasets sin publicar o incompletos, y era su único editor. | Abierta, con lo medido (2026-10-24): **los datasets son de la organización, no del usuario** (`owner_org`), así que no quedan huérfanos: el administrador de la organización puede editarlos todos (en `authz.py` el permiso `admin` «allows anything for the group»), y `creator_user_id` conserva quién lo creó. Al borrar al usuario, CKAN borra sus membresías (`user_delete`). Falta decidir si el portal avisa al administrador de que quedan borradores sin editor. |
| Q5 | Usuarios | «Bloqueado»: CKAN sólo tiene `active` / `pending` / `deleted` para un usuario (campo `state`); `deleted` impide iniciar sesión y es reversible. El PRD (RF-36) pide otra cosa: un `access_status` (`accessible` / `readonly` / `locked`) **sobre las entidades** —datasets, recursos, colecciones—, no sobre las personas, y lo marca «sin equivalente, requiere extensión propia» (§7). Motivos reales de bloquear a una persona: dejó la universidad (fin de contrato, jubilación, egreso), cuenta comprometida, suspensión temporal. ¿El prototipo muestra sólo «Activo / Bloqueado» para usuarios? | Abierta. |
| Q6 | Organizaciones | El PRD dice jerarquía **figurativa, sin herencia** de permisos, pero el `ckan.ini` tiene `ckan.auth.roles_that_cascade_to_sub_groups = admin` (medido): un admin de la organización madre heredaría la administración de las hijas. Hoy no aplica porque no hay jerarquía instalada. ¿Se apaga cuando se agregue la jerarquía? | **Postergada (2026-10-24):** se verá con calma; puede adoptarse la jerarquía de CKAN o quedar **figurativa**, como un campo propio de la organización que no da permisos. |
| Q7 | Nueva organización | Hoy **cualquier usuario con sesión puede crear una organización**: `ckan.auth.user_create_organizations = true` (medido). El PRD la reserva al superadministrador. Es configuración de `odp-docker`. ¿Se cierra? | **Decidida (2026-10-24): se corrige** (`false`). **Aplicado y verificado (2026-10-24)** por la sesión de `odp-docker`: `CKAN__AUTH__USER_CREATE_ORGANIZATIONS="false"` en el `environment:` de los tres stacks (rama `fix/org-create-sysadmin-only`, commit `620fd73`, **sin push**), con el test `tests/test-org-create-policy.sh`. En vivo, con un editor no superadministrador: `organization_create` → 403; `group_create` sigue autorizado (colecciones abiertas, RF-21). |
| Q8 | Usuarios | El PRD habla de una «organización principal» (RF-02); CKAN no la tiene: un usuario es miembro de varias organizaciones, con un rol en cada una. ¿Se descarta la «principal»? | Abierta. La maqueta ya muestra varias organizaciones por usuario. |
| Q9 | Nuevo usuario | El alta nativa para un administrador de organización es `user_invite`: crea la cuenta y envía un correo para definir la contraseña (medido en el código: su autorización es la de `group_member_create`). **Requiere correo saliente**, que hoy es un valor de relleno (`CKAN_SMTP_SERVER=localhost:25`, medido). ¿Se configura un SMTP real para `v1`? | Abierta. Cómo funciona (medido en `logic/action/create.py`): el administrador indica **correo, organización y rol**; CKAN crea la cuenta en estado `pending` con un nombre de usuario aleatorio derivado del correo, **la agrega a esa organización con ese rol** y envía el correo con un enlace para definir la contraseña. **Si el correo no se puede enviar, borra la cuenta** y devuelve un error: sin SMTP, invitar no funciona. |
| Q14 | Usuarios | ¿Cuándo existe un usuario **sin organización**? Con la invitación, toda cuenta nace dentro de una. Quedan: (a) lo quitaron de su única organización (cambió de unidad o la dejó); (b) lo creó un superadministrador sin asignarle una; (c) si algún día se abre el registro público (`create_user_via_web`, hoy `false`), cualquier persona: un investigador externo que sólo arma colecciones. ¿Se muestra el caso en la maqueta? | Abierta. |
| Q15 | Usuarios | Las etiquetas de organización de la tabla de usuarios muestran la sigla; el nombre completo va hoy en `title` del navegador. ¿Un tooltip propio por etiqueta? Se puede (`$lib/components/ui/tooltip`), pero en Figma sólo se ve si se captura abierto. | **Decidida (2026-10-24): se deja para la implementación.** |

### Quién ve qué (medido en CKAN 2.12.0, configuración actual)

| Caso | Puede |
|---|---|
| Sin sesión | Ver datasets públicos, organizaciones, colecciones públicas, la lista de usuarios y sus perfiles (sin correo). |
| Con sesión, sin organización | Lo mismo; **no** crear datasets (`create_unowned_dataset = false`); **sí** crear colecciones (`user_create_groups = true`) y organizaciones (Q7). |
| Lector (`member`) de org1 | Además, leer los datasets privados de org1. |
| Editor de org1 | Además, crear, editar y borrar datasets de org1. |
| Administrador de org1 | Además, gestionar los miembros de org1 y decidir sus solicitudes de publicación. |
| Admin de org1 y lector de org2 | Cada rol vale sólo en su organización; no se combinan. |
| Superadministrador | Todo. Es una marca de la cuenta (`sysadmin`), no un rol de organización. |

Roles y permisos de CKAN: `ckan/authz.py`, `ROLE_PERMISSIONS` (`admin`, `editor`, `member`).

## Organizaciones

| ID | Pantalla | Pregunta | Estado |
|---|---|---|---|
| Q16 | Gestión de la organización | **El administrador de una organización puede borrarla** (medido por `odp-docker`, 2026-10-24): `organization_delete` pide el permiso `delete`, y el rol `admin` tiene todos; editor y lector no. `ckan.auth.user_delete_organizations = true`. El PRD no lo dice para organizaciones, pero RF-35 reserva el borrado lógico de las entidades al superadministrador. ¿Se cierra (`false`) como Q7? | **Decidida (2026-10-26): se corrige como Q7** (`false`): sólo el superadministrador borra organizaciones. Pasada a la sesión de `odp-docker` el 2026-10-26; **pendiente de aplicar y verificar** allá. |
| Q11 | Nueva organización, organizaciones | ¿Cómo se declara que una organización «es una facultad»? Propuesta: un **tipo único y excluyente** elegido de una **lista cerrada** (Rectorado, Facultad, Dirección, Instituto, Carrera, Departamento…) con un `select` al crearla — no una etiqueta, que es múltiple y libre. En CKAN es un campo propio de la organización (`extras` o un esquema con opciones); hoy el tipo se **adivina por el título** (`OrganizationCard.svelte`). ¿Quién mantiene la lista? | Abierta. |
| Q12 | Organizaciones | Con la agrupación por tipo, ¿cómo se pagina? Si se pagina la lista entera, el grupo «Rectorado» podría aparecer recién en la página 2. Propuesta: **no paginar las organizaciones** (son decenas, no miles) y, si un grupo es largo, mostrar los primeros y «Ver las 12 facultades». Dato medido: `organization_list` con todos los campos devuelve **25 como máximo** por pedido (`ckan.group_and_organization_list_all_fields_max = 25`), así que traerlas todas son varios pedidos. | Abierta. |
| Q13 | Organizaciones | La sigla («FCyT») es un campo propio, como el tipo. ¿Qué va en la URL: la sigla o el slug? El slug de CKAN (`name`) **es** la URL (`/organization/fcyt`) y sólo admite minúsculas; hoy ya coincide con la sigla en minúsculas. Propuesta: slug = sigla en minúsculas, y la sigla con su escritura («FCyT») como campo aparte para mostrar. | Abierta (de implementación). |

## Colecciones

| ID | Pantalla | Pregunta | Estado |
|---|---|---|---|
| Q10 | Colecciones, ficha de colección | ¿Qué significa «Interna» para una colección que reúne datasets de **varias** organizaciones? La maqueta la lee como «sólo la ven los usuarios con sesión»; el PRD (RF-21) lista `private`, `internal` y `public` sin definirlos para colecciones. Además, en CKAN un `group` es **siempre público**: cualquier visibilidad distinta es lógica propia. | **Decidida (2026-10-26): la visibilidad privada depende de quién cura la colección.** El autor quiere las dos cosas: que una **persona** tenga colecciones propias, «un grupo de datasets para que las pueda revisar, pero sin necesidad de publicarlo», y que las **organizaciones** también las tengan. Privada de una persona: sólo esa persona. Privada de una organización: los miembros de esa organización. Interna: cualquier usuario con sesión. Pública: cualquiera, después de la aprobación de cada organización dueña (RF-23). Factibilidad: los miembros con rol de un `group` son nativos; que una organización sea dueña de una colección y las visibilidades privada e interna son lógica propia. Aplicado en las maquetas de colecciones (`src/routes/dev/prototype/collections/data.ts`, `canSee`). |
| Q18 | Colecciones, menú, ficha de organización, panel | ¿Dónde vive la lista de colecciones? | **Decidida (2026-10-26):** en el **menú principal**, sólo las públicas y sin filtro de visibilidad; «**Colecciones que cura**» en la ficha de cada organización; «**Mis colecciones**» en el panel, que es donde va el filtro de visibilidad. |

## Versiones

| ID | Pantalla | Pregunta | Estado |
|---|---|---|---|
| Q17 | Versiones del dataset | **¿Qué es un cambio «menor»?** RF-17 dice que título, descripción y metadatos no crean versión; RF-14, que la versión la crea el usuario a propósito; RF-16, que cada aprobación o rechazo de una revisión genera una versión. Propuesta: **versión = cambio en los datos** (agregar, reemplazar o quitar un recurso); **menor = cambio en los metadatos** (título, descripción, etiquetas, licencia), que queda en el historial de actividad pero no es versión. Caso dudoso: cambiar la **licencia** o la **visibilidad** — ¿menor o versión? En CKAN, el historial de actividad guarda una copia del dataset en cada cambio (nativo); una versión con estado de aprobación propio **no es nativa** (PRD §7). | Abierta. |

## Lo que CKAN ofrece (para no prometer de más)

| Funcionalidad | CKAN | Medido |
|---|---|---|
| Foto de perfil | **Nativa** (`image_url`, `image_display_url`) | Sí, campos en `user_list` |
| Verificación del correo | **No existe**; sería una extensión propia | A verificar en detalle |
| Restablecer la contraseña por correo | Nativa, pero requiere SMTP (Q9) | Configuración medida |
| Quién creó un dataset | **Nativo**: `creator_user_id` y el historial de actividad | Sí, `creator_user_id` en `package_search` |
