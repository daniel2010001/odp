#!/usr/bin/env node
// Seed ligero de CKAN para desarrollo (odp).
//
// Puebla el CKAN de dev con contenido realista (organizaciones + datasets)
// espejado de src/lib/mock/data.ts, para que el portal muestre datos reales
// en lugar de listas vacías. **Todo recurso es un archivo subido** (`url_type: upload`) cuyos
// bytes coinciden con su formato, para que el portal muestre un archivo real con su vista previa
// sin conexión y no un enlace con un formato inventado (odd/tasks/demo-honest-data.md, S4):
//   · los 15 datasets base y el del Observatorio de Movilidad (`SHOWCASE`) suben un CSV, XLSX,
//     PDF, JSON o GeoJSON generado en memoria al sembrar (`generate-demo-files.mjs`, sin archivos
//     versionados). Son datos ficticios y no pasan por xloader ni por los tipos.
//   · `buildMoreDatasets` agrega 30 datasets con nombres nuevos (6 por organización, con varias etiquetas
//     y licencias, y los ocho formatos: además de los de arriba, PNG, JPG y TXT) para que el buscador
//     pase de 21 a 51 datasets y el paginado (20 por página) llegue a tres páginas (S18 de
//     odd/tasks/v0.1.1-polish.md). No se tocan los existentes: sólo se crea lo que no está.
//   · los datasets ficticios de la demo (`DEMOS`) se **suben** desde `scripts/data`:
//   · los CSV (`planilla-docente-ficticia` y los tres de T7), para que xloader los cargue en el
//     DataStore. Sin eso la demo de gráficos no tiene nada que graficar (L4 de
//     odd/tasks/csv-charts.md, T6). xloader carga todo como texto, así que después de la carga el
//     seed declara los tipos (`ensureTyped`, L36).
//   · `informe-matricula-ficticio`, un PDF generado, para que la vista previa del PDF funcione
//     en la laptop de la demo, sin internet. No es tabular: no pasa por xloader ni por los tipos.
//
// Uso con la contraseña del sysadmin (flujo original):
//   CKAN_URL=http://localhost:5000 \
//   CKAN_SYSADMIN_NAME=ckan_admin \
//   CKAN_SYSADMIN_PASSWORD=... \
//   node scripts/seed-ckan.mjs
//
// Uso con un token propio, sin login por contraseña:
//   CKAN_URL=http://localhost:5000 \
//   CKAN_API_TOKEN=... \
//   node scripts/seed-ckan.mjs
//
// Con `CKAN_API_TOKEN` no se hace login, no se mintea ningún token y **no se revoca
// nada al terminar**: el token es del llamador y sigue vigente. Sin esa variable, el
// seed mintea un token de seed y lo revoca (best-effort) al final, como antes.
//
// Publica por el flujo de publicación, como lo haría una persona. La pared del store
// (`ckanext-umss`) rechaza crear o parchear un dataset a `private: false` —para todos,
// sysadmin incluido—, así que cada dataset nace **privado** y después se pide y se aprueba
// su publicación con las acciones del portal (`publication_request_create` y
// `publication_request_decide`, tal como las llama `src/lib/api/publication.ts`). Sin ese
// paso una instalación nueva no siembra nada: los 17 datasets del catálogo dev están sólo
// porque son anteriores a la pared (L15 de odd/tasks/csv-charts.md).
//
// Gráficos (S7 de odd/tasks/demo-honest-data.md): en un paso aparte, después de los datasets, crea 2–3
// vistas `umss_chart` (barras, líneas y torta) sobre el CSV de cada dataset de `DEMOS`, con
// `resource_view_create` (`scripts/seed-charts.mjs`). Corre también para los datasets ya públicos, porque
// sin vistas no hay pestañas de gráfico ni botón «Insertar». Espera a que la tabla del DataStore exista y
// valida cada configuración contra los campos reales de la tabla; si no está lista, informa y sigue.
//
// Idempotente (también para los datasets adicionales: se identifican por su `name`, así que correr el
// seed otra vez sólo lee, sin crear ni modificar nada): si una organización ya existe (por `name`), se salta; si un dataset ya
// existe **y es público**, se salta sin pedir nada; si existe y sigue **privado** (una
// corrida anterior murió entre crear y aprobar), se reusa la solicitud pendiente o se pide
// una nueva, y se termina la publicación. Si a cualquier dataset le falta un recurso (por
// nombre), se sube sólo ese recurso. Un dataset de la demo ya público no se toca (tampoco su tabla), pero sí se le completan los gráficos que
// le falten (por título).
// No se guarda ninguna credencial en el repo: se leen del entorno en cada corrida.

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv } from "./generate-csv-common.mjs";
import { TYPES as PLANILLA_TYPES } from "./generate-demo-csv.mjs";
import { FORMAT_INFO, generateFile } from "./generate-demo-files.mjs";
import { TYPES as INVESTIGACION_TYPES } from "./generate-investigacion-csv.mjs";
import { TYPES as MATRICULA_TYPES } from "./generate-matricula-csv.mjs";
import { TYPES as PRESUPUESTO_TYPES } from "./generate-presupuesto-csv.mjs";
import {
	CHART_VIEWS,
	chartViewPayload,
	validateSeedConfig,
	viewsToCreate,
} from "./seed-charts.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

const CKAN_URL = (process.env.CKAN_URL ?? "http://localhost:5000").replace(/\/+$/, "");
const ADMIN_NAME = process.env.CKAN_SYSADMIN_NAME ?? "ckan_admin";
const ADMIN_PASSWORD = process.env.CKAN_SYSADMIN_PASSWORD;
const CKAN_API_TOKEN = process.env.CKAN_API_TOKEN?.trim() || null;

// El plugin `expire_api_token` (presente en `CKAN__PLUGINS`) hace **obligatorios**
// `expires_in` y `unit` en `api_token_create`: sin ellos CKAN responde 409 con
// `{'expires_in': ['Missing value'], 'unit': ['Missing value']}` y el seed aborta.
// Mismos valores que el portal (`src/lib/server/ckan-auth.ts`, `TOKEN_TTL`).
const TOKEN_TTL = { expires_in: 1, unit: 86400 };

// ── Credenciales: token del llamador o login por contraseña ──

async function resolveCredentials() {
	if (CKAN_API_TOKEN) {
		console.log("Credencial: CKAN_API_TOKEN del llamador (sin login y sin revocar al final).");
		return { token: CKAN_API_TOKEN, jar: null, csrf: null, jti: null, ownsToken: false };
	}
	if (!ADMIN_PASSWORD) {
		console.error(
			"Falta CKAN_SYSADMIN_PASSWORD o CKAN_API_TOKEN. Exporte una de las dos antes de correr el seed.",
		);
		process.exit(2);
	}
	const { jar, csrf, token, jti } = await login();
	return { token, jar, csrf, jti, ownsToken: true };
}

// ── Mini jar de cookies (mismo flujo validado que src/lib/server/ckan-auth.ts) ──

class CookieJar {
	#cookies = new Map();
	store(setCookie) {
		const first = String(setCookie).split(";")[0]?.trim() ?? "";
		const eq = first.indexOf("=");
		if (eq <= 0) return;
		this.#cookies.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
	}
	toString() {
		return [...this.#cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
	}
}

function readSetCookies(headers) {
	if (typeof headers.getSetCookie === "function") {
		const list = headers.getSetCookie();
		if (list.length > 0) return list;
	}
	const raw = headers.get("set-cookie");
	return raw ? [raw] : [];
}

/**
 * Los encabezados de una llamada con la cookie de sesión. Por HTTPS, el chequeo CSRF de CKAN (Flask-WTF, SSL
 * estricto) exige además un `Referer` del mismo origen; sin él responde 400 «The referrer header is missing.»
 * (log de la demo, 2026-10-18). Por HTTP no se exige, y por eso el seed andaba contra el CKAN de dev.
 */
export function sessionHeaders(cookie, csrf, ckanUrl = CKAN_URL) {
	return {
		"Content-Type": "application/json",
		"X-CSRFToken": csrf,
		Cookie: cookie,
		Referer: `${ckanUrl}/`,
	};
}

async function csrfToken(jar) {
	const res = await fetch(`${CKAN_URL}/user/${ADMIN_NAME}`, {
		headers: { Cookie: jar.toString() },
	});
	for (const c of readSetCookies(res.headers)) jar.store(c);
	const html = await res.text();
	const m = /<meta\s+name="_csrf_token"\s+content="([^"]*)"/i.exec(html);
	if (!m) throw new Error("No se pudo obtener el token CSRF.");
	return m[1];
}

async function login() {
	const jar = new CookieJar();
	const res = await fetch(`${CKAN_URL}/user/login`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({ login: ADMIN_NAME, password: ADMIN_PASSWORD }).toString(),
		redirect: "manual",
	});
	for (const c of readSetCookies(res.headers)) jar.store(c);
	if (res.status < 300 || res.status >= 400) {
		throw new Error(`Login falló (HTTP ${res.status}). Credenciales inválidas?`);
	}

	// `api_token_create` **no devuelve el `jti`**: medido, su `result` sólo trae `token`.
	// Los ids sí están en `api_token_list` (cada entrada trae `id`), que es lo que
	// `api_token_revoke` necesita. Se resuelve por diferencia: los ids que existen
	// antes de mintear vs. los que existen después.
	const tokenIds = async () => {
		const res = await fetch(`${CKAN_URL}/api/3/action/api_token_list`, {
			method: "POST",
			headers: sessionHeaders(jar.toString(), csrf),
			body: JSON.stringify({ user_id: ADMIN_NAME }),
		});
		const payload = await res.json().catch(() => null);
		return (payload?.result ?? []).map((t) => t.id).filter(Boolean);
	};

	let csrf = await csrfToken(jar);
	let token;
	let jti;
	const idsBefore = new Set(await tokenIds());
	for (let attempt = 0; attempt < 2; attempt++) {
		const mint = await fetch(`${CKAN_URL}/api/3/action/api_token_create`, {
			method: "POST",
			headers: sessionHeaders(jar.toString(), csrf),
			body: JSON.stringify({ user: ADMIN_NAME, name: "odp-seed", ...TOKEN_TTL }),
		});
		if (mint.status === 400 && attempt === 0) {
			csrf = await csrfToken(jar);
			continue;
		}
		const payload = await readJson(mint, "api_token_create");
		if (!payload.success || !payload.result?.token) {
			throw new Error(`api_token_create falló: ${JSON.stringify(payload.error ?? {})}`);
		}
		token = payload.result.token;
		jti = (await tokenIds()).find((id) => !idsBefore.has(id));
		break;
	}
	return { jar, csrf, token, jti };
}

/**
 * El cuerpo JSON de una respuesta de CKAN. Si no es JSON —una página de error HTML de CKAN o del proxy—
 * se informa con su status, su URL y el comienzo del cuerpo, en vez del «Unexpected token '<'» del
 * parseo, que no dice qué pedido falló (demo, 2026-10-18).
 */
export async function readJson(res, label) {
	const text = await res.text();
	try {
		return JSON.parse(text);
	} catch {
		const start = text.slice(0, 200).replace(/\s+/g, " ").trim();
		throw new Error(`${label}: HTTP ${res.status} ${res.url} no respondió JSON: ${start}`);
	}
}

async function api(token, action, data) {
	const res = await fetch(`${CKAN_URL}/api/3/action/${action}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: token },
		body: JSON.stringify(data),
	});
	return readJson(res, action);
}

// ── Publicación: el seed publica por el flujo, como lo haría una persona ──
//
// Un dataset no puede nacer público: la pared del store lo rechaza. Nace privado, y después
// se pide (`publication_request_create`) y se aprueba (`publication_request_decide`) como el
// mismo usuario. En una organización con un solo administrador —todas las de un catálogo
// recién sembrado, donde el único miembro es quien corre el seed— la excepción de
// auto-aprobación (`c′`) lo concede; con un segundo aprobador manda cuatro ojos y el dataset
// se queda privado, sin abortar el resto del seed.

// Los errores de CKAN vienen en dos formas: `{__type, message}` (403 de autorización) y una
// clave por campo con la lista de mensajes (409 de validación). El log quiere el rótulo y el
// mensaje, no el JSON entero.
function errorText(error) {
	if (!error) return "sin detalle";
	if (typeof error === "string") return error;
	if (typeof error.message === "string") return error.message;
	const parts = Object.entries(error).map(([key, value]) => {
		const text = Array.isArray(value) ? value.map(errorText).join(", ") : errorText(value);
		return `${key}: ${text}`;
	});
	return parts.join("; ") || "sin detalle";
}

// La solicitud **pendiente** de un dataset, si la hay. La acción es `side_effect_free` y el
// portal la llama por GET; acá va por POST como todas las demás, que CKAN acepta igual. El
// cliente del portal sólo manda `status` (`src/lib/api/publication.ts:156-160`), así que el
// filtro por dataset se hace de este lado — contra sus **dos** formas, el id canónico y el
// nombre de las filas legadas, como hace la ficha (`src/routes/dataset/[id]/+page.svelte:177`).
async function pendingRequestFor(token, pkg) {
	const list = await api(token, "publication_request_list", { status: "pending" });
	if (!list.success) return { error: list.error ?? {} };
	const row = (list.result ?? []).find(
		(request) => request.dataset_id === pkg.id || request.dataset_id === pkg.name,
	);
	return { row: row ?? null };
}

// Pide —o reusa— la solicitud de publicación, la aprueba y **relee** el dataset para informar
// el valor guardado.
//
// `pkg` es una lectura del dataset (`package_create` o `package_show`): de ahí salen el id y
// el `state`. El `state` se mira **antes** de publicar porque el flujo no lo toca: un `draft`
// queda ilegible aunque la aprobación voltee `private` (L10 de
// odd/tasks/publication-self-approval.md), o sea que aprobarlo sería un trámite que no
// publica nada.
async function publishDataset(token, pkg) {
	const { id, name } = pkg;
	if (pkg.state !== "active") {
		console.error(
			`✗ publicación ${name}: el dataset está en state=${pkg.state ?? "?"}, y el flujo no lo ` +
				"vuelve legible (sólo `private: false` con `state: active` es público), así que no se pide.",
		);
		return;
	}

	const pending = await pendingRequestFor(token, pkg);
	if (pending.error) {
		console.error(`✗ publicación ${name}: no se pudo leer la cola (${errorText(pending.error)}).`);
		return;
	}

	// Idempotencia del pedido: una corrida anterior pudo dejar la solicitud abierta. Pedir otra
	// sería duplicarla; el catálogo además ya tiene una pendiente para este dataset.
	let request = pending.row;
	if (request) {
		console.log(`· solicitud pendiente reaprovechada: ${name} (${request.id})`);
	} else {
		const created = await api(token, "publication_request_create", { dataset_id: id });
		if (!created.success) {
			console.error(`✗ publication_request_create ${name}: ${errorText(created.error)}.`);
			return;
		}
		request = created.result;
	}

	if (!request?.id) {
		console.error(
			`✗ publicación ${name}: la solicitud no trae id (${JSON.stringify(request ?? null)}).`,
		);
		return;
	}

	const decided = await api(token, "publication_request_decide", {
		request_id: request.id,
		approve: true,
	});
	if (!decided.success) {
		// Cuatro ojos no es un fallo del seed: el dataset queda privado con su solicitud
		// pendiente y el resto del catálogo se siembra igual. Se dice en una línea.
		console.error(
			`✗ publicación ${name}: la aprobación fue rechazada (${errorText(decided.error)}); ` +
				`el dataset queda privado con la solicitud ${request.id} pendiente.`,
		);
		return;
	}

	// La prueba es el valor **guardado**, no la respuesta del decisor: se relee el dataset. Se
	// informan las dos mitades porque el label `public` de este CKAN exige `private: false`
	// **y** `state: active`. Leído con el token del dueño esto prueba que el flip se escribió,
	// no que la lectura anónima funcione.
	const shown = await api(token, "package_show", { id });
	if (!shown.success) {
		console.error(
			`✗ ${name}: se aprobó (${request.id}) pero no se pudo releer el dataset ` +
				`(${errorText(shown.error)}).`,
		);
		return;
	}
	const { private: isPrivate, state } = shown.result;
	const isPublic = isPrivate === false && state === "active";
	console.log(
		isPublic
			? `✓ publicado: ${name} (private=false, state=active)`
			: `✗ ${name}: aprobado, pero no es público (private=${isPrivate}, state=${state}).`,
	);
}

// ── Datos espejados de src/lib/mock/data.ts ──

export const ORGS = [
	{
		name: "fcyt",
		title: "Facultad de Ciencias y Tecnología",
		description: "FCyT - UMSS. Investigación en ingeniería, ciencias exactas y tecnología.",
	},
	{
		name: "fcs",
		title: "Facultad de Ciencias de la Salud",
		description: "Medicina, enfermería, odontología y ciencias farmacéuticas.",
	},
	{
		name: "fca",
		title: "Facultad de Ciencias Agrícolas",
		description: "Investigación agropecuaria y recursos naturales.",
	},
	{
		name: "rectorado",
		title: "Rectorado UMSS",
		description: "Administración central de la Universidad Mayor de San Simón.",
	},
	{
		name: "direccion-investigacion",
		title: "Dirección de Investigación",
		description: "Coordinación y gestión de proyectos de investigación universitarios.",
	},
];

const BASE_NAMES = [
	"Presupuesto anual ejecutado por facultad",
	"Matrícula estudiantil por carrera y gestión",
	"Producción científica del personal docente",
	"Resultados de evaluación docente por semestre",
	"Proyectos de investigación activos",
	"Indicadores de eficiencia terminal",
	"Distribución de becas por facultad",
	"Infraestructura de laboratorios y equipamiento",
	"Publicaciones indexadas por departamento",
	"Consumo energético por edificio",
	"Tasas de graduación por cohorte",
	"Convenios interinstitucionales activos",
	"Recursos bibliográficos digitales",
	"Programas de posgrado ofertados",
	"Encuestas de satisfacción estudiantil",
];

const DESCS = [
	"Datos del presupuesto ejecutado por cada facultad durante la gestión, incluyendo gastos corrientes, de inversión y proyectos. Contiene series históricas desde 2018.",
	"Registro detallado de estudiantes matriculados por carrera, semestre y gestión académica. Incluye datos demográficos y distribución por sexo.",
	"Artículos científicos, libros y capítulos publicados por docentes e investigadores de la universidad. Indexado por Scopus, WoS y Latindex.",
	"Resultados de las evaluaciones de desempeño docente realizadas por los estudiantes al finalizar cada semestre académico.",
	"Catálogo de proyectos de investigación financiados con fondos internos y externos. Incluye estado, presupuesto y resultados esperados.",
	"Indicadores de eficiencia terminal, abandono y duración promedio de estudios por carrera y facultad. Series 2015-2025.",
	"Distribución de becas internas y externas otorgadas a estudiantes de grado y posgrado, por tipo de beca y facultad.",
	"Inventario de laboratorios, equipos científicos y capacidad instalada de las diferentes facultades y centros de investigación.",
	"Registro de publicaciones científicas indexadas en bases de datos internacionales, clasificadas por área temática y departamento.",
	"Datos de consumo eléctrico, agua y gas de los edificios universitarios. Mediciones mensuales por punto de consumo.",
	"Tasas de graduación, deserción y duración promedio de estudios por cohorte de ingreso y carrera.",
	"Registro de convenios nacionales e internacionales vigentes, incluyendo instituciones socias, objetivos y fechas.",
	"Catálogo de recursos bibliográficos digitales disponibles en el sistema de bibliotecas de la universidad.",
	"Oferta académica de programas de maestría, doctorado y especialización por facultad y modalidad.",
	"Resultados de encuestas de satisfacción aplicadas a estudiantes de grado y posgrado sobre servicios universitarios.",
];

const TAG_POOL = [
	"presupuesto",
	"educación",
	"investigación",
	"salud",
	"agricultura",
	"tecnología",
	"infraestructura",
	"docentes",
	"estudiantes",
	"recursos",
	"calidad",
	"proyectos",
	"publicaciones",
	"laboratorios",
	"becas",
];

const FORMATS = ["CSV", "XLSX", "PDF", "JSON", "GeoJSON"];

// Nota que lleva todo dataset y recurso sembrado: ninguno es oficial.
const FICTITIOUS = "Datos ficticios para demostración: no son datos oficiales de la UMSS.";

// Un recurso sembrado es un archivo real: `bytes()` lo genera en memoria (determinista por
// dataset + formato + recurso), `filename` y `mime` salen del formato. `profile` es la clave de
// `PROFILES` (`generate-demo-files.mjs`) que fija las columnas del archivo.
function fileResource({ datasetName, title, profile, name, description, format, filename }) {
	const { mime, ext } = FORMAT_INFO[format];
	return {
		name,
		description: `${FICTITIOUS} ${description}`,
		format,
		mime,
		filename: `${filename}.${ext}`,
		profile,
		bytes: () =>
			generateFile({ datasetName, resourceName: name, title, description, profile, format }),
	};
}
const LICENSES = ["cc-by", "cc-by-sa", "cc-zero", "odc-odbl"];

function slugify(text) {
	return text
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100);
}

export function buildBaseDatasets() {
	const datasets = [];
	for (let i = 0; i < BASE_NAMES.length; i++) {
		const org = ORGS[i % ORGS.length];
		const title = BASE_NAMES[i];
		const name = slugify(title);
		const tags = [
			TAG_POOL[i % TAG_POOL.length],
			TAG_POOL[(i + 3) % TAG_POOL.length],
			TAG_POOL[(i + 7) % TAG_POOL.length],
		]
			.filter((v, idx, arr) => arr.indexOf(v) === idx)
			.map((t) => ({ name: t }));

		const resourceCount = 1 + (i % 3);
		const resources = Array.from({ length: resourceCount }, (_, ri) =>
			fileResource({
				datasetName: name,
				title,
				profile: name,
				name: `${title}${ri > 0 ? ` — parte ${ri + 1}` : ""}`,
				description: `Archivo de muestra ${ri + 1} de ${resourceCount} sobre «${title.toLowerCase()}».`,
				format: FORMATS[(i + ri) % FORMATS.length],
				filename: `${name}-${ri + 1}`,
			}),
		);

		datasets.push({
			name,
			title,
			owner_org_name: org.name,
			// `notes` es markdown (RF-39): texto plano con párrafos separados por línea en blanco.
			// No se escribe HTML acá a propósito — el render no interpreta HTML crudo.
			notes: `${DESCS[i]}\n\n${FICTITIOUS} Los archivos son de muestra y no reproducen cifras reales de la ${org.title}.`,
			license_id: LICENSES[i % LICENSES.length],
			tags,
			resources,
		});
	}
	return datasets;
}

// ── Datasets adicionales para probar el buscador y el paginado (S18 de odd/tasks/v0.1.1-polish.md) ──
//
// Con los 21 datasets que ya siembra el seed (15 base, el Observatorio y 5 de la demo), el buscador
// (20 por página) no pasaba de dos páginas. Estos 30 llevan el catálogo a 51: tres páginas, la última
// con 11. Se reparten por las cinco organizaciones (seis cada una), con varias etiquetas, licencias y
// los ocho formatos. Todos tienen **nombre nuevo**: el seed no repite lo que ya existe, así que sembrarlos
// no toca ningún dataset ni recurso previo, y volver a correrlo no hace nada.

const MORE_LICENSES = [...LICENSES, "odc-by", "cc-nc", "odc-pddl"];
const MORE_FORMATS = Object.keys(FORMAT_INFO);

// [título, organización, etiquetas, descripción]
const MORE_SPECS = [
	[
		"Inventario de equipos de cómputo por laboratorio",
		"fcyt",
		["tecnología", "infraestructura", "laboratorios"],
		"Registro de los equipos de cómputo de los laboratorios de la facultad, con su tipo, año de adquisición y estado de operación.",
	],
	[
		"Estaciones meteorológicas del campus",
		"fcyt",
		["clima", "ambiente", "series-temporales"],
		"Mediciones diarias de temperatura, humedad y precipitación registradas por las estaciones meteorológicas de los campus universitarios.",
	],
	[
		"Resultados de las olimpiadas de matemática y física",
		"fcyt",
		["educación", "estudiantes", "olimpiadas"],
		"Participación y puntajes máximos de las olimpiadas científicas organizadas por la facultad, por gestión, disciplina y nivel.",
	],
	[
		"Uso de la red inalámbrica del campus por facultad",
		"fcyt",
		["tecnología", "conectividad", "infraestructura"],
		"Usuarios únicos, tráfico e incidencias de la red inalámbrica universitaria, agregados por mes y facultad.",
	],
	[
		"Proyectos de grado defendidos en ingeniería",
		"fcyt",
		["educación", "titulación", "ingeniería"],
		"Proyectos de grado, tesis y trabajos dirigidos defendidos en las carreras de ingeniería, con su modalidad y calificación.",
	],
	[
		"Calidad del agua en puntos de muestreo del valle",
		"fcyt",
		["agua", "ambiente", "calidad"],
		"Resultados fisicoquímicos y microbiológicos de los puntos de muestreo de agua monitoreados por los laboratorios de la facultad.",
	],
	[
		"Atenciones del policlínico universitario por especialidad",
		"fcs",
		["salud", "atención-médica", "bienestar"],
		"Atenciones mensuales del policlínico universitario según especialidad y población atendida.",
	],
	[
		"Campañas de vacunación estudiantil",
		"fcs",
		["salud", "prevención", "estudiantes"],
		"Dosis aplicadas en las campañas de vacunación dirigidas a la comunidad estudiantil, por vacuna y facultad.",
	],
	[
		"Prácticas clínicas por centro de salud",
		"fcs",
		["salud", "prácticas", "convenios"],
		"Estudiantes de ciencias de la salud que realizan prácticas clínicas en cada centro, con su carga horaria semanal.",
	],
	[
		"Estado nutricional de estudiantes ingresantes",
		"fcs",
		["salud", "nutrición", "estudiantes"],
		"Clasificación del estado nutricional de los estudiantes que ingresan a la universidad, por facultad y sexo.",
	],
	[
		"Cobertura de seguro universitario de salud",
		"fcs",
		["salud", "seguro", "bienestar"],
		"Afiliados, atenciones y porcentaje de cobertura del seguro universitario de salud por facultad y gestión.",
	],
	[
		"Egresados de enfermería por gestión",
		"fcs",
		["salud", "egresados", "empleo"],
		"Egresados de la carrera de enfermería por gestión y nivel, con el porcentaje que accede a un empleo en su primer año.",
	],
	[
		"Producción de semillas nativas en estaciones experimentales",
		"fca",
		["agricultura", "semillas", "biodiversidad"],
		"Producción de semilla de especies nativas en las estaciones experimentales, con su porcentaje de germinación.",
	],
	[
		"Rendimiento de cultivos por parcela experimental",
		"fca",
		["agricultura", "cultivos", "investigación"],
		"Superficie y rendimiento por hectárea de los cultivos establecidos en las parcelas experimentales de la facultad.",
	],
	[
		"Estaciones experimentales y superficie cultivada",
		"fca",
		["agricultura", "infraestructura", "territorio"],
		"Inventario de estaciones experimentales con su municipio, altitud, superficie y personal asignado.",
	],
	[
		"Registro de especies forestales del vivero universitario",
		"fca",
		["bosques", "ambiente", "biodiversidad"],
		"Especies forestales producidas en el vivero universitario, con su origen, cantidad de plantines y uso previsto.",
	],
	[
		"Consumo de agua de riego en parcelas",
		"fca",
		["agua", "riego", "agricultura"],
		"Volúmenes mensuales de agua de riego por parcela y sistema de riego, con su eficiencia de aplicación.",
	],
	[
		"Ensayos de fertilización orgánica",
		"fca",
		["agricultura", "fertilización", "investigación"],
		"Resultados de ensayos con abonos orgánicos en distintos cultivos, expresados como incremento porcentual del rendimiento.",
	],
	[
		"Personal administrativo por unidad y cargo",
		"rectorado",
		["administración", "personal", "recursos"],
		"Número de funcionarios administrativos por unidad, cargo y gestión, con su antigüedad promedio.",
	],
	[
		"Ejecución del plan operativo anual por unidad",
		"rectorado",
		["planificación", "gestión", "calidad"],
		"Actividades programadas y cumplidas del plan operativo anual de cada unidad administrativa.",
	],
	[
		"Solicitudes de información pública atendidas",
		"rectorado",
		["transparencia", "acceso-a-la-información", "administración"],
		"Solicitudes de información recibidas por la universidad, con su canal, tema y tiempo de respuesta en días.",
	],
	[
		"Ingresos propios por concepto y gestión",
		"rectorado",
		["presupuesto", "finanzas", "recursos"],
		"Ingresos propios de la universidad por concepto y gestión, con su variación respecto de la gestión anterior.",
	],
	[
		"Contrataciones y adquisiciones por modalidad",
		"rectorado",
		["transparencia", "contrataciones", "presupuesto"],
		"Procesos de contratación de bienes y servicios por gestión y modalidad, con su monto y estado.",
	],
	[
		"Reclamos y sugerencias recibidos por canal",
		"rectorado",
		["calidad", "atención-al-usuario", "servicios"],
		"Reclamos, sugerencias y felicitaciones recibidos por cada canal de atención y porcentaje resuelto.",
	],
	[
		"Convocatorias de investigación y proyectos adjudicados",
		"direccion-investigacion",
		["investigación", "proyectos", "financiamiento"],
		"Convocatorias internas de investigación, con sus postulaciones, proyectos adjudicados y monto asignado.",
	],
	[
		"Grupos y centros de investigación registrados",
		"direccion-investigacion",
		["investigación", "investigadores", "organización"],
		"Grupos y centros de investigación registrados, con su área, facultad, número de investigadores y año de creación.",
	],
	[
		"Tesis de posgrado defendidas por programa",
		"direccion-investigacion",
		["posgrado", "tesis", "investigación"],
		"Tesis de maestría, doctorado y especialidad defendidas por gestión y facultad, con su duración promedio.",
	],
	[
		"Eventos científicos organizados por gestión",
		"direccion-investigacion",
		["investigación", "eventos", "divulgación"],
		"Congresos, seminarios y talleres científicos organizados por la universidad, con sus asistentes y ponencias.",
	],
	[
		"Patentes y registros de propiedad intelectual",
		"direccion-investigacion",
		["propiedad-intelectual", "innovación", "investigación"],
		"Patentes, derechos de autor y otros registros de propiedad intelectual solicitados por la universidad.",
	],
	[
		"Colaboraciones internacionales de investigación por país",
		"direccion-investigacion",
		["cooperación", "investigación", "convenios"],
		"Proyectos y publicaciones conjuntas con instituciones de otros países, por área y gestión.",
	],
];

export function buildMoreDatasets() {
	return MORE_SPECS.map(([title, org, tags, description], i) => {
		const name = slugify(title);
		const resourceCount = 1 + (i % 3);
		const resources = Array.from({ length: resourceCount }, (_, ri) =>
			fileResource({
				datasetName: name,
				title,
				profile: name,
				name: `${title}${ri > 0 ? ` — parte ${ri + 1}` : ""}`,
				description: `Archivo de muestra ${ri + 1} de ${resourceCount} sobre «${title.toLowerCase()}».`,
				format: MORE_FORMATS[(i + ri) % MORE_FORMATS.length],
				filename: `${name}-${ri + 1}`,
			}),
		);
		const orgTitle = ORGS.find((o) => o.name === org).title;
		return {
			name,
			title,
			owner_org_name: org,
			notes: `${description}\n\n${FICTITIOUS} Los archivos son de muestra y no reproducen cifras reales de la ${orgTitle}.`,
			license_id: MORE_LICENSES[i % MORE_LICENSES.length],
			tags: tags.map((tag) => ({ name: tag })),
			resources,
		};
	});
}

const SHOWCASE_NAME = "observatorio-de-movilidad-urbana-cochabamba";
const SHOWCASE_TITLE = "Observatorio de Movilidad Urbana — Cochabamba";

export const SHOWCASE = {
	name: SHOWCASE_NAME,
	title: SHOWCASE_TITLE,
	owner_org_name: "fcyt",
	notes:
		"El Observatorio de Movilidad Urbana de Cochabamba recopila, procesa y publica datos abiertos sobre movilidad urbana en el área metropolitana de Kanata: flujos vehiculares, encuestas de origen-destino, transporte público y accidentalidad vial.\n\nLos archivos de este conjunto son de muestra. " +
		FICTITIOUS,
	license_id: "cc-by",
	author: "Centro de Investigación en Movilidad Urbana (CIMU-FCyT)",
	maintainer: "Ing. María Elena Vargas Quiroga",
	tags: [
		{ name: "movilidad" },
		{ name: "transporte" },
		{ name: "cochabamba" },
		{ name: "geolocalización" },
		{ name: "accidentalidad" },
		{ name: "series-temporales" },
		{ name: "transporte-público" },
	],
	resources: [
		fileResource({
			datasetName: SHOWCASE_NAME,
			title: SHOWCASE_TITLE,
			profile: "observatorio-flujos-vehiculares",
			name: "Flujos vehiculares por punto de conteo (2019–2025)",
			description:
				"Muestra de flujos vehiculares horarios por punto de conteo, sentido y tipo de vehículo.",
			format: "CSV",
			filename: "flujos-vehiculares",
		}),
		fileResource({
			datasetName: SHOWCASE_NAME,
			title: SHOWCASE_TITLE,
			profile: "observatorio-encuesta-origen-destino",
			name: "Encuesta de origen-destino 2024",
			description:
				"Muestra de hogares encuestados con su distrito, modo principal de viaje, motivo y tiempo de viaje.",
			format: "XLSX",
			filename: "encuesta-origen-destino-2024",
		}),
		fileResource({
			datasetName: SHOWCASE_NAME,
			title: SHOWCASE_TITLE,
			profile: "observatorio-transporte-publico",
			name: "Rutas y paradas del transporte público (GeoJSON)",
			description: "Líneas y paradas inventadas del transporte público, en el área de Cochabamba.",
			format: "GeoJSON",
			filename: "transporte-publico",
		}),
		fileResource({
			datasetName: SHOWCASE_NAME,
			title: SHOWCASE_TITLE,
			profile: "observatorio-accidentalidad-vial",
			name: "Accidentalidad vial (2019–2025)",
			description:
				"Muestra de accidentes de tránsito con tipo, gravedad, distrito y ubicación (latitud y longitud).",
			format: "CSV",
			filename: "accidentalidad-vial",
		}),
		fileResource({
			datasetName: SHOWCASE_NAME,
			title: SHOWCASE_TITLE,
			profile: "observatorio-informe-metodologico",
			name: "Informe metodológico y diccionario de datos",
			description:
				"Documento PDF de muestra con un diccionario de variables y criterios de calidad.",
			format: "PDF",
			filename: "informe-metodologico",
		}),
	],
};

// ── Datasets ficticios de la demo de gráficos (T6 y T7 de odd/tasks/csv-charts.md) ──
//
// Cada CSV lo genera un script de `scripts/` con semilla fija (mismas filas y mismo
// sha256 en cada corrida). A diferencia de los datasets base, se leen de `scripts/data` y el
// CSV pasa por xloader (el DataPusher sólo carga lo que tiene bytes). El archivo se sube **antes** de publicar, con el dataset privado: si la subida falla,
// el dataset no queda público y vacío (ver `seedDemoDataset`).
//
// Organización de cada uno, entre las que el seed ya crea: `rectorado` para la planilla, la
// matrícula y la ejecución presupuestaria. Son administración central, no datos de una
// facultad: ninguna es dueña de la nómina universitaria, de la matrícula de todas ni del
// presupuesto de todas las unidades, y fcyt/fcs/fca publican datos de sus disciplinas. La
// producción de investigación va a `direccion-investigacion`, que es lo que esa dirección
// coordina.
//
// `types` es el `TYPES` del generador: el seed lo declara como `type_override` (L36). Un
// recurso **sin `types`** no es tabular (el PDF): el seed no espera a xloader ni declara tipos.
export const DEMOS = [
	{
		owner_org_name: "rectorado",
		generator: "generate-demo-csv.mjs",
		types: PLANILLA_TYPES,
		dataset: {
			name: "planilla-docente-ficticia",
			title: "Planilla docente ficticia — Datos ficticios para demostración",
			notes:
				"Datos ficticios para demostración. Nómina docente inventada para probar las vistas de " +
				"gráficos: los nombres y apellidos son inventados y no corresponden a personas reales.\n\n" +
				"Columnas: `turno` (mañana, tarde, noche), `cargo`, `departamento`, `facultad`, `horas_mes`, " +
				"`bs_hora`, `salario` (siempre `horas_mes` × `bs_hora`) y `fecha_ingreso` (1995–2025). " +
				"`turno` y `fecha_ingreso` traen algunos vacíos a propósito, para ver el grupo sin dato.\n\n" +
				"Datos ficticios para demostración: no son datos oficiales de la UMSS.",
			license_id: "cc-by",
			author: "Equipo ODP (datos sintéticos)",
			maintainer: "Equipo ODP",
			tags: [
				{ name: "docentes" },
				{ name: "planilla" },
				{ name: "salarios" },
				{ name: "demostración" },
			],
		},
		resource: {
			name: "planilla-docente-ficticia.csv",
			description:
				"Datos ficticios para demostración: 2.500 filas de una planilla docente inventada, " +
				"pensadas para graficar.",
			format: "CSV",
			path: resolve(HERE, "data", "planilla-docente-ficticia.csv"),
		},
	},
	{
		owner_org_name: "rectorado",
		generator: "generate-matricula-csv.mjs",
		types: MATRICULA_TYPES,
		dataset: {
			name: "matricula-facultad-gestion-ficticia",
			title: "Matrícula por facultad y gestión ficticia — Datos ficticios para demostración",
			notes:
				"Datos ficticios para demostración. Matrícula inventada de carreras de ocho facultades, " +
				"gestiones 2015–2025, para probar las vistas de gráficos.\n\n" +
				"Columnas: `facultad`, `carrera`, `gestion` (año, número entero), `sexo`, `modalidad` " +
				"(presencial, semipresencial, virtual) e `inscritos`. `sexo` y `modalidad` traen algunos " +
				"vacíos a propósito, para ver el grupo sin dato.\n\n" +
				"Datos ficticios para demostración: no son datos oficiales de la UMSS.",
			license_id: "cc-by",
			author: "Equipo ODP (datos sintéticos)",
			maintainer: "Equipo ODP",
			tags: [
				{ name: "matrícula" },
				{ name: "estudiantes" },
				{ name: "facultades" },
				{ name: "demostración" },
			],
		},
		resource: {
			name: "matricula-facultad-gestion-ficticia.csv",
			description:
				"Datos ficticios para demostración: 1.568 filas de matrícula inventada por carrera, " +
				"gestión, sexo y modalidad, pensadas para graficar.",
			format: "CSV",
			path: resolve(HERE, "data", "matricula-facultad-gestion-ficticia.csv"),
		},
	},
	{
		owner_org_name: "rectorado",
		generator: "generate-presupuesto-csv.mjs",
		types: PRESUPUESTO_TYPES,
		dataset: {
			name: "ejecucion-presupuestaria-ficticia",
			title: "Ejecución presupuestaria mensual ficticia — Datos ficticios para demostración",
			notes:
				"Datos ficticios para demostración. Registros mensuales inventados de ejecución " +
				"presupuestaria de doce unidades, 2024–2025, para probar las vistas de gráficos.\n\n" +
				"Columnas: `unidad`, `partida`, `fecha_registro` (AAAA-MM-DD), `monto_programado` y " +
				"`monto_ejecutado` (bolivianos). `partida`, `fecha_registro` y `monto_ejecutado` traen " +
				"algunos vacíos a propósito, para ver el grupo sin dato.\n\n" +
				"Datos ficticios para demostración: no son datos oficiales de la UMSS.",
			license_id: "cc-by",
			author: "Equipo ODP (datos sintéticos)",
			maintainer: "Equipo ODP",
			tags: [
				{ name: "presupuesto" },
				{ name: "ejecución presupuestaria" },
				{ name: "finanzas" },
				{ name: "demostración" },
			],
		},
		resource: {
			name: "ejecucion-presupuestaria-ficticia.csv",
			description:
				"Datos ficticios para demostración: 1.329 registros de ejecución presupuestaria " +
				"inventados, pensados para graficar.",
			format: "CSV",
			path: resolve(HERE, "data", "ejecucion-presupuestaria-ficticia.csv"),
		},
	},
	{
		owner_org_name: "direccion-investigacion",
		generator: "generate-investigacion-csv.mjs",
		types: INVESTIGACION_TYPES,
		dataset: {
			name: "produccion-investigacion-ficticia",
			title: "Producción de investigación ficticia — Datos ficticios para demostración",
			notes:
				"Datos ficticios para demostración. Productos de investigación inventados (artículos, " +
				"libros, tesis, patentes) de doce departamentos, 2015–2025, para probar las vistas de " +
				"gráficos.\n\n" +
				"Columnas: `departamento`, `tipo_producto`, `anio` (número entero), " +
				"`fuente_financiamiento`, `proyecto_id` (un proyecto da varios productos) y `autores`. " +
				"`proyecto_id` y `fuente_financiamiento` traen algunos vacíos a propósito, para ver el " +
				"grupo sin dato.\n\n" +
				"Datos ficticios para demostración: no son datos oficiales de la UMSS.",
			license_id: "cc-by",
			author: "Equipo ODP (datos sintéticos)",
			maintainer: "Equipo ODP",
			tags: [
				{ name: "investigación" },
				{ name: "producción científica" },
				{ name: "publicaciones" },
				{ name: "demostración" },
			],
		},
		resource: {
			name: "produccion-investigacion-ficticia.csv",
			description:
				"Datos ficticios para demostración: 1.054 productos de investigación inventados, " +
				"pensados para graficar.",
			format: "CSV",
			path: resolve(HERE, "data", "produccion-investigacion-ficticia.csv"),
		},
	},
	{
		owner_org_name: "rectorado",
		generator: "generate-informe-pdf.mjs",
		dataset: {
			name: "informe-matricula-ficticio",
			title: "Informe de matrícula 2015–2025 ficticio — Datos ficticios para demostración",
			notes:
				"Datos ficticios para demostración. Informe inventado de tres páginas con la matrícula " +
				"de ocho facultades, gestiones 2015–2025, para probar la vista previa de documentos PDF " +
				"sin conexión a internet.\n\n" +
				"Contiene un cuadro por gestión, otro por facultad y otro por modalidad; sus cifras " +
				"resumen el dataset «Matrícula por facultad y gestión ficticia».\n\n" +
				"Datos ficticios para demostración: no son datos oficiales de la UMSS.",
			license_id: "cc-by",
			author: "Equipo ODP (datos sintéticos)",
			maintainer: "Equipo ODP",
			tags: [
				{ name: "matrícula" },
				{ name: "informes" },
				{ name: "documentos" },
				{ name: "demostración" },
			],
		},
		resource: {
			name: "informe-matricula-ficticio.pdf",
			description:
				"Datos ficticios para demostración: informe inventado de tres páginas sobre la " +
				"matrícula 2015–2025, pensado para la vista previa del PDF.",
			format: "PDF",
			mime: "application/pdf",
			path: resolve(HERE, "data", "informe-matricula-ficticio.pdf"),
		},
	},
];

// ── Tipos de columna con xloader (L36, L44) ──
//
// xloader carga todo como `text` salvo que el Data Dictionary declare `info.type_override`.
// Camino soportado: esperar la primera carga (texto), declarar los tipos con `datastore_create`
// `force`, recargar con `xloader_submit` (`ignore_hash`, porque el archivo no cambió) y esperar.
// Acciones y forma de la respuesta: `ckanext-xloader` 2.6.0, `action.py` (`xloader_status`
// devuelve `{status, job_id, error, ...}`; `status` es `submitting`, `pending`, `running`,
// `running_but_viewable`, `complete` o `error`).

const XLOADER_TIMEOUT_MS = Number(process.env.SEED_XLOADER_TIMEOUT_MS ?? 120_000);
const XLOADER_POLL_MS = 1_000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Espera a que xloader termine (`complete`) o falle (`error`). Devuelve `{ ok, detail }`.
// Un `NotFound` al principio es normal: el trabajo se encola de forma asíncrona tras la subida.
async function waitForXloader(token, resourceId, label) {
	const deadline = Date.now() + XLOADER_TIMEOUT_MS;
	let last = "sin tarea todavía";
	while (Date.now() < deadline) {
		const res = await api(token, "xloader_status", { resource_id: resourceId });
		if (res.success) {
			const { status, error } = res.result;
			last = status;
			if (status === "complete") return { ok: true, detail: status };
			if (status === "error") {
				return { ok: false, detail: `xloader terminó en error (${errorText(error)})` };
			}
		} else {
			last = `xloader_status: ${errorText(res.error)}`;
		}
		await sleep(XLOADER_POLL_MS);
	}
	return {
		ok: false,
		detail: `tiempo agotado (${XLOADER_TIMEOUT_MS / 1000} s) esperando a xloader en «${label}»; último estado: ${last}`,
	};
}

// Lee los tipos que informa el DataStore y los compara con los esperados. `limit: 0` trae los
// `fields` y el `total` sin filas. Devuelve `{ ok, problems }`.
async function checkTypes(token, resourceId, types, rowCount) {
	const res = await api(token, "datastore_search", { resource_id: resourceId, limit: 0 });
	if (!res.success) return { ok: false, problems: [`datastore_search: ${errorText(res.error)}`] };
	const reported = new Map(res.result.fields.map((field) => [field.id, field.type]));
	const problems = [];
	for (const [column, expected] of Object.entries(types)) {
		const actual = reported.get(column);
		if (actual !== expected)
			problems.push(`${column}: ${actual ?? "ausente"} (esperado ${expected})`);
	}
	if (res.result.total !== rowCount) {
		problems.push(`total: ${res.result.total} (esperado ${rowCount})`);
	}
	return { ok: problems.length === 0, problems };
}

// Deja la tabla del recurso con los tipos del generador. Nunca lanza: informa ✓/✗ y devuelve
// un booleano, para que un dataset fallido no aborte el seed. Idempotente: si la tabla ya
// tiene los tipos, no recarga nada.
async function ensureTyped(token, resourceId, demo, rowCount) {
	const name = demo.dataset.name;
	const fail = (why) => {
		console.error(`✗ tipos ${name}: ${why}`);
		return false;
	};

	console.log(`  Esperando la primera carga de xloader (${name})…`);
	const first = await waitForXloader(token, resourceId, name);
	if (!first.ok) return fail(first.detail);

	const before = await checkTypes(token, resourceId, demo.types, rowCount);
	if (before.ok) {
		console.log(`✓ tipos ${name}: ya declarados (${rowCount} filas)`);
		return true;
	}

	// Se parte de los campos que ya tiene la tabla (sin `_id`), con su `id` y su `type`,
	// y el `info` tal como lo escribe el formulario del Data Dictionary (`dictionary_form.html`:
	// `type_override`, `label` y `notes`).
	const current = await api(token, "datastore_search", { resource_id: resourceId, limit: 0 });
	if (!current.success) return fail(`datastore_search: ${errorText(current.error)}`);
	const fields = current.result.fields
		.filter((field) => !field.id.startsWith("_"))
		.map((field) => ({
			id: field.id,
			type: field.type,
			info: { type_override: demo.types[field.id] ?? "text", label: "", notes: "" },
		}));
	const create = await api(token, "datastore_create", {
		resource_id: resourceId,
		force: true,
		fields,
	});
	if (!create.success) return fail(`datastore_create: ${errorText(create.error)}`);

	const submit = await api(token, "xloader_submit", { resource_id: resourceId, ignore_hash: true });
	if (!submit.success) return fail(`xloader_submit: ${errorText(submit.error)}`);
	console.log(`  Tipos declarados; recargando con xloader (${name})…`);
	const second = await waitForXloader(token, resourceId, name);
	if (!second.ok) return fail(second.detail);

	const after = await checkTypes(token, resourceId, demo.types, rowCount);
	if (!after.ok) return fail(after.problems.join("; "));
	const numeric = Object.values(demo.types).filter((type) => type !== "text").length;
	console.log(`✓ tipos ${name}: ${numeric} columnas no texto verificadas, ${rowCount} filas`);
	return true;
}

// `multipart/form-data` es la única forma de que CKAN guarde el archivo: con JSON el
// campo `upload` no existe y el recurso queda url-only (sin archivo que mostrar ni cargar).
//
// El `mimetype` va explícito cuando el recurso lo declara: CKAN sólo lo adivina por la extensión, y
// `.geojson` no la conoce. Quedaba vacío, el archivo se servía como `application/octet-stream` y el
// iframe de la vista previa quedaba en blanco (demo, 2026-10-18). Con el campo, CKAN lo guarda
// (`update.py:339`) y lo usa como `Content-Type` al servir el archivo (`views/resource.py:202`).
export function uploadForm(packageId, resource, bytes) {
	const form = new FormData();
	form.set("package_id", packageId);
	form.set("name", resource.name);
	form.set("description", resource.description);
	form.set("format", resource.format);
	if (resource.mime) form.set("mimetype", resource.mime);
	// El nombre del archivo viaja en el `filename` del Blob; CKAN lo usa para `url_type: upload`.
	form.append(
		"upload",
		new Blob([bytes], { type: resource.mime ?? "text/csv" }),
		resource.filename ?? basename(resource.path),
	);
	return form;
}

async function uploadResource(token, packageId, resource, bytes) {
	const form = uploadForm(packageId, resource, bytes);

	const res = await fetch(`${CKAN_URL}/api/3/action/resource_create`, {
		method: "POST",
		// Sin `Content-Type` a mano: `fetch` pone el boundary del multipart.
		headers: { Authorization: token },
		body: form,
	});
	return readJson(res, "resource_create");
}

function leftPrivate(name, missing = "sus tipos") {
	console.error(`  ${name} queda privado: no se publica sin ${missing}. Corra el seed de nuevo.`);
}

async function seedDemoDataset(token, orgIdByName, demo) {
	const orgId = orgIdByName.get(demo.owner_org_name);
	if (!orgId) {
		console.error(
			`✗ ${demo.dataset.name}: organización ${demo.owner_org_name} no creada, se salta.`,
		);
		return { created: false, skipped: true };
	}

	let bytes;
	try {
		bytes = readFileSync(demo.resource.path);
	} catch {
		console.error(
			`✗ ${demo.dataset.name}: falta ${demo.resource.path}. Genérelo con \`node scripts/${demo.generator}\`.`,
		);
		return { created: false, skipped: true };
	}

	// Sólo los recursos tabulares (con `types`) tienen filas que verificar.
	const rowCount = demo.types ? parseCsv(bytes.toString("utf8")).length - 1 : null;

	// Idempotencia: el dataset se salta por `name`; el recurso, por `name` dentro de él.
	// Así una corrida que falló a mitad (dataset creado, subida no) se completa sin duplicar.
	const existing = await api(token, "package_show", { id: demo.dataset.name });
	// El dataset como lo devuelve CKAN (`id`, `state`): es lo que mira `publishDataset`.
	// Queda `null` mientras no exista.
	let pkg = existing.success ? existing.result : null;
	// ¿Falta publicar? Lo que ya está público no se pide de nuevo; lo que se crea acá sí,
	// porque nace privado.
	const needsPublication = pkg ? pkg.private === true : true;
	let created = false;

	if (pkg) {
		const uploaded = (pkg.resources ?? []).some((resource) => resource.name === demo.resource.name);
		if (uploaded) {
			console.log(`· dataset existente: ${demo.dataset.name} (recurso ya subido, se salta)`);
			// La corrida anterior pudo morir entre la subida y la aprobación: con el archivo
			// puesto, falta comprobar los tipos (no recarga si ya están; el PDF no los tiene) y
			// publicar. Lo ya público no se toca.
			if (needsPublication) {
				const resourceId = pkg.resources.find((r) => r.name === demo.resource.name).id;
				const typed = demo.types ? await ensureTyped(token, resourceId, demo, rowCount) : true;
				if (typed) await publishDataset(token, pkg);
				else leftPrivate(demo.dataset.name);
			}
			return { created: false, skipped: true };
		}
		console.log(`· dataset existente: ${demo.dataset.name} (le falta el recurso, se sube)`);
	} else {
		const result = await api(token, "package_create", {
			...demo.dataset,
			owner_org: orgId,
			// Nace **privado**: la pared rechaza nacer público, y publicarlo antes de subir el
			// archivo dejaría un dataset público y vacío si la subida fallara.
			private: true,
		});
		if (!result.success) {
			console.error(`✗ package_create ${demo.dataset.name}: ${JSON.stringify(result.error ?? {})}`);
			return { created: false, skipped: true };
		}
		pkg = result.result;
		created = true;
		console.log(`✓ dataset: ${demo.dataset.name} (privado)`);
	}

	const result = await uploadResource(token, pkg.id, demo.resource, bytes);
	if (!result.success) {
		console.error(`✗ resource_create ${demo.dataset.name}: ${JSON.stringify(result.error ?? {})}`);
		return { created, skipped: false };
	}

	const resource = result.result;
	console.log(
		`✓ recurso subido: ${resource.id} (${bytes.length} bytes, url_type=${resource.url_type ?? "?"})`,
	);
	// La subida va con el dataset **todavía privado**: el permiso para subir es de la
	// organización, no de la visibilidad, y así un fallo de la subida o de los tipos deja el
	// dataset privado —la corrida siguiente ve el archivo y sólo completa lo que falta— en vez
	// de un dataset público, vacío o sin tipos, que es lo que la demo no puede mostrar.
	const typed = demo.types ? await ensureTyped(token, resource.id, demo, rowCount) : true;
	if (!typed) leftPrivate(demo.dataset.name);
	else if (needsPublication) await publishDataset(token, pkg);
	return { created, skipped: false };
}

// ── Gráficos de la demo ──

const DATASTORE_TIMEOUT_MS = Number(process.env.SEED_DATASTORE_TIMEOUT_MS ?? 30_000);

// Espera a que el recurso tenga su tabla en el DataStore (`datastore_active`), que es lo que lee la acción
// de datos del gráfico. Devuelve `true` si la tabla existe antes de agotar el plazo.
async function waitForDatastore(token, resourceId) {
	const deadline = Date.now() + DATASTORE_TIMEOUT_MS;
	while (true) {
		const res = await api(token, "resource_show", { id: resourceId });
		if (res.success && res.result.datastore_active === true) return true;
		if (Date.now() >= deadline) return false;
		await sleep(XLOADER_POLL_MS);
	}
}

// Crea las vistas `umss_chart` que le faltan al recurso CSV de un dataset de `DEMOS`. Nunca lanza: informa
// ✓/✗ y sigue, para que un dataset sin tabla no aborte el seed. Corre aunque el dataset ya sea público.
async function seedDemoCharts(token, demo) {
	const name = demo.dataset.name;
	const desired = CHART_VIEWS[name] ?? [];
	if (!demo.types || desired.length === 0) return { created: 0, failed: 0 };
	const skip = (why) => {
		console.error(`✗ gráficos ${name}: ${why}`);
		return { created: 0, failed: desired.length };
	};

	const shown = await api(token, "package_show", { id: name });
	if (!shown.success) return skip("el dataset no existe, se salta.");
	const resource = (shown.result.resources ?? []).find((r) => r.name === demo.resource.name);
	if (!resource) return skip(`falta el recurso ${demo.resource.name}, se salta.`);

	if (!(await waitForDatastore(token, resource.id))) {
		return skip(
			`la tabla del DataStore no está lista (${DATASTORE_TIMEOUT_MS / 1000} s); corra el seed de nuevo.`,
		);
	}
	// Los tipos reales de la tabla, no los esperados: si los tipos no quedaron declarados, el gráfico
	// que suma o agrupa por fecha lo rechazaría el servidor, y acá se dice por qué.
	const table = await api(token, "datastore_search", { resource_id: resource.id, limit: 0 });
	if (!table.success) return skip(`datastore_search: ${errorText(table.error)}`);
	const types = Object.fromEntries(table.result.fields.map((field) => [field.id, field.type]));

	const listed = await api(token, "resource_view_list", { id: resource.id });
	if (!listed.success) return skip(`resource_view_list: ${errorText(listed.error)}`);
	const missing = viewsToCreate(desired, listed.result ?? []);
	for (const view of desired) {
		if (!missing.includes(view)) console.log(`· gráfico existente: ${name} → ${view.title}`);
	}

	let created = 0;
	let failed = 0;
	for (const view of missing) {
		const problems = Object.values(validateSeedConfig(view.config, types));
		if (problems.length > 0) {
			console.error(`✗ gráfico ${name} → ${view.title}: ${problems.join("; ")}`);
			failed++;
			continue;
		}
		const result = await api(token, "resource_view_create", chartViewPayload(resource.id, view));
		if (!result.success) {
			console.error(`✗ gráfico ${name} → ${view.title}: ${errorText(result.error)}`);
			failed++;
			continue;
		}
		console.log(`✓ gráfico ${name} → ${view.title} (${view.config.chart_type})`);
		created++;
	}
	return { created, failed };
}

// Siembra un dataset base o el `SHOWCASE`: todos sus recursos se suben como archivo.
//
// Nace **privado** y sin recursos; los archivos se suben antes de publicar, así que si una
// subida falla el dataset no queda público y vacío. Idempotente: lo que ya está público con
// todos sus recursos se salta; si existe y le falta un recurso (por nombre), se sube sólo ese; si
// sigue privado, se termina su publicación.
export async function seedFileDataset(token, orgIdByName, ds) {
	const owner = orgIdByName.get(ds.owner_org_name);
	if (!owner) {
		console.error(`✗ ${ds.name}: organización ${ds.owner_org_name} no creada, se salta.`);
		return { created: false, skipped: true };
	}

	const existing = await api(token, "package_show", { id: ds.name });
	let pkg = existing.success ? existing.result : null;
	let created = false;
	if (pkg) {
		console.log(`· dataset existente: ${ds.name}`);
	} else {
		// `private: true` porque la pared rechaza nacer público. El `state` no se manda: CKAN lo
		// crea `active`, que es lo que el flujo necesita para dejar el dataset legible.
		const { resources: _files, owner_org_name: _org, ...fields } = ds;
		const result = await api(token, "package_create", {
			...fields,
			owner_org: owner,
			private: true,
		});
		if (!result.success) {
			console.error(`✗ package_create ${ds.name}: ${JSON.stringify(result.error ?? {})}`);
			return { created: false, skipped: true };
		}
		pkg = result.result;
		created = true;
		console.log(`✓ dataset: ${ds.name} (privado)`);
	}

	// Un dataset recién creado aún no tiene recursos; uno existente puede tener sólo algunos.
	const present = new Set((pkg.resources ?? []).map((resource) => resource.name));
	let failed = false;
	let uploadedAny = false;
	for (const resource of ds.resources) {
		if (present.has(resource.name)) continue;
		const bytes = resource.bytes();
		const result = await uploadResource(token, pkg.id, resource, bytes);
		if (!result.success) {
			console.error(`✗ resource_create ${ds.name}: ${JSON.stringify(result.error ?? {})}`);
			failed = true;
			continue;
		}
		uploadedAny = true;
		console.log(
			`✓ recurso subido: ${result.result.id} (${resource.format}, ${bytes.length} bytes, url_type=${result.result.url_type ?? "?"})`,
		);
	}

	// Público ya está hecho; privado (recién creado o a mitad de camino en una corrida anterior)
	// se publica, salvo que una subida haya fallado: sin sus archivos no se publica.
	if (pkg.private === true) {
		if (failed) leftPrivate(ds.name, "sin todos sus archivos");
		else await publishDataset(token, pkg);
	}
	return { created, skipped: !created && !uploadedAny };
}

// ── Main ──

async function main() {
	console.log(`Seed CKAN → ${CKAN_URL}`);
	const { token, jar, csrf, jti, ownsToken } = await resolveCredentials();
	if (ownsToken) console.log("Login OK, token minteado.\n");

	try {
		const orgIdByName = new Map();
		for (const org of ORGS) {
			const existing = await api(token, "organization_show", { id: org.name });
			if (existing.success) {
				orgIdByName.set(org.name, existing.result.id);
				console.log(`· organización existente: ${org.name}`);
				continue;
			}
			const created = await api(token, "organization_create", org);
			if (!created.success) {
				console.error(`✗ organization_create ${org.name}: ${JSON.stringify(created.error ?? {})}`);
				continue;
			}
			orgIdByName.set(org.name, created.result.id);
			console.log(`✓ organización: ${org.name}`);
		}

		const all = [...buildBaseDatasets(), SHOWCASE, ...buildMoreDatasets()];
		let createdCount = 0;
		let skippedCount = 0;
		for (const ds of all) {
			const outcome = await seedFileDataset(token, orgIdByName, ds);
			if (outcome.created) createdCount++;
			if (outcome.skipped) skippedCount++;
		}

		for (const spec of DEMOS) {
			const outcome = await seedDemoDataset(token, orgIdByName, spec);
			if (outcome.created) createdCount++;
			if (outcome.skipped) skippedCount++;
		}

		// Gráficos: paso aparte, también para los datasets de la demo que ya existían y son públicos.
		let chartsCreated = 0;
		let chartsFailed = 0;
		for (const spec of DEMOS) {
			const outcome = await seedDemoCharts(token, spec);
			chartsCreated += outcome.created;
			chartsFailed += outcome.failed;
		}
		console.log(`\nGráficos: ${chartsCreated} creados, ${chartsFailed} con problemas.`);

		console.log(`\nListo. Creados ${createdCount} datasets, ${skippedCount} ya existían.`);
	} finally {
		// Revocar el token de seed (best-effort y **por `jti`**), sólo si lo minteó este
		// proceso. Con `CKAN_API_TOKEN` el token es del llamador: revocarlo sería robarle
		// la credencial, así que no se toca.
		//
		// Trampas medidas, las dos del mismo tipo: `api_token_revoke {token}` es un
		// **no-op silencioso** (CKAN intenta decodificar un JWT, el id no lo es, el
		// `jti` queda en `null` y devuelve `success: true` sin revocar nada); y con un
		// `jti` que no matchea ningún token también responde `success: true`. O sea que
		// **`success: true` no es evidencia de revocación**: acá sólo se informa lo que
		// devolvió la llamada, sin afirmar que el token ya no existe.
		if (!ownsToken) {
			console.log("Token propio (CKAN_API_TOKEN): no se revoca.");
		} else if (!jti) {
			console.log("Token de seed: sin `jti` no hay nada que revocar.");
		} else {
			try {
				const revoke = await fetch(`${CKAN_URL}/api/3/action/api_token_revoke`, {
					method: "POST",
					headers: sessionHeaders(jar.toString(), csrf),
					body: JSON.stringify({ jti }),
				});
				const payload = await revoke.json().catch(() => null);
				console.log(
					payload?.success
						? "Token de seed: la revocación por `jti` respondió OK (compruébelo listando; `success` no es evidencia)."
						: `Token de seed: la revocación falló (HTTP ${revoke.status}).`,
				);
			} catch {
				// best-effort: el token expira solo en 1 día.
			}
		}
	}
}

// Importar el módulo (los tests, el cuadro de recursos) no siembra nada.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
	main().catch((err) => {
		console.error("Seed abortado:", err.message);
		process.exit(1);
	});
}
