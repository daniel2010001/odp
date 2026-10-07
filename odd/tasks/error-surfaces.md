# Expediente ODD — superficies de error: una sola página, y el 404 legible

> Origen: la revisión visual del autor (2026-10-05) sobre el portal corriendo. Tres observaciones
> concretas y dos decisiones suyas.

## Goal

1. Que el estado de error **se vea igual en todas las superficies** (hoy la ruta inexistente usa
   `ErrorPage` y la página del dataset/recurso usa un bloque viejo propio).
2. Arreglar el **404 visible**: el medallón desalineado y el diagnóstico en inglés.
3. **No** perder el copy honesto que ya estaba medido y probado.

## Decisiones del autor (2026-10-05)

- **Política del 403: mantener la ambigüedad** para el espectador sin sesión, y **unificar el diseño**.
- **Orden**: primero los errores (este expediente), después los playgrounds de los botones.
- **Sí** a las demos de *scroll snapping* y de los tags (van aparte, con su propia hoja).

## Corrección declarada (el autor decidió con un dato que yo no había verificado)

La opción elegida decía «y el estado HTTP deja de ser 200». **Eso no es correcto y lo retiro:**

- `/dataset/privado` responde **200** porque el servidor devuelve el **armazón de la SPA**
  (`bytes=91775`, y el texto de error **no** está en ese HTML): la carga ocurre **en el navegador**,
  en un `$effect`.
- Para que la respuesta fuera 404 habría que mover la carga a un `load` de servidor, y **el token de
  sesión vive en el navegador** (la cookie `httpOnly` es un pendiente del `BACKLOG`). Un `load` de
  servidor no puede distinguir «anónimo» de «sesión viva», que es la información con la que
  `$lib/api/failure.ts` elige el copy honesto.
- Consecuencia: **el 200 se queda**, y no es un defecto de esa página sino una propiedad de la
  arquitectura (SPA + token en el navegador). El defecto real —y lo que el autor ve— es **el diseño**,
  y eso sí se arregla.

## Hallazgos de la revisión (medidos)

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | El medallón del ícono queda **a la izquierda** en una card centrada | `ErrorPage.svelte:121`: `flex size-16` dentro de una card que no es flex, **sin `mx-auto`**. En la hoja no se nota (cards de ~330 px); en la real sí (576 px) |
| 2 | El diagnóstico de DEV está **en inglés** (`Not Found`, `Access denied`) | Línea mono bajo cada tarjeta; `statusText` del framework, visible en desarrollo |
| 3 | `/dataset/privado` **no** usa `ErrorPage`: dibuja su propio bloque viejo | `curl` → 200 y el texto ausente del HTML del servidor; el bloque vive en `{:else if invalidParams \|\| failure}` |
| 4 | **Dos políticas opuestas** conviven en el código | `ErrorPage` declara «DOS estados, nunca tres» y no lee la sesión; `failure.ts` **sí** distingue para `session-alive` («Su cuenta no está autorizada…»), y hay tests que lo exigen (`dataset-page.test.ts:190`) |

## Plan

1. `ErrorPage.svelte`: **`mx-auto`** en el medallón, y el diagnóstico de DEV a **español neutro**.
2. Aceptar **copy del llamador** en `ErrorPage` (con el genérico como valor por defecto), para
   unificar el diseño **sin** perder el copy honesto de `failure.ts`.
3. Página del dataset y del recurso: renderizar `ErrorPage` en vez del bloque propio.
4. Criterio de aceptación: **los textos que los tests ya afirman no cambian** — sólo cambia el dibujo.
   Si un test tiene que cambiar, es señal de que cambié una decisión y hay que declararlo.

## Fuera de alcance (declarado)

- El estado HTTP (ver la corrección de arriba).
- Los playgrounds de los botones (hero y card del dashboard) y las demos de *snapping*/tags.

## Evidencia

### Los textos no cambiaron; el dibujo sí

**Criterio de aceptación cumplido**: los 229 tests de las 7 suites afectadas pasan **sin editar una sola
aserción**. El copy que `describeFailure` construye —«Dataset no encontrado», «no tiene permiso para verlo»,
«Su cuenta no está autorizada», «no se pudo confirmar el acceso»— sigue siendo el mismo; lo que cambió es quién
lo dibuja.

### Archivos

| Archivo | Qué cambió |
|---|---|
| `src/lib/components/error/ErrorPage.svelte` | `mx-auto` en el medallón; diagnóstico de DEV en español con el mensaje del framework citado y rotulado; tres props nuevas (`copy`, `primaryAction`, `retry`) y `variant` |
| `src/lib/api/failure.ts` | `statusFor(kind)` — la única traducción clase→código, para que las páginas no la repitan |
| `src/routes/dataset/[id]/+page.svelte` | El bloque propio de error se reemplaza por `<ErrorPage>` con el copy honesto |
| `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte` | Idem, con «Volver al dataset» cuando se sabe cuál es |
| `src/routes/dev/error/+page.svelte` | La nota de la hoja dice ahora lo que el diagnóstico hace de verdad |

### RED → GREEN, medido

**La suite existente fue el RED, y atrapó dos mapeos míos equivocados:**

1. Primer intento: `status = statusFor(kind)`. **6 tests en rojo.** Uno porque `ErrorPage` fijaba el
   `<title>` del documento y pisaba el de la página (`Recurso no encontrado — UMSS` → `Página no disponible —
   UMSS`): arreglado pasando `title: pageTitle` en el `copy`. Los otros por el mapeo.
2. Segundo intento: `variant` derivado de `presentation.definitive`. **4 tests en rojo**, los cuatro del caso
   `403` con sonda no concluyente: `isDefinitive` mira **sólo la clase del fallo**, así que declaraba «respuesta
   final» un `403` cuya causa nadie confirmó, y el test exige **reintento**.
3. Tercer intento — el correcto: **la señal es la acción disponible** (`!actions.retry` → estado de cliente).
   **229/229 en verde.**

La lección quedó en el código, no sólo acá: `status` («qué respondió el catálogo») y `variant` («qué se puede
ofrecer») **son dos hechos distintos**, y conflarlos fue lo que produjo los dos errores.

### Compuertas de calidad

| Chequeo | Resultado |
|---|---|
| `vitest` de las 7 suites afectadas | **229 passed (229)** |
| `pnpm check` | **0 errores**, 4 warnings preexistentes |
| `biome check` sobre los 5 archivos | **exit 0** (primer intento) |

### Verificación visual (capturas nuevas)

- `/dataset/privado` → **la misma card** que una ruta inexistente: medallón centrado, «ERROR 404»,
  «Dataset no encontrado» (el copy honesto, intacto), regla coral, acciones, y el diagnóstico
  «Estado 404 — la dirección no existe».
- `/pagina-que-no-existe-xyz` → medallón **centrado** y diagnóstico
  «Estado 404 — la dirección no existe · /pagina-que-no-existe-xyz · el framework dice «Not Found»».
- Capturas en `/tmp/rev/fix_privado.png` y `/tmp/rev/fix_ruta404.png`.

### Compuerta nativa

`review-55de0c344451cd06` — tier **medium**, lente `review-reliability`, 7 archivos / 392 líneas,
presupuesto de corrección 196, **una corrida de modelo**. **Aprobada**, autoridad quemada
(`gentle-ai.review-acknowledged/v1`).

**Un hallazgo informativo, y esta vez con su texto**: se leyó del estado **antes** del acuse, que es la lección
de la ronda anterior.

> `R3-001` (reliability, SUGGESTION) — «The new `statusFor` mapping is non-exhaustive: it returns 503 for any
> `ApiFailureKind` other than unauthorized and not-found. A future kind addition would silently map to 503
> instead of producing a compile-time error. Consider an exhaustive switch with a never check so the mapping
> stays correct as kinds evolve.» — `src/lib/api/failure.ts:84-88`

**Se aplicó en el momento, no se anotó**: `statusFor` es ahora un `switch` exhaustivo con un `never`, así que
agregar una clase sin mapearla **deja de compilar**. Es la primera vez en este repo que un hallazgo informativo
se cierra al recibirlo en vez de sumarse a la lista de deuda — y sólo fue posible porque esta vez se leyó el
estado antes de acusar.

**Segunda compuerta, y encontró un defecto en el arreglo de la primera.** `review-a23b77b7964565df` (medium,
lente reliability, 3 archivos / 57 líneas, una corrida de modelo) aprobó con otro `R3-001`, esta vez
**WARNING**, en `src/lib/api/failure.ts:96-97` — las líneas que acababa de agregar:

> «The new exhaustive default branch returns the unexpected `kind` value at runtime instead of throwing or
> preserving the previous 503 fallback. If an out-of-union value reaches `statusFor` (for example through an
> untyped caller or an `as ApiFailureKind` cast), the function returns that value, violating its `number`
> return contract and regressing the prior defensive 503 response.»

Correcto, y **más filoso que mi arreglo**: el `never` protege el **tipo**, no el **runtime**. Ahora hay dos
guardas y cada una cubre lo suyo: el `never` rompe la compilación si la unión crece sin mapearse, y el `503`
defensivo se conserva para un llamador sin tipos o un `as` — que es exactamente la política que el propio
`classifyFailure` ya aplica («lo desconocido cae del lado del servidor»).

**El bucle se acota acá**: son dos rondas sobre las mismas cinco líneas, las dos con hallazgo informativo. Si
esta segunda corrección produce un tercer hallazgo sobre el mismo lugar, se anota en el `BACKLOG` en vez de
re-abrir el ciclo — es trabajo posterior, no una razón para re-revisar este candidato.

**Tercera compuerta — y ésta no era un detalle de línea, era una prueba faltante.** `review-c28228e16181377e`
(medium, reliability, 3 archivos / 48 líneas, una corrida de modelo) aprobó con un tercer `R3-001`
(SUGGESTION):

> «The candidate adds a runtime fallback but its changed-path manifest contains no test asserting that an
> out-of-union kind maps to `503`; the externally observable regression fix remains unproved.»

Es correcto, y **se satisface**: dos pruebas nuevas en `src/lib/api/failure.test.ts` — las tres clases, y un valor
fuera de la unión forzado con un cast que debe seguir devolviendo `503` (`52 passed` en ese archivo).

**Sin RED, declarado**: el hallazgo pedía prueba de un comportamiento ya escrito, así que la prueba es de
verificación y no un ciclo. No se simuló una falla previa para fabricar un ROJO que no existió.

**Y el bucle se cierra acá, de verdad**: tres rondas, tres hallazgos informativos, ninguno bloqueante. Si esta
corrección vuelve a producir un hallazgo sobre el mismo lugar, se anota y no se re-abre: el revisor ya demostró
que tiene más que decir sobre estas cinco líneas, y seguir editando código para satisfacer sugerencias
sucesivas es un ciclo que no termina.

### Dos correcciones a recetas del repo

1. **La ruta del `review-state.json` estaba mal escrita.** No vive en `.git/gentle-ai/v2/review-<linaje>/` sino
   en **`.git/gentle-ai/review-transactions/v2/review-<linaje>/review-state.json`**. La nota del `BACKLOG`
   («leer el `review-state.json` **entre el cierre y el acuse**») la ubicaba mal, y eso hizo que dos búsquedas
   dieran «no existe» y se concluyera demasiado rápido que el texto se había perdido.
2. **Los linajes sin acuse conservan sus claims.** Hay **seis** directorios vivos en el store
   (`review-134fe0b2e9b4dfa5`, `review-16c7b879f44c6b95`, `review-5ab16f231f1adb49`,
   **`review-6b517157db5f4274`**, `review-6b9e55bc959708a1`, `review-9e769e5f903471c7`) — incluido **el linaje
   atascado** que el `BACKLOG` da por inmutable. Sus textos de hallazgos **siguen siendo legibles**; los de las
   tres compuertas de ayer no, porque el acuse sí los borró (no aparecen en el store).

### Afinado pendiente (pedido del autor, 2026-10-05)

El autor dio la página por buena y pidió **anotar todo** lo que quede para una sesión de pulido. Nada de esto es
un defecto abierto: son los puntos conocidos, y todos se resuelven **en la hoja `/dev/error`** —las tres
superficies comparten el componente, así que el retoque se hace una sola vez y se revisa en la hoja antes de
promoverlo—.

| Punto | Qué falta decidir |
|---|---|
| La regla coral | Llega al borde del **contenido**, no al borde físico de la card. De borde a borde exige márgenes negativos |
| El caso angosto (móvil) | La fila de acciones se apila a ancho completo; el centrado aplica desde `sm` |
| Proporciones del medallón | Hoy `mt-10` / `mt-8`: son dos números si el afinado pide otra relación |
| El diagnóstico de DEV | Conserva el texto del framework **en su idioma**, citado y rotulado. Decisión declarada: si el afinado no lo quiere, se traduce o se quita |
| Instrumento de geometría | La hoja **no** tiene uno. El hero y las cards sí (ancho, alto y separación en píxeles). Para afinar con números, conviene el mismo tipo de sonda por caso |
| Los cuatro hallazgos informativos | Dos WARNING y dos SUGGESTION; quedaron sus **ubicaciones sin su texto**. Releer la línea antes de tratarlos como trabajo |

**Lo que ya no es deuda de afinado**, para no reabrirlo sin motivo: el medallón está centrado, la regla cruza la
card, los botones están centrados y el diagnóstico está en español. Y el **contraste del botón primario en oscuro
(3.73:1)** es un ítem **de tokens**, no de esta página: se ve en `/dev/error?theme=oscuro`, y vive como ítem
propio en este archivo.

### La parte técnica en los mensajes: la regla del autor (2026-10-07)

**Decisión del autor, textual:** los mensajes que ve un usuario **pueden** llevar la parte técnica —el código,
«para poder consultar con otros, algo así como servicio al cliente cuando pide algún código de error»—,
**pero el foco no puede ser la técnica**: «a pesar de tener una parte técnica se debería mostrar info o texto
que un usuario cualquiera pueda entender», con el ejemplo «El dataset no existe, error 404».

**Qué ya lo cumplía, verificado antes de tocar nada:** la **página de error** lo hace desde el 2026-10-05 —
renderiza `ERROR {status}` como rótulo y debajo el encabezado y el cuerpo que arma `failure.ts`. Ahí no había
nada que agregar, y decirlo antes de escribir código evitó duplicar el mecanismo.

**Qué faltaba:** las **alertas dentro de los componentes**, que mostraban el **texto crudo del catálogo**
—`No se pudo publicar el dataset: 502 Bad Gateway`— donde el único dato útil para soporte es el código, y la
frase que lo acompaña tiene que ser nuestra. Cinco sitios en tres componentes: la cola (no carga, y no se pudo
decidir), publicar, pedir y cancelar.

**Cómo quedó:** `technicalCode(err)` en `failure.ts` —**una sola función decide qué código se muestra**, y
devuelve `null` cuando el error no trae estado, en vez de inventar un código que nadie observó—, y las alertas
renderizan la frase humana con el código como **dato secundario** en monoespaciada.

**Y una tensión que queda abierta, porque es una decisión del autor y no mía.** La política de
**indistinguibilidad sin sesión** (decisión suya del 2026-09-20) dice que un espectador anónimo recibe **el
mismo** encabezado y la **misma** oración para un `403` y un `404`, para no filtrar la existencia de un
recurso privado. Pero el rótulo `ERROR {status}` de la página de error muestra el estado **observado**: a un
espectador anónimo **le distingue `403` de `404`** por el rótulo mientras el texto se lo oculta. Es **anterior
a esta unidad** y **no se tocó**. Si el código tiene que seguir la misma regla que el texto —resuelto cuando el
espectador está identificado, **fusionado** cuando es anónimo—, eso cambia la política vigente y lo decide él.
La recomendación es fusionarlo, porque hoy el rótulo deshace lo que el texto hace.

### Entregado (2026-10-07)

**`technicalDetail(err)`** en `failure.ts`, con dos reglas que las pruebas fijan: **no inventa** un estado que
nadie observó, y **no tira** el único dato técnico que existe —cuando el error no trae estado, su propio texto
lo es—. Un estado `0` se nombra como lo que es: «sin respuesta del catálogo».

**Los cinco sitios** que mostraban texto crudo ahora muestran **la frase primero y el dato detrás**: la cola al
no cargar, la cola al no poder decidir, publicar, pedir y cancelar. Las frases son nuestras («No se pudo publicar
el dataset.», «No se pudo enviar la solicitud.»…), en el idioma del usuario, y el dato técnico va en
monoespaciada como dato secundario.

**Verificación**: RED observado (9 fallas: las 4 nuevas de `technicalDetail` y las 5 alertas), después GREEN;
suite **989/989 en 61 archivos**, `pnpm check` 0 errores, `pnpm build` OK, Biome limpio. Y **en la hoja, en el
navegador**, con el fallo de red y la vista de superadministración: aparece `No se pudo publicar el dataset.`
con `error 502` detrás, y **cero** ocurrencias de `502 Bad Gateway` y de la forma vieja con dos puntos.

**Una aserción mía estaba mal y la implementación tenía razón**: había escrito que un `CkanApiError` **sin**
estado devolviera `null`, cuando su texto sigue siendo el único dato que existe. La prueba ahora afirma la
regla —fallback al texto— y reserva el `null` para lo que de verdad no tiene nada que citar.

### Los avisos de la compuerta del delta (2026-10-07)

Los dos se arreglaron, y el primero era un **defecto que introdujo esta misma unidad**:

- **`R3-list-error-falsy` (WARNING) — arreglado.** Al guardar el fallo **tal como se lanzó** —en vez de su
  texto— el estado quedó dependiendo de la verdad del valor: un `throw ""` (o `0`, o `null`) es falsy, así que
  la cola caída **caía a «no hay solicitudes»**. Es exactamente la deshonestidad que el componente dice no
  cometer —«la cola no cargada no se disfraza de cola vacía»—, reintroducida por un cambio de tipo. El fallo se
  guarda **envuelto en un objeto**, que es siempre truthy, y una prueba con un `throw ""` lo fija en RED
  primero.
- **`R3-decide-datum-unasserted` (SUGGESTION) — arreglado.** La prueba del fallo al decidir afirmaba la frase
  pero **no** el dato técnico. Ahora usa un `CkanApiError` con estado y afirma el código (`error 503`), que es
  el caso real de producción; el caso sin estado queda cubierto por las pruebas de `technicalDetail`.

**Lección**: cambiar el **tipo** de un estado cambió su **semántica de verdad**. Un `string | null` usado como
bandera funciona mientras todo lo que se guarde sea no vacío; al pasar a `unknown` la bandera dejó de ser una
bandera. La compuerta lo cazó porque miró el tipo nuevo y preguntó qué valores puede tomar.

### Desviaciones declaradas

1. **Sin RED propio para `statusFor`**: el helper se extrajo de la necesidad de las páginas y su RED fue el de
   ellas. No se inventó una falla previa para simular uno.
2. **El orden de las acciones en el estado de servidor cambia**: antes `[Volver…] [Reintentar]`, ahora
   `[Reintentar] [Volver…]`. Se unifica con el orden que `+error.svelte` ya usaba. Ningún test lo afirmaba.
3. **El diagnóstico de DEV conserva el texto del framework** (`«Not Found»»), citado y rotulado en español. No
   se tradujo el mensaje crudo porque su valor es ser crudo; lo que se tradujo es todo lo que dice el portal.
