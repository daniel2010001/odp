// Modo prototipo en el panel (S14 de `odd/tasks/prototype-presentation.md`): con él activado, la grilla de
// acciones suma «Mis colecciones» para cualquier usuario con sesión y «Usuarios» sólo para la
// superadministración, con el mismo patrón que «Revisar solicitudes». Apagado, el panel es el de siempre.

import { render, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "$app/stores";
import { auth } from "$lib/stores/auth";
import type { CkanUser } from "$lib/types/ckan";
import Dashboard from "./+page.svelte";

const pageStore = page as unknown as {
	set: (value: {
		params: Record<string, string>;
		url: URL;
		data?: Record<string, unknown>;
	}) => void;
};

const mocks = vi.hoisted(() => ({ sessionCheck: vi.fn() }));

vi.mock("$lib/env", () => ({ env: { CKAN_URL: "" } }));
vi.mock("$lib/api/datasets", () => ({
	createDatasetApi: () => ({ currentUser: async () => ({ count: 0, results: [] }) }),
}));
vi.mock("$lib/api/organizations", () => ({
	createOrganizationApi: () => ({
		listForUser: async () => [],
		canCreateDataset: async () => true,
		listUpdatableOrganizationIds: async () => ({ state: "unknown" }),
	}),
}));
vi.mock("$lib/api/publication", () => ({ createPublicationApi: () => ({ list: async () => [] }) }));
vi.mock("$lib/api/session", () => ({
	createSessionApi: () => ({ check: mocks.sessionCheck }),
}));

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

function signIn(user: CkanUser) {
	mocks.sessionCheck.mockResolvedValue({ state: "alive", user });
	auth.setUser(user);
}

function setPrototype(prototype: boolean | undefined) {
	pageStore.set({
		params: {},
		url: new URL("http://localhost/dashboard"),
		...(prototype === undefined ? {} : { data: { prototype } }),
	});
}

async function grid(container: HTMLElement): Promise<HTMLElement> {
	await waitFor(() => expect(container.querySelector("[data-action-grid]")).not.toBeNull());
	return container.querySelector("[data-action-grid]") as HTMLElement;
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
});

afterEach(() => {
	pageStore.set({ params: {}, url: new URL("http://localhost/") });
	auth.reset();
});

// Con la máquina cargada, el primer render de la página se acerca a los 5 s por defecto.
const SLOW = 15_000;

describe("Panel — modo prototipo", () => {
	it(
		"activado: «Mis colecciones» para cualquier usuario con sesión, sin «Usuarios»",
		async () => {
			setPrototype(true);
			signIn(baseUser);

			const { container } = render(Dashboard);
			const actions = await grid(container);

			expect(within(actions).getByRole("link", { name: /Mis colecciones/ })).toHaveAttribute(
				"href",
				"/dev/prototype/collections?vista=panel",
			);
			expect(within(actions).queryByRole("link", { name: /Usuarios/ })).not.toBeInTheDocument();
		},
		SLOW,
	);

	it(
		"activado: la superadministración además ve «Usuarios»",
		async () => {
			setPrototype(true);
			signIn({ ...baseUser, sysadmin: true });

			const { container } = render(Dashboard);
			const actions = await grid(container);

			expect(await within(actions).findByRole("link", { name: /Usuarios/ })).toHaveAttribute(
				"href",
				"/dev/prototype/users",
			);
			expect(within(actions).getByRole("link", { name: /Mis colecciones/ })).toBeInTheDocument();
		},
		SLOW,
	);

	it(
		"apagado (por defecto): ni «Mis colecciones» ni «Usuarios», aunque sea superadministrador",
		async () => {
			setPrototype(undefined);
			signIn({ ...baseUser, sysadmin: true });

			const { container } = render(Dashboard);
			const actions = await grid(container);

			await within(actions).findByRole("link", { name: /Crear dataset/ });
			expect(
				within(actions).queryByRole("link", { name: /Mis colecciones/ }),
			).not.toBeInTheDocument();
			expect(within(actions).queryByRole("link", { name: /Usuarios/ })).not.toBeInTheDocument();
		},
		SLOW,
	);
});
