// Pruebas de `DatasetSidebar`, la columna lateral de la ficha del dataset, con las cuatro variantes que el
// autor aprobó en `/dev/dataset-panel` (S18 de `odd/tasks/prototype-presentation.md`): el orden «Propuesta»,
// el «Scroll propio» (con la barra oculta en reposo y la vuelta arriba al subir la página), el historial
// «Plegado» y el botón del enlace «Unificado» (aparece con toda la tarjeta).

import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicationRequest } from "$lib/api/publication";
import type { CkanPackage } from "$lib/types/ckan";
import DatasetSidebar from "./DatasetSidebar.svelte";

function row(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "req-1",
		dataset_id: "pkg-1",
		status: "pending",
		requested_by_name: "Ana Rojas",
		created_at: "2026-10-20T10:00:00.000000",
		...overrides,
	};
}

const DATASET: CkanPackage = {
	id: "pkg-1",
	name: "matricula-2026",
	title: "Matrícula 2026",
	private: true,
	state: "active",
	resources: [],
	tags: [],
	groups: [],
	extras: [],
	metadata_created: "2026-01-01T00:00:00.000000",
	metadata_modified: "2026-01-01T00:00:00.000000",
	organization: {
		id: "org-1",
		name: "planificacion",
		title: "Dirección de Planificación",
		description: "",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
	},
};

const PENDING = row({ id: "req-3" });

function renderSidebar(
	history: PublicationRequest[] = [
		PENDING,
		row({ id: "req-2", status: "rejected" }),
		row({ id: "req-1", status: "cancelled" }),
	],
) {
	return render(DatasetSidebar, {
		dataset: DATASET,
		solicitudVigente: PENDING,
		pendingRequestCount: 1,
		puedeDecidirSolicitud: false,
		decidir: vi.fn(),
		readStoredDataset: vi.fn(),
		reflejarDecision: vi.fn(),
		historialDeSolicitudes: history,
	});
}

function aside(): HTMLElement {
	const found = document.querySelector("aside");
	if (!found) throw new Error("no hay columna lateral");
	return found;
}

/** La línea en mayúsculas de cada tarjeta, en el orden del DOM. */
function titles(): string[] {
	return Array.from(aside().children).map(
		(card) => card.querySelector("p")?.textContent?.trim() ?? "",
	);
}

afterEach(() => {
	Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
});

describe("DatasetSidebar", () => {
	it("orden «Propuesta»: solicitud, Resumen, Organización, Citar como y el historial al final", () => {
		renderSidebar();
		expect(titles()).toEqual([
			"Solicitud de publicación",
			"Resumen",
			"Organización",
			"Citar como",
			"Historial de solicitudes",
		]);
	});

	it("historial «Plegado»: sólo la última solicitud y «Ver N más» despliega el resto", async () => {
		renderSidebar();
		const history = screen.getByTestId("historial-solicitudes");
		expect(within(history).getAllByTestId("historial-entrada")).toHaveLength(1);
		await fireEvent.click(within(history).getByRole("button", { name: "Ver 2 más" }));
		expect(within(history).getAllByTestId("historial-entrada")).toHaveLength(3);
	});

	it("botón «Unificado»: cada tarjeta es el grupo que lo hace aparecer, al pasar o al enfocar dentro", () => {
		renderSidebar();
		for (const [id, title] of [
			["summary", "Resumen"],
			["organization", "Organización"],
			["cite", "Citar como"],
			["history", "Historial de solicitudes"],
		] as const) {
			const card = document.getElementById(id) as HTMLElement;
			expect(card.className, id).toContain("group/tarjeta");
			const button = within(card).getByRole("button", {
				name: `Copiar enlace a la sección ${title}`,
			});
			expect(button.className, id).toContain("opacity-0");
			expect(button.className, id).toContain("group-hover/tarjeta:opacity-100");
			expect(button.className, id).toContain("group-focus-within/tarjeta:opacity-100");
			expect(button.className, id).toContain("[@media(hover:none)]:opacity-100");
			expect(button.className, id).toContain("motion-reduce:transition-none");
		}
	});

	it("«Scroll propio»: pegajosa, con su propio desplazamiento y un alto que sigue a la ventana", () => {
		renderSidebar();
		const cls = aside().className;
		expect(cls).toContain("lg:sticky");
		expect(cls).toContain("lg:top-[calc(var(--header-h)+1px+var(--sticky-air))]");
		expect(cls).toContain("lg:max-h-[calc(100dvh-var(--header-h-min)-1px-2*var(--sticky-air))]");
		expect(cls).toContain("lg:overflow-y-auto");
		expect(cls).toContain("lg:overscroll-contain");
	});

	it("la barra se oculta en reposo y aparece al pasar o enfocar dentro de la columna", () => {
		renderSidebar();
		const cls = aside().className;
		expect(cls).toContain("lg:[scrollbar-width:thin]");
		expect(cls).toContain("lg:[scrollbar-color:transparent_transparent]");
		expect(cls).toContain("lg:hover:[scrollbar-color:var(--muted-foreground)_transparent]");
		expect(cls).toContain("lg:focus-within:[scrollbar-color:var(--muted-foreground)_transparent]");
		// Sin cursor (táctil) no hay «pasar»: ahí queda siempre visible, como el botón del enlace.
		expect(cls).toContain(
			"lg:[@media(hover:none)]:[scrollbar-color:var(--muted-foreground)_transparent]",
		);
	});

	it("al volver la página al tope, la columna vuelve arriba", async () => {
		Object.defineProperty(window, "scrollY", { value: 800, configurable: true });
		renderSidebar();
		const element = aside();
		Object.defineProperty(element, "scrollTop", { value: 300, writable: true });
		const scrollTo = vi.fn();
		element.scrollTo = scrollTo as typeof element.scrollTo;
		await fireEvent.scroll(window);
		expect(scrollTo).not.toHaveBeenCalled();

		Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
		await fireEvent.scroll(window);
		expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
	});
});
