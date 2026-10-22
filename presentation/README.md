# Presentación de la demostración (v0.1.1)

Una sola fuente, **`demo.md`** (Markdown de [Marp](https://marp.app)), produce:

- las **diapositivas HTML** para el proyector (sin los apéndices), y
- un **PDF** que sirve de *chuleta*: las diapositivas, los apéndices (A «Antes de presentar», B «Material de apoyo» y C «Capturas de página completa») y las notas del presentador (el guion de cada
  diapositiva, escrito como comentarios HTML) como anotaciones del PDF.

El tema es `theme.css`: copia los valores de `src/app.css` y del sistema de diseño (cada valor nombra su token). Si un
token cambia en `src/app.css`, se actualiza a mano en el tema.

Marp **no** es una dependencia del proyecto: se ejecuta con `pnpm dlx` y no toca `package.json`. Las salidas van a
`dist/`, que está en `.gitignore`.

Todos los comandos se corren **desde `presentation/`**. Para el PDF hace falta un Chromium
(`CHROME_PATH=/usr/bin/chromium`). Las fuentes (EB Garamond, Poppins, JetBrains Mono) se descargan de Google Fonts al
renderizar el PDF y al abrir el HTML: con red lo ve igual que la aplicación; sin red cae a tipografías del sistema.

## HTML para el proyector

Los apéndices se cortan con la marca `[//]: # (apendice)` de `demo.md`: todo lo que sigue a esa línea (incluidas las capturas de página completa) es sólo para el PDF.

```sh
sed '/^\[\/\/\]: # (apendice)$/,$d' demo.md \
  | pnpm dlx @marp-team/marp-cli --theme theme.css --html -o dist/demo.html -
cp -r img dist/
```

La segunda línea copia las capturas junto al HTML (las diapositivas las citan como `img/…`).

Abra `dist/demo.html` en el navegador. Las teclas de flecha pasan de diapositiva; `f` pone pantalla completa.

## Modo presentador

Con las notas visibles en una ventana aparte y las diapositivas en el proyector. Un servidor de vista previa **temporal**
(apáguelo con `Ctrl+C` al terminar):

```sh
sed '/^\[\/\/\]: # (apendice)$/,$d' demo.md > /tmp/demo-charla.md
pnpm dlx @marp-team/marp-cli --theme theme.css --html --server /tmp
```

Abra `http://localhost:8080/demo-charla.md`, pulse `p` para la vista del presentador y arrastre la otra ventana al
monitor del portátil. Alternativa sin servidor: abra `dist/demo.html` y pulse `p` en el navegador.

## PDF (chuleta)

```sh
CHROME_PATH=/usr/bin/chromium pnpm dlx @marp-team/marp-cli --theme theme.css --html \
  --allow-local-files --pdf --pdf-notes --pdf-outlines demo.md -o dist/demo.pdf
```

Incluye los apéndices (`--allow-local-files` deja que Chromium lea las capturas de `img/`). Las notas quedan como anotaciones (iconito) de cada página; para **imprimirlas** o leerlas todas
seguidas, exporte el guion como texto:

```sh
pnpm dlx @marp-team/marp-cli --theme theme.css --html --notes demo.md -o dist/notas.txt
```

## Capturas de la demostración

Las imágenes de `img/` salen de la demostración en marcha (`https://demo.odp.hs.lan`, datos ficticios) con
`capture/capture.mjs`, un script de Node (sin dependencias: usa `fetch` y `WebSocket` de Node 22 o posterior y el protocolo
DevTools de `/usr/bin/chromium`; `CHROME_PATH` cambia el binario). Hay dos clases, ambas con ventana de 1440×900, tema claro y
`prefers-reduced-motion` activado:

- **Capturas de foco** (`d<N>-….png`): el área relevante de una página, recortada a un elemento con 16 px de aire a DPR 2. Van
  **dentro** de la diapositiva «Demo N» correspondiente.
- **Capturas de página completa** (`d<N>-…-completa.png`): toda la página desplazable. Van en el **apéndice C**, al final de
  `demo.md`, una por diapositiva: sólo aparecen en el PDF. Si una pasa de 1,5 MB, el script la repite a DPR 1.

La lista de capturas (`SHOTS`, al inicio del script) declara por cada una: archivo, ruta, clase, elemento de foco, acciones
previas (clics en pestañas, desplazamientos) y, si la página exige sesión, el usuario (`as`). El script espera a la red en
reposo y al contenido propio de la página antes de capturar, e inicia sesión por el formulario del portal (`/auth/login`).
**Ninguna captura envía un formulario** ni decide nada: no modifican datos de la demostración.

```sh
# desde presentation/ — necesita acceso de red a la demostración (hs.lan) y Chromium
node capture/capture.mjs --only-public     # sólo las páginas públicas; no pide credenciales

# con sesión (lo corre quien tiene las credenciales; las lee del entorno y no las escribe ni las imprime)
DEMO_EDITOR_USER=… DEMO_EDITOR_PASSWORD=… \
DEMO_ADMIN_USER=…  DEMO_ADMIN_PASSWORD=…  \
  node capture/capture.mjs
```

| Opción | Efecto |
|---|---|
| `--only-public` | omite las capturas con sesión |
| `--out <dir>` | carpeta de salida (por omisión `presentation/img/`) |
| `--only <id,id>` | sólo esas capturas (nombre de archivo sin `.png`) |
| `--base <url>` | otra instancia (por omisión `https://demo.odp.hs.lan`) |

Si faltan las variables de un usuario, el script lo avisa, omite sus capturas y termina con código distinto de cero. El
certificado de la demostración es autofirmado: Chromium se lanza con `--ignore-certificate-errors`.

**Capturas con sesión** (las genera quien tenga las credenciales de la demostración; el resto ya está en `img/`):
`d6-crear-recursos`, `d6-crear-completa`, `d7-solicitud`, `d7-ficha-completa`, `d8-cola`, `d8-decidir`,
`d8-cola-completa`. `demo.md` ya las cita: hasta que existan, esas imágenes salen vacías. Corra el script **una vez** con las
credenciales, vuelva a generar las diapositivas y revise que cada diapositiva siga entrando.

Los datos de la demostración cambian (por ejemplo, la cola de solicitudes): si una captura queda desactualizada, se corre de
nuevo y se reemplaza el archivo.

## Documentos para entregar

Dos documentos en tamaño carta para imprimir y dejar a los asistentes: la **ficha resumen** (una página) y el **documento del proyecto**
(cuatro a seis páginas). Están en carta (`@page` de `handout.css`) porque es el papel que se usa; en A4 impreso sobre carta
se pierde el pie de página. Las fuentes están en `handouts/`: `ficha.md`, `proyecto.md` y la hoja de estilo `handout.css`, que
reutiliza los valores visuales de `theme.css`. Como las diapositivas, no agregan dependencias: `build.sh` usa `pnpm dlx`
(`marked` para el HTML, `qrcode` para los códigos QR en SVG) y el Chromium del sistema para imprimir a PDF.

```sh
handouts/build.sh
```

Salen en `dist/` (ignorado por git): `ficha-resumen.pdf` y `documento-proyecto.pdf`. El script imprime el número de páginas
de cada uno (con `pdfinfo`); la ficha debe quedar en **1** y el documento del proyecto entre **4 y 6**. Como las
diapositivas, necesita red para las tipografías de Google Fonts y para `pnpm dlx`; `CHROME_PATH` cambia el Chromium.

El bloque **«Autoría y contacto»** está al final de `ficha.md` y de `proyecto.md`; si cambia, se edita en los dos. La
dirección de la demostración
(`https://demo.odp.hs.lan`) sólo responde desde la red donde está instalada; el código QR la lleva impresa junto a ese aviso.
Si cambia la dirección, se actualiza en `build.sh` (el QR) y en el bloque final de ambos fuentes.
