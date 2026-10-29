// La página real de organizaciones (S25 de `odd/tasks/prototype-presentation.md`, propuesta aprobada en S9 y
// S19): buscador y filtro por tipo con su cantidad en una barra pegada, grupos por tipo con títulos pegados,
// tarjetas con la cantidad de datasets y la fecha de la última actualización. Todo con los datos que el
// catálogo ya entrega: el tipo se deduce del título (Q11), y la sigla y la jerarquía aparecen sólo si el dato
// existe (Q13, Q6). Se traen todas las organizaciones, sin paginar (Q12).

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import type { CkanOrganization } from "$lib/types/ckan";
import OrganizationsPage from "./+page.svelte";

// La barra pegada mide su alto con `bind:clientHeight`, que usa un `ResizeObserver` que jsdom no
// implementa; acá no se mide el layout (eso se mide en Chromium).
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const api = vi.hoisted(() => ({
	listAll: vi.fn(),
	lastUpdates: vi.fn(),
}));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "" } }));
vi.mock("$lib/api/client", () => ({ createCkanClient: () => ({}) }));
vi.mock("$lib/api/organizations", () => ({ createOrganizationApi: () => api }));

const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

function org(
	name: string,
	title: string,
	count: number,
	extra: Partial<CkanOrganization> & { groups?: { name: string }[] } = {},
): CkanOrganization {
	return {
		id: `id-${name}`,
		name,
		title,
		description: `Descripción de ${title}.`,
		image_url: "",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		package_count: count,
		extras: [],
		...extra,
	};
}

// Las cinco de hoy, más una que la regla del título no clasifica.
const CATALOG = [
	org("direccion-investigacion", "Dirección de Investigación", 10),
	org("fca", "Facultad de Ciencias Agrícolas", 10),
	org("fcs", "Facultad de Ciencias de la Salud", 9),
	org("fcyt", "Facultad de Ciencias y Tecnología", 10),
	org("rectorado", "Rectorado UMSS", 13),
	org("transparencia", "Unidad de Transparencia", 0),
];

function open(query = "") {
	pageStore.set({ params: {}, url: new URL(`http://localhost/organizations${query}`) });
	return render(OrganizationsPage);
}

async function loaded() {
	await screen.findByTestId("org-directory");
}

beforeEach(() => {
	api.listAll.mockResolvedValue(CATALOG);
	api.lastUpdates.mockResolvedValue(new Map([["fca", "2026-10-21T01:12:30.930Z"]]));
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllEnvs();
	pageStore.set({ params: {}, url: new URL("http://localhost/") });
});

describe("/organizations — grupos por tipo", () => {
	it("agrupa por el tipo deducido del título, en orden institucional, con la cantidad de cada grupo", async () => {
		open();
		await loaded();

		const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
		expect(titles).toEqual(["Rectorado 1", "Facultades 3", "Direcciones 1", "Otras unidades 1"]);
		const faculties = screen.getByTestId("org-group-facultad");
		expect(within(faculties).getAllByRole("article")).toHaveLength(3);
		// Dentro del grupo, alfabético.
		expect(
			within(faculties)
				.getAllByRole("heading", { level: 3 })
				.map((h) => h.textContent?.trim()),
		).toEqual([
			"Facultad de Ciencias Agrícolas",
			"Facultad de Ciencias de la Salud",
			"Facultad de Ciencias y Tecnología",
		]);
	});

	it("trae todas las organizaciones y las fechas, sin paginar", async () => {
		open();
		await loaded();

		expect(api.listAll).toHaveBeenCalledTimes(1);
		expect(api.lastUpdates).toHaveBeenCalledTimes(1);
		expect(screen.getAllByRole("article")).toHaveLength(6);
		expect(screen.getByText("6 organizaciones")).toBeInTheDocument();
	});

	it("la tarjeta lleva la cantidad de datasets y, si la hay, la fecha de la última actualización", async () => {
		open();
		await loaded();

		const fca = screen.getByTestId("org-card-fca");
		expect(fca).toHaveTextContent("10 datasets");
		expect(fca.querySelector("time")).toHaveAttribute("datetime", "2026-10-21T01:12:30.930Z");
		expect(screen.getByTestId("org-card-fcs").querySelector("time")).toBeNull();
		expect(screen.getByTestId("org-card-transparencia")).toHaveTextContent(
			"Aún sin datasets publicados",
		);
	});
});

describe("/organizations — filtro por tipo", () => {
	it("ofrece «Todas» y cada tipo presente, con su cantidad", async () => {
		open();
		await loaded();

		const filter = screen.getByRole("group", { name: "Filtrar por tipo" });
		expect(
			within(filter)
				.getAllByRole("button")
				.map((b) => b.textContent?.replace(/\s+/g, " ").trim()),
		).toEqual(["Todas 6", "Rectorado 1", "Facultad 3", "Dirección 1", "Unidad 1"]);
		expect(within(filter).getByRole("button", { name: "Todas 6" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
	});

	it("al elegir un tipo muestra sólo su grupo", async () => {
		open();
		await loaded();

		await fireEvent.click(screen.getByRole("button", { name: "Facultad 3" }));

		expect(screen.getByRole("button", { name: "Facultad 3" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
		expect(screen.getAllByRole("article")).toHaveLength(3);
	});

	it("respeta el tipo de la dirección (`?tipo=`)", async () => {
		open("?tipo=direccion");
		await loaded();

		expect(screen.getAllByRole("article")).toHaveLength(1);
		expect(screen.getByTestId("org-card-direccion-investigacion")).toBeInTheDocument();
	});

	it("las cantidades del filtro siguen a la búsqueda", async () => {
		open("?q=salud");
		await loaded();

		const filter = screen.getByRole("group", { name: "Filtrar por tipo" });
		expect(within(filter).getByRole("button", { name: "Todas 1" })).toBeInTheDocument();
		expect(within(filter).getByRole("button", { name: "Facultad 1" })).toBeInTheDocument();
		expect(within(filter).getByRole("button", { name: "Rectorado 0" })).toBeDisabled();
	});
});

describe("/organizations — buscador", () => {
	it("busca por el nombre sin distinguir acentos ni mayúsculas", async () => {
		open("?q=AGRICOLAS");
		await loaded();

		expect(screen.getAllByRole("article")).toHaveLength(1);
		expect(screen.getByTestId("org-card-fca")).toBeInTheDocument();
	});

	it("filtra al escribir", async () => {
		open();
		await loaded();

		await fireEvent.input(screen.getByRole("searchbox", { name: "Buscar organizaciones" }), {
			target: { value: "rectorado" },
		});

		expect(screen.getAllByRole("article")).toHaveLength(1);
		expect(screen.getByText("1 organización")).toBeInTheDocument();
	});

	it("encuentra por la sigla cuando la organización la declara", async () => {
		api.listAll.mockResolvedValue([
			...CATALOG.filter((o) => o.name !== "fcyt"),
			org("fcyt", "Facultad de Ciencias y Tecnología", 10, {
				extras: [{ key: "sigla", value: "FCyT" }],
			}),
		]);
		open("?q=fcyt");
		await loaded();

		const card = screen.getByTestId("org-card-fcyt");
		expect(card.querySelector("[data-org-acronym]")).toHaveTextContent("FCyT");
		expect(screen.getAllByRole("article")).toHaveLength(1);
	});
});

describe("/organizations — sólo lo que el dato sostiene", () => {
	it("sin sigla ni jerarquía en el catálogo, ninguna tarjeta las menciona", async () => {
		open();
		await loaded();

		const directory = screen.getByTestId("org-directory");
		expect(directory.querySelector("[data-org-acronym]")).toBeNull();
		expect(directory).not.toHaveTextContent(/Depende de|dependiente/);
	});

	it("con la dependencia declarada en el catálogo, la muestran las dos tarjetas", async () => {
		api.listAll.mockResolvedValue([
			...CATALOG,
			org("casa", "Centro de Aguas y Saneamiento Ambiental", 8, { groups: [{ name: "fcyt" }] }),
		]);
		open();
		await loaded();

		expect(screen.getByTestId("org-card-casa")).toHaveTextContent(
			"Depende de Facultad de Ciencias y Tecnología",
		);
		expect(screen.getByTestId("org-card-fcyt")).toHaveTextContent("1 unidad dependiente");
	});

	it("no nombra la implementación", async () => {
		open();
		await loaded();

		expect(document.body).not.toHaveTextContent(/ckan|extras/i);
	});
});

describe("/organizations — pegado al desplazarse", () => {
	it("el buscador y el filtro se pegan bajo el encabezado, con fondo opaco", async () => {
		open();
		await loaded();

		const bar = screen.getByTestId("org-sticky-bar");
		expect(
			within(bar).getByRole("searchbox", { name: "Buscar organizaciones" }),
		).toBeInTheDocument();
		expect(within(bar).getByRole("group", { name: "Filtrar por tipo" })).toBeInTheDocument();
		expect(bar).toHaveClass(
			"sticky",
			"top-[calc(var(--header-h)+1px)]",
			"z-20",
			"pt-[var(--sticky-air)]",
			"bg-background",
			"motion-reduce:transition-none",
		);
		expect(screen.getByTestId("org-directory").style.getPropertyValue("--org-bar-h")).toMatch(
			/px$/,
		);
	});

	it("cada título de grupo se pega justo debajo de la barra, por debajo de ella", async () => {
		open();
		await loaded();

		for (const title of screen.getAllByRole("heading", { level: 2 })) {
			expect(title).toHaveClass(
				"sticky",
				"top-[calc(var(--header-h)+1px+var(--org-bar-h,0px))]",
				"z-[15]",
				"bg-background",
				"motion-reduce:transition-none",
			);
		}
	});
});

describe("/organizations — estados vacíos y de error", () => {
	it("sin organizaciones lo dice, sin buscador", async () => {
		api.listAll.mockResolvedValue([]);
		open();

		expect(await screen.findByText("No hay organizaciones disponibles")).toBeInTheDocument();
		expect(screen.queryByRole("searchbox")).toBeNull();
	});

	it("una búsqueda sin coincidencias ofrece limpiarla, y limpiarla vuelve a mostrar todo", async () => {
		open("?q=astronom%C3%ADa&tipo=facultad");
		await loaded();

		const empty = screen.getByTestId("org-empty");
		expect(empty).toHaveTextContent("No encontramos organizaciones");
		expect(screen.queryAllByRole("article")).toHaveLength(0);

		await fireEvent.click(
			within(empty).getByRole("button", { name: "Limpiar búsqueda y filtros" }),
		);

		expect(screen.getAllByRole("article")).toHaveLength(6);
		expect(screen.getByRole("searchbox", { name: "Buscar organizaciones" })).toHaveValue("");
	});

	it("si el catálogo no responde, fuera de desarrollo muestra el error y permite reintentar", async () => {
		vi.stubEnv("DEV", false);
		api.listAll.mockRejectedValueOnce(new Error("caído"));
		open();

		expect(await screen.findByText("Error al cargar las organizaciones")).toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(6));
	});
});
