import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CkanUser } from "$lib/types/ckan";
import { auth, currentUser, isAuthenticated, isSuperAdmin } from "./auth";

const STORAGE_KEY = "auth";

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: true,
	fullname: "Jane Doe",
};

beforeEach(() => {
	localStorage.clear();
	auth.reset();
});

describe("auth store — sin credencial en el navegador", () => {
	it("el estado no tiene campo `token`", () => {
		auth.setUser(baseUser);

		expect(get(auth)).not.toHaveProperty("token");
		expect(get(auth).user).toEqual(baseUser);
	});

	it("no existe `auth.login(token, user)`: la identidad se fija con setUser", () => {
		expect((auth as unknown as Record<string, unknown>).login).toBeUndefined();
	});

	it("setUser, hydrate y logout no escriben localStorage", () => {
		const setItem = vi.spyOn(localStorage, "setItem");

		auth.setUser(baseUser);
		auth.hydrate({ id: "u-1", name: "jdoe", displayName: "Jane Doe", sysadmin: true });
		auth.logout();

		expect(setItem).not.toHaveBeenCalled();
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		setItem.mockRestore();
	});

	it("al cargar borra la clave heredada `auth` sin leerla", async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "tok-abc", user: baseUser }));
		const getItem = vi.spyOn(localStorage, "getItem");

		vi.resetModules();
		const fresh = await import("./auth");

		expect(getItem).not.toHaveBeenCalledWith(STORAGE_KEY);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		// Lo que había guardado no se adopta: la identidad sólo la entrega el servidor.
		expect(get(fresh.auth).user).toBeNull();
		getItem.mockRestore();
	});

	it("si localStorage lanza al borrar la clave heredada, el store carga igual", async () => {
		const removeItem = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
			throw new Error("SecurityError");
		});

		vi.resetModules();
		const fresh = await import("./auth");

		expect(get(fresh.auth).user).toBeNull();
		removeItem.mockRestore();
	});

	it("logout limpia el estado", () => {
		auth.setUser(baseUser);

		auth.logout();

		expect(get(auth).user).toBeNull();
		expect(get(isAuthenticated)).toBe(false);
	});
});

describe("isSuperAdmin", () => {
	it("es true cuando user.sysadmin es true", () => {
		auth.setUser({ ...baseUser, sysadmin: true });
		expect(get(isSuperAdmin)).toBe(true);
	});

	it("es false aunque capacity sea 'admin' cuando sysadmin no es true", () => {
		auth.setUser({ ...baseUser, sysadmin: false, capacity: "admin" });
		expect(get(isSuperAdmin)).toBe(false);
	});

	it("es false cuando no hay usuario autenticado", () => {
		expect(get(isSuperAdmin)).toBe(false);
	});
});

describe("isAuthenticated / currentUser", () => {
	it("isAuthenticated refleja la presencia del usuario", () => {
		expect(get(isAuthenticated)).toBe(false);
		auth.setUser(baseUser);
		expect(get(isAuthenticated)).toBe(true);
	});

	it("currentUser expone el usuario autenticado", () => {
		auth.setUser(baseUser);
		expect(get(currentUser)).toEqual(baseUser);
	});
});

describe("auth.setUser", () => {
	it("fija el usuario y limpia el error", () => {
		auth.setError("falló");

		auth.setUser({ ...baseUser, display_name: "Otra Jane" });

		expect(get(auth).user?.display_name).toBe("Otra Jane");
		expect(get(auth).error).toBeNull();
	});
});

describe("auth.hydrate — la identidad del servidor manda", () => {
	const sessionUser = { id: "u-1", name: "jdoe", displayName: "Jane Doe", sysadmin: true };

	it("con usuario del servidor y nada guardado, fija el usuario", () => {
		auth.hydrate(sessionUser);

		expect(get(auth)).not.toHaveProperty("token");
		expect(get(auth).user).toMatchObject({
			id: "u-1",
			name: "jdoe",
			display_name: "Jane Doe",
			sysadmin: true,
		});
		expect(get(isAuthenticated)).toBe(true);
		expect(get(isSuperAdmin)).toBe(true);
	});

	it("del mismo usuario conserva los campos que el servidor no entrega y deja mandar a los que sí", () => {
		auth.setUser({ ...baseUser, email: "jane@umss.edu", display_name: "Vieja" });

		auth.hydrate(sessionUser);

		expect(get(auth).user?.id).toBe("u-1");
		expect(get(auth).user?.email).toBe("jane@umss.edu");
		expect(get(auth).user?.display_name).toBe("Jane Doe");
	});

	it("si el guardado es de otro usuario, el servidor gana y no se heredan sus campos", () => {
		auth.setUser({ ...baseUser, id: "u-2", name: "otro", email: "otro@umss.edu" });

		auth.hydrate(sessionUser);

		expect(get(auth).user?.id).toBe("u-1");
		expect(get(auth).user?.email).toBeUndefined();
	});

	it("si el servidor no tiene sesión, cierra la guardada: el servidor gana", () => {
		auth.setUser(baseUser);

		auth.hydrate(null);

		expect(get(auth).user).toBeNull();
		expect(get(isAuthenticated)).toBe(false);
	});
});
