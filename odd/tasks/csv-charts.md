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
| T1 | Comparar dos o tres bibliotecas y que el autor elija | S3 | explore (en segundo plano) + decisión del autor | — |
| T2 | Playground `/dev/resource-chart` con presets (CSV con columnas numéricas, sin columnas numéricas, recurso sin DataStore) | S1, S2, S4 | inline | — |
| T3 | Revisión del autor en el playground, e iteración | S4 | autor | — |
| T4 | Promover a la página del recurso, con tests, y borrar el playground | S1, S2, S4 | inline | — |
| T5 | Sumar la feature al guion de la presentación | S5 | inline | — |

## Riesgos

- **Dependencia nueva** (`Risk` ítem 5): entra al bundle del cliente y tiene que ser segura en SSR.
- **Tipos de columna:** el eje Y necesita columnas numéricas, así que hay que medir qué tipos devuelve
  `datastore_search` por columna antes de diseñar el selector.

## Log

- **L1 (2026-10-16, pedido del autor, textual):** «1: vamos con ambas, pero como dices, empecemos con los gráficos, 2:
  está bien, pasemos a v1, pero anota eso para cuando hagamos la presentación de la demo, quisas preparemos algo así
  como una presentación y sería bueno que lo mencionemos, o qué dices? 3: autoríso a llevarlas a su odd tasks, podemos
  coordinar entre ambas sesiones, hazlo.»
- **L2 (2026-10-16):** T1 delegada a un explorador en segundo plano. La recomendación se le presenta al autor antes de
  escribir código.
