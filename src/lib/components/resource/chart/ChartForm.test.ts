// Contrato del formulario del publicador, montado solo: es la pieza que viven las páginas de crear y editar un
// gráfico.
//
// Lo que se fija acá no es cómo se ve, es lo que **promete**:
//  · la vista previa tiene **dos niveles** (L28, decisión 1): la presentación se aplica al instante sin
//    consulta y las opciones de datos piden la vista previa solas tras una pausa corta;
//  · la respuesta vieja se descarta, y mientras se calcula el gráfico anterior sigue a la vista, atenuado y
//    anunciado como ocupado;
//  · «Guardar» no se habilita hasta que los datos dibujados corresponden a la configuración que se ve
//    (precisión de L11);
//  · un rechazo del servidor aparece en el campo que lo causó en vez de en un mensaje genérico.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartApi, ChartView } from "$lib/api/charts";
import type { DatastoreField } from "$lib/api/datastore";
import type {
	ChartConfig,
	ChartData,
	ChartGroup,
	NormalizedChartConfig,
} from "$lib/charts/contract";
import type { ChartDraft } from "$lib/charts/form";
import { FIELD_MESSAGES } from "$lib/charts/validation";
import { CkanApiError } from "$lib/types/api";
import ChartForm from "./ChartForm.svelte";

// LayerChart necesita un `ResizeObserver` que jsdom no implementa; acá no se mide el layout.
class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const FIELDS: DatastoreField[] = [
	{ id: "_id", type: "int4" },
	{ id: "turno", type: "text" },
	{ id: "horas_mes", type: "numeric" },
	{ id: "salario", type: "numeric" },
	{ id: "fecha_ingreso", type: "timestamp" },
];

/** La configuración del borrador inicial de `renderForm`, ya normalizada por el contrato. */
const NORMALIZED_CONFIG: NormalizedChartConfig = {
	version: 1,
	chart_type: "bar",
	x_field: "turno",
	x_bucket: "value",
	x_fold_case: false,
	y_agg: "avg",
	y_field: "salario",
	include_null: true,
};

/** La respuesta del contrato: los grupos que se piden, con el total de filas de la tabla. */
function makeData(groups: ChartGroup[] = [], totalRows = 200): ChartData {
	return {
		version: 1,
		config: NORMALIZED_CONFIG,
		groups,
		truncated: false,
		total_rows: totalRows,
	};
}

const okPreview = () =>
	vi.fn(async (_id: string, _config: ChartConfig): Promise<ChartData> => makeData());
const okUpdateView = () =>
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

type FormApi = Pick<ChartApi, "preview" | "createView" | "updateView">;

function makeApi(overrides: Partial<FormApi> = {}): FormApi {
	return {
		preview: (overrides.preview as ReturnType<typeof okPreview>) ?? okPreview(),
		createView: (overrides.createView as ReturnType<typeof okCreateView>) ?? okCreateView(),
		updateView: (overrides.updateView as ReturnType<typeof okUpdateView>) ?? okUpdateView(),
	};
}

function renderForm(
	api: FormApi,
	initialConfig: Partial<ChartDraft> = {
		x_field: "turno",
		y_agg: "avg",
		y_field: "salario",
	},
) {
	return render(ChartForm, {
		props: {
			fields: FIELDS,
			api,
			resourceId: "recurso-1",
			initialConfig,
		},
	});
}

const saveButton = () => screen.getByRole("button", { name: "Guardar" });

/**
 * Deja correr las promesas del doble y aplica el render que disparan. Con temporizadores falsos las
 * microtareas siguen siendo reales, así que alcanza con cederlas; el render necesita un `flushSync`.
 */
async function settle() {
	for (let i = 0; i < 4; i += 1) await Promise.resolve();
	flushSync();
}

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

describe("ChartForm — la vista previa en dos niveles (L28)", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("pide la vista previa sola al abrir, con la configuración normalizada, y recién entonces habilita «Guardar»", async () => {
		const preview = okPreview();
		renderForm(makeApi({ preview }));

		// Al abrir no hay nada que agrupar: no se espera la pausa de las opciones de datos.
		expect(preview).toHaveBeenCalledTimes(1);
		expect(preview).toHaveBeenCalledWith("recurso-1", NORMALIZED_CONFIG);
		expect(saveButton()).toBeDisabled();

		await settle();

		expect(saveButton()).toBeEnabled();
	});

	it("cambiar la presentación se aplica al instante y no pide datos", async () => {
		const preview = okPreview();
		renderForm(makeApi({ preview }));
		await settle();
		preview.mockClear();

		await pickNextOption("Tipo de gráfico");
		await fireEvent.input(screen.getByLabelText(/Título de la vista/), {
			target: { value: "Otro título" },
		});
		await fireEvent.input(screen.getByLabelText(/Descripción de la vista/), {
			target: { value: "Otra descripción" },
		});
		flushSync();

		await vi.advanceTimersByTimeAsync(1000);

		expect(preview).not.toHaveBeenCalled();
		// Los datos dibujados siguen siendo los de la configuración de datos vigente.
		expect(saveButton()).toBeEnabled();
	});

	it("varios cambios seguidos de las opciones de datos piden una sola vez, después de la pausa", async () => {
		const preview = okPreview();
		renderForm(makeApi({ preview }));
		await settle();
		preview.mockClear();

		await fireEvent.click(screen.getByLabelText(/Mostrar las filas sin dato/));
		await fireEvent.click(screen.getByLabelText(/Unificar mayúsculas/));
		await pickNextOption("Cálculo del eje vertical");
		flushSync();

		expect(preview).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(399);
		expect(preview).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);
		await settle();

		expect(preview).toHaveBeenCalledTimes(1);
		// La que se pide es la última configuración, no una intermedia.
		expect(preview.mock.calls[0]?.[1]).toMatchObject({
			y_agg: "min",
			y_field: "salario",
			x_fold_case: true,
			include_null: false,
		});
	});

	it("una configuración incompleta no pide datos y deja el error en su campo", async () => {
		const preview = okPreview();
		renderForm(makeApi({ preview }), {
			x_field: "salario",
			x_bucket: "number_step",
			x_step: "5000",
			y_agg: "count",
		});
		await settle();
		preview.mockClear();

		await fireEvent.input(screen.getByLabelText(/Tamaño del rango/), { target: { value: "" } });
		flushSync();
		await vi.advanceTimersByTimeAsync(1000);

		expect(preview).not.toHaveBeenCalled();
		expect(screen.getByText("Indique el paso del eje X.")).toBeInTheDocument();
		expect(saveButton()).toBeDisabled();
	});

	it("mientras calcula, el gráfico anterior sigue a la vista, atenuado y anunciado como ocupado", async () => {
		const preview = vi
			.fn()
			.mockImplementationOnce(async () => makeData([{ key: "mañana", value: 3 }]))
			// La segunda respuesta nunca llega: lo que se mide es el estado de espera.
			.mockImplementationOnce(() => new Promise<ChartData>(() => {}));
		renderForm(makeApi({ preview }));
		await settle();

		await fireEvent.click(screen.getByLabelText(/Mostrar las filas sin dato/));
		flushSync();

		// Apenas cambia una opción de datos, lo dibujado ya no corresponde: se dice, y el gráfico sigue ahí.
		const table = () => within(screen.getByRole("table"));
		expect(screen.getByText(/no corresponden todavía a las opciones/)).toBeInTheDocument();
		expect(table().getByText("mañana")).toBeInTheDocument();

		// Pasada la pausa el pedido está en curso: se anuncia ocupado y el gráfico anterior sigue a la vista.
		await vi.advanceTimersByTimeAsync(400);
		flushSync();

		const busy = screen.getByRole("status");
		expect(busy).toHaveTextContent(/Actualizando el gráfico/);
		expect(busy.closest("[aria-busy='true']")).not.toBeNull();
		expect(table().getByText("mañana")).toBeInTheDocument();
	});

	it("una respuesta que llega tarde se descarta: manda la más nueva", async () => {
		let rejectSlow: (reason: unknown) => void = () => {};
		const slow = new Promise<ChartData>((_resolve, reject) => {
			rejectSlow = reject;
		});
		const preview = vi
			.fn()
			.mockImplementationOnce(() => slow)
			.mockImplementationOnce(async () => makeData());
		renderForm(makeApi({ preview }));
		expect(preview).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByLabelText(/Mostrar las filas sin dato/));
		flushSync();
		await vi.advanceTimersByTimeAsync(400);
		expect(preview).toHaveBeenCalledTimes(2);
		await settle();
		expect(saveButton()).toBeEnabled();

		// La vieja llega tarde y con un rechazo que ensuciaría el campo del eje Y: se ignora.
		rejectSlow(
			new CkanApiError("Validation Error", 409, "Validation Error", {
				__type: "Validation Error",
				message: "Bad request",
				y_field: ["La columna del eje vertical debe ser numérica."],
			}),
		);
		await settle();

		expect(screen.queryByText(FIELD_MESSAGES.y_field)).toBeNull();
		expect(saveButton()).toBeEnabled();
	});

	it("«Guardar» se habilita sólo cuando los datos dibujados son los de la configuración vigente", async () => {
		const preview = okPreview();
		renderForm(makeApi({ preview }));

		// Sin datos dibujados no hay nada que guardar.
		expect(saveButton()).toBeDisabled();
		await settle();
		expect(saveButton()).toBeEnabled();

		await fireEvent.click(screen.getByLabelText(/Mostrar las filas sin dato/));
		flushSync();
		expect(saveButton()).toBeDisabled();

		await vi.advanceTimersByTimeAsync(400);
		await settle();
		expect(saveButton()).toBeEnabled();
	});
});

describe("ChartForm — no se guarda lo que no se vio", () => {
	it("guardar usa la configuración previsualizada", async () => {
		const createView = okCreateView();
		renderForm(makeApi({ createView }));
		await waitFor(() => expect(saveButton()).toBeEnabled());
		await fireEvent.input(screen.getByLabelText(/Título de la vista/), {
			target: { value: "Salario por turno" },
		});

		await fireEvent.click(saveButton());

		await waitFor(() => expect(createView).toHaveBeenCalled());
		expect(createView).toHaveBeenCalledWith(
			"recurso-1",
			"Salario por turno",
			"",
			NORMALIZED_CONFIG,
		);
		expect(await screen.findByText("Vista guardada.")).toBeInTheDocument();
	});
});

describe("ChartForm — crear, editar y cancelar (P3)", () => {
	it("crear: «Guardar» llama a createView con la configuración plana y avisa a la página", async () => {
		const createView = okCreateView();
		const updateView = okUpdateView();
		const onsaved = vi.fn();
		render(ChartForm, {
			props: {
				fields: FIELDS,
				api: makeApi({ createView, updateView }),
				resourceId: "recurso-1",
				initialConfig: { x_field: "turno", y_agg: "avg", y_field: "salario" },
				onsaved,
			},
		});
		await waitFor(() => expect(saveButton()).toBeEnabled());
		await fireEvent.input(screen.getByLabelText(/Título de la vista/), {
			target: { value: "Salario por turno" },
		});

		await fireEvent.click(saveButton());

		await waitFor(() => expect(onsaved).toHaveBeenCalledTimes(1));
		expect(createView).toHaveBeenCalledWith(
			"recurso-1",
			"Salario por turno",
			"",
			NORMALIZED_CONFIG,
		);
		expect(updateView).not.toHaveBeenCalled();
	});

	it("editar: abre con el título, la descripción y la configuración guardados, y «Guardar» llama a updateView", async () => {
		const createView = okCreateView();
		const updateView = okUpdateView();
		const onsaved = vi.fn();
		render(ChartForm, {
			props: {
				fields: FIELDS,
				api: makeApi({ createView, updateView }),
				resourceId: "recurso-1",
				viewId: "vista-9",
				initialTitle: "Salario por turno",
				initialDescription: "Promedio mensual.",
				initialConfig: { x_field: "turno", y_agg: "avg", y_field: "salario" },
				onsaved,
			},
		});
		expect(screen.getByLabelText(/Título de la vista/)).toHaveValue("Salario por turno");
		expect(screen.getByLabelText(/Descripción de la vista/)).toHaveValue("Promedio mensual.");
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.click(saveButton());

		await waitFor(() => expect(onsaved).toHaveBeenCalledTimes(1));
		expect(updateView).toHaveBeenCalledWith("vista-9", {
			title: "Salario por turno",
			description: "Promedio mensual.",
			config: NORMALIZED_CONFIG,
		});
		expect(createView).not.toHaveBeenCalled();
	});

	it("un guardado rechazado no avisa a la página: el publicador se queda en el formulario", async () => {
		const createView = vi.fn(async (): Promise<ChartView> => {
			throw new CkanApiError("Authorization Error", 403, "Authorization Error");
		});
		const onsaved = vi.fn();
		render(ChartForm, {
			props: {
				fields: FIELDS,
				api: makeApi({ createView }),
				resourceId: "recurso-1",
				initialTitle: "Salario por turno",
				initialConfig: { x_field: "turno", y_agg: "avg", y_field: "salario" },
				onsaved,
			},
		});
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.click(saveButton());

		expect(await screen.findByRole("alert")).toBeInTheDocument();
		expect(onsaved).not.toHaveBeenCalled();
	});

	it("«Cancelar» avisa a la página y no guarda nada", async () => {
		const createView = okCreateView();
		const updateView = okUpdateView();
		const oncancel = vi.fn();
		render(ChartForm, {
			props: {
				fields: FIELDS,
				api: makeApi({ createView, updateView }),
				resourceId: "recurso-1",
				initialConfig: { x_field: "turno", y_agg: "avg", y_field: "salario" },
				oncancel,
			},
		});

		await fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

		expect(oncancel).toHaveBeenCalledTimes(1);
		expect(createView).not.toHaveBeenCalled();
		expect(updateView).not.toHaveBeenCalled();
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

		// «texto» sólo admite «valor tal cual»: la agrupación se reconcilia en el mismo render, así que su
		// selector —que ya no tiene nada que preguntar (L37, punto 6)— se va sin pasar por otro rótulo, y el
		// paso se va con él.
		expect(labels).toEqual([]);
		expect(screen.queryByRole("button", { name: "Agrupación del eje horizontal" })).toBeNull();
		expect(screen.queryByLabelText("Tamaño del rango")).toBeNull();
	});
});

describe("ChartForm — el paso del rango", () => {
	// El `<input type="number">` entrega un número (o `null`), no el texto que el borrador guarda: sin
	// normalizarlo, escribir el paso reventaba el formulario en `draft.x_step.trim`.
	it("escribir el paso deja el formulario lejos y lo lee como número", async () => {
		renderForm(makeApi(), {
			x_field: "salario",
			x_bucket: "number_step",
			x_step: "",
			y_agg: "count",
		});

		expect(screen.getByText("Indique el paso del eje X.")).toBeInTheDocument();

		// El paso vacío trae su error, y el texto del error también cuelga de la etiqueta: de ahí la regex.
		await fireEvent.input(screen.getByLabelText(/Tamaño del rango/), {
			target: { value: "5000" },
		});

		expect(screen.getByLabelText(/Tamaño del rango/)).toHaveValue(5000);
		expect(screen.queryByText("Indique el paso del eje X.")).toBeNull();
	});
});

describe("ChartForm — el borrador inicial", () => {
	it("un caso inicial incoherente se reconcilia en vez de dejar el formulario en un estado inválido", async () => {
		const preview = okPreview();
		render(ChartForm, {
			props: {
				fields: FIELDS,
				api: makeApi({ preview }),
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

		await waitFor(() => expect(preview).toHaveBeenCalled());
		expect(preview.mock.calls[0]?.[1]).toMatchObject({
			x_bucket: "value",
			y_agg: "sum",
			y_field: "horas_mes",
		});
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

		expect(await screen.findByText("No se pudo confirmar el acceso")).toBeInTheDocument();
		expect(screen.getByText("Código 403")).toBeInTheDocument();
	});
});

describe("ChartForm — un selector con una sola opción no se muestra (L37, punto 6)", () => {
	const button = (name: string) => screen.queryByRole("button", { name });

	it("la agrupación aparece sólo cuando la columna ofrece más de una, y se actualiza al cambiar de columna", async () => {
		renderForm(makeApi());

		// `turno` es texto: sólo admite «Valor tal cual», así que no hay nada que elegir.
		expect(button("Agrupación del eje horizontal")).toBeNull();

		// La columna siguiente es `horas_mes`, numérica: valor o rangos.
		await pickNextOption("Columna del eje horizontal");

		await waitFor(() => expect(button("Agrupación del eje horizontal")).not.toBeNull());
		expect(button("Agrupación del eje horizontal")).toHaveTextContent("Valor tal cual");
	});

	it("el cálculo no ofrece sumar, promediar, mínimo ni máximo si no hay columnas numéricas", async () => {
		render(ChartForm, {
			props: {
				fields: [
					{ id: "_id", type: "int4" },
					{ id: "turno", type: "text" },
					{ id: "facultad", type: "text" },
				],
				api: makeApi(),
				resourceId: "recurso-1",
				initialConfig: { x_field: "turno", y_agg: "count" },
			},
		});

		const trigger = screen.getByRole("button", { name: "Cálculo del eje vertical" });
		trigger.focus();
		await fireEvent.keyDown(trigger, { key: "Enter" });
		const options = await screen.findAllByRole("option");

		expect(options.map((option) => option.textContent?.trim())).toEqual([
			"Contar filas",
			"Contar valores distintos",
		]);
	});

	it("un cálculo guardado que la tabla ya no admite vuelve a contar filas", () => {
		render(ChartForm, {
			props: {
				fields: [
					{ id: "_id", type: "int4" },
					{ id: "turno", type: "text" },
				],
				api: makeApi(),
				resourceId: "recurso-1",
				initialConfig: { x_field: "turno", y_agg: "avg", y_field: "salario" },
			},
		});

		expect(screen.getByRole("button", { name: "Cálculo del eje vertical" })).toHaveTextContent(
			"Contar filas",
		);
	});

	it("con una sola columna numérica, la columna del eje vertical no se pregunta", () => {
		render(ChartForm, {
			props: {
				fields: [
					{ id: "_id", type: "int4" },
					{ id: "turno", type: "text" },
					{ id: "salario", type: "numeric" },
				],
				api: makeApi(),
				resourceId: "recurso-1",
				initialConfig: { x_field: "turno", y_agg: "avg", y_field: "salario" },
			},
		});

		expect(button("Columna del eje vertical")).toBeNull();
	});

	it("con más de una columna numérica, la columna del eje vertical sí se pregunta", () => {
		renderForm(makeApi());

		expect(button("Columna del eje vertical")).toHaveTextContent("salario");
	});

	it("con una sola columna, el eje horizontal no se pregunta", () => {
		render(ChartForm, {
			props: {
				fields: [
					{ id: "_id", type: "int4" },
					{ id: "turno", type: "text" },
				],
				api: makeApi(),
				resourceId: "recurso-1",
				initialConfig: { x_field: "turno", y_agg: "count" },
			},
		});

		expect(button("Columna del eje horizontal")).toBeNull();
	});
});

describe("ChartForm — el título y la descripción (L37, puntos 8 y 9)", () => {
	const titleInput = () => screen.getByLabelText(/Título de la vista/);
	const descriptionInput = () => screen.getByLabelText(/Descripción de la vista/);

	it("el título es obligatorio: sin él no se guarda, y el error se dice en español en su campo", async () => {
		const createView = okCreateView();
		renderForm(makeApi({ createView }));
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.input(titleInput(), { target: { value: "   " } });
		await fireEvent.click(saveButton());

		expect(await screen.findByText("Escriba un título para la vista.")).toBeInTheDocument();
		expect(titleInput()).toHaveAttribute("aria-invalid", "true");
		expect(titleInput()).toHaveFocus();
		expect(createView).not.toHaveBeenCalled();
	});

	it("el título no puede pasar de 120 caracteres", async () => {
		const createView = okCreateView();
		renderForm(makeApi({ createView }));
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.input(titleInput(), { target: { value: "a".repeat(121) } });
		await fireEvent.click(saveButton());

		expect(
			await screen.findByText("El título no puede superar los 120 caracteres."),
		).toBeInTheDocument();
		expect(screen.getByText("121/120")).toBeInTheDocument();
		expect(createView).not.toHaveBeenCalled();
	});

	it("la descripción es opcional, de varias líneas, con su tope de 500 caracteres", async () => {
		const createView = okCreateView();
		renderForm(makeApi({ createView }));
		await waitFor(() => expect(saveButton()).toBeEnabled());

		expect(descriptionInput().tagName).toBe("TEXTAREA");
		expect(screen.getByText("0/500")).toBeInTheDocument();
		expect(screen.getByText("(opcional)")).toBeInTheDocument();

		await fireEvent.input(titleInput(), { target: { value: "Salario por turno" } });
		await fireEvent.input(descriptionInput(), { target: { value: "b".repeat(501) } });
		await fireEvent.click(saveButton());

		expect(
			await screen.findByText("La descripción no puede superar los 500 caracteres."),
		).toBeInTheDocument();
		expect(createView).not.toHaveBeenCalled();
	});

	it("el título lleva la marca de obligatorio y un contador", () => {
		renderForm(makeApi());

		const label = screen.getByText(/Título de la vista/);
		expect(label.textContent).toContain("*");
		expect(screen.getByText("0/120")).toBeInTheDocument();
	});

	it("el título y la descripción se guardan sin los espacios de los bordes", async () => {
		const createView = okCreateView();
		renderForm(makeApi({ createView }));
		await waitFor(() => expect(saveButton()).toBeEnabled());

		await fireEvent.input(titleInput(), { target: { value: "  Salario por turno  " } });
		await fireEvent.input(descriptionInput(), { target: { value: " Promedio. " } });
		await fireEvent.click(saveButton());

		await waitFor(() =>
			expect(createView).toHaveBeenCalledWith(
				"recurso-1",
				"Salario por turno",
				"Promedio.",
				NORMALIZED_CONFIG,
			),
		);
	});

	it("un rechazo del servidor no muestra su texto técnico en inglés", async () => {
		const api = makeApi({
			preview: vi.fn(async () => {
				throw new CkanApiError("HTTP 409", 409, "Validation Error", {
					__type: "Validation Error",
					message: "Bad request",
					title: ["Missing value"],
				});
			}),
		});
		renderForm(api);

		expect(
			await screen.findByText(
				"El catálogo rechazó esta configuración. Revise los campos marcados.",
			),
		).toBeInTheDocument();
		expect(screen.queryByText(/Missing value/)).toBeNull();
		expect(screen.queryByText(/Detalle técnico/)).toBeNull();
	});
});

describe("ChartForm — la disposición por defecto es la de hoy (L37, puntos 5, 7 y 10)", () => {
	it("sin props de disposición: panel a la izquierda, secciones separadas por una línea, sin acordeón ni tarjeta", () => {
		renderForm(makeApi());

		const datos = screen.getByRole("heading", { name: "Datos" }).closest("section");
		const presentacion = screen.getByRole("heading", { name: "Presentación" }).closest("section");
		const raiz = datos?.parentElement?.parentElement;

		expect(raiz?.className).toContain("lg:flex-row");
		expect(raiz?.className).not.toContain("flex-row-reverse");
		expect(datos?.className).not.toContain("border");
		expect(presentacion?.className).toContain("border-t");
		expect(screen.queryByRole("button", { name: "Datos" })).toBeNull();
		expect(screen.queryByRole("heading", { name: "Opciones del gráfico" })).toBeNull();
		expect(datos?.parentElement?.className).not.toContain("rounded-xl");
	});
});
