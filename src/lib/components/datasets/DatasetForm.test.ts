// Contrato propio de `DatasetForm` (advisory `R3-001` de `review-ff8d537a39fa1a81`).
//
// El asistente de creación prueba el formulario a través de su página; acá se monta el componente
// solo, con sus props y callbacks, para fijar lo que le promete a quien lo use: los dos modos, el
// prellenado de `initial`, el slug fijo en edición, la organización como hecho y el contrato del
// callback de envío.
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CkanLicense, CkanOrganization } from "$lib/types/ckan";
import DatasetForm, { type DatasetFormInitial } from "./DatasetForm.svelte";

beforeAll(() => {
	// jsdom no implementa `ResizeObserver` ni `scrollIntoView`, que bits-ui `Command` (TagsInput)
	// usa al abrir la lista. Se proveen stubs deterministas para poder montar el combobox.
	class ResizeObserverStub {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
	globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

	if (!Element.prototype.scrollIntoView) {
		Element.prototype.scrollIntoView = () => {};
	}
});

const org: CkanOrganization = {
	id: "org-1",
	name: "fcyt",
	title: "Facultad de Ciencias y Tecnología",
	description: "",
	created: "2024-01-15T10:00:00Z",
	state: "active",
};

const license: CkanLicense = {
	id: "cc-by",
	title: "Creative Commons Attribution 4.0",
	url: "https://creativecommons.org/licenses/by/4.0/",
	family: "Creative Commons",
	is_generic: "False",
	maintainer: "",
	status: "active",
	od_conformance: "approved",
	osd_conformance: "approved",
	domain_content: "False",
	domain_data: "False",
	domain_software: "False",
};

const initial: DatasetFormInitial = {
	title: "Matrícula estudiantil 2026",
	name: "matricula-estudiantil-2026",
	summary: "Resumen breve del dataset.",
	notes: "Descripción larga del dataset.",
	owner_org: "fcyt",
	license_id: "cc-by",
	tags: ["matrícula", "estudiantes"],
	url: "https://example.org/dataset",
	maintainer: "Unidad de Datos",
	maintainer_email: "datos@umss.edu",
};

function getForm(container: HTMLElement): HTMLFormElement {
	const form = container.querySelector("form");
	if (!form) throw new Error("No se encontró el formulario");
	return form as HTMLFormElement;
}

function renderCreate(onsubmit: (data: unknown) => void = vi.fn()) {
	return render(DatasetForm, {
		props: {
			mode: "create",
			organizations: [org],
			licenses: [license],
			onsubmit,
		},
	});
}

function renderEdit(
	overrides: Partial<DatasetFormInitial> = {},
	onsubmit: (data: unknown) => void = vi.fn(),
	organizations: CkanOrganization[] = [org],
) {
	return render(DatasetForm, {
		props: {
			mode: "edit",
			initial: { ...initial, ...overrides },
			organizations,
			licenses: [license],
			onsubmit,
		},
	});
}

describe("DatasetForm — modo creación", () => {
	it("arranca con los campos vacíos, como el asistente espera hoy", () => {
		const { container } = renderCreate();

		expect(container.querySelector<HTMLInputElement>("#title")?.value).toBe("");
		expect(container.querySelector<HTMLTextAreaElement>("#summary")?.value).toBe("");
		expect(container.querySelector<HTMLTextAreaElement>("#notes")?.value).toBe("");
		expect(container.querySelector<HTMLInputElement>("#url")?.value).toBe("");
		expect(container.querySelector<HTMLSelectElement>("#license")?.value).toBe("");
		expect(screen.queryByRole("button", { name: /quitar etiqueta/i })).not.toBeInTheDocument();
	});

	it("conserva la sección de recursos: en creación el formulario sí los administra", () => {
		renderCreate();

		expect(screen.getByRole("heading", { name: /^recursos$/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /agregar recurso/i })).toBeInTheDocument();
	});

	it("sigue al título en el slug y lo desbloquea con «Editar»", async () => {
		const { container } = renderCreate();

		await fireEvent.input(container.querySelector("#title") as HTMLInputElement, {
			target: { value: "Matrícula 2026" },
		});

		await screen.findByText("matricula-2026");
		expect(container.querySelector("#slug")).toBeNull();

		await fireEvent.click(screen.getByRole("button", { name: "Editar" }));
		expect(container.querySelector<HTMLInputElement>("#slug")?.value).toBe("matricula-2026");
	});
});

describe("DatasetForm — modo edición", () => {
	it("prellena todos los campos desde `initial`", () => {
		const { container } = renderEdit();

		expect(container.querySelector<HTMLInputElement>("#title")?.value).toBe(initial.title);
		expect(screen.getByText("matricula-estudiantil-2026")).toBeInTheDocument();
		expect(container.querySelector("#slug")).toBeNull();
		expect(container.querySelector<HTMLTextAreaElement>("#summary")?.value).toBe(initial.summary);
		expect(container.querySelector<HTMLTextAreaElement>("#notes")?.value).toBe(initial.notes);
		expect(container.querySelector<HTMLInputElement>("#url")?.value).toBe(initial.url);
		expect(container.querySelector<HTMLInputElement>("#maintainer")?.value).toBe(
			initial.maintainer,
		);
		expect(container.querySelector<HTMLInputElement>("#maintainer-email")?.value).toBe(
			initial.maintainer_email,
		);
		expect(container.querySelector<HTMLSelectElement>("#license")?.value).toBe("cc-by");
		expect(screen.getByText("matrícula")).toBeInTheDocument();
		expect(screen.getByText("estudiantes")).toBeInTheDocument();
	});

	it("advierte que Retroceso quita la última etiqueta con el campo vacío", () => {
		// El guardado instala la lista exacta de etiquetas: un Retroceso accidental con el campo
		// vacío sería un borrado real en el servidor, así que la ayuda debe hacer visible el gesto.
		const { container } = renderEdit();

		expect(container.querySelector("#tags-help")).toHaveTextContent(
			/con el campo vacío, retroceso quita la última etiqueta/i,
		);
	});

	it("presenta el slug fijo y sólo lo hace editable tras desbloquearlo", async () => {
		const { container } = renderEdit();

		// Bloqueado: texto, no input.
		expect(container.querySelector("#slug")).toBeNull();
		expect(screen.getByRole("button", { name: "Desbloquear" })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
		expect(container.querySelector<HTMLInputElement>("#slug")?.value).toBe(
			"matricula-estudiantil-2026",
		);

		await fireEvent.click(screen.getByRole("button", { name: "Bloquear" }));
		expect(container.querySelector("#slug")).toBeNull();
	});

	it("no deja que el slug siga al título: cambiarlo rompería los enlaces existentes", async () => {
		const { container } = renderEdit();

		await fireEvent.input(container.querySelector("#title") as HTMLInputElement, {
			target: { value: "Otro título distinto" },
		});

		expect(screen.getByText("matricula-estudiantil-2026")).toBeInTheDocument();
	});

	it("muestra la organización como un hecho, no como un control", () => {
		const { container } = renderEdit();

		expect(container.querySelector("select#owner-org")).toBeNull();
		expect(container.querySelector("#owner-org")).not.toBeNull();
		expect(screen.queryByLabelText(/^organización/i)).not.toBeInTheDocument();
		// El título aparece también en la ficha lateral; importa que esté como texto, sin control.
		expect(screen.getAllByText("Facultad de Ciencias y Tecnología").length).toBeGreaterThan(0);
		expect(
			screen.getByText(/mover el dataset a otra organización es una operación aparte/i),
		).toBeInTheDocument();
	});

	it("no ofrece crear recursos: el guardado de una edición no los escribirá", () => {
		// `package_revise` no lleva recursos, así que una alta acá sería una mentira sobre lo que el
		// formulario hizo. La lista de recursos propia de la edición es de la slice 2.
		const { container } = renderEdit();

		expect(container.querySelector("ul[aria-label='Recursos agregados']")).toBeNull();
		expect(screen.queryByRole("heading", { name: /^recursos$/i })).toBeNull();
		expect(screen.queryByRole("button", { name: /agregar recurso/i })).toBeNull();
		expect(screen.queryByLabelText(/nombre del recurso/i)).toBeNull();
	});

	it("en edición manda la organización dueña, aunque la lista traiga otra sola", () => {
		// La lista del llamador puede no coincidir con la dueña del dataset: el hecho cargado manda
		// sobre la heurística de «hay una sola organización en la lista» (`R3-001` de
		// `review-9ce0dea883d3ddb9`). Mostrar otra organización que la que se va a usar sería
		// mentirle al lector.
		const otra: CkanOrganization = {
			...org,
			id: "org-2",
			name: "otra-org",
			title: "Otra Organización",
		};
		const { container } = renderEdit({}, vi.fn(), [otra]);

		expect(container.querySelector("#owner-org")?.textContent).toContain("fcyt");
		expect(container.textContent).not.toContain("Otra Organización");
	});

	it("se llama «Guardar cambios» en edición y «Crear dataset» en creación", () => {
		const edit = renderEdit();
		expect(edit.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
		edit.unmount();

		const create = renderCreate();
		expect(create.getByRole("button", { name: /crear dataset/i })).toBeInTheDocument();
	});

	it("entrega al callback la entrada ya validada", async () => {
		const onsubmit = vi.fn();
		const { container } = renderEdit({}, onsubmit);

		await fireEvent.submit(getForm(container));

		expect(onsubmit).toHaveBeenCalledTimes(1);
		expect(onsubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Matrícula estudiantil 2026",
				name: "matricula-estudiantil-2026",
				owner_org: "fcyt",
				private: true,
				license_id: "cc-by",
				tag_string: "matrícula, estudiantes",
				url: "https://example.org/dataset",
				maintainer: "Unidad de Datos",
				maintainer_email: "datos@umss.edu",
				summary: "Resumen breve del dataset.",
				notes: "Descripción larga del dataset.",
			}),
		);
	});

	it("con un campo inválido no entrega nada y muestra el mensaje de validación", async () => {
		const onsubmit = vi.fn();
		const { container } = renderEdit({ title: "" }, onsubmit);

		await fireEvent.submit(getForm(container));

		expect(onsubmit).not.toHaveBeenCalled();
		await waitFor(() =>
			expect(container.querySelector("#title-error")).toHaveTextContent(
				/el título es obligatorio/i,
			),
		);
		expect(screen.getByText(/corrija 1 campo antes de guardar/i)).toBeInTheDocument();
	});

	it("no llama a la API: valida y entrega los datos por el callback", async () => {
		const onsubmit = vi.fn();
		const fetchSpy = vi.fn();
		const originalFetch = globalThis.fetch;
		globalThis.fetch = fetchSpy as unknown as typeof fetch;

		try {
			const { container } = renderEdit({}, onsubmit);
			await fireEvent.submit(getForm(container));
		} finally {
			globalThis.fetch = originalFetch;
		}

		expect(onsubmit).toHaveBeenCalledTimes(1);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
