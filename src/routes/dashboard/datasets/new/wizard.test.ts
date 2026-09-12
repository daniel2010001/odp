import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { auth } from "$lib/stores/auth";
import type { CkanOrganization, CkanPackage, CkanUser } from "$lib/types/ckan";
import Wizard from "./+page.svelte";

const mocks = vi.hoisted(() => ({
	listForUser: vi.fn(),
	create: vi.fn(),
	upload: vi.fn(),
	resourceCreate: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ listForUser: mocks.listForUser }),
}));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ create: mocks.create }),
}));
vi.mock("$lib/api/upload", () => ({
	uploadResourceFile: mocks.upload,
}));
vi.mock("$lib/api/resources", () => ({
	createResourceApi: () => ({ create: mocks.resourceCreate }),
}));

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

		await waitFor(() => expect(screen.getByText(/título debe/i)).toBeInTheDocument());
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("envía package_create con el payload esperado en un envío mínimo válido", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		const slugInput = screen.getByLabelText(/slug/i);
		await waitFor(() => expect(slugInput).toHaveValue("matricula-estudiantil-2026"));

		await fireEvent.change(screen.getByLabelText(/organización/i), {
			target: { value: "facultad-de-ciencias" },
		});

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

	it("crea un enlace externo con resource_create en JSON, sin multipart", async () => {
		auth.login("tok-123", baseUser);

		const { container } = render(Wizard);

		await fireEvent.input(await screen.findByLabelText(/título/i), {
			target: { value: "Matrícula Estudiantil 2026" },
		});

		const slugInput = screen.getByLabelText(/slug/i);
		await waitFor(() => expect(slugInput).toHaveValue("matricula-estudiantil-2026"));

		await fireEvent.change(screen.getByLabelText(/organización/i), {
			target: { value: "facultad-de-ciencias" },
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
		const slugInput = screen.getByLabelText(/slug/i);
		await waitFor(() => expect(slugInput).toHaveValue("matricula-estudiantil-2026"));
		await fireEvent.change(screen.getByLabelText(/organización/i), {
			target: { value: "facultad-de-ciencias" },
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
});
