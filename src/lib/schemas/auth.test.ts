import { describe, expect, it } from "vitest";
import { loginSchema } from "./auth";

describe("loginSchema", () => {
	it("acepta credenciales válidas", () => {
		const result = loginSchema.safeParse({ username: "jdoe", password: "secret123" });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ username: "jdoe", password: "secret123" });
		}
	});

	it("rechaza username vacío con mensaje en español", () => {
		const result = loginSchema.safeParse({ username: "", password: "secret123" });

		expect(result.success).toBe(false);
		if (!result.success) {
			const issue = result.error.issues.find((i) => i.path[0] === "username");
			expect(issue?.message).toBe("El nombre de usuario es obligatorio");
		}
	});

	it("rechaza username de solo espacios (trim)", () => {
		const result = loginSchema.safeParse({ username: "   ", password: "secret123" });

		expect(result.success).toBe(false);
	});

	it("rechaza password corto con mensaje en español", () => {
		const result = loginSchema.safeParse({ username: "jdoe", password: "123" });

		expect(result.success).toBe(false);
		if (!result.success) {
			const issue = result.error.issues.find((i) => i.path[0] === "password");
			expect(issue?.message).toBe("La contraseña debe tener al menos 8 caracteres");
		}
	});
});
