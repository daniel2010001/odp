import { describe, expect, it } from "vitest";
import {
	CKAN_INTERNAL_URL_VAR,
	DEV_CKAN_INTERNAL_URL,
	resolveCkanInternalUrl,
} from "./ckan-internal-url";

// Los routes `auth/login` y `auth/logout` consumen esta función, pero no se
// pueden importar desde Vitest: `$env/dynamic/private` y `$app/environment` son
// módulos virtuales de SvelteKit sin alias en `vitest.config.ts`, y Vite falla
// en `import-analysis` antes de que `vi.mock` pueda interceptarlos. Por eso la
// decisión vive en esta función pura y la cobertura queda a este nivel.

describe("resolveCkanInternalUrl", () => {
	it("devuelve el valor configurado, recortado", () => {
		const url = resolveCkanInternalUrl(" http://ckan:5000 ", false);

		expect(url).toBe("http://ckan:5000");
	});

	it("sin configurar y en dev (host `pnpm dev`) usa http://localhost:5000", () => {
		const url = resolveCkanInternalUrl(undefined, true);

		expect(url).toBe("http://localhost:5000");
		expect(url).toBe(DEV_CKAN_INTERNAL_URL);
	});

	it("sin configurar y sin dev falla ruidosamente nombrando CKAN_INTERNAL_URL", () => {
		expect(() => resolveCkanInternalUrl(undefined, false)).toThrowError(
			new RegExp(CKAN_INTERNAL_URL_VAR),
		);
	});

	it("una cadena vacía o sólo espacios con isDev=false también falla (el despliegue que olvidó la variable)", () => {
		for (const configured of ["", "   ", "\t\n"]) {
			expect(() => resolveCkanInternalUrl(configured, false)).toThrowError(
				new RegExp(CKAN_INTERNAL_URL_VAR),
			);
		}
	});

	it("una cadena vacía o sólo espacios sigue cayendo al default de dev cuando isDev es true", () => {
		for (const configured of ["", "   "]) {
			expect(resolveCkanInternalUrl(configured, true)).toBe(DEV_CKAN_INTERNAL_URL);
		}
	});
});
