# Demo honesta: archivos reales en el seed, chips que no inventan formato y superficies de solicitudes coherentes

> Pedido del autor del 2026-10-18, después de revisar la demo de v0 (`https://demo.odp.hs.lan`, stack de producción).
> Tres correcciones del portal (menú, card de la ficha, chips de la búsqueda) y una del seed (archivos reales), más el
> resembrado de la demo, que hace la sesión de `odp-docker`.

## Specs

- **S1 — «Solicitudes» en el menú de usuario sólo para quien puede pedir o decidir.** Textual: «a los miembros se les
  permite ver la page de las solicitudes pese a no tener permisos de aceptar solicitudes, esto porque en el botón de
  user (panel, solicitudes, logout) se vé esa opción, puede dar malos entendidos, mejor quitarlo, no sé si solo para
  los miembros o también para los editores». Decisión: «Editores y admins (Recomendado) — Quien puede pedir o decidir
  una publicación (editor, admin de la organización, sysadmin). El miembro no la ve: no puede hacer nada ahí. El editor
  la usa para ver en qué estado están sus pedidos.»
- **S2 — La card «Solicitud de publicación» de la ficha, sólo si hay algo pendiente.** Textual: «algunos dataset tienen
  la card de "solicitudes de publicación" y otros no, esto también muestra inconsistencia entre fichas». Decisión:
  «Sólo si hay algo pendiente (Recomendado) — Mientras la solicitud está pendiente o fue rechazada (el dataset sigue
  privado). Un dataset ya aprobado y público no la muestra, para nadie: todas las fichas públicas quedan iguales.»
- **S3 — La card de la búsqueda no inventa formato para un enlace.** Textual: «el set de datos no me temina de gustar,
  porque en el /search dice que son de un tipo, pero al entrar dice que son enlaces, esto parece que mostramos "falsos"
  datos, corregir». Decisión: «Archivos reales + chips honestos (Recomendado) — […] Y el portal: la card de la búsqueda
  muestra «Enlace» para un enlace, como ya hace la ficha (su decisión del 2026-09-22).»
- **S4 — El seed sube archivos reales de cada tipo.** Textual: «Si necesitas crear archivos de estos tipos, como pdf en
  blanco o cosas así hazlo». Decisión: «El seed sube archivos reales generados de cada tipo (CSV, XLSX, PDF, JSON,
  GeoJSON), con su vista previa offline.»
- **S5 — Resembrar la demo.** Decisión: «Sí, resembrar la demo — Cuando los cambios estén en main, odp-docker resetea
  odp-demo (odp-dev no se toca) y corre provisioning + seed».

- **S6 — GeoJSON sin vista previa.** Textual: «no se tenia planeado aceptar el formato geojson, lo abrí por curiosidad y
  tampoco se muestra el archivo, apenas entramos a la ficha del resource se intenta descargar el archivo, mejor
  quitarlo, o al menos quitar eso de descargar automáticamente y poner que no tiene una vista previa».
- **S7 — Gráficos de ejemplo en el seed.** Decisión: «Sí, 2-3 por dataset de demo (Recomendado) — Barras, líneas y
  torta sobre los 4 CSV de DEMOS […], con títulos claros. Aparecen las pestañas y el botón Insertar.»
- **S8 — Sin la card «Este recurso todavía no tiene gráficos».** Textual: «creo que nadie, porque da la impreción de que
  ahí es donde debería ir el gráfico, o al menos cambiar dónde se dice que no hay gráficos para los que puedan crear».

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Menú: «Solicitudes» sólo con capacidad `update_dataset` en alguna organización o sysadmin | S1 | worker (worktree `../odp-portal-fixes`) | — |
| T2 | Ficha: la card sólo con solicitud pendiente o rechazada | S2 | worker (mismo) | — |
| T3 | Búsqueda: un enlace aporta el chip «Enlace», no su formato | S3 | worker (mismo) | — |
| T4 | Seed: generadores deterministas de CSV, XLSX, PDF, JSON y GeoJSON, y todos los recursos del seed como archivos subidos | S4 | worker (rama apilada sobre `feat/demo-seed-pdf`, #94) | — |
| T6 | GeoJSON → «sin vista previa»; cerrar #99 sin mergear | S6 | padre | — |
| T7 | Seed: 2–3 vistas `umss_chart` por CSV de `DEMOS`, idempotentes por título | S7 | worker (worktree `../odp-seed-charts`) | — |
| T8 | Quitar la card de estado vacío de los gráficos | S8 | padre | — |
| T5 | Coordinar con `odp-docker` el reseteo de `odp-demo` y verificar en la demo con navegador | S5 | padre | — |

## Log

- **L1 (2026-10-18, pedido del autor, textual):** «veo un "bug" visual, a los miembros se les permite ver la page de
  las solicitudes pese a no tener permisos de aceptar solicitudes, esto porque en el botón de user (panel, solicitudes,
  logout) se vé esa opción, puede dar malos entendidos, mejor quitarlo, no sé si solo para los miembros o también para
  los editores, no estoy seguro. también comentarte que el set de datos no me temina de gustar, porque en el /search
  dice que son de un tipo, pero al entrar dice que son enlaces, esto parece que mostramos "falsos" datos, corregir. Si
  necesitas crear archivos de estos tipos, como pdf en blanco o cosas así hazlo, también decirte algunos dataset tienen
  la card de "solicitudes de publicación" y otros no, esto también muestra inconsistencia entre fichas.»
- **L2 (2026-10-18, medición del padre y del explorador):** en la demo, 35 de 39 recursos son enlaces
  (`url_type` ausente) a `data.umss.edu.bo`: 8 CSV, 7 GeoJSON, 6 JSON, 7 PDF y 7 XLSX; sólo los 4 CSV de `DEMOS` son
  subidas. `UserMenu.svelte:76-82` muestra «Solicitudes» sin condición. La card de la ficha
  (`dataset/[id]/+page.svelte`, `{#if solicitudVigente}`) depende de las filas que `publication_request_list` le
  devuelve a quien mira, así que varía por organización y no aparece sin sesión. `DatasetCard.svelte:16` usa
  `formatChips`, que lee el `format` de todos los recursos, enlaces incluidos: la regla del 2026-09-22 («un enlace
  muestra "Enlace" y no conserva su formato») no llegó a la card de la búsqueda.
- **L3 (2026-10-18, decisiones del autor):** las cuatro recomendadas, citadas en S1–S5.
- **L4 (2026-10-18, revisión del autor sobre la demo resembrada, textual):** «cosas que se colaron: no se tenia planeado
  aceptar el formato geojson, lo abrí por curiosidad y tampoco se muestra el archivo, apenas entramos a la ficha del
  resource se intenta descargar el archivo, mejor quitarlo, o al menos quitar eso de descargar automáticamente y poner
  que no tiene una vista previa. TODO: el tamaño predeterminado de las vistas previas quisiera tocarlo, ahora mismo estoy
  en una pantalla fhd de 27 pulgadas y el espacio se de la vista previa es pequeño cuando intento ver pdf, lo mismo
  pasaba con imágenes, pero cuando estoy en la pantalla de mi laptop sí que se ve bien el alto, esto creo que solo pasa
  en las pantallas grandes como la de fhd de 27 pulgadas, podríamos solucionarlo? esto no es urgente. TODO para ahora:
  en la prd se menciona la visivilidad de archivos tipo texto creo, pero no era completamente necesario, ahora mismo sí
  se puede ver, como no tenia planeado implementarlo para v0 sería bueno que lo anotaras como resuelto. TODO para ahora:
  los gráficos no se pueden ver en ningún lado, algún dataset los tiene? […] Respecto a lo de la url de la api, funciona
  correctamente, tanto la url como el ejemplo del curl. como estamos listos para la demo quisas sería bueno hacer una
  presentación».
- **L5 (2026-10-18, mediciones):** menú verificado en la demo con CDP: `miembro-fcyt` ve «Panel, Cerrar sesión»;
  `editor-fcyt`, `editor-fcs` y `admin-fcyt` ven además «Solicitudes» (S1 PASS). La build de la demo está al día: sin
  vistas `umss_chart` (0 en la demo, el seed no crea ninguna) no hay pestañas y se ve la card vacía bajo la tabla. El
  GeoJSON se descargaba solo porque la ruta `/catalog/download` lo sirve como `attachment` y Chrome descarga un
  `attachment` dentro de un iframe; #99 (inline) se cerró sin mergear.
- **L6 (2026-10-18, decisiones del autor):** S7 y S8 citados arriba; la presentación (guion actualizado + diapositivas)
  va **después**, textual: «hacerlo ahora quisas haga quedar desincronizado lo que tenemos con lo que presentaremos».

