// Contrato del formulario del publicador, montado solo: es la pieza que el autor revisa en el playground y la
// que después vive en la página real.
//
// Lo que se fija acá no es cómo se ve, es lo que **promete**: que «Guardar» no se habilita hasta que la
// vista previa de esta mismísima configuración salió bien (precisión de L11), que un cambio posterior la
// vuelve a deshabilitar, y que un rechazo del servidor aparece en el campo que lo causó en vez de en un
// mensaje genérico.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import type { ChartApi, ChartView } from "$lib/api/charts";
import type { DatastoreField } from "$lib/api/datastore";
import type { ChartConfig, ChartData } from "$lib/charts/contract";
import { FIELD_MESSAGES } from "$lib/charts/validation";
import { CkanApiError } from "$lib/types/api";
import ChartForm from "./ChartForm.svelte";

const FIELDS: DatastoreField[] = [
	{ id: "_id", type: "int4" },
	{ id: "turno", type: "text" },
	{ id: "horas_mes", type: "numeric" },
	{ id: "salario", type: "numeric" },
	{ id: "fecha_ingreso", type: "timestamp" },
];

/** La respuesta del contrato, con grupos vacíos: así el test no depende de dibujar el SVG. */
const EMPTY_DATA: ChartData = {
	version: 1,
	config: {
		version: 1,
		chart_type: "bar",
		x_field: "turno",
		x_bucket: "value",
		x_fold_case: false,
		y_agg: "avg",
		y_field: "salario",
		include_null: true,
	},
	groups: [],
	truncated: false,
	total_rows: 200,
};

const okPreview = () =>
	vi.fn(async (_id: string, _config: ChartConfig): Promise<ChartData> => EMPTY_DATA);
const okCreateView = () =>
	vi.fn(
		async (): Promise<ChartView> => ({
			id: "vista-1",
			resource_id: "recurso-1",
			view_type: "umss_chart",
			title: "",
			description: "",
			config: {},
		}),
	);

function makeApi(
	overrides: Partial<Pick<ChartApi, "preview" | "createView">> = {},
): Pick<ChartApi, "preview" | "createView"> {
	return {
		preview: (overrides.preview as ReturnType<typeof okPreview>) ?? okPreview(),
		createView: (overrides.createView as ReturnType<typeof okCreateView>) ?? okCreateView(),
	};
}

function renderForm(api: Pick<ChartApi, "preview" | "createView">) {
	return render(ChartForm, {
		props: {
			fields: FIELDS,
			api,
			resourceId: "recurso-1",
			initialConfig: { x_field: "turno", y_agg: "avg", y_field: "salario" },
		},
	});
}

const guardar = () => screen.getByRole("button", { name: "Guardar" });
const vistaPrevia = () => screen.getByRole("button", { name: /Vista previa/ });

describe("ChartForm — no se guarda lo que no se vio", () => {
	it("arranca con «Guardar» deshabilitado", () => {
		renderForm(makeApi());

		expect(guardar()).toBeDisabled();
	});

	it("pide la vista previa con la configuración normalizada y recién entonces habilita «Guardar»", async () => {
		const preview = okPreview();
		const api = makeApi({ preview });
		renderForm(api);

		await fireEvent.click(vistaPrevia());

		await waitFor(() => expect(guardar()).toBeEnabled());
		expect(preview).toHaveBeenCalledWith("recurso-1", EMPTY_DATA.config);
	});

	it("un cambio posterior a la vista previa vuelve a deshabilitar «Guardar»", async () => {
		renderForm(makeApi());
		await fireEvent.click(vistaPrevia());
		await waitFor(() => expect(guardar()).toBeEnabled());

		await fireEvent.click(screen.getByLabelText(/Mostrar las filas sin dato/));

		expect(guardar()).toBeDisabled();
	});

	it("guardar usa la configuración previsualizada", async () => {
		const createView = okCreateView();
		const api = makeApi({ createView });
		renderForm(api);
		await fireEvent.click(vistaPrevia());
		await waitFor(() => expect(guardar()).toBeEnabled());

		await fireEvent.click(guardar());

		await waitFor(() => expect(createView).toHaveBeenCalled());
		expect(await screen.findByText("Vista guardada.")).toBeInTheDocument();
	});
});

describe("ChartForm — el borrador inicial", () => {
	it("un caso inicial incoherente se reconcilia en vez de dejar el formulario en un estado inválido", async () => {
		render(ChartForm, {
			props: {
				fields: FIELDS,
				api: makeApi(),
				resourceId: "recurso-1",
				// Trimestre sobre una columna de texto, un paso que no aplica y sumar una columna de texto: nada de
				// esto se puede elegir, así que el borrador tiene que caer a una combinación válida sola.
				initialConfig: {
					x_field: "turno",
					x_bucket: "quarter",
					x_step: "5000",
					x_fold_case: true,
					y_agg: "sum",
					y_field: "turno",
				},
			},
		});

		await waitFor(() => expect(vistaPrevia()).toBeEnabled());
	});
});

describe("ChartForm — los errores del servidor vuelven a su campo", () => {
	it("un rechazo con clave culpable se muestra en ese campo", async () => {
		const api = makeApi({
			preview: vi.fn(async () => {
				throw new CkanApiError("HTTP 409", 409, "Validation Error", {
					__type: "Validation Error",
					message: "Bad request",
					y_field: ["La columna del eje vertical debe ser numérica."],
				});
			}),
		});
		renderForm(api);

		await fireEvent.click(vistaPrevia());

		// El campo muestra el texto del portal para la clave; el del servidor no es copy de la interfaz (L18).
		expect(await screen.findByText(FIELD_MESSAGES.y_field)).toBeInTheDocument();
		expect(screen.queryByText("La columna del eje vertical debe ser numérica.")).toBeNull();
		expect(guardar()).toBeDisabled();
	});

	it("una negativa de permiso se dice con el texto del catálogo, no como error de un campo", async () => {
		const api = makeApi({
			preview: vi.fn(async () => {
				throw new CkanApiError("Not authorized", 403, "Authorization Error");
			}),
		});
		renderForm(api);

		await fireEvent.click(vistaPrevia());

		expect(await screen.findByText("No se pudo confirmar el acceso")).toBeInTheDocument();
		expect(screen.getByText("Código 403")).toBeInTheDocument();
	});
});
