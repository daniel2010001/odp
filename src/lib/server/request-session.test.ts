// Pruebas de **la sesión de un request**: lo que `hooks.server.ts` hace con la cookie antes de que ninguna ruta
// corra (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, § El diseño de T4, D1).
//
// Lo que estas pruebas fijan, y por qué cada una:
//  1. **Tres estados que no se confunden**: sin cookie es anónimo (un visitante leyendo lo público tiene que
//     seguir funcionando), con cookie que abre es una sesión con su usuario, y con cookie que no abre es una
//     sesión **muerta**.
//  2. **Sólo la muerta se borra**: el primer pedido responde `401` (la señal de expulsión) y los siguientes son
//     anónimos; sin el borrado el `401` sería eterno y rompería la navegación pública tras un vencimiento.
//  3. **La clave se resuelve sólo si hay cookie**: el camino anónimo no puede depender de una variable
//     obligatoria que no necesita, o un despliegue sin ella dejaría de servir lo público.
//  4. **El token no sale por el usuario**: lo que el layout entrega al navegador es el usuario, nunca la
//     credencial.
//
// La clave y el reloj entran por parámetro, igual que en `session.test.ts`: `$env` y `$app` no resuelven en
// Vitest.

import { describe, expect, it, vi } from "vitest";
import { resolveRequestSession } from "./request-session";
import { buildSession, sealSession } from "./session";

const SECRET = "clave-de-prueba-con-largo-suficiente-0001";
const OTHER_SECRET = "otra-clave-de-prueba-con-largo-suficiente-0002";
const NOW = 1_800_000_000_000;
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ0b2tlbi1kZS1wcnVlYmEifQ.firma-de-prueba";

function cookieViva(overrides: { sysadmin?: boolean; now?: number } = {}): string {
	return sealSession(
		buildSession(
			TOKEN,
			{
				id: "u-1",
				name: "ckan_admin",
				display_name: "Administración del catálogo",
				created: "2026-10-01T00:00:00.000000",
				state: "active",
				sysadmin: overrides.sysadmin,
			},
			overrides.now ?? NOW,
		),
		SECRET,
	);
}

describe("la sesión de un request", () => {
	it("sin cookie es anónimo, sin usuario y sin nada que borrar", () => {
		const resolved = resolveRequestSession({
			cookie: undefined,
			resolveSecret: () => SECRET,
			now: NOW,
		});

		expect(resolved).toEqual({ session: "anonymous", user: null, clearCookie: false });
	});

	it("con una cookie que abre es la sesión con el token y el usuario, sin borrar nada", () => {
		const resolved = resolveRequestSession({
			cookie: cookieViva({ sysadmin: true }),
			resolveSecret: () => SECRET,
			now: NOW,
		});

		expect(resolved.session).toEqual({ token: TOKEN });
		expect(resolved.user).toEqual({
			id: "u-1",
			name: "ckan_admin",
			displayName: "Administración del catálogo",
			sysadmin: true,
		});
		expect(resolved.clearCookie).toBe(false);
	});

	it("una cookie sellada con otra clave es una sesión muerta y se borra", () => {
		const resolved = resolveRequestSession({
			cookie: cookieViva(),
			resolveSecret: () => OTHER_SECRET,
			now: NOW,
		});

		expect(resolved).toEqual({ session: "dead", user: null, clearCookie: true });
	});

	it("una cookie vencida es una sesión muerta y se borra", () => {
		const resolved = resolveRequestSession({
			cookie: cookieViva({ now: NOW - 2 * 86_400_000 }),
			resolveSecret: () => SECRET,
			now: NOW,
		});

		expect(resolved).toEqual({ session: "dead", user: null, clearCookie: true });
	});

	it("una cookie que no es una sesión (basura o vacía) es una sesión muerta y se borra", () => {
		for (const cookie of ["basura", ""]) {
			const resolved = resolveRequestSession({
				cookie,
				resolveSecret: () => SECRET,
				now: NOW,
			});

			expect(resolved).toEqual({ session: "dead", user: null, clearCookie: true });
		}
	});

	it("la clave se resuelve sólo cuando hay cookie", () => {
		const resolveSecret = vi.fn(() => SECRET);

		resolveRequestSession({ cookie: undefined, resolveSecret, now: NOW });
		expect(resolveSecret).not.toHaveBeenCalled();

		resolveRequestSession({ cookie: cookieViva(), resolveSecret, now: NOW });
		expect(resolveSecret).toHaveBeenCalledTimes(1);
	});

	it("si la clave no está configurada el error sube: una cookie que no se puede abrir no se declara muerta", () => {
		const resolveSecret = () => {
			throw new Error("SESSION_SECRET no está configurada");
		};

		expect(() => resolveRequestSession({ cookie: cookieViva(), resolveSecret, now: NOW })).toThrow(
			"SESSION_SECRET",
		);
	});

	it("el usuario que sale de la sesión no lleva el token en ningún campo", () => {
		const { user } = resolveRequestSession({
			cookie: cookieViva(),
			resolveSecret: () => SECRET,
			now: NOW,
		});

		expect(JSON.stringify(user)).not.toContain(TOKEN);
		expect(user).not.toHaveProperty("token");
	});
});
