#!/usr/bin/env node
// Seed ligero de CKAN para desarrollo (odp).
//
// Puebla el CKAN de dev con contenido realista (organizaciones + datasets)
// espejado de src/lib/mock/data.ts, para que el portal muestre datos reales
// en lugar de listas vacías. Casi todos los recursos son enlaces (url-only); la
// excepción son los datasets ficticios de la demo (`DEMOS`: `planilla-docente-ficticia` y los
// tres de T7), que se **suben** como archivo para que el DataPusher lo cargue en el DataStore. Sin eso la
// demo de gráficos no tiene nada que graficar (L4 de odd/tasks/csv-charts.md, T6).
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
// Idempotente: si una organización ya existe (por `name`), se salta; si un dataset ya
// existe **y es público**, se salta sin pedir nada; si existe y sigue **privado** (una
// corrida anterior murió entre crear y aprobar), se reusa la solicitud pendiente o se pide
// una nueva, y se termina la publicación. Si a un dataset de la demo le falta el recurso, se
// sube sólo el recurso.
// No se guarda ninguna credencial en el repo: se leen del entorno en cada corrida.

import { readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
			headers: {
				"Content-Type": "application/json",
				"X-CSRFToken": csrf,
				Cookie: jar.toString(),
			},
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
			headers: {
				"Content-Type": "application/json",
				"X-CSRFToken": csrf,
				Cookie: jar.toString(),
			},
			body: JSON.stringify({ user: ADMIN_NAME, name: "odp-seed", ...TOKEN_TTL }),
		});
		if (mint.status === 400 && attempt === 0) {
			csrf = await csrfToken(jar);
			continue;
		}
		const payload = await mint.json();
		if (!payload.success || !payload.result?.token) {
			throw new Error(`api_token_create falló: ${JSON.stringify(payload.error ?? {})}`);
		}
		token = payload.result.token;
		jti = (await tokenIds()).find((id) => !idsBefore.has(id));
		break;
	}
	return { jar, csrf, token, jti };
}

async function api(token, action, data) {
	const res = await fetch(`${CKAN_URL}/api/3/action/${action}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: token },
		body: JSON.stringify(data),
	});
	return res.json();
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

const ORGS = [
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

function buildBaseDatasets() {
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
		const resources = Array.from({ length: resourceCount }, (_, ri) => ({
			name: `${title}${ri > 0 ? ` — parte ${ri + 1}` : ""}`,
			description: `Archivo de datos ${ri + 1} de ${resourceCount}`,
			format: FORMATS[(i + ri) % FORMATS.length],
			url: `https://data.umss.edu.bo/dataset/${name}/resource/${name}-${ri + 1}`,
			size: 10_000 + ((i * 7919 + ri * 104_729) % 5_000_000),
		}));

		datasets.push({
			name,
			title,
			owner_org_name: org.name,
			// `notes` es markdown (RF-39): texto plano con párrafos separados por línea en blanco.
			// No se escribe HTML acá a propósito — el render no interpreta HTML crudo.
			notes: `${DESCS[i]}\n\nDatos de la gestión 2025. Para consultas técnicas contactar a la unidad de transparencia de la ${org.title}.`,
			license_id: LICENSES[i % LICENSES.length],
			tags,
			resources,
		});
	}
	return datasets;
}

const SHOWCASE = {
	name: "observatorio-de-movilidad-urbana-cochabamba",
	title: "Observatorio de Movilidad Urbana — Cochabamba",
	owner_org_name: "fcyt",
	notes:
		"El Observatorio de Movilidad Urbana de Cochabamba recopila, procesa y publica datos abiertos sobre movilidad urbana en el área metropolitana de Kanata: flujos vehiculares, encuestas de origen-destino, transporte público y accidentalidad vial.\n\nLos datos cubren el período 2019–2025 y se actualizan trimestralmente.",
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
		{
			name: "Flujos vehiculares por punto de conteo (2019–2025)",
			description:
				"Serie temporal de flujos vehiculares horarios en los 47 puntos de conteo automatizados. Datos agregados por dirección, tipo de vehículo y día de la semana.",
			format: "CSV",
			size: 12_450_000,
			url: "https://data.umss.edu.bo/resource/flujos-vehiculares.csv",
		},
		{
			name: "Encuesta de origen-destino 2024",
			description:
				"Resultados de la encuesta de origen-destino realizada en el área metropolitana. Muestra: 8,500 hogares, cobertura geográfica: 12 distritos.",
			format: "XLSX",
			size: 3_800_000,
			url: "https://data.umss.edu.bo/resource/encuesta-origen-destino-2024.xlsx",
		},
		{
			name: "Rutas y paradas del transporte público (GeoJSON)",
			description:
				"Geometrías de líneas y paradas del sistema de transporte público metropolitano. Incluye 63 líneas, 1,240 paradas y 8 terminales.",
			format: "GeoJSON",
			size: 28_000_000,
			url: "https://data.umss.edu.bo/resource/transporte-publico.geojson",
		},
		{
			name: "Accidentalidad vial (2019–2025)",
			description:
				"Registro de accidentes de tránsito con clasificación por tipo, gravedad, horario y ubicación georreferenciada.",
			format: "CSV",
			size: 5_200_000,
			url: "https://data.umss.edu.bo/resource/accidentalidad-vial.csv",
		},
		{
			name: "Informe metodológico y diccionario de datos",
			description:
				"Documento PDF con la metodología de recolección, definición de variables, criterios de calidad y notas técnicas.",
			format: "PDF",
			size: 1_800_000,
			url: "https://data.umss.edu.bo/resource/informe-metodologico.pdf",
		},
	],
};

// ── Datasets ficticios de la demo de gráficos (T6 y T7 de odd/tasks/csv-charts.md) ──
//
// Cada CSV lo genera un script de `scripts/` con semilla fija (mismas filas y mismo
// sha256 en cada corrida). Son los **únicos** recursos del catálogo sembrado que se suben
// como archivo en vez de enlace, porque el DataPusher sólo carga lo que tiene bytes.
// El archivo se sube **antes** de publicar, con el dataset privado: si la subida falla,
// el dataset no queda público y vacío (ver `seedDemoDataset`).
//
// Organización de cada uno, entre las que el seed ya crea: `rectorado` para la planilla, la
// matrícula y la ejecución presupuestaria. Son administración central, no datos de una
// facultad: ninguna es dueña de la nómina universitaria, de la matrícula de todas ni del
// presupuesto de todas las unidades, y fcyt/fcs/fca publican datos de sus disciplinas. La
// producción de investigación va a `direccion-investigacion`, que es lo que esa dirección
// coordina.
//
// TODO(T7b): hoy el DataPusher tipa las columnas solo. Cuando el seed declare los tipos con
// xloader (L36), saldrán del `TYPES` de cada generador.
const DEMOS = [
	{
		owner_org_name: "rectorado",
		generator: "generate-demo-csv.mjs",
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
];

// `multipart/form-data` es la única forma de que CKAN guarde el archivo: con JSON el
// campo `upload` no existe, el recurso queda url-only y el DataPusher no tiene qué cargar.
async function uploadResource(token, packageId, resource, bytes) {
	const form = new FormData();
	form.set("package_id", packageId);
	form.set("name", resource.name);
	form.set("description", resource.description);
	form.set("format", resource.format);
	// El nombre del archivo viaja en el `filename` del Blob; CKAN lo usa para `url_type: upload`.
	form.append("upload", new Blob([bytes], { type: "text/csv" }), basename(resource.path));

	const res = await fetch(`${CKAN_URL}/api/3/action/resource_create`, {
		method: "POST",
		// Sin `Content-Type` a mano: `fetch` pone el boundary del multipart.
		headers: { Authorization: token },
		body: form,
	});
	return res.json();
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
			// puesto, lo único que falta es publicar.
			if (needsPublication) await publishDataset(token, pkg);
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
	// organización, no de la visibilidad, y así un fallo de la subida deja el dataset privado
	// —la corrida siguiente ve el archivo y sólo completa la publicación— en vez de un dataset
	// público y vacío, que es lo que la demo no puede mostrar.
	if (needsPublication) await publishDataset(token, pkg);
	// El seed **no espera** al DataPusher: encola la carga del CSV y sigue de largo.
	console.log(
		`  Carga pendiente en el DataStore (DataPusher). Para comprobarla: ` +
			`curl -s "${CKAN_URL}/api/3/action/resource_show?id=${resource.id}" | grep -o '"datastore_active": *[a-z]*'`,
	);
	return { created, skipped: false };
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

		const all = [...buildBaseDatasets(), SHOWCASE];
		let createdCount = 0;
		let skippedCount = 0;
		for (const ds of all) {
			const existing = await api(token, "package_show", { id: ds.name });
			if (existing.success) {
				skippedCount++;
				console.log(`· dataset existente: ${ds.name}`);
				// Público ya está hecho; privado quedó a mitad de camino en una corrida anterior,
				// así que se termina su publicación en vez de dejarlo invisible.
				if (existing.result.private === true) await publishDataset(token, existing.result);
				continue;
			}
			const owner = orgIdByName.get(ds.owner_org_name);
			if (!owner) {
				console.error(`✗ ${ds.name}: organización ${ds.owner_org_name} no creada, se salta.`);
				continue;
			}
			// `private: true` porque la pared rechaza nacer público. El `state` no se manda: CKAN
			// lo crea `active`, que es lo que el flujo necesita para dejar el dataset legible.
			const payload = { ...ds, owner_org: owner, private: true };
			delete payload.owner_org_name;
			const created = await api(token, "package_create", payload);
			if (!created.success) {
				console.error(`✗ package_create ${ds.name}: ${JSON.stringify(created.error ?? {})}`);
				continue;
			}
			createdCount++;
			console.log(`✓ dataset: ${ds.name} (privado)`);
			await publishDataset(token, created.result);
		}

		for (const spec of DEMOS) {
			const outcome = await seedDemoDataset(token, orgIdByName, spec);
			if (outcome.created) createdCount++;
			if (outcome.skipped) skippedCount++;
		}

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
					headers: {
						"Content-Type": "application/json",
						"X-CSRFToken": csrf,
						Cookie: jar.toString(),
					},
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

main().catch((err) => {
	console.error("Seed abortado:", err.message);
	process.exit(1);
});
