# BACKLOG — Pendientes y para-futuro de ODP

> Fuente **única y canónica** de pendientes del portal (Plataforma de Datos Abiertos UMSS).
> Cualquier cosa que quede "para después" en una sesión se anota acá antes de cerrar; no se
> deja solo en memoria de sesión. Al cerrar un ítem, **borralo del backlog** (git conserva el
> historial); al arrancar un cambio SDD, movelo a `openspec/changes/`.
>
> Al verificar tier, **cruzar etiqueta contra sección en las dos direcciones**: un ítem dentro de una sección de tier
> puede llevar otro tag, y **un ítem con tag de tier puede vivir fuera de las secciones de tier**.
> Convención de estado: `[ ]` abierto · `[~]` a medias · `[x]` hecho (se elimina al commitear).
>
> **Convención de tier:** `[v0]` core presentable · `[v1]` producto usable en producción ·
> `[v1+]` diferido de v1 o conveniente sin ser requerimiento · `[v2+]` mejora futura no
> solicitada. Definición completa de los tiers y su criterio de salida: `PRD.md` §3.
>
> **Arquitectura vigente:** CKAN como backend **headless** (sólo su API REST). El portal
> SvelteKit es dueño de toda la interfaz, incluida la administración. El UI web nativo de CKAN
> se acepta únicamente como muleta operativa durante `v0`. Ver `PRD.md` §3, §7 y §10.

## Revisión del autor (2026-10-05) — lo corregido y lo que queda

> De la revisión del portal corriendo, con **capturas propias** (el agente renderizó y miró las páginas): el
> 404, el dataset inexistente, el hero, la card del dashboard y las hojas `/dev`. Expediente:
> `odd/tasks/error-surfaces.md`.

**Corregido y verificado** (229/229 tests, `check` 0 errores, Biome 0):

- **Una sola página de error en todas las superficies.** La página del dataset y la del recurso usaban un
  **bloque propio viejo**; ahora renderizan `ErrorPage`, con el **copy honesto intacto** (los tests no se
  editaron: cambió el dibujo, no el texto).
- **El medallón del ícono estaba desalineado** (`flex size-16` sin `mx-auto` en una card que no es flex): es lo
  que se veía «raro». Centrado.
- **El diagnóstico de desarrollo estaba en inglés** (`Not Found`, `Access denied`): ahora dice el estado y la ruta
  **en español** y cita el mensaje del framework rotulado como suyo.

**Decisión tomada por el autor:** la **ambigüedad del 403 se mantiene** para el espectador sin sesión (no se
revela que el recurso existe); lo que se unificó es el diseño.

**Corrección de una promesa mía, declarada:** la opción elegida decía «y el estado HTTP deja de ser 200». **No es
viable a este costo**: `/dataset/privado` responde 200 porque el servidor devuelve el **armazón de la SPA** (el
HTML del servidor no trae el texto) y la carga ocurre en el navegador; moverla al servidor choca con que **el
token de sesión vive en el navegador** (la cookie `httpOnly` sigue pendiente). El 200 **se queda** y es una
propiedad de la arquitectura, no un defecto de esa página.

**Queda, en orden:**

1. **La aprobación del copy de los cuatro estados de negativa** del formulario de edición (propuesta del agente:
   `extras`, `version`, `noPermission`, `permissionUnknown`).
2. **Los playgrounds de botones**, con interruptor de variantes: el **hero** del dataset (hoy `[copiar enlace]
   [título] [Editar]` en una fila; la hoja prescribe acciones a la derecha, con los metadatos a la izquierda) y la
   **card del dashboard** (hoy el botón «Editar» es hermano del enlace de la card — no puede anidarse, es HTML
   inválido— y se ve forzado: variantes de ícono, menú, columna de acciones o acción al pasar el mouse).
3. **Las demos de decisión**: las tres salidas del *scroll snapping* y las dos formas del `Tooltip` de los tags,
   en una hoja con interruptor.

## Barrido de pulido de UI (sesión paralela, 2026-10-03) — qué tomó y cómo cerró

> **Mergeado a `main` el 2026-10-04** (`d334c3f`), con la rama y el worktree retirados: **ya no hay una segunda
> línea en este clone**. Del barrido sigue parqueado lo mismo, y son los dos únicos ítems de esta sección que
> esperan una decisión del autor: el *scroll snapping* del buscador y los tags cortados de la card.
>
> **Las 1987 líneas entraron revisadas, por unidad**, las tres aprobadas y con la autoridad quemada:
> `review-236918db1f135803` (Biome, 5 archivos) · `review-44dbd42660f4154f` (la hoja `/dev/error` y su
> instrumento, 9 archivos) · `review-7ad1e9b391960117` (la página de error promovida, 3 archivos). Verificado
> sobre el árbol mergeado: **858/858 tests**, `svelte-check` **0 errores** / 4 warnings preexistentes, y
> `biome check` sobre los 14 archivos del merge **exit 0** (el `pnpm lint` del repo entero no corre: aborto
> transitorio 254 en 4/4 intentos). **Cuatro hallazgos informativos**, ninguno bloqueante: van en el ítem de
> abajo. El detalle completo está en `odd/tasks/merge-ui-polish-sweep.md`.
>
> **Pusheado el 2026-10-04** (`fa9a886` → `origin/main`, rango `42711a2..fa9a886`): **46 commits**, y **CI verde**
> (job `ci`, run `37224581891` — lint, typecheck y suite). Con eso **se cierra la incógnita del `pnpm lint` del
> repo entero**, que acá no se podía verificar por el aborto transitorio 254: en un runner limpio **pasa**, así
> que el 254 es de esta máquina, no del código.

> El **estado de cierre de la línea de datasets**, con las reglas para dos sesiones en este clone, está justo más abajo.

> Sesión `01a102a7-0f94-76b7-86fb-55c8c3d88023`, en un **worktree propio** (`~/projects/odp-ui-polish`,
> rama `feat/ui-polish-sweep`, base `9bf844a`) para no competir por el índice ni el `HEAD` con la sesión que
> trabaja la ruta de edición y borrado de datasets. Reparto declarado: esta sesión **no toca**
> `src/lib/components/datasets/**`, `src/routes/dashboard/datasets/**` ni `src/routes/dataset/**`.
>
> **Ítems tomados, con el go del autor (2026-10-03):** los 11 diagnósticos de Biome · el pulido visual de las
> páginas de error · el *scroll snapping* del buscador · los tags cortados de la card de dataset.
> **Cerrados:** los dos primeros (`034ac61`, `5cc46c4`, `db63617`). **Parqueados con su decisión escrita:**
> el *snapping* —que la lista de resultados **no tenga contenedor de scroll** fuerza la elección entre
> `proximity`, `mandatory` o un contenedor anidado: ver el ítem del `[v1]` del buscador— y los tags cortados
> —el `TooltipTrigger` de bits-ui es un primitivo de botón y la card entera es un enlace: ver ese `[v0]`—.
> El plan, la evidencia y el handoff viven en `odd/tasks/ui-polish-sweep.md`.
>
> **La decisión del autor que desbloquea el resto:** las dos de los ítems parqueados —dónde vive el *snapping* y
> cuál es el disparador del `Tooltip`—. El push, el merge y el contraste del botón oscuro ya están en la lista de
> arriba: no se repiten acá.
>
> **Nota de durabilidad, cumplida:** el análisis de esos dos ítems **dejó de depender de la rama al mergear**
> (`d334c3f`), así que ahora es durable por estar acá. Los dos hallazgos ya tenían copia propia desde antes: son la
> sección «Anotado el 2026-10-03 — hallazgos de la sesión paralela de pulido de UI, traídos a `main`».

## Estado al cierre (2026-10-03, noche) — handoff: la edición de datasets cerrada, y DOS sesiones en este clone

> **`main` = `d2f53ce` + este commit, 29 commits sin pushear, árbol limpio.** Suite **806/806** (52 archivos) ·
> `svelte-check` 0 errores / 4 warnings preexistentes · Biome exit 0 · un solo worktree · stack en su línea
> base (17 datasets). Después de este handoff entraron **dos commits más de documentación**: la **convención
> para dos sesiones en este repo** (`AGENTS.md`) y su corrección —el conflicto entre sesiones es de
> **anclaje**, no de contenido—, las dos sin compuerta a propósito.
>
> **Catorce compuertas con autoridad quemada** sobre la rebanada 1b-B1 (9 unidades) y su cola (5 más): cada
> recibo y cada lección viven en `openspec/changes/2026-10-02-dataset-edit-and-delete/apply-progress.md`.
> La edición de datasets **funciona de punta a punta**: se entra por el botón «Editar» del dashboard o de la
> página del dataset, se guarda con `package_revise` y el resumen se escribe **de verdad** (medido por efecto:
> resumen en su lugar, extras ajenos intactos, recursos intactos, conflicto = aviso sin pisar).

### Primero: HAY DOS SESIONES EN ESTE CLONE

> **Resuelto el 2026-10-04:** la segunda línea (`feat/ui-polish-sweep`) **se mergeó a `main`** en `d334c3f`, y su
> rama y su worktree se retiraron. **Hoy hay una sola sesión y un solo worktree.** Lo de abajo queda como el
> registro de cómo se convivió, y **las tres reglas siguen valiendo para la próxima vez**.

Es lo que más convenía saber antes de tocar nada, porque no estaba escrito en ningún otro lado del repo.

- **Esta línea** (`main`, worktree `~/projects/odp`): el módulo de edición/borrado de datasets. Alcance
  reservado: `src/routes/dashboard/datasets/**`, `src/lib/components/datasets/**`, `src/routes/dataset/**`,
  `src/lib/utils/dataset-payload.*`, `src/lib/api/datasets.*`, `src/lib/components/form/TagsInput.svelte` y
  `openspec/changes/2026-10-02-dataset-edit-and-delete/**`.
- **La otra línea** (worktree `~/projects/odp-ui-polish`, rama `feat/ui-polish-sweep`, **10 commits encima de
  `ab4dd36`, sin pushear**): el barrido de pulido de UI. Alcance suyo: `src/routes/search/**` y
  `src/lib/components/search/**`. **Nada de lo suyo escribe en CKAN.**
- **Tres reglas que costaron aprender, y valen para cualquier par de sesiones:**
  1. **Un solo dueño por archivo** — `BACKLOG.md` es el punto de colisión clásico.
  2. **El hallazgo compartido vive en la copia durable y con el MÍNIMO para actuar**, no con el más completo:
     lo que tiene que estar en `main` es el **ítem**, no el detalle; el detalle viaja con la rama y converge
     en el merge.
  3. **Git detecta conflictos de texto, no duplicados semánticos.** El mismo hallazgo anotado dos veces pasó
     un rebase **sin un solo ruido**. Si al mergear aparece conflicto en la sección de hallazgos de la sesión
     paralela, la resolución correcta es **una sola copia** (la de `main` con las adiciones de la rama encima)
     y **nunca** «quedarse con los dos lados», que recrea el duplicado.
- **Entorno, para no volver a tropezar:** el portal se ve en **`http://localhost:8082`** (contenedor
  `frontend-proxy`); el 5173 del contenedor es interno y no está publicado; el contenedor monta **sólo**
  `src/` y `static/` de este worktree, así que **la UI de la otra rama no se ve** salvo que se monte en otro
  contenedor. Un `vite dev` **de host** sí es legítimo para **medir** un worktree no montado —estilos
  computados y comportamiento que jsdom no reproduce, como el *scroll snapping*— con la regla de que sea
  **efímero**. Detalle en `AGENTS.md`.
- **El stack de CKAN es compartido**: un catálogo y una base. Los datasets descartables se purgan y la
  limpieza se verifica **por efecto** (el conteo, no la respuesta de éxito).

### Para el autor (decisiones suyas; ninguna bloquea)

1. ~~**El push**~~ — **hecho el 2026-10-04**: el sha, el rango y el resultado de CI están en la nota del barrido
   de UI, arriba. «26 commits locales» era el estado de *esa* noche; al pushear eran **46**.
2. **El linaje atascado** `review-6b517157db5f4274`: inmutable en `correction_required`, autoridad sin
   consumir. Su corrección no se pudo admitir en ese linaje —commitearla rompe los artefactos, dejarla sin
   commitear la oculta— y el contenido corregido se aprobó y quemó en una **transacción nueva**. Abandonarlo
   con la operación auditada, o dejarlo.
3. **La revisión en el navegador de los puntos de entrada**: el botón «Editar» ya existe. El copy de los
   cuatro estados de negativa es **propuesta del agente**, y la regla 8 dice que la interfaz la aprueba el
   autor.
4. **El contraste del botón primario en modo oscuro** (ítem abajo): **3.73:1** contra la regla 7
   (`AGENTS.md:35`, ≥ 4.5:1), portal-wide y preexistente. El arreglo son **tokens** en `src/app.css`.
5. ~~**El merge de `feat/ui-polish-sweep`**~~ — **hecho el 2026-10-04**: merge limpio, **sin un solo conflicto**
   (`d334c3f`), con la rama y el worktree retirados. Con eso, **el push** pasa a ser el pendiente principal: son
   **44 commits** locales, ninguno subido.

### Para la sesión siguiente (trabajo, no decisiones)

1. **Slice 2 (recursos)** del cambio en curso: metadatos por recurso, reemplazo de archivo con SHA-256 en el
   navegador y motivo obligatorio, y la lista de recursos propia de la edición (1b.8). **Construir las
   escrituras sobre la forma medida** —`design.md`, «The write shape, corrected by measurement»: `filter` +
   listas completas— y **nunca** sobre el patrón que el plan de la rebanada 1b asumía.
2. **La receta del ciclo de compuerta** (en `apply-progress.md`, «Operational lessons»): `inspect` → `START`
   **con `baseRef` explícito al commit padre** (sin él, el candidato son las 27 rutas de toda la sesión) →
   `STATUS` → captura (el primer intento devuelve **pronóstico** y no corre nada: se reenvía el mismo binding
   con `reviewerRunAcknowledged: true`) → acuse. **Las llamadas de la compuerta van directas, nunca dentro de
   `codemode`** (dos timeouts las cancelaron). **El sobre de consentimiento caduca a los 10 minutos.**
3. **La primera compuerta de esa sesión cubre el delta de documentación de este cierre** (estos commits de
   registro quedaron sin compuerta a propósito: registrar el resultado de una compuerta es documentación).
4. **Los pendientes técnicos** de la sección de abajo: el más barato y con más retorno es el `response.json()`
   sin guarda en `client.ts`.

## Anotado el 2026-10-03 — el bloque de edición de datasets cerró, y esto queda para después

Lo que salió del cierre de la rebanada 1b-B1 (el detalle y la evidencia viven en
`openspec/changes/2026-10-02-dataset-edit-and-delete/`). Son cosas **encontradas** durante ese trabajo, no
pedidos nuevos.

- [ ] **[v1]** **`client.ts` traga el cuerpo del error cuando no es JSON.** `await response.json()` sin guarda:
  un 409 con cuerpo no-JSON (HTML de un proxy o de un balanceador) lanza `SyntaxError`, se re-lanza como
  `CkanApiError(…, 0)` y **pierde el status**. Un conflicto real se reporta así como fallo de transporte. No
  hay pérdida de datos —la escritura no ocurre— pero clasifica mal en silencio, que es la dirección que este
  proyecto no acepta.
- [ ] **[v1]** **`CkanPackage` no declara `owner_org`.** La ruta de edición lo lee por un cast, con respaldo en
  `organization.id`. El arreglo honesto es un campo en `src/lib/types/ckan.ts`.
- [ ] **[v1+]** **`datasetApi.revise` acepta un payload armado a mano.** Nada obliga a un llamador a pasar por
  `buildRevisePayload`, así que la disciplina del que llama es lo único que mantiene a la ruta de edición en
  el camino verificado — la misma forma de agujero que una compuerta castigó un nivel más abajo. Endurecerlo
  sería que `revise` reciba el paquete crudo (o directamente el resultado del builder).
- [ ] **[v1]** **El cambio `2026-09-13-publication-lifecycle` está medido sobre CKAN 2.11.6 y el stack corre
  2.12.0.** Su diseño manda sondear la tabla `package_extra`, que en 2.12 **ya no existe** (`extras` pasó a
  una columna `jsonb`). Si ese cambio se retoma, sus premisas hay que re-medirlas antes de confiar en ellas.
- [ ] **[v1]** **La carga de la ruta de edición es estado coordinado a mano** (ocho banderas más un contador de
  generación) y cuatro revisiones consecutivas le encontraron un defecto cada una, dos de ellos introducidos
  por el arreglo anterior. Además su estado **no es testeable desde la página**: los guards de solapamiento
  corren con el formulario desmontado, así que ninguna aserción de DOM distingue guardado de no guardado (dos
  avisos de `review-dfab596fdb93734a`). El arreglo es **extraer la carga a una unidad testeable** o colapsar
  las banderas en un estado único — **no** agregar más aserciones.
- [x] **[v1]** **Los puntos de entrada a la edición** — cerrados en `8ebae13`: el botón «Editar» en la
  fila del dashboard y en la página del dataset, con la pregunta de permiso en **una sola llamada por página**
  y fallando cerrado. Queda **la revisión del autor** en el navegador (ver arriba).

## Anotado el 2026-10-03 — hallazgos de la sesión paralela de pulido de UI, traídos a `main`

La sesión paralela (`feat/ui-polish-sweep`, sobre `9bf844a`) llevaba sus propios ítems en su rama, y **esa rama
todavía no está mergeada**. Sus hallazgos no podían vivir sólo ahí, así que acá va la copia durable. Cuando esa
rama se rebaseó sobre este `main`, su duplicado se borró y **el registro de medición se consolidó acá**: esta
sección es ahora la única copia, y por eso lleva el detalle y no sólo el resumen.

- [ ] **[v1]** **El botón primario en modo oscuro incumple la regla 7.** `AGENTS.md:35` exige contraste de
  texto **≥ 4.5:1**, y el par `--primary` / `--primary-foreground` del bloque `.dark` de `src/app.css` mide
  **3.73:1** (`oklch(0.6 0.1 257)` sobre `oklch(0.98 0.002 250)`). Es **portal-wide y preexistente**, y el
  arreglo son tokens en `src/app.css` —bajar la luminosidad del `--primary` oscuro, cambiar su
  `--primary-foreground`, o ambos—, así que la decisión es del autor y no de una sesión. Reproducir:
  `/dev/error?theme=oscuro`, que imprime primer plano, fondo efectivo, ratio, umbral y veredicto por elemento.
  **Cuidado con leer los números sueltos:** el encabezado del mismo bloque mide ~3.71 y **sí pasa**, porque es
  texto grande (umbral 3:1); el rótulo del botón es de 14 px (umbral 4.5:1). «3.71 pasa y 3.73 falla» no es
  arbitrario: es el tamaño del texto.
  *Tres caminos independientes dan el mismo veredicto:* el instrumento de la sesión paralela medido en el
  navegador sobre el nodo real (**3.72**), su cálculo puro sobre los tokens (**3.733**) y este recomputo
  (**3.733**); en modo claro los tres dan **5.284** y **pasa**, que es el control de que el cálculo no está
  sesgado hacia abajo. **La diferencia de 0,01 no es discrepancia: es resolución de canal** — el navegador
  serializa el color a hex de 8 bits (`#5882bb`) y el cálculo puro usa el `oklch` de precisión completa.
  Quien compare 3.72 con 3.733 sin saberlo va a sospechar de la medición en vez del token.
- [ ] **[v1+]** **`pnpm lint` sale con 254 de forma transitoria.** Medido por la sesión paralela; **no lo
  reproduje acá**. Es ruido de herramienta, no del código: `biome check` sobre archivos concretos sale 0.
  La medición: `pnpm exec biome check .` falló **dos veces seguidas** con `Linter process terminated abnormally`
  y después dio **12/12 corridas con exit 0** por la misma vía y con el mismo binario; `which pnpm` es el binario
  real de mise, sin wrapper, sin alias y sin hooks, así que **no es un proxy ni falta de memoria**.
  Consecuencia práctica: **la compuerta sirve**, pero ante el 254 hay que **reintentar**, no leerlo como fallo del
  código. Baseline limpio medido ese día: **0 warnings / 0 infos** sobre 155 archivos.
  **Re-medido el 2026-10-04 sobre el árbol mergeado:** 4/4 intentos con exit 254 y **ningún conteo emitido**, así
  que `pnpm lint` sobre el repo entero quedó **no verificable**; **acotado a los 14 archivos del merge: exit 0**.
  La lección operativa es que la salida barata existe y es acotar, no reintentar en vano.
- [ ] **[v1+]** **Cuatro hallazgos informativos de las compuertas del barrido.** Ninguno bloqueante, ninguno abre
  corrección, ninguno fue causa de este merge — son trabajo posterior: `R3-001`/`R3-002` (WARNING) y `R3-003`
  (SUGGESTION) en `src/routes/dev/error/+page.svelte`, y `R3-001` (SUGGESTION) en
  `src/lib/components/error/ErrorPage.svelte`. **Aviso medido:** el sobre de cierre **no trae el texto del
  hallazgo** (sólo id, lente, ubicación, severidad), y el acuse **borra** el `review-state.json` donde sí estaba;
  acusé antes de leerlo, así que de las cuatro quedan la coordenada y las líneas transcriptas en
  `odd/tasks/merge-ui-polish-sweep.md`. **Para la próxima compuerta: leer el estado entre el cierre y el acuse.**

## Estado al cierre (2026-10-02) — handoff: el módulo de edición y borrado de datasets, en curso (SDD)

> **`main` = `306e80b` = `origin/main`, 0 sin pushear, árbol limpio.** `pnpm test` **739/739** (50 archivos) ·
> `svelte-check` 0 errores / 4 warnings preexistentes · Biome exit 0 · un solo worktree · ramas: `main` y
> `wip/pr2-directo-publicacion` (la aparcada a propósito).
>
> **Cambio SDD en curso:** `openspec/changes/2026-10-02-dataset-edit-and-delete/` — el primer módulo nuevo que
> elegiste: **editar y borrar datasets** con la API nativa de CKAN (después organizaciones, después usuarios).
> Sus artefactos son la fuente de verdad y están **todos escritos**: `explore.md`, `proposal.md`, `design.md`,
> `specs/dataset-editing/spec.md`, `tasks.md` y `apply-progress.md`.
>
> **Cerrado y gateado — cinco rebanadas, siete recibos, todos aprobados y con autoridad quemada:**
> - **1a (`d6c693c`)** — extraer el formulario del asistente a `DatasetForm.svelte` con prop de modo, **sin
>   cambiar comportamiento**: los 30 tests del asistente pasan con el archivo **byte a byte idéntico**, y una
>   **creación real** contra CKAN (dataset descartable + recurso, purgado, base 21 → 20) lo verificó en vivo.
>   Recibo `review-ff8d537a39fa1a81`.
> - **1b‑A (`2a7cc51`, `67f6998`)** — el payload parcial de edición y el wrapper `revise`: `match` con el
>   `metadata_modified` cargado (compare‑and‑set) y `update` con **sólo** los campos del formulario; el
>   `summary` por clave aplanada contra su índice (los extras ajenos sobreviven por construcción); y **borrar
>   escribe `""`**, porque omitir una clave en `package_revise` significa «dejá el valor actual». Recibos
>   `review-4542f91dce1819a4` y `review-5b851d86ae1bc07c`.
> - **1b‑B0 (`c69a91d`, `f74a51a`)** — el modo edición del formulario (prefijado con `untrack`, slug fijo con
>   «Desbloquear», organización como hecho, «Guardar cambios») y su **test de contrato** (10 tests), que cierra
>   el aviso que la 1a había dejado. Recibos `review-9ce0dea883d3ddb9` y `review-ab686f565730b0f9` (**0
>   hallazgos**).
>
> **Lo primero de la próxima sesión — 1b‑B1, la ruta de edición** (`/dashboard/datasets/[id]/edit`):
> cargar el dataset y **construir el `LoadedDataset` con el chequeo explícito de extras** (tarea 1b.6: si el
> paquete no devuelve `extras` como arreglo, negarse honestamente en vez de sustituir `[]`, que
> reintroduciría el duplicado del resumen); pasar `owner_org` **y** el objeto de la organización (1b.7); la
> **pregunta de permiso que falla cerrada** (`organization_list_for_user(permission="update_dataset")` contra
> `owner_org`, tres estados: puede / no puede / la pregunta falló); guardar por `package_revise`; y el **aviso
> de conflicto** cuando CKAN rechaza por el `match`. Después **1b‑B2** (la fila del dashboard y la página del
> dataset como entradas) y **la rebanada 2** (recursos: metadatos y **reemplazo de archivo** con SHA‑256
> calculado **en el navegador** y motivo obligatorio), que trae además la lista de recursos propia de la
> edición que hoy falta (1b.8).
>
> **Decisiones ya tomadas — no volver a preguntarlas:** quien borra es **editor o admin de la organización**
> (convención de CKAN, porque el PRD no lo fija); borrado **lógico** (`state='deleted'`), **sin deshacer en el
> portal** y con **el slug que queda tomado**; **sin** cambios de visibilidad (son del flujo de solicitudes);
> **sin** purga ni deshacer (feature aparte, más adelante); el formulario es **un componente con modo**;
> concurrencia = **compare‑and‑set + aviso, sin bloqueo y con el multi‑editor excluido a propósito**. Y de la
> otra feature: para el `R3-001` del vacío del buscador, **el ancla se conserva sólo mientras su destino
> exista** (queda implementarlo, pero es de ese cambio, no de éste).
>
> **Tres cosas medidas que ahorran tiempo la próxima vez:** (1) `ckan.auth.allow_dataset_collaborators` está
> **sin definir** en este stack, así que los colaboradores nativos están apagados y la limitación que
> habíamos declarado **no aplica hoy**; (2) `ckan user token add` **ignora `--json`** y mezcla sus `INFO` por
> stdout, y **`api_token_revoke` puede devolver `success: true` sin revocar nada** — el camino es el CLI
> (`ckan user token revoke <jti>`) y la revocación se verifica **por efecto** (desaparece de la lista y sus
> peticiones pasan a 404); (3) **la delegación SDD está retirada** en este arnés (`retired SDD delegation is
> not supported`), así que el ciclo `sdd-*` se corre **a mano**, como el propio `openspec/config.yaml` ya
> espera.
>
> **Y la regla de método que este cambio dejó escrita:** un modo de fallo que **corrompe en silencio** se
> arregla; uno que sólo es **ruidoso** se registra con su tarea. Los siete recibos la aplicaron, y las dos
> veces que un escritor encontró un hueco lo marcó en vez de taparlo.

## Estado al cierre (2026-10-01) — handoff del portal: v0 entregado y el vacío del buscador llenado

> **`main` = `c61d4c6` = `origin/main`, 0 sin pushear, árbol limpio.** `698/698` tests · `svelte-check` 0 errores /
> 4 warnings preexistentes · Biome exit 0 · **un solo worktree** · dos ramas locales (`main` y
> `wip/pr2-directo-publicacion`), las dos pusheadas.
>
> **Entregado en esta sesión, en orden:** la unidad de metadatos (`58c88af`, `beba1a7`; recibo
> `review-d13fbf017e3991a1` aprobado); la corrección de la premisa de D1 del SDD (`8a9666c`, con ocho punteros);
> la barrida del `BACKLOG` de v0 (`f2fa5c9`) y el registro del censo con sus tres reglas (`e5a27be`) —**113 → 98
> pendientes**—; **v0 ENTREGADO** (PR #43, merge `b1900c0`; rama borrada, worktree del token eliminado, `gc` de 561
> objetos sueltos a 0); el arreglo del wizard (PR #44, merge `7a4d4f7`); y el **vacío del buscador llenado y
> promovido** (`5886142`): tres bloques —«Pruebe con», «Mientras tanto, lo más reciente», «Explorar por
> organización»— en el orden que pidió el autor, con llamadas perezosas, más los chips desde el catálogo y la
> tarjeta del vacío al doble de alto (medido 192 → 384 px). Recibos `review-f6b3cb06831d7e11` y
> `review-a4119e82b86ac72e`, los dos aprobados, con sus correcciones (`cee3d77`, `ada8941`).
>
> **Lo primero de la próxima sesión es preguntar** (regla 9 de `AGENTS.md`) por el pedido con el que se cerró:
> **poner las tres salidas dentro de la misma sección que el aviso del vacío y evaluar saltos por `#id`** — está
> anotado abajo, con su cita textual, y tiene **dos lecturas** que hay que desambiguar antes de tocar nada.
>
> **Dos lecciones para no repetir:** (1) **la verificación viva encontró lo que los tests no podían** —los chips
> eran invisibles en el caso real porque **CKAN devuelve `search_facets` vacío con cero resultados** y la fixture
> fabricaba facetas: *un doble que no copia la forma real no verifica, bendice*—; (2) **la compuerta nativa
> encontró tres defectos reales que el agente había especificado** (el «Ver más» que no mostraba más, el latch que
> volvía permanente un fallo transitorio, y el `catch` que no reponía las facetas). **El texto de los hallazgos vive
> en `v2/review-<lineage>/review-state.json` y lo borra el acuse: leerlo ANTES de acusar.**

## Estado al cierre (2026-09-29) — entrega de la línea CKAN en `odp-docker`

> **Qué se cerró hoy.** Dos work units nuevas sobre `f4c4ca0`, gateadas **como rango**
> `f4c4ca0..4910824` y aprobadas: linaje `review-32a8541c54b833da`, tier **high**, 4/4 lentes
> (risk, resilience, readability, reliability), autoridad **quemada**
> (`gentle-ai.review-acknowledged/v1`).
>
> | commit | qué |
> |---|---|
> | `f21dc6b` | `test(ckan)`: la guarda que hace fallar la deriva del tag de CKAN |
> | `4910824` | `test(umss)`: fija qué recibe la regla encadenada en un update parcial |
>
> **Verificado:** `bash -n` limpio; el loop exacto del job `shell-tests` en 0 sobre los dos tests
> de host; la suite de la extensión en **54 passed** (53 + el test nuevo); el árbol real reporta
> `ok: 6 CKAN image reference(s), all 2.12`. Los dos commits están en `master` y **sin pushear**
> (decisión del autor).
>
> ### Las tres filas que faltaban de S5, MEDIDAS
>
> Contra el stack vivo (CKAN **2.12.0** / Python 3.14.7). Salida cruda y método en
> `odp-docker/odd/tasks/s5-remaining-rows.md`.
>
> - **#4 `package_update` sin `resources`:** los recursos **sobreviven** (2/2). La forma que manda
>   el wizard es segura. **Receta:** no hay que mandar `resources` "por las dudas".
> - **#7 `datastore_search`:** keys reales `fields`, `include_next_page`, `include_total`, `limit`,
>   `offset`, `records`, `records_format`, `resource_id`, `total`; `next_page` **sólo aparece si se
>   manda `limit`** y en la última página no está. **El matiz que importa:** el portal lee por clave
>   (`src/lib/api/datastore.ts`), así que un cambio de orden no lo rompe — es la misma familia que el
>   tope silencioso de 10 filas de `current_package_list_with_resources`.
> - **#9 estaba mal enunciada: `ckanext-umss` encadena *auth*, no validadores.** Medido con un spy
>   sobre el registro de auth: a la función encadenada le llega **el payload de la request**, así que
>   no puede depender de qué recursos mandó el cliente. Queda test de regresión permanente.
>   **Consecuencia fuera de S5:** la premisa escrita del cambio SDD
>   `2026-09-13-publication-lifecycle` (que `ckanext-umss` era un andamiaje `IConfigurer` vacío) queda
>   corregida por medición, y **ya está en el expediente de ese cambio**: la copia canónica es
>   `explore.md` §2.3, con punteros en `preproposal.md` y `proposal.md`. Una sola copia, una sola
>   procedencia.
> - **Pie de cañón lateral, medido y no arreglado:** `package_update` con `resources: []`
>   **explícito** borra todos los recursos y *después* lanza `NotFound`, así que ese error no
>   significa "no cambió nada". No es el camino del wizard; queda como ítem abierto abajo.
>
> **Cuatro avisos informativos** del linaje `review-32a8541c54b833da` (ninguno bloqueante, ninguno
> abre corrección): `R2-001` readability `test-ckan-image-tag.sh:171-174`, `R2-002` readability
> `:213-215`, `R3-001` reliability `:104`, `R3-002` reliability `:223`.
>
> **Además, cerrado hoy:** `origin/fix/umss-test-target-guard` **borrada** (medida antes: cero commits
> fuera de `master`); las ramas locales ya estaban limpias desde el 2026-09-28.
>
> **Pendiente y del autor, no de la sesión:** commitear `ckan-docker/.env.example` (su edición a mano
> del 2026-09-28 21:33, 6+/5−; el guardrail del harness bloquea esa ruta para leer y para escribir, así
> que no puede pasar por la compuerta de la sesión) y decidir el **push** de los dos commits.
>
> _(Medición y entrega de la sesión de la línea CKAN, 2026-09-29.)_

## Estado al cierre (2026-09-27) — handoff de la línea CKAN 2.12

> **Qué se cerró.** El slice del upgrade está **entregado**: 6 commits, cada uno con su compuerta
> nativa (autoridad quemada) y **pusheados**. `master == origin/master == d861c95`, árbol limpio y
> **CI verde** (run `36369796656`, `53 passed` en `ckan/ckan-dev:2.12`).
>
> | commit | qué |
> |---|---|
> | `9cbdf25` | el upgrade a 2.12 (los 8 archivos, 28 líneas de diff) |
> | `f37aac3` | el healthcheck roto (`wget` → sonda Python) |
> | `affb4b4` | el parche del `ApiTokenView` + los permisos de imagen |
> | `5d47358` | `SOLR_IMAGE_VERSION` apuntando al tag que corre el stack |
> | `91fcbc6` | el test del guard, con la traducción del driver que traen las imágenes 2.12 |
> | `d861c95` | el CI corriendo contra el `redis` que usan los stacks |
>
> **El expediente del upgrade es `odd/tasks/ckan-2.12-upgrade.md`** — la base medida, los slices
> S0–S6, la re-medición de S5, los hallazgos de S4 y de S6, el resultado de la revisión, la tabla de
> los 6 hallazgos del linaje huérfano y el registro de entrega con cada commit y su linaje. Leerlo
> antes de tocar cualquier cosa del upgrade.
>
> **Lo que está corriendo:** CKAN **2.12.0** sobre Python 3.14.7, Solr **`2.12-solr9`** ya declarado
> en `.env`/`.env.example` (no por override de shell), catálogo re-sembrado (**16 datasets**), portal
> funcionando, DebugToolbar apagado y `ckan-dev` **`healthy`** de verdad.

### Lo que falta, en orden

1. ~~**La decisión de dominios y del contenido mixto**~~ — **RESUELTO EN DEV (2026-09-28) y verificado
   de punta a punta.**
   **El problema**: el portal se servía por `https://odp.hs.lan` y CKAN firmaba sus URLs absolutas con
   `http://192.168.1.201:5000` ⇒ el navegador bloqueaba el PDF por contenido mixto.
   **El dato que decidió la arquitectura**: `ResourcePreview.svelte` muestra el PDF en un `<iframe>`
   **a propósito** —con un comentario propio que dice que lo hace así porque la API de CKAN no manda
   CORS— ⇒ **el portal ya estaba diseñado para leer el recurso desde otro origen**, y unificar orígenes
   habría obligado a escribir el proxy de descargas que precisamente se evitó.
   **El arreglo** (commit `f4c4ca0` en `odp-docker`, `master`, gateado): Caddy sirve
   **`https://api.odp.hs.lan` directo al contenedor de CKAN** —sin nginx intermedio, porque CKAN ignora
   el `Host` y arma sus URLs desde `ckan.site_url`— y `CKAN_SITE_URL` apunta ahí. **El portal no
   necesitó ningún cambio de código**: el `<iframe>` sin CORS ya cubría el caso.
   **Verificado**: un PDF subido por API devuelve
   `https://api.odp.hs.lan/dataset/…/resource/…/download/…` (`url_type: upload`) y esa URL sirve el
   archivo (`200 · %PDF-1.4`); el autor lo abrió en el portal y se ve.
   **Producción** (decisión del 2026-09-24, sin cambios): portal en `data.umss.edu.bo`, CKAN en
   `api.data.umss.edu.bo`, `ckan.site_url=https://api.data.umss.edu.bo`. El **invariante** que viaja:
   `ckan.site_url` debe ser exactamente la URL pública de CKAN, **con el mismo esquema que el portal**.
   El andamiaje de `hs.lan` (labels de Caddy + `hs-net`) es de dev y vive **sólo** en
   `docker-compose.dev.unified.yml`, comentado como tal. El nombre `api.odp.hs.lan` ya está en el DNS
   de AdGuard (lo agregó el autor; verificado: resuelve a `192.168.1.201`).
   _(Medición y arreglo de la sesión de la línea CKAN, 2026-09-28.)_

2. **El borrador del issue upstream del `ApiTokenView`** — escrito en
   `odd/tasks/tokens-page-patch.md` y **sin publicar**: es una acción externa y necesita el OK del
   autor. El parche local ya está aplicado (`affb4b4`), así que esto sólo cierra el círculo con
   upstream.
3. ~~**Las filas 4, 7 y 9 de S5 quedaron sin medir**~~ — **MEDIDAS el 2026-09-29**, con salida
   cruda en `odp-docker/odd/tasks/s5-remaining-rows.md` y el resumen en la sección del 2026-09-29 de
   arriba. Lo que hay que retener: #4 no borra recursos, #7 es aditivo y se lee por clave, y **#9
   estaba mal enunciada** (encadena *auth*, no validadores, y recibe el payload de la request).
4. **Rotar las contraseñas de la base y del sysadmin** que el DebugToolbar publicó. **No es
   emergencia:** el leak está cerrado, así que no hay exposición activa — es higiene. Con el volumen
   limpio ya se regeneraron solos los secretos del ini.
5. ~~**`R2-002` — el tag de CKAN como literal en ocho lugares**~~ — **la parte que es deriva del tag
   de CKAN quedó CERRADA el 2026-09-29** con una guarda de host, no con una variable:
   `ckan-docker/ckan/tests/test-ckan-image-tag.sh` (`f21dc6b`) falla si los tags de CKAN difieren
   entre los sitios que nombran la imagen, si un sitio deja de nombrarla, si la extracción queda
   vacía o si el tag es un digest. Se descartó centralizar con `ARG`: los cuatro Dockerfiles
   extienden **dos imágenes distintas**, así que cada uno necesitaría su propio argumento y su propio
   default —la duplicación no desaparece—, y el `container:` del workflow lo resuelve el runner.
   **Lo que la guarda NO cubre, a propósito:** las imágenes de servicio de `checks.yml` (sus tags los
   gobiernan otros upstreams; el de Solr hasta lleva sufijo `-solr9`) y la celda del README, que
   ilustra cómo se cambia. **Y hay un resto con dueño propio**: el acoplamiento de `redis:6` con el
   cliente de CKAN 2.12 sigue en un comentario del workflow, **sin guarda** — es el caso que sí mordió
   (`HELLO`/RESP3). El ítem canónico queda marcado `[~]` por eso.
6. **Los avisos informativos acumulados**, ninguno bloqueante y ninguno reabre un review cerrado:
   `R2-001`/`R3-001`/`R3-002` (el upgrade, en `docker-compose.yml:48` y `docker-compose.dev.yml:32`),
   `R3-001`/`R3-002`/`R3-003` (el parche de tokens) y `R2-001` (el test del guard,
   `test_target_guard.py:290-291`). El envelope de cierre nunca trae su texto: quedaron transcritos,
   con id/lente/ubicación/severidad, en el expediente. **Precisión medida el 2026-09-29, que corrige
   una afirmación de más:** el envelope nunca trae el texto, pero el store **sí** lo tiene mientras el
   linaje está vivo — `v2/review-<lineage>/review-state.json`, schema
   `gentle-ai.review-state-record/v2`, con la claim completa en
   `state.admitted_role_results[i].value.result.findings[j].claim` más `proof_refs`, `severity` y
   `causal_disposition` — y **lo que lo borra es el ACUSE, no la aprobación**: el registro de consumo
   terminal sólo conserva schema/repositorio/target/linaje. El matiz lo midió el bloque E el mismo día
   (5 `review-state.json` vivos contra 56 registros de consumo terminal, y **el único `approved` que
   sobrevive es una compuerta cuyo acuse nunca se ejecutó**, y por eso conserva sus claims). Medido del
   lado CKAN: el linaje huérfano `review-7e3ab346bc8b3f85` (no aprobado) sigue con 26 291 bytes y las
   seis claims enteras, mientras que `review-32a8541c54b833da` (aprobado y **acusado**) **no tiene
   directorio** en el store.
   **Receta: leer el `review-state.json` entre el cierre y el acuse** — la línea CKAN perdió así las
   cuatro claims de su linaje de hoy.
   **Agregados el 2026-09-29** (linaje `review-32a8541c54b833da`): `R2-001` readability
   `ckan-docker/ckan/tests/test-ckan-image-tag.sh:171-174`, `R2-002` readability `:213-215`,
   `R3-001` reliability `:104` (`grep -P` es extensión de GNU), `R3-002` reliability `:223`
   (`mktemp -d` + `trap`).
7. **El linaje huérfano `review-7e3ab346bc8b3f85` NO se limpia.** Está en `correction_required` sin
   veredicto y sin recuperación, pero **`ABANDON` descarta los hallazgos admitidos** y este linaje
   guarda la única copia de seis (`R1-001`, `R1-002`, `R4-001` CRITICAL, `R2-001`, `R2-002`,
   `R3-VOLUME-PYTHON`). Se deja como **deuda declarada**, con la tabla en el expediente: limpiar el
   store borraría la evidencia, no una transacción muerta.
8. ~~**`feat/ckan-2.12-upgrade` quedó 2 commits atrás de `master`**~~ — **la decisión se disolvió
   sola: la rama ya no existe, ni local ni remota** (medido el 2026-09-29 con `git branch -r` y
   `git branch -vv`; se fue con la limpieza de ramas mergeadas del 2026-09-28). Queda sólo su
   reemplazo vivo como convención: en este repo se commitea en `master`.

> **Nada sin commitear de mi lado.** El `.patch` del parche de tokens está versionado, así que este
> worktree **no tiene no-versionados** y no bloquea ninguna compuerta. En `odp`, este archivo y los
> dos expedientes (`odd/tasks/ckan-2.12-upgrade.md`, `odd/tasks/tokens-page-patch.md`) están
> commiteados, y `3f9de1e` es el único commit que agregué en `odp`.
> **Aviso de escritor concurrente:** hay otra sesión trabajando en este repo. La regla que funcionó:
> **repartir por archivo**, `git add <paths>` explícitos y **nunca** `git add -A` ni
> `git checkout -- <archivo>`, para no barrer hunks ajenos.

## Estado al cierre (2026-09-24) — handoff del **bloque E** (sesión paralela)

> **Dos sesiones trabajaron en este repo el mismo día.** La sección de arriba es el handoff de la otra línea
> de trabajo (el upgrade a CKAN 2.12, `odp-docker`, el proxy y la higiene de configuración). **Ésta es la del
> bloque E** (pulido de layout y navegación del portal) y la de los obstáculos del arnés de revisión.
>
> **Lo cerrado hoy, cada cosa con su recibo quemado** (13 recibos, 7 con corrida de modelo): **E1** (los chips
> de formato) · **E2** (el alto del encabezado en una sola fuente) · **la regresión del modo claro** que
> introdujo E2 y su corrección · **E2b** (el encabezado se achica al scrollear, más el `ResizeObserver` que
> lo vuelve necesario) · el ajuste a **16px** · **E3** (la organización faltante en la ficha del asistente y
> `text-pretty`) · **E6** (la nota del enlace: de 220px a nota compacta) · **E7** (el breadcrumb como **chip
> de contexto** en móvil, y **un** breadcrumb en las dos páginas) · y la hoja **`/dev/nav`**, versionada.
> El detalle de cada uno está en «Deuda de revisión (RDD)», y el plan en
> `odd/tasks/block-e-layout-polish.md`.
>
> **Estado del árbol:** rama `feat/v0-portal-honesty`, **48 commits sin pushear**, `pnpm test` **640/640** (47
> archivos), `svelte-check` **0 errores / 4 advertencias** (las preexistentes), Biome **exit 0** con **4 warnings
> + 7 infos** (el baseline exacto).
>
> **E8 —saltar de un recurso a otro— CERRADO (2026-09-25): el código está en `524af04` y la compuerta corrió y
> aprobó.** Recibo `review-865b14e1f735a37a`: tier **medium**, lente `review-reliability`, **9 archivos / 931
> líneas**, presupuesto 200, **0 bloqueantes y 1 aviso informativo**, authority quemada. El aviso, la lectura de
> sus líneas y el alcance del candidato están en «Deuda de revisión (RDD)».
>
> **El obstáculo que la frenó ayer quedó resuelto:** era `odd/tasks/tokens-page-patch.md` **sin versionar** —con
> un no versionado elegible en el árbol, **ningún `START` acotado avanza**—. Se resolvió commiteando ese archivo
> y los otros dos docs de la sesión paralela (`b83cd38`, autoría ajena declarada en el mensaje): el inventario
> de no versionados quedó **vacío** y el `START` pasó a la primera. **Consecuencia asumida:** los docs de ese
> commit entran al candidato de E8 (9 archivos en vez de 7).
>
> **Un linaje accidental más, y esta vez cerrado.** Resolver la selección de no versionados creó
> `review-7fc73fed89978ad8` sobre el **árbol de trabajo** —4 archivos, 529 líneas de la otra línea, no el
> candidato de E8—. **Abandonado con la autorización del autor** (registro `gentle-ai.review-reclaim-record/v1`,
> en cuarentena, `captured_lens_results: []`, sin mutación previa). **Sigue abierto el de la sesión anterior,
> `review-c73d757362ca2fa1`**, candidato al mismo cierre: mientras haya un linaje abierto sobre este workspace,
> los reenvíos de captura se traban.
>
> **Dos cosas bloqueadas o esperando decisión, ninguna es código a medias:**
> 1. **La corrección de E5**: `review-5ab16f231f1adb49` quedó en `correction_required` con el arreglo **ya
>    commiteado** (`e5d2411`) y el plan rechazado tres veces. Declarar **25 líneas de diff**; el detalle
>    completo está en «Deuda de revisión (RDD)».
> 2. **E4** — normalizar la card de metadatos del dataset: falta **la decisión del autor** (la página tiene
>    dos cards y la principal ya cumple). Pide antes/después.
>
> **Dos TODO nuevos del autor (2026-09-24), los dos de diseño y los dos con su medida:** los **botones de
> anterior/siguiente** se ven chicos y pasan desapercibidos (`p-1.5`, ícono `size-4`, contador en `text-[10px]`
> y oculto debajo de `sm`); y **en escritorio no se ven ni se pueden saltar los demás recursos**, porque el
> grupo «Recursos de este dataset» vive en el chip, que es `lg:hidden`.
>
> **Y un defecto medido que introdujo E2b:** el navegador **desactiva el anclaje de desplazamiento** del
> contenedor porque el encabezado cambia su **alto en el flujo** (16px) al achicarse y el anclaje intenta
> compensarlo en cada transición: tras 10 ajustes seguidos lo apaga. El mensaje textual, la causa y las tres
> opciones de arreglo están en su ítem del backlog. **Medir primero si produce un salto visible.**
>
> **Recetas medidas del arnés (las que costaron tiempo hoy):**
> - **Un archivo sin versionar frena cualquier `START` acotado**, y **la salida barata no es commitear nada**:
>   se agrega el path a `.git/info/exclude` (local, nunca se commitea), se corre el `START` que congela el
>   candidato y **se revierte el exclude al instante**: el `git add -f` sólo hace falta si la regla se deja
>   puesta. Medido por la sesión paralela en `odp-docker` y verificado acá. **La alternativa —commitear el
>   artefacto ajeno con procedencia— se usó una vez y era innecesaria.** Ojo: son cosas distintas de
>   `untrackedScope: "exclude"` en el `inspect`, que devuelve la proyección *workspace* y descarta el
>   `baseRef`, y que **no sobrevive** al `START` limpio.
> - **`consent-binding-stale`** aparece una o dos veces seguidas: se resuelve con un `START` nuevo (clave
>   nueva). El mensaje de «10 minutos» es falso.
> - **`capture-binding-rejected`** en el reenvío posterior al forecast: se resuelve con `STATUS` y relanzar
>   el mismo binding. **Corregido el 2026-09-25: un linaje abierto en el mismo workspace NO es la causa**
>   —se abandonó el huérfano y un linaje ajeno siguió respondiendo `applicability: unrelated`—; lo que traba
>   a un linaje es que **su propio candidato haya dejado de existir**.
> - **El `baseRef` de la fachada es el COMMIT, no el hash de ÁRBOL** que renderiza la ruta del proveedor
>   (`--base-ref=b4cb5155…` es el tree de `448190a`; el `input` correcto lleva `448190a48cb0…`). Copiarla
>   literal da `native-start-base-ref-unresolvable`. **`inspect` acepta `input` con `baseRef` +
>   `committedOnly` y NO acepta `mode`** (el `START` sí lo necesita).
> - **Un plan de corrección vence si el árbol se mueve antes de enviarlo**: el candidato corregido deja de
>   existir, el linaje pasa a `applicability: unrelated` y **no es limpiable por la fachada** (no rinde su
>   `revision`, así que ni `ABANDON` lo alcanza). **Enviar el plan inmediatamente, antes de cualquier otro
>   commit.**
> - **`ABANDON` es destructivo sobre la EVIDENCIA, no sólo sobre la transacción**: descarta los hallazgos
>   admitidos. Antes de usarlo para «limpiar», contar los que va a borrar y confirmar que un recibo posterior
>   los cerró. El store inerte de un linaje sin ruta **es** el registro de por qué se abrió y qué encontró.
> - **Dos escritores en un worktree:** se aísla por hunks (`git diff > p; head -4 p > m; tail -n +N p >> m;
>   git apply --cached m`) o con `git add -p`. **Nunca** `git add -A` ni `git checkout -- <archivo>`.
> - El **gancho de pre-commit** (`biome --staged --write`) puede dejar un diff de **sólo formato** después de
>   commitear.
> - **Resolver la selección de no versionados no es una selección: es un `START`.** `select-intended-untracked`
>   —y el `inspect` con `untrackedScope`— **crean un linaje** sobre la proyección de **árbol de trabajo**, con
>   el contenido sin commitear de quien sea. Costó **dos linajes accidentales en dos sesiones**. Con un no
>   versionado elegible, la decisión correcta **antes** de tocar el arnés es versionarlo o ignorarlo.
> - **`ABANDON` exige `reason` como enum**, no texto libre: `operator_disposition` o `retired_schema`. Con texto
>   libre el nativo falla (`review abandon requires reason …`) y deja `mutation_outcome: unknown`, que se
>   resuelve con un `STATUS` del objetivo: si el `revision` no cambió, **no hubo mutación**. Con el enum, el
>   cierre es `gentle-ai.review-reclaim-record/v1` (`committed`) y la transacción queda **en cuarentena**.
> - **`acknowledge-approved` por la fachada no acepta `input`**: devuelve `controller-only-input` y pide
>   reenviar «el linaje exacto sin input de controlador». Con sólo `lineageId` quema la autoridad
>   (`gentle-ai.review-acknowledged/v1`).
> - **Biome puede morir por memoria con `exit 254`** (`Linter process terminated abnormally`) **sin imprimir
>   conteos**: `NODE_OPTIONS=--max-old-space-size=6144 pnpm exec biome check .` completa y da el baseline
>   (4 warnings + 7 infos), y `pnpm exec biome check src` completa sin tocar el heap. **No es determinista.**
> - **«¿Qué workflow corrió?» tiene respuesta exacta**, y es la forma de distinguir «falló mi código» de «falló el
>   entorno» **sin adivinar**: `git fetch origin pull/<N>/merge` y leer el `.github/workflows/` **de ese commit**.
>   Un PR corre el workflow del **commit de merge** (base + head), no el de la rama — medido en el PR #43: la rama
>   tenía la `ci.yml` vieja sin el paso del entorno y el run **sí** lo tenía. _(Receta de la sesión de la línea
>   CKAN, 2026-09-28.)_
> - El worktree de aislamiento para la sesión paralela está creado: `/home/danielblc/projects/odp-token-hardening`
>   (rama `feat/token-hardening`), y **no se movió**: la otra sesión siguió escribiendo acá.
>
> **De la sesión paralela (corregido el 2026-09-25):** `BACKLOG.md`, `odd/tasks/ckan-2.12-upgrade.md` y
> `odd/tasks/tokens-page-patch.md` **se commitearon** (`b83cd38`) por decisión del autor y con la **autoría
> ajena declarada en el mensaje**. Fue la única salida que dejaba el inventario de no versionados **vacío** sin
> una regla de ignore que después estorbara. El contenido quedó **exactamente** como la otra sesión lo dejó.

## Estado al cierre (2026-09-23) — handoff de la próxima sesión

> **Qué está cerrado.** De la sesión del 22: los bloques **A**, **B** y **C**. De esta sesión: el **bloque D
> completo** (D0 la sonda, D1 la vista previa por tipo, D2 los cuatro hallazgos, D3 el gate de Data API y la
> spec) **más el `localhost`** — reportado por el autor, medido, y arreglado en **los dos repositorios**
> (`odp` y `odp-docker`), con verificación en vivo.
>
> **Los recibos de esta sesión**, todos con `baseRef` explícito —cada uno revisó **sólo su slice**, nunca la
> rama acumulada, que sigue excluida por decisión del autor—:
> `review-4fb694e5160560c1` (D1, medium, 12 archivos / 1 182 líneas, **2 avisos**) ·
> `review-891f798293c18235` (D2, medium, 4/129, **2 avisos**) ·
> `review-03b5057b001e6f9b` (D3, medium, 3/150, **2 avisos**) ·
> `review-344a93dbb8243ef2` (**high, 4 lentes** —subió por ser camino de autenticación—, 10/139, **4 avisos**).
> Ninguno tuvo bloqueantes. **Un patrón que conviene leer antes de tocar nada: los 4 avisos de L1 convergen
> en una sola línea** —`logout/+server.ts:29`— desde tres lentes distintas, y son la única decisión de
> contrato que quedó abierta (fila 1 de la tabla de abajo). El detalle está en «Deuda de revisión (RDD)»,
> entrada por entrada.
> **Más cinco cierres de compuerta** sobre commits de sólo-documentación (`review-3d4f52fb03dd4885`,
> `review-ec24349d37735565`, `review-073903f10c4facf0`, `review-2cc2052d6a63184a`, `review-922f6871ff173ef9`):
> el provider los clasifica `non_executable_only`, los aprueba **sin lentes y sin correr un solo modelo**, y
> por decisión registrada **no se anotan** (la entrada correspondiente en «Deuda de revisión» dice dónde
> termina el registro, para no encadenar recibos-de-recibos).
>
> **Código, al cierre:** 17 commits en `feat/v0-portal-honesty`, **sin pushear** (decisión del autor). Gates
> verdes: `pnpm test` **601/601** · `pnpm check` **0 errores** · Biome directo en su baseline (4 warnings + 7
> infos, ninguno nuevo). El `push` y la rotación de secretos siguen siendo del autor.
>
> **Aviso de nomenclatura: «slices» y «bloques» comparten el alfabeto A/B/C y son dos series distintas.**
> Cuando este archivo dice «bloque A» habla del verbo, no del slice. Y el bloque D tiene su propio expediente
> en `odd/tasks/block-d-data-preview.md`; el `localhost`, en `odd/tasks/localhost-urls.md`.

### Cómo arrancar la próxima sesión (receta, en orden)

> **Paso 0 — la compuerta de RDD.** Al abrir, el worktree va a traer un candidato sin revisar: el commit de
> documentación del cierre (sólo `.md`). Corré el ciclo **acotado a ese delta**: `gentle_review` con
> `{"operation":"inspect"}`, y después `start` con `{"mode":"ordinary","baseRef":"<sha completo del commit
> anterior>","committedOnly":true}`. Devuelve `approved` en el acto, **sin consentimiento, sin lentes y con
> cero corridas de modelo**. Seguí con un `status` y el `acknowledge-approved` que devuelve. **No lo anotes**
> otra vez. El `baseRef` **exige el sha completo de 40 caracteres**: uno abreviado da
> `native-start-base-ref-unresolvable` y no crea lineage (se reintenta con clave de idempotencia nueva).
>
> **Paso 1 — leer, en este orden:** `odd/tasks/localhost-urls.md` (lo que quedó abierto del `localhost`),
> `odd/tasks/block-d-data-preview.md` (el bloque D completo) y `odd/tasks/block-e-layout-polish.md` (**el bloque
> en curso**: sus 7 ítems re-verificados contra el árbol actual, el corte en seis slices y las tres decisiones
> que piden el ojo del autor). Los tres tienen las mediciones, las decisiones y
> las desviaciones declaradas. **No hace falta releer las narrativas históricas de A, B y C** que están más
> abajo en este archivo: cada bloque tiene su expediente y el «Historial de cierre» lo resume.
>
> **Paso 2 — la receta de revisión nativa de un slice de código** (la que funcionó cuatro veces): `inspect` →
> `start` con `baseRef` **explícito** y `committedOnly: true` → `status` → captura de grupo o de slot → **el
> primer capture devuelve un `forecast` y no corre nada: relayalo y reenviá el mismo binding con
> `reviewerRunAcknowledged: true`** → `status` → `acknowledge-approved`. **Trampa medida: el `base-ref` que
> ofrece `inspect` es la base de la RAMA (66 rutas acumuladas), no la del slice — nunca lo sigas tal cual.**
>
> **Paso 3 — los gates, con los binarios que sí son evidencia:** `pnpm test` · `pnpm check` ·
> `./node_modules/.bin/biome check <archivos tocados>`. **`pnpm lint` es intermitente** (medido: 6 de 7
> corridas pasan) y sus 11 diagnósticos son los 11 «Unsafe fix», así que ni `lint:fix` ni el pre-commit los
> aplican — y `--unsafe` **borraría los `!important` del bloque `prefers-reduced-motion`**. Ver el ítem
> `[v1+]` de los diagnósticos de Biome.
>
> **Paso 4 — si se toca el stack de dev: `docker restart` NO alcanza.** El entorno del contenedor se fija al
> **crearlo**, así que un cambio de `env_file` pide **recrear**:
> `docker compose -p odp-dev -f docker-compose.dev.unified.yml up -d <servicio>`. Trampa adicional: tras
> recrear, el `ckan.ini` de dentro del contenedor puede seguir mostrando el valor viejo — **el env gana**, y
> eso es lo que hay que verificar midiendo el síntoma, no leyendo el archivo.
>
> **Paso 5 — entregar.** Un slice = commits por unidad de trabajo + su propia revisión + su apunte en este
> archivo. El `push`, el PR y el merge siguen siendo decisiones del autor.

### Lo que falta, en orden de conveniencia

| # | Qué | Quién decide | Coste | Depende de |
|---|---|---|---|---|
| **1** | **El contrato de logout:** hoy `POST /auth/logout` responde `500` si falta `CKAN_INTERNAL_URL` fuera de dev. **La recomendación que vivía acá —«login ruidoso, logout a best-effort»— quedó retirada el 2026-09-24: su premisa (impacto en el usuario) es falsa y está medida** —el cliente descarta el status, y el login ya denuncia la misma variable con la misma fuerza—. Lo único que sigue en pie es si el encabezado de la ruta merece precisar que la revocación *en sí* es best-effort. **Puede cerrarse sin una línea de código**; las mediciones están en «Deuda de revisión (RDD)» | el autor | chico, y probablemente cero código | nada |
| **2** | **Bloque E — pulido de layout y cards de `v0`** — 7 ítems, plan en `odd/tasks/block-e-layout-polish.md`: encabezado alto en 720p **y los dos `[v1]` que derivan de él**, card de metadatos del dataset, resumen del wizard con varias organizaciones, descripción de organizaciones, badges duplicados del buscador, breadcrumb móvil, vista del enlace. **Tres piden decisión del autor** —el umbral de alto del encabezado, cuál card del dataset, y la estrategia del breadcrumb— y se resuelven mirando un playground; los otros cuatro no — **E1 y E2 cerrados el 2026-09-24** (`review-35a2937ca35fd6fc`, `review-aae5dd97579ec543`) | el autor, para esas tres | medio, seis slices (E1–E6) | nada |
| **3** | **Ingesta (`[v1+] Datos de muestra para las vistas`):** falta la fuente. **El autor tiene un ejemplo de cómo hacer la carga de datos y todavía no lo pasó**; con eso se decide. El camino «upload + datapusher» **ya está medido y funciona** | el autor (aporta el ejemplo) | medio | el ejemplo |
| **4** | **Bloque F — permisos:** habilitar los colaboradores **nativos** de CKAN y **medir** qué cubren antes de decidir cuánto construir fuera (`RF-19`, equipos) | se decide al empezar | grande | nada, pero conviene medir primero |
| **5** | **Bloque G — el oráculo de la API** (`403` que nombra el recurso vs `404`): exige capa server-side | arquitectura | — | **diferido** |
| **6** | **Los `v1+` que el autor pidió:** pulido visual de las páginas de error · la paleta de formato como **tokens** · unificar los colores de los chips en las tres superficies · chips clicables al buscador · reordenar los recursos del asistente · los 11 diagnósticos de Biome | el autor, cuando quiera detalles | chico cada uno | nada |
| **7** | **Acciones que son sólo del autor:** el `push` de los commits de la rama (17 al cierre del 2026-09-23) · la **rotación de los tres secretos** del `.env` de Engram · el arreglo de `pnpm lint` y el gancho de pre-commit (`shell-emulator=true` en `.npmrc` o Node LTS en `mise`) | el autor | — | — |

> **Dos ítems salieron de la lista de `v1+` el 2026-09-24:** el **breadcrumb móvil** y la **vista del enlace**.
> Los dos son `[v0]` y los dos estaban listados **también** en el bloque E — duplicados. Quedan sólo en el bloque E.


### El plan en bloques — **registro histórico de A, B y C** (cerrado; la narrativa está en los expedientes)

> **Los bloques A, B, C y D están CERRADOS.** Lo que sigue es el registro de cómo cerraron A, B y C — el
> contenido operativo ya está arriba, en el handoff, y cada bloque tiene su expediente en `odd/tasks/`.
> Se conserva acá porque tiene las mediciones, las decisiones del autor y las lecciones que no conviene
> re-descubrir; **no hace falta releerlo para arrancar**.
>
> | Bloque | Qué resolvió | Estado |
> |---|---|---|
> | **A** | **El verbo: «publicar» → «crear».** 4 cadenas de `src/lib/copy/dashboard.ts`, el botón del wizard y sus dos notas, más los tests. El portal decía «Publicar dataset» y lo creaba **privado**: el usuario entendía que ya era visible para todos. | **CERRADO** (2026-09-22) · `review-169119db13ffab2c` |
> | **B** | **Página 404 propia** (`+error.svelte`; cubre ruta inexistente y 5xx). Antes salía la página por defecto de SvelteKit: «404 Not Found» en inglés y sin vuelta al catálogo. | **CERRADO** (2026-09-22) · `review-13d22ebddf82eef0` |
> | **C** | **Recurso según su tipo:** distintivo de **enlace** en todas las pantallas, y ocultar las vistas de datos cuando el recurso es un enlace. | **CERRADO** (2026-09-22) · `review-c282f17baf9309ea`, `review-5f36113f971853de`, `review-11cc383a48faf9e7`, `review-74d83299cafabe6f` |
> | **D** | **Vista previa de datos y sección «Data API».** | **CERRADO** (2026-09-23) · `review-4fb694e5160560c1`, `review-891f798293c18235`, `review-03b5057b001e6f9b` |
> | **E** | **Pulido de layout y cards de `v0`** — **el siguiente**; tres de sus ítems piden decisión del autor (plan en `odd/tasks/block-e-layout-polish.md`). | **en curso** (2026-09-24: **E1** `review-35a2937ca35fd6fc` · **E2** `review-aae5dd97579ec543`) |
> | **F** | **Permisos:** colaboradores nativos de CKAN, medir antes de construir. | pendiente |
> | **G** | **El oráculo de la API.** | diferido |
>
> **Cada bloque cierra con sus commits y su propia revisión nativa**, con `baseRef` explícito. Los
> `v1`/`v1+`/`v2+` y la deuda de revisión viven en sus secciones propias de este archivo.
>
> **BLOQUE A — CERRADO (2026-09-22): código, gates, push y revisión nativa APROBADA.** Cuatro commits
> por unidad de trabajo: `9d7be01` (copia) · `e3136a9` (panel) · `4265137` (asistente) · `8081260` (hoja
> `/dev/copy`). Diff **88/88 líneas**, `openspec/` y `about` intactos, gates verdes (`pnpm test` **472/472**,
> `pnpm check` **0 errores**, `pnpm build` OK; `pnpm lint` cae por el problema de entorno conocido, no por el
> código). **El alcance real fue mayor que el enumerado: 9 archivos, no 3** — el asistente se contradecía
> consigo mismo (`h1` y `<title>` decían «Publicar dataset» mientras el cuerpo decía «para publicar
> datasets»), y **`grep` del verbo antes de dimensionar** es la lección. Motivo nuevo que lo vuelve
> obligatorio: **«Publicar dataset» ya está reservado** para el control real del aprobador
> (`2026-09-13-publication-lifecycle/specs/publication-lifecycle/spec.md:246`), así que el botón del asistente
> **ocupaba la etiqueta de la acción que viene**. Expediente y evidencia completos:
> `odd/tasks/block-a-verb-create.md`.
> **Decisión que tomó el autor en el camino:** además de la copia visible, se renombraron los identificadores
> que codificaban el mismo error (`EmptyStateFlags.canPublish` → `canCreate`, `puedePublicar` →
> **`puedeOfrecerCreacion`**, que NO es `puedeCrear`: ese ya existía y significa sólo el permiso de CKAN).
>
> **Recibo quemado: `review-169119db13ffab2c` — APROBADA** (tier `medium`, lente `review-reliability`, **11
> archivos / 350 líneas**, presupuesto de corrección 175, **1 revisor, 0 bloqueantes**). Rango revisado **por
> `baseRef` explícito**: `1f60930..HEAD`, o sea **sólo el bloque A** — no la rama acumulada, que sigue excluida
> por decisión del autor. **Pusheado y en sincronía** con `origin/feat/v0-portal-honesty` (`356d42a`).
> **Aviso informativo del recibo (R3-001, no bloqueante, no reabre la revisión):**
> `TODO:` en `wizard.test.ts:238` el test se llama «no muestra el campo de visibilidad y **crea siempre como
> privado**», pero su cuerpo **sólo** verifica que no hay campo de visibilidad; el `private: true` **sí** está
> verificado, pero **en otro test** (`:203`). El desajuste es **preexistente** (el título viejo prometía lo
> mismo), y el renombre del verbo lo dejó a la vista. Arreglo: o se parte el título, o se trae la aserción a
> este test.
>
> **BLOQUE B — CERRADO (2026-09-22): página de error propia, aprobada por el autor y revisada.** Tres
> unidades de trabajo + el expediente: `716af7e` (componente de presentación) · `ce15382` (hoja
> `/dev/error`) · `07803f5` (promoción) · `34bba4f` (expediente). **El portal ya no muestra la página por
> defecto de SvelteKit** («404 Not Found» en inglés, sin vuelta al catálogo).
>
> **MEDICIÓN EN VIVO (la que zanja el asunto, no los tests):** `http://localhost:8082/no-existe` →
> **HTTP 404** y renderiza el **estado de cliente** («No se pudo abrir esta página»: 1) y **no** el del
> servidor (0). Con el defecto que apareció en el camino, ese marcador habría estado invertido. Gates:
> `pnpm test` **520/520** · `pnpm check` **0 errores** · Biome directo **129 archivos / exit 0** ·
> `pnpm build` OK.
>
> **EL HALLAZGO DEL BLOQUE, y fue un error de MI especificación:** el envoltorio leía
> `$page.error.status`. En SvelteKit el estado **no** está ahí: `Page.status: number` es «HTTP status code
> of the current page», `Page.error` es `App.Error | null`, y el `App.Error` por defecto trae **sólo
> `message`** (este repo no lo amplía: `src/app.d.ts` tiene `interface Error {}` comentada). En producción
> ese `status` era `undefined`, así que **todo error —404 incluido— habría renderizado el estado del
> servidor**. Lo detectó el subagente escritor al negarse a aplicar contenido que no pasaba `pnpm check`.
> **Y lo que más importa: mis propios tests lo tapaban**, porque el doble de `$app/stores` declaraba un
> `error` **más ancho** que el del framework y fabricaba el campo inexistente. *Un doble que no copia la
> forma real no verifica: bendice.* El stub ahora declara `{ message: string }`, igual que `App.Error`, y
> hay un test que ancla la clasificación **con el mensaje ausente**.
>
> **Recibo quemado: `review-13d22ebddf82eef0` — APROBADA** (tier `medium`, lente `review-reliability`,
> 9 archivos / 957 líneas, presupuesto de corrección 200, 1 revisor, 0 bloqueantes). Rango por `baseRef`
> explícito: sólo el bloque. **Dos sugerencias informativas, anotadas y NO corregidas** (corregirlas
> pediría su propia revisión, y la de este recibo ya está quemada):
> - `TODO:` `src/routes/+error.svelte:27` — el reintento usa `$page.url.pathname`, que **pierde la query
>   y el fragmento**: un 5xx en `/search?q=salud` reintenta `/search` y el usuario pierde su búsqueda.
>   Arreglo: `pathname` + `search` (+ `hash` si corresponde).
> - `TODO:` `src/lib/components/error/error-page.test.ts:237-240` — el test del ícono toma el **primer**
>   `<svg>` del contenedor, pero el estado 5xx renderiza **dos** (el del estado y el de `Reintentar`), así
>   que la aserción es frágil y el `aria-hidden` del segundo no queda cubierto. Arreglo: acotar la
>   consulta al ícono del estado.
>
> **DESVIACIÓN MEDIDA, para que no sorprenda: el bloque tiene 957 líneas de diff y el presupuesto de
> revisión acordado es 400.** El código de producción son ~315 y el resto es test (531) y la hoja (121).
> La revisión lo tomó igual como **una** revisión de tier `medium`. **Lección para los bloques que vienen
> (C, D, E, F): separar el componente, la hoja y la promoción en revisiones propias** si el diff vuelve a
> pasar de 400.
>
> **Decisión del autor:** la hoja `/dev/error` **se queda como herramienta permanente**, con el mismo
> criterio documentado que `/dev/copy` — un 5xx no se provoca a mano.
>
> **BLOQUE C — CERRADO: recurso según su tipo. C1 CERRADO (2026-09-22).** El portal presentaba todo
> recurso como archivo: insignia de formato, vistas de datos y botón de descarga. **Medido: los 35
> recursos del catálogo sembrado son URLs externas** (`https://data.umss.edu.bo/...`) con `url_type`
> ausente, `mimetype` ausente y sin `hash` — enlaces disfrazados de archivos, con un `format` CSV/PDF/
> GeoJSON y un `size` inventado.
>
> **La regla de detección es la de CKAN, con evidencia de su propio código** (no una convención
> nuestra): `ckan/lib/uploader.py:301` escribe `url_type = 'upload'` para un archivo subido y lo vacía
> en `:324`; y `ckan/lib/dictization/model_dictize.py:132` reescribe la `url` al enlace de descarga
> **sólo** con `url_type == 'upload'`. Así que la prueba es positiva —`url_type === "upload"`— y todo lo
> demás (`""`, ausente) es una referencia externa. **No se escribe ningún marcador en CKAN y no se
> re-siembra**: el asistente distingue archivo de enlace en su formulario pero **nunca lo persiste**
> (`createLinkEntry` manda sólo `package_id`, `name`, `url`, `description`), así que no hay marcador
> propio que leer.
>
> **Decisiones del autor (2026-09-22):** (1) detección por `url_type`; (2) la regla en **un módulo puro
> compartido** (`src/lib/resources/kind.ts`), como `failure.ts` y `copy/dashboard.ts`; (3) **el chip de
> tipo es exclusivo en los dos lugares** —un enlace muestra «Enlace» y **no** conserva su formato—, con
> el costo aceptado de que el formato declarado deja de verse ahí (sigue en el cuadro de metadatos);
> (4) **diferida y anotada: si un enlace merece ficha propia.**
>
> **C1 CERRADO**: `ed0b171` (expediente) · `fa96d5c` (la regla + el tipo + las fixtures honestas) ·
> `15b016d` (el chip en la lista y en la ficha). **Recibo quemado: `review-c282f17baf9309ea` — APROBADA,
> CERO hallazgos** (tier `medium`, lente `review-reliability`, **9 archivos / 342 líneas**, presupuesto
> de corrección 171, 1 revisor). Rango por `baseRef=f4fe203` explícito. **342 líneas: por debajo del
> presupuesto de 400**, que es la razón por la que este bloque se cortó en C1/C2 después de que el bloque
> B diera 957.
> Detalle que C1 arregló de paso: la etiqueta de relleno de la card decía **`FILE` en inglés** cuando no
> había formato — pasa a `Archivo`, la misma familia de defecto que el bloque A.
> Consecuencia honesta en DEV: **ninguna fixture declaraba `url_type`**, así que sin tocarlas todos los
> recursos de mock habrían pasado a leerse como enlaces; ahora las fixtures de archivo lo declaran.
>
> **C1 — SEGUNDA VUELTA (2026-09-22), a partir de la revisión visual del autor:** `6191b1d` (el chip
> compartido) · `ee6086b` (la hoja `/dev/kind`) · `d650a64` (los dos `TODO:`). **Recibo quemado:
> `review-5f36113f971853de` — APROBADA, CERO hallazgos** (tier `medium`, lente `review-reliability`,
> **9 archivos / 493 líneas**, presupuesto de corrección 200). **Nota de presupuesto: de esas 493 líneas,
> 309 son la hoja `/dev/kind`** —herramienta de desarrollo, sin efecto en producción—; el cambio de
> producción son ~150. La revisión lo tomó igual como un `medium`.
> **Lo que el autor vio y pidió:** (1) el ícono `Link` hacía más grande el chip de enlace — **se fue el
> ícono**; (2) el ancho variaba con la etiqueta (`CSV` vs `GEOJSON`) y **corría todo lo que sigue en la
> fila** — ahora es **uniforme** (`w-20`), y el chip vive en **un solo componente**
> (`src/lib/components/resource/ResourceKindChip.svelte`) que usan las dos superficies, para que no se
> bifurque.
> **Y una pérdida que causó este paso, con su decisión:** la especificación del padre reemplazó el mapa
> de color por formato de la card por un chip **neutro**. El autor decidió **dejarlo neutro por ahora** y
> definir la paleta en la pasada de detalles, como **tokens** (ver el `TODO:` de `v1+`). **No restaurar el
> mapa crudo**: repone las dos violaciones documentadas (`AGENTS.md` regla 3 y el anti-patrón del
> design-system §11).
> **Hoja permanente nueva: `/dev/kind`** — la matriz de etiquetas con el componente **real** (en fila y en
> columna) más una sección de comparación que declara que **no** es el componente real.
> **C2 CERRADO (2026-09-22):** `83412f5`. **Recibo quemado: `review-74d83299cafabe6f` — APROBADA, CERO
> hallazgos** (tier `medium`, **2 archivos / 87 líneas**, presupuesto de corrección 44). Rango
> `baseRef=ee11794` explícito.
> Para una **referencia externa** la tarjeta «Vista previa» ya no ofrece Tabla/Gráfico/Mapa ni la
> simulación: la misma regla del chip (`resourceKind`) decide, derivada una vez por render. En su lugar hay
> un **estado que explica la ausencia** («Este recurso es un enlace externo…»), porque la pantalla en blanco
> sin sugerencias es un anti-patrón del propio sistema de diseño. Para un **archivo alojado** no cambia
> nada: quitar las vistas simuladas es del **bloque D**, y mezclarlo acá habría dejado sin significado el
> recibo del próximo.
> **Verificación en las dos direcciones** por test: un enlace no renderiza ningún botón de vista previa y sí
> la explicación; un archivo conserva sus pestañas. **Y un límite honesto: la medición en vivo NO fue
> posible** — la página de recurso se renderiza en el cliente (su HTML inicial es `<title>Cargando…`), así
> que `curl` no ve ninguna de las dos ramas. Es un instrumento que no llega, no un negativo; la revisión
> visual de esa superficie es del autor.
> **Un test que el bloque D va a romper a propósito:** la dirección del archivo afirma **exactamente tres**
> botones de pestaña (`toHaveLength(3)`). Cuando D quite las vistas simuladas, esa aserción tendrá que
> cambiar — y esa es la intención: un cambio de comportamiento debe obligar a cambiar a mano el test que lo
> fija.
> **C3 CERRADO (2026-09-22): la ficha de un enlace dice la verdad.** `02caa9d` (+ los documentos).
> **Recibo quemado: `review-1e0335f5b0d1ee80` — APROBADA, 1 aviso informativo** (tier `medium`, **2 archivos
> / 72 líneas**, presupuesto de corrección 36), sobre el rango del código.
> **Qué cambió, y por qué era una afirmación falsa:** la ficha declaraba un **«Tamaño»** para los enlaces
> externos, y en los 35 recursos sembrados ese número **lo inventó el seed** — CKAN no puede pesar una URL
> externa sin descargarla. También declaraba un **«Nombre del archivo»** deducido del último segmento de la
> URL: una adivinanza, no un metadato. Las dos filas se van para un enlace; un **archivo alojado las
> conserva**, porque ahí CKAN reescribió la URL al camino de descarga y midió el tamaño al subirlo. La acción
> principal deja de prometer una descarga: para un enlace dice **«Abrir enlace»** (ícono `ExternalLink`), y
> para un archivo sigue «Descargar recurso».
> **El aviso del recibo (`R3-ISLINK-UNDEFINED`, línea 514) es un FALSO POSITIVO verificado, y la causa
> importa:** señaló el `{#if isLink}` de la acción como símbolo indefinido, pero **`isLink` se declara en la
> línea 332, que está FUERA del rango revisado** — la declaración la agregó C2, con su propio recibo quemado.
> O sea: **una revisión acotada al diff no puede ver una declaración que vive fuera del rango**, y esta clase
> de falso positivo es el precio conocido de revisar por slice, que es lo que protege el foco. **No hay nada
> que arreglar**: los 540 tests cubren las dos direcciones y ambas ramas renderizan lo correcto.
> **Fuera de alcance, anotado y no olvidado:** el botón «Descargar recurso» sobre un enlace y las filas
> del cuadro de metadatos que dicen «Nombre del archivo» (inventado desde la URL) **esperan la decisión
> diferida de la ficha**; y los chips de formato del buscador son **de dataset** (agregan varios
> recursos), no del tipo de un recurso.
> **DECIDIDO (autor, 2026-09-22): un enlace CONSERVA su ficha**, adelgazada a lo que un enlace realmente
> tiene. La duda era si valía una página «sólo por dos datos» (título y descripción, lo único que captura
> el mini-formulario de recursos); **el inventario medido muestra que no son dos**: `resource_show` de un
> enlace trae `name`, `description`, `url`, `created`, `metadata_modified`, `state`, `position` y
> `package_id` (el dataset, o sea la **procedencia**), y `format` **sólo si está declarado** — el asistente
> **no** manda `format` al crear un enlace. **Vacíos en un enlace** (son propiedades de un archivo
> alojado): `mimetype`, `hash`, `url_type`, `datastore_active`, `last_modified`. **Pesa además un argumento
> de comportamiento:** sin ficha, la misma fila de la lista se comportaría distinto según el tipo —una
> lleva adentro del portal y la otra saca al sitio externo sin avisar— y en un dataset mixto eso es peor
> que una página corta. **Lo implementa C3.**
>
> **COPIA — REVISIÓN DEL AUTOR (2026-09-22): el «asistente» que no era un nombre, y el requisito que ahora explica.**
> `187b5ba` (la copia) · `c823e37` (la cita del `TODO:`). **Recibo quemado: `review-11cc383a48faf9e7` —
> APROBADA, CERO hallazgos** (tier `medium`, **5 archivos / 37 líneas**, presupuesto de corrección 19).
> Rango por `baseRef=41b8670` explícito.
> **Las dos decisiones:** (1) «El asistente lo guía paso a paso» se **elimina** — la palabra nombraba algo
> que el portal nunca rotula así (el `h1` de esa pantalla dice «Crear dataset») y colisionaba con la idea
> de tutorial que sigue sin decidirse; el camino lo sigue ofreciendo el botón «Crear dataset» de abajo.
> (2) Los requisitos pasan a ser **causales**: «**Para crear el primero**, necesita pertenecer a una
> organización.» — así la primera oración describe lo que el lector ve y la segunda por qué no puede
> cambiarlo, en vez de apilar tres afirmaciones sin relación declarada.
> **Corrección de un error del agente, con su lección:** el agente afirmó que «asistente» aparecía en
> **una sola cadena visible**, y era falso — había truncado su propio `grep` con `head -12` y la salida
> llegó justo al límite. Quedaba una segunda aparición, en la descripción del CTA del panel
> (`dashboard/+page.svelte:216`), cerrada en el mismo slice. **Regla durable: nunca truncar una búsqueda y
> después afirmar completitud sobre ella**; el detector es comparar `grep … | wc -l` contra
> `grep … | head -N | wc -l` — si coinciden con N, el `head` está cortando.
> **Trampa evitada en los tests:** seis aserciones de `dashboard.test.ts` afirman la **ausencia** del
> requisito, así que un matcher viejo las habría dejado **verdes por vacío**. Se migraron todas, y cada
> una conserva un testigo **positivo** en la rama donde la oración debe aparecer (`:460` el de
> «pertenecer», `:411` el de «rol»).
>
> **ACCIÓN 3: Engram Cloud — falta una línea tuya y queda sincronizado.** Diagnóstico y mitad del cliente hechos
> el 2026-09-21:
> - **La sync nunca se rompió: el proyecto se RENOMBRÓ.** El servidor tiene
>   `project=open-data-plataform candidates=389 already_materialized=389` —el portal de este repo, **completo**,
>   bajo su **nombre viejo**—. Las sesiones ahora escriben en **`odp`** (resuelto del remoto git) y la allowlist
>   del servidor quedó con el nombre viejo → `403 project_forbidden`, no un fallo de red ni de auth.
> - **Hecho del lado cliente:** `engram cloud enroll odp` y `engram cloud enroll odp-docker`, más el token en
>   `~/.engram/cloud.json` → `Auth status: ready` y `Project enrollment: enrolled` en los dos. El chequeo
>   bloqueante del doctor pasó de `blocked: 1` a **`0`**.
> - **HECHO Y VERIFICADO (2026-09-21): el autor agregó `odp,odp-docker` a la allowlist y recreó el servicio, y los
>   dos proyectos SE SINCRONIZARON.** Prueba triple: la base de la nube lista **`odp | 383`** y
>   **`odp-docker | 19`** mutaciones; el log del servidor materializa los dos (`candidates=381` y `17`, todos
>   `already_materialized`); y el doctor bajó `pending_mutations_evaluated` de **398 a 1**. Se editó la línea 9 de
>   `/home/danielblc/docker/engram-cloud/.env` (backup en `.env.bak-20260921-195048`) y se recreó con
>   `docker compose up -d --force-recreate cloud`. **El paso era del autor**: el agente no puede editar ese archivo
>   (política de seguridad: contiene secretos).
> - **Los otros tres targets legados del doctor son el MISMO desajuste de nombres** (`proyectos` vs `projects` en
>   la allowlist; `danielblc` y `omarchy-on-cachyos` ausentes) → **decisión del autor: no entran**.
> - **Nota para no perder tiempo:** el `repair materialize-mutations` del cliente **no corre desde el host**
>   (quiere la base de la nube en `127.0.0.1:5433`, que no está expuesta). **No es un bloqueo**: el **servidor**
>   materializa solo para los proyectos que permite. **No exponer esa base para contentar a un CLI.**
> **ACCIÓN 4: rotar los tres secretos que esta sesión imprimió.** Un `docker inspect` volcó el entorno del
> contenedor de la nube e imprimió **`ENGRAM_CLOUD_TOKEN`**, **`ENGRAM_JWT_SECRET`** y la **contraseña de
> Postgres** en el log de la conversación. Como la memoria **ya está sincronizada en la nube**, rotarlos es una
> operación **limpia y sin riesgo de perder nada**: cambiar los tres en
> `/home/danielblc/docker/engram-cloud/.env`, recrear el servicio, y actualizar el token del cliente en
> `~/.engram/cloud.json` (esa última parte el agente puede hacerla; el `.env` está bloqueado por política de
> seguridad). **Lección, para no repetirla:** para leer variables de entorno, filtrar **por nombre de variable**,
> no volcar el entorno completo.
>
> **La sesión del 2026-09-21 cerró acá.** Nada quedó sin comitear en ninguno de los dos repos, la memoria de la
> sesión quedó en Engram (local **y** nube) y este bloque es el punto de arranque de la próxima.

> **Detalle histórico de los tres slices** — plan, mediciones, decisiones del autor y evidencia de las
> revisones, en `odd/tasks/v0-portal-honesty.md` y en las entradas que siguen.

> **Dónde quedó todo (2026-09-19).** El **slice A está cerrado y commiteado** en la rama
> `feat/v0-portal-honesty`, con tres commits **ya pusheados** (la rama está en sincronía con
> `origin/feat/v0-portal-honesty`): `33158ee` (el listado respeta los
> permisos), `c959285` (documentación del slice) y `7d27547` (paginación). «Mis datasets» ya trae los
> datasets que el usuario creó —incluidos los privados—, pagina de a 20 con rango compacto, y el badge
> muestra el total en vez del largo de la página.
>
> **Verificación viva hecha:** el usuario miró el portal real con 42 datasets (se sembraron 25
> temporales, creados por su propio usuario, para que el pie de paginación apareciera con 3 páginas) y
> confirmó que se ve bien. La siembra se purgó y se verificó: el catálogo volvió a **17 datasets, 1
> privado**, con 0 datasets y 0 organizaciones de la siembra. **No consta que haya clickeado las
> flechas**: si no lo hizo, A7 queda parcialmente verificado y hay que decirlo así.
>
> **Leer primero:** `odd/tasks/v0-portal-honesty.md` — tiene el plan de los tres slices, la
> transcripción de las sondas y el registro de decisiones del usuario.
>
> **Lo que falta de la feature, en este orden:**
> 1. **Slice B (D2 + D3) — CERRADO (2026-09-20).** La sonda de sesión, el CTA honesto y el aviso del login están
>    commiteados y **pusheados** (`5d51452` … `f7b5562`). El detalle, la medición y la verificación viva están en
>    `odd/tasks/v0-portal-honesty.md`. Lo que queda de la feature es sólo el slice C.
> 2. **Slice C (D4) — CERRADO Y REVISADO (2026-09-20).** El mapeo honesto de estado a mensaje, en cuatro
>    commits sobre `feat/v0-portal-honesty`: `5219055` (el helper de clasificación y la sonda que un `403`
>    necesita), `e99b81e` (la página de recurso deja de reportar un `403` como «Recurso no encontrado»),
>    `d3e2692` (la página de dataset renderiza desde la presentación compartida) y `05abdde` (la ronda de
>    correcciones que salió de las dos verificaciones independientes). Revisión nativa
>    `review-cd2510c28384457d`: **aprobada**, autoridad quemada, tres avisos no bloqueantes (ver la deuda
>    de revisión al final de este archivo). La spec que este slice enmienda —y donde vive su contrato— es
>    `openspec/specs/resource-detail-view/spec.md`; **no** es el requisito
>    `Distinguishable Authorization Errors` del ciclo de vida, que gobierna las respuestas HTTP del plugin
>    de CKAN y no cómo el portal las muestra.
>
> **Lo que queda de la feature, y no es código:**
> - **Revisión visual del autor — HECHA (2026-09-20), sin objeciones.** El autor abrió las URLs del
>   checklist en `http://localhost:8082` y aprobó lo que vio: los estados de la política de existencia
>   (anónimo indistinguible del inexistente, sesión viva sin permiso, sesión muerta con el aviso) y el
>   aviso del login. **Lo único que sigue sin ver** es la **cuarta variante** de copia del estado vacío del
>   dashboard (la de «requiere rol de editor o administrador»), que necesita una sesión sin permiso de
>   creación y por eso no se puede provocar a mano; la **hoja de copia** (`/dev/copy`) existe justamente
>   para cubrirla.
> - **Decidir el push y el PR.** La rama quedó **8 commits adelante** de
>   `origin/feat/v0-portal-honesty` (`ac17010` es HEAD); GitHub ofrece el PR y no se abrió. Push, PR y
>   merge siguen siendo decisión del autor.
>
> - **INCIDENTE DEL ENTORNO DEV: la suite de pytest de la extensión corre contra la BASE DE DEV y borra el
>   catálogo.** Causa raíz medida (sesión de `odp-docker`), y **no es el ini**: `test.ini` pide `ckan_test`,
>   pero el contenedor exporta `CKAN_SQLALCHEMY_URL=…/ckandb`, `CKAN_SOLR_URL=…/solr/ckan` y
>   `CKAN_SITE_ID=default`, y `update_config()` (`ckan/config/environment.py:100-113`) aplica
>   `CONFIG_FROM_ENV_VARS` **después** de leer el ini, así que **el entorno pisa el ini**. A/B medido: tras
>   `load_config("test.ini")` el dict dice `ckan_test`/`solr/ckan_test`/`test.ckan.net`; tras `make_app()` el
>   proceso ve `ckandb`/`solr/ckan`/`default`. Y `clean_db` **trunca**. Consecuencia: la suite **borra el
>   catálogo de dev** y deja documentos de Solr de datasets que ya no tienen fila — con `site_id=default`, así
>   que `package_search` **sí los ve**.
>   **Esto explica de una vez** los «orphaned index documents» que el `apply-progress.md` registró dos veces
>   (ventana `2026-09-14T23:40:46–23:41:18`, ~30 s = **una corrida de la suite**, no nuestras sondas) y el
>   catálogo que aparece y desaparece entre sesiones. **Nuestra explicación original era la correcta; las tres
>   reescrituras posteriores de esta entrada fueron atribuciones plausibles sin verificar:** primero «la suite
>   escribe en el core compartido», después «purges por SQL», después «documentos inertes con
>   `site_id=test.ckan.net`» — falso, porque en este contenedor la suite escribe `default`.
>   **ESTADO MEDIDO desde `odp`:** la base de dev quedó con **1** dataset (`dataset-gxfq-3729-arej`), **2**
>   organizaciones y **1** usuario (`odean`), todo residuo de factory creado el `2026-09-21T16:33:55`. Y
>   **0 filas en `state=deleted` significa que la suite TRUNCÓ, no borró** — por eso el catálogo no dejó rastro.
>   **CORRECCIÓN (2026-09-21): «no hay ningún sysadmin» era FALSO, y el error fue de medición.** `user_list`
>   llamado **sin sesión no devuelve la tabla: devuelve el llamante**, y de esa respuesta inferí «1 usuario,
>   ningún sysadmin». El CLI dice la verdad: **2 usuarios, y `default` es `sysadmin=true`** — pero `default` es
>   **residuo de tests** (`created` dentro de la corrida; `test_auth.py:62` usa
>   `ctx = {"user": "default", "ignore_auth": True}`) y su contraseña es **inalcanzable** (`fake.password` de la
>   fábrica `User`). **Formulación correcta, y la diferencia es operativa: «falta la CREDENCIAL, no el
>   sysadmin»** — decir «no hay sysadmin» mandaría a alguien a **crear el primero**, cuando lo que hace falta es
>   **reponer la credencial de un rol que ya existe como fila de test**. **Trampa de medición, de la misma
>   familia que las otras: `user_list` es *caller-scoped*.** **Y la QUINTA, que se comió la otra sesión:
>   comprobar un token contra una acción que NO discrimina** — `user_show` sin `id` da **404 para todos** y
>   `api_token_list` sin `user_id` da **409 para todos**, así que «token válido» y «basura» responden igual.
>   Familia: **una medición que devuelve el mismo resultado para la hipótesis y para el control no mide nada.**
>   **Y su corolario, que me comí yo una hora después:** cuando la hipótesis y el control coinciden,
>   **sospechá del instrumento de medición —la extracción— antes que de la hipótesis.** Mi doble 403 era
>   *correcto por la razón equivocada*: la extracción del token devolvía **vacío**, así que lo que probé como
>   «token» era, literalmente, la ausencia de token. **El control negativo también hay que verificarlo.**
>   **Y una SÉPTIMA, medida hoy en carne propia: `pgrep -f <patrón>` matchea su PROPIO comando** cuando la línea
>   de comando del shell contiene el patrón. Casi reporto «hay un `pytest` corriendo y puede truncar la base de
>   dev» —**falso**: `pgrep` se encontraba a sí mismo. El instrumento medía el instrumento. **Verificación:**
>   filtrar el propio `pgrep`/`grep` de la salida, o mirar `/proc/*/cmdline`.
>   **RECUPERACIÓN, HECHA Y VERIFICADA (2026-09-21).** No hizo falta ninguna credencial nueva: `prerun.py:161`
>   recrea el admin **desde el propio entorno del stack** (`CKAN_SYSADMIN_NAME`/`CKAN_SYSADMIN_PASSWORD`/
>   `CKAN_SYSADMIN_EMAIL`, ya definidas en el contenedor), así que alcanza con ejecutar lo que el `prerun` haría:
>   `docker exec odp-dev-ckan-dev-1 sh -lc 'ckan -c /srv/app/ckan.ini user add "$CKAN_SYSADMIN_NAME"
>   password="$CKAN_SYSADMIN_PASSWORD" email="$CKAN_SYSADMIN_EMAIL" && ckan -c /srv/app/ckan.ini sysadmin add
>   "$CKAN_SYSADMIN_NAME"'`. **La contraseña nunca se imprimió** (se lee del entorno del contenedor). Después,
>   `scripts/seed-ckan.mjs` con ese mismo valor vía `docker exec … printenv`: **16 datasets creados, 0 existían**,
>   y el token del seed **revocado de verdad** (`ckan_admin` quedó con **0 tokens**, verificado listando —
>   `success` no es evidencia). **Estado tras la recuperación:** `package_search` (Solr) = **17** y
>   `package_list` (base) = **17** —**las dos capas coinciden**, que es la condición para creer cualquier
>   medición viva—, con **16 del seed** y **1 residuo de fábrica** (`dataset-gxfq-3729-arej`) más 2 orgs de
>   fábrica y 2 usuarios (`default`, `odean`).
>   **AUSENCIA MEDIDA, no causalidad medida:** `ckan_admin` **no existía** (medido a las 16:46), y el contenedor
>   arrancó el `2026-09-20T00:45:51Z` (≈1,7 días, **no** 40 como se dijo). **Sin dump no se puede saber *cuándo*
>   desapareció ni *quién* la borró**: lo que sí está medido es que **el único mecanismo del stack que borra
>   usuarios es la truncación de `user` que hace `clean_db`**, y que nada lo recreó porque **no hubo reinicio
>   después**.
>   **REGLAS OPERATIVAS (adoptadas):**
>   1. **Nunca correr la suite sin neutralizar las cinco variables del entorno**
>      (`docker exec -e CKAN_SQLALCHEMY_URL=…/ckan_test -e CKAN_DATASTORE_WRITE_URL=…/datastore_test
>      -e CKAN_DATASTORE_READ_URL=… -e CKAN_SOLR_URL=…/solr/ckan_test -e CKAN_SITE_ID=test.ckan.net …`).
>      Receta **verificada**: 22 passed y la base de dev **intacta**.
>   2. **Después de correr los tests de la extensión** —que es lo que produce los huérfanos, **medido**—:
>      `ckan -c /srv/app/ckan.ini search-index rebuild --clear`. **El sujeto importa y antes estuvo mal escrito:**
>      la pasada de sondas del 2026-09-14 **dejó el índice consistente** —§5 del `preproposal.md`:
>      «anonymous `*:*` back to the 16 seeded datasets, **0 probe datasets**, 0 probe organizations»—, mientras
>      que **cada corrida de la suite** deja 12–20 documentos con nombres de factory. Atribuir los huérfanos a
>      nuestras sondas fue un error que **nuestro propio `preproposal.md` refuta** (§2.4 fecha la pasada a las
>      `21:54:46`; los 20 documentos son de las `23:40:46–23:41:18`, una hora y cuarenta y seis minutos después).
>      Que un `dataset_purge` por CLI/SQL **también** pueda dejar el documento es **lectura de código**
>      (`delete.py` no referencia el índice), **no medición** — no lo trates como medido.
>   3. Antes de cualquier verificación viva: comparar `package_search` (Solr) contra `package_list` (base) y
>      **re-sembrar si la base quedó con residuo de tests**.
>   **Datos extra que sirven:** `clear_index()` borra filtrando por el `ckan.site_id` configurado, así que un
>   rebuild **no puede** alcanzar documentos de otro `site_id`; y `ckan.search.automatic_indexing` **no existe**
>   en CKAN 2.11.6 (verificado con grep). **Defectos latentes del `.env` de `odp-docker`:**
>   `TEST_CKAN_SQLALCHEMY_URL` usa el rol `ckan`, que **no existe** (el env var lo enmascaraba), y
>   `TEST_CKAN_SOLR_URL` apunta al core compartido; además los `TEST_CKAN_*` son **decorativos** porque los
>   `CKAN_*` del entorno ganan. **Pero «decorativos» sólo vale DENTRO del contenedor de la app**: fuera de él
>   —un venv pelado, otro host, un CI que no exporte `CKAN_SOLR_URL`— el ini es **la única protección**, así que
>   **la línea `solr_url` de `test.ini` se conserva**: el runner cubre la **invocación**, no la **portabilidad**.
>   Son dos defensas distintas y no una redundante. El arreglo durable es un runner que exporte los `CKAN_*` desde los `TEST_CKAN_*`.
>   **ACTUALIZACIÓN (2026-09-21): el runner ya existe y está verificado.** `ckan-docker/bin/test-umss` (nuevo,
>   ejecutable) **deriva** las URLs de test de los valores propios de la app **dentro** del contenedor
>   (`${CKAN_SQLALCHEMY_URL%ckandb}ckan_test`) —así no pueden desincronizarse del `.env`— y **se niega a correr
>   si alguna no contiene `_test`**; también crea el core `ckan_test` si falta. Verificado:
>   `./ckan-docker/bin/test-umss -q` → **22 passed**, `ckandb` idéntica (mismos timestamps), core compartido
>   23 → 23, core `ckan_test` 22 → 44. **Este comando reemplaza a la receta manual de la regla 1.**
>   **Y una advertencia que sale de su propia revisión nativa: la versión que citábamos tenía un AGUJERO en el
>   guard.** `review-df2b5906cb9cc5ea` (tier high, 4 lentes) encontró **dos CRITICAL `introduced`**: el guard
>   verificaba `*_test*` contra el **string entero**, así que una URL con query string lo pasaba y `pytest`
>   quedaba apuntando a `ckandb`. Se cerró en **`a52b789`** (ahora chequea el **nombre de la base**, no el string)
>   y **`537bd5d`** (comillas dentro del payload remoto, que mataban la invocación al arrancar; la corrección
>   anterior de ese mismo arreglo fue **rechazada por el validador dirigido** y dejó el linaje **escalado**).
>   **La regla 1 cita esos dos commits: un `bin/test-umss` anterior a ellos protege menos de lo que parece.**
>   La segunda revisión (`review-a170de21520dccd5`, mismo tier y lentes, 16 archivos / 536 líneas) cerró
>   **aprobada** con 11 hallazgos informativos.
>   **Dos trampas operativas que dejó, y valen para nuestras propias recetas:** (a) **`bash -n` NO valida el
>   payload embebido** — pasa aunque el payload esté roto, porque el fallo ocurre en **expansión**, no en el
>   parseo; hay que ejecutar el camino real. Aplica directo a nuestras recetas con `docker exec … bash -lc '…'`,
>   que embeben payload igual. (b) **El relay concurrente de un grupo de lentes puede truncar un resultado** (se
>   cortó en el byte 3015): correr las lentes **de a una** si pasa — single-slot no falló nunca, con payloads de
>   2 954 a 5 738 bytes.
>   **RESUELTO EN EFECTO (2026-09-21), y con una corrección de ruta nuestra:** el archivo es
>   **`odp-docker/ckan-docker/.env`** (hay **dos** `.env`: el de la raíz para el compose, y este) — antes lo
>   citamos sin el tramo `ckan-docker/`. Verificado por mí: el contenedor ve los `TEST_CKAN_*` **correctos**
>   (`@db/ckan_test`, `solr/ckan_test`, `@db/datastore_test`), `test-core.ini` se regeneró correcto tras el
>   reinicio, y **`.env.example` quedó arreglado y comiteado** en `3adab85`. Las tres líneas que pedíamos eran:
>   `TEST_CKAN_SQLALCHEMY_URL=postgresql://ckandbuser:ckandbpassword@db/ckan_test` (usaba el rol `ckan`, **que no
>   existe**), `TEST_CKAN_DATASTORE_WRITE_URL=postgresql://ckandbuser:ckandbpassword@db/datastore_test` y
>   `TEST_CKAN_SOLR_URL=http://solr:8983/solr/ckan_test` (apuntaba al core compartido). **No queda nada abierto
>   acá.**
>   **Defecto lateral reportado (en `odp-docker`, sin tocar):** `ckan-docker/docker-compose.dev.yml` **no declara
>   `name:`**, así que resuelve a otro proyecto Compose — los otros `bin/*` (`ckan`, `reload`, `compose`, `shell`,
>   `restart`) **están rotos** contra este stack.
>   **Y lo importante para nosotros: hasta que no se re-siembre, NINGUNA medición viva es válida.** `ckandb`
>   sigue con el residuo de la corrida de las 16:33 y `package_search` devuelve 1, que **también** es residuo.
>
> **Advertencias de entorno, aprendidas a golpes (2026-09-19):**
> - **La revisión nativa no arranca sin `~/.pi/gentle-ai/models.json`.** El routing de modelos de los
>   revisores **no tiene fallback** y se niega tipado si falta la entrada del rol. Quedó configurado
>   con los seis roles (`review-risk`, `review-resilience`, `review-readability`, `review-reliability`,
>   `review-refuter`, `review-validator`) en `deepseek-flash` con `thinking: high`.
> - **Mientras una revisión esté viva, no se toca el repo:** el binding lleva clavada la
>   `expected-revision` y cualquier edición invalida el slot reofrecido.
> - **`pnpm lint`: la evidencia real sale del binario directo, no del lanzador de pnpm.** El binario es
>   `node_modules/.pnpm/@biomejs+cli-linux-x64@2.5.0/node_modules/@biomejs/cli-linux-x64/biome`. Diagnóstico
>   corregido y arreglo pendiente, **más abajo** (entrada del 2026-09-22).
> - **La revisión nativa no se puede correr desde un subagente:** el tool no está en su inventario. El
>   hijo debe **escalar el handoff al padre**, que es quien tiene la facade.
> - **Biome escanea todo el repo** (no ignora `openspec/`): un archivo con extensión `.ts` fuera de
>   `src/` se lintea y rompe el gate. Por eso el expediente del borrador está como `.ts.txt`.
> - **Los tests de ruta NO se llaman `+page.test.ts`.** SvelteKit reserva los archivos con prefijo `+` bajo
>   `src/routes` y `svelte-kit sync` se cae con `Files prefixed with + are reserved`. Se nombran por la ruta:
>   `dashboard.test.ts`, `wizard.test.ts`, `login.test.ts`.
> - **`pnpm lint` falla en el camino de `spawn` de pnpm, NO por el código ni por la carga de la máquina
>   (medido 2026-09-22).** `pnpm lint` → exit 254 («Linter process terminated abnormally») **y `pnpm exec biome
>   --version`, que no lee ningún archivo, falla igual** → la causa no puede estar en el repo. El binario
>   directo arranca sin problema y sobre el árbol actual reporta **122 archivos, 0 errores, 4 warnings, 7
>   infos**. En esta sesión fue **determinista (2/2)**, así que «intermitente según la carga» era una causa no
>   medida: lo que discrimina es **`npm_config_shell_emulator=true pnpm lint` → exit 0** (deducción, no
>   medición: apunta al spawn de pnpm — Node 26.9.0 + pnpm 10.12.1 — y no a Biome).
>   **Consecuencia operativa: el gancho `.husky/pre-commit` cancela el commit**, porque corre `pnpm exec biome
>   check --staged --write`. La evidencia equivalente se obtiene corriendo **ese mismo comando con el binario
>   directo** (0 fixes aplicados sobre los archivos staged), y recién entonces `git commit --no-verify`.
>   **Arreglo pendiente para el autor** (commit de infraestructura propio, avisado): o `shell-emulator=true` en
>   `.npmrc`, o fijar Node LTS en `mise` (el CI corre Node 22 y no se ve afectado).
> - **CORRECCIÓN (2026-09-23): «determinista» no se sostiene.** Medido en esta máquina y sobre este mismo
>   árbol: **`pnpm lint` corrió 7 veces y 6 dieron exit 0** (`Checked 135 files · 4 warnings · 7 infos`); sólo
>   la **primera** de la sesión imprimió `[warn] Linter process terminated abnormally`. Es una
>   **intermitencia**, no un fallo determinista — el «2/2» de arriba era una muestra demasiado chica.
>   El arreglo del `.npmrc`/Node LTS **sigue valiendo** (elimina la causa del spawn), pero **ya no hay que
>   asumir que el gate está roto**: probá `pnpm lint` antes de darlo por caído y usá el binario directo sólo
>   si vuelve a caer. `pnpm exec biome --version` sigue siendo la sonda que separa repo de entorno.
> - **El prefijo `?expired=1` es el contrato entre la expulsión y el login**: si se renombra el parámetro hay que
>   cambiarlo en `src/lib/session.ts` y en los tests que lo fijan por URL.

## Replanificación pendiente — cambio `2026-09-13-publication-lifecycle`

> **Dónde quedó todo (2026-09-16).** El **modelo de producto fue revertido** y el PRD ya está firme para
> esta feature. Los artefactos del cambio SDD quedaron **obsoletos** (el `proposal.md` lleva el aviso al
> inicio) y el PR 2 viejo está **aparcado**. Nada quedó a medias ni roto: el stack de dev está `healthy`,
> el catálogo intacto (5 orgs, 17 datasets) y el guard del PR 1 mergeado — aunque **insuficiente**, ver el
> punto 1.
>
> **Leer primero, en este orden:**
> 1. `PRD.md`: §3 y §7 (los 3 niveles y su mapeo real a CKAN), `RF-15` (flujo, con el **paso 5
>    obligatorio**), `RF-41`/`RF-42` (degradación, los dos casos), §8, §9 y `RF-33` (auditoría).
> 2. `BACKLOG.md` → «En curso» → el bloque del cambio: tiene **las decisiones, sus motivos y las citas de
>    línea del PRD**. Es lo más denso y lo más útil de todo lo escrito hoy.
> 3. `openspec/changes/2026-09-13-publication-lifecycle/proposal.md`: el aviso de obsolescencia de D1–D7.
>
> **Corrección medida (línea CKAN, 2026-09-29): `ckanext-umss` NO es un andamiaje `IConfigurer` vacío** — y eso toca
> la premisa de **D1**, que es «no permissions, no actions, no hooks» en `explore.md:177`, `preproposal.md:47` y
> el árbol de decisión de `proposal.md:53`. Medido con un spy sobre el registro de auth
> (`ckan.authz._AuthFunctions._functions`, porque `chained_auth_function` registra un `functools.partial` y
> reemplazar el nombre en el módulo no intercepta nada): `ckanext/umss/plugin.py` registra **`IAuthFunctions`** con
> dos funciones **encadenadas** sobre `package_create`/`package_update`, y `ckanext/umss/auth.py` implementa la
> barrera de publicación (sólo el `admin` de la organización publica o cambia `state`). A la función encadenada le
> llega **el payload de la request**, no el paquete aplanado, así que la omisión de recursos no cambiados que
> introduce 2.12 (#5713) **no** afecta a esa regla. Evidencia cruda: `odp-docker/odd/tasks/s5-remaining-rows.md`;
> regresión permanente en `ckanext-umss/.../tests/test_auth.py` (suite 54 verde).
> **Decidido y aplicado (2026-09-29, orden del autor: «hazlo»): la corrección aterrizó en los artefactos del
> cambio.** El bloque completo está en `explore.md` §2.3, y los **ocho** sitios que afirmaban la premisa llevan
> marca o puntero —`explore.md:177` (marca `[STALE]` en la celda), `:225`, `:306`, `:461`; `preproposal.md:47` y
> `:150` (la fila de D1); `proposal.md:54` y `:136`—. **El texto original no se borró en ningún sitio:** queda
> visible y marcado, que es como este proyecto conserva el histórico.
> **Verificado de forma independiente en `odp-docker`**, no sólo heredado de la línea CKAN: `plugin.py` implementa
> `IAuthFunctions` y `auth.py` tiene las dos funciones encadenadas (`package_update:122`, `package_create:155`) más
> `_is_approver` con la capacidad `admin`. **Consecuencia para la replanificación:** el encuadre «código nuevo
> dentro de un andamiaje vacío» de D1 ya no vale, ni la estimación que se apoyaba en él — **el guard existe y hay
> que leerlo, no escribirlo**.
>
> **Plan, en orden:**
>
> 1. **Replanificar el cambio** con el modelo del PRD: `proposal → spec → design → tasks`. Acá caen las
>    decisiones de diseño grandes:
>    - **`publication_requests` en `ckanext-umss`**: tabla + migración, con el esquema de `PRD:308`.
>    - **Acciones y autorización de la cola**: crear solicitud, listar pendientes, aprobar, rechazar.
>    - **Cómo el guard consulta la solicitud aprobada.** Es el trabajo que el PR 1 necesita y no tiene, y
>      **la decisión más difícil del rediseño**: conviene resolverla antes de escribir una línea de código.
>    - **Dónde vive la cola del aprobador en el portal.**
> 2. **Confirmar 2 detalles del PRD** redactados hoy sin objeción pero sin confirmación explícita: que una
>    solicitud **pendiente se anula** si un admin degrada directo, y que la degradación **exige motivo**.
> 3. **Asignar tier** a `RF-41`/`RF-42` (`v0` / `v1` / `v1+`): hoy no tienen.
> 4. **Lo aparcado que sirve**: la rama `wip/pr2-directo-publicacion` tiene el componente viejo. Lo
>    reutilizable son el manejo honesto del `403`, la regla «un `200` que no concede no es un éxito» y las
>    dos máquinas de estado — la cola del aprobador va a necesitar exactamente eso.
> 5. Recién después, `apply`. **El gate de presupuesto va ANTES de aplicar**, con la regla nueva de
>    `openspec/config.yaml` (tres líneas: código, tests derivados de la proporción medida, y material de
>    revisión aparte que no compite).
>
> **Dos advertencias de repositorio:**
> - La tabla, las acciones y el guard viven en **`odp-docker`**, que es **otro clon Git**. Ver «Deuda de
>   revisión (RDD)» para el trámite de la revisión y **cuándo** hacerla (después del rediseño, no antes).
> - **Los `.override` de `ckan-docker/ckan/setup/` son archivos MUERTOS — y acá había un defecto INVENTADO.**
>   Medido (2026-09-21): **ningún Dockerfile los copia** (`override` aparece **0** veces en `Dockerfile.umss`,
>   `Dockerfile.dev.umss`, `ckan/Dockerfile` y `ckan/Dockerfile.dev`); lo único que los menciona es
>   `ckan-docker/README.md:217`, que **instruye** a agregar la línea `COPY …/start_ckan.sh.override …` y esa línea
>   **nunca se agregó**. Por eso el script **efectivo** del contenedor es el de la imagen base —**idéntico byte a
>   byte a `ckan/ckan-dev:2.11`**— y **no tiene ningún mint**: `grep -c "user token add"` da **0** en
>   `start_ckan.sh` y en `start_ckan_development.sh`, y ambos escriben el **placeholder `xxx`**. **Consecuencia:
>   la versión anterior de esta entrada describía un «mint roto en el arranque» que NO EXISTE** — una afirmación
>   que llegó escrita como medida y que la sesión de `odp-docker` retractó con evidencia. El único mint real es
>   `docker-entrypoint.d/01_setup_datapusher.sh`, y **funciona** (verificado desde acá: el token autentica →
>   **200**, basura → **403**, sin token → **403**). **El registro correcto del bug real del datapusher ya estaba
>   en el repo:** `apply-progress.md:438-453` y `tasks.md:74-75` —era `01_setup_datapusher.sh` blanqueando el
>   token— y ya está arreglado.
>   **FAMILIA DE TRAMPA Y SU CONTRA-MEDIDA** (aporte de esa sesión, y **es lo que zanjó el caso**): afirmar **qué
>   archivo se ejecuta** es una afirmación sobre el **build**, no sobre el árbol de fuentes — y la variante cruel
>   es que los archivos citados **existan, se lean bien y no se ejecuten**. Se derrota con **un solo movimiento:
>   `diff` del artefacto contra la fuente** —`/srv/app/start_ckan_development.sh` del contenedor contra el de
>   `ckan/ckan-dev:2.11` → **idénticos**, más `grep -c "user token add"` → **0**—. Sin ese diff, los `.override`
>   seguían pareciendo código vivo y la afirmación seguía siendo plausible. **Cuando el reclamo es «este archivo
>   hace X», la medición es el diff contra lo que corre, no la lectura del repo.**
> - **El escenario de la línea `COPY` quedó CERRADO, con una nota histórica que vale:** los tres `.override`
>   muertos **se borraron** en `9cb4fff` (`chore(ckan): drop the setup/*.override scripts that nothing copied`,
>   4 archivos, **+1 −369**), junto con el bullet del README que documentaba el patrón. Así que ya no hay nada
>   que se pueda activar por accidente. Lo que ese override traía —un **loop de auto-instalación de extensiones**
>   (`pip install -r requirements.txt`, `setup.py develop`, reescribir el `use = config:` de cada `test.ini`) que
>   el script efectivo no tiene— **explica por qué existe `bin/install_src`**: ese loop nunca corrió.
> - **Riesgo residual CORRECTO, y el modo de falla NO es el crash loop** (análisis de la sesión de `odp-docker`,
>   **corroborado por el propio código**: el comentario de `docker-entrypoint.d/01_setup_datapusher.sh:12` dice
>   que un token **vacío** hace que el plugin se niegue a configurarse): el único escritor del token es ese
>   entrypoint, con el guard `if [ -z "$CKAN__DATAPUSHER__API_TOKEN" ]`, y la imagen base deja
>   `ckan.datapusher.api_token=xxx` (guardado por el chequeo de plugins). Entonces, si alguien setea
>   `CKAN__DATAPUSHER__API_TOKEN` con un valor **no vacío pero inválido** —un token viejo, un placeholder—, el
>   mint se saltea, el ini queda en `xxx` —que es **truthy**, así que el plugin **configura sin protestar**— y el
>   datapusher recibe **403 en la callback y no manda nada al DataStore, EN SILENCIO**. **No es «vuelve el crash
>   loop»: es un fallo silencioso**, y eso es **más difícil de detectar** que el crash loop que arregló `aa916e7`.
>   Con un valor vivo todo funciona, que es la intención del env var. **Estado actual: SANO** — el token es real
>   (197 chars) y autentica (200 · basura 403 · sin token 403, medido desde acá).
>   **Quedan DOS puntos abiertos en ese repo, los dos del autor:** (a) qué hacer con el guard
>   —documentarlo, dejar de depender de la variable, o aceptar el riesgo—; y (b) el **`ROOT` relativo de los siete
>   `bin/*`**, ofrecido por esa sesión y **sin detalle medido de mi lado**. Del resto del hilo **no queda nada**: el
>   «mint roto» era falso, los tres `.override` muertos ya se borraron y los siete `bin/*` ya apuntan al compose
>   correcto.
>   **Estado del repo `odp-docker`, verificado desde acá:** **6 commits sin pushear** —`3adab85` (runner de tests
>   + `.env.example`), `346764c` (ignorar el runtime local de Pi), `3e4399e` (los siete `bin/*` al compose
>   unificado), `9cb4fff` (borrar los tres `.override`), y los dos que **cierran el agujero del guard**: `a52b789`
>   y `537bd5d`— con **árbol limpio**. El hilo entre sesiones quedó **cerrado de los dos lados** el 2026-09-21.
> - **Y un arreglo real, ya hecho del otro lado (commit `3e4399e`):** los siete `bin/*` apuntaban a
>   `docker-compose.dev.yml`, que sin `name:` resuelve al proyecto `ckan-docker` (sin contenedores); ahora usan
>   el unificado. Verificado desde acá: **`bin/compose ps` lista los siete `odp-dev-*`**.
> - **RESUELTO (2026-09-21, 17:07): el reinicio se hizo** —autorizado por el autor, y **motivado por el token
>   huérfano**, no por `test-core.ini`— **y el datapusher quedó arreglado — verificado por mí.** Con el
>   token leído de `ckan.ini` (**197** chars): `api_token_list` → **200**; con token basura → **403**; sin token →
>   **403**. Discrimina. Y `test-core.ini` se regeneró correcto (`ckandbuser@db/ckan_test`, `solr/ckan_test`). El
>   catálogo **sobrevivió** (17/17) porque `prerun` corre `init_db` idempotente y no re-siembra. Lo de abajo es el
>   registro de **por qué** hacía falta.
> - **CORRECCIÓN de lo que escribí antes: el restart SÍ tiene hoy un motivo real, y NO es cosmético — el token
>   del datapusher está MUERTO.** `ckan.datapusher.api_token` de `ckan.ini` es **huérfano**: `clean_db`
>   **truncó la tabla `api_token`** a las 16:33 y nadie re-minteó, así que **ningún** token autentica (medido:
>   `api_token_list?user_id=<el id de `default`, `366a437a-…` — **no** el de `ckan_admin`, que es `224fbb8f-…`>` con
>   el token configurado → **403**, idéntico a un token basura y a sin
>   token; la tabla tiene **0 filas**). **Consecuencia: la callback del DataPusher no se autentica → los recursos
>   NUEVOS no llegan al DataStore**, así que la vista previa de CSV falla **también para archivos subidos**, no
>   sólo para los sembrados (que son enlaces). **El restart es el arreglo de diseño y es seguro para el
>   catálogo** (`prerun` corre `init_db`, idempotente, y **no re-siembra**): `CKAN__DATAPUSHER__API_TOKEN` está
>   **ausente** del entorno, así que `docker-entrypoint.d/01_setup_datapusher.sh` re-mintea con la forma correcta
>   (`expires_in=365 unit=86400`). **Recomendación: reiniciar cuando la app esté ociosa, y antes de cualquier
>   trabajo que toque subida de recursos o la vista previa del DataStore.**
> - **Aparte de eso, lo que el restart aporta es secundario.** `prerun.py.override:160-195` recrea el admin
>   (idempotente: si el usuario existe, sale) y reescribe `test-core.ini` desde los `TEST_CKAN_*` corregidos;
>   lo segundo es **decorativo dentro del contenedor**, porque el entorno gana. Y **el restart no re-siembra**:
>   eso lo hace `scripts/seed-ckan.mjs`. El admin se restauró **sin** restart, ejecutando lo que el `prerun`
>   haría. **Mientras no se reinicie, `test-core.ini` conserva los valores viejos** (`postgres://ckan:ckan@db/ckan_test`
>   y `solr_url = …/solr/ckan`): un `pytest` corrido **a mano** ahí sigue siendo **la ruta destructiva**. El
>   runner es la salida. **OJO — esto corrige una conclusión optimista de la otra sesión:** el reinicio regeneró
>   `test-core.ini`, pero **el contenedor SIGUE exportando `CKAN_SQLALCHEMY_URL=ckandb`, `CKAN_SOLR_URL=ckan` y
>   `CKAN_SITE_ID=default`** (verificado después del reinicio), así que **dentro del contenedor el entorno sigue
>   pisando el ini: un `pytest` corrido a mano ahí SIGUE truncando la base de dev.** La regeneración cierra el
>   caso **fuera** del contenedor; **el runner sigue siendo obligatorio dentro** — no es redundante. **La frase
>   que hay que recordar: «el archivo quedó bien» NO es «la ruta quedó cerrada».** Y el error fue **simétrico**:
>   yo escribí «el ini es decorativo» (sin acotar) y la otra sesión escribió «la ruta quedó cerrada por el ini»
>   (tras el reinicio); los dos mezclamos **el archivo** con **el runtime que ejecuta pytest**.
>   **El MECANISMO, que hace la regla derivable en vez de memorizable — el `.env` tiene dos mitades que se
>   comportan distinto:** `TEST_CKAN_*` alimenta el `test-core.ini` que se **regenera en cada arranque** → cambia
>   **el archivo**, y el archivo pierde contra el entorno. En cambio `CKAN_SQLALCHEMY_URL` / `CKAN_SOLR_URL` /
>   `CKAN_SITE_ID` son lo que el contenedor **exporta** y lo que `update_config()` aplica **después** del ini →
>   **esa mitad es la que decide** para cualquier proceso que corra adentro. Por eso el `.env` vivo importa
>   **exactamente lo mismo que el `test-core.ini`: sólo fuera del contenedor.**
>   **Y la inferencia falsa que hay que matar de entrada, porque es la que va a cometer cualquiera:** «ya arreglé
>   las `TEST_CKAN_*`, entonces puedo correr `pytest` a mano» → **trunca `ckandb` igual**. Arreglar el `.env` de
>   tests **no cierra** la ruta destructiva; lo único que la cierra **adentro** es `bin/test-umss`.
>   **Verificación independiente de la recuperación (2026-09-21):** `package_list` (base) = **17**,
>   Solr `fq=site_id:default` = **17**, y **el diff de los dos conjuntos de nombres está vacío** — son
>   idénticos; `package_search` anónimo = 17. Es la primera vez en todo el incidente que la regla (c) pasa
>   exacta. El core compartido tiene **39** documentos: 17 de `default` (legibles, todos con fila) + **22 de
>   `test.ckan.net`** (inertes, sin fila, que ningún rebuild limpia — se dejan como están, por acuerdo).
>
> **Trabajo independiente, cuando se decida:** los bugs `v0` de la revisión de UI (ver esa sección), la
> pregunta del facet de licencia (`v1`), y las dos features pesadas que el usuario **aparcó
> explícitamente**: el **análisis de CSV** y la **auditoría** (`RF-33`/`RF-34`, que es su propia feature
> con su propio store). La **prueba de carga** va después de tener el CRUD completo.

## Plan B — dashboard + publicación (cerrado 2026-09-12)

> Ejecutado y cerrado. «Plan B» = las features pendientes del plan S-A…S-E, ahora completas:
> S-A ✅ · S-B ✅ · S-C PR1+PR2+PR3 ✅ · S-D ✅ · S-E ✅. El «Plan A» (alineamiento visual del
> portal) quedó cerrado antes.

- [x] **PR3 de `dataset-publishing`** — wizard en `/dashboard/datasets/new` + CTA del dashboard
  (commit `157d6d2`). Absorbidos los 3 hallazgos de PR2 (`R3-no-timeout`, `R3-nonjson-200`,
  `R3-slug-boundary`). Revisión RDD `approved` (lineage `review-c9dee8d0f9b7ef4a`, tier medium,
  lente reliability); 3 hallazgos advisory informativos.
- [x] **S-D · Dashboard real** — `/dashboard` lista "Mis datasets"
  (`current_package_list_with_resources`) y "Mis organizaciones" (`organization_list_for_user`),
  con estados independientes de carga/vacío/error (commit `1dfa399`). Revisión RDD `approved`
  (lineage `review-076d16ba6c6ee758`, tier medium, lente reliability); 2 hallazgos advisory.
- [x] **Recursos por enlace (RF-11/RF-13)** — el wizard ahora adjunta un recurso como URL externa
  (`resource_create` en JSON, sin bytes). Commit `f0d30f3`. La verificación destapó que el PRD exige
  enlaces y el proposal los había sub-escopeado. La primera revisión cerró en `escalated` (2
  hallazgos: allowlist de esquema `http`/`https` y test del camino de fallo) y el candidato corregido
  cerró `approved` (lineage `review-656da6beeca5d9e9`).
- [x] **Verificación Fase 4 + archivado** — verificación nativa `pass` (13/13 requisitos, 35/35
  escenarios, 37/37 tareas); E2E contra el stack dev con `package_create` + `resource_create`
  multipart de 50 MB exactos por el proxy. Cambio archivado en
  `openspec/changes/archive/2026-09-11-dataset-publishing/` (commit `1b7c33d`) y spec promovida a
  `openspec/specs/dataset-publishing/spec.md`.

## Plan C — pulido de UI (cerrado 2026-09-13)

> **Estado: CERRADO.** El dashboard y el wizard están **promovidos y en `main`**, y el playground
> (`src/routes/dev/dashboard/datasets/new/`, material de la regla 8 de `AGENTS.md`) **se borró** al
> terminar. Los commits y las revisiones están en «Promoción del wizard (Plan C) — CERRADA», más abajo.
>
> Lo que sigue es el **registro de la iteración**: qué se decidió y qué se verificó mientras se diseñaba.
> Los ítems marcados están **implementados** en la promoción; se conservan por el razonamiento
> verificado que llevan adentro (mediciones contra CKAN, causas raíz), no como trabajo pendiente. Los
> que siguen abiertos están marcados como tales.
> Ya aprobado: márgenes y centrado (`max-w-7xl`), resumen fijo a la derecha, visibilidad fuera del
> formulario, pestañas «Archivo | Enlace» y el estilo propio (sin `nova`).
> **Descartado:** la barra pegajosa de envío (las acciones van fuera del resumen, en la columna
> derecha) y el acordeón de «Metadatos adicionales».
> **Resumen:** la «Ficha de publicación» rediseñada **reemplazó** a la anterior (eyebrow coral
> «Resumen», barra de completitud de datos recomendados —oculta si no hay título—, datos con iconos,
> lista de recursos y bloque de pendientes no bloqueante).
> **Recursos:** rediseñados como **mini-form** de alta/edición (Título + Descripción + tipo en
> pestañas + «Agregar recurso») sobre una **lista compacta** con lápiz para editar y papelera.
> **Labels:** la separación label↔campo es una **variable CSS** (`--label-offset`) con control de
> pasos en la barra del playground; elegido el **paso 2 (`0.5rem`)**.
> **Responsive:** revisado a 375/768/1024/1440 → **sin scroll horizontal**. El culpable era el grid
> (sin `grid-cols-1`, la columna se dimensionaba por el `min-content` de los textos con `truncate`):
> se agregó `grid-cols-1` + `min-w-0` en form/aside + `flex-wrap` en los grupos de la barra. En móvil
> la zona de carga dice **«Elija los archivos del equipo»** (no hay arrastrar y soltar).
> **Campos de recurso (verificado contra CKAN):** sin min/max; CKAN **no hereda el nombre del
> archivo**, así que si el título queda vacío el portal usa el nombre del archivo (o la URL); la
> descripción quedó **recomendada, no obligatoria**. Detalle en PRD §7 y design-system §9.

### Ajustes pedidos por el usuario (2026-09-12)

- [x] **[v0] Visibilidad fuera del flujo de creación** — se quita el selector de visibilidad del
  formulario (el flujo de publicación definirá el estado) pero **se mantiene en el resumen**.
- [x] **[v0] Slug autogenerado y bloqueado** — debe generarse a medida que se escribe el título
  (`Titl → titl`), mostrarse **como no-editable** (que no parezca un input) con una línea de
  comentario, y tener una acción explícita para **desbloquearlo** y editarlo. Ya existe la lógica de
  sugerencia (`slugEdited`) en la página; falta la presentación bloqueada/desbloqueada.
- [x] **[v0] Restricciones min/max en los inputs** — **verificado contra el CKAN que corre**:
  CKAN **no tiene** mínimo ni máximo para `title`, `notes`, `url`, `maintainer`, `maintainer_email`
  ni para el nombre/descripción de un recurso (todos son `text` sin límite en la base). Los únicos
  límites reales son **`package.name` = varchar(100)** y **etiquetas 2..100**.
  **Resuelto (2026-09-13): alineado a CKAN.** `title` pasó de `min 3 / max 200` a obligatorio sin
  tope (`.trim().min(1)`); `notes` perdió el `max 5000`. `name` (min 2 / max 100 / slug) y tags
  (2..100) se conservan porque son las reglas reales de CKAN. Aplicado en `src/lib/schemas/dataset.ts`
  con tests nuevos (RED→GREEN); el mensaje de error del título ahora es «El título es obligatorio».
  Desaparece la tensión con el markdown (ya no hay tope de 5000 en la descripción).
- [x] **[v0] Organización: autocompletar si hay una sola** — si el usuario pertenece a una sola
  organización, seleccionarla automáticamente (y reflejarlo en el resumen). El selector se mantiene
  para el caso de varias.
- [x] **[v0] Etiquetas: input tipo buscador con sugerencias y badges** — al escribir, sugerir
  etiquetas existentes; al elegir una, agregarla como badge con «x» para quitarla; si no existe, crearla
  igual. **Verificado**: el repo tiene `FacetFilter` y `SearchBar` pero **no** un combobox; shadcn
  tiene componentes de este tipo que habría que instalar/adaptar. Las sugerencias pueden salir de
  `tag_list` o del facet `tags` de `package_search`.
- [x] **[v0] Licencias: explicar qué significa cada una** — **verificado**: `license_list` devuelve
  por licencia `id`, `title`, `url`, `od_conformance`, `osd_conformance`, `domain_data`,
  `domain_content`, `is_generic`, `maintainer`, `status` (15 licencias en dev). **No hay** texto
  explicativo largo. Opciones: mostrar el `title` + enlace a `url` + los indicadores de conformidad
  como ayuda contextual, o escribir nosotros una explicación breve por licencia (y su traducción).
- [x] **[v0] «Página de destino» — aclarar el nombre** — es el campo `url` del **dataset** en CKAN:
  la página propia del dataset (por ejemplo, el sitio de la unidad que lo publica), **no** una
  referencia de un recurso ni la URL de descarga. Conviene renombrarlo y explicarlo con una ayuda,
  porque «página de destino» no se entiende.
- [x] **[v0] Subida: señal de progreso real** — además del porcentaje, una señal de que «está
  pasando algo» (barra + indicador animado + cambio de color). **Medido (2026-09-13) contra el stack
  dev**: el porcentaje sale de `xhr.upload.onprogress`, que mide **bytes enviados**, y el tramo final
  (100 % → respuesta de CKAN) dura **~288 ms con 5 MB y ~469 ms con 50 MB** en red local. Es real y
  crece con el tamaño (CKAN calcula el hash y guarda el archivo), así que la UI muestra un estado
  **«Procesando en CKAN…»** (barra al 100 % + indicador animado) antes de «Listo». Implementado en el
  playground con el escenario «Procesando».
  _Nota: `package_purge` no está expuesto por API en este stack; la limpieza de un dataset de prueba
  va por CLI (`ckan dataset purge`)._
- [x] **[v0] Recursos: nombre y descripción editables por recurso (requisito)** — **verificado**:
  CKAN los soporta **nativamente** (`resource_create` acepta `name` y `description`;
  `default_resource_schema` los valida), así que RF-11 se cumple sin extras. Confirmado por el usuario:
  «es requerimiento que cada recurso tenga un nombre y una description/summary editable», porque el
  nombre del recurso **no siempre coincide con el del archivo** (`Informe gestión 2020` vs
  `informe_2020`). Además, los recursos **sí** aceptan extras (`__extras` con `extras_valid_json`),
  aunque hoy no enviamos ninguno. **Implementado (2026-09-13):** el diseño final es un **mini-form**
  (Título, Descripción, tipo en pestañas, «Agregar recurso») sobre una **lista compacta** con lápiz
  para editar; el nombre real del archivo se conserva en la línea de detalle para que se vea que
  pueden diferir. (Primero se probaron los campos siempre visibles en cada fila y no gustó.)
- [x] **[v1] Markdown en la descripción** — **HECHO (2026-09-13)**. Corrección a lo que decía este
  ítem: **el PRD sí hablaba de esto** — RF-09 decía `descripción (richtext)`; se buscó «markdown»,
  «mermaid» y «summary» y no aparecían, pero «richtext» estaba. Se reconcilió: RF-09 ahora dice «con
  formato (markdown; ver RF-39)» y **RF-39** documenta la decisión completa.
  Implementado: `markdown-it` (**una sola dependencia**), render seguro **por construcción** en
  `src/lib/utils/markdown.ts` (`html: false` + URLs validadas con la política de la app → no hace
  falta sanitizador), `MarkdownEditor.svelte` (pestañas Escribir | Vista previa), estilos compartidos
  `.markdown-body` en `app.css`, render en la página pública del dataset y extracto de texto plano
  para las cards. **27 tests**, 16 de ellos payloads de XSS con aserciones **estructurales** (se parsea
  el HTML y se verifican etiquetas y atributos).
  **Deuda asociada:** el seed escribía HTML en `notes` y los 16 datasets de dev tenían `<p>`; con el
  HTML crudo deshabilitado eso se vería como texto literal. Se arregló el seed y se migraron los datos
  de dev. Un despliegue con datos legacy necesita la misma limpieza.
- [ ] **[v1] Mermaid y el `summary` para las cards** — quedan fuera de esta tanda. Mermaid es librería
  grande + render en cliente + superficie de ataque aparte. El `summary` es un **campo nuevo** (extra
  del dataset en CKAN, con la deuda de vocabulario ya conocida). SEO queda como feature aparte.
- [ ] **[v1] Editor de la descripción: primero el layout, después el rich-text** — observación del
  usuario (2026-09-13): «no termina de gustarme que sea así, me gusta la idea pero a la hora de verla
  con info se me hace pequeña, y eso de poner dos pestañas no termina de gustarme».
  **El diagnóstico honesto:** la queja es de **presentación**, no del modelo de datos. El markdown
  guardado funciona y el render es seguro por construcción; lo que molesta es que el editor se ve
  chico y que la vista previa obliga a cambiar de pestaña.
  - **Camino barato (recomendado):** editor más alto y **vista previa visible sin pestañas** (lado a
    lado en `lg`, apilada debajo en móvil). No toca el modelo ni el transporte: es layout. Ojo con la
    altura: `MarkdownEditor` ya usa `field-sizing: content` como mejora progresiva, y su mínimo es lo
    que hay que revisar.
  - **Camino grande (la idea del usuario, aparcada):** editor **rich-text cuyo modelo guardado siga
    siendo markdown**. Es factible, pero no gratis: exige una dependencia nueva
    (TipTap/ProseMirror o Milkdown), un **ida y vuelta markdown ↔ modelo del editor que es con
    pérdida** (tablas y listas anidadas son el caso típico), y aceptar un límite de fidelidad conocido
    — o guardar las dos representaciones y convivir con su desincronización. Para v0/v1 **no se
    justifica**: el markdown con vista previa ya cumple RF-39 y el dolor real se resuelve con el camino
    barato. _Decisión del usuario: dejarlo pendiente, no ahora._

- [ ] **[v1] VS: creación en un paso vs. dos pasos (con borrador)** — el usuario pidió comparar
  ambos métodos. Hoy el wizard hace **un solo submit**: `package_create` y después los recursos, con
  reintento de los que fallan. La UI de CKAN hace **dos pasos** (primero metadatos, después recursos),
  lo que da un «guardado de emergencia». A comparar: cantidad de requests, qué pasa si el usuario
  abandona a mitad, si un dataset a medio poblar es aceptable, si el estado `draft` de CKAN está
  habilitado en este stack (verificarlo con la API antes de prometerlo), y si el flujo de publicación
  definirá el estado de todos modos (ver el ítem de visibilidad).
- [x] **[v0] Barra pegajosa vs. botón duplicado** — el usuario pidió **implementar ambos** para
  comparar, igual que se hizo en el playground del dashboard: dejarlo como está (botón al final del
  formulario + otro en el resumen) o reemplazarlo por la barra pegajosa. **Resuelto (2026-09-13): la
  barra pegajosa se descartó** (no gustó). Las acciones quedan **fuera del resumen**, en la columna
  derecha: «Publicar dataset» (primario, ancho completo) + «Cancelar» (contorno) + la nota. Ya no hay
  botón al final del formulario ni duplicado dentro de la tarjeta.
- [ ] **[v1] Arrastrar y soltar para subir archivos: diferido** — la zona de arrastre está dibujada
  pero **no funciona** (el playground es estático). El usuario decidió dejarlo para después: es
  comportamiento nuevo y no quiere mezclarlo con los ajustes menores.

### Pendientes anotados (2026-09-13)

- [ ] **[v1] Buscador dentro del menú pegajoso** — al hacer scroll, el input del buscador debería
  **moverse del hero al menú pegajoso**, en vez de quedar sólo arriba. Patrón habitual en portales de
  datos. _Origen: pedido del usuario._
- [ ] **[v1] Probar el menú pegajoso del search en el dashboard** — el dashboard usa hoy una barra
  pegajosa propia; probar como alternativa el **mismo estilo que quedó en la página de búsqueda**,
  para ver si conviene unificar. _Origen: pedido del usuario._

### Promoción del wizard (Plan C) — CERRADA (2026-09-13)

> Ejecutada y cerrada. El playground (`src/routes/dev/dashboard/datasets/new/`) **se borró**: era
> material de trabajo de la regla 8, sin trackear, y ya no tiene razón de existir.

**Lo que se hizo.** La promoción no fue un copy-paste: el playground era una maqueta con datos de
fixture y el wizard real tenía la lógica de CKAN, así que se injertó la UI aprobada sobre la lógica
real en **dos slices**, cada uno pasado por revisión nativa con su propia línea.

| Slice | Commits | Revisión |
|---|---|---|
| Fundación previa (bits-ui + iconos, markdown RF-39, summary RF-40, topes y validación) | `5cc168e`, `e0fac01`, `d49ffb8`, `1bcc590`, `6cbdefb`, `73efbaf` | `review-521de49bd20a934a` — `approved`, tier high, 4 lentes, 8 advisory |
| **Slice 1** — layout + metadatos | `785c24c`, `f613a61`, `d29306f`, `5616d18` | `review-cc9f270fe3b13523` — `approved`, tier medium |
| Arreglo del detalle de dataset privado | `f8e6b09` | incluido en la línea anterior |
| **Slice 2** — recursos unificados | `08300a3`, `f134e9c` | `review-544dc8f1f33ea19f` — `approved`, tier medium |

**Decisiones que se tomaron para desbloquear el injerto** (todas consultadas antes de codificar):

1. **Visibilidad fuera del formulario; todo dataset se crea privado.** Es el ítem `[v0]` que ya estaba
   anotado: el flujo de publicación definirá el estado. El payload manda `private: true` y la ficha lo
   explica. **Consecuencia que había que resolver:** la página pública de un dataset privado respondía
   403 incluso para su dueño (el cliente del detalle no llevaba token), así que publicar terminaba en una
   página prohibida. Era **preexistente** — el wizard viejo también arrancaba en `private` — pero pasó a
   ser el **único** camino al desaparecer la escapatoria de "hacerlo público". Arreglado en `f8e6b09`.
2. **Licencias desde CKAN (`license_list`).** La lista hardcodeada tenía **4 ids que CKAN no ofrece**
   (`cc-by-nc`, `cc-by-nc-sa`, `cc0-1.0`, `pddl`) y como CKAN no valida `license_id`, el wizard podía
   guardar una licencia inexistente. Ahora el portal ofrece lo que CKAN tiene, con `curatedLicenseLabel`
   para los ids que sí tienen etiqueta en español. Si la carga falla, el select se deshabilita y se
   explica: la licencia es opcional, así que publicar sigue funcionando. **No** hay vuelta atrás a la
   lista inventada.
3. **Sugerencias de etiquetas desde el facet `tags`** de `package_search`, con degradación a `[]`.

**Verificación real (2026-09-13, stack dev, token minteado y revocado, datasets purgados):**

- **E2E de subida:** dataset creado con un archivo de **12 MiB**, `package_create` y `resource_create`
  (multipart) por `http://localhost:8082/api/3/action/…` — **no** pasan por SvelteKit. `size` correcto.
- **Slice 2, riesgo refutado por medición:** con un **nombre editable distinto del nombre del archivo**
  (`Datos de verificación 2026` sobre `datos-verificacion.csv`), CKAN guardó `name` = el nombre editable,
  `description` = la tipeada, y **`format: "CSV"` / `mimetype: text/csv` / `size` inferidos del archivo**,
  no del nombre. La URL de descarga conserva el nombre real.
- **Guard de sesión:** sin token redirige a `/auth/login`. **Consola:** 0 errores. **Responsive:**
  0 px de desborde a 375/768/1024/1440.
- Gates al cierre: `test` **301/301** · `check` 0 errores · `lint` en baseline · `build` OK.

**Lo que sigue pendiente de esta tanda** (no bloquea el snapshot):

- Las **dos decisiones `[v1]`** siguen abiertas y **no** bloquean nada: si la edición reutiliza esta UI
  (hoy el wizard es una **página** con un solo flujo; extraerla a un componente con modo es un refactor
  mecánico cuando exista edición) y si la creación es de uno o dos pasos (depende de la estrategia del
  ciclo de vida, RF-15, todavía sin resolver).
- **[v1] La página del wizard volvió a crecer** (`~1650` líneas tras el slice 2). Si se toca otra vez, el
  candidato natural es extraer el mini-form y la lista de recursos a componentes, como ya se hizo con
  `TagsInput` y `MarkdownEditor`.
- **[v1] `aria-expanded` en el `TagsInput`:** `bits-ui Command.Input` lo deja en `"true"` incluso con la
  lista cerrada (heredado del playground verificado). Un auditor estricto de a11y lo querría conmutado.


## En curso (cambios SDD)

> Al arrancar un cambio SDD, el ítem se mueve desde este backlog a `openspec/changes/`.

### `2026-09-13-publication-lifecycle` — EN CURSO

> **Estado (2026-09-14, tarde):** `init` ✅ · `explore` ✅ · `preproposal` ✅ · `proposal` ✅ · `design` ✅ ·
> `spec` ✅ · `tasks` ✅ · **`apply` del PR 1 ✅ (pusheado: `86f130b` en `odp-docker`)** · **PR 2
> APARCADO**. · El **modelo de producto fue revertido** el 2026-09-14: manda el PRD, no las decisiones
> D1–D7 del proposal. Ver el aviso al inicio de `proposal.md`. **Hay que reconciliar proposal → spec →
> design → tasks antes de seguir con el portal.**
>
> **Qué cambia y qué sobrevive:**
> - **Sobrevive el PR 1** (el guard encadenado en `ckanext-umss`, ya pusheado): `PRD:347` da «aprobar
>   cambio de visibilidad» al `org_admin`, que es lo que el guard exige. **Pendiente de confirmar:** si el
>   flujo de solicitud es **obligatorio**, un `org_admin` que cambie `private` directo lo estaría
>   salteando y el guard necesita trabajo.
> - **Aparcado** el PR 2 (botón de publicación directa para el aprobador), en la rama
>   `wip/pr2-directo-publicacion` (`6b53c64`). Construido para el actor equivocado: en el modelo del PRD
>   **el que pide no es el que aprueba** (`PRD:345` vs `PRD:347`). Reutilizable de ahí: el manejo honesto
>   del `403`, la regla «un `200` que no concede no es un éxito» y las dos máquinas de estado.
> - **Store decidido por el PRD**, no hay que inventarlo: `PRD:227` dice que `publication_requests`
>   *«requiere extensión propia o capa paralela»*; `PRD:308` da el esquema (`id, dataset_id,
>   requested_visibility, status, requested_by, approved_by, comments, created_at`); y `PRD:361` dice que
>   la base es **PostgreSQL gestionada por CKAN**. O sea: tabla nueva en `ckanext-umss`, con migración.
> - **Tercer nivel:** el PRD pide 3 (`private`, `internal`, `public`) y su propia tabla §7 (`PRD:220`)
>   admite que CKAN tiene 2 y que «interno de organización» **es** el comportamiento de `private`. El que
>   falta es el que el PRD llama `private` (**solo el autor**), que necesita mecanismo propio.
> - **Ida y vuelta:** el PRD muestra solo flechas hacia arriba (`PRD:135`, `PRD:320`) pero la frase
>   «cambio de visibilidad» no está limitada en dirección y la matriz (`PRD:347`) tampoco. **El PRD no lo
>   cierra**: hay que decidirlo.
>
> #### Respuestas del usuario (2026-09-14) y lo que implican
>
> 1. **El flujo de solicitud es OBLIGATORIO para todos.** Consecuencia dura: **el guard del PR 1 queda
>    insuficiente.** Hoy permite que un `org_admin` ponga `private: false` directo con `package_patch`,
>    y bajo este modelo eso es **saltearse el flujo**. Hay que atar el cambio de visibilidad a una
>    solicitud aprobada, lo que obliga a que el guard consulte el estado de la solicitud. **El PR 1 ya
>    está mergeado en `odp-docker/master` (`86f130b`) y necesita trabajo adicional.**
> 2. **Dirección: por ahora solo subir**, pero la bajada queda pendiente y **debe escribirse en el PRD**
>    (no está). El usuario describe **dos casos distintos**: los usuarios **piden** bajar (con aprobación)
>    y los **admins bajan directo en cualquier momento** (p. ej. publicación por error). Cada cambio,
>    auditado. **Ninguno de los dos está en el PRD.**
> 3. **Solo 2 niveles por ahora**, y aquí hubo una inversión que conviene dejar escrita. Medido y
>    confirmado desde la fuente y en vivo:
>
>    | Nivel del PRD | En CKAN |
>    |---|---|
>    | `public` | `private: false` + `state: active` ✅ existe |
>    | `internal` (**organización**) | **`private: true`** ✅ existe |
>    | `private` (**solo el autor**) | ❌ **no existe** |
>
>    `ckan/lib/plugins.py · DefaultPermissionLabels`: un privado recibe la etiqueta
>    `member-<owner_org>`, y **cualquier** usuario con permiso `read` en esa org recibe esa etiqueta. La
>    etiqueta `creator-<id>` solo se aplica cuando el dataset **no tiene** organización dueña. Medido en
>    vivo: un `member` (la capacidad **mínima**) de la org dueña lee el privado → **200**; anónimo → **403**.
>    O sea: **el nivel que falta es «solo el autor», no «organización».**
>
>    **Buenas noticias para el día que toque:** CKAN tiene el punto de extensión exacto,
>    **`IPermissionLabels`** (`ckan/plugins/interfaces.py:1894`; CKAN trae de ejemplo
>    `example_ipermissionlabels`). El nivel «solo el autor» se implementa en `ckanext-umss` agregando la
>    etiqueta `creator-<id>` a los privados, sin hackear el core.
>
> #### Gaps del PRD — **redactados el 2026-09-14, pendientes de tu revisión**
>
> - ✅ **Degradación de visibilidad** → **RF-41** (el usuario la solicita, con aprobación) y **RF-42** (el
>   `org_admin` o superadmin la baja directo, sin solicitud, con motivo). Los **dos casos** que
>   describiste, que no existían en el PRD. Más el flujo en §8 y las filas correspondientes en la matriz
>   de §9.
> - ✅ **Flujo obligatorio** → RF-15 paso 5: ninguna visibilidad cambia por otro camino salvo la
>   degradación directa de RF-42.
> - ✅ **Niveles de §3**: ahora dice que CKAN sólo ofrece los dos últimos de forma nativa, para que los
>   tres niveles no parezcan igual de disponibles.
> - ✅ **Auditoría**: RF-33 ahora exige registrar los cambios de visibilidad **en los dos sentidos**, con
>   quién los solicitó, quién los aprobó o quién los ejecutó directo, y el motivo cuando fue directa.
>   **Nota de alcance (sigue en pie):** RF-33/RF-34 piden `audit_logs` con triggers y cubren **mucho más**
>   que la visibilidad (todo CUD, colaboradores, equipos, colecciones, logins). Es su **propia feature**, con
>   su propio store, y el PRD ya admite (`:228`) que la `activity` nativa de CKAN no alcanza.
>
> **Puntos que tuve que decidir yo al redactar — estado:**
> 1. **CONFIRMADO** — un `org_admin` que quiera **subir** la visibilidad también pasa por una solicitud,
>    y puede solicitarla y aprobarla él mismo. Se queda: **un solo camino** para todos los casos, lo que
>    simplifica el guard y la auditoría, a costa de un par de clics para el admin.
> 2. Redactado así, **no cuestionado**: una solicitud **pendiente queda anulada** si un admin degrada
>    directo (RF-42).
> 3. Redactado así, **no cuestionado**: la degradación **exige motivo**.
> 4. **CONFIRMADO** — el tercer nivel («privado — solo el autor») queda **diferido a `v1+`**, escrito en
>    §3 y en §7 con el motivo (CKAN no lo tiene) y **con la dirección técnica**: `IPermissionLabels`, y un
>    privado recibe hoy `member-<owner_org>` de `DefaultPermissionLabels`, así que se construye agregando
>    `creator-<user_id>` en `ckanext-umss` sin tocar el core.
>
> **Pendiente de confirmar:** que el flujo sea obligatorio implica que **el guard del PR 1 no alcanza**
> (hoy un `org_admin` puede cambiar `private` directo). Decidido dejarlo y atarlo en el rediseño.
>
> **Artefactos** en `openspec/changes/2026-09-13-publication-lifecycle/`. El **autoritativo para la
> evidencia medida** es `preproposal.md`: `explore.md` se escribió leyendo un checkout de CKAN
> **2.12.0a0 sin shell**, y **tres de sus afirmaciones fueron refutadas midiendo contra el 2.11.6 que
> corre** (su encabezado lo advierte).
>
> **`spec` (2026-09-14):** dos artefactos nuevos — `specs/publication-lifecycle/spec.md` (capability nueva:
> la garantía vive en `ckanext-umss`, otro repo, y no se puede fundir en el contrato del wizard sin volver
> ambos inauditables) y `specs/dataset-publishing/spec.md` (delta con 3 MODIFIED). Gatekeeper PASS.
> **Ojo al archivar:** los bloques MODIFIED copian el requisito canónico entero, así que el merge debe ser
> un *patch*, nunca un reemplazo de archivo, o se pierden los requisitos intactos.

**El problema:** hoy nada de lo creado en el portal puede llegar al catálogo. El wizard crea todo
privado y no hay ninguna forma de publicarlo.

**Decisiones de producto ya confirmadas — no re-abrir:**

1. **La revisión debe ser infalsificable** → la regla va en CKAN (`IAuthFunctions` en `ckanext-umss`),
   no en el portal. Medido: un editor de organización puede poner `private: false` con su propio token,
   así que una revisión sólo del portal es consultiva.
2. **Dos niveles de visibilidad** (público / privado = lo lee la organización dueña). Sin etiquetas de
   permiso propias, sin nivel «solo autor».
3. El **bug del dashboard** va aparte (ítem propio en `v0`).
4. Primer corte = **mínimo publicable** (privado → publicado). La máquina de estados completa es
   no-objetivo explícito.
5. Aprobador = capacidad **`admin` de la organización** (+ sysadmin). Consecuencia aceptada: una
   organización con editores pero sin admin no puede publicar.
6. **Retracción fuera** de este corte (una vez publicado no se vuelve a privado).
7. **Sin marcador extra**: `private` solo alcanza, lo que además elimina el riesgo de stemming de Solr.

**Dos cosas que condicionan la implementación:**

- Es un cambio **cross-repositorio**: el Python vive en
  `/home/danielblc/projects/odp-docker/ckan-docker/src/ckanext-umss` (¡hace falta el tramo
  `ckan-docker/src`!) y la UI en este repo. Por eso **`pnpm test` no puede cubrir el cumplimiento**:
  la única prueba honesta es una **sonda viva** contra el CKAN dockerizado (el diseño define P0–P9).
  Entrega prevista: **2 PRs**, y la decisión de entrega (`ask-on-risk`) cae en `tasks`.
- **Segundo bypass: MEDIDO el 2026-09-14 (sonda P5) y es real.** `package_create {private: false}` como
  editor → **200 con `private=false` guardado**: dataset público sin pasar nunca por `package_update`.
  **Peor: omitir la clave** (`package_create {owner_org}` sin `private`) da exactamente lo mismo,
  porque `private` está en la cadena `ignore_missing` del schema (`schema.py:160-161`) y el default de
  la columna es **público** (`model/package.py:75`). Lo único que hoy mantiene privado lo que se crea es
  el `private: true` hardcodeado del wizard. En cambio, un `package_update` **completo que omite
  `private`** deja el valor intacto (200, sigue `true`): la omisión es un intento de publicación **sólo
  al crear**.
  - **CERRADO, y re-medido el 2026-09-20 (este stack).** Con un `editor` real de
    `direccion-investigacion` y su propio token: `package_create {private: false}` → **403
    `Authorization Error`: «Access denied: Only an organization administrator can publish a dataset»**, y
    `package_patch {private: false}` sobre un dataset privado → **403 con el mismo mensaje**. Control:
    `package_create {private: true}` → 200 con `private=true` y anónimo → 403. El guard de
    `ckanext-umss` **cierra el bypass de este ítem** en los dos puntos de entrada que la sonda tocó.
    **No re-medido hoy, y hay que decirlo así:** la variante de **omitir** la clave (el caso peor de
    arriba) y la de `state` (P4a). Ambas están cubiertas por la verificación **25/25** registrada en
    `apply-progress.md`, no por esta sonda. _Origen: sonda del autor, 2026-09-20._
  - **Huecos cerrados, y una trampa anotada (2026-09-20, medido por la sesión de `odp-docker` con
    `check_access`, que es la entrada real de auth):** `package_create` con `private: false`, con `'banana'`
    **y con la clave omitida** → **403** con el mismo mensaje del plugin. `package_update` y `package_patch`
    con `false` o `'banana'` → 403; **omitida en update → permitido** (deja el valor intacto), que es la
    asimetría create/update ya documentada. El guard vive en `ckanext-umss` **vendorizado dentro de
    `odp-docker`** (commit `86f130b`), no como submódulo; `package_patch` lo hereda porque el core lo define
    como `authz.is_authorized('package_update', …)`, que resuelve la función CHAINED. `state` sigue sin
    re-medirse.
  - **Trampa para cualquier sonda futura:** `roles_that_cascade_to_sub_groups = ['admin']`, así que un
    «editor» que además sea admin de la organización **padre** hereda el permiso y **parece** un bypass — el
    primer fixture de esa sesión cayó en eso. Una sonda que obtiene **403** es robusta a la cascada (la
    cascada sólo **agrega** permisos); una que obtiene 200, no.
- **`state` sigue siendo mutable por un editor (medido 2026-09-14, P4a):** `package_patch
  {state:"draft"}` como editor → **200 con `state=draft` guardado**. Causa: `ROLE_PERMISSIONS` le da
  `update_dataset` al editor, `package_change_state` autoriza delegando en `package_update`, y
  `ignore_not_package_admin` sólo descarta `state` cuando ese `check_access` falla. El guard del diseño
  lo bloquea (segunda cláusula de D1), así que **este cambio le quita al editor una capacidad que hoy
  sí tiene** — anotado abajo en `v1`.

**Sondas P0–P9 ejecutadas el 2026-09-14** contra el CKAN 2.11.6 que corre (por `localhost:5000`), con
higiene verificada *después* de limpiar: conteo anónimo de vuelta a los 16 datasets del seed, y 0
datasets, 0 organizaciones y 0 tokens de sonda. Resultados en `design.md` → «Measured baseline» y en
`preproposal.md` §2.4. Cerrado por las sondas: `chained_auth_function` **existe** en 2.11.6 (no hace
falta el fallback), no hay hook de veto previo en `IPackageController`, y las dos banderas de
colaboradores están en `false`.

**Prerrequisito roto:** el baseline de pytest de `ckanext-umss` **está en rojo** —
`ckanext/umss/tests/test_plugin.py:57`: baseline **`1 failed`** por
**`NameError: name 'plugin_loaded' is not defined`**. Redacción **restaurada del `preproposal.md` §2.4**, que ya
la tenía correcta; la versión anterior de esta línea («sin declararlo como fixture») era una **derivada
corrompida** de un registro que estaba bien, y mandaba a buscar una fixture que nunca faltó.
**CORRECCIÓN (2026-09-20): el baseline rojo ERA real** (la redacción de arriba ya quedó restaurada). Medido
por la sesión de `odp-docker`:
- **No era una fixture faltante.** En la revisión padre (`279e453`) la fixture **ya estaba declarada**, línea
  55: `@pytest.mark.usefixtures("with_plugins")`.
- El fallo real era un **`NameError`**: `plugin_loaded` se usaba **sin importar** — en ese commit las únicas
  importaciones eran `import pytest` y `import ckanext.umss.plugin as plugin`.
- Lo arregló **`86f130b`** —el **mismo commit que introdujo el guard**— con +6 líneas:
  `from ckan.plugins import plugin_loaded`, más el comentario que aclara que **no** es una fixture de
  pytest-ckan en CKAN 2.11.6.

**Que nadie busque una fixture faltante: nunca lo fue.** Ese es el motivo por el que esta entrada se reescribe
en vez de marcarse como no reproducible — el diagnóstico viejo manda a buscar en el lugar equivocado. Hoy la
suite pasa (22 passed, medido allá) y el archivo declara las cuatro piezas y el `assert`.
Medido el 2026-09-14: `1 failed`, `NameError: name 'plugin_loaded' is not defined`. `pytest 8.3.4` y
`pytest-ckan 2.11.6` **sí están instalados en la imagen de dev**, así que la suite corre en el lugar y
no hace falta el contenedor descartable que el diseño contemplaba como fallback. Y el `plugin.py`
implementa **sólo `IConfigurer`** hoy.

El cambio anterior (`2026-09-11-dataset-publishing`: wizard de publicación + dashboard real + recursos
por enlace) quedó **archivado** el 2026-09-12 y su spec canónica vive en
`openspec/specs/dataset-publishing/spec.md`.

## v0 — core presentable

> **Revisión de UI del usuario (2026-09-14).** Observaciones nombradas, no arregladas todavía; el usuario
> pidió explícitamente anotarlas antes de tocarlas.
>
> - [ ] **[v0] Sin organizaciones, la acción de crear dataset NO debe mostrarse.** Hoy se ofrece igual y
>   lleva a un callejón sin salida («no pertenecer a ninguna org» = no se puede crear). _Origen: revisión
>   de UI del 2026-09-14._
> - [ ] **[v0] Una sesión muerta degrada a anónimo EN SILENCIO — medido (2026-09-14).**
>   `organization_list_for_user` con un token inválido devuelve **`success: true` y `result: []`**, no un
>   error (igual que sin token). Consecuencia: el portal no puede distinguir «estoy logueado y no tengo
>   organizaciones» de «mi token ya no existe», y muestra listas vacías sin avisar. Ocurrió de verdad: un
>   `db clean` de CKAN borra la tabla `api_token`, así que toda sesión abierta queda muerta y el dashboard
>   y el wizard se ven vacíos. **Falta que el portal detecte la sesión inválida y fuerce re-login.**
>   Nota: es la misma familia de no-op silencioso que `api_token_revoke`.
> - [ ] **[v0] Los recursos de un dataset privado se ven como «Recurso no encontrado». DIAGNOSTICADO
>   (2026-09-14).** Dos defectos distintos, y solo uno es de la aplicación:
>   1. **La causa del síntoma que reportó el usuario es la sesión muerta** (el `db clean` borró
>      `api_token`, ver el ítem anterior). Medido con el dataset `test` del usuario: `package_show`
>      **anónimo → HTTP 403 `Authorization Error`** (el dataset es privado), y **con token válido → 200**,
>      `private=true`, 1 recurso, `url_type=upload`, `format=PDF`; `resource_show` con token válido → OK.
>      **El recurso existe y está bien**: el pedido sale anónimo y CKAN responde 403. **Se arregla con
>      re-login.**
>   2. **El defecto real de la página, que queda pendiente:** `dataset/[id]/resource/[resourceId]/+page.svelte:84`
>      **convierte un `403` en «Recurso no encontrado»** — confunde «no tenés permiso para verlo» con «no
>      existe». Y en DEV, antes de fallar, intenta un **fallback a mock** (`getMockResourceById`), que es lo
>      que **enmascara** el error verdadero durante el desarrollo (el mismo antipatrón que ya se había
>      encontrado en otra página). A arreglar: distinguir `403` de `404` y decirlo, y no dejar que el mock
>      se trague un fallo de autorización. Es exactamente lo que exige el requisito
>      `Distinguishable Authorization Errors` de la spec del ciclo de vida, aplicado a otra página.
>      _Origen: revisión de UI del 2026-09-14 + diagnóstico del 2026-09-14._
>
- [ ] **[v0] El asistente promete editar el dataset después de publicarlo, y esa edición no existe** —
  el paso final del wizard muestra «Podrá editarlo después de publicarlo.»
  (`src/routes/dashboard/datasets/new/+page.svelte:1696`), pero **no hay ninguna ruta de edición de
  dataset**: en `src/routes` sólo existen el wizard de creación y las vistas de lectura, y
  `datasetApi.update` (`src/lib/api/datasets.ts:64`) está definido y **sin cablear** a ninguna
  página. Es una promesa **preexistente** —no la introdujo el trabajo de paginación— y pertenece a
  la misma familia que ese tramo de honestidad: si la capacidad queda diferida, el copy no debe
  anunciarla. Se cierra de una de dos formas, no de las dos: se implementa la edición, o el copy
  deja de prometerla. _Origen: verificación independiente de la segunda unidad de trabajo,
  2026-09-17._
  **Estado medido (2026-09-30): VIVO, libre para implementar o para dejar de prometer.** La frase sigue en
  `new/+page.svelte:1736` y `datasetApi.update` (`lib/api/datasets.ts:64`) **no tiene ni un call site**. El cierre es por
  una de dos vías, no las dos: implementar la edición, o que el copy deje de anunciarla.

- [ ] **[v0] Normalizar la card de metadatos del dataset según la de recurso** — el usuario prefiere
  la card de metadatos de la **página de recurso** (`resource/[resourceId]/+page.svelte:619-692`: rótulo
  `text-destructive`, tabla de campos con jerarquía, `Card` con `p-6 sm:p-8`) y quiere llevar algo
  similar a la del **dataset**, conservando el detalle que agrega valor a la card. **Corrección medida el
  2026-09-24: la página del dataset tiene DOS cards, y este ítem no decía cuál.** «Detalles», la del cuerpo
  (`dataset/[id]/+page.svelte:527-554`), **ya cumple** lo que este ítem pide —`p-6 sm:p-8`, tabla Campo/Valor y
  el rótulo idéntico al de recurso—; la que no cumple es la del sidebar, «Metadatos» (`:608-624`: `p-5`, filas
  con ícono, sin tabla). **Cuál de las dos y qué detalle sobrevive es decisión del autor**, y va antes de tocar
  el archivo: `odd/tasks/block-e-layout-polish.md`, slice E4.
  _Origen: revisión de UI del dashboard (2026-09-12); re-verificado el 2026-09-24._
  **Estado medido (2026-09-30): VIVO.** La card del cuerpo (`dataset/[id]/+page.svelte:520`) ya es `p-6 sm:p-8` con tabla
  Campo/Valor; la del sidebar «Detalles» (`:620`) sigue en `p-5` con filas e ícono. **Frena en la decisión del autor: cuál
  de las dos y qué detalle sobrevive** (`odd/tasks/block-e-layout-polish.md`, slice E4). **Si se considera que la decisión de
  nombres del 2026-09-28 ya resolvió E4, este ítem se cierra.**

- [ ] **[v0] El enlace de descarga del recurso renderiza la URL propia de CKAN, no la del portal.**
  Verificado en vivo (2026-09-20): «Descargar recurso» apunta a
  `http://localhost:5000/dataset/<name>/resource/<file>/download/<file>` — el `ckan.site_url` de CKAN —,
  no al origen del portal. Con la arquitectura vigente (CKAN **headless**, sólo su API REST; ver el
  encabezado de este archivo), exponer el origen del backend y depender de su configuración merece una
  decisión explícita: servir la descarga a través del portal, o aceptar el acoplamiento de forma
  deliberada.
  _Origen: verificación independiente en navegador real contra el stack vivo, 2026-09-20._
  **Estado medido (2026-09-30): VIVO.** `resource/[resourceId]/+page.svelte:358` sigue con `downloadUrl =
  safeExternalUrl(resource?.url)` y `:544` con `href={downloadUrl}`; no hay ruta que proxee (los únicos `+server.ts` son
  los dos de `auth`). **Frena en la decisión del autor:** servirlo por el portal, o aceptar el acoplamiento de forma deliberada.

- [ ] **TODO (respuesta a una duda del autor): la oración «Para crear el primero, necesita rol de editor o administrador en una organización.» es la regla
  de HOY, y el PRD apunta a roles **más** permisos.** El autor recordaba que el PRD habla de manejar primero
  por roles con capacidad de pasar a permisos, y **es exactamente esto**: `RF-01` define roles **a nivel de
  organización** (`superadmin`, `org_admin`, `editor`, `viewer`) **y además roles por dataset** (`viewer`,
  `editor`, `steward`); `RF-18`/`RF-19` agregan **colaboradores con permisos explícitos** por dataset y
  **equipos**. Hoy el único mecanismo que existe es el rol de organización —lo que CKAN puede aplicar, la
  capacidad `member`/`editor`/`admin`—, así que la oración es **correcta para el presente** y tendrá que decir
  «rol **o** permiso explícito» cuando aterricen los roles por dataset. Esos roles y colaboradores están en
  `v1+`, y **el PRD anota que varios requisitos de esa familia no son alcanzables con la API de CKAN**
  (`PRD.md:255`: RF-14 a RF-17, RF-19, RF-23, RF-33 a RF-36), así que la decisión de fondo es cuánto se
  construye por fuera de CKAN. **No hay que tocar la copia por esto**: el cambio de verbo del ítem de
  «publicar» es independiente y no debe esperar a los roles por dataset.
  _Origen: pregunta del autor, 2026-09-20._
  **Estado medido (2026-09-30): sin acción pendiente hoy.** El texto vigente (`lib/copy/dashboard.ts`,
  `EMPTY_STATE_NO_CREATE_PERMISSION_REQUIREMENT`) ya coincide con la conclusión del ítem; lo que falta es la redacción
  futura de «rol o permiso explícito», atada al trabajo de permisos.

  **Cuándo se decide:** no ahora, sino **al empezar el trabajo de permisos** (el ítem de colaboradores
  nativos de CKAN en `v0`): ahí se mide si lo nativo alcanza antes de construir equipos por fuera de CKAN.

- [ ] **TODO — DECIDIDO Y CERRADO EN PÁGINA (2026-09-20): política de existencia, opción 3. Queda abierta la mitad de la API.**
  **Decisión del autor:** `404` **ambiguo para el anónimo** (mismo estado que un recurso inexistente y
  **sin** botón de iniciar sesión: el botón es lo que revela) y **honesto para el identificado** («su
  cuenta no está autorizada»). Implementado en `src/lib/api/failure.ts`, los dos call sites, y la spec
  **partida en dos requisitos** (`Unidentified Viewer Must Not Learn Existence` +
  `Authorization Failure Is Not a Missing Resource`, este último acotado al espectador identificado — con
  lo cual su nombre volvió a ser cierto).
  **Consecuencia aceptada, explícita:** un usuario **autenticado** cualquiera puede distinguir `403` de
  `404` **en la página**. No es una fuga nueva —la API se la da a cualquiera, incluso anónimo— y cerrarla
  es una línea en la rama `session-alive` si algún día se quiere.
  **Nota de UX:** al quitar el botón, en móvil el camino de inicio de sesión queda **dentro del menú
  hamburguesa** (el enlace del encabezado aparece de `md` para arriba). `layout-header.test.ts` prueba que
  el enlace existe.
  **Revisión nativa: `review-249e073ef3489596` — APROBADA y con la authority quemada** (2026-09-20), tier
  medium, una lente, 11 archivos / 467 líneas, con 2 avisos informativos registrados en la deuda de
  revisión al final de este archivo.
  **Lo que SIGUE ABIERTO — la mitad que falta para la propiedad completa:** el **oráculo de la API**
  (siguiente párrafo). Cerrarlo exige la capa server-side que hoy no existe.
  **El documento aportado por el autor** describe la recomendación estándar de las plataformas de
  archivos: para un visitante, un archivo privado «no existe» → `404`, y no «es privado» ni «no tiene
  permiso», para no habilitar la enumeración. Adoptarlo del todo **enmienda la spec**, no es copia suelta.
  **Medición que hay que mirar antes de decidir (2026-09-20):** el portal **no es la frontera de la
  enumeración**, porque el mismo origen que sirve la página proxya la API cruda de CKAN:
  `GET /api/3/action/package_show?id=test` **sin token** → **`403`** con un cuerpo que **nombra el
  recurso**, mientras un id inventado (`id=no-existe-x`) → **`404` `Not Found Error`**. Es un oráculo de
  existencia perfecto, anónimo y accesible desde el navegador. (`package_search` sí filtra: count 16 vs
  17 reales, y `resource_show` de un recurso privado también da `403` nombrando el recurso.)
  ⇒ **enmascarar la página y dejar la API como está no compra la propiedad deseada**; comprarla exige
  una capa server-side — el «middleware» que hoy **no existe**: `src/routes/api/` no existe y las únicas
  rutas server son `auth/login` y `auth/logout` — que normalice `403` → `404` para llamadores **sin
  sesión** y deje `403` para los autenticados.
  **El precedente más fuerte está en el propio CKAN, y son DOS capas con políticas opuestas (medido el
  2026-09-20):**
  - **Su interfaz web enmascara exactamente como pide el documento.** `GET /dataset/test` sin sesión →
    **HTTP `404`**, y el cuerpo dice literalmente **«Dataset not found or you have no permission to view
    it»**. El recurso privado, igual: `404` «Resource not found». El mecanismo, en su código:
    `ckan/views/dataset.py:406-407` (y :396-397, :509, :608, :744, :780) atrapa **`(NotFound,
    NotAuthorized)` en la MISMA rama** → `abort(404, _('Dataset not found'))`; `ckan/views/resource.py:68-69,
    91, 164-165` hace lo mismo. Es decir: **CKAN no distingue «no existe» de «existe pero no puedes
    verlo», ni siquiera para un usuario logueado sin permiso**, y su mensaje es el ambiguo del documento.
  - **Su API REST hace lo contrario**: `package_show?id=test` sin token → **`403` que nombra el UUID del
    paquete**; `id=no-existe` → **`404`**. Ahí la existencia se revela y los dos casos se distinguen.
  - **Los listados no filtran en ninguna capa**: `/dataset` anónimo lista 16 y no incluye `test`; la
    página de la organización dueña tampoco lo lista; `package_search` anónimo → 16.
  - **Consecuencia para el portal:** el portal es headless y consume la **API**, así que **hereda el
    `403`** y tiene que elegir cuál de las dos políticas de CKAN reproduce. Y un dato incómodo que
    conviene tener escrito: **el comportamiento anterior del portal (403 → «Recurso no encontrado»)
    reproducía fielmente la política de la UI de CKAN.** Lo genuinamente defectuoso de D4 era
    (a) el mock de DEV tapando un fallo real con datos falsos y (b) perder la mitad «o no tiene
    permiso» del mensaje, que es la que no confirma nada y no miente.
  *El punto medio existe, y es el de CKAN:* **`404` ambiguo sin botón de iniciar sesión** (el botón es lo
  que revela). Si se conserva el botón, no hay punto medio: invitar es revelar. Fuga menor ya existente:
  la expulsión por sesión muerta revela existencia a quien llegue con un token vencido.
  **Lo decidido se aparta a propósito de la política de CKAN en un punto y la copia en otro:** para el
  anónimo reproduce lo que hace su UI (ambiguo, sin invitación); para el identificado se aparta y le dice
  la verdad útil («su cuenta no está autorizada» le dice que debe pedir permiso, no que escribió mal la
  dirección). _Origen: documento aportado por el autor + medición del 2026-09-20; decisión del autor,
  2026-09-20._
  **Estado medido (2026-09-30) — `PARTIAL`, con el corte exacto:** aterrizó **la mitad de página** (`lib/api/failure.ts`:
  `classifyFailure`, `describeFailure` y `failureActions`, usados por las dos páginas, con el 403 y el 404 anónimos colapsados
  a un mismo texto). **No aterrizó la mitad de API:** no existe `src/routes/api` y los únicos `+server.ts` son los dos de
  `auth`, así que el oráculo del 403 sigue en pie a través del proxy.

- [ ] **[v0] Habilitar colaboradores por dataset** — `ckan.auth.allow_dataset_collaborators` no
  está en `.env.example`. La funcionalidad es nativa desde CKAN 2.9 pero está apagada, así que
  el modelo de permisos por dataset (RF-18) no funciona hoy. _Referencias: PRD RF-18, PRD §7._
  **Estado medido (2026-09-30): VIVO.** Ningún **archivo versionado** habilita la bandera: aparece en `PRD.md:245` y en los
  artefactos del cambio SDD, y en **ninguno** puesta en `true`. La mitad literal del ítem (`.env.example`) **no es
  verificable** bajo la política estricta de rutas de entorno. **Frena en medir el stack y en la decisión de habilitarla.**

- [ ] **[v0]** `TODO:` **Los tags de la card de dataset cortan a tres y no dicen cuáles son los que faltan.**
  Observación del autor (2026-09-25): «cuando son muchos aparece un `+X`, esto es ambiguo». **Causa medida**:
  `src/lib/components/search/DatasetCard.svelte:93-103` muestra `dataset.tags.slice(0, 3)` y después
  `+{dataset.tags.length - 3}` —un `+2` pelado, **sin rótulo y sin forma de saber qué etiquetas son**—.
  **Dos restricciones que el arreglo tiene que respetar:** (1) la card **entera** es un `<a>` (línea 59), así
  que un desplegable o un botón adentro sería **contenido interactivo anidado**: la divulgación tiene que ser
  por **hover/foco**, no por clic; (2) **el mismo defecto, con la misma forma, está dos bloques más abajo en
  los chips de formato** (líneas 118-120, `+{formatSummary.more} más`), así que conviene un solo arreglo para
  los dos. Opciones: el `title` nativo —lo que el repositorio ya usa en `FacetFilter.svelte:113` y en los
  botones de la página del recurso—, **vendorizar el `Tooltip` de bits-ui** (el `AGENTS.md` lo lista como el
  primitivo a usar, y **todavía no está en el repositorio**), o no truncar. **Decisión del autor pendiente.**
  **Verificado (2026-09-25): no hay ningún componente de tooltip en el repositorio.** El mensaje que aparece al
  pasar el mouse por una organización truncada de los filtros del buscador es el **`title` nativo del
  navegador** (`FacetFilter.svelte:113`: `<span class="min-w-0 flex-1 truncate" title={item.display_name}>`; el
  archivo importa sólo `ChevronDown` y `Search`). Así que «usa el mismo componente que los filtros» **no es una
  opción**: o se usa el `title`, o se vendoriza el `Tooltip` de bits-ui de cero.
  **Estado medido (2026-09-30): VIVO.** `DatasetCard.svelte:95` sigue con `dataset.tags.slice(0, 3)` y un `+N` pelado
  (`:118` para los formatos), y **no existe ningún componente `Tooltip`** en `src/lib/components`. **Frena en la decisión
  del autor:** `title` nativo, vendorizar el `Tooltip` de bits-ui, o no truncar.
  **Decisión del autor (2026-10-03): vendorizar el `Tooltip` de bits-ui.** Pero apareció un obstáculo que el ítem no
  había medido, así que la decisión **quedó a medio camino y no se resolvió por la vía obvia** —leído de la API
  instalada, no de memoria: `TooltipTrigger`, en bits-ui 2.19.2, está tipado como primitivo de **botón**
  (`TooltipTriggerProps` interseca `BitsPrimitiveButtonAttributes`) y admite delegación con `child`. Contra una card que
  **entera** es un `<a>`, eso deja sólo dos formas honestas:
  **(a)** el `<a>` de la card es el disparador, y el contenido lista las etiquetas y los formatos que el recorte
  esconde —cero contenido interactivo anidado, el foco del enlace cubre el teclado, y un solo mecanismo arregla los dos
  defectos—; o **(b)** reestructurar la card para que el título sea el enlace y la divulgación sea un `<button>` real,
  lo que **mueve la superficie de clic de toda la card** y necesita su propia ronda de revisión visual.
  Queda descartado por el propio arnés poner el disparador sobre un `<span>` no enfocable: exigiría `tabindex`, que es
  exactamente la violación (`a11y_no_noninteractive_tabindex`) que `/dev/nav` ya documentó al intentarlo.
  **Falta elegir (a) o (b), y no antes.** El defecto sigue vivo y medido: nada de esto cambió el código.

- [ ] **[v0]** `TODO:` **La página de la organización, a mejorar.** Observación del autor (2026-09-28):
  «mejorar la page de las org». Es una de las páginas con menos trabajo encima: nació resolviendo `name` o `id`
  y mostrando lo que `organization_show` devuelve, y **nunca tuvo una pasada de diseño propia**.
  **El alcance no está definido: el autor no dijo qué le falta**, y la primera tarea es que la mire y lo
  diga —no adivinarlo—. Contexto: PRD RF-06 a RF-08 y `openspec/specs/organizations/spec.md`.
  **Estado medido (2026-09-30): VIVO.** `src/routes/organization/[id]/+page.svelte` es encabezado + lista de `DatasetCard`
  sin pasada de diseño propia; las unidades del 2026-09-28 tocaron enlaces y ruteo hacia la org, no la página.
  **Frena en la decisión del autor: el alcance.**

- [ ] **[v0]** `TODO:` **El responsive del salto secuencial, antes de darlo por cerrado.** Observación del
  autor (2026-09-28): «con el cambio que hicimos en el salto habría que tocar en el responsive; esto faltaría
  antes de promover el salto». El salto va en la banda de la acción principal como dos controles rotulados
  (`‹ Anterior` · contador · `Siguiente ›`) que **envuelven a una segunda línea** en anchos cortos, y su
  ubicación quedó **aparcada, no aprobada**. **Falta el síntoma concreto: qué se ve mal y a qué anchura**, y
  eso sólo lo tiene el autor. El código está cubierto por el recibo `review-fc7e00d27e1f61cf`; lo que falta es
  el juicio de diseño.
  **Estado medido (2026-09-30): VIVO.** La banda envuelve bien (`resource/[resourceId]/+page.svelte:540`), pero el recibo
  `review-fc7e00d27e1f61cf` registra que el autor **aparcó** la ubicación («ese lugar es raro… queda abierta, no aprobada»).
  **Frena en la decisión del autor:** qué se ve mal y a qué ancho.

- [ ] **[v0]** `TODO:` **Aviso benigno de Chromium: «el anclaje de desplazamiento se desactivó… demasiados ajustes
  consecutivos». DECIDIDO (2026-10-01): no se actúa.** Lo produce el encabezado que se achica **cambiando su alto en el
  flujo** (80→64 px) y **animado** (200 ms), en `+layout.svelte`: cada cruce mueve el contenido 16 px y la animación lo
  hace **cuadro por cuadro** (~12 ajustes de ~1,3 px), así que tras diez ajustes con distancia diminuta el navegador **se
  rinde y lo desactiva** en ese contenedor —los números del mensaje del autor, −1,13 px promedio y −11,27 px total, son
  exactamente eso, no saltos de 16 px—. **Aparece en TODAS las páginas** porque el encabezado vive en el layout global: no
  son varios problemas, es uno. **Medido el 2026-10-01 y no produce salto visible** (cruzando una vez y oscilando 12 ciclos
  sobre el umbral, la compensación es exacta en cada cruce; la consola no lo repitió en headless). **Si alguna vez molesta,
  la opción es achicar sin tocar el flujo** (`transform`), que elimina la causa; **`overflow-anchor: none` sería PEOR**,
  porque esa compensación es lo que hoy evita el salto. El detalle de la medición está en los commits `e891ed5` y `389f2d0`.
  _Origen: el mensaje de consola que el autor vio el 2026-09-24, en el buscador y en la ficha del PDF de sonda; cierre por
  decisión del autor el 2026-10-01 (no es importante)._

- [ ] **[v0]** `TODO:` **Los pegados no comparten la medida del aire: cada superficie inventó la suya.**
  Observación del autor (2026-09-24) **y aparece justamente ahora que el encabezado se achica**: «el
  float-menu del dashboard es más pequeño que el de los menús del search, o que los resúmenes del
  form-create-dataset». **Medido — son TRES aires distintos más un número mágico:**
  - la **barra de acciones del panel**: `fixed inset-x-0 top-[var(--header-h)] … pt-2` → **8px** de aire, y
    **flota** como tarjeta (`rounded-xl border shadow-lg`, con `p-2` adentro);
  - la **barra de resultados del buscador**: `sticky top-[calc(var(--header-h)+1px)]` → **1px** (el borde del
    encabezado), y va **a ras**, ancho completo, con `border-b` y `py-4` adentro;
  - los **laterales** de la ficha del dataset y del asistente: `lg:top-[calc(var(--header-h)+1rem)]` → **16px**;
  - y el lateral de **facetas del buscador** sigue con `lg:top-40` → **160px**, un valor que nunca se midió
    (estaba anotado como observación no actuada en el recibo de E2).
  **Estado medido (2026-09-30): VIVO.** No existe ningún token `--sticky-air` y los aires siguen distintos: `pt-2` en el
  dashboard (`:393`), `+1px` en search (`:354`), `+1rem` en las dos laterales y `top-40` en las facetas. **Frena en la
  decisión del autor:** tarjeta flotante o barra al ras.

  Y son **dos tratamientos**: tarjeta flotante (panel) contra barra a ras (buscador). **Propuesta:** es el mismo
  problema que el alto del encabezado, así que se arregla igual — **un token** (`--sticky-air` en
  `src/app.css`) del que salen todos los offsets pegados, **más una decisión del autor**: ¿flotante o a ras para
  todas? Pertenece al **bloque E**.

  - **Un riesgo que había que medir antes de tocar `site_url`, y está resuelto: el callback del DataPusher NO depende de `site_url` en este stack.** `ckanext/datapusher/logic/action.py:67-71` usa `ckan.datapusher.callback_url_base` **y sólo cae a `ckan.site_url` si esa opción falta**. Acá **está seteada**: `CKAN__DATAPUSHER__CALLBACK_URL_BASE=http://ckan-dev:5000` (verificado en el entorno del contenedor), y el pusher **resuelve y alcanza** ese nombre (`getent hosts ckan-dev → 172.19.0.4`, `wget → rc=0`). Por eso la subida al DataStore de la sonda D0 funcionó con `site_url = localhost`: **el pusher nunca usó `site_url`**. Conclusión medida: cambiar `site_url` a la URL pública **no toca la carga al DataStore**. (Contraste: la IP de LAN del host **no** es alcanzable desde el contenedor del pusher — el `wget` a `192.168.1.201:5000` no completa —, así que `callback_url_base` debe seguir siendo la dirección interna del servicio.)
  - **Trampa futura a tener escrita:** el embed de RF-30 depende de que el origen de CKAN sea alcanzable **y del mismo esquema** que el portal. Si el portal se sirve por `https` y `site_url` queda en `http`, el navegador bloquea el `<iframe>` y el `<img>` por contenido mixto. Al fijar la URL pública hay que fijar **las dos** con el mismo esquema.
  - **Arreglo, en orden de riesgo:** (1) `CKAN_SITE_URL` con la URL pública real —en este dev, la IP de LAN— es lo que desbloquea el síntoma entero, y es del repo `odp-docker`; (2) quitar el fallback `|| "http://localhost:5000"` o hacerlo **fallar ruidosamente** si la variable falta; (3) decidir si `APP_URL` se usa o se borra. **Recomendación de momento:** va antes que D3, porque sin esto los visores por tipo que acabamos de aprobar no se pueden verificar de verdad desde otra máquina.
  _Origen: reporte del autor, 2026-09-23; medición propia del mismo día (`ckan.site_url`, el `curl` a la IP de LAN y el inventario de `localhost` en `src/`)._

- [ ] **[v0] Rotar las credenciales de la base que estuvieron expuestas** — hasta el 2026-09-24, el
  Flask-DebugToolbar del CKAN de desarrollo estaba activo, y **cualquiera en la LAN** que abriera
  `http://192.168.1.201:5000/` sin autenticarse recibía la configuración entera de CKAN, con
  `postgresql://ckandbuser:ckandbpassword@db/...` y `postgresql://datastore_ro:datastore@db/...`
  en claro (medido: 9 apariciones en la home). El toolbar **ya está apagado** (ver abajo), pero las
  credenciales siguen siendo las mismas que estuvieron publicadas: hay que rotarlas. Cuando se
  rehaga el volumen para el upgrade a 2.12 es el momento natural, porque el cambio va en
  `ckan-docker/.env`.
  *(Pendiente: `.env` y `.env.example` son rutas de entorno que el harness no autoriza a editar
  desde acá — las aplica el autor a mano.)*
  **Estado medido (2026-09-30): VIVO — es tarea de operación, no de código.** Las credenciales de `postgresql` siguen siendo
  las mismas que estuvieron publicadas. **Frena en la acción del autor** (se aplica a mano sobre `.env`, ruta que el harness
  no autoriza a editar).

  **El arreglo, para que no vuelva:** la imagen `ckan-dev` fuerza `debug = true` en el ini en CADA
  arranque (`/srv/app/start_ckan_development.sh:11`), y `debug` es lo que activa el
  Flask-DebugToolbar. Una variable de entorno **no** lo apaga: `CKAN___DEBUG` sí llega a la config
  global (`debug` quedaba en `False`, verificado) pero el toolbar lee el **ini**, no esa config; y
  las variantes son traicioneras por silencio — `CKAN__DEBUG` mapea a `ckan.debug` y `CKAN_DEBUG`
  a `ckan_debug`, una clave que no lee nadie. La solución es un script en `/docker-entrypoint.d/`,
  que corre DESPUÉS de esa línea y ANTES de levantar el servidor:
  `ckan-docker/ckan/docker-entrypoint.d/02_disable_debug_toolbar.sh`, montado por el compose de dev
  (y horneado por el `COPY` del Dockerfile para quien reconstruya). **No afecta al hot reload**,
  medido: se tocó `ckanext-umss/plugin.py` y CKAN se recargó igual; tampoco al depurador de
  Werkzeug, que depende de `--disable-debugger`, no de `debug`.

  **Lo que sí se pierde:** el JS/CSS sin minificar de la UI nativa de CKAN y su modo debug de
  plantillas. Irrelevante mientras la interfaz sea el portal.

- [ ] **[v0] Higiene de configuración de versión** — `CKAN_VERSION=2.10.0` en
  `ckan-docker/.env` y `.env.example` es **config muerta** y hay que quitarlo: cero referencias en
  este repo y también cero en el upstream (cuyo compose usa `build:`, no `image:` con ese valor).
  Es lo que hacía creer que el stack corría 2.10 cuando corre 2.11.6; la versión real la fija el
  `FROM` de los cuatro Dockerfiles. *(Pendiente al 2026-09-24: la edición de `.env` y
  `.env.example` requiere autorización explícita del autor, porque son rutas de entorno.)*
  **Actualización medida (2026-09-29):** el commit `a128b4f` quitó la clave de `.env.example`;
  la copia de `.env` **no es verificable desde la sesión** (el guardrail bloquea esa ruta), así
  que la aplica el autor si sigue ahí. El ítem sigue **abierto** por esa mitad y por la decisión
  de pinear o no los `FROM` en el minor.
  **Estado medido (2026-09-30): VIVO, abierto por partida doble.** `a128b4f` tocó **sólo `ckan-docker/.env.example`**; la copia
  de `.env` **no es verificable** desde la sesión (ruta de entorno bloqueada), así que esa mitad va como nota y **no** como
  cierre. Y sigue pendiente la decisión de pinear o no los cuatro `FROM`.

  **`SOLR_IMAGE_VERSION=2.10-solr9` se dejó como está, a propósito:** es el valor que trae el
  upstream junto al base 2.11, así que no era un error propio. Al subir a 2.12 hay que moverlo a
  `2.12-solr9`. **Hecho (2026-09-27):** `5d47358` dejó `.env` y `.env.example` en `2.12-solr9` —el tag
  que el stack realmente corre, ya no por override de shell—. **Y `reindexar` resultó innecesario, y
  eso está medido:** el configset del core vive en el **volumen**, no en la imagen; el motor de Solr
  es el mismo en los dos tags (`solr-spec 9.9.0` / `lucene 9.12.2`), y lo único que cambia es el
  `managed-schema` que trae la imagen. Por eso el índice siguió legible con el tag viejo **y** con el
  nuevo: `numFound: 17` y `package_search: 16` sin cambios antes y después. Lo que se re-sembró fue el
  **catálogo**, y eso fue del volumen limpio del upgrade (2026-09-24), **no** del cambio de tag.
  **No dar por hecho un reindex acá: verificar el índice.** _(Precisión hecha el **2026-09-28**, un día
después del cierre que describe el encabezado de esta sección; medición completa en
`odd/tasks/ckan-2.12-upgrade.md`.)_

  Y **los `FROM` quedan flotando en el minor (`2.11`)**: es una decisión, no un descuido. Pinear el
  patch (`2.11.6`) da reproducibilidad byte a byte, pero obliga a bumpear a mano para recibir los
  parches de seguridad y despega el archivo del upstream congelado. Si algún día importa la
  reproducibilidad exacta, se pinean los cuatro a la vez — con la subida a 2.12 es el momento
  natural para decidirlo.

- [~] **[v0] Higiene de versión: el tag de CKAN sin fuente única** — hallazgo `R2-002`
  del linaje huérfano de la revisión del upgrade: `pre-existing`, SUGGESTION, **no** introducido por
  el upgrade. El tag vivía como literal en los 4 `FROM` de los Dockerfiles, en las imágenes de
  servicio de `.github/workflows/checks.yml` y en una celda de tabla del README, sin fuente única: un
  bump exigía ediciones coordinadas, y una olvidada deja el CI corriendo otra versión que los
  stacks — pasó de verdad con `redis:3`, que el 2.12 destapó (`HELLO`/RESP3) y que `d861c95` arregló.
  Origen: store nativo, linaje `review-7e3ab346bc8b3f85`; transcripción completa en
  `odd/tasks/ckan-2.12-upgrade.md`.
  **Estado al 2026-09-29 — cerrado por partes, y la marca es `[~]` a propósito:**
  (a) **la deriva del tag de CKAN queda máquina-verificada** por
  `ckan-docker/ckan/tests/test-ckan-image-tag.sh` (`f21dc6b`, rango gateado
  `f4c4ca0..4910824`): compara los cinco sitios que nombran `ckan/ckan-base`/`ckan/ckan-dev` y
  falla nombrando archivo y tag; un sitio que deja de nombrar CKAN, una extracción vacía o un digest
  también fallan. Se descartó `ARG` como solución (los cuatro Dockerfiles extienden dos imágenes
  distintas y el `container:` del workflow lo resuelve el runner).
  (b) **NO cubre** las imágenes de servicio ni la celda del README, por decisión medida: sus tags los
  gobiernan otros upstreams (el de Solr lleva sufijo `-solr9`).
  (c) **Sigue abierto y con dueño propio el caso que sí mordió:** el `redis:6` del job frente al
  cliente de CKAN 2.12 (`HELLO`/RESP3). Hoy vive en un comentario del workflow, **sin guarda**; es el
  candidato natural para la próxima guarda de versión, y no lo cierra `f21dc6b`.

- [ ] **[v0]** `TODO:` **Las vistas previas son chicas: no aprovechan la pantalla.** Observación del autor (2026-10-01):
  «para el caso de los pdf creo que ese espacio es pequeño, creo que lo mismo aplicará para otros view, como los gráficos y
  demás». **Medido en el código hoy:** el `<iframe>` del PDF mide **`h-[520px]`** (`ResourcePreview.svelte:131`), la imagen
  **`max-h-[520px]`** (`:138`), el texto **`h-[360px]`** (`:151`), y los esqueletos de carga `min-h-[420px]` (`:113`) y
  `h-[420px]` (`resource/[resourceId]/+page.svelte:425`). **La tabla, en cambio, no tiene tope**: sólo `overflow-x-auto`
  (`DataPreviewTable.svelte:28`), así que crece con las filas — es la única de las cuatro sin alto acotado, y conviene
  decidir si eso se mantiene.
  **Dos cosas antes de tocar nada:** (1) **medir cuánto alto libre queda en 1080p** —hay que descontar el encabezado
  (`var(--header-h)`), la miga, el hero y la banda de acciones—, porque hoy ningún número está medido contra la ventana;
  (2) **decidir el criterio**: alto fijo más grande, proporcional a la ventana (`vh`), o con un control para **expandir la
  vista** —y en ese caso, si es por vista o general—. **Es decisión del autor, con la medición hecha primero**, y es de la
  misma familia que el ítem del responsive del salto.
  **Los gráficos y mapas todavía no existen**: son el Módulo de Análisis, diferido a `v1+`, y los tabs simulados se
  quitaron el 2026-09-28. Hoy el ítem aplica a PDF, imagen, texto y tabla.
  _Origen: observación del autor, 2026-10-01, al revisar la vista previa de un PDF._

- [ ] **[v0]** `TODO:` **El encabezado dice «sesión iniciada» con una sesión muerta: la sonda corre sólo donde una pantalla la pide.**
  Reportado por el autor (2026-10-02): puede seguir navegando la plataforma mientras el encabezado muestra su identidad, y el aviso de
  sesión expirada aparece **recién cuando intenta algo del usuario** (el dashboard o un privado).
  **Medido en el código:** la sonda existe y está bien diseñada —`src/lib/api/session.ts`: el 404 de `user_show {}` corroborado por
  `status_show`, y `inconclusive` que **no** expulsa a nadie porque un hipo de CKAN no es una sesión muerta—, pero **sólo la llama el
  dashboard** (`src/routes/dashboard/+page.svelte`, `iniciarPanel()`, que además no pinta identidad hasta que resuelve:
  `sessionNotDead`). El encabezado (`src/lib/components/auth/UserMenu.svelte`) pinta `$auth.user` del almacén **sin comprobar nada**, así
  que la identidad sobrevive a la muerte del token.
  **Propuesta (decisión del autor):** una **sonda única a nivel de app** en el layout raíz —al montar si hay token guardado, y al
  recuperar foco/visibilidad de la pestaña—; ante `dead`, limpiar la sesión y **reflejarlo en el encabezado sin expulsar de una página
  pública** (navegar al login desde una página pública sería echar al usuario de lo que está leyendo); en páginas del usuario, mantener
  el comportamiento actual (`endInvalidSession` + `expired=1`). `inconclusive` no toca nada.
  **Costo:** una petición por carga/foco (`user_show {}`), y `status_show` sólo cuando el 404 necesita corroboración.
  _Origen: reporte del autor el 2026-10-02. **No es pulido: es honestidad** —el encabezado miente hoy—._

## v1 — producto usable en producción

- [ ] **[v1] Buscador: que las cards se fijen completas al scrollear (scroll snapping).** El usuario lo
  pide y recuerda haberlo hecho antes; **medido el 2026-09-17: hoy NO existe ninguna clase `snap-*` ni
  `scroll-mt` en el repo**, así que es net-new y no una regresión. Dirección: `snap-y snap-proximity` (o
  `snap-mandatory`) en el contenedor de scroll y `snap-start` en cada card. **La trampa es el encabezado
  pegajoso**: hay que compensarlo con `scroll-mt-*`, porque el buscador ya tiene un `aside` con
  `lg:sticky lg:top-40` y el encabezado del sitio mide `var(--header-h)` (5rem, `src/app.css`); sin ese margen
  la card se fija por debajo de la barra y se ve cortada. Se relaciona con «Buscador dentro del menú pegajoso», anotado más abajo.
  _Origen: pedido del usuario, 2026-09-17._
  **Hallazgo (2026-10-03) — la premisa del ítem no se sostiene: NO hay contenedor de scroll.** La dirección de
  arriba dice «en el contenedor de scroll», y la lista de resultados **no lo tiene**: es un `div.space-y-4` en el
  flujo normal del documento, y el único `overflow-y-auto` de la página es el del `aside` de filtros
  (`lg:overflow-y-auto`, `lg:sticky lg:top-40`). O sea que el *snapping* no tiene dónde vivir sin decidir algo antes.
  Tres salidas, con su costo:
  **(a)** `scroll-snap-type: y proximity` en el scroller de la página más `snap-start` en las cards, apoyado en el
  `scroll-margin-top` que ya existe (`estiloDestino`, ligado a `--header-h`): el cambio más chico, y `proximity` no le
  pelea al scroll largo ni a las otras secciones («pruebe con», «recientes», «organizaciones») ni al encabezado que se
  achica; el ajuste es sutil por definición.
  **(b)** `mandatory` en el scroller de la página: es el «se fijan» literal, pero gobierna **todo** el desplazamiento de
  la página, y con el encabezado de alto variable (`E2b`), el sidebar *sticky* y las secciones altas es el más propenso
  a sentirse roto.
  **(c)** darle a la región de resultados su propio `overflow-y-auto` con altura acotada: *snapping* contenido y
  predecible, a costa de **dos áreas de scroll anidadas** en una página que ya tiene una.
  **Y una corrección útil: el *snapping* SÍ es verificable sin contenedor de frontend.** Medido el 2026-10-03 en
  chromium headless sobre sondas propias: en un contenedor con `scroll-snap-type: y mandatory`, `scrollTop = 250`
  termina en **202**, `scrollTo(310)` en **404** y `scrollTo(410, smooth)` en **404**; sobre el scroller raíz,
  `scrollTo(0, 500)` termina en **410**. El navegador aplica el *snapping* y devuelve el desplazamiento **ya ajustado**:
  es comportamiento medido, no estilos computados. El motor de layout lo da un `vite dev` de host **efímero** levantado
  desde el `node_modules` de este worktree —uso que `AGENTS.md` documenta como legítimo para medir un worktree que el
  proxy no monta—. Lo que falta acá no es una forma de medir: es **elegir (a), (b) o (c)**.
  _Anotado por la sesión paralela, 2026-10-03. Sin cambios de código por esta nota._

- [ ] **[v1] Unificar qué significa «sin licencia» en el catálogo.** Hoy conviven **dos representaciones
  del mismo hecho**: `license_id` vacío/NULL (lo que escribe el portal cuando no se elige ninguna, porque
  el campo es opcional) y `notspecified` (el id que CKAN ofrece y que su propia UI escribe). Medido el
  2026-09-14 en la base de dev: `cc-by|5`, `cc-by-sa|4`, `cc-zero|4`, `odc-odbl|3`, `notspecified|1`, y
  **ningún** vacío. Consecuencia: el facet de licencia puede partir «sin licencia» en dos cubetas.
  Decidir cuál es el canónico y alinear el facet. **El duplicado del select ya se arregló**
  (`5d0b751`); esto es la parte de fondo. _Origen: revisión de UI del 2026-09-14._

- [x] **[v1] Estrategia del ciclo de vida de publicación** — **MOVIDA al cambio SDD
  `2026-09-13-publication-lifecycle` (2026-09-13)**; ver «En curso (cambios SDD)». Lo que sigue es el
  registro histórico de las opciones evaluadas el 2026-09-11, ya superado por el diseño de ese cambio:
  - (A) Custom liviano en el portal: `package.extras.lifecycle_status` + `private` + endpoint
    server-side propio con las transiciones. Menor costo y control total.
  - (B) Extensión CKAN de terceros: `ckanext-workflow` / `ckanext-datasetapproval` /
    `ckanext-approvalworkflow`. Trae el flujo resuelto, pero ata el proyecto a extensiones de
    madurez dispar y hay que verificar compatibilidad con CKAN 2.10 y con `ckanext-umss`.
  - (C) Extensión propia (`ckanext-umss`) que agregue el ciclo de vida.

  Preferencia expresada por el usuario: extensión propia, con algo más liviano si conviene.
  **Bloquea RF-14 a RF-17, RF-23 y RF-33.**

- [ ] **[v1] El token de CKAN no debe ser legible por JavaScript (endurecimiento)** — hoy el JWT
  vive en `localStorage` y el navegador lo manda en `Authorization`. En `v0` es un trade-off
  aceptado, no un bug. El costo real es XSS: el portal renderiza contenido que viene de CKAN
  (descripciones markdown, `url`s, nombres de recursos) y el token dura 24 h y además puede
  acuñar y revocar tokens de esa cuenta.

  **Lo que este ítem decía antes quedó retirado el 2026-09-24: era incorrecto y no era
  ejecutable.** Tres mediciones, todas contra el CKAN 2.11.6 que corre:
  1. **`ckan.auth.disable_cookie_auth_in_api` no existe.** `grep` sobre todo el árbol de CKAN:
     cero ocurrencias. La opción real es **`ckan.auth.enable_cookie_auth_in_api`**
     (`config/config_declaration.yaml`, `default: True`; `ckan.ini:107` la fija en `true`). Tal
     como estaba escrito, el ítem habría sido un **no-op silencioso**.
  2. **Poner la real en `false` hoy rompería el login.** `mintToken`
     (`src/lib/server/ckan-auth.ts`) autentica `POST /api/3/action/api_token_create` con
     **cookie de sesión + `X-CSRFToken`**, no con un token, y `ckan/logic/auth/create.py` exige
     identidad autenticada (`user.name == context['user']`). La doc de la propia opción advierte
     que rompe módulos del frontend que llaman a la API.
  3. **El truco de nginx no cubre CSRF.** El navegador manda la cookie sola, así que
     `proxy_set_header 'Authorization' $cookie_<nombre>` autenticaría *cualquier* request que la
     traiga, incluidas las que mutan.

  **Diseño propuesto (BFF):** el servidor del portal guarda la credencial de CKAN y el navegador
  sólo tiene una cookie de sesión httpOnly del portal; `hooks.server.ts` inyecta `Authorization`
  server-side hacia `CKAN_INTERNAL_URL`. Con eso, `enable_cookie_auth_in_api = false` pasa a ser
  una **consecuencia** del diseño, y segura.

  **Restricción que hay que decidir ANTES de implementarlo:** sin credencial de CKAN en el
  navegador, **las descargas de datasets privados fallan** — `/dataset/.../download/...` autoriza
  con cookie o con token. Si hay que servir archivos privados desde el navegador, el portal tiene
  que streamear los bytes (con soporte de `Range`, que el visor de PDF necesita) o emitir un token
  de vida corta. Los datasets públicos no tienen ese problema.

  **Efecto obligado sobre las subidas:** al sacar el token del browser, el archivo ya no puede ir
  directo a `/api/`; pasa a un `+server.ts` propio y por lo tanto aparecen dos requisitos:
  1. `BODY_SIZE_LIMIT` en el servicio `frontend` del compose (default de adapter-node: **512 KB**).
     Trampa medida el 2026-09-11 sobre el build real: al excederlo el adapter **no devuelve 413**,
     devuelve **HTTP 400 con el mensaje de error de la propia app** (un `request.json()` que falla
     al leer el body), así que parece un error de validación y no un límite de tamaño. Con
     `BODY_SIZE_LIMIT=55M` el mismo body de 2 MB se leyó completo.
  2. Un método multipart en `src/lib/api/client.ts`, que hoy hardcodea `Content-Type:
     application/json` + `JSON.stringify` y por eso no puede subir archivos. CKAN exige
     `multipart/form-data` con la clave `upload` y pasar el `FormData` intacto, **sin** setear
     `Content-Type`.

  Mientras tanto el límite de adapter-node queda **deliberadamente sin subir**: en `v0` ningún
  route de Node recibe archivos, y ampliarlo sin consumidor agranda el body aceptado en todas las
  rutas del servidor. _Origen: research 2026-09-10 (ckanext-passwordless_api) + medición
  2026-09-11._

- [ ] **[v1] CKAN 2.12: decidir y planificar la actualización** — medido el 2026-09-24.

  Hoy el stack corre **2.11.6**, que es el **último patch de su línea** (2.11.6 se publicó el mismo
  día que 2.12.0, y 2.10 también recibió el suyo: quedarse en 2.11.x es una posición soportada, no
  un abandono). **CKAN 2.12.0 existe** (2026-08-26) y trae dos cosas que tocan este proyecto:
  *«Files are now first-class entities and can be uploaded and managed separately from resources»*
  y el tema `midnight_blue`.

  **Lo que la actualización exige, medido:**
  - El changelog oficial pide `ckan db upgrade` **más** el script SQL de
    `ckan datastore set-permissions` **más** upgrade de requirements. **En dev eso es evitable:**
    los datos son de prueba, así que un volumen nuevo (`down -v`) instala desde cero y de paso
    valida el camino de instalación limpia.
  - Las imágenes de 2.12 son **`2.12-py3.14`** (2.10 y 2.11 publican `py3.10`), y el compose de dev
    monta `site_packages:/usr/local/lib/python3.10/site-packages` — ruta específica de py3.10.
    El changelog dice «supports Python 3.10 and later», así que el requisito es el *mount*, no el
    intérprete.
  - **El empaquetado Docker no está listo:** `ckan/ckan-docker` **no tiene tags** y su `master`
    sigue en `FROM ckan/ckan-base:2.11`, con `SOLR_IMAGE_VERSION=2.10-solr9`. Subir a 2.12 es
    mantener el empaquetado, no cambiar una línea. (Existen `ckan/ckan-solr:2.12-solr9` y
    `ckan/ckan-base:2.12.0-py3.14`.)
  - **Re-medir las suposiciones del portal contra 2.12**, porque el proyecto tiene evidencia
    medida contra 2.11.6 y esa evidencia no se hereda: el `404` de `user_show` con token muerto
    (`src/lib/api/session.ts`), el `expires_in`/`unit` obligatorios de `api_token_create` por
    `expire_api_token`, y sobre todo **la forma de la `url` de descarga que arma
    `resource_dictize`** — justo lo que cambia si «files» pasa a ser una entidad de primera clase.
  - Verificar además los plugins habilitados (`image_view text_view datatables_view datastore
    datapusher envvars expire_api_token umss`), la imagen del DataPusher (`0.0.21`) y el job
    `umss-tests` del CI, hoy pineado a `ckan/ckan-dev:2.11`.

  **Recomendación:** hacerlo como **slice propio** (backup, rama, CI) y **en aislamiento** — no
  mezclarlo con el arreglo de `ckan.site_url` ni con el endurecimiento de auth, o no se va a poder
  atribuir ninguna causa a ninguno de los dos. A favor de hacerlo pronto: cuanto más se construya
  sobre 2.11, más mediciones específicas de 2.11 hay que rehacer.

  **El plan está escrito:** `odd/tasks/ckan-2.12-upgrade.md` (acá, versionado) — slices S0–S6, la base
  medida, las siete suposiciones del portal a re-medir y las superficies de edición. **No ejecutado:**
  espera revisión del autor. Vive en este repo y no en `odp-docker` porque ahí `odd/` está excluido
  por `.git/info/exclude` y no viajaría con el repo.

  **Y un dato que cambia la urgencia:** los ocho `GHSA` que anunció 2.12.0 **también figuran en el
  changelog de 2.11.6**. La versión que corre ya está parchada, así que **la seguridad no es el
  motivo para subir**. El motivo real es que 2.12 rehace el manejo de archivos —`Upload` y
  `ResourceUpload` pasan a `FKUpload`/`FKResourceUpload`, aparecen storages configurables y acciones
  nuevas de files— y ese es el dominio central del portal: si hay que adaptarse, mejor antes de
  construir `v1` encima de la semántica de 2.11.

  _Origen: pregunta del autor, 2026-09-24; medición propia del mismo día (changelog oficial,
  tags de Docker Hub y estado del repo `ckan/ckan-docker`)._

- [ ] **[v1] Los roles en el front no se distinguen: ¿qué diferencia hay entre un usuario, un admin de
  organización y un superadmin?** — Observación del autor (2026-09-28), al revisar el badge del dashboard:
  «en CKAN la tenemos clara con eso de agregar cosas como el CSS y demás, pero en este nuevo front no termina
  de quedar muy claras las diferencias». **Punto medido que la origina:** al corregir el badge se encontró que
  la **misma palabra** designaba dos permisos incomparables — el `sysadmin` del sistema y `capacity: "admin"`
  de una organización—, y el portal no tiene hoy **ninguna superficie** que explique qué puede hacer cada rol ni
  qué cambia en la interfaz según el rol. CKAN los distingue (capability por organización, `sysadmin` global) y
  la API los expone; lo que falta es **decidir cómo se muestran y se nombran en el portal**. Es a futuro, en
  palabras del autor. _Origen: revisión del badge `Administrador del sistema`, 2026-09-28._

- [ ] **[v1] Un editor de organización pierde la capacidad de cambiar `state` cuando entre el guard de
  publicación** — **medido (2026-09-14, P4a):** hoy un editor de org **sí** puede `package_patch
  {state:"draft"}` (200, guardado), y puede volver a `active`. Es una consecuencia **deliberada** del
  guard de `2026-09-13-publication-lifecycle` (restaura la intención de `ignore_not_package_admin`), pero
  es una capacidad **alcanzable hoy**, no un caso teórico. Pendiente para `v1`: decidir si el portal (o un
  override de plantilla de CKAN) expone el estado de forma honesta, y si la retracción de un dataset
  publicado merece un flujo propio. _Origen: diseño del cambio + sonda P4a._

- [ ] **[v1] Gestión de organizaciones en el portal** — CRUD de organizaciones
  (`organization_create` / `organization_update`) y de miembros
  (`organization_member_create`). _Referencias: PRD RF-06 a RF-08._

- [ ] **[v1] Auditoría de operaciones críticas** — RF-33/RF-34 piden retención de 5 años y
  registro de logins/logouts; la `activity` nativa de CKAN es insuficiente. Evaluar
  `ckanext-event-audit`. Depende del ciclo de vida resuelto.

## v1+ — diferido de v1 o conveniente sin ser requerimiento

- [ ] **[v1+]** `TODO:` **La lista de recursos: íconos por tipo en vez de badges de formato, y los badges a otro sitio.** Observación del
  autor (2026-10-02, al revisar la hoja `/dev/dataset-edit`): «me gusta más el ícono de los tipos que lo que tenemos en la page de
  datasets, esos badges indicando el tipo; anota esto como un TODO para usar estos íconos y mover los badges a otro sitio».
  **Medido:** los íconos por tipo que le gustaron están en la hoja —`FileText` para archivo y `Link` para enlace, elegidos por el
  tipo del recurso—, y los badges de formato que quiere reubicar viven en `src/lib/components/dataset/ResourceCard.svelte` (la lista
  de recursos de la página del dataset) y en `src/lib/components/search/DatasetCard.svelte:113` (`formatChips` + `getFormatAccent`,
  acento sobre neutro). **Ojo con la regla:** el recurso que devuelve CKAN **no** trae un campo «tipo» explícito; el portal lo
  infiere de `url_type === "upload"` (medido antes en el proyecto), así que el ícono se decide con esa regla, no con `format`.
  **Decisión pendiente del autor:** dónde van los badges de formato una vez que el ícono diga el tipo —¿la card técnica, el detalle
  del recurso, o se eliminan?—.
  **Nota de higiene de UI, compartida:** las acciones de la fila usan `title` nativo + `aria-label` (la convención del repo, igual
  que `FacetFilter.svelte` y los botones de la página del recurso). Un tooltip **estilizado** es otro trabajo, y es el mismo que
  pide el ítem de los tags de la card: si algún día se vendoriza el `Tooltip` de bits-ui, se resuelven los dos juntos.
  _Origen: revisión de la hoja de edición, 2026-10-02._

- [ ] **[v1+] Prueba de carga, cuando el CRUD esté completo.** El usuario la quiere, y el orden que
  propuso es el correcto: **recién cuando existan create + read + update + delete**. Una prueba de carga
  sobre un CRUD incompleto mide un sistema que todavía no es el que va a recibir la carga. Alcance a
  definir cuando llegue el momento (concurrencia, tamaño de archivo, escritura contra DataStore).
  _Origen: revisión del 2026-09-14._

- [ ] **[v1+] Colaboradores por dataset y equipos, con la procedencia del permiso.** El PRD ya cubre las
  entidades (`dataset_collaborators` en RF-18, `teams`/`team_members` en RF-19, y su mapeo en §7), y CKAN
  trae `package_collaborator` nativo desde 2.9 — **apagado** por la bandera del ítem `[v0]` de más
  arriba. **Lo que el PRD NO tiene, y hay que agregarle cuando se diseñe:** registrar **cómo** se otorgó el
  permiso — **por un equipo** (grupo interno de la organización que sirve para administrar usuarios,
  análogo a las colecciones de datasets) **o directo** al usuario. El resto de lo pedido ya está en el
  esquema de §7 (`granted_by`, `created_at`, `role_alias`); la procedencia «equipo vs directo» no.

  **Consecuencia en el producto, que ya se ve hoy:** «mis datasets» deja de significar «los que creé» y
  pasa a ser «los que puedo editar (editor) o de los que soy steward», que es justamente lo que promete el
  copy actual de la tarjeta del dashboard. El slice A del trabajo `v0-portal-honesty` lista **sólo los
  creados por el usuario** y ajusta el copy a eso; cuando esta entidad exista, el copy y la consulta
  vuelven a cambiar. _Origen: respuesta del usuario del 2026-09-17 sobre el alcance de «Mis datasets»._

- [ ] **[v1+] Notas de UI de las páginas de organizaciones.** Al usuario **le gustan** las cards de
  `/organizations`; son mejoras para después, no defectos. Anotar concretamente qué mejorar cuando se
  retome esa página (y la de detalle `/organization/[id]`, que quedó bajo la misma observación).
  _Origen: revisión del 2026-09-14._

- [ ] **[v1+] Metadatos de interoperabilidad (DCAT/Dublin Core)** — agregar los campos que no
  tienen equivalente nativo en CKAN: idioma (`dct:language`) y periodicidad de actualización
  (`dct:accrualPeriodicity`). **Decisión 2026-09-11: se difiere a propósito y `v0` no escribe
  `extras`.** Motivo medido contra el código de `ckanext-dcat`: su vocabulario de `extras` **no es
  estable entre sus propios perfiles** — el perfil legacy `euro_dcat_ap` escribe `dcat_issued`,
  `dcat_modified`, `dcat_publisher_name`, `dcat_creator_name`, `guid` y `language` (sin prefijo,
  unido por comas), mientras que el perfil basado en `ckanext-scheming` guarda lo mismo como
  campos de primer nivel. Congelar nombres antes de elegir perfil obliga a migrar los extras de
  todos los datasets creados entre medio. Lo que `v0` necesita ya está cubierto: `issued` y
  `modified` caen a `metadata_created`/`metadata_modified`, el publisher cae a la organización
  dueña y el creator a `author`. **Antes de implementar esto hay que decidir el perfil DCAT.**
  _Origen: verificación contra la fuente de ckanext-dcat, 2026-09-11._

- [ ] **[v1+] Módulo de Análisis de CSV** — página 11 del inventario: cargar CSV, tabla
  normalizada, selector de columnas X/Y, gráficos (barras/líneas/pastel) con export PNG/CSV. Sin
  nada de código hoy. Es el **diferencial real del portal** frente al UI de CKAN.
  **Modelo de vistas (2026-09-13):** aquí viven las *vistas creadas* — una **definición de vista**
  (`tipo` + columnas + opciones) guardada en JSON en un `__extras` del recurso (no `resource_view`
  de CKAN), renderizada por el portal. La IA es un autor alternativo de esa misma definición.
  _Referencias: PRD §3 (módulo de análisis + modelo de vistas), PRD RF-24, design-system §9 item 11._

- [ ] **[v1+] Colecciones (grupos de datasets)** — mapea a `group` + `group_member`. El flujo de
  aprobación por cada organización propietaria (RF-23) es custom y depende del ciclo de vida.

- [ ] **[v1+] Gestión de usuarios y roles en el portal** — RF-03 pide que un `org_admin` cree
  usuarios de su organización. **Choca con el endurecimiento ya aplicado:** la autorización de
  `user_create` depende de `ckan.auth.create_user_via_api`, que hoy está en `false`. Además, en
  CKAN nativo un `org_admin` sólo puede *agregar usuarios existentes* a su organización, no
  crearlos. Decisión: en `v0`/`v1` los usuarios se gestionan en el UI de CKAN; llevarlo al
  portal exige reverir ese hardening o construir una capa de usuarios aparte.
  _Origen: análisis 2026-09-11._

- [ ] **[v1+] Versionado con estados de aprobación** — RF-14/RF-16. Sin API nativa.
  `ckanext-versions` declara compatibilidad sólo con CKAN 2.9; `ckanext-datasetversions` es una
  alternativa aparte. Depende de la estrategia del ciclo de vida.

  **Dos diseños anotados (2026-09-13, idea del usuario) para cuando se implemente:**
  - **A — desnormalizado:** la versión actual vive en la tabla principal (`datasets`) y todas las
    versiones en `dataset_versions`. Consultas de catálogo muy rápidas (sin joins), pero **duplica los
    campos de contenido** y exige un trigger o transacción que sincronice ambas tablas, con el riesgo
    de inconsistencia que eso trae.
  - **B — normalizado:** `datasets` guarda sólo identidad y puntero a la versión actual; el contenido
    descriptivo vive inmutable en `dataset_versions`, y una **vista** (`datasets_current`) resuelve el
    join para que la aplicación consulte como si fuera una sola tabla. Una única fuente de verdad, sin
    riesgo de desincronización.

  **Advertencia arquitectónica, antes de elegir:** los dos diseños asumen una **base relacional propia
  del portal**, y hoy el portal es **CKAN headless** — no tiene base de datos. Primero hay que decidir
  *dónde* vive ese esquema: tablas propias dentro de `ckanext-umss`, o una base nueva para el portal.
  Y esa decisión está **aguas abajo** de la estrategia del ciclo de vida (ítem `[v1]` de más arriba),
  que es la que define qué cuenta como versión y qué estados existen. Elegir A o B antes de eso sería
  congelar el esquema para un modelo de estados que todavía no existe.

- [ ] **[v1+] Gestión de colaboradores y equipos (UI)** — paneles de permisos por rol. Los
  colaboradores por dataset son nativos (ver `v0`); los equipos multi-organización son custom.
  _Referencias: PRD RF-19/RF-20, design-system §9 item 12._

- [ ] **[v1+]** `TODO:` **Pulido visual de las páginas de error.** El autor las revisó y los *mensajes*
  quedaron bien; lo que falta es la densidad visual: «se ven planas, sin color, sin gracia». Pedido:
  mejorarlas «como hicimos con las otras pages», cuando haya tiempo de detalles. Alcanza a
  `src/routes/+error.svelte` (el componente `ErrorPage`) y a la hoja `/dev/error`. No es un defecto de
  contenido: no cambiar la copia ni los dos estados al hacerlo.

- [ ] **[v1+]** `TODO:` **La paleta de formato, en la misma pasada de detalles.** Decisión del autor
  (2026-09-22): el chip de tipo de recurso queda **neutro** por ahora y la paleta se define **una sola
  vez** para todas las superficies (la lista del dataset, la ficha del recurso y, si corresponde, los
  chips del buscador). **Lo que hay que resolver cuando toque:** el chip compartido reemplazó un mapa de
  **10 formatos con color propio** (en `ResourceCard.svelte`, en HEAD antes de `fa96d5c`) cuyos valores
  eran `oklch` **crudos dentro del componente** —dos violaciones documentadas: `AGENTS.md` regla 3
  («Colores vía tokens, nunca hex crudos») y el anti-patrón del design-system §11 («Colores hardcodeados
  en componentes»)— y que ponía ~10 matices saturados donde el sistema admite **2 por pantalla**. La
  salida correcta por las reglas es **tokens en `src/app.css`** más la sección de roles en
  `design-system/datos-umss/README.md`, explicando por qué la paleta de formato extiende ese límite.
  **No restaurar el mapa crudo** sin esa decisión: repone las dos violaciones.

- [ ] **[v1+]** `TODO:` **Unificar los colores de los chips en las tres superficies, y resolver el del «Enlace».**
  Pedido del autor (2026-09-22). Hoy hay **dos paletas y un neutro**: el buscador (`DatasetCard.svelte`)
  tiene su propio mapa `FORMAT_ACCENT` con ~8 matices en **clases Tailwind** (`text-blue-700`,
  `text-emerald-700`, …) sobre un marco apagado; la lista del dataset y el encabezado de la ficha usan el
  chip **neutro**; y el chip «Enlace» usa `bg-muted/50` mientras el de archivo usa `bg-muted`. **Esa
  diferencia de intensidad era intencional** —distinguía el enlace del archivo cuando el archivo llevaba
  color propio— **pero al pasar todo a neutro quedó sin razón**, y el autor la notó («veo que el color es
  un poco distinto»). **El patrón del buscador es el mejor candidato para la paleta unificada**: marco
  apagado y **sólo el texto** con el color del formato, que respeta mucho mejor el límite de «máximo 2
  colores saturados por pantalla» que un chip relleno de color. Une con el `TODO:` de la paleta de arriba.

- [ ] **[v1+]** `TODO:` **Chips y badges clicables: que manden al buscador filtrado por formato.**
  Pedido del autor (2026-09-22): que los chips de formato —los de las cards del buscador **y** los de
  dentro del dataset y de la ficha del recurso— sean un enlace al catálogo filtrado por ese formato. La
  pieza ya existe: la búsqueda soporta el filtro por `res_format`, en la faceta y en la URL
  (`/search?format=…`). **Dos decisiones abiertas al implementarlo:** (a) el chip **«Enlace»** no tiene
  formato que filtrar —¿no es clicable, o filtra por otra cosa?—; (b) un chip clicable **dentro** del
  dataset cambia el clic que hoy lleva a la ficha del recurso, así que hay que resolver esa superposición.

- [ ] **[v1+]** `TODO:` **Reordenar los recursos del asistente (arrastrar para mover, estilo lista de reproducción).**
  Pedido del autor (2026-09-22). **Factibilidad medida, para no volver a medirla:**
  (1) **La lista ya está lista para moverse:** `recursos = $state<RecursoEntry[]>([])` se renderiza con
  `{#each recursos as recurso (recurso.key)}` —está **claveada**—, así que reordenar es reordenar el array y
  Svelte **mueve los nodos** en vez de recrearlos: los archivos elegidos y el progreso de subida siguen
  pegados a su fila (con `File` y `AbortController` en juego, eso es lo que evita el bug).
  (2) **El orden llega a CKAN sin mandar `position`:** `ckan/model/resource.py:180` usa
  `ordering_list('position')` —renumera la colección como enteros ascendentes en cada modificación— y
  `ckan/lib/dictization/model_dictize.py:96` **devuelve los recursos ordenados por `position`**. El asistente
  crea recorriendo el array en orden (`for (const entry of recursos)`), así que **el orden del formulario es
  el que CKAN guarda y devuelve**. Gratis en la creación: `resource_create` ni menciona el campo.
  (3) **En móvil no habría arrastre igual:** el design-system §9 ya lo decidió («En móvil no hay arrastrar y
  soltar»), así que el arrastre no puede ser *el* mecanismo.
  **Escalera de costos:** (a) **botones ↑/↓ por fila** — chico, sin dependencias, funciona en táctil y con
  teclado, va al lado del `quitarRecurso` que la fila ya tiene, y resuelve el 100% de la capacidad;
  (b) **arrastre como extra para puntero** — decisión de dependencia (`svelte-dnd-action` es la habitual en
  Svelte; **hoy no hay ninguna**) o DnD nativo a mano (que **no** funciona en táctil ni por teclado), y **no
  reemplaza** a los botones: los complementa.
  **Lo que se vuelve caro:** si algún día hay **edición** de recursos, el orden deja de ser gratis — hay que
  persistir `position` con un `resource_update` por recurso. Hoy no hay edición: `resourceUpdate` existe en
  `src/lib/api/resources.ts` y **no tiene llamadores**.

- [ ] **[v1+]** `TODO:` **Los 11 diagnósticos de Biome: 4 son falsos positivos que NO hay que aplicar, 7 son cosméticos.**
  Medido el 2026-09-23 con el binario directo sobre el árbol actual: `Checked 135 files · 4 warnings · 7 infos`,
  **exit 0**. Lo que importa y no es obvio: **los 11 están marcados `FIXABLE`, pero los 11 son «Unsafe fix» y
  ninguno es «Safe fix»**. Consecuencia, y es buena noticia: **`pnpm lint:fix` no aplica nada**
  (`biome check --write` sólo aplica fixes seguros) y **el gancho de pre-commit tampoco los toca**. Sólo
  `--unsafe` los aplica, y **ahí está la trampa**:
  - **`src/app.css:139-142` (`lint/complexity/noImportantStyles`, 4 warnings) — NO TOCAR.** Son los `!important`
    del bloque `@media (prefers-reduced-motion: reduce)`. **Probado en una copia fuera del repo:**
    `biome check --write --unsafe` **los borra** (`animation-duration: 0.01ms !important` pasa a
    `animation-duration: 0.01ms`), y sin `!important` cualquier animación declarada con más especificidad vuelve
    a correr: es una **regresión de accesibilidad** y choca con la regla 7 de `AGENTS.md`. Arreglo correcto:
    **suprimir la regla** en ese bloque (`/* biome-ignore lint/complexity/noImportantStyles: … */`) o apagarla
    por override para `app.css`.
  - **`src/routes/search/+page.svelte:86-89` (`lint/complexity/useLiteralKeys`, 4 infos) — real y trivial:**
    `filterMap["organization"]` → `filterMap.organization` (y lo mismo con `res_format`, `tags`, `license_id`).
    Verificado que **no** rompe `pnpm check`: `tsconfig.json` —y el `.svelte-kit/tsconfig.json` generado— **no**
    activan `noPropertyAccessFromIndexSignature`, que es el flag que habría rechazado el acceso por punto.
  - **3 infos `lint/style/useTemplate` — reales, cosméticos:** `scripts/seed-ckan.mjs:119` y
    `src/lib/components/ThemePlayground.svelte:107`.
  - **`src/routes/search/+page.svelte:67` (`useTemplate`) — real, pero el fix automático es peor:** queda
    `` `/search${params.toString() ? `?${params.toString()}` : ""}` ``, un template anidado menos legible que
    **evalúa `params.toString()` dos veces**. A mano: `const qs = params.toString()` y usarlo una sola vez.
  _Origen: pedido del autor de comprobar los «fixeables» que muestra `pnpm lint`, 2026-09-23._

- [ ] **[v1+] Filtros dentro de la tarjeta «Mis datasets».** El usuario pregunta si conviene agregarlos
  como en el buscador (y observa que ni el dashboard ni la página `user/<nombre>` de CKAN los tienen).
  **Recomendación: no por ahora.** El buscador ya tiene búsqueda facetada; la tarjeta es una lista
  personal y corta, y meter filtros ahí duplica maquinaria —y superficie de revisión— para un caso que el
  buscador cubre. Cuando el volumen lo justifique, la vía barata es un **enlace al buscador prefiltrado
  por creador** (`fq=+creator_user_id:<id>`, el mismo filtro que ya usa la tarjeta), que reutiliza las
  facetas existentes en lugar de reimplementarlas. _Origen: pregunta del usuario, 2026-09-17._

## v2+ — mejoras futuras no solicitadas

- [ ] **TODO (pregunta del autor): ¿internacionalizar la UI (i18n)?** Notó que CKAN define el idioma y que en
  `src/lib/api/failure.ts` hay mucho español embebido. **Hechos, leídos y medidos:**
  (a) **el PRD NO pide multi-idioma**: la única mención de «idioma» es `RF-09` y es un **metadato del
  dataset** (el idioma de los datos), no de la interfaz;
  (b) **CKAN sí tiene i18n completo** (`ckan.locale`, `ckan.locales_offered`, traducciones en
  `ckan/i18n/<lang>/LC_MESSAGES/ckan.po`, decenas de idiomas), pero eso traduce **su** UI y sus mensajes de
  error, no la del portal;
  (c) el español de `failure.ts` es **copia de UI, no lógica**: es justo lo que se puede mover a un catálogo
  cuando toque, y el seam ya empezó (`src/lib/copy/` es la primera pieza).
  **Recomendación honesta: no hacerlo ahora.** No hay requisito ni segundo idioma pedido, y con un solo idioma
  multiplica el trabajo sin cambiar la experiencia. Lo que **sí** conviene —y ya está en marcha— es seguir
  sacando la copia a módulos: **es el trabajo que i18n necesita igual**, así que hacerlo ahora no cuesta
  extra. Cuando exista un segundo idioma real (pedido institucional, intercambio, alumnos extranjeros), el
  camino en SvelteKit es Paraglide JS o `svelte-i18n` más rutas por locale; no conviene decidir el
  anteproyecto antes de tener el requisito.
  _Origen: pregunta del autor, 2026-09-20._

  **Tier: `[v2+]`.** El disparador para revisitarlo es un **segundo idioma pedido de verdad** (pedido
  institucional, intercambio, alumnos extranjeros); sin eso, el único trabajo que ya conviene —sacar la copia
  a módulos— sigue en marcha como parte del trabajo normal, no de i18n.

- [ ] **TODO (pregunta del autor): ¿conviene un tutorial/onboarding que explique las acciones?**
  **Factible, sí, y técnicamente barato**: una librería de tours (Driver.js, Shepherd) o un `<dialog>` propio
  con una secuencia de pasos; no toca la arquitectura. **La dificultad no es implementarlo, es mantenerlo
  honesto:** un tour apunta a elementos que se mueven, se vuelve obsoleto en silencio y **ningún test lo
  detecta** — es documentación que envejece, pero peor, porque se le muestra al usuario con autoridad. Y hay
  una señal que conviene escuchar antes: **un tour suele ser el síntoma de que la interfaz necesita
  explicación**. Acá el problema conocido del asistente no es falta de guía —hoy tiene ficha lateral,
  metadatos siempre visibles y campos explicados— sino que **la copia miente** (el ítem del verbo «publicar»
  de arriba): un tutorial que diga «publique su dataset» repetiría la misma mentira con más pasos.
  **Recomendación: no hacerlo ahora.** Orden que sí recomiendo: primero la copia y los estados vacíos;
  después, **sólo con evidencia** de que la gente se pierde (soporte, analítica o tu propia observación), un
  tour **de una sola acción** —la de crear un dataset— antes que un tour general; y lo más barato, que no
  necesita librería: una página «Cómo funciona» de dos pantallas.
  _Origen: pregunta del autor, 2026-09-20._

  **Tier: `[v2+]`.** El disparador es que la UI tenga **más acciones** (después de v1) **y** evidencia de que la
  gente se pierde; el primer paso entonces es un tour de **una sola** acción, no un tour general.

- [ ] **[v2+] Roles / perfiles de usuario** — profundizar la gestión de roles más allá de
  `isSuperAdmin`. Se haría vía delta specs sobre `openspec/specs/authentication/spec.md`
  (agregar requerimientos), no reescribiendo la spec.
- [ ] **[v2+] Mockup OpenPencil** — `design-system/datos-umss/pages/datos-umss.op` queda como
  referencia visual pasiva (no tocado).
- [ ] **[v2+] Registro público de usuarios** — si algún día se quiere auto-registro, va en contra
  de PRD RF-03; decidir conscientemente antes de habilitarlo.
- [ ] **[v2+] Features "fuera de alcance v1" del PRD (candidatas v2)** — registradas como
  decisión en PRD §3 pero sin seguimiento: SSO/LDAP, mapas interactivos (datos geoespaciales),
  motor IA para sugerencia de gráficos/preguntas, extracción automática de metadatos
  (OCR/lectura de cabeceras), edición masiva de metadatos, integración con repositorios externos
  (Drive/Dropbox), auto-registro. _Referencias: PRD §3 "Fuera del alcance (v1)"._

## Datos y contenido (habilitador de QA, no es feature)

- [ ] **[v1+] Seed CKAN a escala** — poblar CKAN con ~1.500–2.000 datasets realistas para afinar
  la UI de search/facetas/paginado en condiciones cercanas a producción. Quedó en fase de
  planificación **sin decidir el camino**: (A) mock a escala arreglando el paginado del mock,
  (B) seed real vía `package_create` en paralelo, (C) insert directo + rebuild (descartado).
  Recomendación previa: B + A como colchón. _Origen: plan 2026-09-01._

  **Seed ligero de dev (no es el ítem a escala):** `scripts/seed-ckan.mjs` (2026-09-11) puebla
  el CKAN dev con 5 organizaciones + 16 datasets espejados de `src/lib/mock/data.ts`; idempotente
  por `name`, sin secretos en el repo (la contraseña admin se lee del entorno). Es contenido de
  desarrollo para que el portal no muestre listas vacías; el seed a escala de este ítem sigue
  pendiente.

- [ ] **[v1+] Datos de muestra para las vistas (contenido en el DataStore)** — la vista previa
  CSV lee de `datastore_search`, pero los recursos del seed son url-only (sin filas). Falta
  contenido durable en el DataStore para demoear las vistas. Decidir la fuente (CSVs chicos
  commiteados vs. generador determinista vs. upload real + datapusher) y hacerlo idempotente y
  determinista. _Origen: sesión 2026-09-11 (diferido); relacionado con "Endurecer la vista previa CSV"._
  **Estado del camino «upload real + datapusher» (2026-09-23):** la sonda D0 lo midió y **funciona** —subir
  un CSV lo dejó en el DataStore al instante, con `datastore_search` devolviendo las filas y la descarga
  sirviendo `Content-Disposition: inline` (que es lo que hace posible el embed de PDF/imagen de RF-30)—,
  así que esa opción dejó de ser una apuesta. **Falta una entrada del autor:** pidió aportar un **ejemplo de
  cómo hacer la carga de datos**; hasta tenerlo, la decisión de la fuente queda abierta. Consumidor concreto
  hoy: los visores por tipo del bloque D necesitan archivos **alojados** para verse con datos reales — los
  35 recursos del catálogo son enlaces.

---

## Historial de cierre (trazabilidad corta)

Ítems cerrados recientemente que solían aparecer como pendientes (para no re-buscarlos):

| Ítem | Cómo se cerró |
|---|---|
| **El vacío del buscador: las tres salidas en una sola sección, con saltos `#id`** | **Implementado y promovido** (2026-10-01) — **entregado en el PR #45**. El pedido era **ambiguo** y se preguntó primero (regla 9): el autor eligió **lectura A** (los saltos dentro de la tarjeta del aviso) y **V3** (botón secundario), **sin** resalte del destino y **sin** rótulo visible. Medido en el navegador, el enlace anterior compartía `color` (`oklch(0.52 0.085 257)`) y `text-decoration-line` con «Limpiar búsqueda y filtros» —el mismo objeto visual para dos acciones distintas—, y V3 lo separa por color, fondo, borde y alto. La sección ganó nombre accesible (aviso como `<h2>`), los tres bloques `id` y un margen de desplazamiento que sale del token `--header-h` más el alto **medido** de la barra; la fila sólo ofrece saltos de bloques **presentes**. Tests primero (6 en RED), después verde. **Cinco compuertas aprobadas** (`review-4b0bfe7ead4517a1`, `review-5c51328ff49347d3`, `review-98fbf65d694a6a49`, `review-fda3530895a9b51f`, `review-7135c0450f94bdce`), y la del rango completo encontró **un CRITICAL que las acotadas no podían ver** (el enlace copiado no aterrizaba: la carga perezosa y el margen medido llegan después de que el navegador resuelve el fragmento), corregido y validado por el proveedor; la medición viva del enlace profundo destapó además que el fragmento **se borraba de la barra de direcciones**, también corregido. Sus avisos, en «Deuda de revisión (RDD)». La hoja `/dev/search-empty` se borró al promover. Gates: `test` **708/708** · `check` 0 errores / 4 warnings · Biome exit 0 · aterrizaje y URL medidos en vivo (+13,625 px, fragmento conservado). |
| **Sección «Data API» para recursos con tabla (bloque D, slice D3)** | **Implementado y aprobado** (2026-09-23). La sección «Acceso por API» estaba gateada a `resource_type === "api"`, un campo **heredado que nada escribe** —el propio formulario de CKAN lo tiene comentado y es `None` en los 35 recursos del catálogo—, así que **no se renderizaba nunca**: era UI muerta. Ahora el gate es `datastore_active === true` (el mismo marcador que usa la vista previa) y el endpoint que muestra es **`datastore_search`**, el que devuelve filas, en vez de `resource_show`, que no. El ejemplo de curl y las dos piezas de copy acompañan. **Reconciliación de la spec en el mismo paso, con dos defectos:** «Preview Placeholder» exigía un área reservada prometiendo una vista previa que ya existe, y «API Metadata» describía un gate que no coincidía ni con el código ni con la realidad. Revisión nativa `review-03b5057b001e6f9b` **aprobada** (tier medium, lente reliability, 3 archivos / 150 líneas, presupuesto 75), 2 avisos informativos. Gates: `check` 0 errores · `test` **601/601**. |
| **Endurecer la vista previa de datos (bloque D, slice D2)** | **Implementado y aprobado** (2026-09-23). Los 4 hallazgos de `review-ca9abb1187a39513`. El sustantivo —`R3-stale-search-race`— se arregló con la guarda de corrida superada (el `cleanup` del efecto marca su corrida y los dos handlers comprueban antes de escribir; sin `AbortController` porque el cliente no acepta `signal`), y **el test que lo cubre fue verificado en contra: se neutralizó la guarda y el test FALLÓ** (aparecía la fila vieja), con el archivo restaurado byte-idéntico por sha256. Los otros tres: una celda con objeto ya no pinta `[object Object]` (va a JSON, con funciones y símbolos cayendo al guion y los primitivos intactos), el prop `limit` —declarado, con default y **sin uso**— **se eliminó** (lo que limita las filas es el fetch, y un prop que no hace nada declara un contrato falso), y el estado de carga tiene test con promesa diferida. Revisión nativa `review-891f798293c18235` **aprobada** (tier medium, lente reliability, 4 archivos / 129 líneas, presupuesto 65), 2 avisos informativos. Gates: `check` 0 errores · `test` **593/593** · Biome limpio. |
| **La vista previa del recurso, por tipo (bloque D, slice D1)** | **Implementado y aprobado** (2026-09-23). El panel dejó de decidir con un `format === "csv"` propio —regla nuestra, no de CKAN, y falso negativo: el DataPusher carga `csv, xls, xlsx, tsv, ods` por defecto y `datastore_search` sirve cualquier tabla que exista— y ahora usa la marca de CKAN **`datastore_active`** para la tabla y el **tipo del archivo** para el embed (PDF, imagen, TXT/JSON). Se eliminaron los tabs simulados `Tabla`/`Gráfico`/`Mapa`: `Gráfico` y `Mapa` no son clases de vista previa (el modelo de vistas del PRD los pone en el módulo de análisis, RF-24/25/26), así que el portal dejó de contradecir su propio modelo. El cliente del DataStore ahora manda el token de la sesión, y todo embed pasa por `safeExternalUrl`. Hoja de revisión permanente nueva: **`/dev/preview`**. Revisión nativa `review-4fb694e5160560c1` **aprobada** (tier medium, lente reliability, 12 archivos / 1 182 líneas, presupuesto 200), authority quemada, **2 avisos informativos** registrados en «Deuda de revisión». Gates: `check` 0 errores · `test` **588/588** · Biome en su baseline (4 warnings + 7 infos, ninguno nuevo). |
| **La causa del fallo de la vista previa en el catálogo sembrado** | **Cerrado e identificado** (2026-09-23, sonda D0). **No era el DataPusher**: se subieron tres archivos reales (CSV, PDF, PNG) a un dataset descartable y el pusher cargó el CSV al DataStore al instante (`datastore_active: true` en el primer sondeo y `datastore_search` con las filas). Lo que fallaba eran los **enlaces sembrados**, que nunca tuvieron tabla. Corolario corregido: `hash` es `null` **también** en un archivo alojado, así que «no tiene `hash`» no discrimina enlace de archivo; el único discriminador es `url_type === "upload"`. Catálogo dev restaurado a 17 datasets / 7 orgs. |
| **Wizard: validación completa (Zod v4)** | **Implementado** (2026-09-12). El schema ahora cubre `url` (opcional, http/https con la **misma** política de enlaces del fix de seguridad), `maintainer_email` (opcional, validado con el **mismo regex de CKAN**, con sus tres lookaheads) y `maintainer`, y `tag_string` valida el formato real de CKAN (largo 2..100 y charset) normalizando al mismo tiempo: recorta, descarta vacíos y quita duplicados. Trampa encontrada al medir: el `\\w` de JavaScript es ASCII y habría rechazado «gestión», «año» o «educación», etiquetas que CKAN sí acepta; se usa `\\p{L}\\p{N}_`. El payload se construye **desde el resultado validado**, no desde el estado crudo, así que lo que se ve es lo que CKAN guarda. Validación en vivo (al perder foco, y se limpia al corregir) y resumen de errores con foco al primer campo inválido. **Defecto real corregido en el camino**: la UI leía `fieldErrors.slug` mientras el schema emitía `name`, así que el error del slug **nunca se mostraba** y el botón parecía no responder (test en RED antes del fix). Verificado en Chromium con eventos reales de entrada (focus/blur/input por CDP) y capturando el payload real con `fetch` interceptado, sin mutar CKAN. |
| **Pulido de UI del dashboard (`/dashboard`)** | **Implementado y aprobado** (2026-09-12). Iterado en el playground `/dev/dashboard` (regla 8 de `AGENTS.md`) durante 6 rondas de revisión del usuario, y promovido luego de la aprobación; el playground se borró. Resultado: encabezado sin CTA compitiendo, **grilla de acciones** (hoy sólo «Publicar dataset», preparada para crecer) + **barra de acciones pegajosa** que aparece al scrollear (aire de 8 px bajo el encabezado, `inert` mientras está oculta), listas con contenedor propio y metadatos por fila (recursos + actualización + privacidad; sigla + datasets + rol en organizaciones) y descripción por sección. Verificado en Chromium: posición de la barra, que los clics atraviesan la franja transparente y que el enlace oculto no se puede enfocar. Auditoría responsive a 375/390/768/1024/1280/1440/1920 px sin desborde horizontal. Incluye `MAX_SIGLA_LENGTH` exportado por `OrganizationLogo` y la sigla declarada respetada verbatim. |
| **Saneamiento del `href` de recursos (borde de salida)** | **Implementado** (2026-09-12). Política única de enlaces externos en `src/lib/utils/external-url.ts` (`safeExternalUrl` / `unsafeUrlReason`, allowlist `http:`/`https:` fail-closed) aplicada en los dos bordes de salida de la página de recurso (`resource.url` y el extra `docs_url`) y reusada por el wizard en la entrada. Primer test de componente de la página de recurso (`resource-page.test.ts`; el RED reprodujo el `href="javascript:..."` real) gracias a un stub de `$app/stores` en `vitest.config.ts`. Gates: check 0 errores, 169 tests, lint 0 errores, build 0. |
| **Recursos por enlace (RF-11/RF-13) + archivado del cambio `dataset-publishing`** | **Implementado, verificado y archivado** (2026-09-12). La verificación destapó que el PRD exige que un recurso sea archivo **o** enlace y el proposal lo había sub-escopeado. El wizard ahora adjunta enlaces externos (`resource_create` en JSON, sin bytes) y restringe el esquema a `http:`/`https:` para cerrar el vector de XSS almacenado vía `javascript:`. Commit `f0d30f3`. Verificación nativa `pass` (13/13 requisitos, 35/35 escenarios, 37/37 tareas) y cambio archivado (`1b7c33d`), con la spec promovida a `openspec/specs/dataset-publishing/spec.md`. |
| **Dashboard real del usuario (S-D)** | **Implementado** (2026-09-12, commit `1dfa399`). `/dashboard` dejó de ser el placeholder "próximamente": ahora lista "Mis datasets" (`current_package_list_with_resources`) y "Mis organizaciones" (`organization_list_for_user`), con estados independientes de carga/vacío/error y CTA "Publicar dataset" al wizard. Revisión RDD `approved` (lineage `review-076d16ba6c6ee758`, tier medium, lente reliability), authority quemada; 2 hallazgos advisory informativos anotados. Gates: check 0 errores, 159 tests, lint 0 errores. |
| **Wizard de publicación de datasets (PR3)** | **Implementado** (2026-09-12, commit `157d6d2`). Ruta `/dashboard/datasets/new`: guard de auth client-side, organizaciones escribibles vía `organization_list_for_user(permission="create_dataset")` con estados de error/vacío, formulario con sugerencia de slug, selector de archivos con validación previa de tamaño, `package_create` + subidas secuenciales con progreso y cancelación, fallo parcial con reintento y navegación al dataset creado. Absorbidos los 3 hallazgos advisory de PR2 (`R3-no-timeout`, `R3-nonjson-200`, `R3-slug-boundary`). Revisión RDD `approved` (lineage `review-c9dee8d0f9b7ef4a`, tier medium, lente reliability), authority quemada; 3 hallazgos advisory informativos anotados. Gates: check 0 errores, 156 tests, lint 0 errores. |
| **Vista previa del recurso (CSV)** | **Implementada** (2026-09-11). Fuente decidida: **DataStore de CKAN** (`datastore_search`), no fetch del archivo. Nuevos `src/lib/api/datastore.ts` y `src/lib/components/resource/{DataPreviewTable,ResourcePreview}.svelte` (+ tests); el placeholder "Próximamente" de `resource/[resourceId]/+page.svelte` se reemplazó por el componente. Revisión RDD **approved** (tier medium, lente reliability), authority quemada; 4 hallazgos informativos anotados como ítem v0 de seguimiento. Gates: check 0 errores, 145 tests, lint 0 errores. |
| **Copy de UI: voseo → español neutro formal** | **Normalizado** (2026-09-11). La convención estaba en voseo rioplatense (AGENTS.md regla 6 + design-system §10) y el producto tenía 18 strings en voseo en 10 archivos. Se actualizaron las dos convenciones a "trato de usted, sin voseo ni regionalismos" y se reescribieron todos los strings de UI: home (5), search (4), organizations (1), login (2), dashboard (2), detalle de dataset (1), detalle de recurso (3), y el error de rate-limit del login en `src/lib/server/auth-server.ts` (+ su test). Se corrigió además una referencia obsoleta en el inventario del design-system ("Empezá a explorar" → "Empiece a explorar") y un posesivo informal ("tus investigaciones" → "sus investigaciones"). Verificado: `grep` de marcadores de voseo sobre `src/` → 0 coincidencias. Nota: quedan instrucciones internas para desarrolladores en voseo (AGENTS.md regla 3, design-system §12); no son copy de plataforma y quedaron fuera de alcance. |
| **Techos de subida de archivos (RF-12, 50 MB)** | **Resuelto y verificado end-to-end** (2026-09-11). Estado real medido: (1) `frontend-proxy/nginx.conf` y `frontend-proxy/dev-nginx.conf` no tenían `client_max_body_size` → default 1 MB → **413** medido con 2 MB y con 50 MB por el proxy, y 200 con 2 MB directo a CKAN. Se agregó `client_max_body_size 55M` **acotado a `location /api/`** en ambos. (2) CKAN **ya permitía 100 MB** (`CKAN_MAX_UPLOAD_SIZE_MB=100` en `ckan-docker/.env.example:50`) — la afirmación previa de que estaba en el default de 10 MB era **incorrecta**. (3) `BODY_SIZE_LIMIT` de adapter-node (default 512 KB) se midió sobre el build de producción: existe y se dispara, pero **no está en el camino de v0**, así que se dejó sin subir a propósito. Verificación final: archivo de 50 MB (52 428 800 bytes) subido por el proxy, HTTP 200 en ~450-750 ms, `size` reportado por CKAN correcto y **sha256 del archivo descargado igual al local**; 2 MB a `/` sigue devolviendo 413 (alcance acotado correcto). |
| **Estrategia de CRUD: UI propia vs. UI nativo** | **Decidida** (2026-09-11) — CKAN headless; el portal es dueño de toda la UI, incluida la administración. El UI de CKAN se acepta sólo como muleta operativa en `v0`. PRD §3 y §7 reconciliados con el esquema real de CKAN. |
| **Definición de tiers de versión (v0/v1/v1+/v2+)** | **Escrita** — `PRD.md` §3 (tabla de tiers con criterio de salida por tier) y etiquetado por tier de cada ítem de este backlog. |
| PRs de authentication #5–#10 "OPEN" | En realidad **todos mergeados** a `main` (el archive-report los listó OPEN al momento de archivar; entraron después). Código verificado en `main` 2026-09-06. |
| Live CKAN round-trip (follow-up 3 de auth) | **Cerrado** — login real verificado contra CKAN dev (200 + JWT, 401 con credenciales inválidas) el 2026-09-01; destapó y arregló el bug CSRF (PR #15). |
| Ruta `/about` | Existe (`src/routes/about/+page.svelte`). |
| `bun.lock` stale | Eliminado; se usa pnpm. |
| Placeholder "Recursos indexados" | Eliminado. |
| Tests sin runner | Vitest + testing-library configurados; 13 archivos de test. |
| PRD desactualizado (decía React/backend-custom) | **Corregido** — PRD §10 ya refleja SvelteKit + CKAN (7 menciones de CKAN); verificado 2026-09-06. |
| README raíz genérico "sv" | **Corregido** — README.md ya documenta stack real, setup, estructura y mock data. |
| `getCkanClient()` muerto | **Eliminado** — `src/lib/ckan.ts` borrado (sin callers). |
| CI/CD inexistente | **Agregado** — `.github/workflows/ci.yml` (lint + typecheck + vitest). |
| El CI nunca pasó (faltaba el entorno declarado) | **Corregido** (2026-09-28) — `7585c0d` en `main` agrega el paso que copia `.env.example` antes del `typecheck`; el run `36489318035` quedó **verde**, con la suite corriendo **por primera vez** en CI (302 tests, 30 archivos). Lo encontró la línea de CKAN midiendo los runs. El ítem abierto se elimina: resuelto. |
| `ThemePlayground` leftover | **Conservado** — tool dev-only gated por `import.meta.env.DEV`; decisión de mantenerlo. |
| 9 apuntes de comparación de cards | **Obsoleto** — memoria engram #232 perdida y `/dev/cards` eliminado; absorbido por DatasetCardV2 (PR #39). |
| Política de fallback a mock en producción | **Corregido** — mock solo con `import.meta.env.DEV`; en prod error explícito en las 6 páginas. Además: stats del home (orgs/formats) ahora reales y "Recursos" ya no se inventa en prod. |
| Spec de organizations | **Escrita** — `openspec/specs/organizations/spec.md` desde el código implementado. |
| Divergencia doc↔código en el home | **Corregido** — design-system README §9 actualizado al home real (CTA + stats + organizaciones). |
| `CKAN_INTERNAL_URL` en compose prod | **Corregido** — `docker-compose.unified.yml` inyecta `CKAN_INTERNAL_URL: http://ckan:5000` en el servicio frontend. |
| Housekeeping: ramas remotas mergeadas | **Borradas** — 14 ramas eliminadas de `origin` (11 mergeadas por ancestría + 3 superseded). Quedan solo `main` y `HEAD`. |
| Token accumulation en login repetido | **RESUELTO DE VERDAD (2026-09-13, `e4b7ed9`)**. La afirmación anterior («resuelto en código») era **falsa**: el código llamaba a las acciones correctas pero con parámetros inválidos, así que no revocaba nada y fallaba en silencio (es best-effort). Eran **tres defectos encadenados**: (1) `api_token_list` sin `X-CSRFToken` → 400; (2) `api_token_list` sin el obligatorio `user_id` → 409; (3) `api_token_revoke` con `token` en vez de `jti` → CKAN intenta **decodificar un JWT**, el id no lo es, el `jti` queda en `null` y **no revoca nada devolviendo `success: true`**. Medido: con `token` el token sigue en el listado, con `jti` desaparece. Verificado después: logins repetidos dejan **exactamente 1** token del portal. **Ampliado (2026-09-14):** la familia del no-op silencioso tiene **dos** casos más, ambos medidos: (a) `api_token_revoke {jti: <cualquier cosa que no matchee ningún token>}` responde **`success: true` y HTTP 200 sin revocar nada** — **`success: true` no es evidencia de revocación**, hay que verificar listando; (b) `api_token_create {user: <otro usuario>}` (sysadmin emitiendo para terceros) **no devuelve `result.id`**, así que el `jti` sólo se obtiene con `api_token_list {user_id}`. Y un tercero, de otra familia: `member_create {id: <padre>, object: <hija>, object_type: "group", capacity: "parent"}` responde **`200` y no registra la jerarquía** que la cascada de permisos lee — la fila correcta es la **invertida** (`id: <hija>, object: <padre>`); `organization_show` tampoco reporta el padre. |
| `ckan.auth.create_user_via_api=false` | **Aplicado** — agregado a `ckan-docker/.env` y `.env.example` (aplicado por el usuario + verificado). Nota: esto bloquea la creación de usuarios por API (ver ítem `v1+` de usuarios). |
| Plugin `expire_api_token` | **Aplicado** — agregado a `CKAN__PLUGINS` + `expire_api_token.default_lifetime=86400` (1 día) en `.env`/`.env.example` (aplicado por el usuario + verificado). **Consecuencia medida (2026-09-13):** el plugin hace **obligatorios** `expires_in` y `unit` en `api_token_create`; el login del portal no los mandaba, así que CKAN respondía **409** y **ningún login funcionaba**. Arreglado en `e4b7ed9` con `TOKEN_TTL = { expires_in: 1, unit: 86400 }`, que espeja esa política. |
| Versionar `ckan-docker/` | **Resuelto** — trackeado dentro de `odp-docker` (decisión "inline"); `.env` queda ignorado, se versionan `.env.example`, Dockerfiles y `ckanext-umss`. |

## Deuda de revisión (RDD)

- [ ] **Recibos de la unidad de los saltos `#id` del vacío y de sus correcciones (2026-10-01/02) — SIETE compuertas aprobadas,
  las siete con authority quemada.** La unidad: el vacío pasó a ser **una sección con nombre accesible** (el aviso promovido a
  `<h2>` y `aria-labelledby`) y los tres bloques quedaron con `id` y un margen de desplazamiento que sale del token
  `--header-h` **más el alto medido** de la barra pegajosa; dentro de la tarjeta del aviso va la fila de saltos, con **un
  enlace por bloque renderizado** (nunca a un bloque ausente) y sin rótulo visible, con `aria-label` para lectores de pantalla.
  - `review-4b0bfe7ead4517a1` — **`approved`**, tier medium, lente `review-reliability`, **2 archivos / 233 líneas**,
    presupuesto 117, **0 bloqueantes, 2 avisos**, los dos sobre **mis tests** y los dos correctos: `R3-001` el helper de
    montaje esperaba **un solo** encabezado cuando los tres bloques vienen de **dos fuentes independientes** (podía
    observarse el vacío a medio renderizar); `R3-002` el test del margen sólo miraba `calc(var(--header-h)` y, como el stub
    de `ResizeObserver` nunca medía, **habría pasado con el valor hardcodeado**. Corregidos en `57eeb74`.
  - `review-5c51328ff49347d3` — **`approved`**, tier medium, 1 archivo / 80 líneas, **0 bloqueantes, 1 aviso**: el stub
    acumulaba destinos entre tests y su `disconnect()` era un no-op. Corregido en `6cf996e`, y **corrigiendo el aviso**: el
    arreglo limpia los destinos pero **no** el callback, porque Svelte usa un **singleton de módulo**
    (`ResizeObserverSingleton`) que fija el callback una sola vez — limpiarlo rompería toda medición posterior.
  - `review-98fbf65d694a6a49` — **`approved`**, tier medium, 1 archivo / 14 líneas, **0 bloqueantes, 1 aviso registrado y
    NO perseguido** (decisión propia, declarada): `disconnect()` del stub vacía la lista **compartida** de destinos mientras
    `unobserve()` quita uno solo, así que sin propiedad por observador el `disconnect()` de uno tira los elementos de otro
    vivo. **El aviso acierta en el modelo y no en la consecuencia que afirma:** con cero destinos el binding no se actualiza y
    la aserción `waitFor` del margen **falla ruidosamente**, no pasa en silencio. No se toca ahora porque el stub sirve a un
    solo componente por test; se arregla con propiedad por observador el día que ese archivo renderice dos instancias.
    **Es un ítem, no una deuda olvidada.**
  - `review-fda3530895a9b51f` — **`approved` DESPUÉS DE UNA CORRECCIÓN**, y es el recibo que más cambió el resultado. Se corrió
    a pedido del autor sobre **el rango completo de la rama** (5 archivos / 482 líneas, presupuesto 200), y encontró un
    **CRITICAL que las tres compuertas acotadas no vieron**: los destinos existen recién cuando terminan las llamadas
    perezosas y su `scroll-margin-top` sale de un alto que es **0 hasta que la barra se mide**; en una carga con fragmento
    (un enlace copiado, `…/search?q=x#organizaciones`) el navegador resuelve el `#id` **antes** de que el bloque exista y
    **nada re-aplicaba el fragmento**, así que el enlace profundo no aterrizaba — justamente la propiedad («copiable y
    enlazable») que el propio expediente declara como razón de ser de las anclas reales y que este registro citaba como
    prueba. Ruta completa: plan de corrección de **80 líneas de diff** declarado, corrección en `775e350` (56 líneas reales:
    re-aplicar el fragmento **una vez por valor**, cuando el destino existe y el margen es usable, leyendo el hash de
    `$page.url.hash` — el mismo origen que usa la página y el único que el arnés de tests cubre), con test en **RED** que
    fallaba porque `scrollIntoView` no se llamaba nunca; y **validación dirigida del proveedor aprobada con 0 hallazgos**.
  - `review-7135c0450f94bdce` — **`approved`**, tier medium, 2 archivos / 39 líneas, **0 bloqueantes, 1 aviso registrado y NO
    perseguido**. Este recibo cierra el **segundo defecto que destapó la medición viva del enlace profundo**: con el aterrizaje
    ya corregido, el **fragmento desaparecía de la barra de direcciones** a los ~1,4 s porque `syncUrl()` rearmaba la URL y
    llamaba a `replaceState` **sin el hash**. Lo incómodo, y por eso quedó su propio commit (`8edced4`): **la corrección
    aterrizaba sólo porque el valor estaba rancio** — el `replaceState` de SvelteKit no actualiza `page.url`, así que
    `$page.url.hash` seguía diciendo `#organizaciones` mientras la URL real ya lo había perdido, y el efecto pasaba su guarda
    con un dato que no correspondía a la barra de direcciones. **Un control que funciona por accidente de obsolescencia no es
    un control.** Arreglo: `syncUrl()` conserva el fragmento (`$page.url.hash` leído con `untrack`, como ya se hacía con
    `$page.state`), así la barra de direcciones y el modelo de URL de la app coinciden. Test en **RED** con el error exacto
    (`expected '/search?q=matricula' to be '/search?q=matricula#organizaciones'`) y aserción sobre la **URL exacta**: un
    `toContain` lo habría satisfecho un hash viejo, que es justo el accidente que se elimina.
    **Medición viva final** (navegación nueva, sin clic previo): el `href` conserva el fragmento como **un único valor durante
    15,8 s** (`#organizaciones`) y 14,9 s (`#pruebe-con`), el mismo `syncUrl` que antes lo tiraba ahora emite el hash, el
    aterrizaje sigue en **+13,625 px** debajo del cromo, cambiar el orden mantiene el ancla, y sin fragmento no hay scroll ni
    `#` al final. Cero errores de consola.
    **Su aviso (SUGGESTION), registrado y no perseguido:** el test nuevo espera a que `replaceState` se haya llamado y recién
    ahí lee `mock.calls.at(-1)`, así que podría afirmar una URL no final. Su modo de fallo es un **flaky que falla ruidoso**,
    no un verde falso —y es esa la razón por la que no se persigue, a diferencia de los dos avisos de
    `review-4b0bfe7ead4517a1`, donde el test **no podía fallar** por el motivo que decía cubrir—; el arreglo es de una línea:
    esperar la URL exacta con `waitFor`.
  - `review-2fd5289fb166646d` — **`approved`**, tier medium, **5 archivos / 631 líneas**: el rango completo de la rama, corrido
    a pedido del autor para adjuntar al PR. **0 bloqueantes, 2 avisos WARNING, los dos registrados y con recomendación de
    arreglarlos:**
    - `R3-001` (`+page.svelte:81-82`, determinista) — `syncUrl` re-adjunta el hash **incondicionalmente**: un cambio de filtro
      que sale del vacío deja en la URL un ancla **muerta** (`#organizaciones` mientras se ven resultados) y el efecto de
      re-aplicación podría desplazar de más cuando el vacío vuelva. **Arreglo sugerido**: conservar el hash sólo cuando su
      destino está renderizado, o descartar el ancla al salir del vacío. Es la contrapartida de la decisión de conservarlo;
      el autor puede preferir la otra punta del compromiso.
    - `R3-002` (`search-page.test.ts:799-802`, determinista) — el test del enlace profundo monta el vacío **completo** antes de
      medir la barra, así que sólo prueba el orden «el destino ya existe → se mide la barra» y **una implementación sin la
      dependencia de `saltos.length` pasaría igual**. Es la familia del **verde falso**, no del flaky: **recomiendo arreglarlo
      primero**, y es de minutos.
  - `review-88563f3095835790` — **`approved`**, tier medium, **1 archivo / 75 líneas** (`test/deep-link-real-order`, ya sobre
    `main` mergeado). Cierra el aviso `R3-002` de `review-2fd5289fb166646d`: **el test del enlace profundo probaba menos de lo
    que su nombre decía** — montaba el vacío completo antes de medir la barra, así que sólo cubría el orden «el destino ya
    existe → se mide la barra», y una implementación **sin** la dependencia de `saltos.length` habría pasado. El test nuevo
    **retiene las dos llamadas perezosas**, mide la barra sin destino, afirma el estado intermedio (sin destino, sin
    `scrollIntoView`) y recién entonces libera los bloques y afirma el aterrizaje sobre la identidad del elemento.
    **Falsificación medida por el padre, no declarada:** borrando la única línea `void saltos.length;` el test nuevo falla con
    `AssertionError: expected [] to include <div id="organizaciones">` (sha del producto `840b17a4…`), y al restaurar vuelve al
    sha `5dca748f…` de `main`; verde de nuevo **31/31**. Commits `5049040` + docs.
    **Y queda decidido por el autor (2026-10-02), para cuando se toque el otro aviso:** ante el compromiso de `R3-001` —¿el
    ancla se conserva siempre aunque su destino no esté renderizado?— elige **conservarla sólo mientras su destino exista**,
    que es lo que el aviso pide. No se implementa ahora.
    **Su propio aviso (WARNING), registrado y no perseguido** — familia flaky, no verde falso: el test nuevo captura `destino`
    apenas la fila llega a tres enlaces, sin esperar a que exista el elemento `#organizaciones`; si el bloque se pintara un
    tick después, compararía contra `null` y fallaría de más. Arreglo de una línea (afirmar que el destino no es nulo antes
    de usarlo, o esperarlo).
  - **La lección, y es la que hay que llevarse:** este defecto vive en la **composición** (carga perezosa + margen medido +
    fragmento en la carga inicial), no en ninguna unidad, así que **ninguna revisión por unidad podía verlo** — y mi
    verificación viva tampoco: medí el **clic** con la página ya pintada, nunca la **carga** con `#`. Es decir: probé el
    camino que ya funcionaba. **Un rango no es la suma de sus unidades, y la verificación tiene que incluir el camino del
    usuario, no sólo el camino del código nuevo.**
  - **Hecho del arnés (medido hoy, vale para la próxima):** una corrida del revisor por relay del host puede volver
    `reviewer-empty-output` (`pi-host-relay-transport-failure`, 6,4 s, sin mutación). Lo que corresponde es **`STATUS` fresco
    y reenviar el binding re-ofrecido con un pronóstico y una autorización NUEVOS**: el acuse anterior lo consumió la corrida
    fallida, así que reenviarlo sería reusar autoridad quemada. Con eso la lente corrió y aprobó.
  - **Verificación viva en la página real** (no en la hoja): barra pegajosa **68 px**, `scroll-margin-top` computado **148 px**
    con el encabezado encogido (**164 px** arriba de todo, o sea que sigue al token) y `#organizaciones` y `#pruebe-con`
    aterrizando **13,6 px debajo** del cromo. Con resultados, la sección, la fila y las anclas **no existen**: 0 regresión.
    Cero errores de consola.
  - **Gates:** `pnpm test` **704/704** (49 archivos; baseline 698 → **+6**) · `svelte-check` 0 errores / 4 warnings
    preexistentes · Biome exit 0 (5 infos preexistentes).
  _Origen: el ítem `[v0]` de las tres salidas dentro de la misma sección, pedido por el autor el 2026-10-01 y desambiguado por
  la regla 9 de `AGENTS.md` antes de escribir una línea._

- [ ] **Recibo de la unidad de los chips y el alto del vacío (2026-10-01)** — cerró **`approved`** con la authority quemada.
  `review-a4119e82b86ac72e`: tier **medium**, lente `review-reliability`, **2 archivos / 80 líneas**, presupuesto 40,
  **0 bloqueantes, 2 avisos informativos**. La unidad, después de ver la promoción en vivo: **los chips de «Pruebe con»
  salen del catálogo** (no de las facetas de la búsqueda, que con cero resultados vienen vacías —el bloque era invisible
  justo en el único caso en que existe) y **la tarjeta del vacío duplica su alto** (`min-h-[24rem]`, pedido del autor:
  medido 192 → **384 px** en 1280).
  - **El defecto de los chips no lo cazaron los tests porque la fixture mentía:** devolvía facetas en una respuesta de
    cero resultados, algo que CKAN no hace. Ahora la fixture responde como CKAN y el test tiene **RED medido** (volver los
    chips a la búsqueda lo hace fallar). Es la familia que el proyecto ya tiene anotada: **un doble que no copia la forma
    real no verifica, bendice.**
  - **Los dos avisos eran legítimos y uno era un defecto real del arreglo**, corregidos en `ada8941`:
    `R3-002` — el `catch` del bloque perezoso reponía los datasets pero **no las facetas**, así que si esa llamada fallaba
    los chips quedaban vacíos aunque el respaldo DEV existiera—; `R3-001` — ningún test anclaba los nuevos
    `facet_field`/`facet_limit`, así que la conducta nueva habría sobrevivido a que se los quitara.
  - **Verificación viva** (contenedor, `8082/search?q=test`): la tarjeta mide **384**, los chips muestran valores reales
    del catálogo (`PDF · XLSX · GeoJSON · presupuesto · laboratorios · investigación`) y los tres bloques mantienen su orden.
  - **Gates:** `pnpm test` **698/698** · `svelte-check` 0 errores / 4 warnings preexistentes · Biome exit 0.
  _Origen: la promoción del vacío del 2026-10-01 y el pedido del autor de duplicar el alto._


- [ ] **Recibo de la unidad que llenó el vacío del buscador (2026-10-01)** — cerró **`approved`** con la authority quemada.
  `review-f6b3cb06831d7e11`: tier **medium**, lente `review-reliability`, **2 archivos / 441 líneas**, presupuesto 200,
  **0 bloqueantes, 3 avisos informativos**. La unidad: el vacío ganó **tres salidas en el orden que pidió el autor**
  —«Pruebe con» (chips de las facetas que el buscador ya trae), «Mientras tanto, lo más reciente» y «Explorar por
  organización»—, con las dos llamadas **perezosas** (sólo con el vacío en pantalla) y sin fabricar datos fuera de DEV.
  **Los tres avisos eran legítimos y dos eran defectos reales de lo que yo especifiqué**, corregidos en `cee3d77`:
  - `R3-EMPTY-ASSIST-NO-RETRY`: el latch se activaba antes de la carga y sólo se soltaba al aparecer resultados, así que
    en producción **un fallo transitorio suprimía el contenido para siempre**. Ahora un fallo lo libera (un bloque
    legítimamente vacío no, que eso sería un bucle).
  - `R3-CLIENT-CREATION-UNCAUGHT`: `createCkanClient` estaba **fuera** del `try` y la llamada va con `void`, así que un
    throw ahí dejaba una promesa rechazada sin dueño.
  - `R3-PARTIAL-FAILURE-UNTESTED`: la promesa «cada bloque falla por su cuenta» **no estaba probada**; hay un test que
    hace fallar una y responder la otra.
  **Desviación declarada:** el commit del arreglo (`cee3d77`) **no lleva recibo propio** —decisión mía por el tamaño y
  porque respondía a avisos ya quemados—; el autor puede pedirlo.
  La hoja `/dev/search-empty` que sirvió para elegir **se borró al promover** (regla 8).
  _Origen: el ítem `[v0]` «el área vacía se achica», precisado por el autor el 2026-10-01._


- [ ] **Recibo de la barrida de v0 — el censo verificado y sus reglas de conteo (2026-09-30)** — la barrida cerró **15
  ítems** (borrados, según la convención del proyecto), marcó **2 `PARTIAL`** con su corte exacto y anotó **14 vivos**
  con el bloqueo medido; el `[~]` del `R2-002` quedó intacto. **El método del cruce de tier quedó en la convención de
  `L8`; acá va el censo con su fecha y sus commits**, porque **un censo sin reglas de conteo es una cifra de autor**:
  dos implementaciones independientes no coincidieron hasta declararlas.
  - **Regla 1 — alcance:** sólo ítems cuyo encabezado `##` más cercano por encima es una sección de tier.
  - **Regla 2 — estados:** sólo `[ ]` y `[~]`; **los `[x]` no cuentan.** Fue el único desacuerdo real: un `[x]` dentro
    de `## v1` hacía 42 donde la otra regla daba 41, sin que ninguno midiera mal.
  - **Regla 3 — secciones externas:** para contar «ítems con tag de tier fuera de las secciones de tier» hay que decir
    si los planes cerrados entran: **con `Plan*` son 25, sin `Plan*` son 17.**
  - **El censo de las secciones de tier** (reglas 1 y 2): `9df384a` → **48 coinciden / 4 contradictorios / 7 sin tag
    = 59**; `a716e04` → **52 / 0 / 7 = 59**; `f2fa5c9` (esta rama) → **41 / 0 / 4 = 45**. Los dos movimientos de ítems
    mal ubicados son los que llevaron las contradicciones a cero.
  - **Los ítems fuera de sección** (reglas 1 y 3): en `9df384a` y `a716e04`, **25 abiertos (17 excluyendo `Plan*`) con
    4 `[v0]`** — uno en un plan cerrado (`L1146`, el bug de los badges duplicados, que **esta barrida cerró**) y **tres**
    en deuda de revisión; en `f2fa5c9`, **24 (17) con 3 `[v0]`**, los tres en deuda de revisión.
  - **Medido por las dos sesiones, en desacuerdo y después reconciliadas.** Yo publiqué «25 casos, tres `[v0]`» y
    **estaba mal**: eran **cuatro** en `9df384a`. Lo corrigió la otra sesión y lo confirmó mi propia medición.
  _Origen: la barrida de v0 del 2026-09-30; decisión del autor: el método a `L8`, el censo a este registro._


- [ ] **Recibo de la revisión nativa de la unidad de los rótulos de metadatos (2026-09-29)** — cerró **`approved`** y
  la authority quedó quemada (`gentle-ai.review-acknowledged/v1`). `review-d13fbf017e3991a1`: tier **medium**, lente
  `review-reliability`, **4 archivos / 79 líneas**, presupuesto 40, **0 bloqueantes, 1 aviso informativo**.
  - **Lo que hizo la unidad** (`58c88af` + `beba1a7`): el eyebrow pasó a ser **«Metadatos»** —la cadena que dice
    ser— y el segundo título dejó de repetirlo: **«Información sobre el dataset»** / **«Información sobre el
    recurso»**. Después, las dos líneas descriptivas dejaron de chocar con su propio rótulo: el recurso decía
    «…y otros metadatos» debajo del eyebrow «METADATOS», y el dataset abría con «Detalles», que es el nombre del
    sidebar. Ahora nombran lo que la tarjeta contiene: **«Visibilidad, estado y sus identificadores.»** (dataset)
    y **«Formato, tamaño, tipo MIME y sus identificadores.»** (recurso).
  - **La aserción que pasaba por vacío, cerrada con RED medido.** `dataset-page.test.ts` afirmaba
    `queryByText("Metadatos") === null`, y eso **sólo pasaba porque** el eyebrow era la cadena larga y no
    satisfacía el match exacto: con el eyebrow corto la aserción se da vuelta. Reescrita como **conteo**
    («Metadatos» aparece exactamente una vez) y **RED medido** mutando el sidebar de vuelta a «Metadatos»:
    *expected 1, received 2*. Es la lección de `R3-001` de la unidad de las dos palabras, aplicada en el momento
    en vez de diferida.
  - **El aviso, y por qué no puedo leerlo desde su línea:** `R3-001` · **WARNING** ·
    `resource/[resourceId]/+page.svelte:727` — la línea del `<h2>` que esta unidad reescribió —, disposición
    **informational**. **El sobre de cierre no expone el cuerpo del mensaje** (sólo `id`/`lens`/`location`/
    `severity`/`disposition`), y el registro del repo tampoco lo guarda: `.git/gentle-ai/review-transactions/
    terminal-consumption/v1/89fb67b5….json` contiene únicamente `schema`/`repository`/`target`/`lineage`. **No lo
    invento.** Y **corrijo lo que yo mismo escribí antes**: no puedo afirmar que «en las unidades anteriores
    llegaba y acá no». La línea CKAN registra el mismo comportamiento y lo da por constante —«El envelope de cierre
    nunca trae su texto: quedaron transcritos, con id/lente/ubicación/severidad, en el expediente y en el store»,
    ítem 6 de su sección del 2026-09-29—. Lo que sí medí: mi linaje **no está en el store `v2`**, donde sí viven
    cinco linajes más viejos, y el único rastro en el repo es el registro de consumo terminal, sin hallazgos.
    **Pregunta abierta RESUELTA, y con matiz.** El texto **sí** se lee del store: vive en
    `.git/gentle-ai/review-transactions/v2/review-<lineage>/review-state.json` (schema
    `gentle-ai.review-state-record/v2`) en `state.admitted_role_results[i].value.result.findings[j].claim`, con su
    `severity`, `evidence_class`, `causal_disposition` y `proof_refs`. **Y lo que lo borra es el ACUSE, no la
    aprobación.** Verificado acá, no heredado: quedan **5** `review-state.json` vivos contra **56** registros de
    consumo terminal, y **el único `approved` que sobrevive** (`review-9e769e5f903471c7`, tier medium) **no tiene
    registro de acuse** —su único rastro es su propio directorio `v2`—, o sea que es una compuerta aprobada cuyo
    acuse nunca se ejecutó: conserva sus claims. El linaje de esta unidad, en cambio, no tiene directorio y sólo
    dejó el registro terminal. **Receta: leer el `review-state.json` entre el cierre y el acuse.** La línea CKAN
    perdió las cuatro claims de su linaje de hoy por acusar primero; midió lo mismo sobre su huérfano
    `review-7e3ab346bc8b3f85` (26 291 bytes, seis claims enteras), en el store de `odp-docker`.
  - **Gates:** `pnpm test` **686/686** (mismo baseline) · `svelte-check` **0 errores / 4 advertencias**
    preexistentes · Biome por binario directo **exit 0**. **Verificación viva:** Chromium headless contra el
    portal corriendo (DOM post-hidratación, no el HTML del SSR, que es sólo el *shell*): cada rótulo y cada línea
    aparecen una sola vez en su página y las cadenas viejas dan **cero**.
  - **El episodio del consentimiento, que hay que leer antes de dar la compuerta por rota:** los primeros **tres**
    `START` con la forma correcta (`mode: ordinary` + `baseRef` explícito + `lineageId`) devolvieron
    `outcome: consent-binding-stale` con diagnóstico `consent-binding-expired` —**un binding nuevo por intento y
    «expirado» en el acto**—, `native_invocation_attempted: false`, `lineage_created: false`. Un **cuarto intento
    idéntico, después de un `inspect` fresco, creó el linaje sin pedir consentimiento** (tier medium, una lente).
    Reproducido sobre dos targets distintos, así que no es un registro previo vencido. **Es intermitente y no se
    explica con las entradas que veo; la receta es volver a `inspect` y reintentar, no declarar la compuerta
    rota.** Dos formas de `input` que la descripción de la herramienta no dice y que se descubren por error:
    hacen falta **`"mode":"ordinary"` y `lineageId`** a la vez. **Un tercer detalle, medido por la línea CKAN el
    mismo día:** con `{"mode":"ordinary"}` **a secas** el controlador **re-proyecta** el candidato a los cambios
    **sin commitear**, así que habría revisado un target distinto **sin avisar**. La forma correcta completa es
    `mode` + `baseRef` de 40 caracteres + `committedOnly` + el `lineageId` que emite `inspect`.
  - **Un detalle del rango:** el `inspect` ofrece **la rama entera** (`base_tree` = punto de bifurcación) y hay que
    pasar el `baseRef` explícito a `b89e675` para acotarlo a la unidad. El `START` que funcionó **sí lo respetó**
    (`base-ref` = árbol de `b89e675`, 4 archivos). Comparar `base_tree`/`candidate_tree` con
    `git rev-parse <ref>^{tree}` es la forma de saber qué se está revisando.
  _Origen: el TODO del cierre del 2026-09-28, ejecutado y cerrado el 2026-09-29._

- [ ] **Recibo de la revisión nativa de la unidad que deja alcanzables los filtros aplicados (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-b9b043d8e234d365`: tier **medium**, lente
  `review-reliability`, **2 archivos / 210 líneas**, presupuesto 105, **0 bloqueantes, 2 avisos informativos**.
  - **Los dos avisos caen en la misma función**, la que agregué para el manejo del foco: `R3-001`
    (**WARNING**, `search/+page.svelte:241-254`) y `R3-002` (SUGGESTION, `:249-251`). **Mi lectura:** son el
    `await tick()` más la consulta manual al DOM (`panelEl.querySelector("[data-applied-filter]")` y, si no
    queda chip, `document.querySelector('input[type="search"]')`) para que el foco no caiga al `<body>` cuando
    el chip enfocado desaparece con su filtro. El mecanismo **cumple el requisito** y es **frágil por
    construcción** —una consulta al documento entero y un atributo usado como selector—; el proveedor lo marca
    y tiene razón. **Refinamiento recomendado:** mover el foco al contenedor del panel y dejar que el navegador
    resuelva el orden, en vez de buscar el chip siguiente a mano. **Anotado, no corregido** (el recibo está
    quemado).
  - **Lo que hizo la unidad:** el panel de filtros **vuelve** cuando el usuario tiene filtros aplicados aunque
    no haya facetas —un solo valor, `showFilterPanel`, gobierna **el panel y las columnas**, así que no queda
    una franja vacía— y muestra **sus** filtros, agrupados con los mismos títulos que las facetas, cada uno como
    un chip-botón que **reusa el mismo `toggleFilter`** de su faceta (sin duplicar la lógica de selección) y con
    nombre accesible propio («Quitar filtro Organización: X»). Era el **último WARNING abierto que pedía
    diseño**: el caso que el autor nombró —cero resultados para una organización **y** JSON, y querer sacar uno
    solo—. **Diferido a propósito y declarado:** en móvil los filtros aplicados quedan **detrás del desplegable
    «Filtros»** (un toque); abrirlo solo cuando no hay resultados es una línea más, si el autor lo quiere.
  - **Gates:** `pnpm test` **686/686** (49 archivos, de 683 a 686: +3 tests) · `svelte-check` **0 errores / 4
    advertencias** preexistentes, ninguna en los dos archivos.
  _Origen: el único WARNING abierto que necesitaba diseño, 2026-09-28._

- [ ] **Recibo de la revisión nativa de la unidad de las dos palabras y el chip del MIME (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-a5bb1994e01f2df6`: tier **medium**, lente
  `review-reliability`, **4 archivos / 45 líneas**, presupuesto 23, **0 bloqueantes, 1 aviso informativo**.
  - **El aviso es sobre la aserción que yo mismo escribí:** `R3-001` · **WARNING** ·
    `resource-page.test.ts:397-408`. **Mi lectura:** es el `it` que prueba que el chip del MIME **no** está en el
    encabezado, y el proveedor tiene razón en marcarlo: **una aserción negativa pasa por vacía** — si el chip
    no estuviera por cualquier otro motivo, el test también pasaría, así que **no distingue «se quitó» de
    «nunca estuvo»**. La forma de cerrarlo es la que este repo usa: **medir su RED** (volver a poner el chip,
    ver el test fallar, restaurar byte a byte) y registrarlo. **El autor lo autorizó el 2026-09-28 y acordamos
    diferirlo a otra sesión.**
  - **Lo que hizo la unidad:** el dataset tenía **dos** cards con la palabra «Metadatos» —la tabla técnica y el
    resumen del sidebar— y ahora cada una tiene su nombre: la tabla dice **«Metadatos · Información técnica»**
    (igual en las dos páginas) y el sidebar dice **«Detalles»**. No se inventó vocabulario: **las dos palabras
    se intercambiaron** de tarjeta, y cada una describe lo que su tarjeta contiene. Y el **chip del tipo MIME
    salió del hero**: era intencional (tiene su comentario), y repetía el formato («PDF» en el chip de tipo,
    «application/pdf» al lado) mientras el dato ya vive en la tabla. Verificado después: el MIME aparece **sólo**
    en la tabla y **cero** veces dentro del `<section>` del encabezado.
  - **Gates:** `pnpm test` **683/683** (49 archivos, de 681 a 683: +2 aserciones de regresión) ·
    `svelte-check` **0 errores / 4 advertencias** preexistentes, ninguna en los cuatro archivos.
  _Origen: las observaciones del autor sobre las dos palabras y el chip del MIME, 2026-09-28._

- [ ] **[v0]** `TODO:` **Higiene de datos de dev: el catálogo tiene un residuo de sonda** — medido el 2026-09-28:
  **el único recurso del catálogo con `mimetype`** es `Probe origen PDF` (`probe-origen.pdf`,
  `application/pdf`, `url_type: upload`), que **no es dato sembrado** sino el resto de una sonda de una sesión
  anterior. Aparece como «dataset 17» en el catálogo de desarrollo. **Es dato, no código**: se limpia con
  `resource_delete`/purga del dataset de sonda, y conviene mirar si quedaron otros residuos del mismo tipo
  (la memoria del proyecto registra una limpieza de sondas anterior, así que esta se escapó).
  **El autor lo autorizó el 2026-09-28 y acordamos hacerlo en otra sesión.**
  _Origen: la verificación del chip del MIME, 2026-09-28._
  **Estado medido (2026-09-30): VIVO, pero ABIERTO Y DIFERIDO POR DECISIÓN DEL AUTOR — no es deuda ni abandono.**
  Verificado en vivo: `package_show` de `probe-origen-pdf` devuelve `private: false`, un recurso(`application/pdf`,
  `url_type: upload`) y `state: active`; el catálogo de dev está en 17. **El autor decidió el 2026-09-28 conservarlo**
  —«no hace falta borrarlo por ahora, es el único PDF que tenemos y puede servirnos hasta que hagamos la inyección de
  datos»—. **No se limpia por iniciativa propia: es el único PDF del catálogo y borrarlo le mueve el piso a la
  verificación de la vista previa del portal.**

- [ ] **Recibo de la revisión nativa de los dos seguimientos del buscador y la franja (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-02d3e702f16cc417`: tier **medium**, lente
  `review-reliability`, **3 archivos / 71 líneas**, presupuesto 36, **0 bloqueantes, 2 avisos informativos**.
  - **Los dos avisos caen en el test de la franja, y los dos son la misma observación:** `R3-001`
    (`dataset-page.test.ts:570-571`) y `R3-002` (`:561-562`). **Mi lectura:** son las aserciones de
    `flex`/`flex-wrap`, la de los hijos separados y la de `break-all`, o sea **contratos de clase** — y el
    proveedor tiene razón en marcarlos: **pasan aunque el layout esté mal**. Es una limitación **inherente**
    —jsdom no aplica Tailwind— que yo mismo pedí y que el test **declara en su propio comentario**.
  - **Y por eso intenté cerrarla donde se puede: el navegador.** Captura del dataset a **390px**: **no
    alcanzó** —la página es muy larga y, escalada, la franja queda ilegible—, así que **no afirmo el
    resultado visual**. Lo que sí está verificado por construcción es **la estructura** que hace la
    diferencia: una fila `flex-wrap` con **cada identificador como hijo propio**, así que la ruptura
    **preferida** es entre ítems y `break-all` queda en los `code` como último recurso. **La verificación
    visual queda del autor** (el dataset en el teléfono).
  - **Lo que hicieron los seguimientos:** **(1)** las **dos ramas sin consulta** del estado vacío del
    buscador, que no tenían aserción ninguna, ahora la tienen — y comparan la **cadena exacta**, así que
    discrimina por construcción; **(2)** la franja de identificadores dejó de partir el **valor** en anchos
    chicos. Los dos avisos del recibo anterior (`R3-EMPTY-MSG-BRANCHES` y `R3-ID-STRIP-WRAP`), cerrados.
  - **Gates:** `pnpm test` **681/681** (49 archivos, de 678 a 681: +3 tests) · `svelte-check` **0 errores / 4
    advertencias** preexistentes, ninguna en los tres archivos · y una comprobación de integridad que vale:
    la página del buscador se usó para una **reversión controlada** y **volvió byte a byte** (`git status`
    no la lista), así que la reversión se deshizo bien y nada de ella viajó al commit.
  _Origen: los dos avisos informativos de `review-6afeb0a8ba45dbf0`, 2026-09-28._

- [ ] **Recibo de la revisión nativa de las dos unidades de la ronda del buscador y la card técnica (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-6afeb0a8ba45dbf0`: tier **medium**, lente
  `review-reliability`, **4 archivos / 282 líneas**, presupuesto 141, **0 bloqueantes, 3 avisos informativos**.
  Las dos unidades van en **una compuerta** (el autor aprobó las dos juntas; los commits van separados para que
  el historial se lea): `5d1c436` (el buscador sin resultados) y `064e44d` (la card técnica del dataset).
  - **`R3-FACET-PANEL-BOUNDARY`** · **WARNING** · `search/+page.svelte:416` — es el `{#if hasFacets}` que decide
    el panel. **Mi lectura de la línea:** cuando el usuario **tiene filtros aplicados** y la búsqueda no
    devuelve nada, el panel **desaparece**, así que su única forma de **destildar** un filtro es el botón
    «Limpiar búsqueda y filtros». El arreglo honesto es mostrar al menos **los filtros aplicados** cuando no
    hay facetas, para poder quitarlos de a uno. **Es una decisión de UX, no la tomo solo.**
  - **`R3-EMPTY-MSG-BRANCHES`** · SUGGESTION · `search-page.test.ts:75` — es el helper `emptyMessage()`, que
    matchea `/^No encontramos datasets/`. **Mi lectura:** cubre sólo las **variantes con consulta**, así que
    las **dos variantes sin consulta** («No hay datasets disponibles…») quedan sin aserción — **el mismo hueco
    que el escritor había declarado por su cuenta** y que la revisión confirmó. Arreglo: dos aserciones.
  - **`R3-ID-STRIP-WRAP`** · SUGGESTION · `dataset-page.test.ts:556` — es la aserción de la franja de
    identificadores. **Mi lectura:** la franja es **una sola línea con separadores `·`** y un `slug` o un UUID
    de 36 caracteres **se parte mal en anchos chicos** (no tiene `break-all` ni envoltura por ítem). Arreglo:
    envolver por ítem en vez de partir el valor.
  - **Lo que hicieron las unidades:** el **buscador sin resultados** dejó de mostrar un marco vacío —un solo
    valor `hasFacets` gobierna **el panel y la plantilla de columnas**— y su frase dejó de invitar a «limpiar
    los filtros» cuando los filtros no están a la vista: ahora la menciona **sólo si el usuario los tiene
    aplicados**. Y la **card técnica del dataset** tomó la composición de la del recurso: eyebrow unificado,
    descripción agregada, y **`Slug`/`ID` fuera de la tabla, en una franja monoespaciada debajo**.
  - **Gates:** `pnpm test` **678/678** (49 archivos, de 669/48: +9 tests y el primer test del buscador) ·
    `svelte-check` **0 errores / 4 advertencias** preexistentes, ninguna en los cuatro archivos · el **RED se
    midió** en las dos unidades, y el escritor **volvió a medirlo** cuando su primera aserción de la franja
    pasaba en falso (los identificadores seguían siendo `<code>` dentro de la tabla).
  _Origen: los dos arreglos que el autor aprobó juntos («hazlo, ambos»), 2026-09-28._

- [ ] **Recibo de la revisión nativa de la unidad que cerró el guard del dataset y unificó la primera miga (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-3f510d12bc05d495`: tier **medium**, lente
  `review-reliability`, **2 archivos / 54 líneas**, presupuesto 27, **CERO hallazgos** — la segunda vez en esta
  serie que una compuerta cierra sin avisos.
  - **Lo que hizo la unidad**, a partir de la observación del autor de que «el breadcrumb del dataset y el del
    recurso difiere un poco»: **(1)** la página del dataset recibió el **mismo guard** que el recurso —el `href`
    se arma con `.name`, así que se exige `.name`, no `.title`—, cerrando el defecto de la clase
    `R3-ORG-NAME-GUARD` que había quedado **sin corregir en la página hermana**; los dos guards quedaron
    **byte a byte idénticos**. **(2)** la primera miga se unificó a **`Datasets`** con `role: "Catálogo"`
    —el par que ya usaban la página del recurso y la hoja del autor—, y **ninguna página usa ya `label:
    "Catálogo"`**.
  - **Tres diferencias que NO se tocaron, registradas** para que nadie las «arregle»: el ícono difiere a
    propósito (`Database` en el dataset, `FileText` en el recurso) porque describe **el nivel actual**;
    `related` —el grupo de hermanos— sólo lo pasa el recurso, porque los hermanos sólo existen ahí; y la
    última miga del dataset **no lleva `href`**, que es correcto porque enlazar la página actual es redundante.
  - **Gates:** `pnpm test` **669/669** (48 archivos, de 667 a 669: +2 tests, el guard y la etiqueta) ·
    `svelte-check` **0 errores / 4 advertencias** preexistentes, ninguna en los dos archivos · Biome **no
    verificable** (exit 254).
  - **Valor de método:** el defecto del guard **sobrevivió en la página hermana** después de que un revisor lo
    señalara y se cerrara «su» archivo. **Cerrar un hallazgo en el archivo que el revisor apuntó no es cerrar el
    hallazgo**: hay que buscar la clase en las páginas equivalentes. Es la misma lección que dejó el aviso
    anterior, ahora del lado del que arregla.
  _Origen: TODO del autor sobre los dos breadcrumbs, 2026-09-28._

- [ ] **Recibo de la revisión nativa de la unidad que promovió A7 y unificó la URL de organización (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-94fc418923877f2d`: tier **medium**, lente
  `review-reliability`, **10 archivos / 119 líneas**, presupuesto 60, **0 bloqueantes**.
  - **Dos avisos, ambos `SUGGESTION`, y los dos apuntan a lo mismo:** `R3-001` en
    `OrganizationCard.svelte:15` y `R3-002` en `dashboard/+page.svelte:655`. Leí las dos líneas: la primera es
    el comentario más el default del componente —«el enlace se arma codificado en su única fuente»— y la
    segunda es el **`href` explícito del dashboard, que ahora es idéntico al default del componente**. O sea:
    el proveedor marcó la **redundancia que el propio commit declaró** —la regla quedó escrita en seis sitios—.
    **Arreglo recomendado, dos líneas borradas:** que las dos cards que pasan exactamente el valor que ya es el
    default (el home y el dashboard) **dejen de pasarlo**, y que el default del componente sea la única fuente
    para las cards. Los otros sitios —las dos migas y el `orgHref`— **arman su propia URL** y no son redundancia.
    **No se corrigió:** el recibo está quemado y los avisos no lo reabren.
  - **Lo que hizo la unidad:** **A7 promovido** al breadcrumb real (el disparador de móvil pierde el chip:
    sin borde, sin fondo, íconos `size-4`, el título entero como zona de toque y el `hover` como única
    retroalimentación); y **la URL de organización con una sola forma** — `encodeURIComponent` en los seis
    sitios donde se arma.
  - **Dos hechos de tipo, medidos:** `CkanOrganization.name` es `string` **no opcional**
    (`src/lib/types/ckan.ts:40`), así que el encoding es defensa en profundidad y no un bug vivo; y el default
    del componente **ya apuntaba** a la página de la organización, o sea que el home **pisaba un default
    correcto** con una búsqueda filtrada — ésa era la causa real, no la falta de un enlace.
  - **Gates:** `pnpm test` **667/667** (48 archivos, de 663 a 667) · `svelte-check` **0 errores / 4
    advertencias** preexistentes, ninguna en los diez archivos · Biome **no verificable** (exit 254) · el
    resultado visual de A7 es juicio del autor: el marco de la hoja es la especificación que se implementó.
  _Origen: promoción de A7 + el aviso del encoding, 2026-09-28._

- [ ] **Recibo de la revisión nativa de la unidad que cerró el guard y llevó las cards del home a la organización (2026-09-28)** — cerró **`approved`** y la authority quedó quemada. `review-b336caf8983ffd9b`: tier **medium**, lente `review-reliability`, **4 archivos / 121 líneas**, presupuesto 61, **0 bloqueantes**.
  - **Un aviso informativo:** `R3-001` · reliability · WARNING · `src/routes/+page.svelte:230`. **Sin texto en el envelope**, así que van las **dos lecturas posibles** y cuál me parece más probable. La línea es `href={`/organization/${org.name}`}` de la card de organización del home, o sea **la línea que este cambio agregó**.
    1. **La más probable, y es una regresión mía:** el cambio **quitó el `encodeURIComponent`** que estaba antes (`/search?org=${encodeURIComponent(org.name)}` → `/organization/${org.name}`). Mi justificación fue que el `name` de CKAN es un slug (`[a-z0-9_-]`) y codificar es un no-op — cierto hoy, pero no está garantizado por el tipo (`string`), y un revisor de confiabilidad mira el diff. **Arreglo recomendado: devolver el `encodeURIComponent`** (no cuesta nada y cubre el caso que mi argumento da por sentado).
    2. **La otra:** `org.name` ausente → `/organization/undefined`, el mismo defecto que el aviso `R3-ORG-NAME-GUARD` encontró en la página del recurso. En el home la fuente es `organization_list`, que CKAN siempre devuelve con `name`, así que es defensivo.
    Queda **anotado, no corregido**: el recibo está quemado y ningún aviso reabre el candidato. Las dos lecturas se cierran con una línea cada una.
  - **Alcance:** `7d98ac1..5d68fc5` con `committedOnly: true` — la unidad del guard (`f9ea83d`) más el commit de formato (`5d68fc5`, las dos hunks que dejó el gancho de pre-commit).
  - **Cierra un aviso anterior, medido:** el `R3-ORG-NAME-GUARD` de `review-33850b074b195bfa` **fue corregido en `f9ea83d`** y el RED se midió contra la aserción nueva: `expected <a …> to be null` sobre un ancla con `href="/organization/undefined"`. Es el primer aviso de esta serie que se cierra **con evidencia de que el defecto existía**.
  - **Migración del home:** las cards de organización pasaron de `/search?org=…` a `/organization/<name>`, por decisión del autor, y **ya no queda ningún `search?org=` en código de producción** — sólo las dos aserciones negativas que lo impiden. Test nuevo `src/routes/home.test.ts` (el home no tenía ninguno), con su RED medido: falló con `/search?org=facultad-de-ciencias`.
  - **Gates:** `pnpm test` **663/663** (48 archivos) · `svelte-check` **0 errores / 4 advertencias** preexistentes · Biome **no verificable** (exit 254) · el DOM renderizado del home **no está cubierto** (la página es client-rendered), así que la cobertura son las aserciones del test nuevo.
  _Origen: el guard que la revisión encontró + las cards del home, 2026-09-28._

- [ ] **Recibo de la revisión nativa de la unidad de los enlaces de organización y el badge (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-33850b074b195bfa`: tier **medium**, lente
  `review-reliability`, **6 archivos / 137 líneas**, presupuesto 69, **0 bloqueantes**.
  - **Un aviso informativo que encontró un hueco REAL en la especificación del padre:** `R3-ORG-NAME-GUARD`,
    WARNING, `resource/[resourceId]/+page.svelte:183`. El guard era `dataset?.organization?.title` y el `href`
    que la unidad agregó usa `.name` → `/organization/undefined`. **Cerrado en la unidad siguiente
    (`f9ea83d`)** con RED medido. Lección registrada: al delegar un enlace derivado hay que nombrar **la
    variable que el guard necesita**, no sólo el destino.
  - **Lo que hizo la unidad:** los tres enlaces de organización (la miga del dataset, su `orgHref` y la miga del
    recurso, que **no tenía `href` ninguno**) pasaron a `/organization/<name>`; y el badge del dashboard pasó de
    `Administrador` a **`Administrador del sistema`**, dejando `Administrador` en las cards de organización,
    que es su rol real. La ambigüedad era real: la misma palabra designaba el sysadmin del sistema y el admin
    de una organización.
  - **Gates:** `pnpm test` **661/661** (47 archivos, de 656 a 661) · `svelte-check` **0 errores / 4
    advertencias** preexistentes · la ruta `/organization/direccion-investigacion` responde **200**.
  - **Nota de proceso:** el primer `START` devolvió `consent-binding-stale` sin crear linaje y se resolvió con
    un `START` nuevo, como estaba medido; y un `capture-binding-rejected` **fue una errata del padre** al
    transcribir el binding (un `/schema` menos), no un problema del proveedor.
  _Origen: los dos TODO del autor sobre enlaces de organización y el badge del dashboard, 2026-09-28._

- [ ] **Recibo de la revisión nativa de la unidad del salto secuencial y el desborde del desplegable (2026-09-28)** — cerró
  **`approved`** y la authority quedó quemada. `review-fc7e00d27e1f61cf`: tier **medium**, lente
  `review-reliability`, **4 archivos / 595 líneas**, presupuesto 200, un revisor por `pi_host_relay`, **0
  bloqueantes**.
  - **Un aviso informativo:** `R3-SINGLE-RELATED` · reliability · WARNING · `Breadcrumb.svelte:84`. **El
    envelope de cierre no trae su texto** —igual que los seis avisos anteriores—, así que lo que sigue es
    **mi lectura de la línea**: es el guard que exige `related && related.items.length > 0` para ofrecer el
    desplegable de hermanos en la miga actual. El aviso apunta, con toda probabilidad, a que **un grupo con
    un solo hermano —el recurso actual— no aporta nada y el disparador se ofrece igual**. Es defensivo y hoy
    inocuo (la página sólo pasa `related` cuando el dataset tiene más de un recurso), pero la condición vive
    **en dos lugares**: el componente y quien lo llama. Queda **anotado, no corregido**: el recibo está
    quemado y ningún aviso reabre el candidato.
  - **Alcance:** `3f9de1e..0be5805` con `committedOnly: true` — sólo la unidad: `Breadcrumb.svelte` y su
    test, la página del recurso y su test. **La hoja de diseño no entra**: el autor la dejó sin revisar **por
    decisión propia** (dos veces registrada), no por olvido, y este recibo no la cubre ni la sustituye.
  - **Gates:** `pnpm test` **656/656** (47 archivos; la unidad llevó la suite de 640 a 656) ·
    `svelte-check` **0 errores / 4 advertencias** preexistentes · Biome **no verificable** (exit 254, es el
    entorno) · **la verificación visual es del autor**, porque jsdom no calcula layout.
  - **Disposición del salto, declarada:** el autor lo **aparcó** —«creo que ahora está mejor, pero no termina
    de convencerme… ese lugar es raro»—, así que la ubicación queda **abierta, no aprobada**. El recibo cubre
    el código y los tests, no el diseño.
  _Origen: unidad del salto secuencial en el hero + el arreglo del desborde del desplegable, 2026-09-28._

- [ ] **Recibo de la revisión nativa del slice E8 (bloque E, el salto entre recursos) (2026-09-25)** — cerró
  **`approved`** y la authority quedó quemada. `review-865b14e1f735a37a`: tier **medium**, lente
  `review-reliability`, **9 archivos, 931 líneas**, presupuesto 200. Un revisor por `pi_host_relay`, 0 bloqueantes.
  - **Un aviso informativo:** `R3-001` · reliability · SUGGESTION · `src/lib/resources/order.ts:55-57`. **El
    envelope de cierre no trajo su texto** —sólo id, lente, ubicación, severidad y disposición, como pasó con
    los tres avisos del upgrade—. **Lectura de las líneas** (esto es mi lectura, no el texto del proveedor): es
    la firma y el cuerpo de `resourcePositionLabel`: con `index >= 0` arma «Recurso N de total» y si no, sólo
    «N recursos». La guarda cubre el «no está en la lista» (`index: -1`) pero **no el tope superior**:
    un índice positivo fuera de rango renderizaría «Recurso 6 de 5» en vez de caer al total. Es defensivo y hoy
    inalcanzable —el único llamador pasa `neighbours.index` y `neighbours.ordered.length` de la misma lista—,
    así que queda **anotado, no corregido**: el recibo ya está quemado y ningún aviso reabre el candidato.
  - **Alcance del candidato, declarado y no ideal.** El rango pedido fue
    `448190a48cb0b70bf206ed911e4063cb5a161e12..HEAD` con `committedOnly: true` —el slice E8 solo: 7 archivos,
    414 inserciones / 39 borrados— **más el commit `b83cd38`** de documentación de la otra línea, que entró por
    estar en la punta. Son documentación pasiva: no aportan riesgo y **no agregaron lentes** (una sola, la del
    cambio ejecutable). Separarlas exigía reescribir la rama; se prefirió el candidato algo más grande y
    declarado.
  - **Cómo se destrabó, que es la parte reutilizable.** El árbol tenía `odd/tasks/tokens-page-patch.md` **sin
    versionar**, y con un no versionado elegible **ningún `START` acotado avanza**. Además, resolver la
    selección **crea un linaje propio sobre el árbol de trabajo**. Se commiteó ese archivo y los otros dos docs
    de la sesión paralela (`b83cd38`, autoría ajena declarada en el mensaje) y el inventario quedó vacío: el
    `START` pasó a la primera.
  - Gates: `pnpm test` **640/640** (47 archivos) · `svelte-check` **0 errores, 4 advertencias** (las
    preexistentes: dos `label` sin control, un `value` capturado y el tipo `node`) · Biome **exit 0** con **4
    warnings + 7 infos**, exactamente el baseline (medido con heap ampliado: la corrida sin `NODE_OPTIONS`
    murió con `Linter process terminated abnormally` y exit 254, sin imprimir conteos).
  _Origen: cierre de la compuerta de E8, 2026-09-25._

- [ ] **Recibo de la revisión nativa del slice E7 (bloque E, el chip de contexto del breadcrumb) (2026-09-24)** — cerró
  **`approved`** y la authority quedó quemada. `review-c918f32f7c87a968`: tier **medium**, lente
  `review-reliability`, **5 archivos, 286 líneas**, presupuesto 143. Un revisor por `pi_host_relay`, 0 bloqueantes.
  - **Los cuatro avisos son informativos**, y el cierre lo dice: ninguno abre corrección ni reabre el candidato.
    **Lectura de las líneas** (no el texto del hallazgo):
    1. `R3-002` · WARNING · `Breadcrumb.svelte:37` — es el `<ol>` del recorrido de escritorio (`hidden lg:flex`):
       el componente mantiene **dos DOMs** para la misma navegación (recorrido y chip), uno oculto por breakpoint.
       Es deliberado —`display:none` deja sólo uno en el árbol de accesibilidad— a costa de duplicar marcado.
    2. `R3-001` · WARNING · `Breadcrumb.svelte:92` — es `{#each ancestors as item (item.label)}`: **la clave usa la
       etiqueta**, y una etiqueta no está garantizada única (un recurso y su dataset con el mismo nombre
       colisionan). Es un olor real y chico; el arreglo sería una clave por índice o por `href`.
    3. `R3-003` · WARNING · `Breadcrumb.svelte:96-108` — el item con `href` y el item sin él renderizan la misma
       fila por dos ramas, y la rama sin enlace queda como **item de menú que no hace nada** (misma apariencia,
       ninguna acción). Olor real: correspondería no ofrecer fila para un ancestro sin destino.
    4. `R3-004` · SUGGESTION · `Breadcrumb.test.ts:89` — la aserción del chip usa un cast (`as HTMLElement`) y una
       negación sobre un glifo (`not.toContain("←")`), que es frágil.

    Los cuatro quedan **anotados, no corregidos**: el recibo ya está quemado y ninguno reabre el candidato.
  - Evidencia del slice: el test encontró un **bug real antes de commitear** —`DropdownMenu.GroupHeading` exige
    un `Group` que lo envuelva, y sin él el desplegable **reventaba al abrirse** (`Context "Menu.Group |
    Menu.RadioGroup" not found`)—. El chip se veía bien y fallaba al hacer clic: es exactamente lo que un test de
    componente que abre el menú atrapa y una captura de pantalla no. El componente pasó de **4 a 8 tests**
    (abriendo el desplegable y verificando que el nivel actual no se liste dos veces) más una aserción de
    integración en la página del recurso.
  - Gates: `pnpm test` **631/631** · `svelte-check` **0 errores** · Biome **exit 0**.
  - **Cambio de escritorio declarado:** al unificar los dos breadcrumbs, la página del dataset pasó de tener su
    nav propio (flecha + «Catálogo») al recorrido del componente: en `lg+` arranca con «Catálogo» sin flecha, y
    las dos páginas ganan los rótulos de nivel. Es consecuencia de la decisión del autor («en un dataset sería
    `[] My Dataset`, en un resource `[] My Resource`»), no un efecto colateral buscado.
  - **Pendiente junto a este slice:** la hoja `/dev/nav` tiene su última edición **sin commitear** (se versionó
    para no romper la proyección del candidato), y la sesión paralela tiene `BACKLOG.md` y su expediente de
    CKAN 2.12 también **sin commitear**. Nada de eso entró en este candidato: el rango se pidió versionado.
  _Origen: cierre del slice E7 del bloque E, 2026-09-24._

- [ ] **Recibo de la revisión nativa de la hoja de navegación y los dos ítems del backlog (2026-09-24)** — cerró
  **`approved`** y la authority quedó quemada. `review-a6ba876369a3dd53`: tier **medium** —la hoja es
  ejecutable, vive bajo `src/routes/dev/`—, lente `review-reliability`, **3 archivos, 372 líneas**, presupuesto
  186. Un revisor por `pi_host_relay`, 0 bloqueantes.
  - **Un aviso informativo, y aplica a la implementación real**: `R3-001` · reliability · SUGGESTION ·
    `src/routes/dev/nav/+page.svelte:200-205`. **Lectura de las líneas**: es el `<a>` **dentro** del
    `DropdownMenu.Item`, así que sólo el texto de la etiqueta es clickeable y el relleno del item es **espacio
    muerto** —con `cursor-pointer` prometiendo lo que no hace—. En un desplegable el usuario hace clic en
    cualquier parte de la fila. **Para la implementación: el item navega** (el enlace ocupa la fila entera, o el
    item lleva el `onSelect`), no un ancla suelta adentro.
  - La hoja queda **versionada** (`fac7cd3`) y es **permanente**: no es un duplicado de página sino una hoja de
    revisión, como `/dev/kind`, `/dev/copy`, `/dev/error` y `/dev/preview`. Se versionó también por una razón
    mecánica medida: una hoja **sin** versionar hace que el proveedor rechace un START acotado con
    `candidate-target-projection-drift`, y el `untrackedScope: exclude` del `inspect` **no sobrevive** a un
    `START` limpio.
  - Los dos ítems que esta hoja instrumenta (el breadcrumb en móvil con sus cuatro opciones y el aire de los
    pegados con sus tres medidas más el `top-40` sin medir) quedaron registrados en el backlog con las
    mediciones, y **esperan decisión del autor**.
  - Gates: `svelte-check` **0 errores** (las 4 advertencias son las preexistentes: dos `label` sin control, un
    `value` capturado y el tipo `node`) · Biome **exit 0** · la hoja responde **200** y las otras cinco rutas
    `dev/` también.
  _Origen: hoja `/dev/nav` y los dos ítems del bloque E, 2026-09-24._

- [ ] **DEUDA DECLARADA — el arreglo de E5 vive en `HEAD` sin recibo propio y su linaje ya no es ruteable (cerrado el 2026-09-25)** — el linaje
  `review-5ab16f231f1adb49` quedó en **`correction_required`** con el hallazgo `R3-001` (CRITICAL,
  `causal_disposition: introduced`) **ya corregido y commiteado** (`e5d2411`), pero el plan de corrección
  **no se pudo enviar** el 2026-09-24: el slot `capture-correction-plan` rechazó **tres** envíos con
  `capture-binding-rejected` («binding desconocido, expirado o de otra ruta de sesión»), cada uno con el binding
  **recién emitido por un `STATUS`** y con el `request-hash` que el propio proveedor publica
  (`sha256:037ced9970dd6fd8…`, sin cambios entre intentos). Los tres rechazos fueron **sin mutación**.
  - **Desenlace medido (2026-09-25): la ruta ya no existe.** `STATUS` sobre ese linaje devuelve
    **`applicability: unrelated`** —el proveedor no ofrece ninguna transición para él, sólo un `start` sobre el
    candidato **actual** del árbol de trabajo—. **Motivo**: su candidato corregido congelado
    (`sha256:73ad4d8d…`) dejó de corresponder a un objetivo vivo, porque el árbol se movió (E6, E7 y E8 más los
    commits de documentación). Un linaje en `correction_required` **vence si el árbol se mueve antes de enviar
    el plan**. Se probó además que **un linaje abierto en el mismo workspace no era el bloqueo**: se abandonó el
    huérfano de la sesión anterior y la ruta siguió ausente. **El reintento en proceso nuevo tampoco alcanzó.**
  - **Las 25 líneas quedan sin recibo, y ésa es la deuda.** Medido: el rango mínimo que las contendría es
    `11cd15c..HEAD` = **13 archivos / 1 570 inserciones** —la rama acumulada, que la doctrina prohíbe como
    candidato—, porque la fachada sólo acota `baseRef..HEAD` y `e5d2411` no está en la punta. **No existe una
    compuerta barata que las cubra.** Los rangos con recibo las excluyen: E6 revisó `37c29a5` (2 archivos,
    24/6), E7 revisó `5a18af0` (5 archivos) y el rango de E8 (`448190a..HEAD`) es **más nuevo** que el arreglo.
  - **Qué NO hacer**: abrir un linaje nuevo para el mismo candidato, ni reconstruir por shell las invocaciones
    nativas del historial. Y **no abandonar este linaje para «limpiar»**: `ABANDON` descarta los hallazgos
    admitidos, o sea que borraría el registro del `R3-001` —el store inerte **es** la evidencia—, y encima el
    proveedor no rinde su `revision` cuando el linaje es `unrelated`, así que tampoco es limpiable.
  - **Lo que sí está**: el arreglo es correcto y el árbol lo tiene. Gates al cerrar: `pnpm test` **640/640**
    (47 archivos) · `svelte-check` **0 errores / 4 advertencias** preexistentes · Biome **exit 0** con el
    baseline (4 warnings + 7 infos).
  - **El hallazgo, que era real**: el `<nav>` del breadcrumb es **flex item** del contenedor flex externo, y sin
    `min-w-0` su `min-width: auto` no lo deja encogerse por debajo del ancho de la etiqueta completa: los
    `truncate` de los hijos **no podían actuar** y el nav **desbordaba en horizontal** en vez de recortar —lo
    contrario de lo que el slice prometía, y con scroll horizontal en móvil (regla 7 de `AGENTS.md`). El arreglo
    es `min-w-0` en los dos `<nav>` (el del componente y el propio de la página del dataset) más una aserción
    que lo ancla.
  - **Lección de método (la importante)**: el playground de E5 puso el `<nav>` dentro de un `div` de **bloque**,
    así que la restricción de `min-width` **nunca se activaba ahí** y los cuatro marcos se veían bien. El
    playground reprodujo **el componente pero no el contenedor en el que vive**, que es exactamente la clase de
    error que la hoja existía para atrapar. **Y la segunda lección, que costó esta deuda: el plan de corrección
    se envía inmediatamente, no después de tres slices.**
  _Origen: slice E5 del bloque E, 2026-09-24; cerrado como deuda el 2026-09-25._

- [ ] **Recibo de la revisión nativa del slice E6 (bloque E, la nota del enlace) (2026-09-24)** — cerró
  **`approved`** y la authority quedó quemada. `review-97eb68d9224321c5`: tier **medium**, lente
  `review-reliability`, **2 archivos, 30 líneas**, presupuesto 15. Un revisor por `pi_host_relay`, 0 bloqueantes.
  - **Un aviso informativo**: `R3-001` · reliability · SUGGESTION · `resource-page.test.ts:433-435`.
    **Lectura de las líneas** (no el texto del hallazgo): son las tres aserciones nuevas, y las tres son
    **negativas sobre cadenas de clase** (`not.toContain("min-h-[220px]")`, `not.toContain("text-center")`,
    `.size-16` ausente). La lectura probable: anclar por ausencia de clases es frágil — el test pasaría igual si
    el bloque se reemplazara por otro elemento igual de alto que no llevara exactamente esas clases. Se anota y
    **no se corrige**: el recibo ya está quemado.
  - Evidencia: el test fue primero y la aserción de la caja **falló antes del arreglo** (1 de 28 en ese
    archivo). El copy del aviso se conservó palabra por palabra porque otros tests lo anclan: lo que estaba mal
    era la caja (220px de alto mínimo, 40px de padding y un círculo de 64px para una oración), no el texto.
  - Gates: `pnpm test` **626/626** · `svelte-check` **0 errores** · Biome **exit 0**.
  _Origen: cierre del slice E6 del bloque E, 2026-09-24._

- [ ] **Recibo de la revisión nativa del slice E3 (bloque E, dos superficies del dashboard) (2026-09-24)** — cerró
  **`approved`** con la authority quemada (evidencia `gentle-ai.review-acknowledged/v1`).
  `review-29ba39931af7f59a`: tier **medium**, lente `review-reliability`, **5 archivos, 226 líneas**, presupuesto
  113. Rango revisado **`032046f..HEAD`**, que incluye además el commit de la sesión paralela del autor
  (`f34dab3`, el plan de CKAN 2.12): se declara por la misma razón que en el recibo anterior, para que nadie le
  atribuya ese plan a esta línea de revisión.
  - **Un aviso informativo**: `R3-001` · reliability · WARNING · `dashboard/datasets/new/+page.svelte:652`.
    **Lectura de la línea** (no el texto del hallazgo): es `const orgIsMissing = $derived(orgDisplayTitle === "")`
    — la condición infiere «falta elegir» de que el **título resuelto** esté vacío, en vez del **estado de la
    selección**. La diferencia importa si alguna organización tiene el `title` en cadena vacía: ahí la ficha diría
    «Falta elegir una organización» con una organización ya elegida. El arreglo propio es derivarlo del estado
    (`!singleOrg && !ownerOrg`), no del título. **Anotado, no corregido**: el recibo ya está quemado y el aviso no
    reabre el candidato.
  - Evidencia del slice: **el test fue primero** y **1 de 28 fallaba** antes del arreglo — «varias organizaciones,
    ninguna elegida» era el único de los cuatro estados sin cobertura, porque el mock tenía una sola y con una el
    campo se auto-selecciona. Gates: `pnpm test` **621/621** · `svelte-check` **0 errores** · Biome **exit 0**. El
    `text-pretty` se verificó como clase **generada** en el CSS compilado (`text-wrap: pretty`), con el límite
    declarado: **jsdom no maqueta nada**, así que si esa oración puntual deja de huérfanar lo confirma el autor en
    la página real.
  _Origen: cierre del slice E3 del bloque E, 2026-09-24._

- [ ] **Recibo de la revisión nativa del ajuste de E2b a 16px (2026-09-24)** — cerró **`approved`** con la
  authority quemada (evidencia `gentle-ai.review-acknowledged/v1`). `review-639ebd76af60c244`: tier **medium**,
  lente `review-reliability`, **3 archivos, 139 líneas**, presupuesto 70. Rango revisado **`1d3a225..HEAD`**, que
  **incluye un commit de documentación que no es de esta sesión** —el `docs(backlog)` de la sesión paralela del
  autor, `9fbde67`—: se declara acá para que nadie le atribuya ese texto a esta línea de revisión.
  - **Un aviso informativo**: `R3-TEST-SHRINK-DELTA` · reliability · SUGGESTION · `src/routes/layout-header.test.ts:89`.
    El id nombra el punto: la aserción nueva comprueba que el valor achicado es **menor** que el del tope, pero
    **no fija el delta** (16px), así que un cambio de magnitud no la rompería. Eso es lo que la aserción quiso ser
    —una invariante, no un pin del número—, así que queda anotado y **no se corrige**: el recibo ya está quemado.
  - El cambio: el valor del estado achicado pasa de `4.5rem` a `4rem` en `--header-h`, y **ninguna otra línea de
    código lo necesitó** — que es exactamente lo que compró E2: ningún offset lleva el número escrito. Gates:
    `pnpm test` **620/620** · `svelte-check` **0 errores** · Biome **exit 0**.
  - **Incidente de escritura concurrente, registrado:** mientras esta sesión corría los gates de ese ajuste,
    **otra sesión del mismo repo** modificó `BACKLOG.md` **sin commitear** (112 líneas: la reescritura del ítem del
    token con mediciones de hoy, la decisión de CKAN 2.12 y dos ítems de configuración). Verificado que **no** se
    coló en los commits de esta sesión (0 ocurrencias de su texto en los míos), el autor autorizó commitearlo tal
    cual, y se commiteó como unidad propia (`9fbde67`) declarando la procedencia en el mensaje. **Dos escritores en
    el mismo worktree y sin aislamiento no es una hipótesis: pasó hoy.**
  _Origen: ajuste del slice E2b del bloque E, 2026-09-24._

- [ ] **Recibo de la revisión nativa del slice E2b (bloque E, el encabezado se achica al scrollear) (2026-09-24)** —
  cerró **`approved`** y la authority quedó quemada (evidencia `gentle-ai.review-acknowledged/v1`).
  - `review-6e034ec319f46e52`: tier **medium**, lente `review-reliability`, **7 archivos, 195 líneas**,
    presupuesto de corrección 98, `risk_reasons: executable_change` (por `src/app.css`). Rango revisado
    **`d2f53eb..HEAD`** con `baseRef` explícito. **Un revisor por `pi_host_relay`, 0 bloqueantes.**
  - **Dos sugerencias informativas**, tal como las emitió el cierre:
    1. `R3-001` · reliability · SUGGESTION · informativo · `src/routes/dashboard/+page.svelte:290-293`
    2. `R3-002` · reliability · SUGGESTION · informativo · `src/routes/+layout.svelte:63-68`
    El cierre lo dice explícitamente: ninguna abre corrección, ninguna reabre la revisión y no se ofrece
    transición de corrección para este candidato.
  - **Lectura de las líneas señaladas** (eso es lectura de las líneas, no el texto del hallazgo; el sobre trae
    id, lente, severidad y ubicación, nunca la prosa): la del dashboard son las líneas donde se construye el
    `ResizeObserver` y se hace `resizeObserver?.observe(header as Element)` — **el cast es mío y es innecesario**,
    se evita estrechando con un `if (header)`; la del layout es el bloque de limpieza del efecto (el
    `disconnect()` y el `removeAttribute`), donde lo único discutible es que la limpieza corre tanto al desmontar
    como al re-ejecutar el efecto — y como la única dependencia reactiva es el centinela, que no cambia después
    del montaje, se ejecuta una sola vez. Ninguna de las dos se corrige: son sugerencias, y tocar el código
    habría invalidado un recibo ya quemado.
  - Evidencia del slice: **3 tests nuevos** (el centinela existe; salir del tope pone el atributo en el documento
    y volver lo quita, conducido por un `IntersectionObserver` falso; el estado vive en el documento y **no** en
    el encabezado, porque los pegados son hermanos suyos), con **RED medido: 4 de 10 fallaban** antes de
    implementar. Uno de ellos encontró un error real mío: la variable de estado estaba declarada y **nunca
    enlazada** al elemento. Y la verificación que jsdom no puede dar: leído el CSS compilado por selector, el
    token se declara en **dos** ámbitos (`:root` y `html[data-header-shrunk]`) y se generan
    `height/top: var(--header-h)`, `top: calc(var(--header-h) + 1px)`, las dos propiedades de transición y los
    200ms.
  - Gates: `pnpm test` **619/619** · `svelte-check` **0 errores** · Biome **exit 0**.
  - **El aviso `R3-1` de E2 queda cerrado acá**, que es donde se volvió obligatorio: el `rootMargin` de un
    `IntersectionObserver` no se puede cambiar después de construirlo, así que con un alto dinámico el observer
    se reconstruye cada vez que el alto cambia.
  - **Tres obstáculos del arnés, los tres medidos y los tres reutilizables:** (1) **deriva de proyección**: con la
    hoja `/dev/header` sin trackear en el árbol, el START fue rechazado con `candidate-target-projection-drift`
    —el inventario de no-versionados cambia y la proyección del candidato no cuadra— aunque el `inspect` previo
    hubiera pasado `untrackedScope: exclude`; se resolvió sacando la hoja del árbol, y se restauró después del
    cierre; (2) **`consent-binding-stale` dos veces seguidas** y resuelto en el **tercer** START con clave nueva,
    igual que lo ya registrado en este archivo; (3) **`capture-binding-rejected`** al reenviar el binding con
    `reviewerRunAcknowledged`, con el `forecast` ya aceptado: el `STATUS` acotado **volvió a ofrecer el mismo
    slot** (mismo `subject-hash` y misma revisión) y el relanzamiento cerró bien. Sin mutación en ninguno de los
    tres fallos previos.
  - **La hoja `/dev/header` se rehizo al revés que la primera versión**: ya no imita el encabezado —el demo en vivo
    es el encabezado **real** de esa misma página, que se achica al scrollear— así que no hay marcado duplicado
    que pueda derivar. El autor la había reportado como ilegible.
  _Origen: cierre del slice E2b del bloque E, 2026-09-24._

- [ ] **Recibo de la revisión nativa del slice E2 (bloque E, alto del encabezado) (2026-09-24)** — cerró
  **`approved`** y la authority quedó quemada (evidencia `gentle-ai.review-acknowledged/v1`).
  - `review-aae5dd97579ec543`: tier **medium**, lente `review-reliability`, **7 archivos, 124 líneas**,
    presupuesto de corrección 62, `risk_reasons: executable_change` (por `src/app.css`). Rango revisado
    **`9afdcea..HEAD`** con `baseRef` explícito. **Un revisor por `pi_host_relay`, 0 bloqueantes.**
  - **Un aviso informativo**, tal como lo emitió el cierre:
    1. `R3-1` · reliability · WARNING · informativo · `src/routes/dashboard/+page.svelte:256`
    El cierre lo dice explícitamente: no abre corrección, no reabre la revisión y no se ofrece transición de
    corrección para este candidato.
  - **Lectura de la línea señalada (eso es lectura de las líneas, no el texto del hallazgo):** la 256 es
    `const stickyTopPx = headerHeightPx() + STICKY_GAP_PX;` — el alto del encabezado se **lee una sola vez**, al
    construir el observer. La lectura probable: se cambió una constante rígida por una **lectura cacheada**, así
    que si el alto cambia *después* de montar (la media query de alto que este mismo bloque evaluó, una fuente
    que carga tarde, un cambio de layout) el `rootMargin` y el umbral quedan viejos igual que antes, sólo que
    sin constante a la vista. El arreglo propio sería un `ResizeObserver` sobre el encabezado que reconstruya el
    observer; **no se hizo**: el recibo ya está quemado y un aviso informativo no reabre el candidato.
  - Evidencia del slice: **5 aserciones anti-deriva** en `src/routes/layout-header.test.ts`, con **RED medido**
    (5 de 7 fallan con la implementación revertida). Y la verificación que jsdom no puede dar: el CSS **compilado
    por Vite** contiene `--header-h: 5rem`, `height: var(--header-h)`, `top: var(--header-h)`,
    `top: calc(var(--header-h) + 1px)` y el `calc(var(--header-h) + 1rem)` dentro del `@media (width >= 64rem)`.
  - Gates: `pnpm test` **616/616** · `svelte-check` **0 errores** · Biome **exit 0** (sus 4 warnings y 5 infos
    son los diagnósticos preexistentes del baseline).
  - **Dos entradas `[v1]` tocadas por este slice**: la del desfase de la barra pegajosa quedó **cerrada en su
    mitad de desincronización** (el resto —el test de comportamiento en navegador real— sigue abierto), y la del
    scroll snapping quedó **actualizada** (`h-20` ya no es un literal: es `--header-h`).
  - **Regresión introducida por este mismo slice, medida y corregida el 2026-09-24** (commit `775f129`,
    `review-8caa93a99e7dc4a6` **aprobada y quemada**, 2 archivos / 48 líneas, presupuesto 24, **0 hallazgos**).
    El token quedó declarado **dentro del bloque `.dark`** (línea 119), porque la inserción se ancló en el último
    token de la paleta oscura, no en el de `:root`. El modo claro es el default (sin esa clase), así que ahí
    `--header-h` **no existía**: `height: var(--header-h)` caía a `auto` —el encabezado medía la mitad— y cada
    `top:` caía a `auto`, con los **cuatro** offsets rotos: la barra del buscador, la barra del panel, el lateral
    del dataset y el del asistente. En oscuro funcionaba, por eso se leía como un bug de tema. **Las dos
    verificaciones de este slice fallaron de la misma manera: comprobaron presencia, no alcance** — el test
    contaba apariciones de la declaración, y el chequeo del CSS compilado grepeaba `--header-h: 5rem;` sin
    preguntar qué selector la contenía. Las dos ahora sí preguntan: el test exige que el token viva en un bloque
    `:root` y **nunca** dentro de `.dark` (**RED medido** contra el archivo roto: esa aserción falló), y el CSS
    compilado se volvió a leer ubicando el bloque contenedor de cada aparición (1 en `:root`, 0 en `.dark`).
    **El recibo de E2 sigue en pie como registro de lo que se aprobó: lo que se aprobó tenía este defecto, y el
    revisor no lo señaló.**
  _Origen: cierre del slice E2 del bloque E, 2026-09-24._

- [ ] **Recibo de la revisión nativa del slice E1 (bloque E, chips de formato) (2026-09-24)** — cerró **`approved`**
  y la authority quedó quemada (evidencia `gentle-ai.review-acknowledged/v1`).
  - `review-35a2937ca35fd6fc`: tier **medium**, lente `review-reliability`, **3 archivos, 130 líneas**,
    presupuesto de corrección 65, `risk_reasons: executable_change` (por `search/DatasetCard.svelte`). Rango
    revisado **`ce8fb17..HEAD`** con `baseRef` explícito. **Un revisor por `pi_host_relay`, 0 bloqueantes.**
  - **Lo que el cierre NO trajo: ningún hallazgo** — y esta sección copia los avisos «tal como los emitió el
    cierre», así que acá no hay nada que copiar. **No se escribe «cero hallazgos»: se escribe que el cierre no
    reportó ninguno.** Medido, para que nadie lo lea como un olvido: el artefacto del revisor **no está en ningún
    store legible** — los registros de `review-transactions/terminal-consumption/v1/` tienen **los mismos cuatro
    campos** en todas las líneas (incluidas D3 y L1, que sí tenían avisos), `review-transactions/v2/` sólo
    conserva cuatro líneas viejas (Sep 10-14) cuyo `state` **tampoco** tiene un campo `findings`, y
    `candidate-views/` quedó vacío al cerrar. **Discriminado el mismo día, minutos después, por el cierre del
    slice E2**: ese sobre de cierre —misma versión 3.7.0, mismo repo— **sí** traía el bloque `advisory_findings`
    con un aviso. El campo existe y viaja cuando hay hallazgos, así que el cierre de E1 no los traía **porque el
    revisor no emitió ninguno: este candidato cerró limpio**. (Lo que sigue sin poder recorrerse es el texto
    completo del hallazgo, que tampoco llegó en E2: el sobre trae id, lente, severidad y ubicación.)
  - Evidencia del slice: **10 tests** en `src/lib/resources/formats.test.ts`, **8 de los cuales fallan** contra el
    comportamiento anterior (RED medido antes del arreglo: `chips: [' ', '   ', 'CSV']` y `more: 1` con un solo
    formato único). Medición en vivo del defecto contra el catálogo de dev:
    `observatorio-de-movilidad-urbana-cochabamba` tiene **5 recursos y 4 formatos únicos**, así que la card
    mostraba un chip duplicado **y `+1 más`** — un formato oculto que no existe.
  - Gates: `pnpm test` **611/611** · `svelte-check` **0 errores** (4 advertencias preexistentes, ninguna del
    diff: dos `label` sin control asociado, un `value` capturado y el tipo `node`) · Biome directo **exit 0**
    sobre los tres archivos tocados.
  _Origen: cierre del slice E1 del bloque E, 2026-09-24._

- [ ] **Advisory de la revisión nativa del slice D3 (bloque D) (2026-09-23)** — cerró **`approved`** con la
  authority quemada (evidencia `gentle-ai.review-acknowledged/v1`, revisión
  `sha256:f0fed33b17ce7fa674719cff96ed9861e57e6e169308f147f72883e110a6aa50` del candidato
  `sha256:08dad6ad4eaa7489f134e80c33bd197d1321a2ec15782c4fc502c9437fcff92b`).
  - `review-03b5057b001e6f9b`: tier **medium**, lente `review-reliability`, **3 archivos, 150 líneas**,
    presupuesto de corrección 75. Rango revisado **`c3a882b..HEAD`** con `baseRef` explícito.
  - Dos avisos no bloqueantes, tal como los emitió el cierre:
    1. `R3-001` · reliability · WARNING · informativo · `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte:299`
    2. `R3-002` · reliability · SUGGESTION · informativo · `.../resource-page.test.ts:467`
    El cierre lo dice explícitamente: ninguno abre corrección, ninguno reabre la revisión y no se ofrece
    transición de corrección para este candidato.
  - **Contexto de las ubicaciones:** la primera cae en la construcción del `curlCommand` —donde el ejemplo
    de la sección ahora arma `datastore_search` con `resource_id`, y donde vive el `??` que decide entre el
    ejemplo declarado en los `extras` y el generado—; la segunda, en el bloque de tests que la propia slice
    agregó para la sección. Eso es **lectura de las líneas**, no el texto del hallazgo.
  - **Observación propia, fuera del alcance de la slice:** el cuadro de metadatos sigue mostrando una fila
    «Tipo de recurso» alimentada por `resource_type` (`+page.svelte:238`). No es un gate —es exhibición de un
    campo declarado— y la fila sólo aparece si el valor existe, así que hoy no pinta nada. Se deja: si el
    portal algún día crea recursos con ese campo, corresponde mostrarlo.
  - Nota de trazabilidad: esta entrada se agregó **después** de la aprobación. El candidato aprobado es el
    árbol de la revisión; lo posterior es este apunte de ids y ubicaciones, no una decisión.
  _Origen: cierre del slice D3 del bloque D (2026-09-23)._

- [ ] **Advisory de la revisión nativa del slice L1 de «localhost» (2026-09-23)** — cerró **`approved`** con la
  authority quemada (evidencia `gentle-ai.review-acknowledged/v1`, revisión
  `sha256:cdae297f4106d8926fcff832cad1fba6acaffebf313ec615a279533f9065c161` del candidato
  `sha256:e1d614ade4da0d357909cf0847c3a267b002cf92d79e12947ed4e7aa4c00be2c`).
  - `review-344a93dbb8243ef2`: tier **high** —el provider lo subió por ser camino de autenticación
    (`hot_path` / `auth`)—, **4 lentes** (`review-risk`, `review-resilience`, `review-readability`,
    `review-reliability`), **10 archivos, 139 líneas**, presupuesto de corrección 70. Rango revisado
    **`23d4f3c..HEAD`** con `baseRef` explícito. **Cuatro revisores corridos, 0 bloqueantes.**
  - Los cuatro avisos, tal como los emitió el cierre:
    1. `R2-logout-comment` · readability · SUGGESTION · informativo · `src/routes/auth/logout/+server.ts:5-8`
    2. `R3-LOGOUT-CONFIG-500` · reliability · WARNING · informativo · `src/routes/auth/logout/+server.ts:29`
    3. `R3-ROUTE-COVERAGE-GAP` · reliability · SUGGESTION · informativo · `src/lib/server/ckan-internal-url.test.ts:8-12`
    4. `R4-LOGOUT-CONTRACT` · resilience · WARNING · informativo · `src/routes/auth/logout/+server.ts:29`
    El cierre lo dice explícitamente: ninguno abre corrección, ninguno reabre la revisión y no se ofrece
    transición de corrección para este candidato.
  - **Lo que estos cuatro avisos tienen de notable, y por qué no se archivan sin más:** **tres de los cuatro
    apuntan al mismo lugar** —`logout/+server.ts:29`, la resolución de la URL interna dentro del handler de
    logout— desde **tres lentes distintas** (reliability, resilience, y el comentario en readability). Dos
    lentes independientes convergiendo en una línea no es ruido. Y coinciden con el riesgo que el escritor
    delegado ya había declarado por su cuenta: al quitar el fallback, **`POST /auth/logout` pasa a responder
    `500` cuando `CKAN_INTERNAL_URL` falta fuera de desarrollo**, mientras el encabezado de la ruta prometía
    «best-effort». La consecuencia práctica es leve —`logout()` del cliente ignora el status y limpia
    `localStorage` igual, así que el usuario sale del portal, pero el token de CKAN **no se revoca** y el
    servidor registra un error—, pero **es un cambio de contrato que introdujimos sin decidirlo**.
  - **Decisión pendiente del autor, con recomendación:** (a) dejar el fallo ruidoso en las dos rutas —simple y
    coherente, pero rompe el contrato declarado de logout por una mala configuración que **el login ya delata
    con la misma fuerza**—; o **(b) recomendada**: mantenerlo ruidoso en **login** (donde es accionable y es la
    puerta de entrada) y volver a **best-effort en logout**, registrando el error en el servidor sin fallar la
    respuesta, porque el usuario ya está cerrando sesión y la revocación es por diseño best-effort. La (b) pide
    su propio slice y su propia revisión: la authority de este recibo ya está quemada.
  - **Corrección medida (2026-09-24) — la premisa de (b) es falsa y la recomendación queda retirada.** Tres
    mediciones sobre el árbol actual: (1) `revokeToken` **ya se traga todos los fallos**, de red y de HTTP, con
    `try/catch` (`src/lib/server/ckan-auth.ts:347-358`) y eso está anclado por **dos tests**
    (`ckan-auth.test.ts:411` y `:417`) — así que lo **único** que puede devolver `500` en logout es el resolvedor
    de `logout/+server.ts:29` cuando falta la variable; (2) esa misma variable faltante rompe
    `login/+server.ts:27` con el mismo resolvedor, o sea que un despliegue así **no loguea a nadie**: la señal
    ruidosa y accionable ya está en la puerta de entrada; (3) el cliente **descarta el status**
    (`src/lib/api/auth.ts:48-58` hace `await fetch(...)` sin mirar `response.ok`, y `UserMenu.svelte:45-46`
    limpia la sesión igual), así que el `500` es **invisible para el usuario**. Conclusión: la (b) convertiría un
    `500` invisible en un `200` invisible —en un despliegue donde el login ya está roto— a cambio de un slice, un
    ciclo de revisión y un camino que se traga un error de configuración. Los tres lentes convergieron en esa
    línea porque no podían ver (1) ni (2). **Lo único que sigue en pie de los cuatro avisos es precisión de
    documentación**: el encabezado de la ruta no dice que la revocación *en sí* es best-effort porque
    `revokeToken` se traga los fallos. **El autor difirió la decisión el 2026-09-24: el ítem sigue abierto y no
    cambia ningún comportamiento por ahora.**
  - Contexto de las ubicaciones: la 1 y la 4 caen en el encabezado y en la resolución dentro del handler de
    logout; la 3, en el nuevo archivo de test (probablemente el límite de cobertura que el escritor ya declaró:
    las rutas no se pueden testear con los alias actuales de Vitest). Eso es **lectura de las líneas**, no el
    texto del hallazgo.
  - Nota de trazabilidad: esta entrada se agregó **después** de la aprobación. El candidato aprobado es el
    árbol de la revisión; lo posterior es este apunte de ids y ubicaciones, no una decisión.
  _Origen: cierre del slice L1 del trabajo «localhost», 2026-09-23._

- [ ] **Advisory de la revisión nativa del slice D2 del bloque D (2026-09-23)** — cerró **`approved`** con la
  authority quemada (evidencia `gentle-ai.review-acknowledged/v1`, revisión
  `sha256:6ea50eb32373453dddcec23138b43f67337bdd5dd28df9cb9c73b2a07718c6cc` del candidato
  `sha256:783426ed187ec0c3512d82c67e6b2415d0fdbd03839ce136cbe779eed2f4f97d`).
  - `review-891f798293c18235`: tier **medium**, lente `review-reliability`, **4 archivos, 129 líneas**,
    presupuesto de corrección 65. Rango revisado **`3517ae1..HEAD`** con `baseRef` explícito.
  - Dos avisos no bloqueantes, tal como los emitió el cierre:
    1. `R3-001` · reliability · WARNING · informativo · `src/lib/components/resource/DataPreviewTable.svelte:22`
    2. `R3-002` · reliability · SUGGESTION · informativo · `src/lib/components/resource/ResourcePreview.svelte:92`
    El cierre lo dice explícitamente: ninguno abre corrección, ninguno reabre la revisión y no se ofrece
    transición de corrección para este candidato.
  - **Contexto de las ubicaciones:** la primera cae en `cellValue`, la función que decide cómo se pinta una
    celda (donde acaba de entrar la rama de JSON para tipos compuestos); la segunda, dentro del `$effect` de
    la vista previa, en la zona donde resuelve la consulta al DataStore. Eso es **lectura de las líneas**,
    no el texto del hallazgo.
  - Nota de trazabilidad: esta entrada se agregó **después** de la aprobación. El candidato aprobado es el
    árbol de la revisión; lo posterior es este apunte de ids y ubicaciones, no una decisión.
  _Origen: cierre del slice D2 del bloque D (2026-09-23)._

- [ ] **Advisory de la revisión nativa del slice D1 del bloque D (2026-09-23)** — cerró **`approved`** con la
  authority quemada (evidencia `gentle-ai.review-acknowledged/v1`, revisión
  `sha256:6ac8045df9096a350f2c78f763d63412398d877a9c0e6a735f89a9368015882b` del candidato
  `sha256:ce6e259644ae284869e63c3c9264755c27df0d95ff5008d3dabfd0bc666c85e0`).
  - `review-4fb694e5160560c1`: tier **medium**, lente `review-reliability`, **12 archivos, 1 182 líneas**,
    presupuesto de corrección 200. Rango revisado **`cdd69dd..HEAD`** con `baseRef` explícito —sólo el código del
    bloque D—, no la rama acumulada que la inspección deriva por defecto (misma decisión que en A, B y C).
  - Dos avisos no bloqueantes, tal como los emitió el cierre:
    1. `R3-001` · reliability · WARNING · informativo · `src/lib/resources/preview.ts:18-23`
    2. `R3-002` · reliability · WARNING · informativo · `src/lib/resources/preview.ts:29`
    El cierre lo dice explícitamente: ninguno abre corrección, ninguno reabre la revisión y **no se ofrece
    transición de corrección** para este candidato. Son trabajo posterior por separado, nunca motivo para
    re-revisar.
  - **Contexto de las ubicaciones, para que la próxima sesión no arranque de cero:** la primera cae en
    `TABULAR_MIMETYPES`, el conjunto de MIME que espeja `ckan.datapusher.formats` (y que además se compara contra
    el `mimetype` del recurso); la segunda, en `TEXT_FORMATS`. Eso es **lectura de las líneas**, no el texto del
    hallazgo.
  - **Nota de presupuesto:** el rango tiene **1 182 líneas** contra el presupuesto de 400 acordado, y **529 de
    ellas son la hoja `/dev/preview` y sus cuatro muestras** (superficie sólo-dev, sin efecto en producción). Es
    la misma desviación que el bloque B (957 líneas, aceptado como un `medium`); lo que mantiene el foco es
    revisar por bloque y no por rama acumulada.
  - Nota de trazabilidad: esta entrada se agregó **después** de la aprobación. El candidato aprobado es el árbol
    de la revisión; lo posterior es este apunte de ids y ubicaciones, no una decisión.
  _Origen: cierre del slice D1 del bloque D (2026-09-23)._

- [x] **El commit de documentación posterior al recibo de D1 — revisado aparte, sin hallazgos.** El cierre del
  bloque D dejó un commit de sólo-documentación (`3e03798`, `BACKLOG.md` + `odd/tasks/block-d-data-preview.md`,
  2 archivos / 109 líneas) que quedó como **candidato sin revisar** frente a la compuerta de RDD. Se revisó
  acotado a ese delta con `baseRef` explícito (`ce8670a..HEAD`), no a la rama acumulada: `review-3d4f52fb03dd4885`
  cerró **`approved`**, tier **`low`**, **sin lentes** y **sin correr ningún modelo** — el propio provider lo
  clasificó `non_executable_only`, que es la categoría que existe para que documentación pura no consuma
  revisores. `correction_budget` 55, **0 hallazgos**. Authority quemada.
  **Advertencia para la próxima sesión: acá termina el registro, por diseño.** La nota que documenta esta
  revisión es a su vez un cambio de sólo-documentación, así que volver a registrarla produciría una cadena
  infinita de recibos-de-recibos. Si la compuerta vuelve a ofrecer `review.start` para un delta de puro `.md`,
  **corré el ciclo igual** (cuesta dos llamadas y **cero** corridas de modelo: el provider lo aprueba solo) y
  **no lo anote acá otra vez**.
  _Origen: compuerta de RDD sobre el commit de cierre de D1, 2026-09-23._

- [ ] **Advisory de la revisión nativa de la política de existencia (2026-09-20)** — cerró **`approved`** con
  la authority quemada (evidencia `gentle-ai.review-acknowledged/v1`, revisión
  `sha256:cd80727f19f480cd99be4134de44c23c168b75267ae222f152d09b32c8a50478` del candidato
  `sha256:2345b5e956b071ff93b35195f9eeac555d217b487726e4c80e8c619d90e44e5a`).
  - `review-249e073ef3489596`: tier **medium**, lente `review-reliability`, **11 archivos, 467 líneas**,
    presupuesto de corrección 200. Rango revisado **`5068d0a..HEAD`** con `baseRef` explícito —sólo el
    cambio de política, commit `a60b9dc`—, no la rama acumulada que la inspección deriva por defecto.
  - Dos avisos no bloqueantes, con **texto no recuperable** (el ledger se borra al cerrar la línea):
    1. `R3-1` · reliability · WARNING · informativo ·
       `src/routes/dataset/[id]/dataset-page.test.ts:147`
    2. `R3-2` · reliability · SUGGESTION · informativo ·
       `openspec/specs/resource-detail-view/spec.md:100`
    Ninguno abre corrección ni reabre la revisión. **Contexto de las ubicaciones, para que la próxima sesión
    no arranque de cero:** la primera cae en el bloque de estados de fallo de la página de dataset (donde
    viven las aserciones de indistinguishibilidad del anónimo); la segunda, en el requisito nuevo
    `Unidentified Viewer Must Not Learn Existence`. Eso es **lectura de las líneas**, no el texto del hallazgo.
  - Nota de trazabilidad: esta entrada se agregó **después** de la aprobación. El candidato aprobado es el
    árbol de la revisión; lo posterior es este apunte de ids y ubicaciones, no una decisión.
  _Origen: revisión de la política de existencia, 2026-09-20._

- [ ] **Advisory de la revisión nativa del slice C de `v0-portal-honesty`** — cerró **`approved`** con la
  authority quemada (evidencia `gentle-ai.review-acknowledged/v1`, revisión
  `sha256:81bdb2362fef8260a068d381078c24340aa19976f0fa13d3c4220c0a836a877f` del candidato
  `sha256:4e0aa7f34d5bd2faec3b4389be314a2298ac866d2199c830f62c9b2b7776f974`).
  - `review-cd2510c28384457d`: tier **medium**, lente `review-reliability`, **13 archivos, 1 663 líneas**,
    presupuesto de corrección 200. **Rango revisado: `b68031b..HEAD` con `baseRef` explícito** — sólo el
    slice C—, no la rama acumulada que la inspección deriva por defecto (misma decisión registrada para el
    slice B).
  - Los **tres avisos** no bloqueantes, tal como los emitió el cierre —id, lente, ubicación, severidad y
    disposición—, y **su texto no es recuperable**: el ledger se borra al cerrar la línea, igual que en las
    revisiones anteriores. Ninguno abre corrección ni reabre la revisión.
    1. `R3-001` · reliability · WARNING · informativo ·
       `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte:105`
    2. `R3-002` · reliability · WARNING · informativo · `src/routes/dataset/[id]/+page.svelte:91`
    3. `R3-003` · reliability · WARNING · informativo · `src/routes/dataset/[id]/dataset-page.test.ts:33-35`
  - **Contexto de las ubicaciones, para que la próxima sesión no arranque de cero:** las dos primeras caen
    en el cableado del token y de la construcción del cliente CKAN (donde el `token` se captura una vez para
    decidir la sonda mientras el `apiKey` del cliente lee el store en vivo); la tercera, en los `vi.mock` de
    módulo del archivo de test. Eso es lectura de las líneas, **no** el texto del hallazgo.
  - Nota de trazabilidad: esta entrada se agregó **después** de la aprobación. El candidato aprobado es el
    árbol de la revisión; lo posterior es este apunte de ids y ubicaciones, no una decisión.
  _Origen: cierre del slice C de `v0-portal-honesty` (2026-09-20)._

- [ ] **Advisory de la revisión nativa del slice B de `v0-portal-honesty`** — cerró **`approved`** con la
  authority quemada (evidencia `gentle-ai.review-acknowledged/v1`, revisión `sha256:b589c2b2…` del
  candidato `sha256:6198424b…`). **Además de los avisos, encontró un hallazgo CRÍTICO propio del slice,
  ya corregido** (`f7214f6`): la sonda de sesión trataba **cualquier** 404 de `user_show` como sesión
  muerta, así que una configuración base o un proxy roto habría expulsado a **todos** los usuarios
  autenticados (bloqueo masivo, un modo de falla que la base no tenía). Ahora un 404 sólo cierra la
  sesión si CKAN sigue contestando (lectura pública `status_show`), y si no, la respuesta es
  `inconclusive`.
  - `review-086ad59599b720f1`: tier **high**, **18 archivos, 1 341 líneas**, cuatro lentes (riesgo,
    resiliencia, legibilidad, confiabilidad), presupuesto de corrección 200. Los **nueve avisos**
    no bloqueantes, con su id, lente, ubicación y severidad, están tabulados en
    `odd/tasks/v0-portal-honesty.md`. Cierra: **`R2-stale-session-comment`** (`src/lib/session.ts:5-8`,
    SUGGESTION) es un comentario **ya obsoleto** —describe un mensaje que `069c011` borró— y está listo
    para corregir; y **`R4-PERM-SILENT`** (`src/routes/dashboard/+page.svelte:174-177`, WARNING) nombra
    una limitación aceptada: si la pregunta de permiso falla, la oferta queda cerrada sin superficie de
    reintento (fail closed).
    > Nota de trazabilidad: esta entrada de deuda se agregó **después** de la aprobación. El candidato
    > aprobado es el árbol de la revisión `sha256:b589c2b2…`; lo posterior es este apunte de ids y
    > ubicaciones, no una decisión.
  _Origen: cierre del slice B de `v0-portal-honesty` (2026-09-20)._

- [ ] **Advisory de las dos revisiones de unidades de trabajo de `v0-portal-honesty`** — ambas
  cerraron **`approved`** con la authority quemada, y el único hallazgo de cada una es un advisory
  informativo. Es trabajo posterior, **nunca motivo para re-correr la revisión sobre ese candidato**:
  - `review-56075851faccfca4` (unidad de trabajo 1 — el listado que respeta los permisos, más la
    documentación de esa unidad): tier **medium**, lente `review-reliability`, **9 archivos,
    1 271 líneas**. `R3-001` (WARNING) en `src/routes/dashboard/+page.svelte:64` — **la línea es la del
    candidato**, el archivo cambió después.
  - `review-aec04a603141bc1e` (unidad de trabajo 2 — la promoción de la paginación): tier **medium**,
    lente `review-reliability`, **3 archivos, 227 líneas**. `R3-001` (WARNING) en
    `src/routes/dashboard/+page.svelte:385`, el bloque de comentario que declara el costo aceptado (el
    estado de página no va en la URL) — **la línea es la del candidato**.
  _Origen: cierre del slice A de `v0-portal-honesty` (2026-09-19)._

- [ ] **El guard de `odp-docker` NO se puede revisar desde una sesión en `odp` — y todavía no hay que revisarlo.**
  El código que **hace cumplir** la regla de publicación vive en
  `/home/danielblc/projects/odp-docker` (otro **clon Git**), y el ciclo de revisión se ata al **workspace de
  la sesión**. Una sesión abierta en `odp` no puede atarse a él: es una limitación estructural, no una
  configuración. Es el hueco más incómodo del cambio, porque cae justo en la parte que más importa.

  **Cuándo revisarlo:** **después** del rediseño, cuando el guard quede final. Bajo el flujo de solicitud
  obligatorio el guard **va a cambiar** (tiene que consultar la solicitud aprobada), así que revisar la
  versión actual gasta un ciclo completo de revisión en código con rework pendiente conocido. Revisar
  antes sería cumplir el trámite sin cubrir el riesgo.

  **Cómo, cuando toque** — es lo único que hay que hacer del lado humano:
  ```sh
  cd /home/danielblc/projects/odp-docker
  pi
  ```
  y pedir la revisión en esa sesión. Nada más: el agente corre el preflight y el resto del ciclo ahí.
  _Origen: pusheo del PR 1 (`odp-docker` `86f130b`) + reconciliación del modelo del PRD (2026-09-14)._

- [ ] **[v1] Advisory de las dos revisiones de la evidencia de sondas del ciclo de vida** — ambas
  cerraron **`approved`**; los 6 hallazgos son informativos, **ninguno abrió corrección**. Trabajo
  posterior, nunca motivo para re-correr la revisión sobre esos candidatos.
  - `review-61dcee84f2290d65` (evidencia P0–P9 en `design.md` + `preproposal.md` + `BACKLOG.md`):
    `R3-1` (`design.md:450`, la fila P7 — la narrativa de los conteos 16→19→21→16), `R3-2`
    (`BACKLOG.md:412`, el ítem `[v1]` de la capacidad `state`).
  - `review-9e769e5f903471c7` (evidencia P10 + las dos especificaciones, 5 archivos, 703 líneas):
    `R3-CREATE-INVALID` (SUGGESTION, `publication-lifecycle/spec.md:48-62`, los dos escenarios de
    creación), `R3-CROSSLAYER` (SUGGESTION, `dataset-publishing/spec.md:31-36`, `Publication is not a
    form field`), `R3-NO-ADMIN-PATH` (WARNING, `publication-lifecycle/spec.md:116-122`, la organización
    sin administrador), `R3-PORTAL-PREDICATE` (WARNING, `publication-lifecycle/spec.md:238`, el
    predicado del portal).
  - `review-c100297f6a4ac61c` (mismo contenido más esta entrada de deuda; 5 archivos, 716 líneas):
    `R3-CATALOGUE-CONSISTENCY` (SUGGESTION, `publication-lifecycle/spec.md:208-213`),
    `R3-DURABLE-LEVEL` (SUGGESTION, `publication-lifecycle/spec.md:19`), `R3-CREATE-ORG-DEFER`
    (WARNING, `publication-lifecycle/spec.md:149-154`), `R3-FALSY-BOUNDARY` (WARNING,
    `publication-lifecycle/spec.md:142-147`).
    > Nota de trazabilidad: la entrada de deuda que usted está leyendo se agregó **después** de que esa
    > revisión cerrara. El candidato aprobado es el árbol de 5 archivos; esta lista es el único delta
    > posterior a la aprobación, y es un apunte de ids y ubicaciones, no una decisión.

- [ ] **[v0] Hallazgos advisory de las revisiones del track dashboard + publicación** —
  informativos, no bloqueantes, sin corrección abierta. Verlos como trabajo posterior, nunca como
  motivo para re-correr la revisión sobre esos candidatos:
  - `review-c9dee8d0f9b7ef4a` (PR3 wizard): `R3-001`, `R3-002`, `R3-003`.
  - `review-076d16ba6c6ee758` (PR4 dashboard): `R3-reactive-auth`, `R3-untested-dataset-failure`.
  - `review-656da6beeca5d9e9` (PR5 enlaces): `R3-link-remove-during-submit` (`+page.svelte:789`),
    `R3-link-validation-coverage` (`+page.svelte:218`).

- [ ] **[v1] Hallazgos advisory de la revisión de la fundación del Plan C** — línea
  `review-521de49bd20a934a` (tier high, 4 lentes, 38 archivos, 1 477 líneas). Cerró **`approved`**;
  los 8 hallazgos son `WARNING` informativos, **ninguno abrió corrección**. Son trabajo posterior:
  nunca motivo para re-correr la revisión sobre ese candidato.
  - `R2-components-json-nova-contradiction` (readability, `components.json:16`) — **corregido**: el
    CLI había dejado `"style": "nova"`, que contradecía la decisión escrita en `AGENTS.md`; se
    volvió a `default`.
  - `R2-dataset-summary-max-not-applied` y `R3-summary-not-truncated` (readability/reliability,
    `dataset-summary.ts:21-22`) — hay un tope declarado que no se aplica al summary del extra.
  - `R2-markdown-editor-unique-html-comment` (readability, `MarkdownEditor.svelte:6`).
  - `R3-legacy-html-notes` (reliability, `dataset-summary.ts:19-23`) y
    `R4-legacy-html-notes` (resilience, `markdown.ts:56-60`) — qué pasa con `notes` que ya traen
    HTML crudo (dato legacy).
  - `R3-resource-archivo-url` (reliability, `resource.ts:48-77`) — caso de recurso que declara
    archivo **y** URL a la vez (RF-13 los quiere excluyentes).
  - `R4-markdown-parse-then-truncate` (resilience, `dataset-summary.ts:24`) — se parsea el markdown
    antes de truncar, en vez de truncar el texto plano.

- [ ] **[v1] Hallazgos advisory de la promoción del wizard** — dos líneas más, ambas cerradas en
  **`approved`** con hallazgos `WARNING`/`SUGGESTION` informativos. Ninguno abrió corrección. Son
  trabajo posterior, nunca motivo para re-correr esas revisiones:
  - `review-cc9f270fe3b13523` (slice 1 — layout + metadatos): `R3-001` (`TagsInput.svelte:104`) y
    `R3-002` (`TagsInput.svelte:41`).
  - `review-544dc8f1f33ea19f` (slice 2 — recursos unificados): `R3-cancel-processing`
    (`+page.svelte:543-548`) — cancelar mientras el recurso está en estado «procesando».

- [ ] **[v1] La revisión nativa se escala por ruta, no por tamaño** — observado el 2026-09-13: la
  fundación del Plan C (1 477 líneas) salió **tier high con 4 lentes** porque tocaba
  `src/lib/components/auth/UserMenu.svelte` (una línea de import), mientras la promoción del wizard
  (2 220 líneas) salió **tier medium con 1 lente**. El tier lo decide el proveedor y no se discute, pero
  conviene tenerlo presente al leer la cobertura: **un cambio grande sin archivos «calientes» recibe
  menos lentes**. Si se quiere más cobertura en un candidato así, hay que partirlo en candidatos que sí
  disparen señales, no pedir más lentes al mismo.

- [ ] **[v1] Hallazgos advisory del arreglo de autenticación** — línea `review-f4c32c431240dd20`
  (tier high, 4 lentes, 66 líneas). Cerró **`approved`**; los cuatro hallazgos son informativos y
  ninguno abrió corrección. Los dos que importan:
  - `R4-ttl-drift` (`ckan-auth.ts:29`) — **el acoplamiento que ya documenta el propio comentario**: el
    `TOKEN_TTL` del portal tiene que seguir a `CKAN___EXPIRE_API_TOKEN__DEFAULT_LIFETIME` del stack, y
    hoy son dos números en dos repos distintos que nada obliga a coincidir. Si la política cambia y el
    portal no, el login vuelve a romperse. Salida posible: leer el valor de una variable de entorno del
    portal, o validarlo al arrancar.
  - `R4-cleanup-latency` (`ckan-auth.ts:227`) — ahora que la limpieza **sí** se ejecuta, cada login
    lista y revoca **secuencialmente** todos los tokens previos del portal. Con muchos tokens viejos
    acumulados, eso alarga el login (y ya no falla en silencio, pero tampoco hay tope).
  - `R2-001` (`ckan-auth.test.ts:135-136`), `R3-001` (`ckan-auth.ts:30`) — sugerencias de estilo.

- [ ] **[v1] Tokens basura en el usuario admin del CKAN dev** — el listado tiene tokens de sesiones
  viejas de pruebas (`seed-probe`, `seed-probe2`, `odp-e2e-probe`, `odp-e2e-smoke`) que nunca se
  limpiaron. **No tocar los tres `datapusher`**: esos los usa el plugin de subida y revocarlos rompe la
  carga de archivos. _Origen: diagnóstico del login, 2026-09-13._

- [ ] **[v1] Sigla de organización (`extras.sigla`)** — CKAN **no** tiene un campo nativo de
  abreviatura, pero sí soporta extras en organizaciones: existe la tabla `group_extra`, la API acepta
  `extras` en `organization_create` / `organization_update` y `organization_show(include_extras)` los
  devuelve (verificado contra el CKAN dev el 2026-09-12). Convención del portal: clave `sigla`
  (`[{"key": "sigla", "value": "FCyT"}]`), respetada **verbatim** al renderizar. **Lectura ya
  implementada**: `organization_list_for_user` no acepta `include_extras`, así que `listForUser`
  completa los extras con una segunda llamada acotada por ids
  (`organization_list(ids=[...], include_extras=true)`) y, si esa llamada falla, devuelve las
  organizaciones sin extras (la sigla es cosmética). El mosaico recorta a `MAX_SIGLA_LENGTH` (6,
  exportado por `OrganizationLogo`) y baja el tamaño de fuente según el largo; sin sigla cae al
  monograma derivado del nombre. Falta: (a) escribir la sigla en los seeds y en la futura gestión de
  organizaciones; (b) **validar el mismo `MAX_SIGLA_LENGTH` en el formulario de alta/edición** cuando
  exista — el límite debe salir de una sola constante para que entrada y salida no deriven, y validar
  en la entrada **no** exime al render de defenderse (el dato también entra por la API de CKAN).
  _Origen: revisión de UI del dashboard (2026-09-12)._

- [ ] **[v1] Barra de acciones pegajosa: revisar si conviene una versión móvil completa** — hoy
  debajo de `lg` la barra muestra **solo** la acción principal; de `lg` hacia arriba, todas. A 768 px
  las cuatro acciones no entran (medido: 168 px de desborde interno) y el scroll horizontal dentro de
  la barra no da ninguna señal de que hay más acciones. Si se necesita todo en móvil, la salida es un
  menú compacto («más acciones») en lugar de scroll lateral. _Origen: auditoría responsive
  (2026-09-12)._ **(Hoy sólo existe una acción real: el problema reaparece cuando aterricen las
  demás.)_**

- [ ] **[v1] La barra pegajosa no tiene test de comportamiento** — su comportamiento (aparición a 88 px,
  `inert` mientras está oculta, clics que atraviesan la franja transparente) se verificó **a mano en
  Chromium por CDP**, no en la suite: jsdom no implementa `inert` ni `IntersectionObserver`. Opción: un
  test de navegador real (playwright/puppeteer, hoy no instalados). **Su otra mitad quedó cerrada el
  2026-09-24 (slice E2):** «si el layout del encabezado cambia de alto, `STICKY_TOP_PX` queda
  desincronizado y nada lo detecta» **ya no aplica** — el alto vive en un token (`--header-h`,
  `src/app.css`), todos los offsets lo consumen, el observer mide el elemento real y hay aserciones
  anti-deriva en `src/routes/layout-header.test.ts` que fallan si alguien vuelve a un literal. Queda el
  aviso `R3-1` de E2: esa medición es **una sola vez**, al montar. _Origen: revisión RDD
  `review-1c90076e8986652c`, hallazgo advisory `R3-001` (el texto no se pudo recuperar: el ledger se
  borra al cerrar la línea), 2026-09-12; mitad del desfase cerrada el 2026-09-24._

- [ ] **[v1] Re-evaluar el contenido del dashboard antes de v1** — hoy muestra acciones, "Mis
  datasets" y "Mis organizaciones". Antes de v1 hay que volver a evaluar qué más corresponde (y qué
  no es alcanzable con CKAN: las "solicitudes de publicación" del PRD son el caso conocido).
  _Origen: pedido explícito del usuario (2026-09-12)._

- [ ] **[v0] `describeCreateError` sobre-dispara** — el regex `/already in use|url/i` del wizard
  etiqueta como conflicto de slug cualquier error cuyo mensaje contenga "url". Acotarlo al mensaje
  real de CKAN. _Origen: verificación de `dataset-publishing`._
  **Estado medido (2026-09-30): VIVO, byte por byte.** `new/+page.svelte:499` sigue con `/already in use|url/i.test(message)`.
  Libre para implementar: acotar el regex al mensaje real de CKAN.

- [ ] **[v1] Verificación estática pendiente del wizard** — "sin scroll horizontal a 360 px" quedó
  verificado solo por inspección de código, sin test automatizado.

- [ ] **[v1] Revisión nativa `escalated` sin cerrar** — la línea de revisión de la sesión
  2026-09-10/11 cerró en estado `escalated` (hallazgos severos inconclusos), no `approved`. El
  trabajo se commiteó igual porque el usuario lo pidió explícitamente. Los hallazgos severos
  quedaron sin resolver y **no están listados acá**: la acción del maintainer quedó como
  informativa. Si el maintainer quiere cerrarlos, hay que reinstanciar la revisión sobre el
  rango de commits correspondiente. _Origen: sesión 2026-09-10 (RDD)._
