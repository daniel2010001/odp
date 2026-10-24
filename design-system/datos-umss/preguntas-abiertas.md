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
| Q1 | Usuarios, perfil | ¿Los perfiles de usuario son públicos? | **Decidida (2026-10-23): públicos, como CKAN.** Vista pública `/user/<nombre>`, sin correo. Medido: `user_list` anónimo responde, sin el campo `email` (sólo `email_hash`); `ckan.auth.public_user_details = true`. |
| Q2 | Todas | ¿Cómo se llama en pantalla el rol `member` de CKAN? | **Decidida (2026-10-23): «Lector».** El valor interno sigue siendo `member`. Ver `README.md` §10. |
| Q3 | Gestión de la organización | ¿Qué pasa si el último administrador de una organización se quita o cambia de rol? El PRD exige al menos uno (RF-07). | Abierta. **A verificar** si CKAN lo impide. |
| Q4 | Gestión de la organización, solicitudes | ¿Qué pasa con una solicitud de publicación pendiente si a quien la pidió lo quitan de la organización? | Abierta. |
| Q5 | Usuarios | «Bloqueado»: CKAN sólo tiene `active` / `deleted` (medido en `user_list`: campo `state`). Los estados «solo lectura» y «bloqueo total» del PRD no son nativos. ¿El prototipo muestra sólo «Activo / Bloqueado»? | Abierta. |
| Q6 | Organizaciones | El PRD dice jerarquía **figurativa, sin herencia** de permisos, pero el `ckan.ini` tiene `ckan.auth.roles_that_cascade_to_sub_groups = admin` (medido): un admin de la organización madre heredaría la administración de las hijas. Hoy no aplica porque no hay jerarquía instalada. ¿Se apaga cuando se agregue la jerarquía? | Abierta. |
| Q7 | Nueva organización | Hoy **cualquier usuario con sesión puede crear una organización**: `ckan.auth.user_create_organizations = true` (medido). El PRD la reserva al superadministrador. Es configuración de `odp-docker`. ¿Se cierra? | Abierta. |
| Q8 | Usuarios | El PRD habla de una «organización principal» (RF-02); CKAN no la tiene: un usuario es miembro de varias organizaciones, con un rol en cada una. ¿Se descarta la «principal»? | Abierta. La maqueta ya muestra varias organizaciones por usuario. |
| Q9 | Nuevo usuario | El alta nativa para un administrador de organización es `user_invite`: crea la cuenta y envía un correo para definir la contraseña (medido en el código: su autorización es la de `group_member_create`). **Requiere correo saliente**, que hoy es un valor de relleno (`CKAN_SMTP_SERVER=localhost:25`, medido). ¿Se configura un SMTP real para `v1`? | Abierta. |

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

## Lo que CKAN ofrece (para no prometer de más)

| Funcionalidad | CKAN | Medido |
|---|---|---|
| Foto de perfil | **Nativa** (`image_url`, `image_display_url`) | Sí, campos en `user_list` |
| Verificación del correo | **No existe**; sería una extensión propia | A verificar en detalle |
| Restablecer la contraseña por correo | Nativa, pero requiere SMTP (Q9) | Configuración medida |
| Quién creó un dataset | **Nativo**: `creator_user_id` y el historial de actividad | Sí, `creator_user_id` en `package_search` |
