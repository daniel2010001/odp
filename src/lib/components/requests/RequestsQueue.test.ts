// Pruebas de `RequestsQueue`, la cola de la page de solicitudes (variante C1, ronda 6).
// jsdom no resuelve media ni container queries: lo que depende del ancho (la fila de pestañas y «Mostrar», el pie
// en filas o en línea) se afirma por sus clases y se midió en Chromium sobre la page real.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecidePublicationRequest } from "$lib/components/dataset/publication-decision";
import { FIELD_CHEVRON_CLASS, FIELD_CLASS } from "$lib/components/ui/tabs/overflow-tabs";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import {
	ADMIN_ID,
	AHORA,
	type Caso,
	datasetDeLaSolicitud,
	datasetPublicado,
	EDITOR_ID,
	ID_OBSOLETA,
	itemsDelCaso,
} from "./fixtures";
import RequestsQueue from "./RequestsQueue.svelte";
import type { QueueItem } from "./requests-model";

// El alto de la barra pegada se mide con `ResizeObserver`, que jsdom no trae.
beforeAll(() => {
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		},
	);
});

const COMMENT_LABEL = "Comentario (obligatorio para rechazar)";

/** El doble de `publication_request_decide`: concede, salvo la fila obsoleta, que devuelve el 409 de la carrera. */
function fakeDecide(caso: Caso): DecidePublicationRequest {
	return async (id, approve, comments) => {
		if (caso === "obsoleta" && id === ID_OBSOLETA) {
			throw new CkanApiError("Validation Error", 409, "Validation Error", {
				__type: "Validation Error",
				request_id: ["La solicitud ya no está pendiente."],
			});
		}
		const base = itemsDelCaso(caso).find((i) => i.id === id);
		return {
			id,
			dataset_id: base?.dataset_id ?? id,
			status: approve ? "approved" : "rejected",
			comments: comments ?? null,
			approved_by_name: "admin.tecnologia",
			decided_at: "2026-10-20T12:00:00",
		} as Awaited<ReturnType<DecidePublicationRequest>>;
	};
}

/**
 * `readDataset` que cuenta: el resumen de la fila abierta y la confirmación de una aprobación pasan por ahí. La primera
 * lectura de un dataset lo encuentra privado, como llega a la cola; las siguientes lo encuentran ya público, que es lo
 * que una aprobación confirmada deja almacenado.
 */
const leidos = new Set<string>();
const readDataset = vi.fn(async (id: string): Promise<CkanPackage> => {
	if (leidos.has(id)) return datasetPublicado(id);
	leidos.add(id);
	return datasetDeLaSolicitud(id);
});

interface Opciones {
	caso?: Caso;
	rol?: "admin" | "solicitante";
	items?: QueueItem[];
	list?: () => Promise<QueueItem[]>;
	surface?: "card" | "background";
}

function abrir({ caso = "varias", rol = "admin", items, list, surface }: Opciones = {}) {
	const filas = items ?? itemsDelCaso(caso);
	const lista = vi.fn(list ?? (async () => filas));
	const view = render(RequestsQueue, {
		list: lista,
		decide: fakeDecide(caso),
		readDataset,
		currentUser: rol === "admin" ? ADMIN_ID : EDITOR_ID,
		now: AHORA,
		...(surface ? { surface } : {}),
	});
	return { lista, ...view };
}

/** Monta y espera a que la cola termine de cargar. */
async function abrirYEsperar(opciones: Opciones = {}) {
	const montada = abrir(opciones);
	await waitFor(() => expect(screen.queryByText("Cargando solicitudes…")).not.toBeInTheDocument());
	return montada;
}

const tablist = () => screen.queryByRole("tablist", { name: "Organización" });
const mostrar = () => screen.getByRole("combobox", { name: /Mostrar/ }) as HTMLSelectElement;
const textoDe = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, " ").trim();
// Anclado: el control de decidir también nombra el dataset («Aprobar Matrícula 2026»).
const cabecera = (titulo: string) => screen.getByRole("button", { name: new RegExp(`^${titulo}`) });
const titulosEnOrden = () =>
	[...document.querySelectorAll("[data-request-id]")].map((li) =>
		textoDe(li.querySelector("[data-testid=fila-cabecera] button, [data-testid=fila-cabecera] a")),
	);

beforeEach(() => {
	leidos.clear();
	readDataset.mockClear();
});

describe("RequestsQueue — la carga", () => {
	it("pide las filas una sola vez; mientras carga lo dice y después lista", async () => {
		const { lista } = abrir();
		expect(screen.getByText("Cargando solicitudes…")).toBeInTheDocument();
		expect(await screen.findByText("Matrícula 2026")).toBeInTheDocument();
		expect(lista).toHaveBeenCalledTimes(1);
		expect(screen.queryByText("Cargando solicitudes…")).not.toBeInTheDocument();
	});

	it("un fallo al cargar no se disfraza de lista vacía: lo dice y ofrece reintentar", async () => {
		const lista = vi
			.fn<() => Promise<QueueItem[]>>()
			.mockRejectedValueOnce(new CkanApiError("Boom", 500, "Server Error", {}))
			.mockResolvedValue(itemsDelCaso("varias"));
		abrir({ list: lista });
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"No se pudieron cargar las solicitudes.",
		);
		expect(screen.queryByText("No hay solicitudes de publicación.")).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: /Reintentar/ }));
		expect(await screen.findByText("Matrícula 2026")).toBeInTheDocument();
		expect(lista).toHaveBeenCalledTimes(2);
	});

	it("vacía: dice que no hay solicitudes de publicación", async () => {
		abrir({ caso: "vacia" });
		expect(await screen.findByText("No hay solicitudes de publicación.")).toBeInTheDocument();
	});
});

describe("RequestsQueue — el orden: quien esperó más, arriba", () => {
	it("las pendientes van de la más antigua a la más nueva", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(titulosEnOrden()).toEqual([
			"Encuesta de satisfacción 2024 (decidir)",
			"Presupuesto de investigación 2026 (decidir)",
			"Matrícula 2026 (decidir)",
			"Inventario de laboratorios 2025 (decidir)",
		]);
	});

	it("las resueltas siguen con la más nueva primero", async () => {
		await abrirYEsperar({ caso: "varias" });
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(titulosEnOrden()[0]).toMatch(/^Calendario académico 2026/);
		expect(titulosEnOrden()[1]).toMatch(/^Graduados por carrera/);
	});

	it("«Todas» pone las pendientes (más antigua primero) antes que las resueltas", async () => {
		await abrirYEsperar({ caso: "varias" });
		await fireEvent.change(mostrar(), { target: { value: "todas" } });
		const orden = titulosEnOrden();
		expect(orden[0]).toMatch(/^Encuesta de satisfacción 2024/);
		expect(orden[3]).toMatch(/^Inventario de laboratorios 2025/);
		expect(orden[4]).toMatch(/^Calendario académico 2026/);
	});

	it("la que arranca abierta es la pendiente más antigua que quien mira puede decidir", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(cabecera("Encuesta de satisfacción 2024")).toHaveAttribute("aria-expanded", "true");
		expect(cabecera("Presupuesto de investigación 2026")).toHaveAttribute("aria-expanded", "false");
	});
});

describe("RequestsQueue — el resumen del dataset en el panel abierto", () => {
	it("la fila abierta lo trae del catálogo y dice organización, licencia, recursos con sus formatos y visibilidad", async () => {
		await abrirYEsperar({ caso: "varias" });
		const resumen = await screen.findByTestId("resumen-dataset");
		await waitFor(() => expect(resumen).toHaveTextContent("Facultad de Tecnología"));
		expect(resumen).toHaveTextContent("CC BY — Atribución");
		expect(resumen).toHaveTextContent("3 recursos (CSV, JSON)");
		expect(resumen).toHaveTextContent("Privado");
		expect(readDataset).toHaveBeenCalledTimes(1);
		expect(readDataset).toHaveBeenCalledWith("pkg-p3");
	});

	it("las filas cerradas no piden nada; abrir una la pide, y cerrarla y reabrirla no la vuelve a pedir", async () => {
		await abrirYEsperar({ caso: "varias" });
		await screen.findByTestId("resumen-dataset");
		expect(readDataset.mock.calls.map((c) => c[0])).toEqual(["pkg-p3"]);

		const boton = cabecera("Presupuesto de investigación 2026");
		await fireEvent.click(boton);
		await waitFor(() => expect(readDataset).toHaveBeenCalledWith("pkg-p2"));
		expect(readDataset).toHaveBeenCalledTimes(2);

		await fireEvent.click(boton);
		await fireEvent.click(boton);
		await waitFor(() => expect(boton).toHaveAttribute("aria-expanded", "true"));
		expect(readDataset).toHaveBeenCalledTimes(2);
	});

	it("mientras llega dice que carga y no muestra datos inventados", async () => {
		readDataset.mockImplementationOnce(() => new Promise(() => {}));
		await abrirYEsperar({ caso: "varias" });
		const resumen = await screen.findByTestId("resumen-dataset");
		expect(resumen).toHaveAttribute("aria-busy", "true");
		expect(resumen).not.toHaveTextContent("Privado");
		expect(resumen).not.toHaveTextContent("Público");
	});

	it("si el catálogo falla, el fallo es discreto: una frase sin alerta, y decidir sigue disponible", async () => {
		readDataset.mockRejectedValueOnce(new CkanApiError("Boom", 500, "Server Error", {}));
		await abrirYEsperar({ caso: "varias" });
		const resumen = await screen.findByTestId("resumen-dataset");
		await waitFor(() =>
			expect(resumen).toHaveTextContent("No se pudo cargar el resumen del dataset."),
		);
		expect(within(resumen).queryByRole("alert")).toBeNull();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getAllByRole("button", { name: "Aprobar" })).toHaveLength(1);
	});

	it("un dataset ya público lo dice así", async () => {
		readDataset.mockResolvedValueOnce({ ...datasetPublicado("pkg-p3"), private: false });
		await abrirYEsperar({ caso: "varias" });
		const resumen = await screen.findByTestId("resumen-dataset");
		await waitFor(() => expect(resumen).toHaveTextContent("Público"));
	});

	it("una resuelta abierta no pide el resumen: sólo la decisión pendiente lo necesita", async () => {
		await abrirYEsperar({ caso: "varias" });
		await screen.findByTestId("resumen-dataset");
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		await fireEvent.click(cabecera("Convenios interinstitucionales"));
		expect(readDataset).toHaveBeenCalledTimes(1);
	});
});

describe("RequestsQueue — lo que ya estaba decidido se conserva", () => {
	it("sólo la primera solicitud decidible está abierta", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(await screen.findAllByLabelText(COMMENT_LABEL)).toHaveLength(1);
	});

	it("cuatro ojos: la propia no se abre sola y, al abrirla, dice por qué no se decide", async () => {
		await abrirYEsperar({ caso: "propia" });
		expect(await screen.findAllByLabelText(COMMENT_LABEL)).toHaveLength(1);
		expect(cabecera("Actas del consejo")).toHaveAttribute("aria-expanded", "true");
		await fireEvent.click(cabecera("Directorio de investigadores"));
		expect(screen.getByText("No puede aprobar su propia solicitud.")).toBeInTheDocument();
	});

	it("cada fila abierta enlaza al dataset en una pestaña nueva", async () => {
		await abrirYEsperar({ caso: "solo-pendientes" });
		const links = screen.getAllByRole("link", { name: "Abrir el dataset" });
		expect(links[0]).toHaveAttribute("href", "/dataset/pkg-p3");
		expect(links[0]).toHaveAttribute("target", "_blank");
	});

	it("rechazar sin motivo no se envía; con motivo la fila pasa a «Resueltas»", async () => {
		await abrirYEsperar({ caso: "varias" });
		await fireEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
		expect(
			screen.getByText("Para rechazar una solicitud debe escribir un motivo."),
		).toBeInTheDocument();
		await fireEvent.input(screen.getByLabelText(COMMENT_LABEL), { target: { value: "Falta" } });
		await fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
		expect(await screen.findByRole("status")).toHaveTextContent("La solicitud fue rechazada.");
		expect(within(mostrar()).getByRole("option", { name: "Pendientes (3)" })).toBeInTheDocument();
		expect(within(mostrar()).getByRole("option", { name: "Resueltas (7)" })).toBeInTheDocument();
	});

	it("aprobar anuncia el desenlace y la fila queda resuelta con quien la decidió", async () => {
		await abrirYEsperar({ caso: "varias" });
		await fireEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
		expect(await screen.findByRole("status")).toHaveTextContent("La solicitud fue aprobada.");
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(screen.getAllByTestId("status-line").map((l) => textoDe(l))).toContain(
			"Aprobada por admin.tecnologia el 20 de octubre de 2026",
		);
	});

	it("la fila obsoleta dice «ya fue decidida» y «Actualizar la lista» vuelve a pedir la lista al catálogo", async () => {
		const base = itemsDelCaso("obsoleta");
		const lista = vi
			.fn<() => Promise<QueueItem[]>>()
			.mockResolvedValueOnce(base)
			.mockResolvedValue(
				base.map((i) =>
					i.id === ID_OBSOLETA
						? {
								...i,
								status: "approved",
								approved_by_name: "otro administrador",
								decided_at: "2026-10-20T11:00:00",
							}
						: i,
				),
			);
		abrir({ caso: "obsoleta", list: lista });
		await fireEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
		expect(
			await screen.findByText("Esta solicitud ya fue decidida por otra persona."),
		).toBeInTheDocument();
		expect(screen.queryByText("No se pudo registrar la decisión.")).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole("button", { name: "Actualizar la lista" }));
		await waitFor(() =>
			expect(
				screen.queryByText("Esta solicitud ya fue decidida por otra persona."),
			).not.toBeInTheDocument(),
		);
		expect(lista).toHaveBeenCalledTimes(2);
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(screen.getAllByTestId("status-line").map((l) => textoDe(l))).toContain(
			"Aprobada por otro administrador el 20 de octubre de 2026",
		);
	});
});

describe("RequestsQueue — las resueltas y «Ver N más»", () => {
	it("acota las resueltas a cinco y ofrece «Ver N más»", async () => {
		await abrirYEsperar({ caso: "muchas-resueltas" });
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(document.querySelectorAll("[data-request-id]")).toHaveLength(5);
		await fireEvent.click(screen.getByRole("button", { name: "Ver 9 más" }));
		expect(document.querySelectorAll("[data-request-id]")).toHaveLength(14);
		expect(screen.getByRole("button", { name: "Ver menos" })).toBeInTheDocument();
	});

	it("con cinco resueltas o menos no ofrece «Ver más»", async () => {
		await abrirYEsperar({ caso: "solo-pendientes" });
		expect(screen.queryByRole("button", { name: /^Ver \d+ más$/ })).not.toBeInTheDocument();
	});
});

describe("RequestsQueue — el texto de la línea de estado («Aprobadapor»)", () => {
	// Sin normalizar los espacios: lo que se pinta es lo que se lee. Una línea con el estado pegado a «por» pasaba
	// todas las pruebas de `getByText(/por admin…/)` y se veía mal.
	const LINEAS = {
		"Calendario académico 2026": "Aprobada por admin.tecnologia el 18 de octubre de 2026",
		"Graduados por carrera 2020–2025": "Aprobada por admin.tecnologia el 17 de octubre de 2026",
		"Becas otorgadas por gestión": "Retirada el 14 de octubre de 2026",
		"Matrícula 2026": "Pendiente",
	};

	function lineaDe(titulo: string): string | null | undefined {
		const fila = [...screen.getAllByText(new RegExp(titulo))]
			.map((el) => el.closest("[data-request-id]"))
			.find(Boolean);
		return fila?.querySelector('[data-testid="status-line"]')?.textContent;
	}

	it("escribe el estado, un espacio y «por X»", async () => {
		await abrirYEsperar({ caso: "varias" });
		await fireEvent.change(mostrar(), { target: { value: "todas" } });
		for (const [titulo, esperada] of Object.entries(LINEAS)) {
			expect(lineaDe(titulo), titulo).toBe(esperada);
		}
	});
});

describe("RequestsQueue — los datos «con rótulos»", () => {
	it("son una lista de definiciones Estado / Solicitada, con sus separadores", async () => {
		await abrirYEsperar({ caso: "varias" });
		const fila = screen
			.getAllByText(/Matrícula 2026/)
			.map((el) => el.closest("[data-request-id]"))
			.find(Boolean);
		const dl = fila?.querySelector("dl");
		expect(dl?.querySelectorAll("dt")[0]?.textContent).toBe("Estado");
		expect(dl?.querySelectorAll("dt")[1]?.textContent).toBe("Solicitada");
		expect(textoDe(dl?.querySelectorAll("dd")[1])).toBe(
			"por editor.tecnologia · 17 de octubre de 2026 · hace 3 días",
		);
	});
});

describe("RequestsQueue — las organizaciones son las pestañas", () => {
	it("«Todas» va primero; su insignia es la suma de las pendientes de las organizaciones", async () => {
		await abrirYEsperar({ caso: "varias" });
		const tabs = within(tablist() as HTMLElement).getAllByRole("tab");
		expect(tabs[0]).toHaveTextContent(/^Todas\s*4$/);
		expect(tabs[0]).toHaveAttribute("aria-selected", "true");
		expect(tabs.length).toBeGreaterThan(2);
		const insignias = tabs
			.slice(1)
			.map((t) => t.querySelector("[data-testid=insignia]")?.textContent);
		expect(insignias.map(Number).reduce((a, b) => a + b, 0)).toBe(4);
	});

	it("la insignia cuenta sólo las pendientes de la organización y se nombra «N pendientes»", async () => {
		await abrirYEsperar({ caso: "varias" });
		const tec = within(tablist() as HTMLElement).getByRole("tab", {
			name: /Facultad de Tecnología/,
		});
		expect(tec).toHaveTextContent(/Facultad de Tecnología\s*2$/);
		expect(within(tec).getByLabelText("2 pendientes")).toBeInTheDocument();
		const med = within(tablist() as HTMLElement).getByRole("tab", { name: /Facultad de Medicina/ });
		expect(within(med).getByLabelText("1 pendiente")).toBeInTheDocument();
	});

	it("una organización sin pendientes no lleva insignia", async () => {
		const items = [
			...itemsDelCaso("varias"),
			{
				...(itemsDelCaso("varias").find((i) => i.status !== "pending") as QueueItem),
				id: "der1",
				organization_title: "Facultad de Derecho",
			},
		];
		await abrirYEsperar({ items });
		const der = within(tablist() as HTMLElement).getByRole("tab", { name: /Facultad de Derecho/ });
		expect(der.textContent?.trim()).toBe("Facultad de Derecho");
		expect(der.querySelector("[data-testid=insignia]")).toBeNull();
		expect(tablist()?.querySelectorAll("[data-testid=insignia]")).toHaveLength(4);
	});

	it("sin ninguna pendiente tampoco «Todas» lleva insignia", async () => {
		const items = itemsDelCaso("varias").filter((i) => i.status !== "pending");
		await abrirYEsperar({ items });
		expect(tablist()?.querySelector("[data-testid=insignia]")).toBeNull();
	});

	it("con una sola organización no se dibujan ni las pestañas ni el desplegable", async () => {
		await abrirYEsperar({ caso: "una-organizacion" });
		expect(tablist()).toBeNull();
		expect(screen.queryByRole("combobox", { name: "Organización" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Organización" })).toBeNull();
	});

	it("elegir una pestaña filtra las filas sobre lo ya cargado, sin otra llamada", async () => {
		const { lista } = await abrirYEsperar({ caso: "varias" });
		const tab = within(tablist() as HTMLElement).getByRole("tab", { name: /Facultad de Medicina/ });
		await fireEvent.mouseDown(tab);
		await fireEvent.click(tab);
		await waitFor(() => expect(tab).toHaveAttribute("aria-selected", "true"));
		expect(screen.getAllByText("Encuesta de satisfacción 2024").length).toBeGreaterThan(0);
		expect(screen.queryByText("Matrícula 2026")).not.toBeInTheDocument();
		expect(lista).toHaveBeenCalledTimes(1);
	});

	it("hasta 700 px de ventana (611 px de contenedor) hay un desplegable de organización; desde 701, pestañas", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(tablist()?.closest("[data-list]")?.parentElement?.className).toMatch(
			/hidden .*@min-\[611px\]:block/,
		);
		const trigger = screen.getByRole("button", { name: "Organización" });
		expect(trigger.parentElement?.className).toMatch(/@min-\[611px\]:hidden/);
		expect(trigger).toHaveTextContent("Todas (4 pendientes)");
	});

	it("las pestañas llevan la forma de las vistas del recurso: línea inferior y la activa en azul", async () => {
		await abrirYEsperar({ caso: "varias" });
		const tab = within(tablist() as HTMLElement).getAllByRole("tab")[0];
		expect(tab.className).toContain("h-12");
		expect(tab.className).toContain("border-b-2");
		expect(tab.className).toContain("data-[state=active]:border-primary");
		expect(tab.className).toContain("data-[state=active]:text-primary");
	});
});

describe("RequestsQueue — «Mostrar» al nivel de las pestañas", () => {
	const OPCIONES = ["Pendientes (4)", "Resueltas (6)", "Todas (10)"];

	it("es un `<select>` como el «Ordenar» de la búsqueda: sin botones segmentados ni el desplegable de antes", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(
			screen.queryByRole("group", { name: "Estado de las solicitudes" }),
		).not.toBeInTheDocument();
		const select = mostrar();
		expect(select.tagName).toBe("SELECT");
		expect(select.value).toBe("pendientes");
		expect([...select.options].map((o) => o.textContent)).toEqual(OPCIONES);
		expect(select.className).toContain("h-11");
		expect(select.className).toContain("rounded-md");
		expect(select.className).toContain("text-sm font-medium");
		expect(select.closest("label")).toHaveTextContent(/^Mostrar:/);
	});

	it("está en la fila de las pestañas: comparte contenedor con la lista de pestañas y no hay barra aparte", async () => {
		await abrirYEsperar({ caso: "varias" });
		const fila = (tablist() as HTMLElement).closest("[data-testid=barra-pestanas]") as HTMLElement;
		expect(fila.contains(mostrar())).toBe(true);
		expect(fila.className).toMatch(/border-b/);
		// Una sola fila desde el punto de cambio: sin `flex-col`, sin envolver.
		expect(fila.className).toMatch(/@min-\[611px\]:flex-nowrap/);
		expect(fila.className).not.toMatch(/flex-col/);
		expect(screen.queryByTestId("barra-estado")).not.toBeInTheDocument();
	});

	it("elegir un estado cambia la lista", async () => {
		await abrirYEsperar({ caso: "varias" });
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(screen.queryByText("Matrícula 2026")).not.toBeInTheDocument();
		expect(screen.getByText("Calendario académico 2026")).toBeInTheDocument();
		expect(mostrar().value).toBe("resueltas");
	});

	it("con una sola organización no hay pestañas: la barra con el conteo ocupa su lugar, con su línea inferior", async () => {
		await abrirYEsperar({ caso: "una-organizacion" });
		const barra = screen.getByTestId("barra-estado");
		expect(barra).toContainElement(mostrar());
		expect(barra.className).toMatch(/border-b/);
		expect(tablist()).toBeNull();
		expect(textoDe(barra.querySelector("p"))).toMatch(/^\d+ solicitud(es)? pendientes?$/);
		await fireEvent.change(mostrar(), { target: { value: "todas" } });
		expect(textoDe(screen.getByTestId("barra-estado").querySelector("p"))).toMatch(
			/^\d+ solicitud/,
		);
	});

	it("«Mostrar» mide 36 px donde comparte fila con las pestañas (desde 701 px de ventana) y 44 px en el resto", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(mostrar().className).toMatch(/\bh-11\b/);
		expect(mostrar().className).toMatch(/@min-\[611px\]:h-9/);
		const wrapper = mostrar().closest("[data-trailing]") as HTMLElement;
		expect(wrapper.className).toMatch(/@min-\[611px\]:mt-\[5px\]/);
	});

	it("junto al desplegable de organización es el MISMO campo: las mismas clases de altura, borde, radio, letra y chevron", async () => {
		await abrirYEsperar({ caso: "varias" });
		const org = screen.getByRole("button", { name: "Organización" });
		for (const token of FIELD_CLASS.split(" ")) {
			expect(org.className.split(" "), token).toContain(token);
			expect(mostrar().className.split(" "), token).toContain(token);
		}
		const chevron = (el: Element) =>
			el.querySelector("svg") ?? el.parentElement?.querySelector("svg");
		for (const el of [org, mostrar()]) {
			const classes = chevron(el)?.getAttribute("class")?.split(" ") ?? [];
			for (const token of FIELD_CHEVRON_CLASS.split(" ")) expect(classes, token).toContain(token);
		}
	});

	it("apilado (bajo 18 rem de contenedor) la etiqueta y el campo llenan la fila; en la forma angosta la etiqueta es sólo para lectores", async () => {
		await abrirYEsperar({ caso: "varias" });
		const label = mostrar().closest("label") as HTMLElement;
		expect(label.className).toMatch(/@max-\[18rem\]:w-full/);
		expect(label.firstElementChild?.className).toMatch(/\bsr-only\b/);
		expect(label.firstElementChild?.className).toMatch(/@min-\[611px\]:not-sr-only/);
	});
});

describe("RequestsQueue — «N solicitudes» a la izquierda de las pestañas", () => {
	const conteo = () => textoDe(screen.getByTestId("conteo-solicitudes"));

	it("va en la barra de pestañas, antes de ellas, y sigue a «Mostrar» (pendientes por defecto)", async () => {
		await abrirYEsperar({ caso: "varias" });
		const barra = screen.getByTestId("barra-pestanas");
		const el = screen.getByTestId("conteo-solicitudes");
		expect(barra).toContainElement(el);
		expect(
			el.compareDocumentPosition(tablist() as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(conteo()).toBe("4 solicitudes");
		await fireEvent.change(mostrar(), { target: { value: "resueltas" } });
		expect(conteo()).toBe("6 solicitudes");
		await fireEvent.change(mostrar(), { target: { value: "todas" } });
		expect(conteo()).toBe("10 solicitudes");
	});

	it("va al extremo izquierdo de la fila: primero en la barra, con la clase de la fila y 48 px desde el punto de cambio", async () => {
		await abrirYEsperar({ caso: "varias" });
		const barra = screen.getByTestId("barra-pestanas");
		expect(barra.firstElementChild).toContainElement(screen.getByTestId("conteo-solicitudes"));
		expect(barra.firstElementChild?.className).toMatch(/@min-\[611px\]:h-12/);
		expect(barra.firstElementChild?.className).toMatch(/basis-full/);
	});

	it("sigue a la organización activa, y en singular dice «1 solicitud»", async () => {
		await abrirYEsperar({ caso: "varias" });
		const tab = within(tablist() as HTMLElement).getByRole("tab", { name: /Facultad de Medicina/ });
		await fireEvent.mouseDown(tab);
		await fireEvent.click(tab);
		await waitFor(() => expect(conteo()).toBe("1 solicitud"));
		await fireEvent.change(mostrar(), { target: { value: "todas" } });
		expect(conteo()).toBe("3 solicitudes");
	});

	it("con cero filas dice «0 solicitudes»", async () => {
		const items = itemsDelCaso("varias").filter((i) => i.status !== "pending");
		await abrirYEsperar({ items });
		expect(conteo()).toBe("0 solicitudes");
	});
});

describe("RequestsQueue — la barra de pestañas y «Mostrar» queda pegada", () => {
	it("pegada bajo el encabezado desde 32 rem, opaca, con la línea en el propio elemento y bajo el encabezado en z", async () => {
		await abrirYEsperar({ caso: "varias" });
		const barra = screen.getByTestId("barra-pestanas");
		expect(barra.contains(tablist())).toBe(true);
		expect(barra.contains(mostrar())).toBe(true);
		expect(barra.className).toMatch(/@min-\[611px\]:sticky/);
		expect(barra.className).toMatch(/@min-\[611px\]:top-\[calc\(var\(--header-h\)\+1px\)\]/);
		expect(barra.className).toMatch(/\bbg-background\b/);
		expect(barra.className).not.toMatch(/bg-background\//);
		expect(barra.className).toMatch(/\bborder-b\b/);
		expect(barra.className).toMatch(/@min-\[611px\]:z-20/);
	});

	it("bajo 32 rem no se pega: no hay `sticky` ni `z-20` sin prefijo", async () => {
		await abrirYEsperar({ caso: "varias" });
		const clases = screen.getByTestId("barra-pestanas").className.split(/\s+/);
		expect(clases).not.toContain("sticky");
		expect(clases).not.toContain("z-20");
	});

	it("la barra de la única organización también se pega bajo el encabezado, desde `sm`", async () => {
		await abrirYEsperar({ caso: "una-organizacion" });
		const barra = screen.getByTestId("barra-estado");
		expect(barra.className).toMatch(/sm:sticky/);
		expect(barra.className).toMatch(/sm:top-\[calc\(var\(--header-h\)\+1px\)\]/);
		expect(barra.className).toMatch(/\bbg-background\b/);
		expect(barra.className.split(/\s+/)).not.toContain("sticky");
	});

	it("la pega no mueve el contenido del flujo: ninguna clase de la barra lo desplaza (sin margen negativo ni `fixed`)", async () => {
		await abrirYEsperar({ caso: "varias" });
		const clases = screen.getByTestId("barra-pestanas").className;
		expect(clases).not.toMatch(/\bfixed\b|\babsolute\b|(^|\s)-m[tb]-/);
	});

	it("las filas frenan bajo el encabezado y la barra al desplazarse a la vista (`--barra-h`), y su título con aire extra", async () => {
		await abrirYEsperar({ caso: "varias" });
		const li = document.querySelector("[data-request-id]") as HTMLElement;
		expect(li.className).toContain("var(--barra-h,0px)");
		const titulo = li.querySelector("button[aria-expanded]") as HTMLElement;
		expect(titulo.className).toContain("var(--barra-h,0px)");
		expect(titulo.className).toContain("1.25rem");
	});
});

describe("RequestsQueue — la barra pegada toma el fondo de la superficie donde está (modo oscuro)", () => {
	// La barra es opaca para tapar las filas que pasan por debajo, y por eso su fondo se nota: en un `bg-card`
	// (la tarjeta de la page) una barra `bg-background` es una franja de otro tono, sobre todo en oscuro, donde
	// `--card` y `--background` difieren. El fondo tiene que ser el de la superficie, no el del lienzo.
	it.each([
		["card", "bg-card", "bg-background"],
		["background", "bg-background", "bg-card"],
	] as const)("sobre `%s` la barra de pestañas y la de una organización usan %s", async (surface, si, no) => {
		const { unmount } = await abrirYEsperar({ caso: "varias", surface });
		const barra = screen.getByTestId("barra-pestanas");
		expect(barra.className.split(/\s+/)).toContain(si);
		expect(barra.className.split(/\s+/)).not.toContain(no);
		unmount();
		await abrirYEsperar({ caso: "una-organizacion", surface });
		const estado = screen.getByTestId("barra-estado");
		expect(estado.className.split(/\s+/)).toContain(si);
		expect(estado.className.split(/\s+/)).not.toContain(no);
	});

	it("sin indicarlo la superficie es el lienzo (`bg-background`)", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(screen.getByTestId("barra-pestanas").className.split(/\s+/)).toContain("bg-background");
	});
});

describe("RequestsQueue — el acordeón no se pliega al usarlo por dentro", () => {
	const TITULO = "Presupuesto de investigación 2026";
	const panelDe = (boton: HTMLElement) =>
		document.getElementById(boton.getAttribute("aria-controls") as string) as HTMLElement;

	it("el panel es hermano de la cabecera, no su descendiente: el botón estirado no lo cubre", async () => {
		await abrirYEsperar({ caso: "varias" });
		const boton = cabecera(TITULO);
		const panel = panelDe(boton);
		expect(panel).not.toBeNull();
		expect(boton.contains(panel)).toBe(false);
		const ancla = boton.closest(".relative") as HTMLElement;
		expect(ancla.dataset.testid).toBe("fila-cabecera");
		expect(ancla.contains(panel)).toBe(false);
		expect(boton.closest("li")?.contains(panel)).toBe(true);
	});

	it("escribir el comentario, pulsar dentro del panel y usar sus controles lo mantiene abierto", async () => {
		await abrirYEsperar({ caso: "varias" });
		const boton = cabecera(TITULO);
		await fireEvent.click(boton);
		expect(boton).toHaveAttribute("aria-expanded", "true");
		const comentario = screen.getAllByLabelText(COMMENT_LABEL)[1] as HTMLTextAreaElement;
		expect(panelDe(boton).contains(comentario)).toBe(true);

		await fireEvent.click(comentario);
		await fireEvent.focus(comentario);
		await fireEvent.input(comentario, { target: { value: "Falta el anexo" } });
		await fireEvent.keyDown(comentario, { key: " " });
		await fireEvent.keyDown(comentario, { key: "Enter" });
		await fireEvent.keyDown(comentario, { key: "Escape" });
		expect(boton).toHaveAttribute("aria-expanded", "true");
		expect(comentario).toHaveValue("Falta el anexo");

		for (const enlace of within(panelDe(boton)).getAllByRole("link")) await fireEvent.click(enlace);
		await fireEvent.click(within(panelDe(boton)).getByRole("button", { name: "Rechazar" }));
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("La solicitud fue rechazada."),
		);
		expect(screen.getAllByLabelText(COMMENT_LABEL)).toHaveLength(1);
	});

	it("escribir en el comentario de la fila abierta por defecto tampoco la pliega, ni al llegar el resumen", async () => {
		await abrirYEsperar({ caso: "varias" });
		const comentario = (await screen.findAllByLabelText(COMMENT_LABEL))[0] as HTMLTextAreaElement;
		const boton = cabecera("Encuesta de satisfacción 2024");
		await fireEvent.input(comentario, { target: { value: "Primero esto" } });
		await waitFor(() => expect(screen.getByTestId("resumen-dataset")).toHaveTextContent("Privado"));
		await fireEvent.input(comentario, { target: { value: "Primero esto y lo otro" } });
		expect(boton).toHaveAttribute("aria-expanded", "true");
		expect(comentario).toHaveValue("Primero esto y lo otro");
	});

	it("rechazar sin motivo muestra el error dentro del panel, que sigue abierto", async () => {
		await abrirYEsperar({ caso: "varias" });
		const boton = cabecera(TITULO);
		await fireEvent.click(boton);
		await fireEvent.click(within(panelDe(boton)).getByRole("button", { name: "Rechazar" }));
		expect(
			within(panelDe(boton)).getByText("Para rechazar una solicitud debe escribir un motivo."),
		).toBeInTheDocument();
		expect(boton).toHaveAttribute("aria-expanded", "true");
	});

	it("sólo la cabecera y «Cerrar» pliegan; «Cerrar» devuelve el foco a la cabecera; Escape no cierra", async () => {
		await abrirYEsperar({ caso: "varias" });
		const boton = cabecera(TITULO);
		expect(boton).toHaveAttribute("aria-expanded", "false");
		await fireEvent.click(boton);
		expect(boton).toHaveAttribute("aria-expanded", "true");
		await fireEvent.keyDown(panelDe(boton), { key: "Escape" });
		await fireEvent.keyDown(document.body, { key: "Escape" });
		expect(boton).toHaveAttribute("aria-expanded", "true");
		await fireEvent.click(boton);
		expect(boton).toHaveAttribute("aria-expanded", "false");
		expect(panelDe(boton).children).toHaveLength(0);

		await fireEvent.click(boton);
		await fireEvent.click(within(panelDe(boton)).getByRole("button", { name: /^Cerrar/ }));
		expect(boton).toHaveAttribute("aria-expanded", "false");
		await waitFor(() => expect(boton).toHaveFocus());
	});

	it("la cabecera ya no ofrece «Decidir», «Aprobar» ni «Revisar»: la fila entera es el clic", async () => {
		await abrirYEsperar({ caso: "varias" });
		expect(screen.queryByRole("button", { name: /^Decidir/ })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /^Revisar/ })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /^Aprobar Presupuesto/ })).not.toBeInTheDocument();
		await fireEvent.click(cabecera(TITULO));
		expect(
			screen.getAllByRole("link", { name: "Historial de solicitudes" }).length,
		).toBeGreaterThan(0);
	});
});

describe("RequestsQueue — el pie del panel es responsive", () => {
	const abrirPie = async () => {
		await abrirYEsperar({ caso: "varias" });
		return (await screen.findAllByTestId("fila-pie"))[0] as HTMLElement;
	};

	it("ofrece abrir el dataset, el historial y «Cerrar», en ese orden y con enlaces reales", async () => {
		const pie = await abrirPie();
		const items = within(pie);
		expect(
			items.getAllByRole("link").map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
		).toEqual([
			["Abrir el dataset", "/dataset/pkg-p3"],
			["Historial de solicitudes", "/dataset/pkg-p3#history"],
		]);
		expect(items.getByRole("button", { name: /^Cerrar/ })).toBeInTheDocument();
	});

	it("cada elemento es una fila de 44 px a todo el ancho de la tarjeta bajo 28 rem y una línea compacta desde ahí", async () => {
		const pie = await abrirPie();
		for (const el of [
			...within(pie).getAllByRole("link"),
			within(pie).getByRole("button", { name: /^Cerrar/ }),
		]) {
			expect(el.className).toContain("min-h-11");
			expect(el.className).toMatch(/(^| )w-full( |$)/);
			expect(el.className).toContain("@md:w-auto");
		}
		expect(pie.className).toMatch(/\bflex-col\b/);
		expect(pie.className).toContain("@md:flex-row");
		expect(pie.className).toContain("divide-y");
		expect(pie.className).toContain("-mx-3");
	});

	it("la tarjeta es el contenedor de la consulta, y el pie sigue en el panel (hermano de la cabecera)", async () => {
		const pie = await abrirPie();
		const li = pie.closest("li") as HTMLElement;
		expect(li.className).toContain("@container");
		expect(li.querySelector('[data-testid="fila-cabecera"]')?.contains(pie)).toBe(false);
	});

	it("los chevrons de las filas sólo se ven en la forma apilada", async () => {
		const pie = await abrirPie();
		const chevrons = pie.querySelectorAll("a > svg:last-child");
		expect(chevrons).toHaveLength(2);
		for (const c of chevrons) expect(c.getAttribute("class")).toContain("@md:hidden");
	});
});

describe("RequestsQueue — la cabecera de la fila es responsive", () => {
	it("es una rejilla icono / título / chevron y los datos bajan a todo el ancho bajo `sm`", async () => {
		await abrirYEsperar({ caso: "varias" });
		const fila = screen.getAllByTestId("fila-cabecera")[0] as HTMLElement;
		expect(fila.className).toContain("grid");
		const dl = fila.querySelector("dl") as HTMLElement;
		expect(dl.parentElement).toBe(fila);
		expect(dl.className).toContain("col-span-3");
		expect(dl.className).toContain("sm:col-start-2");
	});
});
