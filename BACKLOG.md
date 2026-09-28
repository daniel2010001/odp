# BACKLOG — Pendientes y para-futuro de ODP

> Fuente **única y canónica** de pendientes del portal (Plataforma de Datos Abiertos UMSS).
> Cualquier cosa que quede "para después" en una sesión se anota acá antes de cerrar; no se
> deja solo en memoria de sesión. Al cerrar un ítem, **borralo del backlog** (git conserva el
> historial); al arrancar un cambio SDD, movelo a `openspec/changes/`.
>
> Convención de estado: `[ ]` abierto · `[~]` a medias · `[x]` hecho (se elimina al commitear).
>
> **Convención de tier:** `[v0]` core presentable · `[v1]` producto usable en producción ·
> `[v1+]` diferido de v1 o conveniente sin ser requerimiento · `[v2+]` mejora futura no
> solicitada. Definición completa de los tiers y su criterio de salida: `PRD.md` §3.
>
> **Arquitectura vigente:** CKAN como backend **headless** (sólo su API REST). El portal
> SvelteKit es dueño de toda la interfaz, incluida la administración. El UI web nativo de CKAN
> se acepta únicamente como muleta operativa durante `v0`. Ver `PRD.md` §3, §7 y §10.

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

1. **La decisión de dominios y del contenido mixto** — el problema original sigue abierto: el portal
   se sirve por `https://odp.hs.lan` y CKAN firma sus URLs absolutas con `http://192.168.1.201:5000`,
   así que el visor de PDF sigue bloqueado por el navegador. Opciones (A: un solo origen con una
   regla nginx para la ruta de descarga; B: `data.` + `api.` con allowlist) más el acoplamiento a
   documentar. **El upgrade no cambió nada de esto** (medido: la forma de la `url` es idéntica).
   **Medido el 2026-09-28:** el portal responde en `https://odp.hs.lan` (200) y el proxy ya enruta
   `/api/` a CKAN por HTTPS; lo que falla es que `ckan.site_url = http://192.168.1.201:5000`.
   Y el dato que **decide la arquitectura**: `ResourcePreview.svelte` muestra el PDF en un `<iframe>`
   **a propósito**, con un comentario propio que dice que lo hace así porque la API de CKAN no manda
   CORS ⇒ **el portal ya está diseñado para leer el PDF desde otro origen**, y unificar orígenes
   obligaría a escribir el proxy de descargas que precisamente se evitó. **La decisión del
   2026-09-24 se mantiene**: dos nombres — el portal en `data.umss.edu.bo` y CKAN en
   `api.data.umss.edu.bo`, con `ckan.site_url=https://api.data.umss.edu.bo`. El equivalente en dev es
   `odp.hs.lan` + `api.odp.hs.lan`. **Y el nombre nuevo hay que agregarlo en DNS**: medido, `hs.lan`
   **no tiene comodín** — `odp.hs.lan` resuelve, `api.odp.hs.lan` todavía no; el DNS es AdGuard Home
   (`adguard.hs.lan`, corriendo). _(Medición de la sesión de la línea CKAN, 2026-09-28.)_
2. **El borrador del issue upstream del `ApiTokenView`** — escrito en
   `odd/tasks/tokens-page-patch.md` y **sin publicar**: es una acción externa y necesita el OK del
   autor. El parche local ya está aplicado (`affb4b4`), así que esto sólo cierra el círculo con
   upstream.
3. **Las filas 4, 7 y 9 de S5 quedaron sin medir**: la semántica de `package_update` (toca el
   wizard), la forma de `datastore_search`, y si los validadores de `ckanext-umss` ven sólo los
   recursos cambiados (necesita la suite de la extensión).
4. **Rotar las contraseñas de la base y del sysadmin** que el DebugToolbar publicó. **No es
   emergencia:** el leak está cerrado, así que no hay exposición activa — es higiene. Con el volumen
   limpio ya se regeneraron solos los secretos del ini.
5. **`R2-002` — el tag de CKAN como literal en ocho lugares** (hallazgo `pre-existing` del linaje
   huérfano; va como ítem propio en la lista canónica, porque un `pre-existing` sin dueño se pierde).
6. **Los avisos informativos acumulados**, ninguno bloqueante y ninguno reabre un review cerrado:
   `R2-001`/`R3-001`/`R3-002` (el upgrade, en `docker-compose.yml:48` y `docker-compose.dev.yml:32`),
   `R3-001`/`R3-002`/`R3-003` (el parche de tokens) y `R2-001` (el test del guard,
   `test_target_guard.py:290-291`). El envelope de cierre nunca trae su texto: quedaron transcritos,
   con id/lente/ubicación/severidad, en el expediente y en el store.
7. **El linaje huérfano `review-7e3ab346bc8b3f85` NO se limpia.** Está en `correction_required` sin
   veredicto y sin recuperación, pero **`ABANDON` descarta los hallazgos admitidos** y este linaje
   guarda la única copia de seis (`R1-001`, `R1-002`, `R4-001` CRITICAL, `R2-001`, `R2-002`,
   `R3-VOLUME-PYTHON`). Se deja como **deuda declarada**, con la tabla en el expediente: limpiar el
   store borraría la evidencia, no una transacción muerta.
8. **`feat/ckan-2.12-upgrade` quedó 2 commits atrás de `master`** — los dos últimos arreglos de CI se
   commitearon en `master`, que es la convención del repo. Decidir si se hace fast-forward de la rama
   o se borra: ya está contenida entera en `master`.

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

- [ ] **[v1] Definir si la edición reutiliza la UI de creación** — la mayoría de las plataformas
  reutiliza la UI de creación para editar; la alternativa es una UI propia por operación. **Decidirlo
  antes de congelar la UI de creación**, porque afecta su forma: si se reutiliza, el formulario debe
  nacer como **componente con modo** (`create` | `edit`) en vez de una página con la lógica adentro.
  Depende además de cómo quede la descripción (rich text) y de los pasos del flujo.
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

- [ ] **[v0] Bug: badges de formato duplicados en las cards del buscador** — si un dataset tiene dos
  recursos del mismo tipo (p. ej. 2 CSV), la card muestra **dos chips «CSV»**. Causa exacta en
  `src/lib/components/search/DatasetCard.svelte`: `resourceFormats` hace
  `.map((r) => r.format?.toUpperCase()).filter(Boolean).slice(0, 4)` **sin deduplicar**.
  **Ojo con el efecto colateral**: `moreFormats` se calcula como
  `dataset.resources.length - resourceFormats.length`, así que al deduplicar hay que recontar **sobre
  los formatos únicos**, no sobre los recursos (con 3 recursos `[CSV, CSV, PDF]` los chips deben ser
  CSV y PDF, y `moreFormats` debe dar **0**, no 1). El tope de 4 también aplica a los únicos.
  _Origen: reportado por el usuario, 2026-09-13._
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
- [ ] **[v0] El encabezado del sitio es demasiado alto en 720p.** A 1080 el alto se ve bien; en una
  pantalla de 720 el encabezado se come demasiado espacio vertical antes del contenido. Revisar su alto
  (y el de la barra pegajosa, que se deriva de `HEADER_PX = 80` en el dashboard) contra **viewports
  bajos**, no sólo anchos: las revisiones de responsive anteriores fueron a 375/768/1024/1440 de *ancho*,
  y esto es una cuestión de *alto* — un eje que nunca se revisó.
  _Origen: reportado por el usuario, 2026-09-17._

- [ ] **[v0] Crear dataset: con varias organizaciones y ninguna seleccionada, el resumen muestra la
  organización vacía.** La «Ficha de publicación» pinta `orgDisplayTitle`, que queda vacío mientras no
  haya selección, así que el bloque de organización aparece en blanco en vez de decir que falta elegir.
  _Origen: reportado por el usuario, 2026-09-17._

- [ ] **[v0] Dashboard: la descripción de la sección de organizaciones parte en dos líneas por una sola
  palabra.** La de «Mis datasets» entra en una línea; la de organizaciones deja una segunda línea con una
  palabra suelta, y el usuario lo señala como feo. Dirección: `text-pretty` (o `text-balance`) en lugar de
  reescribir el copy a mano — es exactamente el caso que esa utilidad resuelve, y no hay que inventar
  nada. _Origen: reportado por el usuario, 2026-09-17._

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

- [ ] **[v0] El enlace de descarga del recurso renderiza la URL propia de CKAN, no la del portal.**
  Verificado en vivo (2026-09-20): «Descargar recurso» apunta a
  `http://localhost:5000/dataset/<name>/resource/<file>/download/<file>` — el `ckan.site_url` de CKAN —,
  no al origen del portal. Con la arquitectura vigente (CKAN **headless**, sólo su API REST; ver el
  encabezado de este archivo), exponer el origen del backend y depender de su configuración merece una
  decisión explícita: servir la descarga a través del portal, o aceptar el acoplamiento de forma
  deliberada.
  _Origen: verificación independiente en navegador real contra el stack vivo, 2026-09-20._

- [ ] **[v0] Quitar los tabs simulados «Gráfico»/«Mapa» de la página del recurso** — hoy la página
  muestra un selector Tabla/Gráfico/Mapa donde sólo Tabla es real (CSV). Según el modelo de vistas
  (PRD §3, 2026-09-13), los gráficos pertenecen al Módulo de Análisis, no a la vista previa. La vista
  previa debe ofrecer sólo el render que permite el `format` (tabla para CSV, embed para PDF, imagen,
  texto). _Origen: decisión de arquitectura 2026-09-13._

- [ ] **[v0] TODO: página de error 404 propia del portal.** Hoy una ruta inexistente devuelve **`404`
  correctamente** pero renderiza la **página por defecto de SvelteKit**: el cuerpo dice «**404 Not Found**»
  en **inglés**, sin botón de vuelta al catálogo. El encabezado y el pie del portal sí aparecen, porque el
  `+layout.svelte` la envuelve, y eso hace que el contraste se note más. **No existe ningún `+error.svelte`
  en `src/routes`** (verificado, tampoco en subrutas). Debe ser una página propia, en español formal y con
  el sistema de diseño —tipografía, tokens, iconos Lucide—, con un camino de vuelta claro (catálogo y, si
  corresponde, buscador). Alcanza a dos casos distintos: una **ruta que no existe** y un **error de carga
  inesperado** (5xx), que hoy también cae en la página por defecto. _Origen: reporte del autor + medición
  2026-09-20 (`GET /ruta-que-no-existe`)._

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

  **Cuándo se decide:** no ahora, sino **al empezar el trabajo de permisos** (el ítem de colaboradores
  nativos de CKAN en `v0`): ahí se mide si lo nativo alcanza antes de construir equipos por fuera de CKAN.

- [ ] **TODO: la UI usa «publicar» para lo que en realidad es CREAR — y lo creado es privado, interno a la
  organización.** Este ítem **absorbe** la observación del autor sobre el estado vacío de «Mis datos»: es la
  **misma decisión de copia** repetida en varios lugares, no dos arreglos. El modelo mental del autor es el
  correcto y conviene escribirlo: **si la UI dice «publicar», el usuario entiende que ya es visible en el
  buscador y para cualquiera** — y hoy eso es falso.
  El botón de envío dice «Publicar dataset» y «Publicando...»
  (`src/routes/dashboard/datasets/new/+page.svelte:1715-1717`), y debajo «Podrá editarlo después de
  publicarlo.» (línea 1726). Lo que ocurre en realidad es una **creación privada**: `formValues()` fija
  `private: true` (línea 149) y `buildPackagePayload` escribe ese valor
  (`src/lib/utils/dataset-payload.ts:56`), así que **nada se publica**. Es el mismo defecto de clase que
  `v0-portal-honesty`: la UI afirma un estado que no ocurre. Alcance: la acción principal debe nombrar lo
  que hace (crear, privado), **conservando** las referencias honestas al flujo futuro que hoy están bien
  («la visibilidad del dataset la definirá el flujo de publicación», 922 y 1599). Antes de tocar, separar
  en las otras apariciones (1008, 1365, 1630, 1642) lo que es una **promesa** de lo que es **descripción
  del flujo futuro**. _Origen: reporte del autor, 2026-09-20._
  **Superficies medidas (2026-09-20), todas con el mismo verbo equivocado:**
  - `src/lib/copy/dashboard.ts` (extraído hoy, así que el arreglo tiene una sola fuente):
    `EMPTY_STATE_HEADING` = «**Publique** su primer dataset», `EMPTY_STATE_PRIMARY_ACTION_LABEL` =
    «**Publicar** dataset», y las dos oraciones de requisito: «**Publicar** un dataset requiere pertenecer a
    una organización.» / «**Publicar** un dataset requiere rol de editor o administrador en una
    organización.». Los cuatro usan el verbo equivocado: el requisito es para **crear**, y lo que se crea
    **no** se publica.
  - El botón del wizard: «Publicar dataset» / «Publicando...» (`datasets/new/+page.svelte:1715-1717`) y «Podrá
    editarlo después de publicarlo.» (1726).
  - El `.svelte` del wizard, líneas 1365 y 1630 («Puede publicar el dataset sin recursos»).
  - **Conservar** las referencias honestas al flujo futuro (922, 1599): dicen que la visibilidad la definirá
    el flujo de publicación, y eso es cierto.
  - **Es una sola decisión de verbo** («crear» donde hoy dice «publicar») aplicada de una vez a todas las
    superficies, con sus tests (`src/lib/copy/dashboard.test.ts` fija las cadenas literales y habrá que
    actualizarlo).

- [ ] **TODO: los recursos de tipo enlace no tienen distintivo de tipo, y se les ofrecen las vistas
  simuladas.** Hoy el distintivo de la página de recurso sale de `resource.format` (`formatLabel`, línea
  220) y el `resource_type` sólo aparece como fila de metadatos (línea 246); `ResourceCard.svelte:16`
  deriva `formatBadge` igual. Falta un distintivo que diga **enlace/URL**, análogo a PDF o CSV, y debe
  agregarse **en todos los lugares**, no sólo en esa página. Segundo punto del mismo ítem: **ocultar el
  selector de vistas** (Tabla/Gráfico/Mapa) cuando el recurso es un enlace — un enlace no tiene filas ni
  datos locales que previsualizar.
  **Bloqueo de modelo, medido (2026-09-20):** `src/lib/types/ckan.ts:76` define
  `resource_type?: "file" | "api" | string` — **no existe** un valor `url`/`link` — y en el catálogo real
  los recursos sembrados tienen `resource_type: None` **y** `url_type: None`. Es decir: hoy no hay señal
  fiable para decidir «es un enlace». Hay que decidir **con qué** se detecta (`url_type === "upload"` para
  archivos subidos **no está medido**: no existe ningún archivo subido en el catálogo) y, antes, **qué
  nombre y qué semántica** tiene el tipo (¿`link`? ¿`url`?) y **dónde se escribe** (lo natural: que el
  wizard lo fije al crear). _Origen: reporte del autor, 2026-09-20._

- [ ] **TODO: decidir si un recurso de tipo enlace tiene página propia de recurso.** Pendiente de decisión
  del autor: una página sólo para una URL es raro, aunque su metadata tampoco es mucha. Si la respuesta es
  **no**, hay que decidir dónde vive esa metadata (tarjeta en la página del dataset, fila expandible) y qué
  pasa con los enlaces entrantes y con los recursos ya existentes. _Origen: reporte del autor,
  2026-09-20._

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

- [ ] **[v0] Habilitar colaboradores por dataset** — `ckan.auth.allow_dataset_collaborators` no
  está en `.env.example`. La funcionalidad es nativa desde CKAN 2.9 pero está apagada, así que
  el modelo de permisos por dataset (RF-18) no funciona hoy. _Referencias: PRD RF-18, PRD §7._

- [ ] **[v0]** `TODO:` **El breadcrumb en móvil: qué estrategia.** Observación del autor (2026-09-22): «en
  móviles se ve mal, ocupa mucho espacio». **Estado (2026-09-24):** el slice **E5** implementó **truncar** las
  migas (una línea, con el texto y los enlaces intactos, y tests que lo anclan). **El autor lo revisó y no le
  conforma del todo:** propone mirar el patrón de un **desplegable con el árbol completo** en móvil, «algo como
  `< Test Dataset` o `< Test Resource`». **Opciones concretas y clicables en la hoja `/dev/nav`, sección A:**
  **A1** truncado (lo de hoy) · **A2** sólo el padre con rótulo de rol · **A3** el padre con el árbol adentro en
  un desplegable · **A4** extremos + «…» con el árbol (el «collapsed» de shadcn). **Falta la decisión del
  autor.** El desplegable se hace con el primitivo de **bits-ui** (`DropdownMenu`, ya instalado: el proyecto
  tiene muy pocos componentes vendorizados).
  **Revisión del autor (2026-09-25):** prefiere **el aspecto de A4** —migas de texto y un botón chico de `…`,
  **no** un chip-promedio como A5— pero **sin los dos extremos**: le alcanza con la **página actual** visible.
  Se agregó **A6** a la hoja con exactamente eso. **Decisión final pendiente.**
  **Segunda revisión (2026-09-25, el mismo día):** **A5 tampoco le cierra.** Le sirve su practicidad en
  móvil —**el título completo como zona de toque es más fácil de acertar**— pero no su estilo. De **A6** le
  gusta el estilo y le molesta que **pierda el ícono** y que el botón `…` **se vea chico comparado con los
  anteriores**. Se agregó **A7**: el estilo de A6 —texto, sin chip— **con** ícono y con el título como
  disparador ancho.
  **DECIDIDO Y PROMOVIDO (2026-09-28): A7.** El disparador de móvil del breadcrumb real ya no es un chip —sin
  borde, sin fondo, íconos `size-4`, el título entero como zona de toque—. Unidad `68a99b7`, recibo
  `review-94fc418923877f2d` **aprobado** con dos avisos informativos (ver «Deuda de revisión»). Es el primer
  diseño de esta serie que sale de la hoja y llega al componente real.

- [ ] **[v0]** `TODO:` **Los botones de anterior/siguiente se ven chicos y pasan desapercibidos.** Observación del
  autor (2026-09-24) sobre el slice E8: funcionan, pero no se ven. **Medido:** son dos enlaces con `p-1.5`
  y un ícono `size-4`, y el contador «Recurso 4 de 5» va en `text-[10px]` y **oculto por debajo de `sm`**
  (`hidden sm:inline`) — o sea que en móvil no hay ni contador. El control es correcto (no ofrece acción en
  los extremos) y el problema es **de presencia**: no se lee como navegación. **Es de diseño y espera
  decisión del autor.**

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

- [ ] **[v0]** `TODO:` **La página de la organización, a mejorar.** Observación del autor (2026-09-28):
  «mejorar la page de las org». Es una de las páginas con menos trabajo encima: nació resolviendo `name` o `id`
  y mostrando lo que `organization_show` devuelve, y **nunca tuvo una pasada de diseño propia**.
  **El alcance no está definido: el autor no dijo qué le falta**, y la primera tarea es que la mire y lo
  diga —no adivinarlo—. Contexto: PRD RF-06 a RF-08 y `openspec/specs/organizations/spec.md`.

- [ ] **[v0]** `TODO:` **El buscador sin resultados: el vacío y, sobre todo, el menú de filtros.** Observación
  del autor (2026-09-28): «cuando no hay result se ve todo feo, en especial el menú de filtros». **Sin medir
  todavía:** el estado vacío vive en `src/routes/search/+page.svelte` y los filtros en
  `src/lib/components/search/FacetFilter.svelte`, que hoy muestra «Sin coincidencias para «X»» cuando el filtro
  no encuentra nada y esconde el resto de la lista. Primer paso: reproducirlo en el navegador con una consulta
  sin resultados y anotar **qué se ve mal y a qué ancho**, antes de proponer nada.

- [ ] **[v0]** `TODO:` **El responsive del salto secuencial, antes de darlo por cerrado.** Observación del
  autor (2026-09-28): «con el cambio que hicimos en el salto habría que tocar en el responsive; esto faltaría
  antes de promover el salto». El salto va en la banda de la acción principal como dos controles rotulados
  (`‹ Anterior` · contador · `Siguiente ›`) que **envuelven a una segunda línea** en anchos cortos, y su
  ubicación quedó **aparcada, no aprobada**. **Falta el síntoma concreto: qué se ve mal y a qué anchura**, y
  eso sólo lo tiene el autor. El código está cubierto por el recibo `review-fc7e00d27e1f61cf`; lo que falta es
  el juicio de diseño.

- [ ] **[v0]** `TODO:` **El breadcrumb del dataset y el del recurso difieren.** Observación del autor
  (2026-09-28): «el breadcrumb del dataset y de los resources difiere un poco». **Medido: son dos cosas, y
  sólo una es cosmética.**
  1. **La primera miga dice distinto para el mismo destino**: `"Catálogo"` en la página del dataset y
     `"Datasets"` en la del recurso, **las dos apuntando a `/search`**. Y el `role` es `"Catálogo"` en las
     dos, así que en el recurso la fila muestra el rol «Catálogo» con la etiqueta «Datasets»: **hay que
     elegir una palabra y usarla en las dos.** Es decisión de copy del autor.
  2. **La página del dataset conserva el defecto `R3-ORG-NAME-GUARD` sin corregir**: su `href` de organización
     se arma con `.name` dentro de un guard que pregunta por `.title` (`dataset/[id]/+page.svelte:222`). Es la
     **misma clase** que el aviso de `review-33850b074b195bfa`, que se cerró **sólo en la página del recurso**
     ⇒ falta la línea del guard acá. Es un defecto, no una decisión.
  **Lo que NO es una diferencia a corregir, medido:** el ícono difiere a propósito (`Database` en el dataset,
  `FileText` en el recurso) porque describe **el nivel actual**, que es distinto en cada página; y `related`
  —el grupo de hermanos— sólo lo pasa el recurso, porque los hermanos sólo existen ahí.

- [ ] **[v0]** `TODO:` **En escritorio no hay forma de ver ni saltar a los demás recursos del dataset.**
  Observación del autor (2026-09-24): en móvil lo ve, en escritorio no. **Causa medida:** el grupo «Recursos
  de este dataset» vive en el desplegable del **chip**, que es `lg:hidden`; el recorrido de `lg+` es un `<ol>`
  sin hermanos. El sidebar (variante B4 de la hoja) quedó descartado por el autor, así que la solución tiene
  que vivir en otro lado: un desplegable en la miga del dataset del recorrido, un selector en el encabezado
  (B2, descartado antes por espacio) o la lista lateral sólo de `lg` para arriba. **Es de diseño.**
  **Revisión del autor (2026-09-25), y reabre una descartada:** **B4 le gusta** («muestra todos los recursos
  de una vez, como hace CKAN»), **B3 es su favorito** y no sabe cuál elegir; y objetó que **el breadcrumb y el
  salto compartan la línea**, porque el breadcrumb se come al salto. Se agregaron a la hoja **D4** —el
  desplegable en la miga del **recurso** en vez de la del dataset, el vs que pidió—, **D5** —el salto en su
  **propia fila** y con rótulo `Anterior`/`Siguiente` en vez del nombre recortado, que responde a la vez a su
  objeción del texto— y **D6** —la idea del nombre completo al pasar el mouse—. **Decisión final pendiente.**
  **Resuelto en la segunda ronda (2026-09-25):** el desplegable de hermanos va en la **miga del recurso
  (D4)** —«esto sí creo que está bien»—, y el **salto** entre recursos queda como **D5** (separado del
  breadcrumb y con rótulo), porque ahí «se ve más clara» la diferencia entre el recorrido y el salto. **El paso
  siguiente lo fijó él:** verlo en la **página real del recurso con todos los componentes**, porque bajo el
  breadcrumb puede «solaparse» con el salto — la hoja ya no alcanza para juzgar eso.

- [ ] **[v0]** `TODO:` **El navegador desactiva el anclaje de desplazamiento por culpa del encabezado que se achica.**
  Observación del autor (2026-09-24), **mensaje textual de la consola**: «El anclaje de desplazamiento se
  desactivó en un contenedor de desplazamiento debido a demasiados ajustes consecutivos (10) con muy poca
  distancia total (-1.12666664123535 px promedio, -11.2667 px total)». **Causa medida por lectura del
  mecanismo:** el encabezado se achica cambiando su **alto en el flujo** (`h-[var(--header-h)]` de `5rem` a
  `4rem`), así que al cruzar el umbral **todo el contenido de abajo sube 16px** y el anclaje de desplazamiento
  intenta compensarlo en cada transición; tras diez ajustes seguidos con una distancia total diminuta, el
  navegador **desactiva el anclaje** en ese contenedor. Es la consecuencia directa del slice E2b y no aparecía
  antes. **Opciones:** (1) `overflow-anchor: none` en el contenedor de scroll, para que el navegador no
  compense algo que ya es intencional; (2) achicar **sin tocar el flujo** (el encabezado conserva su alto y el
  recorte es visual, p. ej. con `transform`/`scale`), que es lo correcto si el salto se nota; (3) dejarlo y
  documentarlo, si el efecto es sólo el aviso en consola. **Medir primero si produce un salto visible.**
  Pertenece al **bloque E**.

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

  Y son **dos tratamientos**: tarjeta flotante (panel) contra barra a ras (buscador). **Propuesta:** es el mismo
  problema que el alto del encabezado, así que se arregla igual — **un token** (`--sticky-air` en
  `src/app.css`) del que salen todos los offsets pegados, **más una decisión del autor**: ¿flotante o a ras para
  todas? Pertenece al **bloque E**.

- [ ] **[v0]** `TODO:` **Pulir la vista del enlace: el bloque que reemplazó a las vistas de datos es
  demasiado grande para lo poco que dice.** Observación del autor (2026-09-22): sigue pareciéndole «mucho
  para tan poco», y sospecha del espacio que sustituye a las vistas de los archivos. **Medido y confirmado:**
  el estado que puso C2 es `class="flex min-h-[220px] flex-col items-center justify-center gap-3 p-10
  text-center"` con un círculo de `size-16` (64px) y un ícono de `size-8` (32px)
  (`src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`, alrededor de la línea 553) — o sea **220px
  de alto mínimo, 40px de padding y un ícono de 64px para una sola oración**. Una nota compacta, sin ícono y
  sin caja alta, diría lo mismo sin el hueco. **Contexto para quien lo tome:** un enlace **conserva** su
  ficha (decisión del autor del mismo día), y C3 ya le quitó las filas que no aplicaban (`«Tamaño»` y
  `«Nombre del archivo»`), así que lo que queda es título, descripción, el enlace y las fechas — y eso es
  lo que tiene que justificar la página. Conviene revisarlo junto con el **pulido visual** de `v1+` (las páginas
  de error y la paleta de formato): es la misma familia, densidad visual.

- [ ] **[v0]** `TODO:` **El stack se refiere a sí mismo como `localhost`, así que deja de funcionar para cualquiera que no esté en la máquina del servidor.** Reportado por el autor (2026-09-23): pasa **en el portal nuevo y también en el UI de CKAN**. **Medido el mismo día, y son DOS clases distintas:**
  - **Clase 1 — CKAN hornea su propio origen en cada URL absoluta, y esa URL la consumimos nosotros.** `ckan.site_url = http://localhost:5000` (verificado en `/srv/app/ckan.ini:79` y en la variable `CKAN_SITE_URL` del contenedor dev). Consecuencia medida en la sonda D0: `resource_show` de un archivo alojado devuelve `"url": "http://localhost:5000/dataset/<id>/resource/<rid>/download/<archivo>"` — CKAN **reescribe la `url` al origen de `site_url`**. Medición en vivo del síntoma: `curl http://192.168.1.201:5000/` **devuelve enlaces a `http://localhost:5000/`**, o sea a la máquina de quien mira. **Y esto es load-bearing para lo que se acaba de publicar:** el embed de PDF e imagen de RF-30 (bloque D) apunta a esa `url`, así que en LAN el iframe y el `<img>` no cargan nada — funcionan sólo en la máquina del servidor. Lo mismo alcanza al botón «Descargar recurso» y a cualquier enlace de la UI de CKAN.
  - **Clase 2 — dos valores por defecto escritos en el código del portal.** `src/routes/auth/login/+server.ts:22` y `src/routes/auth/logout/+server.ts:23` hacen `env.CKAN_INTERNAL_URL || "http://localhost:5000"`: en dev funciona porque el compose la setea, pero en un despliegue que olvide la variable el puente de login apunta a localhost **en silencio**. Y `src/lib/env.ts:17` declara `APP_URL` con default `http://localhost:5173` — **y verificado: `env.APP_URL` no lo consume nadie hoy**, así que es un valor validado y sin uso.
  - **Lo que NO es problema, para no confundir el alcance:** `CKAN_URL` está **vacío en dev** a propósito, así que las llamadas del portal a la API van **relativas** (`/api/…`) por el proxy de Vite y son same-origin — por eso el portal responde **HTTP 200** en `http://192.168.1.201:8082/`. Las coincidencias de `localhost` en `.test.ts` y en `AGENTS.md`/`README.md` son legítimas. En `odp-docker`, las de los `docker-compose*.yml` son **healthchecks** (correctos, corren dentro del contenedor).

  - **Un riesgo que había que medir antes de tocar `site_url`, y está resuelto: el callback del DataPusher NO depende de `site_url` en este stack.** `ckanext/datapusher/logic/action.py:67-71` usa `ckan.datapusher.callback_url_base` **y sólo cae a `ckan.site_url` si esa opción falta**. Acá **está seteada**: `CKAN__DATAPUSHER__CALLBACK_URL_BASE=http://ckan-dev:5000` (verificado en el entorno del contenedor), y el pusher **resuelve y alcanza** ese nombre (`getent hosts ckan-dev → 172.19.0.4`, `wget → rc=0`). Por eso la subida al DataStore de la sonda D0 funcionó con `site_url = localhost`: **el pusher nunca usó `site_url`**. Conclusión medida: cambiar `site_url` a la URL pública **no toca la carga al DataStore**. (Contraste: la IP de LAN del host **no** es alcanzable desde el contenedor del pusher — el `wget` a `192.168.1.201:5000` no completa —, así que `callback_url_base` debe seguir siendo la dirección interna del servicio.)
  - **Trampa futura a tener escrita:** el embed de RF-30 depende de que el origen de CKAN sea alcanzable **y del mismo esquema** que el portal. Si el portal se sirve por `https` y `site_url` queda en `http`, el navegador bloquea el `<iframe>` y el `<img>` por contenido mixto. Al fijar la URL pública hay que fijar **las dos** con el mismo esquema.
  - **Arreglo, en orden de riesgo:** (1) `CKAN_SITE_URL` con la URL pública real —en este dev, la IP de LAN— es lo que desbloquea el síntoma entero, y es del repo `odp-docker`; (2) quitar el fallback `|| "http://localhost:5000"` o hacerlo **fallar ruidosamente** si la variable falta; (3) decidir si `APP_URL` se usa o se borra. **Recomendación de momento:** va antes que D3, porque sin esto los visores por tipo que acabamos de aprobar no se pueden verificar de verdad desde otra máquina.
  _Origen: reporte del autor, 2026-09-23; medición propia del mismo día (`ckan.site_url`, el `curl` a la IP de LAN y el inventario de `localhost` en `src/`)._

## v1 — producto usable en producción

- [ ] **[v1+] Filtros dentro de la tarjeta «Mis datasets».** El usuario pregunta si conviene agregarlos
  como en el buscador (y observa que ni el dashboard ni la página `user/<nombre>` de CKAN los tienen).
  **Recomendación: no por ahora.** El buscador ya tiene búsqueda facetada; la tarjeta es una lista
  personal y corta, y meter filtros ahí duplica maquinaria —y superficie de revisión— para un caso que el
  buscador cubre. Cuando el volumen lo justifique, la vía barata es un **enlace al buscador prefiltrado
  por creador** (`fq=+creator_user_id:<id>`, el mismo filtro que ya usa la tarjeta), que reutiliza las
  facetas existentes en lugar de reimplementarlas. _Origen: pregunta del usuario, 2026-09-17._

- [ ] **[v1] Buscador: que las cards se fijen completas al scrollear (scroll snapping).** El usuario lo
  pide y recuerda haberlo hecho antes; **medido el 2026-09-17: hoy NO existe ninguna clase `snap-*` ni
  `scroll-mt` en el repo**, así que es net-new y no una regresión. Dirección: `snap-y snap-proximity` (o
  `snap-mandatory`) en el contenedor de scroll y `snap-start` en cada card. **La trampa es el encabezado
  pegajoso**: hay que compensarlo con `scroll-mt-*`, porque el buscador ya tiene un `aside` con
  `lg:sticky lg:top-40` y el encabezado del sitio mide `var(--header-h)` (5rem, `src/app.css`); sin ese margen
  la card se fija por debajo de la barra y se ve cortada. Se relaciona con «Buscador dentro del menú pegajoso», anotado más abajo.
  _Origen: pedido del usuario, 2026-09-17._

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

- [ ] **[v0] Higiene de versión: el tag de CKAN como literal en ocho lugares** — hallazgo `R2-002`
  del linaje huérfano de la revisión del upgrade: `pre-existing`, SUGGESTION, **no** introducido por
  el upgrade. El tag vive como literal en los 4 `FROM` de los Dockerfiles, en las 3 imágenes de
  servicio de `.github/workflows/checks.yml` y en una celda de tabla del README, sin fuente única: un
  bump exige ocho ediciones coordinadas, y una olvidada deja el CI corriendo otra versión que los
  stacks — pasó de verdad con `redis:3`, que el 2.12 destapó (`HELLO`/RESP3) y que `d861c95` arregló.
  Sin dueño hasta ahora, y por eso se registra acá. Origen: store nativo, linaje
  `review-7e3ab346bc8b3f85`; transcripción completa en `odd/tasks/ckan-2.12-upgrade.md`.

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

- [ ] **[v1] Verificación estática pendiente del wizard** — "sin scroll horizontal a 360 px" quedó
  verificado solo por inspección de código, sin test automatizado.

- [ ] **[v1] Revisión nativa `escalated` sin cerrar** — la línea de revisión de la sesión
  2026-09-10/11 cerró en estado `escalated` (hallazgos severos inconclusos), no `approved`. El
  trabajo se commiteó igual porque el usuario lo pidió explícitamente. Los hallazgos severos
  quedaron sin resolver y **no están listados acá**: la acción del maintainer quedó como
  informativa. Si el maintainer quiere cerrarlos, hay que reinstanciar la revisión sobre el
  rango de commits correspondiente. _Origen: sesión 2026-09-10 (RDD)._
