import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanLicense, CkanOrganization, CkanPackage, CkanUser } from "$lib/types/ckan";
import Wizard from "./+page.svelte";

const mocks = vi.hoisted(() => ({
	listForUser: vi.fn(),
	create: vi.fn(),
	upload: vi.fn(),
	resourceCreate: vi.fn(),
	licenseList: vi.fn(),
	tagSuggestions: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ listForUser: mocks.listForUser }),
}));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ create: mocks.create, tagSuggestions: mocks.tagSuggestions }),
}));
vi.mock("$lib/api/licenses", () => ({
	createLicenseApi: () => ({ list: mocks.licenseList }),
}));
vi.mock("$lib/api/upload", () => ({
	uploadResourceFile: mocks.upload,
}));
vi.mock("$lib/api/resources", () => ({
	createResourceApi: () => ({ create: mocks.resourceCreate }),
}));

beforeAll(() => {
	// jsdom no implementa `ResizeObserver` ni `scrollIntoView`, que bits-ui `Command` (TagsInput)
	// usa al abrir la lista. Se proveen stubs deterministas para poder montar el combobox en tests.
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

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

const org: CkanOrganization = {
	id: "org-1",
	name: "facultad-de-ciencias",
	title: "Facultad de Ciencias",
	description: "",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
};

const pkg: CkanPackage = {
	id: "pkg-1",
	name: "matricula-estudiantil-2026",
	title: "Matrícula Estudiantil 2026",
	private: true,
	state: "active",
	resources: [],
	tags: [],
	groups: [],
	extras: [],
	metadata_created: "2026-01-01T00:00:00.000000",
	metadata_modified: "2026-01-01T00:00:00.000000",
};

function makeLicense(overrides: Partial<CkanLicense> = {}): CkanLicense {
	return {
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
		...overrides,
	};
}

const licenseListFixture: CkanLicense[] = [
	makeLicense(),
	makeLicense({
		id: "cc-by-sa",
		title: "Creative Commons Attribution-ShareAlike 4.0",
		url: "https://creativecommons.org/licenses/by-sa/4.0/",
	}),
	makeLicense({ id: "notspecified", title: "License not specified", url: "" }),
];

function getForm(container: HTMLElement): HTMLFormElement {
	const form = container.querySelector("form");
	if (!form) throw new Error("No se encontró el formulario");
	return form as HTMLFormElement;
}

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
	mocks.listForUser.mockResolvedValue([org]);
	mocks.create.mockResolvedValue(pkg);
	mocks.upload.mockResolvedValue({} as never);
	mocks.resourceCreate.mockResolvedValue({} as never);
	mocks.licenseList.mockResolvedValue(licenseListFixture);
	mocks.tagSuggestions.mockResolvedValue(["matrícula", "estudiantes"]);
});

describe("Wizard de publicación", () => {
	it("redirige a /auth/login sin sesión y no toca CKAN", async () => {
		render(Wizard);

		await waitFor(() => expect(goto).toHaveBeenCalledWith("/auth/login"));
		expect(mocks.listForUser).not.toHaveBeenCalled();
	});

	it("muestra el estado vacío cuando el usuario no tiene organización escribible", async () => {
		mocks.listForUser.mockResolvedValue([]);
		auth.login("tok-123", baseUser);

		render(Wizard);

		await waitFor(() => expect(screen.getByText(/necesita rol de editor/i)).toBeInTheDocument());
		expect(screen.queryByLabelText(/organización/i)).not.toBeInTheDocument();
	});

	it("muestra error con reintento cuando falla la carga de organizaciones", async () => {
		mocks.listForUser.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce([org]);
		auth.login("tok-123", baseUser);

		render(Wizard);

		await screen.findByText(/no se pudo cargar/i);
		await fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
		await screen.findByLabelText(/título/i);
	});

	it("bloquea el submit ante un campo requerido faltante sin llamar a CKAN", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await screen.findByLabelText(/título/i);
		await fireEvent.submit(getForm(container));

		await waitFor(() =>
			expect(container.querySelector("#title-error")).toHaveTextContent(/título es obligatorio/i),
		);
		// El resumen también lista los errores (título vacío y slug vacío).
		expect(screen.getByText(/corrija/i)).toBeInTheDocument();
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("envía package_create con el payload esperado en un envío mínimo válido", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		// La única organización se selecciona automáticamente y el slug sigue al título.
		await fireEvent.submit(getForm(container));

		await waitFor(() => expect(mocks.create).toHaveBeenCalled());
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Matrícula Estudiantil 2026",
				name: "matricula-estudiantil-2026",
				owner_org: "facultad-de-ciencias",
				private: true,
			}),
		);
		await waitFor(() => expect(goto).toHaveBeenCalledWith("/dataset/matricula-estudiantil-2026"));
	});

	it("selecciona automáticamente la única organización y la muestra de solo lectura", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await screen.findByLabelText(/título/i);

		// El título de la organización (no el slug) se muestra de solo lectura.
		expect(screen.getAllByText("Facultad de Ciencias").length).toBeGreaterThan(0);
		expect(container.querySelector("#owner-org")).not.toBeInTheDocument();
	});

	it("muestra el slug bloqueado y lo desbloquea con la acción de editar", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		// Bloqueado: se muestra como texto, no como input editable.
		await screen.findByText("matricula-estudiantil-2026");
		expect(container.querySelector("#slug")).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: "Editar" }));
		expect(container.querySelector("#slug")).toBeInTheDocument();
	});

	it("no muestra el campo de visibilidad y publica siempre como privado", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await screen.findByLabelText(/título/i);

		expect(container.querySelector('input[type="radio"]')).not.toBeInTheDocument();
		expect(screen.queryByText("Privada")).not.toBeInTheDocument();
		expect(screen.queryByText("Pública")).not.toBeInTheDocument();
	});

	it("envía el resumen como extra summary en el payload", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});
		await fireEvent.input(screen.getByLabelText(/resumen/i), {
			target: { value: "Datos consolidados de matrícula" },
		});

		await fireEvent.submit(getForm(container));

		await waitFor(() => expect(mocks.create).toHaveBeenCalled());
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({
				extras: [{ key: "summary", value: "Datos consolidados de matrícula" }],
			}),
		);
	});

	it("agrega etiquetas a través de TagsInput y las envía en tag_string", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		const input = screen.getByPlaceholderText(/etiqueta/i);
		await fireEvent.input(input, { target: { value: "presupuesto" } });
		await waitFor(() =>
			expect(screen.getByRole("option", { name: "Agregar «presupuesto»" })).toHaveAttribute(
				"aria-selected",
				"true",
			),
		);
		await fireEvent.keyDown(input, { key: "Enter" });

		expect(
			await screen.findByRole("button", { name: "Quitar etiqueta presupuesto" }),
		).toBeInTheDocument();

		await fireEvent.submit(getForm(container));

		await waitFor(() => expect(mocks.create).toHaveBeenCalled());
		expect(mocks.create).toHaveBeenCalledWith(
			expect.objectContaining({ tag_string: "presupuesto" }),
		);
	});

	it("carga las licencias desde license_list y envía la seleccionada", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		const licenseSelect = await screen.findByLabelText(/licencia/i);
		await waitFor(() => expect(licenseSelect).toBeEnabled());

		await fireEvent.change(licenseSelect, { target: { value: "cc-by" } });

		await fireEvent.submit(getForm(container));

		await waitFor(() => expect(mocks.create).toHaveBeenCalled());
		expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ license_id: "cc-by" }));
	});

	it("cuando license_list falla, deshabilita el select y permite publicar sin licencia", async () => {
		auth.login("tok-123", baseUser);
		mocks.licenseList.mockRejectedValueOnce(new Error("boom"));

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		const licenseSelect = await screen.findByLabelText(/licencia/i);
		await waitFor(() => expect(licenseSelect).toBeDisabled());
		expect(screen.getByText(/no se pudo cargar la lista de licencias/i)).toBeInTheDocument();

		await fireEvent.submit(getForm(container));

		await waitFor(() => expect(mocks.create).toHaveBeenCalled());
		const payload = mocks.create.mock.calls[0][0] as Record<string, unknown>;
		expect(payload).not.toHaveProperty("license_id");
		await waitFor(() => expect(goto).toHaveBeenCalledWith("/dataset/matricula-estudiantil-2026"));
	});

	it("crea un enlace externo con resource_create en JSON, sin multipart", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		await fireEvent.input(screen.getByLabelText("Nombre del enlace"), {
			target: { value: "Informe de matrícula" },
		});
		await fireEvent.input(screen.getByLabelText("URL del enlace"), {
			target: { value: "https://example.org/informe.csv" },
		});
		await fireEvent.click(screen.getByRole("button", { name: /agregar enlace/i }));

		await fireEvent.submit(getForm(container));

		await waitFor(() => expect(mocks.resourceCreate).toHaveBeenCalled());
		expect(mocks.resourceCreate).toHaveBeenCalledWith({
			package_id: "pkg-1",
			name: "Informe de matrícula",
			url: "https://example.org/informe.csv",
		});
		// El enlace no pasa por la vía multipart (subida de archivos).
		expect(mocks.upload).not.toHaveBeenCalled();
		await waitFor(() => expect(goto).toHaveBeenCalledWith("/dataset/matricula-estudiantil-2026"));
	});

	it("rechaza enlaces con esquema javascript: o data: y no los agrega", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await screen.findByLabelText("Nombre del enlace");
		await fireEvent.input(screen.getByLabelText("Nombre del enlace"), {
			target: { value: "Enlace malicioso" },
		});

		for (const urlValue of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
			await fireEvent.input(screen.getByLabelText("URL del enlace"), {
				target: { value: urlValue },
			});
			await fireEvent.click(screen.getByRole("button", { name: /agregar enlace/i }));

			// Muestra el error de protocolo y NO agrega el enlace a la lista.
			expect(screen.getByText(/http o https/i)).toBeInTheDocument();
			expect(container.querySelector("ul[aria-label='Enlaces agregados']")).not.toBeInTheDocument();
		}
	});

	it("reporta un enlace fallido sin navegar, conserva el dataset y lo reintenta", async () => {
		auth.login("tok-123", baseUser);
		mocks.resourceCreate
			.mockRejectedValueOnce(new Error("fallo de red"))
			.mockResolvedValueOnce({} as never);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});
		await fireEvent.input(screen.getByLabelText("Nombre del enlace"), {
			target: { value: "Informe de matrícula" },
		});
		await fireEvent.input(screen.getByLabelText("URL del enlace"), {
			target: { value: "https://example.org/informe.csv" },
		});
		await fireEvent.click(screen.getByRole("button", { name: /agregar enlace/i }));

		await fireEvent.submit(getForm(container));

		// El enlace queda en error y se reporta por enlace con su mensaje.
		await waitFor(() => expect(mocks.resourceCreate).toHaveBeenCalledTimes(1));
		expect(await screen.findByText("Informe de matrícula: fallo de red")).toBeInTheDocument();

		// El dataset se conserva (no se pierde) y NO se navega a /dataset/...
		expect(mocks.create).toHaveBeenCalledTimes(1);
		expect(goto).not.toHaveBeenCalled();
		expect(screen.getByRole("link", { name: /ver dataset/i })).toHaveAttribute(
			"href",
			"/dataset/matricula-estudiantil-2026",
		);

		// El reintento vuelve a llamar a la creación del enlace y luego navega.
		await fireEvent.click(screen.getByRole("button", { name: /reintentar recursos fallidos/i }));
		await waitFor(() => expect(mocks.resourceCreate).toHaveBeenCalledTimes(2));
		await waitFor(() => expect(goto).toHaveBeenCalledWith("/dataset/matricula-estudiantil-2026"));
	});

	it("muestra el error del slug cuando su formato es inválido, en vez de fallar en silencio", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula 2026" },
		});
		await fireEvent.click(screen.getByRole("button", { name: "Editar" }));
		await fireEvent.input(screen.getByLabelText(/slug/i), { target: { value: "Matrícula 2026" } });

		await fireEvent.submit(getForm(container));

		// El nombre del campo en el schema es `name` y en la UI es «slug»: si las claves no coinciden,
		// el usuario ve un botón que no responde y ningún mensaje.
		await waitFor(() =>
			expect(container.querySelector("#slug-error")).toHaveTextContent(/solo minúsculas/i),
		);
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("lleva el foco al primer campo inválido en orden de formulario al intentar enviar", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula 2026" },
		});
		await fireEvent.click(screen.getByRole("button", { name: "Editar" }));
		await fireEvent.input(screen.getByLabelText(/slug/i), { target: { value: "Matrícula 2026" } });

		await fireEvent.submit(getForm(container));

		// El título (3 caracteres) es válido; el primer inválido es el slug, y va antes de la organización.
		await waitFor(() => expect(document.activeElement?.id).toBe("slug"));
		expect(screen.getByText(/corrija 1 campo/i)).toBeInTheDocument();
	});

	it("valida en vivo al perder el foco y limpia el error al corregirlo", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		const email = await screen.findByLabelText(/correo del responsable/i);

		// Antes de tocarlo no se muestra nada.
		expect(container.querySelector("#maintainer-email-error")).toBeNull();

		await fireEvent.input(email, { target: { value: "no-es-un-email" } });
		await fireEvent.blur(email);

		await waitFor(() =>
			expect(container.querySelector("#maintainer-email-error")).toHaveTextContent(
				/correo electrónico válido/i,
			),
		);

		// Al corregir, el error desaparece sin necesidad de reenviar.
		await fireEvent.input(email, { target: { value: "datos@umss.edu" } });
		await waitFor(() => expect(container.querySelector("#maintainer-email-error")).toBeNull());
	});

	it("el resumen enlaza cada error con su campo", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await screen.findByLabelText(/título/i);
		await fireEvent.submit(getForm(container));

		await screen.findByText(/corrija/i);
		const enlaces = screen
			.getAllByRole("link")
			.map((link) => link.getAttribute("href") ?? "")
			.filter((href) => href.startsWith("#"));
		// Con el formulario vacío fallan el título y el slug (la organización se seleccionó sola).
		expect(enlaces).toEqual(["#title", "#slug"]);
	});
});
