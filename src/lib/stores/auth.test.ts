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

describe("auth store — persistencia", () => {
	it("login persiste token y user en localStorage", () => {
		auth.login("tok-123", baseUser);

		expect(get(auth).token).toBe("tok-123");
		expect(get(auth).user).toEqual(baseUser);

		const raw = localStorage.getItem(STORAGE_KEY);
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw as string)).toEqual({ token: "tok-123", user: baseUser });
	});

	it("logout limpia localStorage y el estado", () => {
		auth.login("tok-123", baseUser);
		expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

		auth.logout();

		expect(get(auth).token).toBeNull();
		expect(get(auth).user).toBeNull();
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it("hidrata token y user desde localStorage al cargar", async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "tok-abc", user: baseUser }));

		vi.resetModules();
		const fresh = await import("./auth");

		expect(get(fresh.auth).token).toBe("tok-abc");
		expect(get(fresh.auth).user).toEqual(baseUser);
	});
});

describe("isSuperAdmin", () => {
	it("es true cuando user.sysadmin es true", () => {
		auth.login("tok-123", { ...baseUser, sysadmin: true });
		expect(get(isSuperAdmin)).toBe(true);
	});

	it("es false aunque capacity sea 'admin' cuando sysadmin no es true", () => {
		auth.login("tok-123", { ...baseUser, sysadmin: false, capacity: "admin" });
		expect(get(isSuperAdmin)).toBe(false);
	});

	it("es false cuando no hay usuario autenticado", () => {
		expect(get(isSuperAdmin)).toBe(false);
	});
});

describe("isAuthenticated / currentUser", () => {
	it("isAuthenticated refleja la presencia del usuario", () => {
		expect(get(isAuthenticated)).toBe(false);
		auth.login("tok-123", baseUser);
		expect(get(isAuthenticated)).toBe(true);
	});

	it("isAuthenticated no depende del token: un usuario sin token ya es una sesión", () => {
		auth.setUser(baseUser);

		expect(get(auth).token).toBeNull();
		expect(get(isAuthenticated)).toBe(true);
	});

	it("un token sin usuario no es una sesión", async () => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: "tok-huerfano" }));

		vi.resetModules();
		const fresh = await import("./auth");

		expect(get(fresh.isAuthenticated)).toBe(false);
	});

	it("currentUser expone el usuario autenticado", () => {
		auth.login("tok-123", baseUser);
		expect(get(currentUser)).toEqual(baseUser);
	});
});

describe("auth.setUser", () => {
	it("fija el usuario sin tocar el token", () => {
		auth.login("tok-123", baseUser);

		auth.setUser({ ...baseUser, display_name: "Otra Jane" });

		expect(get(auth).token).toBe("tok-123");
		expect(get(auth).user?.display_name).toBe("Otra Jane");
	});

	it("no escribe localStorage si no hay token que acompañe al usuario", () => {
		auth.setUser(baseUser);

		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it("con token guardado, refresca el usuario persistido", () => {
		auth.login("tok-123", baseUser);

		auth.setUser({ ...baseUser, display_name: "Otra Jane" });

		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
		expect(raw.token).toBe("tok-123");
		expect(raw.user.display_name).toBe("Otra Jane");
	});
});

describe("auth.hydrate — la identidad del servidor manda", () => {
	const sessionUser = { id: "u-1", name: "jdoe", displayName: "Jane Doe", sysadmin: true };

	it("con usuario del servidor y nada guardado, fija el usuario sin token", () => {
		auth.hydrate(sessionUser);

		expect(get(auth).token).toBeNull();
		expect(get(auth).user).toMatchObject({
			id: "u-1",
			name: "jdoe",
			display_name: "Jane Doe",
			sysadmin: true,
		});
		expect(get(isAuthenticated)).toBe(true);
		expect(get(isSuperAdmin)).toBe(true);
	});

	it("si el guardado es del mismo usuario conserva el token (hasta T4b la subida lo lee)", () => {
		auth.login("tok-123", baseUser);

		auth.hydrate(sessionUser);

		expect(get(auth).token).toBe("tok-123");
		expect(get(auth).user?.id).toBe("u-1");
	});

	it("si el guardado es de otro usuario, el servidor gana y el token ajeno se descarta", () => {
		auth.login("tok-ajeno", { ...baseUser, id: "u-2", name: "otro" });

		auth.hydrate(sessionUser);

		expect(get(auth).token).toBeNull();
		expect(get(auth).user?.id).toBe("u-1");
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it("si el servidor no tiene sesión, cierra la guardada: el servidor gana", () => {
		auth.login("tok-123", baseUser);

		auth.hydrate(null);

		expect(get(auth).user).toBeNull();
		expect(get(auth).token).toBeNull();
		expect(get(isAuthenticated)).toBe(false);
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});
