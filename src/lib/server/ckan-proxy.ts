// El **puente del portal hacia el catálogo**: la única pieza que inyecta la credencial de CKAN.
//
// ─── Por qué existe ────────────────────────────────────────────────────
// Hoy el navegador tiene el JWT de CKAN (en `localStorage`) y lo manda él mismo en `Authorization`. La
// feature de endurecimiento lo saca del navegador (S1/S2 de `odd/tasks/token-hardening.md`): el servidor
// guarda la credencial en la sesión sellada (`session.ts`) y es **este** módulo el que la pone en el pedido
// al catálogo.
//
// ─── Las tres reglas que hacen que esto no sea un agujero ──────────────
//  · **La allowlist es un contrato, no una comodidad.** El proxy no reenvía cualquier acción: sólo las que el
//    portal usa. Sin lista, el proxy sería un camino abierto al token —quien lo alcanzara podría pedir
//    `user_create`, `sysadmin_role_add` o, lo peor, **acuñar tokens** de esa cuenta—. Por eso la acción se
//    acepta **por nombre exacto** y la lista se prueba contra el código real: `ckan-proxy.test.ts` escanea
//    `src/lib/api` y falla si una acción que el navegador usa no está aquí, o si una de tokens se colara.
//  · **La credencial la pone el servidor y la del cliente no viaja.** `upstreamHeaders` **no copia nada** del
//    pedido entrante: arma las dos cabeceras que el portal decide. No se puede filtrar lo que no se copia, y
//    el `Authorization` del navegador se descarta por construcción. Ésta es la regla que hace cierto el
//    anti-CSRF del diseño: si esa cabecera se propagara, cualquier página podría actuar con el token.
//  · **La URL es la interna**, la que el servidor puede alcanzar (`resolveCkanInternalUrl`), nunca una que
//    elija el navegador: una URL que viniera del cliente convertiría el proxy en un SSRF con credencial.
//
// ─── Lo que este módulo NO hace ────────────────────────────────────────
// No decide permisos. Quien autoriza sigue siendo CKAN con la identidad del token: el portal no concede nada
// por tener un token. Y no decide la sesión: `upstreamHeaders` recibe el token ya resuelto, y de dónde salió
// —la cookie sellada— es asunto de quien llama.

/**
 * Las acciones que el navegador puede pedir a través del portal: **exactamente** las que usa hoy la capa de
 * cliente (`src/lib/api`), medida el 2026-10-15 y ampliada el 2026-10-17 con las vistas de gráfico de
 * `umss_chart` (`src/lib/api/charts.ts`, contrato en `odd/tasks/csv-charts.md`). Es el conjunto más chico
 * que no rompe ninguna función del portal, y el más grande que no agrega superficie nueva.
 */
export const ALLOWED_ACTIONS = [
	"datastore_search",
	"license_list",
	"organization_create",
	"organization_list",
	"organization_list_for_user",
	"organization_show",
	"organization_update",
	"package_create",
	"package_delete",
	"package_patch",
	"package_revise",
	"package_search",
	"package_show",
	"package_update",
	"publication_request_cancel",
	"publication_request_create",
	"publication_request_decide",
	"publication_request_list",
	"resource_create",
	"resource_delete",
	"resource_show",
	"resource_update",
	"resource_view_create",
	"resource_view_delete",
	"resource_view_list",
	"resource_view_show",
	"resource_view_update",
	"status_show",
	"umss_chart_data",
	"user_show",
] as const;

/**
 * Las que el portal **no** expone al navegador, declaradas para que la exclusión sea una decisión visible y
 * no un olvido. Las llama el **servidor** contra CKAN (`ckan-auth.ts` acuña el token; el logout lo revoca), no
 * este puente. Y `api_token_create` es la que más importa: con ella, quien alcanzara el proxy podría
 * **acuñar tokens** de esa cuenta — un token dura 24 h y además puede crear y revocar tokens—, que es
 * justamente lo que S1 elimina.
 */
export const FORBIDDEN_ACTIONS = [
	"api_token_create",
	"api_token_list",
	"api_token_revoke",
] as const;

const ALLOWED = new Set<string>(ALLOWED_ACTIONS);

/**
 * Las acciones de la allowlist que se pueden pedir con **`GET`**. Todo lo demás exige `POST`.
 *
 * La razón no es de estilo. `SameSite=Lax` **no** frena una navegación de nivel superior: una página ajena puede
 * provocar un `GET` que sí lleve la cookie de la sesión. Si el verbo lo eligiera el cliente, eso sería una
 * **acción de escritura disparada desde otro sitio** —un CSRF que el diseño no cubriría—, y no se puede depender
 * de que CKAN rechace el `GET` de un mutador: se rechaza acá. Es la tercera pierna del anti-CSRF, junto con el
 * `SameSite` y la verificación de origen.
 *
 * `umss_chart_data`, `resource_view_list` y `resource_view_show` son lecturas, pero **no** están acá: el cliente
 * las pide por `POST`, y habilitar `GET` sin un consumidor `GET` sería superficie sin uso (verificación
 * independiente de `9486aeb`). El formulario del editor, además, no se puede expresar por `GET`: su `config` es
 * un objeto.
 */
export const READ_ACTIONS = [
	"datastore_search",
	"license_list",
	"organization_list",
	"organization_list_for_user",
	"organization_show",
	"package_search",
	"package_show",
	"publication_request_list",
	"resource_show",
	"status_show",
	"user_show",
] as const;

const READ = new Set<string>(READ_ACTIONS);

/** ¿Esta acción es de **lectura**? Sólo las de lectura viajan con `GET`; el resto, con `POST`. */
export function isReadAction(action: string | null | undefined): boolean {
	return typeof action === "string" && READ.has(action);
}

/**
 * Las acciones que aceptan un cuerpo **`multipart/form-data`** (las que llevan un archivo). Para cualquier otra
 * el puente sigue exigiendo JSON (`415`). Misma disciplina que `READ_ACTIONS`: lista explícita y probada, de
 * modo que una acción nueva no pueda recibir un cuerpo en stream sin que alguien lo decida acá.
 */
export const UPLOAD_ACTIONS = ["resource_create", "resource_update"] as const;

const UPLOAD = new Set<string>(UPLOAD_ACTIONS);

/** ¿Esta acción admite una subida multipart? */
export function isUploadAction(action: string | null | undefined): boolean {
	return typeof action === "string" && UPLOAD.has(action);
}

/**
 * ¿El portal puede pedir esta acción? **Nombre exacto**: `package` no es `package_show`, y una cadena
 * compuesta (`package_show; DROP …`) no es una acción. Nada de prefijos ni de coincidencias parciales.
 */
export function isAllowedAction(action: string | null | undefined): boolean {
	return typeof action === "string" && ALLOWED.has(action);
}

/**
 * La URL del pedido al catálogo, o `null` si la acción no está permitida.
 *
 * Devolver `null` en vez de lanzar es deliberado: la guarda entra **en la misma función que arma la URL**, así
 * que un llamador no puede olvidarla — si se olvidara, no tendría URL que usar.
 */
export function upstreamUrl(internalUrl: string, action: string): string | null {
	if (!isAllowedAction(action)) {
		return null;
	}

	return `${internalUrl.replace(/\/+$/, "")}/api/3/action/${action}`;
}

/**
 * Las cabeceras del pedido al catálogo: **sólo** las que el portal decide.
 *
 * `token` puede ser `null`, y eso significa **anónimo**, no «sin permiso»: el portal no inventa una identidad y
 * deja que el catálogo decida qué es público. Es el caso de un visitante sin sesión que mira un dataset público,
 * y sin él la navegación pública se rompería al pasar por el puente.
 *
 * El parámetro `incoming` existe para dejar la regla a la vista y poder probarla: el `Authorization` del
 * navegador, su cookie y cualquier otro encabezado suyo **no se copian**. No es una lista de prohibiciones
 * —que se olvida al agregar la siguiente— sino una construcción desde cero.
 */
export function upstreamHeaders(incoming: Headers, token: string | null): Headers {
	void incoming;
	const headers = new Headers();
	if (token) {
		headers.set("Authorization", token);
	}
	headers.set("Content-Type", "application/json");
	return headers;
}

/**
 * Las cabeceras de una **subida multipart**: la credencial de la sesión y el `Content-Type` del cliente **tal
 * cual**, porque lleva el `boundary` y sin él el catálogo no puede leer las partes. Viaja también el
 * `Content-Length` del cliente cuando es un entero: sin él el stream sale `chunked`, y un servidor WSGI que no
 * acepte cuerpos `chunked` lo leería vacío. Son las únicas cabeceras del cliente que viajan, y sólo en este
 * camino; el `Authorization` del cliente sigue sin viajar.
 */
export function upstreamMultipartHeaders(
	contentType: string,
	token: string | null,
	contentLength?: string | null,
): Headers {
	const headers = new Headers();
	if (token) {
		headers.set("Authorization", token);
	}
	headers.set("Content-Type", contentType);
	if (contentLength && /^\d+$/.test(contentLength)) {
		headers.set("Content-Length", contentLength);
	}
	return headers;
}
