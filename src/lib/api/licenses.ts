// API: operaciones sobre licencias

import type { CkanLicense } from "$lib/types/ckan";
import type { CkanClient } from "./client";

export function createLicenseApi(client: CkanClient) {
	return {
		/** Listar todas las licencias disponibles */
		async list(): Promise<CkanLicense[]> {
			return client.post<CkanLicense[]>("license_list");
		},
	};
}

export type LicenseApi = ReturnType<typeof createLicenseApi>;
