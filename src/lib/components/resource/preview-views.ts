// La lógica pura de los enlaces de la vista previa: qué id lleva cada ventana y cómo un fragmento de la URL
// se resuelve a una vista. Vive aparte para poder probarla sin dibujar nada.
import type { PreviewKind } from "$lib/resources/preview";

export type ViewKind = "table" | "chart" | "pdf" | "image" | "text";

export interface PreviewView {
	/** Valor de la pestaña. */
	key: string;
	/** Id de la ventana: el fragmento que la enlaza. */
	id: string;
	kind: ViewKind;
	label: string;
}

/** El contenedor de todas las vistas (tabla, gráficos, PDF, imagen, texto): `#preview`. */
export const CONTAINER_ID = "preview";

/**
 * Los fragmentos en español que ya circulan en enlaces compartidos, y su equivalente en inglés (la plataforma
 * no lleva español en la URL). Es el ÚNICO lugar donde viven: a esto se suma `#grafico-<id>` → `#chart-<id>`
 * (ver `upgradeFragment`). Quien carga una página con uno de ellos abre la vista o sección y reescribe la URL
 * con `replaceState`. Se puede retirar cuando ya no circulen.
 */
export const LEGACY_FRAGMENTS: Record<string, string> = {
	"vista-previa": "preview",
	tabla: "table",
	imagen: "image",
	texto: "text",
	resumen: "summary",
	licencia: "license",
	recursos: "resources",
	"info-tecnica": "technical-info",
	historial: "history",
	organizacion: "organization",
	citar: "cite",
};

/** El fragmento en inglés (con `#`) que reemplaza a uno heredado en español; `null` si no hay nada que migrar. */
export function upgradeFragment(hash: string): string | null {
	const id = hash.replace(/^#/, "");
	const mapped = Object.hasOwn(LEGACY_FRAGMENTS, id) ? LEGACY_FRAGMENTS[id] : undefined;
	if (mapped) return `#${mapped}`;
	const chart = /^grafico-(.+)$/.exec(id);
	return chart ? `#chart-${chart[1]}` : null;
}

/** Id de la ventana de un gráfico: el de su vista de CKAN (el id es estable aunque el título cambie). */
export const chartWindowId = (viewId: string): string => `chart-${viewId}`;

const WINDOWS = {
	table: { id: "table", label: "Tabla" },
	pdf: { id: "pdf", label: "PDF" },
	image: { id: "image", label: "Imagen" },
	text: { id: "text", label: "Texto" },
} as const;

/** El id y el rótulo de la ventana de un tipo de vista previa; `null` si no hay nada que previsualizar. */
export function windowIdFor(kind: PreviewKind): { id: string; label: string } | null {
	return kind === "none" ? null : WINDOWS[kind];
}

/** Qué señala un fragmento: una vista (abre su pestaña), el contenedor (no cambia de vista) o nada. */
export function resolveHash(
	hash: string,
	views: PreviewView[],
): { view: PreviewView | null; container: boolean } {
	const id = (upgradeFragment(hash) ?? hash).replace(/^#/, "");
	if (id === CONTAINER_ID) return { view: null, container: true };
	return { view: views.find((v) => v.id === id) ?? null, container: false };
}

/** La URL para compartir: la actual con el fragmento cambiado. */
export function shareLink(current: string, id: string): string {
	const url = new URL(current);
	url.hash = id;
	return url.toString();
}

/** Sube el contenedor (pestañas + ventana) bajo el encabezado y le pasa el foco. */
export function fitContainer(from: Element): void {
	const container = from.closest<HTMLElement>(`#${CONTAINER_ID}`);
	if (!container) return;
	const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	container.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
	container.focus({ preventScroll: true });
}
