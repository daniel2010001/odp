#!/usr/bin/env node
// Capturas de la demostración (https://demo.odp.hs.lan) para las diapositivas y el anexo.
//
//   node capture.mjs [--only-public] [--out <dir>] [--only <id,id>] [--base <url>]
//
// Chromium headless por el protocolo DevTools (CDP), sin dependencias: sólo `fetch` y `WebSocket` de Node.
// Las credenciales salen SÓLO de variables de entorno (nunca se escriben ni se imprimen):
//   DEMO_ADMIN_USER / DEMO_ADMIN_PASSWORD · DEMO_EDITOR_USER / DEMO_EDITOR_PASSWORD
// Las capturas con sesión no envían ningún formulario salvo el de inicio de sesión: no modifican datos.
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CHROMIUM = process.env.CHROME_PATH ?? "/usr/bin/chromium";
const VIEWPORT = { width: 1440, height: 900 };
const DPR = 2;
const PADDING = 16; // aire alrededor de una captura de foco, en px CSS
const MAX_COMPLETA = 1.5 * 1024 * 1024; // sobre este peso, una captura completa se repite a DPR 1

// ─── Lista de capturas ─────────────────────────────────────────────────
// id          nombre del archivo (<id>.png)
// path        ruta en el portal
// kind        "focus" (recortada a `focus`) o "full" (toda la página desplazable)
// focus       { selector } | { text, card: true }: el elemento (o la tarjeta que contiene ese rótulo)
// enteraEnVentana  (full) alarga la ventana hasta la altura de la página: para que los gráficos se dibujen
// pad         aire alrededor del recorte, en px CSS (por omisión 16)
// ready       texto o selector que debe existir antes de capturar (además de la red en reposo)
// actions     [{ click: "<texto>", in?: "<selector>" } | { clickSelector } | { scrollTo } | { wait: ms }]
// as          "admin" | "editor": captura con sesión (se omite con --only-public)
// demo        diapositiva a la que pertenece (documentación; no se usa para capturar)
const RECURSO_CSV =
	"/dataset/ejecucion-presupuestaria-ficticia/resource/c043afdc-c23e-4946-8327-fcb8abf93a13";
const PENDIENTE = "/dataset/uso-de-laboratorios-de-computacion-fcyt";

const SHOTS = [
	// Demo 1 · el catálogo
	{
		id: "d1-inicio",
		demo: 1,
		path: "/",
		kind: "focus",
		pad: 0,
		focus: { selector: "h1", up: "section" },
		ready: "Datos abiertos para la comunidad universitaria",
	},
	{
		id: "d1-busqueda",
		demo: 1,
		path: "/search?q=matr%C3%ADcula",
		kind: "focus",
		focus: { selector: "[data-results-column]", grow: ["aside", "[data-results-bar]"] },
		ready: "Explore los datasets",
	},
	{
		id: "d1-ficha-resumen",
		demo: 1,
		path: "/dataset/ejecucion-presupuestaria-ficticia",
		kind: "focus",
		focus: { selector: "#summary" },
		ready: "Sobre este dataset",
	},
	{ id: "d1-inicio-completa", demo: 1, path: "/", kind: "full", ready: "Datos por organización" },
	{
		id: "d1-ficha-completa",
		demo: 1,
		path: "/dataset/ejecucion-presupuestaria-ficticia",
		kind: "full",
		ready: "Ficha completa",
	},
	// Demo 2 · búsqueda con paginación
	{
		id: "d2-pagina-2",
		demo: 2,
		path: "/search?page=2",
		kind: "focus",
		focus: {
			selector: "nav[aria-label=Paginación]",
			grow: "[data-results] .space-y-4 > :last-child",
		},
		ready: "Explore los datasets",
	},
	{
		id: "d2-filtro-csv",
		demo: 2,
		path: "/search?format=CSV",
		kind: "focus",
		focus: {
			text: "Filtros activos:",
			parents: 1,
			grow: ["[data-results-bar]", "[data-results] .space-y-4 > :first-child"],
		},
		ready: "Explore los datasets",
	},
	{
		id: "d2-busqueda-completa",
		demo: 2,
		path: "/search?page=2",
		kind: "full",
		ready: "Explore los datasets",
	},
	// Demo 3 · vistas previas
	{
		id: "d3-tabla",
		demo: 3,
		path: RECURSO_CSV,
		kind: "focus",
		focus: { selector: "#preview" },
		ready: "Vista previa y gráficos del recurso",
	},
	{
		id: "d3-pdf",
		demo: 3,
		path: "/dataset/informe-matricula-ficticio/resource/3ae9b416-34d1-43ca-a2dc-5f37fb40dc05",
		kind: "focus",
		focus: { selector: "#preview" },
		ready: "#pdf",
		settle: 2500,
	},
	{
		id: "d3-imagen",
		demo: 3,
		path: "/dataset/estaciones-experimentales-y-superficie-cultivada/resource/00a06fc5-a15a-4f42-a6d2-78955922d8ac",
		kind: "focus",
		focus: { selector: "#preview" },
		ready: "#preview img",
		settle: 800,
	},
	{
		id: "d3-geojson",
		demo: 3,
		path: "/dataset/patentes-y-registros-de-propiedad-intelectual/resource/0fceed58-a582-42a2-bdbc-beedf7972e80",
		kind: "focus",
		focus: { selector: "#preview" },
		ready: "#preview",
	},
	{
		id: "d3-pdf-completa",
		demo: 3,
		path: "/dataset/informe-matricula-ficticio/resource/3ae9b416-34d1-43ca-a2dc-5f37fb40dc05",
		kind: "full",
		ready: "#pdf",
		settle: 2500,
	},
	// Demo 4 · gráficos
	{
		id: "d4-grafico-barras",
		demo: 4,
		path: RECURSO_CSV,
		kind: "focus",
		focus: { selector: "#preview" },
		ready: "Vista previa y gráficos del recurso",
		actions: [
			{ click: "Monto ejecutado por unidad", in: "[role=tab]" },
			{ waitChart: "#preview svg" },
		],
		settle: 2000,
	},
	{
		id: "d4-recurso-completa",
		demo: 4,
		enteraEnVentana: true,
		path: RECURSO_CSV,
		kind: "full",
		ready: "Vista previa y gráficos del recurso",
		actions: [
			{ click: "Monto ejecutado por unidad", in: "[role=tab]" },
			{ waitChart: "#preview svg" },
		],
		settle: 2000,
	},
	// Demo 5 · API y botones de copiar
	{
		id: "d5-api",
		demo: 5,
		path: RECURSO_CSV,
		kind: "focus",
		focus: { text: "Dirección de la API", card: true },
		ready: "Acceso por API",
	},
	// Demo 6 · iniciar sesión y crear un dataset
	{
		id: "d6-login",
		demo: 6,
		path: "/auth/login",
		kind: "focus",
		focus: { selector: "form", card: true },
		ready: "Iniciar Sesión",
	},
	{
		id: "d6-crear-recursos",
		demo: 6,
		as: "editor",
		path: "/dashboard/datasets/new",
		kind: "focus",
		focus: { text: "Recursos", card: true },
		ready: "Crear dataset",
	},
	{
		id: "d6-crear-completa",
		demo: 6,
		as: "editor",
		path: "/dashboard/datasets/new",
		kind: "full",
		ready: "Crear dataset",
	},
	// Demo 7 · solicitar la publicación
	{
		id: "d7-solicitud",
		demo: 7,
		as: "editor",
		path: PENDIENTE,
		kind: "focus",
		focus: { selector: "[data-testid=estado-solicitud]", card: true },
		ready: "Solicitud de publicación",
	},
	{
		id: "d7-ficha-completa",
		demo: 7,
		as: "editor",
		path: PENDIENTE,
		kind: "full",
		ready: "Solicitud de publicación",
	},
	// Demo 8 · decidir como administrador (sólo se captura: nunca se aprueba ni se rechaza)
	{
		id: "d8-cola",
		demo: 8,
		as: "admin",
		path: "/dashboard/requests",
		kind: "focus",
		focus: { selector: "[data-request-id]", up: "ul" },
		ready: "Decidir",
	},
	{
		id: "d8-decidir",
		demo: 8,
		as: "admin",
		path: PENDIENTE,
		kind: "focus",
		focus: { selector: "[data-testid=estado-solicitud]", card: true },
		ready: "Solicitud de publicación",
	},
	{
		id: "d8-cola-completa",
		demo: 8,
		as: "admin",
		path: "/dashboard/requests",
		kind: "full",
		ready: "Decidir",
	},
	// Demo 9 · verlo público
	{
		id: "d9-publico",
		demo: 9,
		path: "/dataset/calidad-del-agua-en-puntos-de-muestreo-del-valle",
		kind: "focus",
		focus: { selector: "h1", up: "header, section" },
		ready: "Sobre este dataset",
	},
	{
		id: "d9-publico-completa",
		demo: 9,
		path: "/dataset/calidad-del-agua-en-puntos-de-muestreo-del-valle",
		kind: "full",
		ready: "Sobre este dataset",
	},
];

// ─── Argumentos ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const valor = (n, def) => (args.includes(n) ? args[args.indexOf(n) + 1] : def);
const SOLO_PUBLICAS = flag("--only-public");
const SALIDA = resolve(valor("--out", join(AQUI, "..", "img")));
const BASE = valor("--base", "https://demo.odp.hs.lan").replace(/\/$/, "");
const SOLO = valor("--only", "")?.split(",").filter(Boolean) ?? [];

const USUARIOS = {
	admin: { user: process.env.DEMO_ADMIN_USER, password: process.env.DEMO_ADMIN_PASSWORD },
	editor: { user: process.env.DEMO_EDITOR_USER, password: process.env.DEMO_EDITOR_PASSWORD },
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── CDP ───────────────────────────────────────────────────────────────
async function puertoLibre() {
	return await new Promise((ok, mal) => {
		const s = createServer();
		s.listen(0, "127.0.0.1", () => {
			const { port } = s.address();
			s.close(() => ok(port));
		});
		s.on("error", mal);
	});
}

async function lanzar() {
	const puerto = await puertoLibre();
	const perfil = mkdtempSync(join(tmpdir(), "odp-captura-"));
	const sinSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];
	const proc = spawn(
		CHROMIUM,
		[
			"--headless=new",
			`--remote-debugging-port=${puerto}`,
			"--ignore-certificate-errors",
			"--hide-scrollbars",
			"--font-render-hinting=none",
			`--user-data-dir=${perfil}`,
			...sinSandbox,
			"about:blank",
		],
		{ stdio: "ignore" },
	);
	let version;
	for (let i = 0; i < 50 && !version; i++) {
		await dormir(300);
		version = await fetch(`http://127.0.0.1:${puerto}/json/version`)
			.then((r) => r.json())
			.catch(() => null);
	}
	if (!version) {
		proc.kill();
		throw new Error("Chromium no respondió por el puerto de depuración");
	}
	const ws = new WebSocket(version.webSocketDebuggerUrl);
	await new Promise((ok, mal) => {
		ws.onopen = ok;
		ws.onerror = mal;
	});
	let n = 0;
	const pend = new Map();
	const oyentes = [];
	ws.onmessage = (e) => {
		const m = JSON.parse(e.data);
		if (m.id && pend.has(m.id)) {
			const { ok, mal } = pend.get(m.id);
			pend.delete(m.id);
			m.error ? mal(new Error(`${m.error.message}`)) : ok(m.result);
		} else if (m.method) for (const o of oyentes) o(m);
	};
	const enviar = (method, params = {}, sessionId) =>
		new Promise((ok, mal) => {
			const id = ++n;
			pend.set(id, { ok, mal });
			ws.send(JSON.stringify({ id, method, params, sessionId }));
		});
	const cerrar = () => {
		try {
			ws.close();
		} catch {}
		proc.kill();
		try {
			rmSync(perfil, { recursive: true, force: true });
		} catch {}
	};
	return { enviar, oyentes, cerrar };
}

/** Una pestaña en un contexto aislado (cookies propias): una por usuario. */
async function abrirPagina(cdp) {
	const { browserContextId } = await cdp.enviar("Target.createBrowserContext");
	const { targetId } = await cdp.enviar("Target.createTarget", {
		url: "about:blank",
		browserContextId,
	});
	const { sessionId } = await cdp.enviar("Target.attachToTarget", { targetId, flatten: true });
	const s = (m, p) => cdp.enviar(m, p, sessionId);
	await s("Page.enable");
	await s("Network.enable");
	await s("Runtime.enable");
	await s("Emulation.setDeviceMetricsOverride", {
		...VIEWPORT,
		deviceScaleFactor: DPR,
		mobile: false,
	});
	await s("Emulation.setEmulatedMedia", {
		features: [
			{ name: "prefers-reduced-motion", value: "reduce" },
			{ name: "prefers-color-scheme", value: "light" },
		],
	});
	// Red en reposo: sin peticiones abiertas durante 600 ms. WebSocket y EventSource no cuentan.
	const abiertas = new Set();
	let ultimo = Date.now();
	cdp.oyentes.push((m) => {
		if (m.sessionId !== sessionId) return;
		const id = m.params?.requestId;
		if (m.method === "Network.requestWillBeSent") {
			abiertas.add(id);
			ultimo = Date.now();
		}
		if (["Network.loadingFinished", "Network.loadingFailed"].includes(m.method)) {
			abiertas.delete(id);
			ultimo = Date.now();
		}
	});
	const evaluar = async (expresion) => {
		const r = await s("Runtime.evaluate", {
			expression: expresion,
			returnByValue: true,
			awaitPromise: true,
		});
		if (r.exceptionDetails)
			throw new Error(r.exceptionDetails.exception?.description ?? "error de evaluación");
		return r.result.value;
	};
	const esperar = async (cond, etiqueta, ms = 30000) => {
		const fin = Date.now() + ms;
		while (Date.now() < fin) {
			if (await evaluar(cond).catch(() => false)) return;
			await dormir(150);
		}
		throw new Error(`tiempo agotado esperando ${etiqueta}`);
	};
	const redEnReposo = async (ms = 6000) => {
		const fin = Date.now() + ms;
		while (Date.now() < fin) {
			if (abiertas.size === 0 && Date.now() - ultimo > 600) return;
			await dormir(100);
		}
	};
	return {
		s,
		evaluar,
		esperar,
		redEnReposo,
		cerrar: () => cdp.enviar("Target.closeTarget", { targetId }),
	};
}

// ─── Acciones sobre la página ──────────────────────────────────────────
const lit = (x) => JSON.stringify(x);

/** Centro de un elemento (en px CSS de la ventana) tras traerlo a la vista. */
async function centroDe(p, expresionElemento) {
	return await p.evaluar(`(() => {
		const el = ${expresionElemento};
		if (!el) return null;
		el.scrollIntoView({ block: "center" });
		const r = el.getBoundingClientRect();
		return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
	})()`);
}

async function clicEn(p, punto) {
	if (!punto) throw new Error("elemento no encontrado para el clic");
	const base = { x: punto.x, y: punto.y, button: "left", clickCount: 1 };
	await p.s("Input.dispatchMouseEvent", { type: "mouseMoved", x: punto.x, y: punto.y });
	await p.s("Input.dispatchMouseEvent", { type: "mousePressed", ...base });
	await p.s("Input.dispatchMouseEvent", { type: "mouseReleased", ...base });
}

async function accion(p, a) {
	if (a.click) {
		const sel = a.in ?? "button, a, [role=tab]";
		await clicEn(
			p,
			await centroDe(
				p,
				`[...document.querySelectorAll(${lit(sel)})].find((e) => e.textContent.trim().includes(${lit(a.click)}))`,
			),
		);
	} else if (a.clickSelector) {
		await clicEn(p, await centroDe(p, `document.querySelector(${lit(a.clickSelector)})`));
	} else if (a.scrollTo) {
		await p.evaluar(
			`document.querySelector(${lit(a.scrollTo)})?.scrollIntoView({ block: "start" })`,
		);
	} else if (a.waitFor) {
		await p.esperar(`!!document.querySelector(${lit(a.waitFor)})`, a.waitFor);
	} else if (a.waitChart) {
		// el gráfico dibujado: un <svg> grande dentro del panel (los íconos miden 16 px)
		await p.esperar(
			`[...document.querySelectorAll(${lit(a.waitChart)})].some((e) => e.getBoundingClientRect().width > 300)`,
			"el gráfico",
		);
	} else if (a.wait) {
		await dormir(a.wait);
	}
	await p.redEnReposo();
}

/** Aparece cuando existe el selector (si empieza por # . [ ) o el texto. */
function condicionDeListo(ready) {
	return /^[#.[]/.test(ready)
		? `!!document.querySelector(${lit(ready)})`
		: `document.body.innerText.includes(${lit(ready)})`;
}

// ─── Sesión ────────────────────────────────────────────────────────────
async function iniciarSesion(p, rol) {
	const { user, password } = USUARIOS[rol];
	await p.s("Page.navigate", { url: `${BASE}/auth/login` });
	await p.esperar(`!!document.querySelector("#username")`, "el formulario de ingreso");
	await p.redEnReposo();
	await clicEn(p, await centroDe(p, `document.querySelector("#username")`));
	await p.s("Input.insertText", { text: user });
	await clicEn(p, await centroDe(p, `document.querySelector("input[name=password]")`));
	await p.s("Input.insertText", { text: password });
	await clicEn(p, await centroDe(p, `document.querySelector("form button[type=submit]")`));
	await p.esperar(
		`!location.pathname.startsWith("/auth/login")`,
		"la redirección tras el ingreso",
		20000,
	);
	await p.redEnReposo();
}

// ─── Captura ───────────────────────────────────────────────────────────
async function rectDeFoco(p, f) {
	return await p.evaluar(`(() => {
		const f = ${lit(f)};
		let el;
		if (f.text) {
			const c = [...document.querySelectorAll("h1,h2,h3,h4,p,span,legend")].find((e) => e.textContent.trim() === f.text);
			el = c;
		} else el = document.querySelector(f.selector);
		if (!el) return null;
		if (f.card) el = el.closest(".rounded-xl.border") ?? el;
		if (f.up) el = el.closest(f.up) ?? el;
		for (let i = 0; i < (f.parents ?? 0); i++) el = el.parentElement ?? el;
		let r = el.getBoundingClientRect();
		let x1 = r.left, y1 = r.top, x2 = r.right, y2 = r.bottom;
		for (const sel of [f.grow ?? []].flat()) {
			const g = document.querySelector(sel);
			if (g) { const q = g.getBoundingClientRect(); x1 = Math.min(x1, q.left); y1 = Math.min(y1, q.top); x2 = Math.max(x2, q.right); y2 = Math.max(y2, q.bottom); }
		}
		return { x: x1 + scrollX, y: y1 + scrollY, width: x2 - x1, height: y2 - y1 };
	})()`);
}

let dprActual = DPR;
async function png(p, clip, dpr, enVentana = false) {
	// Cambiar la métrica fuerza un reflujo (los gráficos se redibujan): sólo si hace falta.
	if (dpr !== dprActual) {
		await p.s("Emulation.setDeviceMetricsOverride", {
			...VIEWPORT,
			deviceScaleFactor: dpr,
			mobile: false,
		});
		dprActual = dpr;
		await dormir(1500);
	}
	const r = await p.s("Page.captureScreenshot", {
		format: "png",
		captureBeyondViewport: !enVentana,
		clip: { ...clip, scale: 1 },
	});
	return Buffer.from(r.data, "base64");
}

async function capturar(p, shot) {
	await p.s("Page.navigate", { url: BASE + shot.path });
	await p.esperar(condicionDeListo(shot.ready), `«${shot.ready}»`);
	await p.redEnReposo();
	await p.evaluar("document.fonts.ready.then(() => true)");
	// Recorrer la página una vez para que se carguen imágenes diferidas, y volver arriba.
	await p.evaluar(
		`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); })()`,
	);
	await p.redEnReposo();
	for (const a of shot.actions ?? []) await accion(p, a);
	await dormir(shot.settle ?? 600);
	const archivo = join(SALIDA, `${shot.id}.png`);
	let dpr = DPR;
	if (dprActual !== DPR) {
		await p.s("Emulation.setDeviceMetricsOverride", {
			...VIEWPORT,
			deviceScaleFactor: DPR,
			mobile: false,
		});
		dprActual = DPR;
	}
	let datos;
	if (shot.kind === "full") {
		await p.evaluar("scrollTo(0, 0)");
		const h = await p.evaluar("Math.ceil(document.documentElement.scrollHeight)");
		const clip = { x: 0, y: 0, width: VIEWPORT.width, height: h };
		if (shot.enteraEnVentana) {
			// Los gráficos sólo se dibujan dentro de la ventana: se alarga la ventana hasta la altura de la página.
			await p.s("Emulation.setDeviceMetricsOverride", {
				width: VIEWPORT.width,
				height: h,
				deviceScaleFactor: DPR,
				mobile: false,
			});
			await dormir(2500);
			datos = await png(p, clip, DPR, true);
			await p.s("Emulation.setDeviceMetricsOverride", {
				...VIEWPORT,
				deviceScaleFactor: DPR,
				mobile: false,
			});
		} else datos = await png(p, clip, DPR);
		if (datos.length > MAX_COMPLETA) {
			dpr = 1;
			datos = await png(p, clip, 1, !!shot.enteraEnVentana);
		}
	} else {
		await p.evaluar("scrollTo(0, 0)");
		let r = await rectDeFoco(p, shot.focus);
		if (!r) throw new Error("no se encontró el elemento de foco");
		const pad = shot.pad ?? PADDING;
		// Si cabe en la ventana, se lleva a la vista bajo el encabezado fijo: los gráficos sólo se dibujan
		// dentro de la ventana, y así el recorte sale de lo que el navegador pinta de verdad.
		const BAJO_ENCABEZADO = 90;
		const cabe = r.height + 2 * pad <= VIEWPORT.height - BAJO_ENCABEZADO;
		if (cabe) {
			await p.evaluar(`scrollTo(0, ${Math.max(0, Math.floor(r.y - BAJO_ENCABEZADO))})`);
			await dormir(1200);
			r = await rectDeFoco(p, shot.focus);
		}
		const x = Math.max(0, r.x - pad);
		const y = Math.max(0, r.y - pad);
		const clip = {
			x,
			y,
			width: Math.min(VIEWPORT.width - x, r.width + 2 * pad),
			height: r.height + 2 * pad,
		};
		datos = await png(p, clip, DPR, cabe);
	}
	writeFileSync(archivo, datos);
	return { archivo, bytes: statSync(archivo).size, dpr };
}

// ─── Principal ─────────────────────────────────────────────────────────
mkdirSync(SALIDA, { recursive: true });
const lista = SHOTS.filter((s) => (SOLO.length ? SOLO.includes(s.id) : true));
const publicas = lista.filter((s) => !s.as);
const conSesion = SOLO_PUBLICAS ? [] : lista.filter((s) => s.as);
const omitidas = SOLO_PUBLICAS ? lista.filter((s) => s.as) : [];

const cdp = await lanzar();
const fallos = [];
const hechas = [];
const kb = (n) => `${Math.round(n / 1024)} KB`;
try {
	const grupos = [{ rol: null, shots: publicas }];
	for (const rol of ["editor", "admin"])
		grupos.push({ rol, shots: conSesion.filter((s) => s.as === rol) });
	for (const { rol, shots } of grupos) {
		if (!shots.length) continue;
		if (rol && !(USUARIOS[rol].user && USUARIOS[rol].password)) {
			const v = rol.toUpperCase();
			console.error(
				`✗ faltan DEMO_${v}_USER / DEMO_${v}_PASSWORD: se omiten ${shots.map((s) => s.id).join(", ")}`,
			);
			for (const s of shots) fallos.push(s.id);
			continue;
		}
		const p = await abrirPagina(cdp);
		try {
			if (rol) await iniciarSesion(p, rol);
			for (const shot of shots) {
				try {
					const r = await capturar(p, shot);
					hechas.push(shot.id);
					console.log(`✓ ${shot.id}  ${kb(r.bytes)}  dpr ${r.dpr}`);
				} catch (e) {
					fallos.push(shot.id);
					console.error(`✗ ${shot.id}: ${e.message}`);
				}
			}
		} catch (e) {
			console.error(`✗ ${rol ?? "público"}: ${e.message}`);
			for (const s of shots)
				if (!hechas.includes(s.id) && !fallos.includes(s.id)) fallos.push(s.id);
		} finally {
			await p.cerrar().catch(() => {});
		}
	}
} finally {
	cdp.cerrar();
}
if (omitidas.length)
	console.log(`· con sesión (omitidas por --only-public): ${omitidas.map((s) => s.id).join(", ")}`);
console.log(
	`${hechas.length} capturas en ${SALIDA}${fallos.length ? `; fallaron: ${fallos.join(", ")}` : ""}`,
);
process.exit(fallos.length ? 1 : 0);
