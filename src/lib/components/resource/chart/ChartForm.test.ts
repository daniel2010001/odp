// Contrato del formulario del publicador, montado solo: es la pieza que el autor revisa en el playground y la
// que después vive en la página real.
//
// Lo que se fija acá no es cómo se ve, es lo que **promete**: que «Guardar» no se habilita hasta que la
// vista previa de esta mismísima configuración salió bien (precisión de L11), que un cambio posterior la
// vuelve a deshabilitar, y que un rechazo del servidor aparece en el campo que lo causó en vez de en un
// mensaje genérico.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { flushSync } from "svelte";
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

const saveButton = () => screen.getByRole("button", { name: "Guardar" });
const previewButton = () => screen.getByRole("button", { name: /Vista previa/ });

/**
 * Abre un selector de `bits-ui` y elige la opción siguiente con el teclado. Con puntero no se puede:
 * jsdom no implementa la captura de puntero que el `Select.Trigger` usa al abrirse.
 *
 * La última tecla **no** se espera a propósito: es el cambio de estado que el test mide.
 */
async function pickNextOption(label: string) {
	const trigger = screen.getByRole("button", { name: label });
	trigger.focus();
	await fireEvent.keyDown(trigger, { key: "Enter" });
	await screen.findAllByRole("option");
	const focused = document.activeElement ?? trigger;
	await fireEvent.keyDown(focused, { key: "ArrowDown" });
	fireEvent.keyDown(document.activeElement ?? focused, { key: "Enter" });
}

describe("ChartForm — no se guarda lo que no se vio", () => {
	it("arranca con «Guardar» deshabilitado", () => {
		renderForm(makeApi());

		expect(saveButton()).toBeDisabled();
	});

	it("pide la vista previa con la configuración normalizada y recién entonces habilita «Guardar»", async () => {
		const preview = okPreview();
		const api = makeApi({ preview });
		renderForm(api);

		await fireEvent.click(previewButton());

		await waitFor(() => expect(saveButton()).toBeEnabled());
		expect(preview).toHaveBeenCalledWith("recurso-1", EMPTY_DATA.config);
	});

	it("un cambio posterior a la vista previa vuelve a deshabilitar «Guardar»", async () => {
		renderForm(makeApi());
		await fireEvent.click(previewButton());
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.click(screen.getByLabelText(/Mostrar las filas sin dato/));

		expect(saveButton()).toBeDisabled();
	});

	it("guardar usa la configuración previsualizada", async () => {
		const createView = okCreateView();
		const api = makeApi({ createView });
		renderForm(api);
		await fireEvent.click(previewButton());
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.click(saveButton());

		await waitFor(() => expect(createView).toHaveBeenCalled());
		expect(await screen.findByText("Vista guardada.")).toBeInTheDocument();
	});
});

describe("ChartForm — el cambio de columna reconcilia en el mismo render", () => {
	// Lo que el autor reportó como «retraso» (L21): con la reconciliación en un `$effect`, cada cambio de
	// selector renderiza dos veces. El primero deja la agrupación que la columna nueva ya no admite —el
	// selector pierde su etiqueta («Seleccione una opción») y el paso sigue a la vista—, y recién el segundo,
	// el que dispara el efecto, la corrige. Se mide sobre las escrituras del DOM: un cambio, una escritura.
	const TWO_COLUMNS: DatastoreField[] = [
		{ id: "_id", type: "int4" },
		{ id: "salario", type: "numeric" },
		{ id: "turno", type: "text" },
	];

	it("pasar de una columna numérica con rangos a una de texto deja la agrupación en «Valor tal cual» en una sola escritura", async () => {
		render(ChartForm, {
			props: {
				fields: TWO_COLUMNS,
				api: makeApi(),
				resourceId: "recurso-1",
				initialConfig: {
					x_field: "salario",
					x_bucket: "number_step",
					x_step: "5000",
					y_agg: "count",
				},
			},
		});

		const grouping = () => screen.getByRole("button", { name: "Agrupación del eje horizontal" });

		// El estado de partida: rangos numéricos sobre `salario`, con su paso a la vista.
		expect(grouping()).toHaveTextContent("Rangos numéricos");
		expect(screen.getByLabelText("Tamaño del rango")).toBeInTheDocument();

		// Cada valor que la etiqueta de la agrupación mostró, en orden: `oldValue` de cada escritura y el
		// valor final. Un solo cambio del eje X no puede pasar por un rótulo que no aplique.
		const labels: string[] = [];
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				if (record.type === "characterData" && record.oldValue !== null) {
					labels.push(record.oldValue);
				}
			}
		});
		observer.observe(grouping(), {
			subtree: true,
			childList: true,
			characterData: true,
			characterDataOldValue: true,
		});

		await pickNextOption("Columna del eje horizontal");
		flushSync();
		await Promise.resolve();
		observer.disconnect();
		labels.push(grouping().textContent?.trim() ?? "");

		// «texto» sólo admite «valor tal cual»: la agrupación se reconcilia en el mismo render y el paso se va.
		expect(labels).toEqual(["Rangos numéricos", "Valor tal cual"]);
		expect(screen.queryByLabelText("Tamaño del rango")).toBeNull();
	});
});

describe("ChartForm — el paso del rango", () => {
	// El `<input type="number">` entrega un número (o `null`), no el texto que el borrador guarda: sin
	// normalizarlo, escribir el paso reventaba el formulario en `draft.x_step.trim`.
	it("escribir el paso deja el formulario lejos y lo lee como número", async () => {
		render(ChartForm, {
			props: {
				fields: FIELDS,
				api: makeApi(),
				resourceId: "recurso-1",
				initialConfig: {
					x_field: "salario",
					x_bucket: "number_step",
					x_step: "",
					y_agg: "count",
				},
			},
		});

		// El paso vacío trae su error, y el texto del error también cuelga de la etiqueta: de ahí la regex.
		await fireEvent.input(screen.getByLabelText(/Tamaño del rango/), {
			target: { value: "5000" },
		});

		expect(screen.getByLabelText(/Tamaño del rango/)).toHaveValue(5000);
		expect(previewButton()).toBeEnabled();
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

		await waitFor(() => expect(previewButton()).toBeEnabled());
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

		await fireEvent.click(previewButton());

		// El campo muestra el texto del portal para la clave; el del servidor no es copy de la interfaz (L18).
		expect(await screen.findByText(FIELD_MESSAGES.y_field)).toBeInTheDocument();
		expect(screen.queryByText("La columna del eje vertical debe ser numérica.")).toBeNull();
		expect(saveButton()).toBeDisabled();
	});

	it("una negativa de permiso se dice con el texto del catálogo, no como error de un campo", async () => {
		const api = makeApi({
			preview: vi.fn(async () => {
				throw new CkanApiError("Not authorized", 403, "Authorization Error");
			}),
		});
		renderForm(api);

		await fireEvent.click(previewButton());

		expect(await screen.findByText("No se pudo confirmar el acceso")).toBeInTheDocument();
		expect(screen.getByText("Código 403")).toBeInTheDocument();
	});
});
