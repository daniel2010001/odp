// Clasificación de fallos y la tabla de textos que cuelga de ella.
//
// ─── Por qué el estado HTTP no alcanza ───────────────────────────────
// Medido en vivo (2026-09-20, por el proxy de desarrollo del navegador): `resource_show` de un
// dataset privado responde `403` tanto a un espectador anónimo como a un token basura, con un cuerpo
// byte a byte idéntico cuyo nombre de usuario está VACÍO. Un id de recurso inexistente responde
// `404`. Así, en estas acciones una sesión muerta y una denegación real de permisos son
// indistinguibles por estado, y cualquier mensaje que afirme una sola causa miente. La distinción
// viene de la sonda de sesión (`createSessionApi`), y por eso el texto de autorización está indexado
// por `AccessContext`.
//
// ─── Por qué `isDefinitive` es un juicio con nombre ──────────────────
// La regla «DEV no enmascara una respuesta definitiva con datos mock» necesita una única condición;
// un segundo chequeo en línea de `status === 403 || status === 404` sería un segundo lugar donde
// equivocarse.
//
// Este módulo es un clasificador puro más una tabla de textos: sin Svelte, sin navegación y sin más
// imports que el tipo de error, para que sea trivial de testear.

import { CkanApiError } from "$lib/types/api";

/** Qué clase de respuesta dio el catálogo (o no dio). */
export type ApiFailureKind = "unauthorized" | "not-found" | "unavailable";

/** Qué estaba mirando el espectador, para que el texto nombre el sustantivo correcto. */
export type ApiSubject = "dataset" | "resource";

/** Qué se sabe de la sesión del espectador cuando se observó el fallo. */
export type AccessContext = "anonymous" | "session-alive" | "unknown";

/** El fallo tal como se le presenta al espectador. */
export interface FailurePresentation {
	kind: ApiFailureKind;
	title: string;
	message: string;
	definitive: boolean;
}

/**
 * Clasifica cualquier valor lanzado en una de las tres clases que el portal renderiza.
 *
 * Sólo los dos estados con los que el catálogo realmente responde son definitivos. Todo lo demás
 * —estado `0` (sin respuesta / red), `408` (el timeout del cliente), cualquier 5xx y cualquier throw
 * que no sea `CkanApiError`— es `unavailable`, para que un fallo de transporte nunca se etiquete
 * como una respuesta del catálogo.
 */
export function classifyFailure(err: unknown): ApiFailureKind {
	if (err instanceof CkanApiError) {
		if (err.status === 403) return "unauthorized";
		if (err.status === 404) return "not-found";
		// Un `401` NO es `unauthorized`: medido, CKAN no emite `401` para un token muerto (responde
		// `404`), así que un `401` sólo puede venir de una infraestructura delante de CKAN. Tomar el
		// rechazo de esa infraestructura como una denegación de permisos inventaría una historia que
		// el portal no puede sostener; por eso cae del lado seguro en `unavailable`.
	}
	return "unavailable";
}

/**
 * Si el fallo es la respuesta final del catálogo. Sólo un `403`/`404` definitivo se renderiza como
 * tal; un fallo no definitivo todavía puede enmascararse con datos mock en desarrollo.
 */
export function isDefinitive(kind: ApiFailureKind): boolean {
	return kind === "unauthorized" || kind === "not-found";
}

/** `dataset` → `dataset`, `resource` → `recurso`, para el texto de abajo. */
function subjectWord(subject: ApiSubject): string {
	return subject === "dataset" ? "dataset" : "recurso";
}

function titleFor(kind: ApiFailureKind, subject: ApiSubject, access: AccessContext): string {
	const word = subjectWord(subject);
	if (kind === "unauthorized") {
		if (access === "anonymous") return `${word === "dataset" ? "Dataset" : "Recurso"} privado`;
		if (access === "session-alive") return "Acceso no autorizado";
		return "No se pudo confirmar el acceso";
	}
	if (kind === "not-found") return `${word === "dataset" ? "Dataset" : "Recurso"} no encontrado`;
	return `No se pudo cargar el ${word}`;
}

function messageFor(kind: ApiFailureKind, subject: ApiSubject, access: AccessContext): string {
	const word = subjectWord(subject);
	if (kind === "unauthorized") {
		if (access === "anonymous") {
			// Sin token guardado: el ítem es privado y no hay sesión a la que culpar.
			//
			// Base de la afirmación «es privado»: en estas acciones un `403` es atribuible a que el
			// paquete es privado, porque un paquete público responde `200` (medido), y esta plataforma
			// crea todo dataset con `private: true`.
			return `Este ${word} es privado. Inicie sesión con una cuenta autorizada para verlo.`;
		}
		if (access === "session-alive") {
			// Una sesión viva a la que simplemente le falta permiso. Decirle que inicie sesión sería
			// falso.
			return `Su cuenta no está autorizada para ver este ${word}.`;
		}
		// Sonda no concluyente: cubrir las dos lecturas sin afirmar ninguna.
		return `No se pudo confirmar el acceso a este ${word}. Puede que su sesión ya no sea válida o que su cuenta no esté autorizada para verlo. Verifique su sesión e intente nuevamente.`;
	}
	if (kind === "not-found") {
		return `No se encontró el ${word} solicitado.`;
	}
	return "No se pudo conectar con el catálogo de datos. Intente nuevamente más tarde.";
}

/**
 * Convierte un valor lanzado, el sujeto y el contexto de sesión en el texto que la página renderiza.
 * El mensaje de autorización cambia según el contexto de acceso; los otros tipos no dependen de él.
 */
export function describeFailure(
	err: unknown,
	subject: ApiSubject,
	access: AccessContext,
): FailurePresentation {
	const kind = classifyFailure(err);
	return {
		kind,
		title: titleFor(kind, subject, access),
		message: messageFor(kind, subject, access),
		definitive: isDefinitive(kind),
	};
}
