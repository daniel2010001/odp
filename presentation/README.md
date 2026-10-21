# Presentación de la demostración (v0.1.1)

Una sola fuente, **`demo.md`** (Markdown de [Marp](https://marp.app)), produce:

- las **diapositivas HTML** para el proyector (sin el apéndice «Antes de presentar»), y
- un **PDF** que sirve de *chuleta*: las diapositivas, el apéndice y las notas del presentador (el guion de cada
  diapositiva, escrito como comentarios HTML) como anotaciones del PDF.

El tema es `theme.css`: copia los valores de `src/app.css` y del sistema de diseño (cada valor nombra su token). Si un
token cambia en `src/app.css`, se actualiza a mano en el tema.

Marp **no** es una dependencia del proyecto: se ejecuta con `pnpm dlx` y no toca `package.json`. Las salidas van a
`dist/`, que está en `.gitignore`.

Todos los comandos se corren **desde `presentation/`**. Para el PDF hace falta un Chromium
(`CHROME_PATH=/usr/bin/chromium`). Las fuentes (EB Garamond, Poppins, JetBrains Mono) se descargan de Google Fonts al
renderizar el PDF y al abrir el HTML: con red lo ve igual que la aplicación; sin red cae a tipografías del sistema.

## HTML para el proyector

El apéndice se corta con la marca `[//]: # (apendice)` de `demo.md`: todo lo que sigue a esa línea es sólo para el PDF.

```sh
sed '/^\[\/\/\]: # (apendice)$/,$d' demo.md \
  | pnpm dlx @marp-team/marp-cli --theme theme.css --html -o dist/demo.html -
```

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
  --pdf --pdf-notes --pdf-outlines demo.md -o dist/demo.pdf
```

Incluye el apéndice. Las notas quedan como anotaciones (iconito) de cada página; para **imprimirlas** o leerlas todas
seguidas, exporte el guion como texto:

```sh
pnpm dlx @marp-team/marp-cli --theme theme.css --html --notes demo.md -o dist/notas.txt
```

## Capturas pendientes

Cada recuadro «CAPTURA PENDIENTE» es un `<div class="captura">…</div>` en `demo.md`. Cuando la interfaz esté terminada,
sustitúyalo por `![h:260](capturas/<nombre>.png)` (la carpeta `capturas/` se crea entonces; en el PDF añada
`--allow-local-files`).

## Documentos para entregar

Dos documentos A4 para imprimir y dejar a los asistentes: la **ficha resumen** (una página) y el **documento del proyecto**
(cuatro a seis páginas). Las fuentes están en `handouts/`: `ficha.md`, `proyecto.md` y la hoja de estilo `handout.css`, que
reutiliza los valores visuales de `theme.css`. Como las diapositivas, no agregan dependencias: `build.sh` usa `pnpm dlx`
(`marked` para el HTML, `qrcode` para los códigos QR en SVG) y el Chromium del sistema para imprimir a PDF.

```sh
handouts/build.sh
```

Salen en `dist/` (ignorado por git): `ficha-resumen.pdf` y `documento-proyecto.pdf`. El script imprime el número de páginas
de cada uno (con `pdfinfo`); la ficha debe quedar en **1** y el documento del proyecto entre **4 y 6**. Como las
diapositivas, necesita red para las tipografías de Google Fonts y para `pnpm dlx`; `CHROME_PATH` cambia el Chromium.

Queda por completar, antes de imprimir, el bloque **«Autoría y contacto»** (nombre, cargo y correo,
marcados con «— completar») al final de `ficha.md` y de `proyecto.md`. La dirección de la demostración
(`https://demo.odp.hs.lan`) sólo responde desde la red donde está instalada; el código QR la lleva impresa junto a ese aviso.
Si cambia la dirección, se actualiza en `build.sh` (el QR) y en el bloque final de ambos fuentes.
