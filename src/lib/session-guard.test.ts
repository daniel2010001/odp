import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import type { CkanClient } from "./api/client";
import { sessionExpiredLoginUrl } from "./session";
import { endInvalidSession, resolveUnauthorized } from "./session-guard";
import { auth, isAuthenticated } from "./stores/auth";
import { CkanApiError } from "./types/api";
import type { CkanUser } from "./types/ckan";

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

/**
 * Construye un cliente CKAN falso cuyo `post` ejecuta el comportamiento dado, para poder guiar la
 * sonda sin leer `$lib/env` ni stubbear `fetch`. Se devuelve `post` para poder aserir si la rama
 * sondeó o no.
 */
function stubClient(behaviour: (action: string) => Promise<unknown>) {
	const post = vi.fn(behaviour);
	const client = {
		post,
		get: vi.fn(),
		getConfig: () => ({ baseUrl: "https://ckan.test" }),
	} as unknown as CkanClient;
	return { client, post };
}

/** Una sonda que correría si la rama decidiera sondear: falla ruidosamente si se la llama. */
function forbiddenProbe() {
	return stubClient(async () => {
		throw new Error("the probe must not run");
	});
}

beforeEach(() => {
	auth.reset();
	vi.clearAllMocks();
	// Cada test parte del `goto` por defecto (una promesa resuelta): si un test dejara una
	// implementación pegada, el siguiente mediría otra cosa.
	vi.mocked(goto).mockImplementation(async () => {});
});

describe("endInvalidSession — el camino único de expulsión", () => {
	it("limpia la sesión y navega al login con el motivo y el destino", async () => {
		auth.login("tok-123", baseUser);

		await endInvalidSession("/dashboard/datasets/new");

		expect(goto).toHaveBeenCalledTimes(1);
		expect(goto).toHaveBeenCalledWith(sessionExpiredLoginUrl("/dashboard/datasets/new"));
		// El destino viaja en la URL: el motivo (`expired`) y la vuelta codificada (`returnTo`).
		const destino = vi.mocked(goto).mock.calls[0][0] as string;
		expect(destino).toContain("expired=1");
		expect(destino).toContain("returnTo=%2Fdashboard%2Fdatasets%2Fnew");
		expect(get(isAuthenticated)).toBe(false);
		expect(localStorage.getItem("auth")).toBeNull();
	});

	it("limpia antes de navegar: al llegar el goto el store ya es anónimo", async () => {
		auth.login("tok-123", baseUser);
		// La aserción vive **dentro** del mock: mide el instante exacto de la navegación. Si el orden
		// se invirtiera, acá el store todavía tendría token y el guard de `/auth/login` reenviaría al
		// dashboard, cerrando el bucle que este test existe para impedir.
		const anonimoAlNavegar: boolean[] = [];
		vi.mocked(goto).mockImplementationOnce(async () => {
			anonimoAlNavegar.push(get(isAuthenticated));
		});

		await endInvalidSession("/dashboard");

		expect(anonimoAlNavegar).toEqual([false]);
		expect(goto).toHaveBeenCalledTimes(1);
	});
});

describe("resolveUnauthorized — la rama compartida del 403", () => {
	it("no sondea ni navega cuando el fallo no es de autorización (404)", async () => {
		const { client, post } = forbiddenProbe();
		auth.login("tok-123", baseUser);

		await expect(
			resolveUnauthorized(client, new CkanApiError("Not Found", 404), "tok-123", "/dataset/x"),
		).resolves.toBe("inconclusive");

		expect(post).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});

	it("no sondea un fallo que el catálogo no respondió (5xx)", async () => {
		const { client, post } = forbiddenProbe();
		auth.login("tok-123", baseUser);

		await expect(
			resolveUnauthorized(client, new CkanApiError("Server Error", 500), "tok-123", "/dataset/x"),
		).resolves.toBe("inconclusive");

		expect(post).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});

	it("no sondea a un espectador anónimo: un 403 sin token no es una sesión muerta", async () => {
		const { client, post } = forbiddenProbe();
		const err = new CkanApiError("Access denied", 403);

		await expect(resolveUnauthorized(client, err, null, "/dataset/x")).resolves.toBe(
			"inconclusive",
		);
		await expect(resolveUnauthorized(client, err, "", "/dataset/x")).resolves.toBe("inconclusive");

		expect(post).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});

	it("expulsa por el camino único cuando la sonda encuentra la sesión muerta", async () => {
		const { client } = stubClient(async (action) => {
			if (action === "user_show") throw new CkanApiError("Not found", 404);
			return { ckan_version: "2.11" };
		});
		auth.login("tok-123", baseUser);
		// Medido dentro del mock de `goto`, igual que el test de expulsión de arriba: la sesión ya
		// debe estar limpia en el instante exacto de la navegación, o `/auth/login` rebota al
		// dashboard y el bucle que este módulo existe para frenar se reabre.
		const anonymousAtNavigation: boolean[] = [];
		vi.mocked(goto).mockImplementationOnce(async () => {
			anonymousAtNavigation.push(get(isAuthenticated));
		});

		await expect(
			resolveUnauthorized(
				client,
				new CkanApiError("Access denied", 403),
				"tok-123",
				"/dataset/x/resource/y",
			),
		).resolves.toBe("expelled");

		expect(goto).toHaveBeenCalledTimes(1);
		expect(vi.mocked(goto).mock.calls[0][0] as string).toBe(
			sessionExpiredLoginUrl("/dataset/x/resource/y"),
		);
		expect(anonymousAtNavigation).toEqual([false]);
		expect(localStorage.getItem("auth")).toBeNull();
	});

	it("informa `alive` y no navega a ningún lado cuando la sonda confirma la sesión", async () => {
		const { client } = stubClient(async () => baseUser);
		auth.login("tok-123", baseUser);

		await expect(
			resolveUnauthorized(client, new CkanApiError("Access denied", 403), "tok-123", "/dataset/x"),
		).resolves.toBe("alive");

		expect(goto).not.toHaveBeenCalled();
		expect(get(isAuthenticated)).toBe(true);
	});

	it("informa `inconclusive` y no navega a ningún lado cuando la sonda no puede decidir", async () => {
		const { client } = stubClient(async () => {
			throw new CkanApiError("Server Error", 500);
		});
		auth.login("tok-123", baseUser);

		await expect(
			resolveUnauthorized(client, new CkanApiError("Access denied", 403), "tok-123", "/dataset/x"),
		).resolves.toBe("inconclusive");

		expect(goto).not.toHaveBeenCalled();
		expect(get(isAuthenticated)).toBe(true);
	});
});
