// Modo prototipo (S14 de `odd/tasks/prototype-presentation.md`): con él activado, las páginas reales muestran
// los accesos a las maquetas de `/dev/prototype` —«Colecciones» en el menú, la sección de colecciones en la
// ficha del dataset y en la de la organización, «Mis colecciones» y «Usuarios» en el panel— para capturarlas
// en el prototipo de Figma. Apagado, las páginas son exactamente las de hoy.
//
// Una sola compuerta para todos los puntos de entrada:
// - El estado es una **cookie**, que lee `+layout.server.ts` y entrega como `data.prototype`. Así sobrevive a
//   la navegación y a la recarga, y el SSR ya sale con los accesos dibujados (sin parpadeo en las capturas).
// - **Nunca en producción**: el servidor la ignora con `dev` falso, y las páginas vuelven a exigir
//   `import.meta.env.DEV`, que Vite reemplaza por una constante: en el build real ese camino es código muerto.
// - Se prende y se apaga desde el índice del prototipo (`/dev/prototype`).

export const PROTOTYPE_COOKIE = "odp_prototype";
export const PROTOTYPE_COOKIE_ON = "on";

/** Lo que entrega el servidor: activado sólo en desarrollo y con la cookie puesta. */
export function resolvePrototypeMode(dev: boolean, cookie: string | undefined): boolean {
	return dev && cookie === PROTOTYPE_COOKIE_ON;
}

/** Lo que leen las páginas, desde `data` del layout o `$page.data`. */
export function isPrototypeMode(data: { prototype?: unknown } | undefined | null): boolean {
	return import.meta.env.DEV && data?.prototype === true;
}

/** El interruptor del índice: pone o quita la cookie para todo el sitio (luego hay que `invalidateAll()`). */
export function setPrototypeModeCookie(on: boolean): void {
	// biome-ignore lint/suspicious/noDocumentCookie: la Cookie Store API no está en todos los navegadores ni en jsdom, y es una cookie de desarrollo sin datos.
	document.cookie = on
		? `${PROTOTYPE_COOKIE}=${PROTOTYPE_COOKIE_ON}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
		: `${PROTOTYPE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
