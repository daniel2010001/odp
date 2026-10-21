/** Sobre qué está la barra pegada: una tarjeta (`bg-card`) o el lienzo de la page (`bg-background`). */
export type Surface = "card" | "background";

/**
 * El fondo opaco de una barra pegada: el de su superficie. La barra tapa las filas que pasan por debajo, así que no
 * puede ser transparente; pero si es de otro tono que lo que la rodea se lee como una franja —en oscuro `--card` y
 * `--background` difieren y se nota—. Los literales van completos para que Tailwind los vea.
 */
export function surfaceClass(surface: Surface): string {
	return surface === "card" ? "bg-card" : "bg-background";
}

/**
 * Publica el alto de una barra pegada: lo que ocupa bajo el encabezado cuando está pegada y 0 cuando no lo está
 * (bajo el punto en que deja de pegarse es una fila más del flujo y no tapa nada). Con ese número las filas calculan
 * su `scroll-margin-top` para frenar debajo de la barra y no debajo de ella (`--barra-h`, ver `RequestsQueue`).
 * Se mide `offsetHeight`: `clientHeight` descarta la línea inferior de la barra.
 */
export function barraPegada(node: HTMLElement, publicar: (alto: number) => void) {
	const medir = () =>
		publicar(getComputedStyle(node).position === "sticky" ? node.offsetHeight : 0);
	medir();
	const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
	observer?.observe(node);
	window.addEventListener("resize", medir);
	return {
		update(nuevo: (alto: number) => void) {
			publicar = nuevo;
			medir();
		},
		destroy() {
			observer?.disconnect();
			window.removeEventListener("resize", medir);
			publicar(0);
		},
	};
}
