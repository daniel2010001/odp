import { describe, expect, it, vi } from "vitest";
import type { CkanLicense } from "$lib/types/ckan";
import type { CkanClient } from "./client";
import { createLicenseApi } from "./licenses";

function makeLicense(overrides: Partial<CkanLicense> = {}): CkanLicense {
	return {
		id: "cc-by",
		title: "Creative Commons Attribution",
		url: "https://creativecommons.org/licenses/by/4.0/",
		family: "Creative Commons",
		is_generic: "False",
		maintainer: "",
		status: "active",
		od_conformance: "approved",
		osd_conformance: "approved",
		domain_content: "False",
		domain_data: "False",
		domain_software: "False",
		...overrides,
	};
}

/** Cliente falso: responde siempre con la misma acción `license_list`. */
function makeClient(respuesta: unknown | (() => unknown)) {
	const post = vi.fn(async (_action: string) => {
		return typeof respuesta === "function" ? (respuesta as () => unknown)() : respuesta;
	});
	return { client: { post } as unknown as CkanClient, post };
}

describe("createLicenseApi.list", () => {
	it("llama a license_list y pasa los datos", async () => {
		const licencias = [
			makeLicense(),
			makeLicense({ id: "notspecified", title: "License not specified", url: "" }),
		];
		const { client, post } = makeClient(licencias);

		const resultado = await createLicenseApi(client).list();

		const [action] = post.mock.calls[0] as [string];
		expect(action).toBe("license_list");
		expect(resultado).toEqual(licencias);
	});

	it("propaga el error de CKAN", async () => {
		const { client } = makeClient(() => {
			throw new Error("500");
		});

		await expect(createLicenseApi(client).list()).rejects.toThrow("500");
	});
});
