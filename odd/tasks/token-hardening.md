# Endurecimiento del token: la credencial de CKAN sale del navegador

> Feature `[v1]` del `BACKLOG.md` (§ «El token de CKAN no debe ser legible por JavaScript»). Hoy el JWT vive
> en `localStorage` y el navegador lo manda en `Authorization`; la feature lo saca del navegador y deja que el
> **servidor del portal** hable con el catálogo (BFF). El autor la declaró **sesión dedicada** el 2026-10-15.
> **No entra en `v0`/la demo. Fuera de alcance, declarado:** SSO/LDAP (diferido a `v2`, RF-05), la bajada de
> nivel de publicación (`[v1]`, otra sesión) y la topología de nombres de CKAN (A vs B), que es una decisión
> de despliegue y no de este endurecimiento.

## Specs

- **S1 — El objetivo, textual del ítem:** *«El token de CKAN no debe ser legible por JavaScript»*. En `v0` era
  un trade-off aceptado, no un bug; el costo real es XSS, y el portal **renderiza contenido que viene de CKAN**
  (descripciones markdown, `url`s, nombres de recursos), con un token que dura 24 h y que además **puede acuñar
  y revocar tokens** de esa cuenta.
- **S2 — La forma de la credencial** (decisión del autor, 2026-10-15, verbatim del rótulo elegido):
  *«BFF: cookie de sesión del portal»*. El servidor del portal guarda la credencial de CKAN; el navegador sólo
  tiene una **cookie de sesión `httpOnly` del portal**, y la inyección de `Authorization` hacia
  `CKAN_INTERNAL_URL` ocurre server-side. `src/hooks.server.ts` **no existe hoy**: el punto de inyección se
  inventa en esta feature.
- **S3 — Las descargas privadas** (decisión del autor, 2026-10-15, verbatim del rótulo elegido): *«Streamear
  desde el portal (con `Range`)»*. El portal autentica contra CKAN y devuelve los bytes; el visor de PDF exige
  soporte de `Range`.
- **S4 — `ckan.auth.enable_cookie_auth_in_api = false` es consecuencia, no requisito** (textual del ítem ya
  corregido). Se apaga **cuando** el navegador ya no necesite la cookie de CKAN, no antes: `mintToken` usa
  cookie + `X-CSRFToken` para acuñar el token, así que apagarla primero rompe el login.
- **S5 — Las subidas.** Con el token fuera del navegador, el archivo ya no puede ir directo a `/api/`: pasa por
  una ruta del portal. Dos consecuencias **medidas**, no supuestas: `BODY_SIZE_LIMIT` del servicio `frontend`
  (default de adapter-node **512 KB**; al excederlo devuelve **HTTP 400 con el error de la app**, no 413 — con
  `55M` el mismo body se leyó completo), y un método **multipart** en el cliente, que hoy hardcodea
  `application/json` + `JSON.stringify`.
- **S6 — Lo construido no se rompe.** La sonda de sesión (`Invalid Session Detection`), el guardián, el aviso
  de `/auth/login?expired=1` y el logout siguen existiendo y funcionando; la sonda **cambia de dónde se
  ejecuta** (el servidor es quien tiene la credencial), no su semántica: un `5xx` o un host inalcanzable no son
  una sesión inválida.
- **S7 — La spec de autenticación es un contrato escrito y hoy contradice S1/S2.** Dos requisitos MUST cambian:
  `Session Persistence` (*«MUST persist across reloads using localStorage»*, `openspec/specs/authentication/spec.md:59`)
  y `Logout` (*«MUST revoke the CKAN token server-side and clear the client session»* + *«clears localStorage»*,
  `:104`). Se enmiendan como parte de la feature, con fecha y escenario, igual que se hizo con el ciclo de
  publicación.

## Las piezas medidas (re-medido 2026-10-15 sobre `main@2536043`)

- **11 sitios de producción** construyen cliente con `apiKey: () => get(auth).token`
  (`grep -rn "apiKey: () => get(auth).token" src/`): `src/routes/+layout.svelte` · `dashboard/+page.svelte` ·
  `dashboard/requests/+page.svelte` · `dashboard/datasets/new/+page.svelte` · `dashboard/datasets/[id]/edit/+page.svelte` ·
  `dataset/[id]/+page.svelte` (**4**) · `dataset/[id]/resource/[resourceId]/+page.svelte` (**2**).
- **12 archivos de producción** importan `$lib/stores/auth`, y **no todos leen el token**: varios leen el
  **usuario** (`UserMenu.svelte`, `session-guard.ts`, `dashboard/+page.svelte`, `auth/login/+page.svelte`,
  `PublicationDecision.svelte`, `PublicationQueue.svelte`, …). Con BFF la identidad también sale del servidor,
  así que el mismo cambio los alcanza.
- **Dos caminos asumen el token legible en el navegador:** la subida por XHR lo pone a mano
  (`src/lib/api/upload.ts:82`) y el logout lo manda en el body (`src/lib/api/auth.ts:48-56`, llamado desde
  `UserMenu.svelte`).
- **Dónde vive hoy la sesión:** `localStorage["auth"]` (`src/lib/stores/auth.ts:21,37,39`), hidratado al
  importar el módulo, **sin expiración persistida** (el TTL es del servidor:
  `src/lib/server/ckan-auth.ts`, que espeja `CKAN___EXPIRE_API_TOKEN__DEFAULT_LIFETIME` = 86 400 s).
- **El camino de login que hay que conservar:** `ckanLogin` (`src/lib/server/ckan-auth.ts:266`) hace
  web-login → CSRF de `<meta name="_csrf_token">` → `api_token_create` con cookie + `X-CSRFToken`, y el plugin
  exige `expires_in` **y** `unit`.
- **Suites ancladas al mecanismo** (se re-anclan a la interfaz nueva, no se borran): `auth.test.ts`,
  `session-guard.test.ts`, `dashboard.test.ts`, `wizard.test.ts`, `login.test.ts`, `PublicationQueue.test.ts`,
  `layout-header.test.ts`; más `client.test.ts`, `upload.test.ts` y `resource-page.test.ts`, que aseveran el
  header `Authorization` emitido **desde el navegador**.
- **No hay `svelte.config.js`**: la configuración de SvelteKit vive **dentro de `vite.config.ts`**, en el
  plugin (`sveltekit({ compilerOptions, adapter: adapter() })`, `vite.config.ts:6-19`), y `vitest` avisa «no
  Svelte config found» porque importa el plugin sin pasarle esa config. Medido: `git ls-files` no lo lista, no
  está en disco y `.gitignore` no lo oculta. **Consecuencia para esta feature: `csrf.checkOrigin` y el adapter
  se tocan ahí**, no en un archivo que no existe — y el comentario de `Dockerfile.dev:13`, que lo nombraba,
  estaba desactualizado (corregido con este plan).
- **La spec de autenticación** tiene 10 requisitos (`openspec/specs/authentication/spec.md`): Login Proxy
  `:9`, Login Success `:27`, Login Failure `:38`, Login Rate Limiting `:49`, Session Persistence `:59`,
  Invalid Session Detection `:69`, Logout `:104`, Header User Menu `:121`, Dashboard Guard `:137`,
  Super Admin Flag `:153`.

## Tasks

| ID | Unidad | Dónde | Route | Commit |
| --- | --- | --- | --- | --- |
| T1 | **Diseño** de la sesión del servidor y del anti-CSRF (decisión de forma, no de código) | `odd/tasks/token-hardening.md` § El diseño | parent | `890d184` |
| T3a | **La primitiva de sesión** (sellado AEAD): la fundación de T3, y va **antes** que T2 porque el proxy y el login la necesitan | `src/lib/server/session.ts` + `session.test.ts` | parent | — |
| T2 | El servidor del portal habla con el catálogo: `hooks.server.ts` + el proxy de acciones con **allowlist** | `src/hooks.server.ts` (nuevo), `src/routes/api/ckan/[...action]/+server.ts` | parent | — |
| T3 | El login y la sesión: la credencial entra en la sesión del servidor y el store del navegador pasa a guardar **sólo el usuario** | `src/lib/server/ckan-auth.ts`, `src/lib/stores/auth.ts` | parent | — |
| T4 | Migrar los **11 sitios** y los lectores del store a la interfaz nueva | los 7 archivos de la lista + los lectores | worker | — |
| T5 | Subida y logout por rutas del portal: multipart + `BODY_SIZE_LIMIT` | `src/lib/api/upload.ts`, `src/lib/api/auth.ts`, `src/routes/api/upload/+server.ts`, compose | parent | — |
| T6 | Descargas privadas por el portal, con `Range` | ruta de descarga del portal | parent | — |
| T7 | Re-anclar las suites al mecanismo nuevo (las 7 + las 3 que aseveran el header) | los 10 archivos de test | worker | — |
| T8 | Enmendar la spec de autenticación (S7) y **apagar** `enable_cookie_auth_in_api`, con verificación viva en el navegador | `openspec/specs/authentication/spec.md`, stack de `odp-docker`, navegador | parent | — |

## El diseño (T1)

**Forma de la sesión: cookie sellada, no store de sesiones.** El stack del portal no tiene base de datos ni
Redis, así que un store de sesiones sería infraestructura nueva para un problema que no la pide. La credencial
de CKAN viaja **cifrada y autenticada** (AEAD, AES-256-GCM) dentro de una cookie `httpOnly`, `Secure`,
`SameSite=Lax`, `Path=/`; la clave vive en una variable de entorno del servicio `frontend` (32 bytes, fuera del
repo). **El precio, declarado:** no hay revocación del lado del portal — revocar en CKAN se descubre en el
siguiente request, que es exactamente lo que hoy hace `Invalid Session Detection` —, y **rotar la clave invalida
todas las sesiones**. La cookie lleva el JWT de CKAN + el usuario: hay que medir el tamaño real contra el límite
de ~4 KB por cookie antes de darlo por bueno.

**Anti-CSRF: origen + `SameSite`, sin token de sincronización propio.** El navegador ya no tiene credencial de
CKAN, así que un request cross-site sólo puede llegar con la cookie del portal; `SameSite=Lax` la retiene en
POST cross-site y SvelteKit verifica el origen en métodos no-GET por default (`csrf.checkOrigin`) — se toca, si
alguna vez hace falta, en `vite.config.ts`, que es donde vive la config del kit. La regla que hace esto cierto:
**el proxy nunca reenvía un `Authorization` que venga del cliente** — la credencial la inyecta el servidor, y
sólo desde la sesión.

**El punto de inyección, y por qué un proxy delgado.** Un proxy de acciones con **allowlist explícita** (las
acciones que el portal usa) sobre `CKAN_INTERNAL_URL` permite que los 11 sitios sigan llamando
`POST /api/3/action/<action>`: cambia el `baseUrl` y la credencial desaparece del cliente. Sin allowlist sería
un proxy abierto al token; por eso la lista es parte del contrato y se prueba.

## Riesgos y decisiones abiertas

1. **La cookie sellada no es revocable en el portal** (declarado arriba). Si el despliegue exige cierre de
   sesión inmediato del lado portal, la forma cambia a store de sesiones y esta decisión se revisa.
2. **El proxy es superficie de seguridad**: allowlist obligatoria, y una prueba que verifique que un
   `Authorization` enviado por el cliente **no** se propaga.
3. **Tamaño de la cookie**: hay que medirlo, no estimarlo.
4. **Orden de merge**: esta rama sale de `main` sin el PR #74 de publicación. Conviene mergear #74 primero:
   las dos tocan `PublicationQueue.test.ts` (y los números de línea de `dataset/[id]/+page.svelte`).
5. **`enable_cookie_auth_in_api = false` es el último paso**, no el primero: el login lo necesita hasta que la
   sesión del portal esté funcionando (S4).
6. **No hay verificación viva sin navegador**: el cierre exige medir en el navegador que `localStorage` no
   contiene credencial y que el tráfico sale sin `Authorization` del cliente.

## Log

- **L1 (autor, 2026-10-15, textual):** *«creo qeu con esto terminamos esta feature y pasamos a lo del
  endurecimiento del login, que habíamos planificado en la anterior sesión»* — es el go de la sesión dedicada.
- **L2 (autor, 2026-10-15): las dos decisiones que abren la feature.** Descargas privadas → *«Streamear desde
  el portal (con `Range`)»*; credencial → *«BFF: cookie de sesión del portal»*. El texto de las opciones era
  **mío** (la propuesta); lo suyo es la elección.
- **L3 (autor, 2026-10-15, sesión anterior):** el ítem queda para **sesión dedicada**, *«con este mapa y este
  costo como punto de partida»*; no entra en `v0`/la demo y sigue siendo `[v1]`.
- **L4 (corrección, 2026-09-24):** el ítem viejo era **inexacto y no ejecutable**:
  `ckan.auth.disable_cookie_auth_in_api` **no existe** (grep en todo el árbol de CKAN 2.11.6: cero
  ocurrencias); la opción real es `ckan.auth.enable_cookie_auth_in_api` (`config_declaration.yaml`, default
  `True`, `ckan.ini:107` en `true`). Tal como estaba escrito, aplicarlo habría sido un **no-op silencioso**.
- **L5 (implementación, 2026-10-15): la primitiva de sesión, y el orden corregido.** T3a va **antes** de T2 porque el
  proxy y el login **necesitan** la sesión: empezar por el punto de inyección habría dejado el camino sin sustrato.
  `src/lib/server/session.ts` sella con **AES-256-GCM** (nonce nuevo en cada sello) y abre devolviendo `null` ante
  cualquier sobre que no sea suyo —sello roto, otra clave, formato o versión desconocidos, payload con otra forma, o
  vencido—, porque el camino de lectura corre en cada request y ahí un `throw` tumba la página. La clave se deriva a
  32 bytes con SHA-256 y la resuelve `resolveSessionSecret`: en desarrollo acepta una clave de desarrollo, y **fuera
  de desarrollo falla** en vez de tener un default —una clave por defecto ahí sería una sesión que cualquiera puede
  fabricar—. **El costo de la cookie, medido** (era el pendiente declarado del diseño): con un JWT de ~90 caracteres
  y un nombre con acentos el sello mide **334 caracteres** —220 bytes de JSON más 28 de nonce y tag, en base64url—
  contra un límite práctico de ~4 KB por cookie. **15 pruebas**, dos estructurales: el largo del cuerpo cae entre los
  múltiplos del base64 del payload cifrado, y el token **no** aparece ni en el valor sellado **ni** en su contenido
  decodificado.
  **Compuerta en este entorno, anotada porque cuesta un desvío descubrirlo:** `pnpm lint` aborta con «Linter process
  terminated abnormally (possibly out of memory)» —de forma intermitente, y también con un solo archivo— salvo que se
  suba el heap explícitamente: con `NODE_OPTIONS=--max-old-space-size=6144` el repo entero pasa (191 archivos, sin
  correcciones). El `pre-commit` corre biome por su cuenta y sólo encontró formato.
