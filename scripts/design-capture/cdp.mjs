// Chromium headless controlado por CDP (Chrome DevTools Protocol), sin dependencias: el WebSocket global de
// Node habla con el puerto de depuración remota. Lo usan `capture.mjs` y `verify.mjs`.

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROMIUM = process.env.CHROMIUM ?? "/usr/bin/chromium";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Lanza Chromium headless con un perfil descartable y devuelve `{ browser, close }`. */
export async function launch() {
	const profile = await mkdtemp(join(tmpdir(), "design-capture-profile-"));
	const child = spawn(
		CHROMIUM,
		[
			"--headless=new",
			"--remote-debugging-port=0",
			`--user-data-dir=${profile}`,
			"--no-first-run",
			"--no-default-browser-check",
			"--disable-gpu",
			"--hide-scrollbars",
			"--font-render-hinting=none",
			"--force-color-profile=srgb",
			"about:blank",
		],
		{ stdio: ["ignore", "ignore", "pipe"] },
	);
	const wsUrl = await new Promise((resolve, reject) => {
		let buffer = "";
		const timer = setTimeout(
			() => reject(new Error("Chromium no abrió el puerto de depuración")),
			15000,
		);
		child.stderr.on("data", (chunk) => {
			buffer += chunk;
			const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
			if (match) {
				clearTimeout(timer);
				resolve(match[1]);
			}
		});
		child.on("exit", (code) => reject(new Error(`Chromium salió con código ${code}`)));
	});
	const browser = await connect(wsUrl);
	return {
		browser,
		async close() {
			browser.socket.close();
			child.kill("SIGTERM");
			await new Promise((resolve) => child.once("exit", resolve));
			// Los subprocesos de Chromium escriben en el perfil unos instantes después de salir el principal.
			await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(
				() => console.warn(`No se pudo borrar el perfil temporal ${profile}`),
			);
		},
	};
}

async function connect(wsUrl) {
	const socket = new WebSocket(wsUrl);
	await new Promise((resolve, reject) => {
		socket.addEventListener("open", resolve, { once: true });
		socket.addEventListener("error", reject, { once: true });
	});
	let nextId = 1;
	const pending = new Map();
	const listeners = new Set();
	socket.addEventListener("message", (event) => {
		const message = JSON.parse(event.data);
		if (message.id && pending.has(message.id)) {
			const { resolve, reject } = pending.get(message.id);
			pending.delete(message.id);
			if (message.error)
				reject(new Error(`${message.error.message} (${message.error.data ?? ""})`));
			else resolve(message.result);
		} else if (message.method) {
			for (const listener of listeners) listener(message);
		}
	});
	const send = (method, params = {}, sessionId) =>
		new Promise((resolve, reject) => {
			const id = nextId++;
			pending.set(id, { resolve, reject });
			socket.send(JSON.stringify({ id, method, params, sessionId }));
		});
	return { socket, send, listeners };
}

/** Abre una pestaña nueva y devuelve una sesión con `send(method, params)` y `on(method, fn)`. */
export async function openPage(browser) {
	const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
	const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
	const handlers = new Map();
	const listener = (message) => {
		if (message.sessionId !== sessionId) return;
		for (const fn of handlers.get(message.method) ?? []) fn(message.params);
	};
	browser.listeners.add(listener);
	const page = {
		send: (method, params) => browser.send(method, params, sessionId),
		on(method, fn) {
			if (!handlers.has(method)) handlers.set(method, []);
			handlers.get(method).push(fn);
		},
		async close() {
			browser.listeners.delete(listener);
			await browser.send("Target.closeTarget", { targetId });
		},
	};
	await page.send("Page.enable");
	await page.send("Runtime.enable");
	await page.send("Network.enable", { maxResourceBufferSize: 50e6, maxTotalBufferSize: 200e6 });
	return page;
}

/** Registra las peticiones de red de la pestaña: las que siguen en curso y todas las terminadas. */
export function trackNetwork(page) {
	const inflight = new Map();
	const finished = new Map();
	const requested = [];
	let lastActivity = Date.now();
	page.on("Network.requestWillBeSent", ({ requestId, request }) => {
		inflight.set(requestId, request.url);
		requested.push(request.url);
		lastActivity = Date.now();
	});
	page.on("Network.loadingFinished", ({ requestId }) => {
		const url = inflight.get(requestId);
		inflight.delete(requestId);
		if (url) finished.set(url, requestId);
		lastActivity = Date.now();
	});
	page.on("Network.loadingFailed", ({ requestId }) => {
		inflight.delete(requestId);
		lastActivity = Date.now();
	});
	return {
		requested,
		finished,
		/** Espera a que no haya peticiones en curso durante `quietMs` (las de HMR quedan abiertas: se ignoran). */
		async idle(quietMs = 1000, timeoutMs = 30000) {
			const start = Date.now();
			for (;;) {
				const open = [...inflight.values()].filter((url) => !/\/@vite\/|__vite_ping|hmr/.test(url));
				if (open.length === 0 && Date.now() - lastActivity >= quietMs) return;
				if (Date.now() - start > timeoutMs) throw new Error(`Red sin reposo: ${open.join(", ")}`);
				await sleep(100);
			}
		},
		/** Cuerpo de una respuesta ya descargada, como Buffer. */
		async body(url) {
			const requestId = finished.get(url);
			if (!requestId) return null;
			const { body, base64Encoded } = await page.send("Network.getResponseBody", { requestId });
			return Buffer.from(body, base64Encoded ? "base64" : "utf8");
		},
	};
}

/** Evalúa una expresión en la página y devuelve su valor (espera las promesas). */
export async function evaluate(page, expression) {
	const { result, exceptionDetails } = await page.send("Runtime.evaluate", {
		expression,
		awaitPromise: true,
		returnByValue: true,
	});
	if (exceptionDetails) {
		throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
	}
	return result.value;
}

/** Espera hasta que `expression` sea verdadera en la página. */
export async function waitFor(page, expression, timeoutMs = 30000) {
	const start = Date.now();
	for (;;) {
		if (await evaluate(page, `Boolean(${expression})`)) return;
		if (Date.now() - start > timeoutMs) throw new Error(`Tiempo agotado esperando: ${expression}`);
		await sleep(200);
	}
}

/** Carga `url` y espera el evento load. */
export async function navigate(page, url) {
	const loaded = new Promise((resolve) => page.on("Page.loadEventFired", resolve));
	await page.send("Page.navigate", { url });
	await loaded;
}

/** Fija el viewport en CSS px con factor de escala 1. */
export async function setViewport(page, width, height) {
	await page.send("Emulation.setDeviceMetricsOverride", {
		width,
		height,
		deviceScaleFactor: 1,
		mobile: false,
	});
}

/**
 * Captura PNG. Sin `clip`, el viewport actual; con `clip` ({ width, height }), la página entera desde el tope,
 * más allá del viewport y sin cambiar su alto (las unidades vh siguen midiendo la ventana).
 */
export async function screenshot(page, clip) {
	const { data } = await page.send(
		"Page.captureScreenshot",
		clip
			? { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, scale: 1, ...clip } }
			: { format: "png" },
	);
	return Buffer.from(data, "base64");
}

export { sleep };
