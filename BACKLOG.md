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

## Próxima sesión (2026-09-17) — replanificar el ciclo de vida de publicación

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
> - **No reiniciar `odp-dev-ckan-dev-1`** sin reconstruir la imagen: el script horneado deja el token del
>   datapusher vacío y el contenedor entra en crash loop. **Ya está arreglado y reconstruido** — el aviso
>   queda solo para el caso de tocar ese archivo.
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
`ckanext/umss/tests/test_plugin.py:57` llama `plugin_loaded("umss")` sin declararlo como fixture.
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
- [ ] **[v0] «Mis datasets» está roto para todo usuario que no sea sysadmin** — **medido
  (2026-09-13)**: `current_package_list_with_resources` arma la respuesta con
  `"include_private": authz.is_sysadmin(user)` (`get.py:143`), así que un usuario normal recibe
  **cero** datasets privados, **ni los propios**. El seed de dev lo enmascara porque su usuario es
  sysadmin, y por eso nadie lo había visto. Decidido (D3 del cambio
  `2026-09-13-publication-lifecycle`) **arreglarlo aparte, como corrección propia**. Verificar de paso
  si el mismo problema afecta a «Mis organizaciones». _Origen: sondas de ese cambio._

- [ ] **[v0] Normalizar la card de metadatos del dataset según la de recurso** — el usuario prefiere
  la card de metadatos de la **página de recurso** (`resource/[resourceId]/+page.svelte`: rótulo
  `text-destructive`, tabla de campos con jerarquía, `Card` con `p-6 sm:p-8`) y quiere llevar algo
  similar a la del **dataset**, conservando el detalle que agrega valor a la card. Revisar ambos
  antes de normalizar. _Origen: revisión de UI del dashboard (2026-09-12)._

- [ ] **[v0] Endurecer la vista previa CSV (hallazgos de revisión)** — 4 hallazgos informativos
  no bloqueantes de la revisión de la vista previa (lineage `review-ca9abb1187a39513`, lente
  reliability). Sólo el primero es sustantivo:
  1. `R3-stale-search-race` (WARNING): `ResourcePreview.svelte` puede resolver un
     `datastore_search` viejo después de uno nuevo si el recurso cambia rápido (carrera de
     estados → filas de un recurso distinto).
  2. `R3-cellvalue-object-stringify`: `DataPreviewTable` hace `String(obj)` → `"[object Object]"`.
  3. `R3-limit-prop-unenforced`: prop `limit` aceptada pero sin uso.
  4. `R3-loading-state-untested`: estado de carga sin test.

- [ ] **[v0] Quitar los tabs simulados «Gráfico»/«Mapa» de la página del recurso** — hoy la página
  muestra un selector Tabla/Gráfico/Mapa donde sólo Tabla es real (CSV). Según el modelo de vistas
  (PRD §3, 2026-09-13), los gráficos pertenecen al Módulo de Análisis, no a la vista previa. La vista
  previa debe ofrecer sólo el render que permite el `format` (tabla para CSV, embed para PDF, imagen,
  texto). _Origen: decisión de arquitectura 2026-09-13._

- [ ] **[v0] Sección "Data API" para recursos CSV** — la sección "Acceso por API" de la página
  de recurso hoy está gateada a `resource_type === "api"` (oculta para archivos). Lo correcto,
  como data.gov.au y otros portales CKAN: mostrar una "Data API" con `datastore_search` para
  recursos tabulares (CSV) en el DataStore, en lugar de un `resource_show`. Diferido durante la
  revisión de la UI de recurso (2026-09-11). _Origen: observación del usuario + verificación.

- [ ] **[v0] Habilitar colaboradores por dataset** — `ckan.auth.allow_dataset_collaborators` no
  está en `.env.example`. La funcionalidad es nativa desde CKAN 2.9 pero está apagada, así que
  el modelo de permisos por dataset (RF-18) no funciona hoy. _Referencias: PRD RF-18, PRD §7._

## v1 — producto usable en producción

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

- [ ] **[v1] Token en cookie httpOnly + nginx (endurecimiento)** — hoy el JWT vive en
  `localStorage` (vulnerable a XSS). Patrón más seguro: guardar el API token en una cookie
  httpOnly/secure/samesite y que el reverse proxy la convierta en header `Authorization`
  (`proxy_set_header 'Authorization' $cookie_<nombre>`). Combinar con
  `ckan.auth.disable_cookie_auth_in_api = true`.

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

## v2+ — mejoras futuras no solicitadas

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

---

## Historial de cierre (trazabilidad corta)

Ítems cerrados recientemente que solían aparecer como pendientes (para no re-buscarlos):

| Ítem | Cómo se cerró |
|---|---|
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

- [ ] **[v1] La barra pegajosa no tiene test automatizado** — su comportamiento (aparición a 88 px,
  `inert` mientras está oculta, clics que atraviesan la franja transparente) se verificó **a mano en
  Chromium por CDP**, no en la suite: jsdom no implementa `inert` ni `IntersectionObserver`. Si el
  layout del encabezado cambia de alto (`h-20`), `STICKY_TOP_PX` queda desincronizado y **nada lo
  detecta**. Opciones: un test de navegador real (playwright/puppeteer, hoy no instalados) o mover el
  offset a una variable CSS compartida con el layout para que no pueda derivar. _Origen: revisión RDD
  `review-1c90076e8986652c`, hallazgo advisory `R3-001` (el texto no se pudo recuperar: el ledger se
  borra al cerrar la línea), 2026-09-12._

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
