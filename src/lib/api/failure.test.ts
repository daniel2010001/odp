// Tests de contrato del clasificador de fallos y su tabla de textos.
//
// Fijan tres juicios que las páginas no deben volver a derivar: qué clase de fallo ocurrió, si el
// catálogo respondió de forma definitiva (para que DEV no enmascare esa respuesta con datos mock) y
// qué decirle al espectador. El texto de autorización es el punto entero: medido contra el stack en
// vivo, una sesión muerta y una denegación real de permisos responden el mismo `403` en
// `resource_show`, así que el estado por sí solo no puede elegir el mensaje; el estado de la sesión
// sí.

import { describe, expect, it } from "vitest";
import { CkanApiError } from "$lib/types/api";
import {
	type AccessContext,
	type ApiFailureKind,
	type ApiSubject,
	classifyFailure,
	describeFailure,
	failureActions,
	isDefinitive,
} from "./failure";

const SUBJECTS: ApiSubject[] = ["dataset", "resource"];
const ACCESS: AccessContext[] = ["anonymous", "session-alive", "unknown"];
const KINDS: ApiFailureKind[] = ["unauthorized", "not-found", "unavailable"];

const ERR_UNAUTHORIZED = new CkanApiError("Access denied", 403);
const ERR_NOT_FOUND = new CkanApiError("Not Found", 404);
const ERR_UNAVAILABLE = new CkanApiError("Failed to fetch", 0);

/** Fallo representativo por clase, para los chequeos tabulados del texto. */
const ERROR_BY_KIND: Record<ApiFailureKind, unknown> = {
	unauthorized: ERR_UNAUTHORIZED,
	"not-found": ERR_NOT_FOUND,
	unavailable: ERR_UNAVAILABLE,
};

/**
 * Marcas de voseo. El texto debe tratar al espectador de usted; si esto alguna vez coincide, el
 * registro se corrió a una segunda persona regional.
 */
const VOSEO =
	/\b(vos|tenés|querés|podés|debés|sabés|hacé|andá|mirá|fijate|intentá|probá|verificá|revisá|contactá|usá|buscá)\b/i;

describe("classifyFailure — qué clase de fallo ocurrió", () => {
	it("mapea un 403 de autorización a `unauthorized`", () => {
		expect(classifyFailure(ERR_UNAUTHORIZED)).toBe("unauthorized");
	});

	it("mapea un 404 a `not-found`", () => {
		expect(classifyFailure(ERR_NOT_FOUND)).toBe("not-found");
	});

	// Un helper que sólo entiende `CkanApiError` etiqueta en silencio un fallo de transporte como una
	// respuesta del catálogo, así que este grupo es de carga.
	const NON_DEFINITIVE: Array<[string, unknown]> = [
		["ninguna respuesta (estado 0)", new CkanApiError("Failed to fetch", 0)],
		["el timeout del cliente (estado 408)", new CkanApiError("Request timed out", 408)],
		["un error del servidor (500)", new CkanApiError("Server Error", 500)],
		["un error de pasarela (502)", new CkanApiError("Bad Gateway", 502)],
		["un 401, que CKAN no emite para un token muerto", new CkanApiError("Unauthorized", 401)],
		["un CkanApiError sin estado", new CkanApiError("Unknown")],
		["un Error ajeno", new Error("boom")],
		["un string lanzado", "boom"],
		["null", null],
		["undefined", undefined],
		["un objeto duck-typed que dice 403", { status: 403 }],
	];

	for (const [label, err] of NON_DEFINITIVE) {
		it(`informa \`unavailable\` ante ${label}`, () => {
			expect(classifyFailure(err)).toBe("unavailable");
		});
	}
});

describe("isDefinitive — qué fallos son definitivos", () => {
	it("trata un fallo de autorización como una respuesta definitiva del catálogo", () => {
		expect(isDefinitive("unauthorized")).toBe(true);
	});

	it("trata un ítem inexistente como una respuesta definitiva del catálogo", () => {
		expect(isDefinitive("not-found")).toBe(true);
	});

	it("trata una no-respuesta como no definitiva, para que DEV todavía pueda caer a datos mock", () => {
		expect(isDefinitive("unavailable")).toBe(false);
	});
});

describe("describeFailure — el texto que ve el espectador", () => {
	it("conserva la clase clasificada y su condición de definitiva", () => {
		const p = describeFailure(ERR_UNAUTHORIZED, "resource", "anonymous");
		expect(p.kind).toBe("unauthorized");
		expect(p.definitive).toBe(true);

		const q = describeFailure(ERR_UNAVAILABLE, "dataset", "unknown");
		expect(q.kind).toBe("unavailable");
		expect(q.definitive).toBe(false);
	});

	// Toda clase es alcanzable con todo contexto de acceso, y ambos sustantivos deben renderizar. Las
	// restricciones por clase × acceso se asertan en los tests enfocados de abajo.
	for (const kind of KINDS) {
		for (const access of ACCESS) {
			for (const subject of SUBJECTS) {
				it(`${kind} / ${access} / ${subject} rinde un encabezado, una oración de detalle y la definitividad correcta`, () => {
					const p = describeFailure(ERROR_BY_KIND[kind], subject, access);
					expect(p.kind).toBe(kind);
					expect(p.title.trim().length).toBeGreaterThan(0);
					expect(p.message.trim().length).toBeGreaterThan(0);
					expect(p.definitive).toBe(isDefinitive(kind));
				});
			}
		}
	}

	it("nombra el sustantivo del sujeto en el texto", () => {
		expect(describeFailure(ERR_NOT_FOUND, "dataset", "anonymous").title).toMatch(/dataset/i);
		expect(describeFailure(ERR_NOT_FOUND, "resource", "anonymous").title).toMatch(/recurso/i);
	});

	it("usa un mensaje de autorización distinto por cada contexto de acceso", () => {
		const messages = ACCESS.map(
			(access) => describeFailure(ERR_UNAUTHORIZED, "resource", access).message,
		);
		expect(messages.every((m) => m.trim().length > 0)).toBe(true);
		expect(new Set(messages).size).toBe(ACCESS.length);
	});

	it("le dice a un espectador anónimo que el ítem es privado y que inicie sesión, sin afirmar nunca una sesión expirada", () => {
		for (const subject of SUBJECTS) {
			const p = describeFailure(ERR_UNAUTHORIZED, subject, "anonymous");
			expect(p.message).toMatch(/privad/i);
			expect(p.message).toMatch(/inicie sesión/i);
			expect(p.message).not.toMatch(/expir/i);
		}
	});

	it("le dice a un espectador con sesión viva que su cuenta no está autorizada, y nunca le pide iniciar sesión", () => {
		for (const subject of SUBJECTS) {
			const p = describeFailure(ERR_UNAUTHORIZED, subject, "session-alive");
			expect(p.message).toMatch(/no está autorizada/i);
			expect(p.message).not.toMatch(/inicie sesión/i);
			expect(p.message).not.toMatch(/expir/i);
		}
	});

	it("no afirma ninguna de las dos lecturas cuando el estado de la sesión es desconocido, pero cubre ambas", () => {
		for (const subject of SUBJECTS) {
			const p = describeFailure(ERR_UNAUTHORIZED, subject, "unknown");
			// Con reserva, no asertado: las dos lecturas pueden nombrarse como posibilidades…
			expect(p.message).toMatch(/puede que/i);
			expect(p.message).toMatch(/sesión/i);
			expect(p.message).toMatch(/autorizad/i);
			// …pero ninguna se enuncia como un hecho. `no esté autorizada` (subjuntivo) no debe
			// confundirse con el asertivo `no está autorizada`.
			expect(p.message).not.toMatch(/expiró/i);
			expect(p.message).not.toMatch(/no está autorizada/i);
		}
	});

	it("informa un ítem inexistente sin mencionar permisos ni sesiones", () => {
		for (const subject of SUBJECTS) {
			const word = subject === "dataset" ? "dataset" : "recurso";
			for (const access of ACCESS) {
				const p = describeFailure(ERR_NOT_FOUND, subject, access);
				// La copia existente de la página del dataset no puede degradarse al migrar.
				expect(p.message).toBe(`No se encontró el ${word} solicitado.`);
				expect(p.message).not.toMatch(/permis|autoriz|sesión|inicie|este /i);
			}
		}
	});

	it("informa un catálogo inalcanzable sin afirmar que el ítem falta o es privado, y ofrece reintentar", () => {
		for (const subject of SUBJECTS) {
			for (const access of ACCESS) {
				const p = describeFailure(ERR_UNAVAILABLE, subject, access);
				expect(p.message).toBe(
					"No se pudo completar la consulta al catálogo de datos. Intente nuevamente más tarde.",
				);
				expect(p.message).toMatch(/catálogo/i);
				expect(p.message).toMatch(/intente nuevamente/i);
				expect(p.message).not.toMatch(/no (se )?encontr|privad|permis|inicie sesión/i);
			}
		}
	});

	// `unavailable` agrupa un estado `0` (sin respuesta), el `408` del cliente, cualquier 5xx y un
	// `401`. En los tres últimos el catálogo **sí** respondió, así que un texto que afirme que no se
	// pudo conectar inventa una causa: el mismo defecto que este slice existe para eliminar. El texto
	// habla de la consulta, no de la conexión.
	it("no atribuye a la conexión un fallo del catálogo que sí respondió", () => {
		const CATALOG_ANSWERED: Array<[string, unknown]> = [
			["el timeout del cliente (408)", new CkanApiError("Request timed out", 408)],
			["un error del servidor (500)", new CkanApiError("Server Error", 500)],
			["un error de pasarela (502)", new CkanApiError("Bad Gateway", 502)],
			["un 401", new CkanApiError("Unauthorized", 401)],
		];

		for (const [label, err] of CATALOG_ANSWERED) {
			for (const subject of SUBJECTS) {
				for (const access of ACCESS) {
					const p = describeFailure(err, subject, access);
					expect(p.message, label).not.toMatch(/conectar|conexión/i);
				}
			}
		}
	});

	it("trata al espectador de usted en todas las combinaciones: sin voseo", () => {
		for (const kind of KINDS) {
			for (const access of ACCESS) {
				for (const subject of SUBJECTS) {
					const p = describeFailure(ERROR_BY_KIND[kind], subject, access);
					expect(`${p.title} ${p.message}`).not.toMatch(VOSEO);
				}
			}
		}
	});
});

describe("failureActions — qué acciones ofrecer según el fallo", () => {
	const present = (kind: ApiFailureKind, access: AccessContext) => {
		const presentation = describeFailure(ERROR_BY_KIND[kind], "resource", access);
		return failureActions(presentation, access);
	};

	it("ofrece reintentar sólo cuando un reintento podría cambiar la respuesta", () => {
		// Una sonda no concluyente pide «verifique su sesión e intente nuevamente»: el reintento la
		// cumple. Una respuesta definitiva no cambia por reintentar.
		expect(present("unauthorized", "unknown").retry).toBe(true);
		expect(present("unavailable", "anonymous").retry).toBe(true);
		expect(present("unauthorized", "anonymous").retry).toBe(false);
		expect(present("unauthorized", "session-alive").retry).toBe(false);
		expect(present("not-found", "anonymous").retry).toBe(false);
	});

	it("ofrece iniciar sesión sólo para un fallo de autorización sin sesión", () => {
		expect(present("unauthorized", "anonymous").signIn).toBe(true);
		expect(present("unauthorized", "session-alive").signIn).toBe(false);
		expect(present("unauthorized", "unknown").signIn).toBe(false);
		expect(present("not-found", "anonymous").signIn).toBe(false);
		expect(present("unavailable", "anonymous").signIn).toBe(false);
	});

	it("nunca deja una instrucción sin la acción que la cumple", () => {
		// El texto anónimo manda «inicie sesión»: el enlace tiene que estar. El texto desconocido manda
		// «verifique su sesión e intente nuevamente»: el reintento tiene que estar.
		const anonymous = present("unauthorized", "anonymous");
		expect(anonymous.signIn).toBe(true);
		expect(anonymous.retry).toBe(false);

		const unknown = present("unauthorized", "unknown");
		expect(unknown.retry).toBe(true);
		expect(unknown.signIn).toBe(false);
	});
});
