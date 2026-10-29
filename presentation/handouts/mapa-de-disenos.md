# Mapa de diseños y prototipo · presentación del 29

**Lienzo** (en la laptop, sin internet): `http://127.0.0.1:34495/Vp8zjEPsm5OuGbhcDg3LqEukXH1e9riT/d/<diseño>/` — `inicio`, `busqueda`,
`organizacion`, `prototipo`. **Plan B sin lienzo:** abrir `file:///home/danielblc/projects/odp/design/index.html`.
**Con internet:** `https://daniel2010001.github.io/odp/`. **Portal:** `http://localhost:8082` (modo prototipo activado).

Primero se ve el **sistema de diseño** (`system.html`): colores, tipografías y componentes, los mismos tokens del portal.

## Prototipo: las pantallas de las tres historias · `prototipo` (22)

| Pantalla | Estado | Qué muestra |
|---|---|---|
| H1-1 · Alta de usuario | maqueta | la administración de usuarios con el formulario de alta abierto; el administrador invita a la persona… |
| H1-2 · Inicio de sesión | construida | el inicio de sesión real, con la cuenta institucional; sin sesión |
| H1-3 · Panel | construida | el panel del editor de la FCyT con sesión: sus acciones (crear dataset, revisar solicitudes, mis… |
| H1-4 · Nuevo dataset | construida | el formulario real de nuevo dataset, con la sesión del editor: descripción, etiquetas, licencia y… |
| H1-5 · Ficha con «Solicitar publicación» | construida | la ficha de un borrador privado de la FCyT («Asistencia a laboratorios de física básica por semestre»… |
| H1-6 · Solicitudes de publicación | construida | la cola de solicitudes del administrador de la FCyT, con una solicitud pendiente («Proyectos de… |
| H1-7 · Ficha pública | construida | la misma ficha de H1-5 sin sesión, como la ve cualquiera: se descarga y se consume por API, sin «Editar»… |
| H2-2 · Organizaciones | construida | la propuesta elegida, ya en /organizations, con datos reales: buscador y filtro por tipo con su cantidad… |
| H2-3 · Búsqueda «matrícula» | construida | la búsqueda real del catálogo, con filtros por organización, formato, etiqueta y licencia; encuentra… |
| H2-3b · Búsqueda sin resultados | construida | la búsqueda real cuando nada coincide («calendario académico 1998»): en vez de una página vacía, ofrece… |
| H2-4 · Ficha del dataset | construida | la ficha real de «Matrícula estudiantil por carrera y gestión», con recursos, metadatos y licencia; sólo… |
| H2-5 · Recurso CSV: tabla y gráficos | construida | el recurso CSV de «Matrícula por facultad y gestión ficticia», otro resultado de la misma búsqueda (el… |
| H2-5b · Recurso CSV: gráfico por facultad | construida | la pestaña «Matrícula por facultad (2015–2025)» del mismo recurso, un gráfico de barras guardado como… |
| H2-5c · Recurso CSV: gráfico por gestión | construida | la pestaña «Matrícula por gestión», la evolución de los inscritos de 2015 a 2025 en un gráfico de… |
| H2-5d · Recurso CSV: gráfico por modalidad | construida | la pestaña «Matrícula por modalidad», un gráfico circular; en el prototipo cada pestaña es su propio… |
| H2-5e · Recurso PDF | construida | el segundo recurso de «Matrícula por facultad y gestión ficticia», un PDF alojado en el portal (informe… |
| H2-6b · Colecciones (menú principal) | maqueta | la lista pública de colecciones que se abre desde el menú principal, sin filtro de visibilidad; las… |
| H2-7 · Colección de una persona | maqueta | la vista pública de una colección curada por una persona, que reúne datasets de varias organizaciones… |
| H2-2b · Ficha de organización | construida | la ficha real de la Dirección de Investigación con sus datasets; sólo la sección «Colecciones que cura»… |
| H3-1 · Mis colecciones | maqueta | la lista de colecciones propias en el panel, con filtros de visibilidad y de curador; el panel existe… |
| H3-2 · Colección, vista del curador | maqueta | la colección de rendición de cuentas 2025 mientras se prepara, privada, con el tablero de aprobaciones… |
| H3-3 · Colección pública: rendición de cuentas 2025 | maqueta | la colección del Rectorado como la verá cualquiera una vez que las unidades dueñas aprueben, sin el… |

## Inicio (H2-1): direcciones de diseño · `inicio` (6)

| Dirección | Qué muestra |
|---|---|
| 01 Buscador con ficha de ejemplo | Explica el producto mostrando un conjunto de datos real anotado junto al buscador; la portada queda más densa y la… |
| 02 Índice editorial | Máxima credibilidad institucional: cuenta el proceso de publicación y presenta unidades, temas y colecciones como un… |
| 03 Tres puertas de entrada | La ruta más rápida: búsqueda con alcance y tres accesos (unidad, tema, colección) arriba del pliegue; la explicación de… |
| 04 Síntesis: puerta formal | Reúne lo que gustó de 01–03: la banda azul de 03 con su pregunta y búsqueda por alcance, vuelta formal con la regla, la… |
| 05 Tipos de documento al frente (elegida) | Dirección elegida (L16), segunda iteración de 04 |
| 06 Índice y enlaces por sección | Tercera iteración de 05 (S31), con las mismas secciones y el mismo orden |

## Búsqueda (H2-3): direcciones del encabezado · `busqueda` (4)

| Dirección | Qué muestra |
|---|---|
| 01 Banda compacta | La más continua con Inicio 05: la misma banda azul, la misma línea de cifras y la misma tarjeta con el selector de… |
| 02 La consulta como título | Resultados primero: sin banda, la búsqueda es el título y el resumen dice cuántos y de qué unidades; el alcance pasa a… |
| 03 Tarjeta sobre la banda | Lleva la tarjeta de Inicio 05 entera, con sus tipos de documento convertidos en atajos con lo que hay de cada uno para… |
| 04 Síntesis: la consulta en la banda | Reúne lo que se eligió de cada una: la banda de Inicio 05 (01), «matrícula» como título con el resumen de qué encontró… |

## Ficha de organización (H2-2b): direcciones · `organizacion` (14)

| Dirección | Qué muestra |
|---|---|
| 01 Ficha con panel | La estructura de la ficha del dataset: columna principal (acerca de, colecciones que cura, datasets con búsqueda y… |
| 01b Ficha con panel — sin publicaciones | La misma ficha con 0 datasets y 0 colecciones: la identidad, los datos de la unidad, los miembros y la actividad siguen… |
| 02 Portada con pestañas (para la presentación) | Una banda azul con la identidad y cuatro cifras, y pestañas (Resumen, Datasets, Colecciones, Miembros, Actividad) |
| 02b Portada con pestañas — sin publicaciones | La misma portada vacía: la banda cambia las cifras por «Nueva en el catálogo», el resumen abre con el aviso y su… |
| 03 Dossier con índice | Una sola página por capítulos numerados, con un índice fijo a la izquierda: presentación, lugar en la universidad… |
| 03b Dossier con índice — sin publicaciones | El mismo dossier vacío: los capítulos de publicaciones se funden en uno («Publicaciones») que dice qué traerá cada… |
| 04 Síntesis | Itera con las preferencias del autor (S29): la banda azul con cifras de 02; las tres secciones de la izquierda de 01… |
| 04b Síntesis — sin publicaciones | La misma síntesis con 0 datasets y 0 colecciones: la banda cambia las cifras por «Nueva en el catálogo» (02b); arriba… |
| 05 Portada con índice | 02 casi intacta (S38: «la 2 es la más madura»): la misma banda con sus cuatro cifras, la tabla de datos de la unidad… |
| 05b Portada con índice — sin publicaciones | 02b casi intacta: la banda con «Nueva en el catálogo» (sin cifras), el aviso con «Iniciar sesión para publicar», acerca… |
| 06 Cifras como índice | Otra respuesta a la misma observación: en vez de cifras en la banda y además un índice, las cifras son el índice |
| 06b Cifras como índice — sin publicaciones | 06 sin datasets ni colecciones: la banda conserva los datos de la unidad («Última publicación: todavía ninguna») y la… |
| 07 Cifras como índice, fijo | 06 iterada con S40 |
| 07b Cifras como índice, fijo — sin publicaciones | 07 sin datasets ni colecciones: la misma banda liviana y la fila de cifras de 06b, sin ceros («Publicaciones — todavía… |

**Estado hoy:** Inicio → la **05** es la elegida. Búsqueda → **04** revisada. Ficha de organización → la **02** para
presentar; la 06 y la 07 son las iteraciones en curso. En el prototipo, «Construida hoy» = página real capturada;
«Diseño para después» = maqueta.
