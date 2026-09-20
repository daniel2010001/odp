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
// ─── Indistinguibilidad sin sesión (decisión del autor, 2026-09-20) ────
// Quien no tiene sesión no puede distinguir un recurso privado de uno inexistente: recibe el mismo
// encabezado, la misma oración y ninguna acción. La UI de CKAN tampoco distingue los dos casos
// —atrapa `NotFound` y `NotAuthorized` en la misma rama—, y para el espectador sin sesión eso es lo
// correcto: cualquier diferencia filtraría la existencia de un recurso privado. Un espectador
// identificado, en cambio, recibe la respuesta honesta (autorización denegada o sesión muerta):
// engañarlo no le da ningún valor de seguridad y sí le quita un diagnóstico útil. Esa es la
// desviación deliberada respecto de CKAN, y vive acá y no en la página para que haya un solo lugar
// donde pueda equivocarse.
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
		// Un `401` NO es `unauthorized`. Lo medido: CKAN responde `404` a `user_show {}` y `403` a
		// `resource_show` con un token muerto; en ninguno de los caminos sondeados el `401` es la forma
		// de un token muerto. Tomar ese estado como una denegación de permisos afirmaría una causa que
		// nadie observó, así que cae del lado seguro en `unavailable`.
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
	if (kind === "unavailable") return `No se pudo cargar el ${word}`;
	// `not-found` y el 403 de un espectador sin sesión comparten encabezado: es la mitad visible de
	// la indistinguibilidad. El 403 de un espectador identificado y el no concluyente conservan el
	// suyo, porque un encabezado honesto no le filtra nada a quien ya está identificado.
	if (kind === "not-found" || access === "anonymous") {
		return `${word === "dataset" ? "Dataset" : "Recurso"} no encontrado`;
	}
	if (access === "session-alive") return "Acceso no autorizado";
	return "No se pudo confirmar el acceso";
}

function messageFor(kind: ApiFailureKind, subject: ApiSubject, access: AccessContext): string {
	const word = subjectWord(subject);
	// Un espectador sin sesión recibe la misma oración para las dos respuestas: nombra la ausencia y
	// la falta de permiso como alternativas, sin confirmar que el ítem existe ni afirmar que no. Es
	// una sola oración sirviendo a las dos clases a propósito; separarlas por `kind` reintroduciría
	// exactamente la fuga que esta política prohíbe.
	if (access === "anonymous" && (kind === "unauthorized" || kind === "not-found")) {
		return `No se encontró el ${word} solicitado, o no tiene permiso para verlo.`;
	}
	if (kind === "unauthorized") {
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
	// El mensaje es cierto para toda la clase. Un estado `0` no obtuvo respuesta; un `408`, cualquier
	// 5xx y un `401` sí la obtuvieron, así que nombrar la conexión afirmaría una causa que el portal
	// no observó. Decir «no se pudo completar la consulta» es verdad en los dos casos y no nombra
	// ninguna causa: la clase `unavailable` existe justamente para agrupar causas indistinguibles.
	return "No se pudo completar la consulta al catálogo de datos. Intente nuevamente más tarde.";
}

/**
 * Convierte un valor lanzado, el sujeto y el contexto de sesión en el texto que la página renderiza.
 *
 * El texto de un fallo de autorización cambia según el contexto de acceso. Un ítem inexistente sólo
 * cambia cuando el espectador no tiene sesión: ahí comparte el texto ambiguo del 403 anónimo, para
 * que las dos respuestas sean el mismo estado (ver el encabezado del módulo).
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

// ─── Qué acciones ofrece el estado de error ───────────────────────────
// Una sola: reintentar. No hay acción de inicio de sesión, y esa ausencia es parte de la política:
// un botón «Iniciar sesión» en el estado de error le confirmaría al espectador que el recurso existe.
// El camino hacia el login está en el encabezado de la aplicación, que no lleva información sobre el
// recurso solicitado.
export interface FailureActions {
	retry: boolean;
}

/**
 * Decide qué acciones acompañan al estado de error, para que ninguna página las vuelva a derivar.
 *
 * Un reintento sólo tiene sentido cuando podría cambiar la respuesta: un fallo no definitivo, o un
 * 403 cuya sonda quedó no concluyente (ese texto pide «verifique su sesión e intente nuevamente»).
 *
 * No hay acción de inicio de sesión: ofrecerla en el estado de error delataría la existencia de un
 * recurso privado. El enlace del encabezado cubre ese camino sin filtrar nada.
 */
export function failureActions(
	presentation: FailurePresentation,
	access: AccessContext,
): FailureActions {
	const retry =
		!presentation.definitive || (presentation.kind === "unauthorized" && access === "unknown");
	return { retry };
}
