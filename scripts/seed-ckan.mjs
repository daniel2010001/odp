#!/usr/bin/env node
// Seed ligero de CKAN para desarrollo (odp).
//
// Puebla el CKAN de dev con contenido realista (organizaciones + datasets)
// espejado de src/lib/mock/data.ts, para que el portal muestre datos reales
// en lugar de listas vacías. No sube bytes: los recursos son enlaces (url-only).
//
// Uso:
//   CKAN_URL=http://localhost:5000 \
//   CKAN_SYSADMIN_NAME=ckan_admin \
//   CKAN_SYSADMIN_PASSWORD=... \
//   node scripts/seed-ckan.mjs
//
// Idempotente: si una organización o dataset ya existe (por `name`), lo salta.
// El token de seed se revoca al terminar (best-effort). No se guarda ninguna
// credencial en el repo: la contraseña se lee del entorno en cada corrida.

const CKAN_URL = (process.env.CKAN_URL ?? "http://localhost:5000").replace(/\/+$/, "");
const ADMIN_NAME = process.env.CKAN_SYSADMIN_NAME ?? "ckan_admin";
const ADMIN_PASSWORD = process.env.CKAN_SYSADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
	console.error("Falta CKAN_SYSADMIN_PASSWORD. Exportala antes de correr el seed.");
	process.exit(2);
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

	let csrf = await csrfToken(jar);
	let token;
	for (let attempt = 0; attempt < 2; attempt++) {
		const mint = await fetch(`${CKAN_URL}/api/3/action/api_token_create`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-CSRFToken": csrf,
				Cookie: jar.toString(),
			},
			body: JSON.stringify({ user: ADMIN_NAME, name: "odp-seed" }),
		});
		if (mint.status === 400 && attempt === 0) {
			csrf = await csrfToken(jar);
			continue;
		}
		const payload = await mint.json();
		if (!payload.success || !payload.result?.token) {
			throw new Error("api_token_create falló: " + JSON.stringify(payload.error ?? {}));
		}
		token = payload.result.token;
		break;
	}
	return { jar, csrf, token };
}

async function api(token, action, data) {
	const res = await fetch(`${CKAN_URL}/api/3/action/${action}`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Authorization: token },
		body: JSON.stringify(data),
	});
	return res.json();
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
			notes: `<p>${DESCS[i]}</p><p>Datos de la gestión 2025. Para consultas técnicas contactar a la unidad de transparencia de la ${org.title}.</p>`,
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
		"<p>El Observatorio de Movilidad Urbana de Cochabamba recopila, procesa y publica datos abiertos sobre movilidad urbana en el área metropolitana de Kanata: flujos vehiculares, encuestas de origen-destino, transporte público y accidentalidad vial.</p><p>Los datos cubren el período 2019–2025 y se actualizan trimestralmente.</p>",
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

// ── Main ──

async function main() {
	console.log(`Seed CKAN → ${CKAN_URL}`);
	const { jar, csrf, token } = await login();
	console.log("Login OK, token minteado.\n");

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
				continue;
			}
			const owner = orgIdByName.get(ds.owner_org_name);
			if (!owner) {
				console.error(`✗ ${ds.name}: organización ${ds.owner_org_name} no creada, se salta.`);
				continue;
			}
			const payload = { ...ds, owner_org: owner, private: false };
			delete payload.owner_org_name;
			const created = await api(token, "package_create", payload);
			if (!created.success) {
				console.error(`✗ package_create ${ds.name}: ${JSON.stringify(created.error ?? {})}`);
				continue;
			}
			createdCount++;
			console.log(`✓ dataset: ${ds.name}`);
		}

		console.log(`\nListo. Creados ${createdCount} datasets, ${skippedCount} ya existían.`);
	} finally {
		// Revocar el token de seed (best-effort).
		try {
			await fetch(`${CKAN_URL}/api/3/action/api_token_revoke`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-CSRFToken": csrf,
					Cookie: jar.toString(),
				},
				body: JSON.stringify({ token }),
			});
			console.log("Token de seed revocado.");
		} catch {
			// best-effort: el token expira solo en 24h.
		}
	}
}

main().catch((err) => {
	console.error("Seed abortado:", err.message);
	process.exit(1);
});
