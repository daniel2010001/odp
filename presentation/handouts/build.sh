#!/usr/bin/env bash
# Genera los dos documentos para entregar (ficha y documento del proyecto) en ../dist/.
# Uso: desde presentation/handouts/ → ./build.sh   (o bash presentation/handouts/build.sh desde cualquier carpeta)
# Requiere: pnpm, Chromium (CHROME_PATH, por omisión /usr/bin/chromium) y red (herramientas con pnpm dlx y Google Fonts).
set -euo pipefail

aqui="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dist="$aqui/../dist"
chrome="${CHROME_PATH:-/usr/bin/chromium}"
demo_url="https://demo.odp.hs.lan"
repo_url="https://github.com/daniel2010001/odp"
mkdir -p "$dist"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Código QR como SVG (en línea, sin imágenes externas)
qr() {
	pnpm dlx qrcode --type svg --margin 0 --output "$tmp/$1.svg" "$2" >/dev/null
	# Sin cabecera XML: el SVG va dentro del HTML
	sed -e 's/<?xml[^>]*?>//' "$tmp/$1.svg" | tr -d '\n'
}
qr_demo="$(qr demo "$demo_url")"
qr_repo="$(qr repo "$repo_url")"

# render <fuente.md> <clase del body> <título> <salida.pdf>
render() {
	local fuente="$1" clase="$2" titulo="$3" salida="$4" cuerpo
	[[ "$fuente" == /* ]] || fuente="$aqui/$fuente"
	cuerpo="$(pnpm dlx marked --gfm -i "$fuente")"
	cuerpo="${cuerpo//\{\{QR_DEMO\}\}/$qr_demo}"
	cuerpo="${cuerpo//\{\{QR_REPO\}\}/$qr_repo}"
	{
		printf '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><title>%s</title>\n' "$titulo"
		printf '<style>%s</style></head>\n<body class="%s">\n%s\n</body></html>\n' "$(cat "$aqui/handout.css")" "$clase" "$cuerpo"
	} >"$tmp/$clase.html"
	"$chrome" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
		--virtual-time-budget=15000 --print-to-pdf="$dist/$salida" "file://$tmp/$clase.html" 2>/dev/null
	echo "→ $dist/$salida ($(pdfinfo "$dist/$salida" 2>/dev/null | awk '/^Pages:/ {print $2}') pág.)"
}

render ficha.md ficha "Portal de datos abiertos de la UMSS · Ficha resumen" ficha-resumen.pdf
render proyecto.md proyecto "Portal de datos abiertos de la UMSS · Documento del proyecto" documento-proyecto.pdf
render chuleta.md chuleta "Chuleta de la presentación" chuleta.pdf

# Para estudiar: el guion y las preguntas y respuestas, uno detrás del otro
cat "$aqui/../guion.md" <(printf '\n\n<div class="salto"></div>\n\n') "$aqui/../preguntas.md" >"$tmp/estudio.md"
render "$tmp/estudio.md" estudio "Guion y preguntas de la presentación" estudio-guion-y-preguntas.pdf
