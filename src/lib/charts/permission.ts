// ¿Puede el usuario actual editar los gráficos de un recurso?
//
// Es la misma regla que la página del dataset usa para ofrecer «Editar» (`listUpdatableOrganizationIds`): la
// organización dueña del dataset tiene que estar entre las que el usuario puede actualizar. El servidor exige
// `resource_update` de todos modos, así que esto sólo evita ofrecer lo que fallaría. «No lo sé» es «no»: ante
// un fallo de la consulta no se muestra ninguna acción.

import type { CkanClient } from "$lib/api/client";
import { createOrganizationApi } from "$lib/api/organizations";
import type { CkanPackage } from "$lib/types/ckan";
import { ownerOrgIdOf } from "$lib/utils/ckan";

export async function canEditResourceCharts(
	client: CkanClient,
	dataset: CkanPackage | null,
): Promise<boolean> {
	if (!dataset) return false;
	try {
		const updatable = await createOrganizationApi(client).listUpdatableOrganizationIds();
		return updatable.state === "known" && updatable.ids.includes(ownerOrgIdOf(dataset));
	} catch {
		return false;
	}
}
