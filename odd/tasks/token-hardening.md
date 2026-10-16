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
| T3a | **La primitiva de sesión** (sellado AEAD): la fundación de T3, y va **antes** que T2 porque el proxy y el login la necesitan | `src/lib/server/session.ts` + `session.test.ts` | parent | `4dae7d9` |
| T2a | El **núcleo del puente**: la allowlist de acciones y la inyección de la credencial, con la guarda que la ata al código real | `src/lib/server/ckan-proxy.ts` + `ckan-proxy.test.ts` | parent | `a638a64` |
| T2b | El **camino vivo**: la ruta que resuelve la sesión y llama al núcleo — **hecha**, en `/catalog/[...action]`; `hooks.server.ts` pasa a T4 porque hoy **nada** consume `event.locals` | `src/lib/server/ckan-bridge.ts` + `ckan-bridge.test.ts`, `src/routes/catalog/[...action]/+server.ts` | parent | `89b4ad2`, `1486e8f`, `0ebd417`, `95b951a` |
| T3 | El login y la sesión — **hecha la primera mitad**: el login **emite la cookie sellada** y el logout la mata. El **ayuno** del store del navegador (guardar sólo el usuario) va con la migración de T4, porque sacarle el token antes de migrar los sitios los rompe | `src/lib/server/session.ts` (`buildSession`), `src/routes/auth/login/+server.ts`, `src/routes/auth/logout/+server.ts` | parent | `2459d93`, `95b951a` (mitad) |
| T4a | **El cliente habla con el puente** y la identidad sale del servidor: `hooks.server.ts`, `+layout.server.ts`, el cliente del portal, los 11 sitios y los lectores del token (§ El diseño de T4, D1–D7) | ver § El diseño de T4 | worker | `b1e973d` |
| T4b | **El ayuno**: el login deja de devolver el token, el store y `localStorage` dejan de guardarlo, el logout deja de recibirlo. Va **después de T5**, porque la subida por XHR todavía lo lee | `src/lib/stores/auth.ts`, `src/lib/api/auth.ts`, rutas de login/logout | worker | (este commit) |
| T5 | La **subida** por el puente: multipart sólo para las acciones de subida, cuerpo en stream, y `BODY_SIZE_LIMIT` en el compose (§ El diseño de T5, E1–E5). El logout ya va sin token desde el servidor (L17); su cuerpo se vacía en T4b | `src/lib/server/ckan-proxy.ts`, `src/lib/server/ckan-bridge.ts`, `src/routes/catalog/[...action]/+server.ts`, `src/lib/api/upload.ts`, el asistente; compose en `odp-docker` | worker | (este commit; E5 pendiente) |
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

**Anti-CSRF: origen + `SameSite` + el verbo, sin token de sincronización propio.** El navegador ya no tiene credencial de
CKAN, así que un request cross-site sólo puede llegar con la cookie del portal; `SameSite=Lax` la retiene en
POST cross-site y SvelteKit verifica el origen en métodos no-GET por default (`csrf.checkOrigin`) — se toca, si
alguna vez hace falta, en `vite.config.ts`, que es donde vive la config del kit. La regla que hace esto cierto:
**el proxy nunca reenvía un `Authorization` que venga del cliente** — la credencial la inyecta el servidor, y
sólo desde la sesión. **Y una tercera pierna, que la auditoría del 2026-10-15 encontró que faltaba:** `Lax` **no**
frena una navegación de nivel superior, así que una página ajena puede provocar un `GET` que **sí** lleve la cookie;
por eso **el verbo lo decide el puente**: `READ_ACTIONS` marca las 11 lecturas y un mutador con `GET` se rechaza con
`405` sin llamar al catálogo. Apoyar eso en que CKAN rechace el `GET` de un mutador habría sido apoyar el anti-CSRF
en la otra punta del cable.

**El punto de inyección, y por qué un proxy delgado.** Un proxy de acciones con **allowlist explícita** (las
acciones que el portal usa) sobre `CKAN_INTERNAL_URL` permite que los 11 sitios sigan llamando
`POST /api/3/action/<action>`: cambia el `baseUrl` y la credencial desaparece del cliente. Sin allowlist sería
un proxy abierto al token; por eso la lista es parte del contrato y se prueba.

## El diseño de T4 (2026-10-16)

Decisiones de forma, mías, tomadas al leer los sitios (L15). **D1–D7 son T4a**; el ayuno es T4b.

- **D1 — La sesión se resuelve una vez por request, en `src/hooks.server.ts`.** La lógica vive en un módulo
  puro y testeable (`src/lib/server/request-session.ts`): recibe el valor de la cookie, un resolvedor de la clave
  (se llama **sólo** si hay cookie, igual que hoy) y `now`, y devuelve `{ session: BridgeSession, user:
  SessionUser | null, clearCookie: boolean }`. El hook pone `event.locals.session` y `event.locals.user`
  (tipados en `src/app.d.ts`) y, si la cookie está **muerta**, la **borra** en esa misma respuesta: así el primer
  pedido responde `401` (la señal de expulsión) y los siguientes son anónimos, en vez de un `401` eterno que
  rompería la navegación pública después de un vencimiento. `/catalog/[...action]` deja de leer la cookie y usa
  `locals.session`.
- **D2 — El usuario de la sesión lleva `sysadmin`.** `isSuperAdmin` lo lee y la sesión de hoy lo pierde:
  `SessionUser` gana `sysadmin: boolean` (`buildSession` lo copia como `user.sysadmin === true`).
- **D3 — La identidad llega del servidor.** `src/routes/+layout.server.ts` devuelve `{ sessionUser }` desde
  `locals.user` —**nunca** el token—. `+layout.svelte` hidrata el store con ese usuario **sólo en el navegador**:
  el store es un singleton de módulo, y escribirlo durante el SSR mezclaría usuarios entre requests. Tras el
  login, `invalidateAll()` vuelve a correr la carga. Hasta T4b el store **convive** con el `localStorage` de hoy;
  si los dos discrepan, manda el servidor.
- **D4 — «¿Hay sesión?» lee el usuario, no el token.** `isAuthenticated` pasa a `user !== null`; los
  `get(auth).token` que sólo preguntaban eso (las sondas de `dashboard`, `new`, `edit`, las fichas de dataset y
  de recurso, `validateStoredSession`, `resolveUnauthorized`) preguntan por el usuario. **No se sondea sin
  usuario**: `user_show {}` anónimo responde `404` y se leería como sesión muerta (medido 2026-09-20). Refrescar
  la identidad tras una sonda viva es `auth.setUser(user)`, sin token. **Queda** la lectura del token en
  `uploadEntry` (XHR de la subida): es T5.
- **D5 — El cliente del portal.** `createPortalClient()` en `src/lib/api/client.ts`: pide a
  `/catalog/<acción>` del mismo origen, **sin** `Authorization` ni opción `apiKey`. Los **11 sitios** de
  `apiKey: () => get(auth).token` lo usan. Los clientes **sin** credencial de hoy (páginas públicas contra
  `env.CKAN_URL`) **no se tocan**.
- **D6 — Un `GET` manda sus parámetros en la query.** Defecto previo, medido al leer el cliente: `request()`
  no manda cuerpo en un `GET` y tampoco arma la query, así que `publication_request_list {status}` pierde el
  filtro. El puente lee la query de un `GET`; el cliente la arma igual que el puente la consume (objetos como
  JSON, `undefined` omitido).
- **D7 — La sonda entiende el `401` del puente.** Es la señal **propia** del puente para una cookie muerta, no
  una respuesta de CKAN, así que es inequívoca: `check()` la devuelve como `dead` sin corroborar. El `404` de
  CKAN sigue con su corroboración por `status_show`.

## El diseño de T5 (2026-10-16)

- **E1 — Sin ruta nueva.** El plan decía `src/routes/api/upload/+server.ts`, pero `/api` lo intercepta el proxy
  antes de SvelteKit (L8). La subida va por el **mismo puente**: `POST /catalog/resource_create` (y
  `resource_update`) con `multipart/form-data`.
- **E2 — Multipart sólo para las acciones de subida.** `UPLOAD_ACTIONS = ["resource_create", "resource_update"]`
  en `ckan-proxy.ts`, con la misma disciplina que `READ_ACTIONS` (lista explícita y probada). El puente acepta
  `multipart/form-data` **sólo** para esas dos; para cualquier otra sigue el `415`. El anti-CSRF no se debilita:
  `multipart/form-data` es un tipo de formulario y SvelteKit (`csrf.checkOrigin`) rechaza un `POST` cross-origin
  con ese tipo, y `SameSite=Lax` retiene la cookie en un `POST` cross-site.
- **E3 — El cuerpo se reenvía en stream**, sin leerlo ni parsearlo: `fetch(url, { body: request.body, duplex:
  "half" })`, con el `Content-Type` del cliente **tal cual** (lleva el `boundary`, sin él CKAN no puede leer las
  partes) y la credencial de la sesión. Es la **única** cabecera del cliente que viaja, y sólo en este camino; el
  `Authorization` del cliente sigue sin viajar. Leerlo entero pondría un archivo de decenas de MB en la memoria
  del servidor por cada subida.
- **E4 — El cliente.** `uploadResourceFile` pide a `/catalog/resource_create` por XHR (el progreso de subida lo
  da `xhr.upload.onprogress`, que `fetch` no tiene) y **sin** `Authorization`; la opción `token` desaparece. El
  asistente deja de leer `get(auth).token` y pregunta por el usuario.
- **E5 — El límite del cuerpo.** adapter-node corta en `BODY_SIZE_LIMIT` (default **512 KB**, y responde **400**,
  no 413 —medido, S5—), así que el servicio `frontend` de **producción** necesita `BODY_SIZE_LIMIT` igual al
  máximo de recurso de CKAN. Va en el compose de `odp-docker` (pedido a esa sesión). El dev (`vite dev`) no
  aplica ese límite.

## El diseño de T4b (2026-10-16)

- **F1 — El login no devuelve el token.** `POST /auth/login` responde `{ user }` y la cookie sellada; el cliente
  (`src/lib/api/auth.ts`) devuelve el usuario y la página de login lo adopta con `auth.setUser` + `invalidateAll()`.
- **F2 — El store no tiene token.** `AuthState` pierde `token`; `auth.login(token, user)` desaparece (lo reemplaza
  `setUser`); **nada** se persiste en `localStorage`: la identidad la entrega el servidor en cada carga (D3).
- **F3 — La credencial heredada se borra.** Al cargar en el navegador, el store **elimina** `localStorage["auth"]`:
  un navegador que inició sesión antes del despliegue guarda ahí un JWT vivo hasta 24 h, legible por cualquier XSS.
  No se lee: se borra.
- **F4 — El logout no recibe token.** `logout()` del cliente manda `{}` (`UserMenu` deja de leer `get(auth).token`)
  y `POST /auth/logout` revoca **sólo** el de la sesión: el camino del cuerpo desaparece, y con él el hueco (c) de L13.
- **F5 — Prueba de cierre:** `grep -rn "\.token" src/lib/stores src/lib/api/auth.ts` y ningún `get(auth).token` en
  `src/`; y una prueba que fije que el store no escribe `localStorage` y borra la clave heredada.

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
- **L6 (implementación, 2026-10-15): el núcleo del puente, y la allowlist atada al código.** Las acciones se
  clasificaron por **sitio de llamada** —que es lo que un `grep` de nombres no resuelve—: **24** salen de la capa de
  cliente (`src/lib/api`, lo único que el navegador ejecuta) y **tres** son sólo del servidor —`api_token_create`,
  `api_token_revoke`, `api_token_list`—, y ésas quedan **declaradas como prohibidas**: con `api_token_create` en manos
  del navegador, quien alcanzara el proxy podría **acuñar tokens** de esa cuenta, que es exactamente lo que S1
  elimina. No hay `+page.server.ts` ni `+layout.server.ts`, y **ningún** módulo del servidor importa la capa de
  cliente: la separación es limpia. `src/lib/server/ckan-proxy.ts` acepta la acción **por nombre exacto** —`package` no
  es `package_show`—, devuelve `null` en vez de lanzar cuando no está permitida (la guarda vive en la misma función
  que arma la URL, así no se puede olvidar) y `upstreamHeaders` **construye** las dos cabeceras que el portal decide
  en vez de filtrar las del cliente: el `Authorization` del navegador no viaja **por construcción**, que es lo que
  hace cierto el anti-CSRF del diseño. **13 pruebas**, incluida una que **escanea `src/lib/api`** y falla si el
  navegador usa una acción que no está en la lista, o si una de tokens se colara. **Falta T2b** —la ruta y
  `hooks.server.ts`— para que el puente esté vivo.
- **L7 (deuda de la revisión, 2026-10-15):** la compuerta nativa de T3a (`review-f2582d4570d1e94f`, medium, lentes
  risk/readability/reliability) **aprobó y quedó reconocida**, con **tres avisos no bloqueantes**: `R1-001` (risk,
  `session.ts:90-94`), `R2-001` (readability, `:112-117`) y `R3-001` (reliability, `:126-135`, el único WARNING).
  Viven como deuda en el `BACKLOG` y **no reabren la revisión**: el proveedor lo dice explícito.
- **L8 (implementación, 2026-10-15): el puente vivo.** `src/lib/server/ckan-bridge.ts` resuelve el camino completo
  —sesión ya salida de la cookie sellada, guarda, credencial, reenvío y respuesta normalizada— y la ruta es un
  **adaptador** que sólo lee el entorno y la cookie (los módulos virtuales que Vitest no resuelve). **Las negativas
  devuelven sin llamar al `fetch`** —sin sesión **muerta** `401`, acción fuera de la allowlist `404`, y **no** `403`, porque el
  `404` no confirma qué acciones existen—, porque un reenvío que ya salió no se puede deshacer; la credencial viaja en
  la **cabecera** y **nunca** en la URL (importa sobre todo en un `GET`, donde los parámetros sí van en la query: un
  token en una URL termina en logs, historiales y `Referer`); y un catálogo caído es `502` con cuerpo propio, nunca un
  `200` vacío que el navegador lea como «no hay nada» ni una excepción que tumbe el request. **10 pruebas.**
  **Dos decisiones de forma, declaradas:** (a) la ruta vive en **`/catalog/<acción>`** y **no** bajo `/api`, porque
  `/api` ya es la superficie pública del catálogo —lo fija `vite.config.ts` para el desarrollo y el proxy del stack
  desplegado—, así que una ruta del portal ahí la intercepta el proxy antes de llegar a SvelteKit; el cambio del
  `baseUrl` del cliente es parte de T4; (b) **`hooks.server.ts` se mueve a T4**: hoy **ningún** camino consume
  `event.locals` —la ruta lee la cookie por su cuenta—, así que crearlo ahora sería una superficie sin consumidor.
- **L9 (implementación, 2026-10-15): el login emite la sesión, y el orden que no se puede invertir.**
  `buildSession` arma el payload del login —token, usuario ya traducido (`display_name` → `displayName`) y los dos
  instantes, con el vencimiento espejando el TTL del token— y la ruta de login **sella y setea la cookie**
  (`httpOnly`, `SameSite=Lax`, `Secure` salvo en desarrollo, donde el portal también se sirve por http). El logout la
  **mata siempre**, aunque la revocación en CKAN falle —es best-effort—, porque una cookie viva después de un logout
  seguiría llamando al catálogo a nombre del usuario; y revoca el token que venga en el cuerpo (el camino del
  navegador de hoy) **o** el de la sesión, el que exista. **La decisión de orden, declarada:** el cuerpo del login
  **sigue** llevando el token y el store del navegador lo sigue guardando **hasta T4**. Sacarlo antes de migrar los 11
  sitios al puente rompería el portal entero: el ayuno del store es la **última** pieza de la migración, no la primera.
  4 pruebas nuevas (19 en el módulo de sesión).
- **L10 (corrección del mismo día, 2026-10-15): el puente distingue **anónimo** de **sesión muerta**.** L8 decía
  «sin sesión `401`», y eso **habría roto la navegación pública** el día de la migración: las páginas públicas (`/`,
  `/search`, `/organizations`, y las fichas de dataset y de recurso cuando el dataset es público) llaman hoy al
  catálogo **sin** credencial, así que con un `401` un visitante vería un error de sesión en vez del dataset. La regla
  correcta tiene **tres** estados: `{ token }` pone la credencial; **`"anonymous"`** (sin cookie) reenvía **sin**
  `Authorization` y deja que el catálogo decida qué es público; y **`"dead"`** (hay cookie y no abre) responde `401`,
  para que el portal expulse por su camino único en vez de degradar la lectura a una vista vacía —el defecto que `v1`
  ya corrigió una vez—. Además, la ruta y el logout resuelven `SESSION_SECRET` **sólo** si hay cookie: el camino
  anónimo no puede depender de una variable obligatoria que no necesita, o un despliegue sin ella dejaría de servir lo
  público. Es el primer prerrequisito que aparece **al seguir la migración por los sitios**, y no se habría visto
  mirando el puente solo.
- **L11 (auditoría propia, 2026-10-15): el hueco de verbo.** La compuerta nativa cerró con hallazgos severos que el stop
  terminal volvió ilegibles (L12), así que revisé el diff yo. Encontré un defecto de la clase que esa revisión marca:
  **el puente reenviaba el verbo que elegía el cliente**, y `SameSite=Lax` **no** frena una navegación de nivel
  superior —una página ajena puede provocar un `GET` que sí lleve la cookie de la sesión—. Si CKAN aceptara el `GET` de
  un mutador, eso sería una escritura disparada desde otro sitio; y aunque lo rechazara, apoyar el anti-CSRF en eso es
  apoyarlo en la otra punta del cable. Corregido: **`READ_ACTIONS`** (las 11 lecturas, con la prueba que obliga a
  clasificar toda acción nueva) y **`405` sin llamar al catálogo** cuando un mutador llega con `GET`. **No puedo
  afirmar que éste fuera *el* hallazgo del proveedor** —no lo vi—, pero es un defecto real y de esa clase.
- **L12 (resultado de la compuerta nativa, 2026-10-15): stop terminal, y el switch apagado por decisión del autor.**
  Linaje `review-5c505df145964302`, **tier high** (motivo del propio proveedor: `hot_path` sobre `auth` en
  `src/routes/auth/login/+server.ts`), lentes risk/resilience/reliability. Corrieron los **tres revisores y el
  refutador** (4 corridas de modelo) y el refutador corroboró **hallazgos severos causados por el candidato**
  (`correction_required`). El STATUS ligado devolvió después un **stop terminal:
  `corrupted_or_unverifiable_authority`** —la autoridad que el proveedor acababa de escribir quedó inverificable, y su
  evaluación de reparación informa **cero** linajes y **cero** eventos—, lo que **cerró el camino a los hallazgos**: no
  son visibles desde acá. El candidato queda **sin aprobar**, y por decisión explícita del autor se apagó el switch del
  clon (`gentle-ai review mode disable --scope clone`; `clone-local: off`, reversible con `enable`) para seguir por
  política ordinaria. **Queda declarado y abierto:** existe al menos un hallazgo severo de esa compuerta que **no se
  conoce**; la corrección de L11 es una auditoría propia, **no** la corrección del proveedor. Y el stop tiene toda la
  pinta de ser **defecto de la herramienta de revisión**, no del código: vale reportarlo hacia arriba.
  **Y trae una obligación de despliegue, declarada:** `SESSION_SECRET` pasa a ser una variable **obligatoria
  fuera de desarrollo** —`resolveSessionSecret` falla en vez de tener un default, porque una clave por defecto
  sería una sesión que cualquiera fabrica—, así que el servicio `frontend` del compose **tiene que definirla** o
  el login responde `500`. **Y su declaración en `.env.example` quedó bloqueada por el arnés**: el autor la autorizó
  explícitamente, pero la política de seguridad de la herramienta impide escribir ese archivo igual —trata los
  archivos de entorno como sensibles—, así que la agrega el autor o una sesión sin ese bloqueo. Es una línea, **sin
  valor**: `SESSION_SECRET=` con el comentario de por qué es obligatoria. Del lado del stack la tiene que definir el
  servicio `frontend` del compose, en `odp-docker`: sin ella, el login responde `500`.
- **L13 (auditoría manual del diff completo, 2026-10-16, pedida por el autor):** se leyeron los seis archivos de
  producción de `2536043..HEAD` buscando el hallazgo severo de L12, que sigue **sin conocerse**: lo de abajo es lo
  que encontré yo, no la lista del proveedor. **Dos defectos y dos endurecimientos, corregidos:**
  (1) **El logout no mataba la cookie cuando fallaba la configuración.** SvelteKit **descarta** las cookies de una
  ruta que lanza —sólo las conserva ante un `Redirect` (`respond.js`, rama `catch`)—, así que con
  `CKAN_INTERNAL_URL` o `SESSION_SECRET` ausentes el `cookies.delete` nunca llegaba y la sesión sellada quedaba
  viva, contra lo que el propio comentario prometía. Ahora la cookie se borra **antes** de todo lo que puede
  lanzar, y el `500` ruidoso (el contrato que el autor dejó abierto el 2026-09-24) se **devuelve** en vez de
  lanzarse. (2) **El login acuñaba el token antes de saber si podía sellarlo:** sin `SESSION_SECRET` el `500`
  llegaba con un token de CKAN ya vivo, sin dueño y sin revocar, y cada reintento acuñaba otro. La clave se
  resuelve ahora **antes** de `handleLogin`. (3) **Cuarta pierna del anti-CSRF:** el puente rechaza con `415`, sin
  llamar al catálogo, un `POST` que no declare `application/json` — `Lax` no separa subdominios del mismo sitio y
  `checkOrigin` sólo mira los tipos de formulario, así que un `POST` **sin** `Content-Type` no pasaba por ninguna de
  las dos. RED medido (`expected 200 to be 415`), 4 pruebas. (4) `/catalog` responde con
  `Cache-Control: private, no-store` y `Vary: Cookie`: la misma URL es anónima o privada según la cookie.
  (1), (2) y (4) viven en rutas, que Vitest no resuelve (módulos virtuales): **sin RED posible**, verificados por
  lectura y por `check`; quedan para la verificación viva de T8. **Anotado y no corregido:** (a) `revokeToken`
  (`ckan-auth.ts:347`, anterior a esta rama) llama `api_token_revoke` **sin `Authorization`** —hay que medir en vivo
  si CKAN revoca algo así o es otro no-op silencioso de la familia de `BACKLOG.md:3576`—; (b) `resolveSessionSecret`
  no exige un largo mínimo a la clave; (c) mientras el cuerpo del logout traiga token, si difiere del de la sesión
  éste último no se revoca — se cierra solo en T4, cuando el cuerpo deja de llevarlo.
- **L14 (decisión del autor, 2026-10-16): la entrega en dos tiempos.** Con la rama en ~1720 líneas y 8 commits, el
  autor eligió la recomendación textual *«un PR con estos commits ya hechos y T4 en otra rama»* (*«vamos con tu
  recomendación, go»*). **Corte del primer PR:** T1, T3a, T2a, T2b, la primera mitad de T3 y la auditoría de L13 —
  la sesión sellada, el puente y el login/logout que la emiten y la matan—, que **no cambia nada visible**: ningún
  sitio del cliente usa todavía el puente y el cuerpo del login sigue llevando el token. **T4 en adelante** va en una
  rama propia, apilada sobre ésta hasta que se mergee. **`SESSION_SECRET` del stack** quedó pedida a la sesión de
  `odp-docker` (el compose es de ese repo); en el stack dev no hace falta: corre `vite dev` y usa la clave de
  desarrollo, y el `.env` de `odp` no llega al contenedor (`.dockerignore` lo excluye y sólo se montan `src/` y
  `static/`).
- **L15 (diseño de T4, 2026-10-16):** al leer los sitios aparecieron dos cosas que el plan no tenía: (1) `client.get`
  **nunca** mandó sus parámetros (D6), y (2) sin token en el navegador, la pregunta «¿hay sesión?» tiene que
  leer el **usuario**, porque sondear anónimo da `404` y se leería como sesión muerta (D4). T4 se parte en **T4a**
  (D1–D7) y **T4b** (el ayuno, después de T5, porque la subida por XHR todavía lee el token). T4a va a un
  worker por el respaldo de contexto del padre.
- **L16 (respuesta de la sesión de `odp-docker`, 2026-10-16):** `SESSION_SECRET` quedó cableada en el servicio
  `frontend` de `docker-compose.unified.yml` con `${SESSION_SECRET:?…}` —sin valor, Compose **no arranca**— y
  declarada vacía en un `.env.example` nuevo de la raíz: **PR #22 de `odp-docker`**, sin mergear (decisión del
  autor). **El valor va en `odp-docker/.env` (la raíz), no en `ckan-docker/.env`**: el compose raíz se interpola
  desde el `.env` de su carpeta. No se recreó ningún contenedor: el dev unificado no cambia, porque `vite dev`
  usa la clave de respaldo. Efecto a recordar: una variable del `.env` raíz pisa la del mismo nombre en el
  compose de CKAN incluido.
- **L17 (T4a entregada, 2026-10-16):** el worker implementó D1–D7 con RED observado en las suites nuevas
  (`request-session`, el `sysadmin` de la sesión, la query del `GET`, el cliente del portal, el `401` de la sonda y
  el store); las suites ancladas al mecanismo viejo se **re-anclaron** sin perder aserciones (en
  `resource-page.test.ts` el «manda `Authorization`» pasó a «pide a `/catalog/…` y **no** manda `Authorization`»).
  Dos de sus decisiones, aceptadas: las cookies ya emitidas **sin** `sysadmin` abren con `false` en vez de cerrarse
  todas al desplegar, y `+layout.ts` tiene que **devolver** `data` o el usuario del servidor se perdía por el camino.
  **Dos huecos que él mismo marcó y cerré yo, con RED:** (1) **el bucle por el lado del servidor**: una cookie con
  sello válido y token revocado en CKAN sobrevivía a la sonda `dead` —`auth.logout()` sólo limpia el store—, así
  que la próxima carga rehidrataba al usuario, el login lo devolvía al panel y la sonda volvía a expulsarlo;
  `endInvalidSession` y `validateStoredSession` piden ahora `/auth/logout` **antes** de navegar (`logout()` sin
  token manda `{}` y el servidor revoca el de la sesión). (2) **`classifyFailure` trataba el `401` como
  `unavailable`**, una regla escrita cuando sólo CKAN respondía; el `401` es ahora la señal propia del puente y va
  a la sonda como un `403`. **Riesgo declarado:** con una cookie presente y sin `SESSION_SECRET` fuera de desarrollo
  el hook lanza en **todo** request; el compose de `odp-docker` (L16) ya no arranca sin ella. Compuertas: 1137
  pruebas, `check` 0 errores, `lint` limpio. Quedan dos lecturas del token, las dos previstas: la subida (T5) y el
  logout del menú (T4b).
- **L18 (T5 entregada sin E5, 2026-10-16):** el worker implementó E1–E4 con 13 fallos RED antes de implementar: la
  subida va por XHR a `/catalog/resource_create` **sin** `Authorization` (desaparecen las opciones `token` y
  `baseUrl` de `uploadResourceFile`), y el puente acepta `multipart/form-data` **sólo** para `UPLOAD_ACTIONS` y
  reenvía el stream sin leerlo (`duplex: "half"`). El asistente pregunta por el usuario, no por el token. **Un
  agregado mío, con RED:** el puente reenvía también el `Content-Length` del cliente cuando es un entero; sin él
  el stream sale `chunked`, y un WSGI que no acepte cuerpos `chunked` lo leería **vacío**. **No medido todavía y
  pendiente para T8:** que el stream y ese `Content-Length` lleguen bien a CKAN a través de `undici` (sólo está
  probado con un `fetch` de mentira). **E5 (`BODY_SIZE_LIMIT`) sigue pedido a `odp-docker`.** Compuertas: 1151
  pruebas, `check` 0 errores, `lint` limpio. La única lectura del token que queda es el logout del menú (T4b).
- **L19 (T4b entregada, 2026-10-16): el navegador ya no tiene el token.** El worker implementó F1–F5 con 8 fallos RED
  antes de implementar: el login responde `{ user }`, el store perdió `token`, `login()` y toda escritura en
  `localStorage`, la clave heredada `auth` se **borra sin leerse** al cargar, y el logout ya no recibe token: revoca
  el de la sesión (cierra el hueco (c) de L13). Las aserciones que sólo probaban la persistencia del token se
  **reemplazaron** por las de F2/F3, declaradas una por una en su informe. Su desvío, aceptado: si CKAN respondiera
  `200` sin token o sin usuario, el login devuelve un `500` propio en vez de reenviar un cuerpo que podría llevar la
  credencial. **Un agregado mío, sin RED posible (ruta):** el login exige `application/json` (`415` si no), por la
  misma razón que el puente: sin `Content-Type` no hay preflight ni `checkOrigin`, y otra página del mismo sitio
  podría iniciar sesión en el navegador de la víctima con una cuenta ajena (CSRF de login). Compuertas: 1152
  pruebas, `check` 0 errores, `lint` limpio; `grep -rn "get(auth).token" src` → 0. **Queda para T8:** la spec de
  autenticación (S7) todavía dice `localStorage`, y las rutas se verifican en vivo.
- **L20 (E5 resuelto del lado de `odp-docker`, 2026-10-16):** **PR #23 de `odp-docker`** (sin mergear; el #22 de
  `SESSION_SECRET` ya está mergeado). `BODY_SIZE_LIMIT: 55M` en el `frontend` de producción —los 50 MB por recurso
  de RF-12 más el overhead del multipart, el mismo límite que `/api/`—, por debajo de los **100 MB efectivos** de
  CKAN (`CKAN_MAX_UPLOAD_SIZE_MB=100` pisa `ckan.max_resource_size = 10`; medido en vivo). **Y un hallazgo que
  rompía T5 sin que lo viéramos:** `/catalog/` no tenía límite propio en `frontend-proxy` y caía en `location /`,
  con el default de nginx de **1 MB**, así que toda subida de más de 1 MB habría muerto en `413` antes de llegar al
  portal. Ahora hay un `location /catalog/` con `55M`, en prod y en dev (dev recargado con `nginx -s reload`, sin
  recrear contenedores); `location /` sigue en 1 MB a propósito. Medido en dev: 2 MB y 54 MB a `/catalog/` llegan al
  portal, 56 MB da `413`, 2 MB a `/` sigue en `413`. **Regla que queda:** toda subida del portal va bajo `/catalog/`.
