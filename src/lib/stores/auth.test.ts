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
	it("isAuthenticated refleja la presencia del token", () => {
		expect(get(isAuthenticated)).toBe(false);
		auth.login("tok-123", baseUser);
		expect(get(isAuthenticated)).toBe(true);
	});

	it("currentUser expone el usuario autenticado", () => {
		auth.login("tok-123", baseUser);
		expect(get(currentUser)).toEqual(baseUser);
	});
});
