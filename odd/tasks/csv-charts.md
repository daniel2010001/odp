# Gráficos sobre un CSV: un recorte de RF-24 para la demo

> Primera de las dos **features de valor** que el autor eligió sumar a la demo el 2026-10-16. La segunda es la sección
> para desarrolladores (RF-37/38) y tendrá su propio documento. **Recorte declarado:** se grafica lo que el DataStore de
> CKAN ya tiene cargado, sin tabla normalizada propia ni estadísticas de calidad. El resto de RF-24 sigue en `[v1]`.

## Specs

- **S1 — El pedido (reescrito el 2026-10-17 por L7 y L10).** Original, textual (2026-10-16): *«vamos con ambas, pero
  como dices, empecemos con los gráficos»*. Redefinido por el autor en L7: *«como NO es una cosa que el usuario que ve
  los dataset pueda hacer es mejor tener algo así como una "configuración" ya hecha»*, *«guardar esa config como una
  vista»*, y la consulta la hace la base: *«armando una query con la info de las X-Y y los rangos»*. **El gráfico es una
  vista del recurso que configura quien publica y que el visitante sólo ve.**
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
- **S6 — La arquitectura (decisión del autor, 2026-10-17, textual del rótulo elegido):** *«Plugin de vista + acción
  propia (Recomendado)»*. En `ckanext-umss` (`odp-docker`): un plugin `IResourceView` llamado `umss_chart` y una acción
  `umss_chart_data` que agrupa del lado del servidor. **`datastore_search_sql` sigue apagada.** El visitante sólo
  ejecuta configuraciones que el publicador guardó.
- **S7 — El alcance de la demo (decisión del autor, 2026-10-17, textual del rótulo elegido):** *«Sí, ese alcance
  (Recomendado)»*: X de una columna; texto tal cual (unificar mayúsculas es opcional), números por paso, fechas por
  año, trimestre o mes, y `null` como grupo propio; Y: contar, contar distintos, sumar, promedio, mínimo y máximo;
  barras, líneas y pastel. Pasan a `v1`: varias columnas en X, día de la semana, década y correos por dominio.

## El contrato entre el portal y `ckanext-umss` (versión 1, 2026-10-17)

> Fuente versionada del contrato: este archivo. El `odd/` de `odp-docker` no se versiona, así que esa sesión lo cita
> por ruta. Un cambio de contrato se anota en el Log y sube `version`.

**La configuración de la vista** (`resource_view` con `view_type: "umss_chart"`). Claves planas y escalares, porque
CKAN guarda en `config` sólo lo que el `schema` del plugin declara:

| Clave | Valor | Regla |
|---|---|---|
| `version` | `1` | obligatoria |
| `chart_type` | `bar` · `line` · `pie` | obligatoria |
| `x_field` | id de una columna de la tabla | obligatoria; tiene que existir en los `fields` del DataStore; nunca `_id` (L12) |
| `x_bucket` | `value` · `number_step` · `year` · `quarter` · `month` | **obligatoria, sin valor por defecto** (L12); `number_step` exige una columna `numeric`; `year`/`quarter`/`month`, una `timestamp` |
| `x_step` | número > 0 | obligatoria sólo con `number_step`; prohibida con el resto |
| `x_fold_case` | booleano, por defecto `false` | sólo con `value` sobre una columna `text` |
| `y_agg` | `count` · `count_distinct` · `sum` · `avg` · `min` · `max` | obligatoria |
| `y_field` | id de una columna (nunca `_id`, L12) | prohibida con `count` (cuenta filas); cualquier tipo con `count_distinct`; `numeric` con `sum`/`avg`/`min`/`max` |
| `include_null` | booleano, por defecto `true` | si es `true`, las filas con X nulo forman un grupo propio |

El título y la descripción son los campos propios de la vista (`title`, `description`), no de `config`.

**La acción `umss_chart_data`.** Dos formas de llamarla:
- **Visitante:** `{ "view_id": "<id>" }`. Lee la configuración guardada. Exige poder ver el recurso de la vista (la
  misma autorización que `resource_view_show`).
- **Editor, mientras configura:** `{ "resource_id": "<id>", "config": { … } }`. Exige poder **editar** el recurso
  (`resource_update`). Un visitante sin ese permiso recibe `NotAuthorized` aunque el recurso sea público.

Respuesta:

```json
{
  "version": 1,
  "config": { "…": "la configuración normalizada, con los valores por defecto aplicados" },
  "groups": [ { "key": "2024-Q1", "value": 1530.5 }, { "key": null, "value": 3 } ],
  "truncated": false,
  "total_rows": 12480
}
```

- `key` es crudo y el portal lo rotula: `value` devuelve el valor tal cual (en minúsculas si `x_fold_case`);
  `number_step` devuelve el límite inferior del rango semiabierto `[k, k + x_step)`; `year` → `"2024"`; `quarter` →
  `"2024-Q1"`; `month` → `"2024-01"`; el grupo nulo → `null`.
- Orden: por `key` ascendente, con el nulo al final.
- Topes: como máximo **500 grupos** (`truncated: true` si hubo más) y un **`statement_timeout`** en la consulta.
- `total_rows`: las filas de la tabla, no las que entraron en grupos.
- Errores: una configuración inválida es `ValidationError` con la clave culpable (por ejemplo `{"y_field": ["…"]}`);
  una vista o recurso inexistente es `ObjectNotFound`; sin permiso, `NotAuthorized`; el tope de tiempo vencido es un
  `ValidationError` con la clave `query`.
- **Seguridad:** los nombres de columna se validan contra los `fields` del DataStore y se pasan como identificadores
  con comillas (`psycopg2.sql.Identifier`), nunca concatenados. Los valores van como parámetros. Sólo `date_part`,
  `date_trunc`, `floor`, `lower`, `count`, `sum`, `avg`, `min` y `max` (`lower` sumada en L11, para `x_fold_case`).
- **Precisiones de L11 (sin cambio de formato, sigue `version: 1`):** al **leer**, las claves de la configuración vienen
  en el **nivel superior** de la vista (`view.chart_type`), no bajo `view.config`; al **escribir**, van planas en el
  cuerpo de `resource_view_create`/`update` (un `config` anidado se rechaza). Una clave no declarada da
  `ValidationError` (`__extras`), no se descarta. Familias de tipos: «numérica» es `numeric`, `int2`, `int4`, `int8`,
  `float4`, `float8`; «fecha» es `timestamp`, `timestamptz`, `date`. Claves de error por tipo incompatible: `x_bucket`
  (rangos numéricos o de fecha) e `y_field` (`sum`/`avg`/`min`/`max`). Recurso sin tabla en el DataStore:
  `ObjectNotFound`. Tope de tiempo: 5 s por defecto (`ckanext.umss.chart.timeout_ms`). **Al guardar la vista sólo se
  validan las reglas de forma; las reglas contra el DataStore se validan al ejecutar `umss_chart_data`**, así que el
  formulario del publicador pide la vista previa antes de guardar.

**El puente del portal** (`src/lib/server/ckan-proxy.ts`): hoy no deja pasar estas acciones. Hay que sumar
las cinco acciones a las permitidas, y **ninguna a las de lectura** (`GET`): el cliente las pide todas por `POST`
(corregido en L13 por la verificación independiente; antes este párrafo ponía dos en las de lectura).

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Comparar bibliotecas y que el autor elija — **hecha: LayerChart 2** (L3) | S3 | explore + autor | `7aee9b1` |
| T2 | Playground `/dev/resource-chart` — **hecha** (L5); queda como base del formulario del publicador | S4 | worker | `c6fd2df`, `f852f79` |
| T3 | Revisión del autor — **hecha**: redefinió la feature (L7) y eligió arquitectura y alcance (L10) | S1, S6, S7 | autor | — |
| O1 | **Prueba primero:** plugin `umss_chart` mínimo; crear una vista y leerla de vuelta con la configuración completa — **hecha** (L11) | S6 | sesión `odp-docker` | `odp-docker` `f02dc78` (rama local `feat/csv-charts`) |
| O2 | La acción `umss_chart_data` según el contrato, con tests de las dos formas de llamada y de cada error | S6, S7 | sesión `odp-docker` | — |
| O3 | Verificación independiente de O1 y O2 (toca seguridad) | S6 | sesión `odp-docker` | — |
| P1 | El puente: sumar las acciones del contrato — **hecha**, junto con el contrato en tipos y el cliente (L12) | S6 | worker | `0150e49`, `9486aeb` (puente, commit propio por riesgo) |
| P2 | El formulario del publicador (desde el playground): vista previa con `umss_chart_data` y guardado con `resource_view_create` | S1, S4, S7 | por definir | — |
| P3 | El visitante: la página del recurso muestra las vistas `umss_chart`; borrar el playground | S1, S7 | por definir | — |
| T5 | Sumar la feature al guion de la presentación | S5 | inline | — |
| T6 | Datos para la demo: al menos un CSV real subido y cargado en el DataStore (L4) | S5 | a decidir con el autor | — |

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
- **L10 (2026-10-17, decisiones del autor, textual de los rótulos elegidos):** arquitectura: *«Plugin de vista + acción
  propia (Recomendado)»*; alcance: *«Sí, ese alcance (Recomendado)»*. Y sobre las vistas, textual: «es complicado, las
  vistas que ckan acepta son pocas, si queremos alguna, como "chart_view", tendríamos que crear un plugin para que ckan
  lo reconosca, lo intenté en ese proyceto pero no lo pude conseguir, si quieres puedes comprobar esto, quisas en la
  2.12 es pueda, yo lo prové en la 2.10 hace años.» La regla sigue igual en la 2.12 (L9). Una causa probable del
  fracaso anterior: CKAN descarta en silencio lo que el `schema` del plugin no declara. Por eso **O1 va primero** y
  prueba que la vista se guarda y se lee completa antes de construir encima. **El PR #82 no se mergea:** su lógica fila
  por fila se reemplaza por la agrupación del servidor, y el playground pasa a ser el formulario del publicador.
- **L11 (2026-10-17, O1 cumplida por la sesión de `odp-docker`, `f02dc78`, 5 tests nuevos, 211 en total):**
  `resource_view_create` con `view_type: "umss_chart"` y las 9 claves; `resource_view_show` y `resource_view_list` las
  devuelven todas y tipadas, con los valores por defecto aplicados. **Mi hipótesis sobre la 2.10 no se confirmó en la
  2.12:** una clave no declarada no se descarta en silencio, sino que da `ValidationError` (`__extras`) y no se guarda
  nada. Lo más probable es que en la 2.10 faltara el plugin con ese nombre, o que las claves fueran anidadas. La vista
  la implementa el plugin `umss` que ya existe, así que `ckan.plugins` no cambia. Las precisiones del contrato quedan en
  su sección. Se le pasaron al worker de P1 mientras trabajaba.
- **L12 (2026-10-17, P1 entregada y cinco ambigüedades del contrato que señaló el worker):** el contrato quedó como
  tipos y validador en `src/lib/charts/contract.ts` (46 tests), el cliente en `src/lib/api/charts.ts` (9) y el puente
  con las cinco acciones (`9486aeb`, en su propio commit porque toca una guarda; verificación independiente en curso).
  El padre verificó 93/93, `pnpm check` sin errores y Biome limpio. `pnpm lint` falla en esta máquina porque el
  envoltorio de Biome se cae; el binario directo (`…/@biomejs/cli-linux-x64/biome check .`) da 219 archivos y salida 0.
  Decisiones sobre las ambigüedades:
  1. **`x_bucket` es obligatoria, sin valor por defecto.** Contrato actualizado.
  2. **`_id` no se grafica en ningún eje.** Es la columna que numera CKAN. Contrato actualizado, y el validador lo
     rechaza con mensaje propio (RED observado: sin el cambio, el validador lo aceptaba; GREEN 95/95).
  3. La forma del error (el servidor devuelve un arreglo por clave, el portal un texto) la resuelve un adaptador en P2.
  4. El tope de 500 grupos pasa a una constante del portal en P2.
  5. Una vista con una `version` que el portal no conoce no se dibuja: P3 muestra un aviso, sin migración.
  El rótulo de los rangos numéricos (`[0, 5)` o «0–5») lo decide el autor al revisar P2.
- **L13 (2026-10-17, verificación independiente del puente, `9486aeb`): «aprobar con notas»; las dos se corrigieron.**
  Se verificó que las escrituras de vistas no se alcanzan por `GET` (`405` antes del `fetch`), que las acciones de
  tokens siguen prohibidas y que las de subida no cambiaron. Las dos notas: (1) `umss_chart_data` y
  `resource_view_list` estaban habilitadas por `GET` sin ningún consumidor `GET`. Era permiso de más y el error estaba
  en este contrato: se sacaron de `READ_ACTIONS`, por mínimo privilegio. (2) El invariante se probaba en una sola
  dirección, y la expresión regular del escaneo no veía llamadas con genéricos anidados (`datastore.ts:30`). Se arregló
  la expresión y se agregó la prueba inversa: toda acción permitida la usa el cliente. Hubo RED en las dos (sobraba
  `datastore_search` por el escaneo, y las dos lecturas eran `GET`), y GREEN 270/270 en `src/lib`. **Incidente de
  alcance:** el verificador citó código del plugin en `odp-docker`, así que leyó ese repo sin autorización.
- **L14 (2026-10-17, mensaje del autor, textual):** «respecto a lo que mencionas: 1: no, no pude crear el plugin en el
  2.10 y por eso no podía guardar, no era que faltaba ponerlo en el .env, pero es una buena observación, si agregamos
  una nueva extención deberíamos ponerlo ahí, no? o lo de las nuevas vistas iran junto con el plugin que tenemos? ese
  ckanext-umss? 2: lo de "normalización" de datos croe que deberíamos dejarlo al datapusher/datastore, en el 2.19 que te
  mencioné no usaba el datapusher, sino otro que normalizaba las entradas, como pasar de 1-0/true-false/si-no/etc a
  bool, normalizar fechas a YYYY-MM-DD:HH-MM o el formato que queramos, no recuerdo si era xloader o algo así. 3:
  podemos hacer un csv de prueba? algo útil que pueda servir durante todo el desarrollo o incluso en la demo, esto me
  recuerda a un tema que aun no tocamos y es sobre la ingesta de datos, recuerdo que mencioné que te contaría cómo lo
  hacía, ahora creo que es buen momento para contarte cómo lo hacía mientras haces tus cosas: usaba un generador de uuid
  para crear "palabras", estas palabras las usaba para crear oraciones o párrafos enteros, si era números, fechas u otro
  valor usaba un randomizador, luego creaba fila por fila las entidades y las subia a la db usando una fuction
  modificada que podía cargar cientos de filas a la vez, si quieres puedes buscarlo en el backup de windows, creo que
  era sobre un proyecto de comercio electrónico, no recuerdo del todo, pero usabamos una librería llamada drysle, o algo
  así, es un orm en ts. recuerdo haber hecho muchas cosas son estos generadores, creo que en 30 min cargaba 3M de filas»
  **Respuestas y decisiones:** (1) la vista vive en el plugin `umss` que ya existe, así que `ckan.plugins` no cambia; una
  extensión **nueva** sí tendría que sumarse a `ckan.plugins` (`CKAN__PLUGINS`). (2) Son dos cosas distintas. La
  **normalización de valores** al cargar (booleanos, formato de fechas) es del cargador, y se anota en el `BACKLOG` para
  evaluar después; la **agrupación por rangos** del gráfico (paso, trimestre, nulos) es de la consulta y sigue en
  `umss_chart_data`. (3) **T6 en marcha:** generador determinista + subida de un CSV real desde el seed, en un worker.
  La ingesta masiva (millones de filas, el método del autor con Drizzle) es otro tema y va al `BACKLOG`; no se busca
  ahora en el backup.
- **L15 (2026-10-17, T6: el CSV está y el seed estaba roto en una instalación nueva):** el CSV ya está en el repo
  (`d4597d5`): `scripts/data/planilla-docente-ficticia.csv`, con 2.500 filas y sha256 `186e531d…`. Lo produce un
  generador determinista, y el padre verificó que dos corridas dan el mismo archivo y que los 12 tests de
  `node --test` pasan. El promedio de salario por turno separa bien las barras: mañana 8.496,75, tarde 6.217,84 y
  noche 3.986,38. **La primera carga en el CKAN dev falló:** `package_create` con `private: false` →
  `403 "Publication flow: publication goes through the publication flow"`. La pared de publicación rechaza un
  dataset creado ya público, sea quien sea el que lo pide. **Consecuencia más amplia:** el seed entero estaba roto
  para una instalación nueva, y sus 17 datasets sólo existen porque se crearon antes de la pared. Eso importa para
  desplegar la demo en otra infraestructura. **Corrección en curso:** el seed crea privado y publica por el flujo,
  con solicitud y aprobación. `ckan_admin` es el único miembro de `rectorado`, así que aplica la excepción `c′`.
  Token de la corrida: efímero, creado por la CLI y revocado (la lista da 0 restantes).
