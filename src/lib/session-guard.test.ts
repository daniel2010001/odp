import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { goto } from "$app/navigation";
import { sessionExpiredLoginUrl } from "./session";
import { endInvalidSession } from "./session-guard";
import { auth, isAuthenticated } from "./stores/auth";
import type { CkanUser } from "./types/ckan";

const baseUser: CkanUser = {
	id: "u-1",
	name: "jdoe",
	display_name: "Jane Doe",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
	sysadmin: false,
};

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
