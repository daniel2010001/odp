// API: las vistas de gráfico de un recurso (`umss_chart`) y la acción que agrega en el DataStore.
//
// Sigue la forma del resto de la capa de cliente (`createXApi(client)`): acá no hay permisos ni decisiones,
// sólo el nombre exacto de la acción y la forma exacta del payload. Quien autoriza es CKAN con la identidad
// del token, y el contrato que estas llamadas hablan vive en `$lib/charts/contract.ts`
// (`odd/tasks/csv-charts.md`, § «El contrato entre el portal y `ckanext-umss` (versión 1, 2026-10-17)»).
//
// Dos detalles que no son de estilo y que el catálogo no perdona:
//  · **La configuración de la vista viaja plana**, al tope del payload de `resource_view_create` /
//    `resource_view_update`, y **vuelve plana** en el diccionario de `resource_view_list`. CKAN guarda en
//    `config` sólo lo que el `schema` del plugin declara, y lee esas claves del tope del payload (L9, L10 y
//    la medición de O1 sobre CKAN 2.12). Un `config` anidado se rechaza al escribir y no existe al leer; el
//    único pedido que anida una `config` es `umss_chart_data` en su forma de editor.
//  · **Los identificadores se llaman como CKAN los llama**: `{ id }` para la vista y para el recurso en
//    `resource_view_list`, `{ view_id }` para la forma del visitante de `umss_chart_data`, y
//    `{ resource_id }` para la del editor.
//
// Y un error del catálogo que conviene no confundir: un recurso **sin tabla en el DataStore** responde
// `ObjectNotFound`, igual que `datastore_search` (medido por la sesión del backend en O1). No es un recurso
// inexistente; es un recurso que existe y no tiene datos tabulares que graficar.

import type { ChartConfig, ChartData } from "$lib/charts/contract";
import { CHART_VIEW_TYPE, pickChartConfig } from "$lib/charts/contract";
import type { CkanClient } from "./client";

/**
 * Una vista de recurso con su configuración ya tipada.
 *
 * La `config` es **parcial** a propósito: el catálogo devuelve sólo las claves que el `schema` del plugin
 * declaró, y dar por hecho que están todas sería afirmar algo que el portal no comprobó. Las claves
 * presentes vienen tipadas del servidor, con los valores por defecto aplicados (O1, CKAN 2.12).
 */
export interface ChartView {
	id: string;
	resource_id: string;
	view_type: string;
	title: string;
	description: string;
	config: Partial<ChartConfig>;
}

/** La vista tal como la devuelve el catálogo: la config **al tope**, no dentro de `config`. */
interface CkanChartView extends Record<string, unknown> {
	id: string;
	resource_id?: string;
	view_type?: string;
	title?: string;
	description?: string;
}

export interface ChartViewUpdate {
	title: string;
	description: string;
	config: ChartConfig;
}

/**
 * El diccionario plano del catálogo → la vista con `config` tipada.
 *
 * Se aplica también a lo que devuelven `resource_view_create` y `resource_view_update`: el catálogo
 * devuelve la vista guardada en la misma forma plana que `resource_view_list`, no un objeto con `config`.
 */
function toChartView(view: CkanChartView): ChartView {
	return {
		id: view.id,
		resource_id: view.resource_id ?? "",
		view_type: view.view_type ?? CHART_VIEW_TYPE,
		title: view.title ?? "",
		description: view.description ?? "",
		config: pickChartConfig(view),
	};
}

export function createChartApi(client: CkanClient) {
	return {
		/** Las vistas `umss_chart` del recurso; el visitante las ve en la página del recurso. */
		async listViews(resourceId: string): Promise<ChartView[]> {
			const views = await client.post<CkanChartView[]>("resource_view_list", { id: resourceId });
			return views.filter((view) => view.view_type === CHART_VIEW_TYPE).map(toChartView);
		},

		/** Los grupos de una vista **guardada** (la llamada del visitante). */
		async data(viewId: string): Promise<ChartData> {
			return client.post<ChartData>("umss_chart_data", { view_id: viewId });
		},

		/** Los grupos de una configuración **sin guardar** (la vista previa del editor). */
		async preview(resourceId: string, config: ChartConfig): Promise<ChartData> {
			return client.post<ChartData>("umss_chart_data", { resource_id: resourceId, config });
		},

		/** Guarda una vista nueva. La `config` va plana: ver la nota del tope del archivo. */
		async createView(
			resourceId: string,
			title: string,
			description: string,
			config: ChartConfig,
		): Promise<ChartView> {
			const view = await client.post<CkanChartView>("resource_view_create", {
				resource_id: resourceId,
				title,
				description,
				view_type: CHART_VIEW_TYPE,
				...config,
			});
			return toChartView(view);
		},

		/**
		 * Actualiza una vista existente. **No** se manda `view_type`: el catálogo ya lo tiene guardado y lo
		 * usa para elegir el `schema` con el que valida la configuración.
		 */
		async updateView(viewId: string, changes: ChartViewUpdate): Promise<ChartView> {
			const view = await client.post<CkanChartView>("resource_view_update", {
				id: viewId,
				title: changes.title,
				description: changes.description,
				...changes.config,
			});
			return toChartView(view);
		},

		/** Borra la vista. El recurso y el DataStore no se tocan. */
		async deleteView(viewId: string): Promise<void> {
			await client.post<void>("resource_view_delete", { id: viewId });
		},
	};
}

export type ChartApi = ReturnType<typeof createChartApi>;
