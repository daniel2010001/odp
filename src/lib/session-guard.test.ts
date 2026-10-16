import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { logout as logoutServerSession } from "./api/auth";
import type { CkanClient } from "./api/client";
import { sessionExpiredLoginUrl } from "./session";
import { endInvalidSession, resolveUnauthorized, validateStoredSession } from "./session-guard";
import { auth, isAuthenticated } from "./stores/auth";
import { CkanApiError } from "./types/api";
import type { CkanUser } from "./types/ckan";

// La sesión del servidor se mata por `/auth/logout`: acá se mide **cuándo** se pide, no la red.
vi.mock("./api/auth", () => ({ logout: vi.fn(async () => {}) }));

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

/**
 * Una sonda que no debe correr en las ramas que deciden no sondear.
 *
 * Ojo con lo que esto prueba: el `throw` de acá **no** es una señal de fallo ruidosa.
 * `createSessionApi().check()` atrapa cualquier error que no sea un `404` y devuelve `inconclusive`,
 * así que la sonda podría correr y el test seguiría en verde. El pin real de estos tests es
 * `expect(post).not.toHaveBeenCalled()`; el `throw` sólo impide que la sonda resuelva como si hubiera
 * confirmado una sesión viva.
 */
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

	it("mata la sesión del **servidor** antes de navegar, o la cookie la vuelve a hidratar", async () => {
		// Una cookie con sello válido cuyo token CKAN ya no acepta sigue abriendo en el servidor: si sólo se
		// limpiara el store, la próxima carga rehidrataría al usuario, el login reenviaría al panel, la sonda
		// diría `dead` otra vez y el ciclo no terminaría. Se mide dentro del `goto`, como el orden del store.
		auth.setUser(baseUser);
		const cookieMuertaAlNavegar: number[] = [];
		vi.mocked(goto).mockImplementationOnce(async () => {
			cookieMuertaAlNavegar.push(vi.mocked(logoutServerSession).mock.calls.length);
		});

		await endInvalidSession("/dashboard");

		expect(cookieMuertaAlNavegar).toEqual([1]);
		expect(logoutServerSession).toHaveBeenCalledWith();
	});
});

describe("resolveUnauthorized — la rama compartida del 403", () => {
	it("no sondea ni navega cuando el fallo no es de autorización (404)", async () => {
		const { client, post } = forbiddenProbe();
		auth.login("tok-123", baseUser);

		await expect(
			resolveUnauthorized(client, new CkanApiError("Not Found", 404), baseUser, "/dataset/x"),
		).resolves.toBe("inconclusive");

		expect(post).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});

	it("no sondea un fallo que el catálogo no respondió (5xx)", async () => {
		const { client, post } = forbiddenProbe();
		auth.login("tok-123", baseUser);

		await expect(
			resolveUnauthorized(client, new CkanApiError("Server Error", 500), baseUser, "/dataset/x"),
		).resolves.toBe("inconclusive");

		expect(post).not.toHaveBeenCalled();
		expect(goto).not.toHaveBeenCalled();
	});

	it("no sondea a un espectador anónimo: un 403 sin usuario no es una sesión muerta", async () => {
		const { client, post } = forbiddenProbe();
		const err = new CkanApiError("Access denied", 403);

		await expect(resolveUnauthorized(client, err, null, "/dataset/x")).resolves.toBe(
			"inconclusive",
		);
		await expect(resolveUnauthorized(client, err, undefined, "/dataset/x")).resolves.toBe(
			"inconclusive",
		);

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
				baseUser,
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
			resolveUnauthorized(client, new CkanApiError("Access denied", 403), baseUser, "/dataset/x"),
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
			resolveUnauthorized(client, new CkanApiError("Access denied", 403), baseUser, "/dataset/x"),
		).resolves.toBe("inconclusive");

		expect(goto).not.toHaveBeenCalled();
		expect(get(isAuthenticated)).toBe(true);
	});
});

describe("validateStoredSession — el veredicto vale para la sesión que se sondeó", () => {
	it("sin usuario no sondea: un anónimo no es una sesión muerta", async () => {
		const { client, post } = forbiddenProbe();

		await expect(validateStoredSession(client)).resolves.toBeNull();

		expect(post).not.toHaveBeenCalled();
	});

	it("sondea con sólo el usuario, sin token guardado: la identidad viene del servidor", async () => {
		const { client, post } = stubClient(async () => baseUser);
		auth.setUser(baseUser);

		await expect(validateStoredSession(client)).resolves.toMatchObject({ state: "alive" });

		expect(post).toHaveBeenCalledWith("user_show", {});
	});

	it("un `dead` de la sesión sondeada mata también la sesión del servidor", async () => {
		const { client } = stubClient(async (action: string) => {
			if (action === "user_show") throw new CkanApiError("Not Found", 404);
			return {};
		});
		auth.setUser(baseUser);

		await expect(validateStoredSession(client)).resolves.toEqual({ state: "dead" });

		expect(get(isAuthenticated)).toBe(false);
		expect(logoutServerSession).toHaveBeenCalledTimes(1);
	});

	it("un `alive` no toca la sesión del servidor", async () => {
		const { client } = stubClient(async () => baseUser);
		auth.setUser(baseUser);

		await validateStoredSession(client);

		expect(logoutServerSession).not.toHaveBeenCalled();
	});

	it("un `dead` de una sesión ya reemplazada no cierra la sesión que se acaba de abrir", async () => {
		auth.login("tok-viejo", baseUser);

		// La sonda queda **en vuelo** hasta que el test la libera, que es la única forma de que el
		// veredicto llegue tarde: si se resolviera al instante, no habría nada que competir.
		let liberar: () => void = () => {};
		const enVuelo = new Promise<void>((resolve) => {
			liberar = resolve;
		});
		const { client } = stubClient(async (action: string) => {
			await enVuelo;
			if (action === "user_show") throw new CkanApiError("Not Found", 404);
			return { success: true, result: {} };
		});

		const sonda = validateStoredSession(client);

		// Mientras la sonda del token viejo viaja, el usuario entra con una sesión nueva.
		auth.login("tok-nuevo", { ...baseUser, id: "u-2", name: "otro" });
		liberar();
		await sonda;

		// El veredicto era de la sesión **vieja**: la nueva no se tira por él.
		expect(get(auth).user?.id).toBe("u-2");
		expect(get(auth).token).toBe("tok-nuevo");
		expect(get(isAuthenticated)).toBe(true);
	});
});
