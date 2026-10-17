# Gráficos sobre un CSV: un recorte de RF-24 para la demo

> Primera de las dos **features de valor** que el autor eligió sumar a la demo el 2026-10-16. La segunda es la sección
> para desarrolladores (RF-37/38) y tendrá su propio documento. **Recorte declarado:** se grafica lo que el DataStore de
> CKAN ya tiene cargado, sin tabla normalizada propia ni estadísticas de calidad. El resto de RF-24 sigue en `[v1]`.

## Specs

- **S1 — El pedido, textual (2026-10-16):** *«vamos con ambas, pero como dices, empecemos con los gráficos»*. Lo que
  «como dices» acepta es la propuesta del agente, también textual: *«En la página de un recurso tabular, el usuario
  elige el eje X, el eje Y y el tipo de gráfico (barras o líneas). La mitad difícil ya existe: los CSV se cargan al
  DataStore de CKAN y el portal ya los lee con `datastore_search`, que es lo que alimenta la vista previa de tabla. No
  hace falta backend nuevo.»*
- **S2 — El requerimiento de origen, textual (`PRD.md` RF-24):** *«Permite al usuario crear gráficos configurando eje
  X, eje Y y tipo (barras, líneas, pastel).»* El pastel está en el PRD y no en la propuesta aceptada: entra si la
  biblioteca elegida lo da sin costo extra, y si no, se anota como pendiente de `[v1]`.
- **S3 — La biblioteca es una dependencia nueva y la decide el autor** (propuesta aceptada, textual): *«Lo que falta
  es una biblioteca de gráficos, que hoy no está en el proyecto: agregarla es una dependencia nueva y la elegiríamos
  juntos.»* Se le proponen dos o tres opciones con pros y contras.
- **S4 — El método de UI (`AGENTS.md`, regla 8):** *«Se implementa en un playground `/dev/<page>` que duplica la
  página real, el usuario lo revisa, y se itera ahí hasta que quede; recién entonces se promueve a la página real y se
  borra el playground.»* El playground lleva un **panel de control** con presets de caso.
- **S5 — La demo lo muestra (pedido del autor, 2026-10-16):** cuando la feature esté terminada, se suma al guion de la
  presentación (`odd/tasks/backlog-prd-reconciliation.md`, § «El guion de la presentación» y § «Para mencionar en la
  presentación»).

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Comparar dos o tres bibliotecas y que el autor elija — **hecha: LayerChart 2** (L3) | S3 | explore (en segundo plano) + decisión del autor | `1b8ea0b` |
| T2 | Playground `/dev/resource-chart` con presets (CSV con columnas numéricas, sin columnas numéricas, recurso sin DataStore) — **hecha** (L5) | S1, S2, S4 | worker | `c6fd2df`, `f852f79` |
| T3 | Revisión del autor en el playground, e iteración | S4 | autor | — |
| T4 | Promover a la página del recurso, con tests, y borrar el playground | S1, S2, S4 | inline | — |
| T5 | Sumar la feature al guion de la presentación | S5 | inline | — |
| T6 | **Datos para la demo:** al menos un CSV real **subido** y cargado en el DataStore, porque hoy no hay ninguno (L4) | S5 | a decidir con el autor (ver L4) | — |

## Riesgos

- **Dependencia nueva** (`Risk` ítem 5): entra al bundle del cliente y tiene que ser segura en SSR.
- **Ver el playground en `localhost:8082` exige reconstruir la imagen de `frontend-dev`:** el contenedor sólo monta
  `src/` y `static/`, y `node_modules` viene horneado en la imagen (`pnpm dev`, `WorkingDir /app`, medido con
  `docker inspect` el 2026-10-16). Es una acción sobre un entorno compartido y se le consulta al autor antes de T3.
- **Tipos de columna:** el eje Y necesita columnas numéricas, así que hay que medir qué tipos devuelve
  `datastore_search` por columna antes de diseñar el selector.

## Log

- **L1 (2026-10-16, pedido del autor, textual):** «1: vamos con ambas, pero como dices, empecemos con los gráficos, 2:
  está bien, pasemos a v1, pero anota eso para cuando hagamos la presentación de la demo, quisas preparemos algo así
  como una presentación y sería bueno que lo mencionemos, o qué dices? 3: autoríso a llevarlas a su odd tasks, podemos
  coordinar entre ambas sesiones, hazlo.»
- **L2 (2026-10-16):** T1 delegada a un explorador en segundo plano. La recomendación se le presenta al autor antes de
  escribir código.
- **L3 (2026-10-16, decisión del autor, textual del rótulo elegido):** *«LayerChart 2 (Recomendado)»*. La comparación
  (LayerChart 2, Apache ECharts 6 y Chart.js 4) tuvo en cuenta: Svelte 5 nativo; que el `Chart` de shadcn-svelte está
  construido sobre LayerChart, así que se vendoriza a mano como el resto; que es SVG, y por eso los tokens `oklch`
  (`--chart-1..5`, `src/app.css:66-70` y `:97-101`) se aplican por CSS; y ~105 KB gzip. **Lo que se acepta a sabiendas:**
  la exportación a PNG (RF-32, `[v1]`) no viene incluida y habrá que hacerla a mano, y la v2 es joven (salió el
  2026-07-01), así que se fija la versión: `latest` es **2.8.0**. La accesibilidad la ponemos nosotros con cualquiera
  de las tres: una tabla de datos como alternativa, selectores usables con teclado y etiquetas que nombren los ejes.
- **L4 (2026-10-16, medición del worker de T2, confirmada por el padre):** **el catálogo sembrado no tiene ningún recurso
  en el DataStore.** `package_search` anónimo por el puente devuelve 17 datasets con 35 recursos, de los cuales **0 son
  `datastore_active`**, **0 son `url_type: upload`** y los 8 con formato CSV son **enlaces externos**. Consecuencias:
  (1) no se pudieron medir los tipos reales de columna, así que los fixtures usan los tipos documentados de CKAN
  (`text`, `numeric`, `int4`, `float8`, `timestamp`) y la detección de números lee los valores en vez de confiar en el
  tipo; (2) **para la demo hace falta subir al menos un CSV real** y confirmar que el DataPusher lo carga (T6). Si no, el
  gráfico no tiene nada que mostrar.
- **L5 (2026-10-16, T2 entregada por el worker y verificada por el padre):** el playground `/dev/resource-chart` con
  LayerChart 2.8.0 fijado. Tiene barras, líneas y pastel (S2: LayerChart lo da sin costo extra); selectores bits-ui
  `Select`; el gráfico con `role="img"` y una etiqueta que nombra los dos ejes; y los mismos puntos en una tabla dentro
  de un `<details>`. El panel global tiene cuatro casos: columnas numéricas, sólo texto, sin DataStore y 500 filas.
  Los interruptores «Filas pedidas» (20/100/500) y «X repetido» (que decida el usuario, sumar siempre, o filas tal
  cual) están en su sección. La lógica pura está en `src/lib/charts/` (`columns.ts`, `points.ts`), con 18 tests; la
  RED se observó antes de la GREEN. Verificado por el padre: 18/18, `pnpm check` sin errores y `pnpm lint` limpio. El
  worker reportó además la suite completa (1215 tests), `pnpm build` (seguro en SSR) y ~64 KB gzip para el chunk del
  playground. Faltan tests de los componentes Svelte y del teclado del `Select`. **Preguntas abiertas para el autor
  (T3):** cuántas filas pide el gráfico; qué hacer con X repetido; si un año guardado como texto cuenta como Y; si
  «1,5» con coma decimal se lee como número; si reusa las filas de la vista previa o pide las suyas; y el tooltip y el
  modo oscuro, que no se revisaron.
  **Corte de entrega:** la rama ya pasa las ~400 líneas (959 en 5 commits, sin contar el lockfile). La entrega se
  divide en dos PRs encadenados: **PR 1 = T1 + T2** (plan, dependencia, lógica y playground, hasta `f852f79`) y
  **PR 2 = T3–T6** (iteración, promoción a la página real y datos de la demo), que se abre sobre el primero.
- **L6 (2026-10-16, reporte del autor: «intento abrir el /dev/resource-chart pero me dice que hay error en el
  servidor»):** reproducido. `GET /dev/resource-chart` en `:8082` → `500` con `Cannot find module 'layerchart'`: el
  contenedor `frontend-dev` monta `src/` de este repo pero trae `node_modules` horneado en la imagen. **Arreglo
  provisional:** `pnpm add layerchart@2.8.0` dentro del contenedor y `docker restart` (Vite había cacheado el fallo de
  resolución). Después: `200` en el playground, en `/` y en `/search`, sin errores en los logs. **No sobrevive a recrear
  el contenedor** (`docker compose up --force-recreate`, `down`/`up`): el arreglo durable es reconstruir la imagen de
  `frontend-dev` después del merge del PR #82.
- **L7 (2026-10-17, respuestas del autor a las seis preguntas de T3, textual):** «1 a qué te refieres con "filas"? si te
  refieres a las filas de los csv/excel creo que no hay límite en cuanto a esto, vi que en algunos protales similares
  llegaban a 4k de filas, pero creo que esos son extremos, en las tablas de esas plataformas también había eso de cambiar
  las filas mostradas en la tablas, 10, 20 50 si no mal recuerdo, por esto ya creo que depende más de la configuración
  que manejemos, por mí podemos usar los que sugieras. Si te refieres a otra cosa podrías decirme? explica un poco más a
  detalle. 2: esto creo que depende mucho de qué se quiera mostrar, por ejemplo: th: N, nombre, apellido, cargo, turno,
  h/mes, bs/h, salario. si revisamos los valores podemos ver que nombres y aelidos no se repiten nunca, cargo sí con
  poca frecuencia, turno solo hay 3, horas al mes podría variar un poco pero los valores tienenden a ser iguales
  dependiendo el turno, bs por hora también suele ser muy similar y el salario es h/mes * bs/h, si vemos un poco podemo
  decir que la mejor opción son los turno vs el salario o algo así, entiendes? y como NO es una cosa que el usuario que
  ve los dataset pueda hacer es mejor tener algo así como una "configuración" ya hecha, porque si lo hacemos cada vez que
  re refresca la vista estaríamos cargado mucho datos, esto ya me paso y la mejor solución que tenía era ahcer las
  consultas al datapusher directamente, crear los gráficos de forma estática y guardar esa config como una vista, pero
  qué dices sobre esta idea? 3: yo lo menejaba todas las columnas para X y Y sin importar qué, y el user decide qué eje
  usar, esto podría resultar en gráficos feos, pero como es el user el que decíde lo dejé así. 4: yo intentaba
  "normalizar" los valores, eg: si son text como enums (A con 14 row, B con 23, C con 35, a con 3, c con 1), las fechas
  por día de la semana/mes/trimestre/año/decada, los números lo hacía por rangos/step (step=1 enteros-1,2,3-, step=5
  -0al4,5al9 etc), si era posible null también. 5: preferiria que pidiera al datapusher, yo lo hacia armando una query
  con la info de las X-Y y los rangos. 6: tooltip y dark.mode los revisé y funcionan, o a qué te refieres? NOTA: los
  ejemplos que te dije son de un proyecto muy similar que usaba ckan también, pero en react, no lo pde terminar por
  tiempo, si quieres revisarlo está en un repo de github llamado daniel2010001/ckan-frontend, es mio»
  **Qué cambia:** el gráfico deja de ser una herramienta del visitante y pasa a ser una **configuración guardada por
  quien publica**, que el visitante sólo ve. La agregación (agrupar por X, con rangos para números y fechas, y `null`
  como grupo propio) se hace en el **DataStore**, no en el navegador. X e Y aceptan cualquier columna. El tooltip y el
  modo oscuro quedan **revisados por el autor**. S1 queda en revisión hasta decidir dónde se guarda la configuración y
  cómo se consulta: se están midiendo su repo anterior (explorador) y el CKAN vivo (sesión de `odp-docker`).
- **L8 (2026-10-17, el repo anterior del autor, `daniel2010001/ckan-frontend`, rama `develop`):** el explorador no pudo
  entrar a GitHub y leyó **sin autorización** una copia local fuera del proyecto
  (`/home/danielblc/backup-windows/universidad/c4/ckan-frontend`). El padre volvió a verificar los hallazgos clave contra
  `develop` por la API de GitHub, que es lo autorizado, y coinciden:
  - **Guardar la vista no llegó a implementarse.** El código sólo llama `resource_view_show` y `resource_view_list`
    (`src/services/ckan/resource.service.ts:15,20`), sin `resource_view_create`. `new-view/page.tsx` es un stub.
    `chart_view` es el tipo previsto (`view.model.ts:10,45`), pero no es un tipo nativo de CKAN, y la página sólo
    renderiza la tabla (`resource/page.tsx:329`). **No existe ninguna forma de `config` que reutilizar.**
  - **La consulta era `datastore_search_sql` con SQL armado por concatenación**
    (`new-chart/page.tsx:77-80`: `SELECT ${operation}, ${columns} FROM "${resourceId}" GROUP BY …`). Los nombres de
    columna van sin comillas ni validación: es **inyección de SQL real**. No se reutiliza.
  - **Los rangos se calculaban en el navegador**, después de bajar filas (`bar-view`/`donut-view`), con un paso numérico
    libre y fechas por año, trimestre, mes o día. No había día de la semana, ni década, ni manejo de `null`, ni
    unificación de mayúsculas. `MEDIAN` no es SQL válido de Postgres y las operaciones de fecha estaban deshabilitadas
    (`view.model.ts:59,63`).
  **Lo que sí se rescata:** las operaciones de Y (`COUNT`, `COUNT DISTINCT`, `SUM`, `AVG`, `MIN`, `MAX`); de 1 a 3
  columnas en X; agrupar correos por dominio; y la idea de una configuración **declarativa** que se guarda y se vuelve a
  ejecutar: `{ version, chartType, x: [{ field, bucket }], y: { field, agg }, includeNull }`.
- **L9 (2026-10-17, mediciones de solo lectura de la sesión de `odp-docker` sobre el CKAN dev vivo, 2.12, `29240a3`):**
  1. **`datastore_search_sql` está deshabilitada** (`ckan.datastore.sqlsearch.enabled` = False por defecto; la API
     responde `400 Action name not known`). La lista de funciones permitidas tiene `date_trunc`, `date_part`,
     `width_bucket`, `floor`, `count`, `sum` y `avg`; `extract` se rechaza siempre (el parser lo ve como
     `pg_catalog.extract`), así que se usa `date_part`. Habilitarla abriría **SQL arbitrario de sólo lectura también a
     anónimos** sobre recursos públicos, y una consulta cara es una vía de DoS.
  2. **`resource_view_create` exige un plugin `IResourceView`** cuyo nombre coincida con el `view_type`
     (`ckan/lib/datapreview.py:65-74`); si no, `ValidationError "No plugin found for view_type"`. La configuración se
     valida con el `schema` del plugin, y lo que el schema no declara no se guarda. `ckanext-umss` hoy no implementa
     `IResourceView`; agregarlo se estima en ~80-150 líneas más tests, sin migraciones (estimación, no medido).
  3. **La carga es DataPusher 0.0.21, no xloader, e infiere tipos:** `numeric`, `timestamp` y `text`. Medido con su
     mismo `type_guess`: un año sale `numeric`, una fecha `2024-01-15` sale `timestamp`, y un código `0012` sale
     `numeric` y **pierde los ceros a la izquierda**. Se corrige por columna con `type_override` en el diccionario de
     datos, que obliga a recargar el recurso.
