// Contrato de la ruta de edición de datasets.
//
// La ruta es la del asistente en `mode="edit"` más la carga verificada, la pregunta de permiso
// fail-closed y el guardado con precondición. Acá se fija lo que promete: con qué `owner_org` pregunta
// el permiso, que `may_not`/`unknown`/los rechazos de carga no rindan el formulario, que el `match`
// del guardado lleve el `metadata_modified` **cargado**, y que tanto el conflicto como un fallo
// genérico se digan en vez de tragarse.
import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { page } from "$app/stores";
import type { CkanClient } from "$lib/api/client";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanLicense, CkanOrganization, CkanPackage, CkanUser } from "$lib/types/ckan";
import EditPage from "./+page.svelte";

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

const mocks = vi.hoisted(() => ({
	show: vi.fn(),
	post: vi.fn(),
	tagSuggestions: vi.fn(),
	canUpdateDatasetIn: vi.fn(),
	licenseList: vi.fn(),
	sessionCheck: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "" } }));
// `isEditConflict` se conserva **real** (`...actual`): el conflicto del test es un `CkanApiError` de
// verdad y lo decide el predicado del repo, no un doble que lo dé por bueno.
vi.mock("$lib/api/datasets", async () => {
	const actual = await vi.importActual<typeof import("$lib/api/datasets")>("$lib/api/datasets");
	return {
		...actual,
		// El guardado corre el wrapper REAL contra un `post` doblado en el borde HTTP, que devuelve el
		// sobre medido de `package_revise` (`result.package`). Doblar al wrapper con un paquete pelado
		// bendecía el `undefined` en vez de verificarlo.
		createDatasetApi: () => ({
			show: mocks.show,
			revise: actual.createDatasetApi({ post: mocks.post } as unknown as CkanClient).revise,
			tagSuggestions: mocks.tagSuggestions,
		}),
	};
});
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ canUpdateDatasetIn: mocks.canUpdateDatasetIn }),
}));
vi.mock("$lib/api/licenses", () => ({
	createLicenseApi: () => ({ list: mocks.licenseList }),
}));
vi.mock("$lib/api/session", () => ({
	createSessionApi: () => ({ check: mocks.sessionCheck }),
}));

beforeAll(() => {
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

const user: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

const org: CkanOrganization = {
	id: "org-1",
	name: "fcyt",
	title: "Facultad de Ciencias y Tecnología",
	description: "",
	created: "2026-01-01T00:00:00.000000",
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

const METADATA_MODIFIED = "2026-09-30T10:00:00.000000";
// `owner_org` no está declarado en `CkanPackage` (el tipo es incompleto), pero el paquete real lo trae
// y es el id de la organización: `canUpdateDatasetIn` espera exactamente ese valor.
type LoadedPackage = CkanPackage & { owner_org: string };

function makeDataset(overrides: Partial<LoadedPackage> = {}): LoadedPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: true,
		state: "active",
		owner_org: "org-1",
		organization: org,
		resources: [],
		tags: [{ id: "t-1", name: "matrícula", display_name: "matrícula", state: "active" }],
		groups: [],
		extras: [
			{ key: "summary", value: "Resumen cargado" },
			{ key: "frequency", value: "anual" },
		],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: METADATA_MODIFIED,
		license_id: "cc-by",
		notes: "Descripción del dataset",
		...overrides,
	};
}

function getForm(container: HTMLElement): HTMLFormElement {
	const form = container.querySelector("form");
	if (!form) throw new Error("No se encontró el formulario");
	return form as HTMLFormElement;
}

function renderPage() {
	return render(EditPage);
}

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
	pageStore.set({
		params: { id: "pkg-1" },
		url: new URL("http://localhost/dashboard/datasets/pkg-1/edit"),
	});
	mocks.show.mockResolvedValue(makeDataset());
	mocks.post.mockResolvedValue({ package: makeDataset() });
	mocks.tagSuggestions.mockResolvedValue([]);
	mocks.canUpdateDatasetIn.mockResolvedValue("may");
	mocks.licenseList.mockResolvedValue([license]);
	mocks.sessionCheck.mockResolvedValue({ state: "alive", user });
});

describe("Ruta de edición de dataset", () => {
	it("pregunta el permiso con el `owner_org` del dataset cargado", async () => {
		auth.login("tok-123", user);

		const { container } = renderPage();

		await waitFor(() => expect(mocks.canUpdateDatasetIn).toHaveBeenCalledWith("org-1"));
		expect(container.querySelector("form")).not.toBeNull();
	});

	it("sin permiso no rinde el formulario", async () => {
		auth.login("tok-123", user);
		mocks.canUpdateDatasetIn.mockResolvedValue("may_not");

		renderPage();

		expect(
			await screen.findByText(/no tiene permiso para modificar los datasets/i),
		).toBeInTheDocument();
		expect(screen.queryByLabelText(/título/i)).not.toBeInTheDocument();
	});

	it("con la pregunta de permiso no concluida no rinde el formulario y ofrece reintentar", async () => {
		auth.login("tok-123", user);
		mocks.canUpdateDatasetIn.mockResolvedValueOnce("unknown").mockResolvedValueOnce("may");

		renderPage();

		expect(await screen.findByText(/no se pudo verificar si su cuenta/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/título/i)).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));

		await screen.findByLabelText(/título/i);
	});

	it("con extras ilegibles rinde el mensaje del resumen y no pregunta el permiso", async () => {
		auth.login("tok-123", user);
		const sinExtras = makeDataset();
		(sinExtras as { extras?: unknown }).extras = undefined;
		mocks.show.mockResolvedValue(sinExtras);

		renderPage();

		expect(
			await screen.findByText(/no se pudieron leer los campos adicionales/i),
		).toBeInTheDocument();
		expect(screen.queryByLabelText(/título/i)).not.toBeInTheDocument();
		expect(mocks.canUpdateDatasetIn).not.toHaveBeenCalled();
	});

	it("cuenta un fallo de carga con el vocabulario compartido, no con prosa nueva", async () => {
		auth.login("tok-123", user);
		mocks.show.mockRejectedValue(new CkanApiError("Forbidden", 403));

		renderPage();

		expect(
			await screen.findByText(/no está autorizada para ver este dataset/i),
		).toBeInTheDocument();
		expect(screen.queryByLabelText(/título/i)).not.toBeInTheDocument();
	});

	it("guarda con `package_revise` y el `match` lleva el `metadata_modified` cargado", async () => {
		auth.login("tok-123", user);

		const { container } = renderPage();
		await screen.findByLabelText(/título/i);

		await fireEvent.submit(getForm(container));

		await waitFor(() => expect(mocks.post).toHaveBeenCalled());
		const [action, payload] = mocks.post.mock.calls[0] as [
			string,
			{ match: Record<string, unknown>; filter: string[]; update: Record<string, unknown> },
		];
		expect(action).toBe("package_revise");
		expect(payload.match).toEqual({ id: "pkg-1", metadata_modified: METADATA_MODIFIED });
		// El `filter` descarta la lista guardada para que la nuestra se instale tal cual, y el
		// resumen cargado se reescribe dentro de la lista completa: medido contra CKAN 2.12.0,
		// las claves aplanadas anidadas eran un no-op silencioso.
		expect(payload.filter).toEqual(["-extras", "-tags"]);
		expect(payload.update.extras).toEqual([
			{ key: "summary", value: "Resumen cargado" },
			{ key: "frequency", value: "anual" },
		]);
		await waitFor(() => expect(goto).toHaveBeenCalledWith("/dataset/matricula-2026"));
	});

	it("con un conflicto rinde el aviso y deja el envío deshabilitado", async () => {
		auth.login("tok-123", user);
		mocks.post.mockRejectedValue(
			new CkanApiError("HTTP 409", 409, "Validation Error", { match: ["metadata_modified"] }),
		);

		const { container } = renderPage();
		await screen.findByLabelText(/título/i);
		await fireEvent.submit(getForm(container));

		expect(
			await screen.findByText(/El dataset cambió desde que abrió este formulario/i),
		).toBeInTheDocument();
		expect(
			screen.getByText(/No se guardó ningún cambio\. Recargue para ver los valores actuales/i),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /recargar el formulario/i })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeDisabled();
	});

	it("con un fallo de guardado que no es conflicto dice el error en vez de callarse", async () => {
		auth.login("tok-123", user);
		mocks.post.mockRejectedValue(new CkanApiError("Boom", 500));

		const { container } = renderPage();
		await screen.findByLabelText(/título/i);
		await fireEvent.submit(getForm(container));

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(/No se pudo guardar el dataset: Boom/i),
		);
		expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeEnabled();
	});

	it("si la sugerencia de etiquetas rechaza, la página no queda cargando", async () => {
		auth.login("tok-123", user);
		// La sugerencia es cosmética: un rechazo no puede dejar la pantalla en "Cargando el dataset...".
		mocks.tagSuggestions.mockRejectedValue(new Error("servicio de etiquetas caído"));

		renderPage();

		await screen.findByLabelText(/título/i);
		expect(screen.queryByText(/Cargando el dataset/i)).not.toBeInTheDocument();
	});

	it("si cambia el id de la ruta, carga el nuevo dataset y no conserva el anterior", async () => {
		auth.login("tok-123", user);
		mocks.show.mockImplementation((id: string) =>
			Promise.resolve(
				id === "pkg-2"
					? makeDataset({ id: "pkg-2", name: "otro", title: "Otro dataset" })
					: makeDataset(),
			),
		);

		renderPage();
		await waitFor(() => expect(screen.getByLabelText(/título/i)).toHaveValue("Matrícula 2026"));

		pageStore.set({
			params: { id: "pkg-2" },
			url: new URL("http://localhost/dashboard/datasets/pkg-2/edit"),
		});

		await waitFor(() => expect(screen.getByLabelText(/título/i)).toHaveValue("Otro dataset"));
		expect(mocks.show).toHaveBeenLastCalledWith("pkg-2");
	});

	it("si el id cambia con una carga en vuelo, la respuesta vieja no pisa el formulario", async () => {
		auth.login("tok-123", user);
		const primero = Promise.withResolvers<LoadedPackage>();
		mocks.show.mockImplementation((id: string) =>
			id === "pkg-1"
				? primero.promise
				: Promise.resolve(makeDataset({ id: "pkg-2", name: "otro", title: "Otro dataset" })),
		);
		const { container } = renderPage();
		// El id cambia sin esperar la primera carga; su respuesta se resuelve al final.
		await waitFor(() => expect(mocks.show).toHaveBeenCalledWith("pkg-1"));
		pageStore.set({ params: { id: "pkg-2" }, url: new URL("http://localhost/") });
		await waitFor(() => expect(screen.getByLabelText(/título/i)).toHaveValue("Otro dataset"));
		primero.resolve(makeDataset());
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(mocks.canUpdateDatasetIn).toHaveBeenCalledTimes(1);
		await fireEvent.submit(getForm(container));
		await waitFor(() => expect(mocks.post).toHaveBeenCalled());
		const [, reviseParams] = mocks.post.mock.calls[0] as [string, { match: { id: string } }];
		expect(reviseParams.match.id).toBe("pkg-2");
	});

	it("si el id cambia con las licencias en vuelo y el nuevo dataset no puede editar, no queda cargando", async () => {
		auth.login("tok-123", user);
		const licenciasViejas = Promise.withResolvers<CkanLicense[]>();
		mocks.licenseList.mockReturnValue(licenciasViejas.promise);
		let permisos = 0;
		mocks.canUpdateDatasetIn.mockImplementation(() => {
			permisos += 1;
			return Promise.resolve(permisos === 1 ? "may" : "may_not");
		});
		mocks.show.mockImplementation((id: string) =>
			id === "pkg-2"
				? Promise.resolve(
						makeDataset({ id: "pkg-2", name: "otro", title: "Otro dataset", owner_org: "org-2" }),
					)
				: Promise.resolve(makeDataset()),
		);

		renderPage();
		await waitFor(() => expect(mocks.licenseList).toHaveBeenCalledTimes(1));
		pageStore.set({ params: { id: "pkg-2" }, url: new URL("http://localhost/") });

		expect(await screen.findByText(/no tiene permiso para modificar/i)).toBeInTheDocument();
		licenciasViejas.resolve([license]);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.queryByText(/Cargando el dataset/i)).not.toBeInTheDocument();
	});

	it("si el id cambia con la pregunta de permiso en vuelo, la respuesta vieja no habilita nada", async () => {
		auth.login("tok-123", user);
		const permisoViejo = Promise.withResolvers<string>();
		let llamadas = 0;
		mocks.canUpdateDatasetIn.mockImplementation(() => {
			llamadas += 1;
			return llamadas === 1 ? permisoViejo.promise : Promise.resolve("may_not");
		});
		mocks.show.mockImplementation((id: string) =>
			id === "pkg-2"
				? Promise.resolve(
						makeDataset({ id: "pkg-2", name: "otro", title: "Otro dataset", owner_org: "org-2" }),
					)
				: Promise.resolve(makeDataset()),
		);

		renderPage();
		await waitFor(() => expect(mocks.canUpdateDatasetIn).toHaveBeenCalledTimes(1));
		pageStore.set({ params: { id: "pkg-2" }, url: new URL("http://localhost/") });
		await screen.findByText(/no tiene permiso para modificar/i);

		permisoViejo.resolve("may");
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.queryByLabelText(/título/i)).not.toBeInTheDocument();
		expect(screen.getByText(/no tiene permiso para modificar/i)).toBeInTheDocument();
		expect(mocks.licenseList).not.toHaveBeenCalled();
	});
});
