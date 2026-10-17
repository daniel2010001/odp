// Pruebas del puente del portal hacia el catálogo: la **allowlist** de acciones y la inyección de la
// credencial (feature de endurecimiento del token, `odd/tasks/token-hardening.md`, S1/S2).
//
// Lo que estas pruebas fijan, y por qué:
//  1. **La allowlist es el contrato, y su guarda la ata al código real.** Una acción que la capa de cliente
//     usa y **no** está en la lista es una función del portal que se rompe en silencio el día que el proxy
//     entra en vigor; una acción de **servidor** que entrara en la lista sería el agujero que la feature
//     viene a cerrar. La prueba escanea `src/lib/api` —lo que el navegador pide de verdad— y exige que todo
//     lo que aparece esté permitido; y exige, al revés, que las tres acciones de tokens **no** lo estén.
//  2. **Una acción se permite por nombre exacto, nunca por prefijo ni por parecido.** `package` no es
//     `package_show`, y una cadena compuesta (`package_show; DROP …`) no es una acción.
//  3. **La credencial la pone el servidor y la del cliente NO viaja.** Es la regla que hace cierto el
//     anti-CSRF del diseño: si el `Authorization` que llega del navegador se propagara, el proxy sería un
//     camino abierto al token de cualquiera que lo tenga.
//  4. **La cookie del cliente tampoco se reenvía**, ni ningún otro encabezado suyo: lo que no se copia no
//     se filtra.
//  5. **La URL es la interna del servidor**, no una que elija el navegador.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	ALLOWED_ACTIONS,
	FORBIDDEN_ACTIONS,
	isAllowedAction,
	isReadAction,
	isUploadAction,
	READ_ACTIONS,
	UPLOAD_ACTIONS,
	upstreamHeaders,
	upstreamUrl,
} from "./ckan-proxy";

/** Las tres acciones que hoy usa el **servidor** y que en manos del navegador serían el agujero. */
const ACCIONES_DE_TOKENS = ["api_token_create", "api_token_list", "api_token_revoke"];

/** Recolecta los archivos de la capa de cliente (recursivo, sin tests). */
function archivosDeLaCapaDeCliente(dir = join(process.cwd(), "src/lib/api")): string[] {
	return readdirSync(dir).flatMap((entrada) => {
		const ruta = join(dir, entrada);
		if (statSync(ruta).isDirectory()) return archivosDeLaCapaDeCliente(ruta);
		return ruta.endsWith(".test.ts") ? [] : [ruta];
	});
}

/** Las acciones que la capa de cliente invoca, por las dos formas en que lo hace: `client.get/post` y la URL. */
function accionesQueLaCapaDeClienteUsa(): Set<string> {
	const encontradas = new Set<string>();
	for (const archivo of archivosDeLaCapaDeCliente()) {
		const fuente = readFileSync(archivo, "utf8");
		for (const [, nombre] of fuente.matchAll(
			/\.(?:get|post)\s*(?:<[\s\S]*?>)?\(\s*"([a-z][a-z0-9_]+)"/g,
		)) {
			encontradas.add(nombre);
		}
		for (const [, nombre] of fuente.matchAll(/\/api\/3\/action\/([a-z][a-z0-9_]+)/g)) {
			encontradas.add(nombre);
		}
	}
	return encontradas;
}

describe("la allowlist del proxy — atada al código real", () => {
	it("toda acción que la capa de cliente usa está permitida", () => {
		const usadas = accionesQueLaCapaDeClienteUsa();

		// Control de la propia prueba: si el escaneo no encontrara nada, la aserción pasaría por vacío.
		expect(usadas.size).toBeGreaterThan(15);

		const faltantes = [...usadas].filter((accion) => !isAllowedAction(accion));
		expect(faltantes).toEqual([]);
	});

	it("y al revés: toda acción permitida la usa la capa de cliente (sin permisos de más)", () => {
		const usadas = accionesQueLaCapaDeClienteUsa();
		const sobrantes = ALLOWED_ACTIONS.filter((accion) => !usadas.has(accion));
		expect(sobrantes).toEqual([]);
	});

	it("las lecturas de los gráficos viajan sólo por POST: el cliente no las pide con GET", () => {
		// Mínimo privilegio (verificación de `9486aeb`): habilitar GET sin un consumidor GET es superficie sin uso.
		expect(isReadAction("umss_chart_data")).toBe(false);
		expect(isReadAction("resource_view_list")).toBe(false);
	});

	it("las tres acciones de tokens NO están permitidas: el navegador no puede acuñar ni revocar tokens", () => {
		for (const accion of ACCIONES_DE_TOKENS) {
			expect(isAllowedAction(accion)).toBe(false);
			expect(ALLOWED_ACTIONS).not.toContain(accion);
		}
		// Y quedan declaradas de forma explícita, para que sacarlas de la lista sea una decisión visible.
		expect(FORBIDDEN_ACTIONS).toEqual(expect.arrayContaining(ACCIONES_DE_TOKENS));
	});

	it("no hay acciones repetidas en la lista", () => {
		expect(new Set(ALLOWED_ACTIONS).size).toBe(ALLOWED_ACTIONS.length);
	});
});

describe("la allowlist del proxy — nombre exacto, nunca prefijo", () => {
	it("una acción de la lista pasa", () => {
		expect(isAllowedAction("package_show")).toBe(true);
	});

	it("una acción de otra superficie del catálogo no pasa", () => {
		for (const accion of [
			"user_create",
			"user_delete",
			"sysadmin_role_add",
			"package_purge",
			"datastore_create",
		]) {
			expect(isAllowedAction(accion)).toBe(false);
		}
	});

	it("un prefijo o una cadena compuesta no pasan", () => {
		for (const valor of [
			"package",
			"package_showX",
			"package_show; DROP TABLE",
			"../package_show",
			"",
		]) {
			expect(isAllowedAction(valor)).toBe(false);
		}
	});

	it("sin acción no hay acción", () => {
		for (const valor of [undefined, null]) {
			expect(isAllowedAction(valor)).toBe(false);
		}
	});
});

describe("la allowlist del proxy — la partición lectura/escritura", () => {
	it("cada acción permitida está clasificada: o es de lectura, o exige POST", () => {
		const sinClasificar = ALLOWED_ACTIONS.filter((accion) => !isReadAction(accion));

		// La lista de escritura no existe como tal: es «lo permitido menos lo de lectura». Lo que esta prueba
		// impide es que una acción nueva entre sin que nadie decida **cómo se la llama**, que es por dónde se
		// cuela un mutador alcanzable con `GET`.
		expect(READ_ACTIONS.length).toBeGreaterThan(0);
		expect(sinClasificar.length).toBeGreaterThan(0);
		expect(READ_ACTIONS.every((accion) => isAllowedAction(accion))).toBe(true);
	});

	it("una lectura se reconoce como lectura, y un mutador no", () => {
		expect(isReadAction("package_show")).toBe(true);
		expect(isReadAction("publication_request_list")).toBe(true);
		expect(isReadAction("package_delete")).toBe(false);
		expect(isReadAction("publication_request_decide")).toBe(false);
		// Fuera de la allowlist no es nada, y tampoco es «lectura».
		expect(isReadAction("user_create")).toBe(false);
	});

	it("los tres mutadores de las vistas de gráfico NO son de lectura: se piden con POST", () => {
		// El par de lectura de la feature es `umss_chart_data` + `resource_view_list`; crear, actualizar y
		// borrar una vista cambian el catálogo, así que ni siquiera son alcanzables con un `GET`.
		for (const accion of ["resource_view_create", "resource_view_update", "resource_view_delete"]) {
			expect(isAllowedAction(accion)).toBe(true);
			expect(isReadAction(accion)).toBe(false);
		}
	});
});

describe("la allowlist del proxy — las acciones de subida (multipart)", () => {
	it("son exactamente las dos que llevan archivo, y están permitidas", () => {
		expect([...UPLOAD_ACTIONS]).toEqual(["resource_create", "resource_update"]);
		expect(UPLOAD_ACTIONS.every((accion) => isAllowedAction(accion))).toBe(true);
	});

	it("ninguna acción de subida es de lectura: se piden con POST", () => {
		expect(UPLOAD_ACTIONS.some((accion) => isReadAction(accion))).toBe(false);
	});

	it("una acción de subida se reconoce, y cualquier otra no", () => {
		expect(isUploadAction("resource_create")).toBe(true);
		expect(isUploadAction("resource_update")).toBe(true);
		expect(isUploadAction("package_create")).toBe(false);
		expect(isUploadAction("resource_delete")).toBe(false);
		expect(isUploadAction("user_create")).toBe(false);
		expect(isUploadAction(null)).toBe(false);
		expect(isUploadAction(undefined)).toBe(false);
	});
});

describe("la URL del pedido al catálogo", () => {
	it("se arma sobre la URL interna del servidor, con la acción permitida", () => {
		expect(upstreamUrl("http://ckan:5000", "package_show")).toBe(
			"http://ckan:5000/api/3/action/package_show",
		);
	});

	it("una barra final en la URL interna no duplica la barra", () => {
		expect(upstreamUrl("http://ckan:5000/", "package_show")).toBe(
			"http://ckan:5000/api/3/action/package_show",
		);
	});

	it("una acción no permitida no produce URL: la guarda no se puede olvidar en el llamador", () => {
		for (const accion of [...ACCIONES_DE_TOKENS, "user_create", "package"]) {
			expect(upstreamUrl("http://ckan:5000", accion)).toBeNull();
		}
	});
});

describe("las cabeceras del pedido al catálogo — la credencial del cliente no viaja", () => {
	it("inyecta la credencial del servidor", () => {
		const cabeceras = upstreamHeaders(new Headers(), "jwt-de-la-sesion");

		expect(cabeceras.get("authorization")).toBe("jwt-de-la-sesion");
		expect(cabeceras.get("content-type")).toBe("application/json");
	});

	it("sin credencial (anónimo) no se inventa una `Authorization`: el catálogo decide qué es público", () => {
		const cabeceras = upstreamHeaders(new Headers(), null);

		expect(cabeceras.get("authorization")).toBeNull();
		expect([...cabeceras.keys()]).toEqual(["content-type"]);
	});

	it("el `Authorization` que llega del cliente NO se propaga ni sobrevive", () => {
		const delCliente = new Headers({ authorization: "token-del-navegador" });

		const cabeceras = upstreamHeaders(delCliente, "jwt-de-la-sesion");

		expect(cabeceras.get("authorization")).toBe("jwt-de-la-sesion");
	});

	it("la cookie del cliente y cualquier otro encabezado suyo tampoco viajan", () => {
		const delCliente = new Headers({
			cookie: "odp_session=lo-que-sea",
			"x-forwarded-for": "10.0.0.1",
			accept: "text/html",
		});

		const cabeceras = upstreamHeaders(delCliente, "jwt-de-la-sesion");

		expect(cabeceras.get("cookie")).toBeNull();
		expect(cabeceras.get("x-forwarded-for")).toBeNull();
		expect(cabeceras.get("accept")).toBeNull();
		// La forma exacta: sólo las dos cabeceras que el portal decide.
		expect([...cabeceras.keys()].sort()).toEqual(["authorization", "content-type"]);
	});
});
