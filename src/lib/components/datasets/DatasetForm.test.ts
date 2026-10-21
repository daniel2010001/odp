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

describe("DatasetForm — sin licencia es notspecified", () => {
	it("al crear sin elegir licencia entrega license_id notspecified", async () => {
		const onsubmit = vi.fn();
		const { container } = renderEdit({ license_id: undefined }, onsubmit);
		await fireEvent.submit(getForm(container));
		expect(onsubmit).toHaveBeenCalledWith(expect.objectContaining({ license_id: "notspecified" }));
	});

	it("un dataset con notspecified muestra «Sin especificar» elegido y lo conserva al guardar", async () => {
		const onsubmit = vi.fn();
		const { container } = renderEdit({ license_id: "notspecified" }, onsubmit);
		const select = container.querySelector<HTMLSelectElement>("#license");
		expect(select?.value).toBe("");
		expect(select?.selectedOptions[0]?.textContent?.trim()).toBe("Sin especificar");
		await fireEvent.submit(getForm(container));
		expect(onsubmit).toHaveBeenCalledWith(expect.objectContaining({ license_id: "notspecified" }));
	});
});

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

describe("DatasetForm — ayuda de la licencia", () => {
	const ogl: CkanLicense = {
		...license,
		id: "uk-ogl",
		title: "UK Open Government Licence (OGL)",
		url: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
	};
	const otra: CkanLicense = { ...license, id: "other-open", title: "Other (Open)", url: "" };

	function renderWith(licenses: CkanLicense[], overrides: Partial<DatasetFormInitial> = {}) {
		return render(DatasetForm, {
			props: {
				mode: "create",
				initial: { ...initial, ...overrides },
				organizations: [org],
				licenses,
				onsubmit: vi.fn(),
			},
		});
	}

	it("muestra la etiqueta en español y el resumen, sin el título en inglés ni la conformidad", () => {
		const { container } = renderWith([license]);
		const help = container.querySelector("#license-help") as HTMLElement;
		expect(help.textContent).toContain("CC BY — Atribución");
		expect(help.textContent).toContain(
			"Permite usar, compartir y adaptar los datos, incluso con fines comerciales, citando la fuente.",
		);
		expect(help.textContent).not.toContain("Creative Commons Attribution 4.0");
		expect(help.textContent).not.toContain("approved");
	});

	it("el enlace a los términos usa la página oficial en español, no la de CKAN", () => {
		const { container } = renderWith([license]);
		const link = container.querySelector<HTMLAnchorElement>("#license-help a");
		expect(link?.getAttribute("href")).toBe("https://creativecommons.org/licenses/by/4.0/deed.es");
	});

	it("un id sin página mapeada cae a la dirección de CKAN, y sin ella no hay enlace", () => {
		const conUrl = renderWith([{ ...otra, url: "https://example.org/t" }], {
			license_id: "other-open",
		});
		expect(conUrl.container.querySelector("#license-help a")?.getAttribute("href")).toBe(
			"https://example.org/t",
		);
		conUrl.unmount();
		const sinUrl = renderWith([otra], { license_id: "other-open" });
		expect(sinUrl.container.querySelector("#license-help a")).toBeNull();
	});

	it("uk-ogl no se ofrece en el selector", () => {
		const { container } = renderWith([license, ogl]);
		const values = [...container.querySelectorAll<HTMLOptionElement>("#license option")].map(
			(o) => o.value,
		);
		expect(values).toContain("cc-by");
		expect(values).not.toContain("uk-ogl");
	});

	it("un dataset que ya tiene uk-ogl lo conserva seleccionado, con su etiqueta", () => {
		const { container } = renderWith([license, ogl], { license_id: "uk-ogl" });
		const select = container.querySelector<HTMLSelectElement>("#license");
		expect(select?.value).toBe("uk-ogl");
		expect(select?.selectedOptions[0]?.textContent).toBe("OGL — Gobierno Abierto (Reino Unido)");
	});
});

describe("DatasetForm — orden de los selects", () => {
	const opciones = (container: HTMLElement, id: string) =>
		[...container.querySelectorAll(`#${id} option`)].map((o) => o.textContent?.trim());

	it("organizaciones: alfabéticas por título, con el marcador arriba", () => {
		const orgs = ["Zoología", "Ñandú", "Álgebra", "Facultad 10", "Facultad 9"].map((title, i) => ({
			...org,
			id: `o${i}`,
			name: `o${i}`,
			title,
		}));
		const { container } = render(DatasetForm, {
			props: { mode: "create", organizations: orgs, licenses: [license], onsubmit: vi.fn() },
		});
		expect(opciones(container, "owner-org")).toEqual([
			"Seleccione una organización",
			"Álgebra",
			"Facultad 9",
			"Facultad 10",
			"Ñandú",
			"Zoología",
		]);
	});

	it("licencias: alfabéticas por la etiqueta en español, «Sin especificar» fija arriba", () => {
		const lic = (id: string, title: string): CkanLicense => ({ ...license, id, title });
		const { container } = render(DatasetForm, {
			props: {
				mode: "create",
				initial,
				organizations: [org],
				licenses: [
					lic("cc-zero", "CC0"),
					lic("cc-by-sa", "CC BY-SA"),
					lic("cc-by", "CC BY"),
					lic("odc-odbl", "ODbL"),
				],
				onsubmit: vi.fn(),
			},
		});
		const lista = opciones(container, "license");
		expect(lista[0]).toBe("Sin especificar");
		const resto = lista.slice(1);
		expect(resto).toEqual(
			[...resto].sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })),
		);
		expect(resto.length).toBeGreaterThan(1);
	});
});

describe("DatasetForm — el resumen cuenta los recursos que el dataset ya tiene (P14, S50)", () => {
	const guardados = [
		{ id: "r1", name: "matricula.csv", kind: "archivo" as const },
		{ id: "r2", name: "Portal de la facultad", kind: "enlace" as const },
	];

	it("al editar un dataset con recursos, el resumen los cuenta y los nombra", () => {
		const { container } = renderEdit({ resources: guardados });
		const text = container.textContent ?? "";
		expect(text).toMatch(/2\s+recursos/);
		expect(text).toContain("matricula.csv");
		expect(text).toContain("Portal de la facultad");
		expect(text).not.toContain("Puede crear sin recursos y agregarlos después.");
	});

	it("al editar, los recursos guardados cuentan como el dato recomendado «Recursos»", () => {
		const { container } = renderEdit({ resources: guardados, tags: [], license_id: "cc-by" });
		const aviso = [...container.querySelectorAll("p")].find((p) =>
			p.textContent?.includes("Faltan datos recomendados"),
		);
		expect(aviso).toBeTruthy();
		expect(aviso?.parentElement?.textContent ?? "").not.toMatch(/Recursos/);
	});

	it("al crear sin recursos, el resumen sigue diciendo 0 recursos e invitando a agregarlos después", () => {
		const { container } = renderCreate();
		const text = container.textContent ?? "";
		expect(text).toMatch(/0\s+recursos/);
		expect(text).toContain("Puede crear sin recursos y agregarlos después.");
	});
});

describe("DatasetForm — tipos de archivo admitidos", () => {
	it("el selector de archivos sólo ofrece las extensiones de la lista", () => {
		const { container } = renderCreate();
		const input = container.querySelector<HTMLInputElement>("#recurso-archivo");
		expect(input?.getAttribute("accept")).toBe(
			".csv,.tsv,.xlsx,.xls,.ods,.json,.geojson,.xml,.txt,.pdf,.png,.jpg,.jpeg,.zip",
		);
	});

	it("un .sh elegido se lista como rechazado y no se agrega como recurso", async () => {
		const { container } = renderCreate();
		const input = container.querySelector<HTMLInputElement>("#recurso-archivo") as HTMLInputElement;
		await fireEvent.change(input, {
			target: { files: [new File(["echo hola"], "instalar.sh", { type: "text/x-sh" })] },
		});

		const alerta = await screen.findByRole("alert");
		expect(alerta.textContent).toContain("no se agregaron");
		expect(alerta.textContent).toContain("instalar.sh");
		expect(container.textContent).toMatch(/0\s+recursos/);
	});
});
