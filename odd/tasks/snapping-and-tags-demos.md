# Expediente ODD — las demos de decisión: *scroll snapping* y los tags de la card

> Origen: punto 1 del handoff del 2026-10-05. Son **los dos ítems parqueados** del barrido de pulido de
> UI, los dos esperando una decisión del autor que **sólo se puede tomar mirándolos**.
> **Esta unidad entrega las demos, no las promociones**: se construye la hoja, el autor la recorre, se
> itera ahí, y recién entonces se promueve y se retira (regla 8 de `AGENTS.md`).

## Goal

Una **hoja única** (`/dev/search`) que ponga en pantalla, con el **componente real**, las dos decisiones
abiertas —«van aparte, con su propia hoja» (decisión del autor, 2026-10-05, en
`odd/tasks/error-surfaces.md`)— y que las haga decidibles **mirando y midiendo**, no leyendo código.

## Las dos preguntas que la hoja responde

### Q1 · ¿Dónde vive el *scroll snapping* del buscador? (`[v1]`)

Medido: **hoy no existe ninguna clase `snap-*` ni `scroll-mt` en el repo** (net-new, no regresión), y **la
premisa del ítem no se sostiene**: la lista de resultados **no tiene contenedor de scroll** — es un
`div.space-y-4` en el flujo del documento (`src/routes/search/+page.svelte:775` y `:885`), y el único
`overflow-y-auto` de la página es el del `aside` de filtros (`:624`, `lg:sticky lg:top-40`).
Tres salidas, y hay que elegir una:

| Salida | Qué es | Costo medido |
|---|---|---|
| **(a) `proximity`** | `snap-y snap-proximity` en el scroller de la página + `snap-start` en cada card, apoyado en el `scroll-mt` que ya existe (`estiloDestino`, `:223`) | El cambio más chico. No le pelea al scroll largo, ni a las otras secciones, ni al encabezado que se achica. El ajuste es **sutil por definición** |
| **(b) `mandatory`** | `snap-y snap-mandatory` en el scroller de la página | Es el «se fijan» literal, pero gobierna **todo** el desplazamiento de la página: con encabezado de alto variable, sidebar *sticky* y secciones altas es el más propenso a sentirse roto |
| **(c) contenedor propio** | darle a la región de resultados su propio `overflow-y-auto` con altura acotada | *Snapping* contenido y predecible, a costa de **dos áreas de scroll anidadas** en una página que ya tiene una |

**Trampa declarada:** el encabezado pegajoso. `--header-h` (`src/app.css`) mide 5rem y el `ResultsBar` ya
vive en `sticky top-[calc(var(--header-h)+1px)]` (`:521`); sin `scroll-margin-top` la card se fija **por
debajo de la barra y se ve cortada**.

### Q2 · ¿Cuál es el disparador de la divulgación de los tags? (`[v0]`)

Defecto medido (`src/lib/components/search/DatasetCard.svelte:95` y `:118`): `tags.slice(0, 3)` y después un
`+2` **pelado, sin rótulo y sin forma de saber cuáles son**; el **mismo defecto, con la misma forma**, está
en los chips de formato (`+{formatSummary.more} más`). **Un solo mecanismo arregla los dos.**

Decisión ya tomada por el autor (2026-10-03): **vendorizar el `Tooltip` de bits-ui**. El obstáculo que
apareció después, medido leyendo la API instalada (bits-ui 2.19.2): `TooltipTriggerProps` interseca
`BitsPrimitiveButtonAttributes` — el disparador es un **primitivo de botón** — y la card **entera** es un
`<a>` (`:59`). Quedan dos formas honestas:

| Forma | Qué es | Riesgo |
|---|---|---|
| **(a) el `<a>` de la card es el disparador** | `Tooltip.Trigger` con delegación por `child` envolviendo el `<a>`; el contenido lista las etiquetas y los formatos que el recorte esconde | Ninguno estructural: **cero contenido interactivo anidado**, el foco del enlace cubre el teclado, un solo mecanismo arregla los dos defectos |
| **(b) el título es el enlace y la divulgación es un `<button>` real** | reestructurar la card: `<h3>` con `<a>` adentro, divulgación en un `<button>` con `aria-expanded`/`aria-controls` | **Mueve la superficie de clic de toda la card** → necesita su propia ronda de revisión visual |

**Descartado por el arnés** (no volver a intentarlo): poner el disparador sobre un `<span>` no enfocable
exigiría `tabindex`, que es exactamente la violación `a11y_no_noninteractive_tabindex` que `/dev/nav` ya
documentó (`src/routes/dev/nav/+page.svelte:931`).

## Decisiones y lecciones que la hoja tiene que respetar

1. **El componente real, no una maqueta.** Lo que el autor aprueba es exactamente lo que se publica: la hoja
   renderiza `DatasetCard.svelte` y la estructura real de la página (rejilla, `aside` *sticky*, `ResultsBar`
   *sticky*), no una copia.
2. **La hoja puede fijar el estado que enseña.** Medido el 2026-10-05: un adorno que sólo vive en `hover`
   **no se puede revisar** y no existe en táctil — el estado era inalcanzable con el CSS correcto. Por eso
   la hoja lleva un interruptor de **forzado abierto** por forma, además del camino real (hover/foco/clic).
3. **Un instrumento que mide trae su propio auto-test y puede fallarlo.** Regla medida el 2026-10-03, con
   dos instrumentos mintiendo el mismo día. El auto-test va **en el DOM y en rojo** cuando falla, nunca en
   silencio.
4. **El *snapping* SÍ es verificable sin contenedor de frontend.** Medido el 2026-10-03 en chromium headless
   sobre sondas propias: con `scroll-snap-type: y mandatory`, `scrollTo(310)` termina en **404** sobre el
   scroller raíz y `scrollTo(0, 500)` termina en **410**. El navegador devuelve el desplazamiento **ya
   ajustado**. jsdom **no** lo reproduce (es la razón de que el instrumento exista).
5. **La hoja es un borrador y se retira al promover** (a diferencia de `/dev/error`, que es permanente).
   Se declara en el comentario de `+page.ts`.

## Plan (unidades de trabajo)

| WU | Qué | Verificación |
|---|---|---|
| **WU-1** | Vendorizar el `Tooltip` de bits-ui en nuestro estilo sobre los tokens de `src/app.css` (`src/lib/components/ui/tooltip/`), siguiendo el patrón de `ui/button` y `ui/card` | Test de componente: abre con foco y con hover, cierra con `Escape`, el contenido es alcanzable |
| **WU-2** | `DatasetCard.svelte`: prop de divulgación (`off` = hoy · `a` = el `<a>` dispara el `Tooltip` · `b` = título enlazado + `<button>` real), **un mecanismo para tags y formatos**, más el forzado abierto | Test de componente por forma: (a) **sin** contenido interactivo anidado, (b) `<button>` real con `aria-expanded`; los tres casos de recorte (3 tags exactos → sin `+N`; 0 tags; 8 tags) |
| **WU-3** | La hoja `/dev/search`: estructura real de la página + panel de control **fijo** (no participa del scroll) con el interruptor de *snapping* (`off`/`a`/`b`/`c`) × el de divulgación, presets de caso, e **instrumento en números** con auto-test | Test de la lógica pura (`decisions.ts`): mapeo modo → clases y scroller medido, aritmética del instrumento, y **el auto-test fallando cuando debe** |
| **WU-4** | Verificación en navegador: renderizar `/dev/search` contra `http://localhost:8082` con chromium headless, **leer los números del instrumento del DOM** (`--dump-dom --virtual-time-budget`), capturar pantalla, y anotar el resultado en `BACKLOG.md` | Números reales, no afirmaciones |

**Dependencias:** WU-1 → WU-2 (la card consume el `Tooltip`) → WU-3. **Escrituras en serie**, nunca en
paralelo (una sola sesión, un solo worktree).

### Instrumento — diseño mínimo (no negociable)

Mide **geometría de desplazamiento** sobre el scroller que el modo activo implica (window para (a)/(b), el
contenedor para (c)) y **dice cuál midió**:

- **Sonda:** `scrollTo(0, R)` con `R` elegido para caer **entre dos bordes de card**; se lee el desplazamiento
  final `S` y se informa `pedido`, `final`, `delta = R − S` y el borde de card más cercano.
- **Auto-test (control):** repetir la misma sonda con el *snapping* **anulado por estilo en línea** (no
  cambiando el modo). El control **tiene que dar `delta = 0`**. Si el control también se ajusta, el
  instrumento se declara **roto** y lo dice en el DOM, en rojo.
- **Trazabilidad:** imprimir el `scroll-snap-type` computado y el `scroll-margin-top` efectivo de la primera
  card, leídos con `getComputedStyle`, para que el número se pueda atar al CSS.
- **Límite honesto:** mide geometría, **no** «sensación». Que el ajuste se sienta bien lo decide el autor
  mirando.

### Panel de control

Fijo (`position: fixed`, `z-50`), **fuera del flujo** para no convertirse en un punto de *snapping*: el
interruptor de *snapping*, el de divulgación, el forzado abierto, los presets de caso (3 / 5 / 8 tags; 1 / 3
/ 6 formatos; título largo), el botón del instrumento y su lectura. Los parámetros de consulta
preseleccionan el panel, como en `/dev/error`, para poder compartir un caso exacto.

### Fidelidad de la página que la hoja duplica

El encabezado real ya lo pone `src/routes/+layout.svelte:80` (sticky, `var(--header-h)`), así que el
documento de la hoja **es** el scroller de la página y las salidas (a) y (b) se demuestran de verdad, no
simuladas. Hacen falta, además: una rejilla con `aside` *sticky* (`lg:top-40`), un `ResultsBar` *sticky*
(`top-[calc(var(--header-h)+1px)]`), y **dos o tres secciones altas** (equivalentes a «pruebe con»,
«recientes», «organizaciones») para que el *snapping* se juzgue en una página **larga y realista**, que es
donde (b) se rompe.

## Criterios de aceptación

1. Las **tres** salidas del *snapping* y las **dos** formas del `Tooltip` se pueden ver y comparar **sin
   editar código**, con un interruptor.
2. El instrumento **imprime números** y su auto-test **puede fallar en voz alta**.
3. El estado que la hoja enseña se puede **fijar** (no depende de tener el mouse encima).
4. `pnpm test` verde y `node_modules/.bin/biome check .` limpio. La suite **no se debilita**: una prueba
   nueva más débil que su comentario es el mismo defecto un nivel más arriba (medido el 2026-10-05).
5. `svelte-check` sin errores nuevos (los 4 warnings preexistentes se toleran).

## Fuera de alcance (declarado)

- **Promover** cualquiera de las dos decisiones: eso es la ronda siguiente, después de que el autor elija.
- Los playgrounds de los botones (hero y card del dashboard): **ya se promovieron**.
- El afinado de la página de error, el copy del formulario y la deuda de prueba del hero.
- Tocar `main` fuera de lo que estas unidades necesiten, y el linaje atascado `review-6b517157db5f4274`.

## Evidencia

### Lo que hay para mirar

- **Hoja: `/dev/search`** —sólo DEV; en producción responde 404— ya servida por el contenedor en
  **<http://localhost:8082/dev/search>** (el contenedor monta `src/`, no hace falta levantar nada).
- Cada control está en la URL: `?snap=off|proximity|mandatory|contained`,
  `?disclosure=off|link-tooltip|title-link`, `?open=1`, `?case=<id>`, `?panel=open`.
- La hoja **nace colapsada y no mueve el viewport**: mide, restaura la posición y avisa **en rojo** si el
  navegador se niega a volver.

### Los números, medidos en el navegador (chromium headless contra el 8082)

| Modo | Scroller | `scroll-snap-type` | Margen | Punto más lejano a todo borde |
|---|---|---|---|---|
| `off` | window | `none` | 164,0 px | R 2337,9 → S 2338,0 (Δ −0,1) |
| `proximity` | window | `y proximity` | 164,0 px | R 2337,9 → S **2338,0** (Δ −0,1) |
| `mandatory` | window | `y mandatory` | 164,0 px | R 2337,9 → S **1631,0** (Δ **706,9**) |
| `contained` | region | `y mandatory` | 164,0 px | (pedido acotado al máximo, marcado «acot.») |

El auto-test (la misma sonda con el *snapping* anulado por estilo en línea) devolvió **delta máximo 0,4 px**
las cuatro veces: el instrumento no se está midiendo a sí mismo. El margen de **164,0 px** es
`--header-h` (80) + barra pegajosa (68) + `1rem` (16), leído de la página.

### El hallazgo que decide Q1

En los cinco sondeos que caen dentro de la zona de resultados —una brecha de 225 px— **`proximity` y
`mandatory` dan el mismo número**, porque todo desplazamiento queda a menos de ~112 px de un borde y Chrome
ajusta igual. La diferencia aparece **sólo en el punto más lejano a todo borde**, que son las secciones altas
donde no hay card: ahí `proximity` deja el desplazamiento donde está y `mandatory` lo **arrastra 707 px**.
Traducido a la decisión: (a) y (b) se comportan igual **donde el usuario mira las cards**, y difieren **donde
la página tiene contenido que no es card** — que es el «se siente roto» que el ítem del `BACKLOG` ya preveía.

### Defectos que salieron de medir, no de leer

Los seis se arreglaron en la rama: (1) el instrumento **secuestraba el viewport** al cargar; (2) cinco
sondeos dentro de una misma brecha hacían que (a) y (b) imprimieran **lo mismo**; (3) el margen se leía
**antes** de que el alto de la barra pegajosa se asentara (imprimía 96 px donde el CSS dice 164); (4) la
línea «expected» nombraba el borde más cercano y el aterrizaje la **contradecía** en la misma pantalla;
(5) `y` se imprimía por lo que es `y proximity`; (6) un pedido por encima del máximo del scroller se leía
como «no se ajustó» en vez de **acotado**.

### Verificación

- **Suite completa: 944/944 en 60 archivos** con la rama; **863/863 en 55** en `ae3e3df` (HEAD antes de
  ella). `biome check .` limpio sobre 180 archivos · `svelte-check` 0 errores / 4 warnings preexistentes.
- **El baseline documentado del cierre anterior estaba viejo:** «919/919 en 57 archivos» corresponde a
  `df03eed^`; ese commit retiró las dos hojas y con ellas **56 tests** (33 + 23). Medido en un worktree
  aparte para no tocar el árbol de trabajo.
- **Verificación independiente:** la primera pasada quedó **invalidada porque el árbol se movió durante su
  corrida** — defecto de orquestación propio, al mandar correcciones en paralelo al verificador. La segunda
  corre sobre el commit congelado.
- **Compuertas nativas (RDD):** ver el cierre de la sesión; el switch está encendido y la decisión de qué
  candidato se congela es del autor.

### Commits de la rama `feat/dev-search-decision`

`9273083` expediente · `967d2f6` tooltip vendorizado · `0d5b056` la card que divulga lo que trunca ·
`7cdaf90` la hoja de decisión. **Nada pusheado y nada mergeado:** el push, el PR y el merge son decisiones
 del autor.
