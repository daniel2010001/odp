// Pruebas de `PublishControl`: lo que se prueba acá es la **honestidad del portal**, no la
// aplicación de la regla. Quién puede publicar lo decide CKAN (`ckanext-umss` encadena la
// autorización de `package_update`); el portal sólo ofrece el control cuando el catálogo dice que
// el usuario es administrador de la organización, y muestra únicamente lo que CKAN confirmó.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CkanApiError } from "$lib/types/api";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";
import PublishControl from "./PublishControl.svelte";

const REFUSAL = "Solo un administrador de la organización puede publicar este dataset.";
const UNCONFIRMED = "El catálogo no confirmó la publicación.";
const UNAVAILABLE = "No se pudo verificar su permiso para publicar.";
const CONSEQUENCE = "Será visible en el catálogo público.";
const PUBLISH_LABEL = "Publicar dataset";

// El wiring por defecto (sin props inyectadas) se comprueba contra las fábricas reales mockeadas
// en el borde de módulo: es la única forma de afirmar que el portal pide `permission: "admin"`.
const mocks = vi.hoisted(() => ({
	createCkanClient: vi.fn(() => ({})),
	publish: vi.fn(),
	listForUser: vi.fn(),
}));

vi.mock("$lib/env", () => ({
	env: { CKAN_URL: "http://localhost:5000", APP_URL: "http://localhost:5173" },
}));
vi.mock("$lib/api/client", () => ({ createCkanClient: mocks.createCkanClient }));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ publish: mocks.publish }),
}));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({ listForUser: mocks.listForUser }),
}));

function makeOrg(overrides: Partial<CkanOrganization> = {}): CkanOrganization {
	return {
		id: "org-1",
		name: "facultad-tecnologia",
		title: "Facultad de Tecnología",
		description: "Datos de ingeniería",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: true,
		state: "active",
		organization: makeOrg(),
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

type ControlProps = {
	dataset: CkanPackage;
	publish?: (id: string) => Promise<CkanPackage>;
	listAdminOrganizations?: () => Promise<CkanOrganization[]>;
	onpublished?: (dataset: CkanPackage) => void;
};

/** Renderiza un dataset privado con el hint resuelto a "es aprobador" por defecto. */
async function renderPrivate(overrides: Partial<ControlProps> = {}) {
	const hint = vi.fn<() => Promise<CkanOrganization[]>>().mockResolvedValue([makeOrg()]);
	const publish = vi.fn<(id: string) => Promise<CkanPackage>>();
	const onpublished = vi.fn();

	const resultado = render(PublishControl, {
		props: {
			dataset: makeDataset(),
			publish,
			listAdminOrganizations: hint,
			onpublished,
			...overrides,
		} satisfies ControlProps,
	});

	// El control sólo se ofrece **después** de que la verificación confirma el permiso.
	await waitFor(() =>
		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument(),
	);

	return { hint, publish, onpublished, ...resultado };
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.listForUser.mockResolvedValue([makeOrg()]);
});

describe("PublishControl — qué se ofrece", () => {
	it("un dataset ya público no renderiza nada: ni publicar ni volver a privado", () => {
		const { container } = render(PublishControl, {
			props: { dataset: makeDataset({ private: false }) } satisfies ControlProps,
		});

		expect(container.textContent?.trim()).toBe("");
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.queryByText(/despublicar|privado|público/i)).toBeNull();
	});

	it("privado + aprobador: ofrece el control y enuncia la consecuencia", async () => {
		const { hint } = await renderPrivate();

		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument();
		expect(screen.getByText(CONSEQUENCE)).toBeInTheDocument();
		expect(hint).toHaveBeenCalledTimes(1);
	});

	it("privado + no aprobador: no ofrece el control y dice quién puede publicar", async () => {
		render(PublishControl, {
			props: {
				dataset: makeDataset(),
				publish: vi.fn(),
				listAdminOrganizations: vi.fn().mockResolvedValue([makeOrg({ id: "org-otra" })]),
			} satisfies ControlProps,
		});

		await waitFor(() => expect(screen.getByText(REFUSAL)).toBeInTheDocument());
		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
	});

	it("una lista de organizaciones de otro id no es prueba de aprobación", async () => {
		// El hint es una lista **filtrada por `permission: "admin"`**, y aun así se comprueba la
		// pertenencia contra el id de la organización del dataset, no contra "la lista no está vacía".
		const hint = vi
			.fn()
			.mockResolvedValue([
				makeOrg({ id: "org-2", name: "otra-facultad" }),
				makeOrg({ id: "org-3", name: "tercera-facultad" }),
			]);

		render(PublishControl, {
			props: {
				dataset: makeDataset(),
				publish: vi.fn(),
				listAdminOrganizations: hint,
			} satisfies ControlProps,
		});

		await waitFor(() => expect(screen.getByText(REFUSAL)).toBeInTheDocument());
		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
	});

	it("sin organización en el dataset la verificación falla cerrada", async () => {
		const hint = vi.fn().mockResolvedValue([makeOrg()]);

		render(PublishControl, {
			props: {
				dataset: makeDataset({ organization: undefined }),
				publish: vi.fn(),
				listAdminOrganizations: hint,
			} satisfies ControlProps,
		});

		await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
		expect(hint).not.toHaveBeenCalled();
	});

	it("privado + verificación fallida: estado explícito con reintento, sin ofrecer el control", async () => {
		const hint = vi
			.fn()
			.mockRejectedValueOnce(new Error("organization_list_for_user: 500"))
			.mockResolvedValueOnce([makeOrg()]);

		render(PublishControl, {
			props: {
				dataset: makeDataset(),
				publish: vi.fn(),
				listAdminOrganizations: hint,
			} satisfies ControlProps,
		});

		await waitFor(() => expect(screen.getByText(UNAVAILABLE)).toBeInTheDocument());
		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() =>
			expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument(),
		);
		expect(screen.queryByText(UNAVAILABLE)).toBeNull();
		expect(hint).toHaveBeenCalledTimes(2);
	});

	it("mientras la verificación está en curso no ofrece el control", async () => {
		render(PublishControl, {
			props: {
				dataset: makeDataset(),
				publish: vi.fn(),
				listAdminOrganizations: vi.fn().mockReturnValue(new Promise(() => {})),
			} satisfies ControlProps,
		});

		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
		expect(screen.getByText(/verificando/i)).toBeInTheDocument();
	});

	it('el wiring por defecto pide las organizaciones con `permission: "admin"`', async () => {
		render(PublishControl, { props: { dataset: makeDataset() } satisfies ControlProps });

		await waitFor(() => expect(mocks.listForUser).toHaveBeenCalledWith("admin"));
		expect(mocks.listForUser).toHaveBeenCalledTimes(1);
	});
});

describe("PublishControl — qué reporta después del click", () => {
	it("llama a publish con el id del dataset y muestra el resultado como éxito sólo si CKAN confirmó", async () => {
		const respuesta = makeDataset({ private: false });
		const { publish, onpublished } = await renderPrivate();
		publish.mockResolvedValue(respuesta);

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(onpublished).toHaveBeenCalledWith(respuesta));
		expect(publish).toHaveBeenCalledWith("pkg-1");
		// El dataset renderizado es la respuesta de CKAN: el control desaparece porque ya es público.
		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
	});

	it("si el wiring por defecto se usa, publica contra la API del portal", async () => {
		render(PublishControl, { props: { dataset: makeDataset() } satisfies ControlProps });
		await waitFor(() =>
			expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument(),
		);
		mocks.publish.mockResolvedValue(makeDataset({ private: false }));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith("pkg-1"));
	});

	it("403: alerta de rechazo, control disponible otra vez y el dataset sigue privado", async () => {
		const { publish, onpublished } = await renderPrivate();
		publish.mockRejectedValue(new CkanApiError(REFUSAL, 403, "Authorization Error"));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(REFUSAL));
		const boton = screen.getByRole("button", { name: PUBLISH_LABEL });
		expect(boton).toBeEnabled();
		expect(onpublished).not.toHaveBeenCalled();
	});

	it("200 sin confirmar: dice que el catálogo no confirmó y no muestra ningún estado de éxito", async () => {
		const { publish, onpublished } = await renderPrivate();
		// CKAN contestó 200 pero la respuesta sigue reportando `private: true`.
		publish.mockResolvedValue(makeDataset({ private: true }));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNCONFIRMED));
		expect(onpublished).not.toHaveBeenCalled();
		// La lectura del dataset no cambió: sigue siendo privado y el control sigue ofrecido.
		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument();
	});

	it("otro fallo: error explícito con reintento que vuelve a intentar", async () => {
		const respuesta = makeDataset({ private: false });
		const { publish, onpublished } = await renderPrivate();
		publish.mockRejectedValueOnce(new Error("502 Bad Gateway")).mockResolvedValueOnce(respuesta);

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("502 Bad Gateway"));
		expect(publish).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(onpublished).toHaveBeenCalledWith(respuesta));
		expect(publish).toHaveBeenCalledTimes(2);
		expect(publish).toHaveBeenLastCalledWith("pkg-1");
	});

	it("en vuelo: el control reporta ocupado y no anuncia éxito", async () => {
		const { publish, onpublished } = await renderPrivate();
		publish.mockReturnValue(new Promise(() => {}));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		const boton = screen.getByRole("button", { name: /publicando/i });
		expect(boton).toBeDisabled();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(onpublished).not.toHaveBeenCalled();
	});
});
