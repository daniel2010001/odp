# Barrido de pulido de UI — sesión paralela

> **Sesión** `01a102a7-0f94-76b7-86fb-55c8c3d88023`. Corre **en paralelo** a la sesión que trabaja la
> ruta de edición y borrado de datasets (`openspec/changes/2026-10-02-dataset-edit-and-delete/`).
>
> **Aislamiento:** worktree propio `~/projects/odp-ui-polish`, rama `feat/ui-polish-sweep`, base
> `9bf844a` (el `main` local con el commit de la otra sesión ya incluido). Decidido por el autor el
> 2026-10-03: dos sesiones no comparten índice ni `HEAD`.
>
> **Reparto declarado:** esta sesión **no toca** `src/lib/components/datasets/**` ni
> `src/routes/dashboard/datasets/**`. Declarado por mensaje a las sesiones `01a101f5` y `01a1026b`
> (aceptados para entrega, sin acuse de lectura: **no hubo confirmación del par** — ver «Riesgo»).
>
> **Reglas de commit heredadas de este repo** (BACKLOG, cierre 2026-09-24): `git add <paths>` explícitos,
> **nunca** `git add -A` ni `git checkout -- <archivo>`.

## Baseline medido antes de la primera escritura (2026-10-03)

| Comprobación | Resultado |
|---|---|
| `pnpm test` | **51 archivos / 788 tests, todos en verde** (130.7 s) |
| `pnpm exec svelte-kit sync` | necesario en el worktree nuevo: sin `.svelte-kit/` el `tsconfig.json` no resuelve y `vitest` muere en *dependency optimization* |
| `NODE_OPTIONS=--max-old-space-size=6144 pnpm exec biome check .` | **no completó**: `Linter process terminated abnormally (possibly out of memory)`. Memoria de la máquina bajo presión en el momento de la medición (11 GiB totales, 1,7 GiB libres) |

## Ítems tomados (aprobados por el autor, 2026-10-03)

| WU | Ítem del backlog | Tier | Archivos | Decisión de producto |
|---|---|---|---|---|
| WU-1 | `BACKLOG`: los 11 diagnósticos de Biome (4 falsos positivos, 7 cosméticos) | `[v1+]` | `src/app.css`, `src/routes/search/+page.svelte`, `scripts/seed-ckan.mjs`, `src/lib/components/ThemePlayground.svelte`, `biome.json` | no |
| WU-2 | `BACKLOG`: pulido visual de las páginas de error | `[v1+]` | `src/routes/+error.svelte`, `src/lib/components/error/ErrorPage.svelte`, `src/routes/dev/error/+page.svelte` | no (el ítem **prohíbe** cambiar copy y estados) |
| WU-3 | `BACKLOG`: el buscador, que las cards se fijen completas al scrollear | `[v1]` | `src/routes/search/+page.svelte` | no |
| WU-4 | `BACKLOG`: los tags de la card de dataset cortan a tres y no dicen cuáles | `[v0]` | `src/lib/components/search/DatasetCard.svelte` | **sí** — pendiente antes de escribir |

## Tareas

### WU-1 — los 11 diagnósticos de Biome — **CERRADO** (`034ac61`)

- [x] Baseline real medido: **`Found 4 warnings. Found 7 infos.`** sobre 149 archivos, idéntico al conteo
      declarado en el backlog. Las **líneas** del ítem ya no coincidían: el bloque `prefers-reduced-motion`
      vive hoy en `src/app.css:172-180`, no en `:139-142`; y los 4 `useLiteralKeys` están en
      `src/routes/search/+page.svelte:101-104`, no en `:86-89`.
- [x] `lint/complexity/noImportantStyles` (4 warnings, `src/app.css:177-180`): **no se aplicó el fix**. Se
      apagó la regla **sólo para `src/app.css`** con un `overrides` en `biome.json`, y el motivo quedó
      escrito junto al bloque que protege.
- [x] `lint/complexity/useLiteralKeys` (4 infos): acceso por punto. `noPropertyAccessFromIndexSignature`
      confirmado ausente de `tsconfig.json` y del `.svelte-kit/tsconfig.json` generado.
- [x] `lint/style/useTemplate` (2 infos cosméticos, `scripts/seed-ckan.mjs`, `ThemePlayground.svelte`).
- [x] `lint/style/useTemplate` en `src/routes/search/+page.svelte`: **no** se usó el fix automático. Ahora hay
      un solo `const queryString = params.toString()` y un `suffix` con nombre; la URL resultante se comparó
      expresión vieja contra expresión nueva en 6 casos (sin parámetros, con parámetros, con y sin `hash`,
      multi-parámetro con caracteres escapados) y coincide en todos.
- [x] Conteo final: **0 warnings / 0 infos** sobre los mismos 149 archivos.

**Evidencia verificada de forma independiente** (`gentle-ai-verify`, tras un escritor delegado):

| Afirmación | Veredicto | Prueba |
|---|---|---|
| Las 4 declaraciones con `!important` quedaron idénticas | **confirmada** | `sha256` de las 4 líneas extraídas: `ea08253d…` en `HEAD` y en el árbol; el bloque `@media` completo, `4edcd102…` en ambos |
| `biome check src scripts` → 0/0 sobre 149 archivos | **confirmada** | binario directo y `pnpm`, 12/12 corridas de `pnpm lint` `.` con exit 0 |
| El `overrides` no apaga nada más | **confirmada** | probado fuera del repo, en `/tmp`: la regla desaparece sólo en el archivo incluido, y las otras dos reglas de CSS siguen reportándose |
| Los 5 arreglos no cambian comportamiento | **confirmada** | `16794` combinaciones de `rgbToHex` viejo contra nuevo, `diffs=0`; 6 casos de URL, `ALL_MATCH=true` |
| `pnpm test` 51/788 y `pnpm check` 0 errores | **confirmada** | las 4 advertencias de `check` son preexistentes y ninguna está en una línea tocada |

**Y una afirmación del escritor que la verificación refutó, que importa más que el arreglo:** el escritor
atribuyó el `Linter process terminated abnormally` / exit 254 a un proxy `rtk` sobre `pnpm`. **Es falso:**
`which pnpm` es el binario real de mise (ELF, sin wrapper), no hay hooks, y `pnpm exec biome check .` dio
**12/12 exit 0**. Lo observable es un **cuelgue transitorio del worker de Biome**, no un problema de
proxy. Consecuencia práctica: **`pnpm lint` sirve en este repo**, pero puede fallar esporádicamente con
exit 254; hay que reintentar y no confundirlo con un fallo del código.

### WU-2 — pulido visual de las páginas de error — **PROPUESTA EN REVISIÓN** (`5cc46c4`)

- [x] El ítem leído: **prohíbe** cambiar la copia y los dos estados. Lo que falta es densidad visual.
- [x] Construido el aparato de revisión (regla 8 de `AGENTS.md`): la hoja `/dev/error` ganó panel de control
      (presets de caso, interruptor de variante, interruptor de tema), estado en la URL
      (`?variant=&theme=&path=`) e **instrumento de contraste** que mide el nodo real con `getComputedStyle`.
- [x] Tres propuestas más la línea base, implementadas como **prop temporal `variant` del componente real**
      (`ErrorPage.svelte`), no como maqueta: `actual` (idéntico a hoy), `tarjeta`, `sello`, `banda`.
- [x] **Decisión del autor:** `tarjeta`. Y el pill coral **no viaja**: compuesto sobre la card da 4.40 contra
      el umbral 4.5, así que el eyebrow queda coral pelado, que mide 5.00.
- [x] **Promovida y andamio desmontado** en `db63617`: es el único diseño de `ErrorPage.svelte`; se fueron la prop
      `variant`, las tres ramas perdedoras, el interruptor de variante de la hoja y el parámetro `?variant=`. La hoja
      conserva presets, interruptor de tema, `path` e instrumento. **`error-page.test.ts` pasó sin haber sido editado**
      (el contrato de presentación sobrevivió a la promoción, que era el objetivo de diseñar dentro de él).
- [x] Los 4 tests que sólo existían por el andamio se borraron, **y con ellos quedó sin cubrir el veredicto `falla`**
      del instrumento: la única aserción era un `toMatch(/ok|falla/)` que no podía fallar. Lo detectó la verificación
      independiente y se cerró en el mismo commit con tres veredictos exactos, **comprobados falsificables** mutando la
      fuente y viendo fallar la aserción.

#### Números medidos en Chromium headless sobre `http://localhost:5175/dev/error`

Orden de columnas: eyebrow · encabezado · cuerpo · acción primaria · acción secundaria. El encabezado tiene
umbral 3:1 por ser texto grande; todo lo demás 4.5:1.

| variante / tema | eyebrow | encabezado | cuerpo | primaria | secundaria |
|---|---|---|---|---|---|
| `actual` / claro | 4.69 | 5.09 | 7.80 | 5.30 | 14.33 |
| `actual` / oscuro | 7.21 | 4.37 | 6.98 | **3.72 falla** | 14.08 |
| `tarjeta` / claro | **4.40 falla** | 5.43 | 8.32 | 5.30 | 14.33 |
| `tarjeta` / oscuro | 5.12 | 3.71 | 5.92 | **3.72 falla** | 14.08 |
| `sello` / claro | 5.00 | 5.43 | 8.32 | 5.30 | 14.33 |
| `sello` / oscuro | 6.10 | 3.71 | 5.92 | **3.72 falla** | 14.08 |
| `banda` / claro | 5.00 | 5.43 | 8.32 | 5.30 | 14.33 |
| `banda` / oscuro | 6.10 | 3.71 | 5.92 | **3.72 falla** | 14.08 |
| medidas de layout | columna 350 px · sin desborde (350/350, 316/316) · documento 1440/1440 en los 8 casos | | | | |

#### Los dos hallazgos de esa medición

1. **El pill coral de `tarjeta` falla AA en modo claro: 4.40 contra el umbral 4.5.** El fondo propio es
   `#f3edee`, que es el coral al 10% compuesto sobre la card. Es el único número que cambia entre variantes
   en claro. Se arregla de dos maneras: **sin pill** (como `sello`, que mide 5.00) o con un coral más oscuro
   o sin tinte. Es una **decisión de diseño**, no un defecto del instrumento.
2. **Hallazgo preexistente y de todo el portal: la acción primaria en modo oscuro falla AA con 3.72.** Es
   `--primary-foreground` sobre `--primary` en oscuro, o sea **un par de tokens**, no una página: afecta a
   todos los botones primarios del portal. **No lo introdujo esta sesión** —`actual/oscuro`, que es el código
   de hoy, ya medía 3.72— y arreglarlo es una decisión de tokens, no de esta ronda. Va al `BACKLOG`.

#### Y el instrumento se encontró a sí mismo primero

La primera corrida reportaba el pill de `tarjeta` con **4.99 «ok»**. Era falso. Tailwind v4 compila
`bg-destructive/10` a `color-mix(in oklab, …)` y Chromium lo serializa como `oklab(… / 0.1)`, que el parser no
entendía; el instrumento **descartaba en silencio** el fondo propio del elemento y medía contra el de la card.
Además de agregar `oklab()` (y `hsl()`, `color(srgb)` y las unidades de matiz), un fondo ilegible ahora produce
el veredicto **`no medible`**, nunca `ok`: un instrumento que no puede medir tiene que decirlo.

### WU-3 — scroll snapping del buscador

- [ ] Apoyarse en `estiloDestino`/`scroll-margin-top` que ya existen (`src/routes/search/+page.svelte:219-221`).
- [ ] Verificar con una aserción de DOM, no «a ojo».

### WU-4 — los tags cortados de la card

- [ ] **Bloqueado hasta que el autor decida**: `title` nativo vs `Tooltip` vendorizado (bits-ui) vs no truncar.

## Riesgo declarado

- **El par no acusó recibo.** Los dos mensajes quedaron «accepted for delivery». No hay bloqueo real entre
  sesiones: el aislamiento lo da el worktree, no un acuerdo. Si la otra sesión también crea un worktree o
  mueve `main`, la sincronización final (rebase sobre `main`) es responsabilidad de esta sesión.
- **`BACKLOG.md` es el punto caliente compartido, y ya se materializó una vez.** Ver el bloque del rebase: el
  duplicado apareció **sin ningún conflicto**. Al integrar, la resolución es a mano y **una sola copia**, nunca
  `-X ours` ni «quedarse con los dos lados».
- **Biome: el `exit 254` es transitorio, no falta de memoria.** Corregido por medición: dos fallos seguidos y
  después **12/12 corridas con exit 0**, mismo binario, con `pnpm` real de mise y sin wrapper. Ante el 254 se
  **reintenta**; no se lee como fallo del código ni como baseline incomparable.

## Evidencia

| WU | Commit | Archivos | Líneas | Verificación independiente |
|---|---|---|---|---|
| WU-1 | `034ac61` | 5 | +23 / −9 | sí — `gentle-ai-verify`, con una afirmación del escritor **refutada** |
| WU-2 (aparato de revisión) | `5cc46c4` | 9 | +1860 / −27 | sí — `gentle-ai-verify`, con la matemática `oklab` contrastada contra una implementación independiente (error máximo 4,1e-4 sobre 255) |
| WU-2 (promoción) | `db63617` | 3 | +159 / −363 | sí — `gentle-ai-verify`: andamio eliminado, contrato intacto, y un hueco real de cobertura encontrado |

## Cierre de la sesión (2026-10-03)

**Cerrado y verificado:** WU-1 (Biome) y WU-2 + WU-2b (la página de error). Cuatro unidades de trabajo con commit
propio, todas con verificación independiente, y las cuatro con al menos una corrección que salió de medir en vez de
de leer: el `!important` que era una regresión de accesibilidad disfrazada de fix, el instrumento de contraste que
mentía con los fondos translúcidos, un escritor que atribuyó un fallo a un proxy inexistente, y un hueco de cobertura
dejado por el propio desmontaje del andamio.

**Abierto, con análisis hecho y sin arqueología pendiente:**

| Ítem | Estado | Lo que falta |
|---|---|---|
| WU-3 · *scroll snapping* del buscador | **bloqueado por el diseño, no por el entorno** | Mi diagnóstico anterior («no se puede verificar») era **falso y lo corregí midiendo**: en chromium headless el *snapping* real es observable —`scrollTop = 250` sobre un contenedor con `snap-type: y mandatory` devuelve **202**, `scrollTo(310)` devuelve **404**, y en la raíz `scrollTo(0, 500)` devuelve **410**—. Lo que falta no es un motor, es una decisión: **la lista de resultados no tiene contenedor de scroll propio** (`div.space-y-4` en el flujo del documento; el único `overflow-y-auto` es el del sidebar), así que el *snapping* tiene que ir o en el scroller de la página (`proximity`, sutil y sin pelear con el encabezado; o `mandatory`, que gobierna toda la página) o en un contenedor nuevo (scroll anidado). Las tres están escritas en el ítem del `BACKLOG` con su costo. |
| WU-4 · los tags cortados de la card | bloqueado por una decisión | El autor eligió el `Tooltip` de bits-ui, y el disparador es un primitivo de botón: contra una card-enlace hay que elegir entre **(a)** la card como disparador o **(b)** reestructurar la card. El análisis completo está en el ítem del `BACKLOG`. |

**Estado del árbol al cerrar:** rama `feat/ui-polish-sweep` en `~/projects/odp-ui-polish`, **rebaseada sobre `main`
(`ab4dd36`), 10 commits encima, 0 detrás**, árbol limpio, **55 archivos / 858 tests en verde**, `pnpm check` 0 errores,
`biome check .` (164 archivos) **0 warnings / 0 infos**, **nada pusheado**.

> **El rebase salió sin un solo conflicto, y eso destapó un duplicado.** Los dos hallazgos existían **dos veces** —la
> sección que el par trajo a `main` y la mía—, una al lado de la otra, y git no dijo nada porque los hunks caen en
> regiones distintas. **Git verifica texto, no significado.** Se borró mi copia y no la suya por una razón que es la
> regla entera: la de `main` sobrevive sin esta rama, la mía no. Lo único que sólo estaba en la mía —las opciones
> concretas del arreglo de contraste y el detalle medido del 254— se consolidó en la sección de `main` (`ff52b7c`),
> con tres cambios aditivos que el par aceptó.
>
> **La fragilidad que queda, y es de merge:** si alguien mueve las líneas de esa sección en `main` antes de que esta
> rama se integre, hay conflicto, y la resolución tentadora —«quedarse con los dos lados»— **recrea el duplicado**,
> otra vez sin ruido. La resolución correcta es **una sola copia**: la sección de `main` con las adiciones encima, y
> **sin** reinsertar la sección vieja. El par se comprometió a no tocar esas líneas hasta el merge, y verificado al
> cerrar con `git merge-tree`: hoy entra **sin conflictos**.

**Cero procesos dejados atrás:** el servidor de desarrollo que levanté en el host (puerto 5175) quedó apagado,
verificado por `ss` y por `curl`. El portal sigue siendo 8082, servido por el contenedor del par.
## Handoff para la próxima sesión

**Todo lo de esta sesión vive en esta rama y aterriza con el merge.** Nada de lo escrito acá es durable hasta que la
rama se integre. Los dos *hallazgos* sí lo son: el par les dio copia propia en `main`. Lo que viaja con la rama es el
**análisis de los dos ítems parqueados** y este expediente.

**Primer paso al retomar:** `git log --oneline main..HEAD` para ver si `main` se movió, y rebasear si hace falta.
Verificado al cerrar: `main` = `ab4dd36`, **0 detrás**, y `git merge-tree` daba **sin conflictos**.

**Las dos decisiones que hay que tomar ANTES de escribir código, y las dos son del autor:**

| Ítem | La decisión | La restricción medida que la fuerza |
|---|---|---|
| WU-3 · *scroll snapping* del buscador | `proximity` en el scroller de la página · `mandatory` (que gobierna **toda** la página y pelea con el encabezado de alto variable) · o un contenedor nuevo con scroll anidado | **La premisa del ítem no se sostiene: la lista de resultados no tiene contenedor de scroll.** Es `div.space-y-4` en el flujo del documento; el único `overflow-y-auto` es el del sidebar de filtros |
| WU-4 · los tags cortados de la card | la card entera como disparador del `Tooltip` · o reestructurar la card con el título como enlace y un `<button>` afuera | **`TooltipTrigger` es un primitivo de botón** (bits-ui 2.19.2) y la card entera es un `<a>`: dentro sería contenido interactivo anidado. Un `<span>` no enfocable con `tabindex` es la violación `a11y_no_noninteractive_tabindex` que `/dev/nav` ya documentó |

**Y una medición corregida que conviene no volver a deshacer:** el *snapping* **sí** se puede verificar sin contenedor
de frontend. Un `vite dev` de host **efímero** desde el `node_modules` de este worktree, más chromium headless, que
aplica el snap y devuelve el desplazamiento **ya ajustado** (`scrollTop = 250` → 202, `scrollTo(310)` → 404, raíz
`scrollTo(500)` → 410). `AGENTS.md` documenta ese uso como legítimo para medir un worktree que el proxy no monta.

## Para el autor — lo que espera una decisión suya

1. **Las dos decisiones de arriba**, que son las que desbloquean el trabajo que queda.
2. **El push y el PR:** 10 commits en `feat/ui-polish-sweep`, ninguno pusheado, y `main` local también adelante de
   `origin/main`. Eso no es de ninguna sesión.
3. **El contraste del botón primario en modo oscuro.** Ya está en `main`: es una **regla escrita incumplida**
   (`AGENTS.md:35` exige ≥ 4.5:1 y el par mide **3.733**), portal-wide y preexistente. El arreglo son tokens en
   `src/app.css`, así que la decisión es suya.
4. **Mirar la página de error promovida** —card del portal, medallón del ícono, regla coral—. Para verla en el portal
   (8082) hace falta el merge, porque el proxy sirve el árbol de `main`. La medición de contraste de los cinco
   elementos en los dos temas está en la tabla de más arriba.
