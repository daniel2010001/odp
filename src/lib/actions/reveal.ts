// Action de Svelte 5 para revelar elementos al hacer scroll.
//
// Uso:
//   <section use:reveal> ... </section>
//   <section use:reveal={{ delay: 150 }}> ... </section>
//
// Al entrar en el viewport, el elemento pasa de `.reveal` (opacidad 0,
// desplazado 24px hacia abajo) a `.reveal.is-visible` (opacidad 1, en su sitio)
// con una transición suave. Solo se dispara una vez (unobserve).
//
// Respeta prefers-reduced-motion: las transiciones globales ya están
// neutralizadas en app.css, y aquí simplemente no ocultamos el contenido.

export interface RevealOptions {
	/** Retraso en milisegundos antes de iniciar la transición. */
	delay?: number;
}

export function reveal(node: HTMLElement, options: RevealOptions = {}) {
	const delay = options.delay ?? 0;

	const prefersReducedMotion =
		typeof window !== "undefined" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	if (prefersReducedMotion) {
		// Sin animación: el contenido queda visible tal cual.
		return { destroy() {} };
	}

	node.classList.add("reveal");
	if (delay > 0) {
		node.style.transitionDelay = `${delay}ms`;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					node.classList.add("is-visible");
					observer.unobserve(node);
				}
			}
		},
		{ threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		},
	};
}
