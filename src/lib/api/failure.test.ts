// Tests de contrato del clasificador de fallos y su tabla de textos.
//
// Fijan tres juicios que las páginas no deben volver a derivar: qué clase de fallo ocurrió, si el
// catálogo respondió de forma definitiva (para que DEV no enmascare esa respuesta con datos mock) y
// qué decirle al espectador. El texto de autorización es el punto entero: medido contra el stack en
// vivo, una sesión muerta y una denegación real de permisos responden el mismo `403` en
// `resource_show`, así que el estado por sí solo no puede elegir el mensaje; el estado de la sesión
// sí.
//
// ─── Política de indistinguibilidad anónima (decisión del autor, 2026-09-20) ───
// Quien no tiene sesión no puede distinguir un recurso privado de uno inexistente, mientras que un
// espectador identificado recibe la respuesta honesta. Eso hace de esta tabla una tabla de dos
// políticas: la indistinguibilidad del anónimo es una propiedad de carga y se asertan más abajo, en
// su propio bloque, en vez de quedar como un comentario que una reescritura pueda contradecir.

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
/** Contextos en los que la sonda de sesión identificó al espectador (o al menos lo descartó como anónimo). */
const IDENTIFIED_ACCESS: AccessContext[] = ["session-alive", "unknown"];
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

	it("ante un espectador anónimo cubre las dos lecturas sin afirmar ninguna y sin invitarlo a iniciar sesión", () => {
		for (const subject of SUBJECTS) {
			const word = subject === "dataset" ? "dataset" : "recurso";
			const p = describeFailure(ERR_UNAUTHORIZED, subject, "anonymous");
			// La formulación es la de CKAN: nombra la ausencia y la falta de permiso como alternativas.
			// Confirmar que el ítem existe delataría un recurso privado; afirmar que no existe le negaría
			// al dueño legítimo la pista de que le falta sesión.
			expect(p.message).toBe(
				`No se encontró el ${word} solicitado, o no tiene permiso para verlo.`,
			);
			expect(p.message).not.toMatch(/privad/i);
			expect(p.message).not.toMatch(/inicie sesión/i);
			expect(p.message).not.toMatch(/expir/i);
		}
	});

	it("le dice a un espectador con sesión viva que su cuenta no está autorizada, y nunca le pide iniciar sesión", () => {
		for (const subject of SUBJECTS) {
			const p = describeFailure(ERR_UNAUTHORIZED, subject, "session-alive");
			expect(p.title).toBe("Acceso no autorizado");
			expect(p.message).toMatch(/no está autorizada/i);
			expect(p.message).not.toMatch(/inicie sesión/i);
			expect(p.message).not.toMatch(/expir/i);
		}
	});

	it("no afirma ninguna de las dos lecturas cuando el estado de la sesión es desconocido, pero cubre ambas", () => {
		for (const subject of SUBJECTS) {
			const p = describeFailure(ERR_UNAUTHORIZED, subject, "unknown");
			expect(p.title).toBe("No se pudo confirmar el acceso");
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

	it("informa un ítem inexistente sin mencionar permisos ni sesiones cuando el espectador está identificado", () => {
		for (const subject of SUBJECTS) {
			const word = subject === "dataset" ? "dataset" : "recurso";
			// El espectador anónimo no entra acá: para él la ausencia y la falta de permiso son la
			// misma respuesta (ver el bloque de indistinguibilidad más abajo).
			for (const access of IDENTIFIED_ACCESS) {
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
				const word = subject === "dataset" ? "dataset" : "recurso";
				const p = describeFailure(ERR_UNAVAILABLE, subject, access);
				expect(p.title).toBe(`No se pudo cargar el ${word}`);
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

// ─── La propiedad de carga ────────────────────────────────────────────
// Sin sesión, el estado de error no puede filtrar si el recurso existe. Es el corazón de la
// decisión del autor, así que vive como test: si alguien reintroduce un texto propio del 403
// anónimo, o un campo nuevo en la presentación que dependa de la clase, esto se cae.
describe("indistinguibilidad anónima — un 403 y un 404 son el mismo estado sin sesión", () => {
	for (const subject of SUBJECTS) {
		it(`presenta el mismo estado ante un 403 y un 404 para el sujeto «${subject}»`, () => {
			const forbidden = describeFailure(ERR_UNAUTHORIZED, subject, "anonymous");
			const missing = describeFailure(ERR_NOT_FOUND, subject, "anonymous");

			// Comparación profunda salvo `kind`: es el único campo que puede diferir, es la clave
			// interna del clasificador (la consume el enmascarado de DEV) y el estado de error no lo
			// renderiza. Cualquier campo nuevo que delate la existencia del recurso hace fallar esto.
			expect({ ...forbidden, kind: null }).toEqual({ ...missing, kind: null });
			expect(forbidden.title).toBe(missing.title);
			expect(forbidden.message).toBe(missing.message);
			expect(forbidden.definitive).toBe(missing.definitive);
			// Las acciones también: en ninguna de las dos respuestas hay algo que hacer.
			expect(failureActions(forbidden, "anonymous")).toEqual(failureActions(missing, "anonymous"));
			expect(failureActions(forbidden, "anonymous")).toEqual({ retry: false });
		});
	}

	it("sólo difiere en `kind`, el dato que el estado de error no renderiza", () => {
		for (const subject of SUBJECTS) {
			const forbidden = describeFailure(ERR_UNAUTHORIZED, subject, "anonymous");
			const missing = describeFailure(ERR_NOT_FOUND, subject, "anonymous");
			// Si esto dejara de ser cierto, la comparación de arriba confrontaría el mismo error
			// consigo mismo y no probaría nada.
			expect(forbidden.kind).toBe("unauthorized");
			expect(missing.kind).toBe("not-found");
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

	it("no ofrece ninguna acción de inicio de sesión: el botón delataría que el ítem existe", () => {
		for (const kind of KINDS) {
			for (const access of ACCESS) {
				// La forma del objeto es parte del contrato: sólo `retry`. El camino hacia el login vive en
				// el encabezado, que no lleva información sobre el recurso solicitado.
				expect(Object.keys(present(kind, access))).toEqual(["retry"]);
			}
		}
	});

	it("nunca deja una instrucción sin la acción que la cumple", () => {
		// El texto anónimo no manda ninguna acción, así que no hay nada que ofrecer. El texto
		// desconocido manda «verifique su sesión e intente nuevamente»: el reintento tiene que estar.
		expect(present("unauthorized", "anonymous").retry).toBe(false);
		expect(present("unauthorized", "unknown").retry).toBe(true);
		expect(present("unavailable", "anonymous").retry).toBe(true);
	});
});
