// Tests de los helpers puros de la page de solicitudes: cómo se reparte, se ordena, se filtra, se agrupa y se vacía la cola.

import { describe, expect, it } from "vitest";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage } from "$lib/types/ckan";
import type { QueueItem } from "./requests-model";
import {
	acotarResueltas,
	actionLabel,
	applyDecision,
	canDecide,
	datasetSummary,
	emptyState,
	filterByOrganization,
	firstDecidable,
	hasOrganizationTabs,
	isStaleDecision,
	itemsForTab,
	LIMITE_RESUELTAS,
	organizationsOf,
	organizationTabs,
	requestCountLabel,
	resolutionDetail,
	resolutionLine,
	splitQueue,
	statusOptionLabel,
	statusOptions,
	TODAS_LAS_ORGANIZACIONES,
	tabCounts,
} from "./requests-model";

const YO = "me";

function item(overrides: Partial<QueueItem> = {}): QueueItem {
	return {
		id: "r",
		dataset_id: "d",
		dataset_title: "Dataset",
		status: "pending",
		requested_by: "otro",
		created_at: "2026-10-01T00:00:00.000000",
		...overrides,
	};
}

describe("splitQueue", () => {
	it("ordena las pendientes de la más antigua a la más nueva (quien esperó más, arriba) y las resueltas con la más nueva primero", () => {
		const { pendientes, resueltas } = splitQueue([
			item({ id: "nueva", created_at: "2026-10-17T00:00:00" }),
			item({ id: "vieja", created_at: "2026-04-03T00:00:00" }),
			item({ id: "media", created_at: "2026-10-01T00:00:00" }),
			item({ id: "viejo", status: "approved", decided_at: "2026-09-01T00:00:00" }),
			item({ id: "nuevo", status: "rejected", decided_at: "2026-10-05T00:00:00" }),
		]);
		expect(pendientes.map((i) => i.id)).toEqual(["vieja", "media", "nueva"]);
		expect(resueltas.map((i) => i.id)).toEqual(["nuevo", "viejo"]);
	});

	it("una pendiente sin fecha legible va al final de las pendientes y las de igual fecha conservan el orden recibido", () => {
		const { pendientes } = splitQueue([
			item({ id: "sin-fecha", created_at: undefined }),
			item({ id: "b", created_at: "2026-10-01T00:00:00" }),
			item({ id: "a", created_at: "2026-10-01T00:00:00" }),
			item({ id: "ilegible", created_at: "no-es-fecha" }),
			item({ id: "antes", created_at: "2026-09-01T00:00:00" }),
		]);
		expect(pendientes.map((i) => i.id)).toEqual(["antes", "b", "a", "sin-fecha", "ilegible"]);
	});

	it("ordena por la creación cuando falta la decisión y manda la fecha ilegible al final", () => {
		const { resueltas } = splitQueue([
			item({ id: "ilegible", status: "cancelled", created_at: "no-es-fecha" }),
			item({ id: "a", status: "cancelled", created_at: "2026-09-01T00:00:00" }),
			item({ id: "b", status: "annulled", created_at: "2026-09-10T00:00:00" }),
		]);
		expect(resueltas.map((i) => i.id)).toEqual(["b", "a", "ilegible"]);
	});
});

describe("canDecide / firstDecidable", () => {
	it("la propia no se decide salvo que el catálogo conceda la excepción", () => {
		expect(canDecide(item({ requested_by: YO }), YO)).toBe(false);
		expect(canDecide(item({ requested_by: YO, decidable_by_caller: false }), YO)).toBe(false);
		expect(canDecide(item({ requested_by: YO, decidable_by_caller: true }), YO)).toBe(true);
		expect(canDecide(item({ requested_by: "otro" }), YO)).toBe(true);
	});

	it("sin identidad nada se bloquea", () => {
		expect(canDecide(item({ requested_by: YO }), null)).toBe(true);
	});

	it("la primera decidible es la más antigua que quien mira puede decidir", () => {
		const nueva = item({ id: "nueva", created_at: "2026-10-17T00:00:00" });
		const vieja = item({ id: "vieja", created_at: "2026-04-03T00:00:00" });
		expect(firstDecidable([nueva, vieja], YO)?.id).toBe("vieja");
	});

	it("la primera decidible salta la propia y devuelve null si no hay ninguna", () => {
		const propia = item({ id: "propia", requested_by: YO });
		const ajena = item({ id: "ajena" });
		const resuelta = item({ id: "res", status: "approved" });
		expect(firstDecidable([propia, ajena], YO)?.id).toBe("ajena");
		expect(firstDecidable([resuelta, propia], YO)).toBeNull();
		expect(firstDecidable([], YO)).toBeNull();
	});
});

describe("pestañas", () => {
	const items = [
		item({ id: "p" }),
		item({ id: "a", status: "approved", decided_at: "2026-10-02T00:00:00" }),
		item({ id: "r", status: "rejected", decided_at: "2026-10-03T00:00:00" }),
	];

	it("«Todas» pone las pendientes antes que las resueltas", () => {
		expect(itemsForTab(items, "todas").map((i) => i.id)).toEqual(["p", "r", "a"]);
		expect(itemsForTab(items, "pendientes").map((i) => i.id)).toEqual(["p"]);
		expect(itemsForTab(items, "resueltas").map((i) => i.id)).toEqual(["r", "a"]);
	});

	it("los conteos salen de las mismas filas", () => {
		expect(tabCounts(items)).toEqual({ pendientes: 1, resueltas: 2, todas: 3 });
		expect(tabCounts([])).toEqual({ pendientes: 0, resueltas: 0, todas: 0 });
	});
});

describe("organizaciones", () => {
	const items = [
		item({ id: "1", organization_title: "Medicina" }),
		item({ id: "2", organization_title: "Tecnología", status: "approved" }),
		item({ id: "3", organization_title: "Medicina", status: "approved" }),
		item({ id: "4" }),
		item({ id: "5", organization_title: "Tecnología" }),
		item({ id: "6", organization_title: "Tecnología" }),
	];

	it("lista cada organización una vez, en el orden en que aparece, sin las filas sin organización", () => {
		expect(organizationsOf(items)).toEqual(["Medicina", "Tecnología"]);
	});

	it("filtra por organización y null no filtra", () => {
		expect(filterByOrganization(items, "Medicina").map((i) => i.id)).toEqual(["1", "3"]);
		expect(filterByOrganization(items, null)).toHaveLength(6);
	});

	it("pestañas de organización: «Todas» primero con el total, y cada organización con sus solicitudes", () => {
		expect(organizationTabs(items)).toEqual([
			{ id: TODAS_LAS_ORGANIZACIONES, label: "Todas", count: 6 },
			{ id: "Medicina", label: "Medicina", count: 2 },
			{ id: "Tecnología", label: "Tecnología", count: 3 },
		]);
	});

	it("pestañas de organización: tras «Todas», alfabéticas en español", () => {
		const orden = organizationTabs([
			item({ id: "1", organization_title: "Zoología" }),
			item({ id: "2", organization_title: "Ñandú" }),
			item({ id: "3", organization_title: "Álgebra" }),
			item({ id: "4", organization_title: "Facultad 10" }),
			item({ id: "5", organization_title: "Facultad 9" }),
		]).map((t) => t.label);
		expect(orden).toEqual(["Todas", "Álgebra", "Facultad 9", "Facultad 10", "Ñandú", "Zoología"]);
	});

	it("pestañas de organización: sin solicitudes sólo queda «Todas» en cero", () => {
		expect(organizationTabs([])).toEqual([
			{ id: TODAS_LAS_ORGANIZACIONES, label: "Todas", count: 0 },
		]);
	});

	it("el control de estado ofrece Pendientes / Resueltas / Todas, en ese orden y con su conteo", () => {
		expect(statusOptions({ pendientes: 4, resueltas: 6, todas: 10 })).toEqual([
			{ id: "pendientes", label: "Pendientes", count: 4 },
			{ id: "resueltas", label: "Resueltas", count: 6 },
			{ id: "todas", label: "Todas", count: 10 },
		]);
	});
});

describe("applyDecision", () => {
	const base = [item({ id: "x" }), item({ id: "y" })];

	it("la fila decidida queda en la lista como resuelta, con quién y cuándo, y las demás no cambian", () => {
		const salida = applyDecision(
			base,
			{ id: "x", status: "rejected", comments: "Falta anonimizar" },
			{ by: "admin", at: "2026-10-20T12:00:00" },
		);
		expect(salida[0]).toMatchObject({
			id: "x",
			status: "rejected",
			approved_by_name: "admin",
			decided_at: "2026-10-20T12:00:00",
			comments: "Falta anonimizar",
		});
		expect(salida[1]).toBe(base[1]);
		expect(base[0].status).toBe("pending");
	});

	it("un id que no está no cambia nada", () => {
		const salida = applyDecision(base, { id: "z", status: "approved" }, { by: "a", at: "t" });
		expect(salida).toEqual(base);
	});
});

describe("isStaleDecision", () => {
	it("sólo el 409 de validación sobre request_id es «ya fue decidida»", () => {
		const tarde = new CkanApiError("v", 409, "Validation Error", {
			__type: "Validation Error",
			request_id: ["no longer pending"],
		});
		expect(isStaleDecision(tarde)).toBe(true);
	});

	it("el 409 de otro campo, otros estados y valores ajenos no lo son", () => {
		expect(
			isStaleDecision(new CkanApiError("v", 409, "Validation Error", { comments: ["falta"] })),
		).toBe(false);
		expect(isStaleDecision(new CkanApiError("v", 409))).toBe(false);
		expect(
			isStaleDecision(new CkanApiError("v", 403, "Authorization Error", { request_id: ["x"] })),
		).toBe(false);
		expect(isStaleDecision(new Error("boom"))).toBe(false);
		expect(isStaleDecision(null)).toBe(false);
	});
});

describe("resolutionLine", () => {
	it("dice quién resolvió con el vocabulario del historial y no atribuye decisor a la retirada", () => {
		expect(
			resolutionLine(
				item({ status: "approved", approved_by_name: "Ana", decided_at: "2026-10-17T12:00:00" }),
			),
		).toMatch(/^Aprobada por Ana el .*2026/);
		expect(resolutionLine(item({ status: "rejected", approved_by_name: "Ana" }))).toBe(
			"Rechazada por Ana",
		);
		expect(resolutionLine(item({ status: "cancelled", approved_by_name: "Ana" }))).toBe("Retirada");
		expect(resolutionLine(item({ status: "annulled" }))).toBe("Anulada");
	});

	it("sin nombre cae a la etiqueta neutral, nunca a un id; una pendiente no tiene línea", () => {
		expect(resolutionLine(item({ status: "approved" }))).toBe(
			"Aprobada por un usuario del catálogo",
		);
		expect(resolutionLine(item({ status: "approved", approved_by_name: "unknown" }))).toBe(
			"Aprobada por usuario no disponible",
		);
		expect(resolutionLine(item())).toBeNull();
	});
});

describe("emptyState", () => {
	it("sin ninguna solicitud no dice «pendientes» sólo: dice que no hay solicitudes de publicación", () => {
		const e = emptyState("todas", { pendientes: 0, resueltas: 0, todas: 0 });
		expect(e.title).toBe("No hay solicitudes de publicación.");
		expect(e.hint).toBeTruthy();
		expect(emptyState("pendientes", { pendientes: 0, resueltas: 0, todas: 0 }).title).toBe(e.title);
	});

	it("sin pendientes pero con resueltas manda a las resueltas", () => {
		const e = emptyState("pendientes", { pendientes: 0, resueltas: 3, todas: 3 });
		expect(e.title).toBe("No hay solicitudes pendientes.");
		expect(e.hint).toContain("Resueltas");
	});

	it("la pestaña de resueltas vacía lo dice", () => {
		const e = emptyState("resueltas", { pendientes: 2, resueltas: 0, todas: 2 });
		expect(e.title).toBe("Aún no hay solicitudes resueltas.");
	});
});

describe("actionLabel", () => {
	it("«Decidir» sólo donde se puede decidir; la propia se abre como «Ver»", () => {
		expect(actionLabel(item(), YO)).toBe("Decidir");
		expect(actionLabel(item({ requested_by: YO }), YO)).toBe("Ver");
		expect(actionLabel(item({ requested_by: YO, decidable_by_caller: true }), YO)).toBe("Decidir");
	});

	it("una resuelta sólo se abre si tiene un comentario que leer", () => {
		expect(actionLabel(item({ status: "rejected", comments: "Falta anonimizar" }), YO)).toBe("Ver");
		expect(actionLabel(item({ status: "approved", comments: "  " }), YO)).toBeNull();
		expect(actionLabel(item({ status: "cancelled" }), YO)).toBeNull();
	});
});

describe("resolutionDetail", () => {
	it("es lo que sigue al rótulo en la línea de resolución", () => {
		const aprobada = item({
			status: "approved",
			approved_by_name: "Ana",
			decided_at: "2026-10-17T10:00:00",
		});
		expect(resolutionDetail(aprobada)).toBe("por Ana el 17 de octubre de 2026");
		expect(`Aprobada ${resolutionDetail(aprobada)}`).toBe(resolutionLine(aprobada));
	});

	it("la retirada no se atribuye un decisor: sólo trae la fecha, y sin fecha no trae nada", () => {
		expect(resolutionDetail(item({ status: "cancelled", decided_at: "2026-10-14T10:00:00" }))).toBe(
			"el 14 de octubre de 2026",
		);
		expect(resolutionDetail(item({ status: "annulled" }))).toBeNull();
	});

	it("una pendiente no tiene detalle de resolución", () => {
		expect(resolutionDetail(item())).toBeNull();
	});
});

describe("acotarResueltas", () => {
	const filas = [
		item({ id: "p1" }),
		item({ id: "r1", status: "approved" }),
		item({ id: "p2" }),
		item({ id: "r2", status: "rejected" }),
		item({ id: "r3", status: "approved" }),
	];

	it("acota sólo las resueltas, deja todas las pendientes y no cambia el orden", () => {
		const { shown, hidden } = acotarResueltas(filas, 1);
		expect(shown.map((i) => i.id)).toEqual(["p1", "r1", "p2"]);
		expect(hidden).toBe(2);
	});

	it("con un límite que alcanza o sin límite no oculta nada", () => {
		expect(acotarResueltas(filas, 3).hidden).toBe(0);
		expect(acotarResueltas(filas, Number.POSITIVE_INFINITY).shown).toHaveLength(5);
	});
});

describe("LIMITE_RESUELTAS", () => {
	it("son cinco las resueltas que se ven antes de «Ver N más»", () => {
		expect(LIMITE_RESUELTAS).toBe(5);
	});
});

describe("el control de estado en la barra", () => {
	it("las pestañas de organización sólo existen con dos o más organizaciones", () => {
		const una = organizationTabs([item({ id: "1", organization_title: "Medicina" })]);
		const dos = organizationTabs([
			item({ id: "1", organization_title: "Medicina" }),
			item({ id: "2", organization_title: "Tecnología" }),
		]);
		expect(hasOrganizationTabs(organizationTabs([]))).toBe(false);
		expect(hasOrganizationTabs(una)).toBe(false);
		expect(hasOrganizationTabs(dos)).toBe(true);
	});

	it("la opción lleva su conteo entre paréntesis", () => {
		expect(statusOptionLabel({ label: "Pendientes", count: 4 })).toBe("Pendientes (4)");
		expect(statusOptionLabel({ label: "Todas", count: 0 })).toBe("Todas (0)");
	});

	it("el conteo concuerda en número y en estado, como la barra de resultados de la búsqueda", () => {
		expect(requestCountLabel("pendientes", 4)).toEqual({
			number: "4",
			text: "solicitudes pendientes",
		});
		expect(requestCountLabel("pendientes", 1)).toEqual({
			number: "1",
			text: "solicitud pendiente",
		});
		expect(requestCountLabel("resueltas", 6)).toEqual({
			number: "6",
			text: "solicitudes resueltas",
		});
		expect(requestCountLabel("resueltas", 1)).toEqual({ number: "1", text: "solicitud resuelta" });
		expect(requestCountLabel("todas", 10)).toEqual({ number: "10", text: "solicitudes" });
		expect(requestCountLabel("todas", 0)).toEqual({ number: "0", text: "solicitudes" });
	});
});

describe("datasetSummary", () => {
	function dataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
		return {
			id: "d",
			name: "d",
			title: "Dataset",
			private: true,
			state: "active",
			resources: [],
			tags: [],
			groups: [],
			extras: [],
			metadata_created: "2026-01-01T00:00:00",
			metadata_modified: "2026-01-01T00:00:00",
			...overrides,
		};
	}

	it("resume organización, licencia con la etiqueta del portal, recursos con sus formatos y la visibilidad de hoy", () => {
		const resumen = datasetSummary(
			dataset({
				private: true,
				organization: {
					id: "o",
					name: "o",
					title: "Facultad de Tecnología",
				} as CkanPackage["organization"],
				license_id: "cc-by",
				license_title: "Creative Commons Attribution",
				resources: [
					{ id: "1", format: "csv", url_type: "upload" },
					{ id: "2", format: "CSV", url_type: "upload" },
					{ id: "3", format: "json", url_type: "upload" },
					{ id: "4", format: "", url_type: "upload" },
				] as CkanPackage["resources"],
			}),
		);
		expect(resumen.organization).toBe("Facultad de Tecnología");
		expect(resumen.license).toBe("CC BY — Atribución");
		expect(resumen.resources).toBe("4 recursos (CSV, JSON)");
		expect(resumen.visibility).toBe("Privado");
	});

	it("un dataset público sin recursos ni licencia lo dice sin inventar formatos", () => {
		const resumen = datasetSummary(dataset({ private: false }));
		expect(resumen.visibility).toBe("Público");
		expect(resumen.resources).toBe("Sin recursos");
		expect(resumen.license).toBe("Sin especificar");
		expect(resumen.organization).toBeNull();
	});

	it("un recurso va en singular y sin formatos no abre paréntesis", () => {
		expect(
			datasetSummary(
				dataset({ resources: [{ id: "1", url_type: "upload" }] as CkanPackage["resources"] }),
			).resources,
		).toBe("1 recurso");
	});
});
