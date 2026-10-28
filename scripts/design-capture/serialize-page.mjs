// Lo que corre DENTRO de la página ya renderizada: congela el estado de los controles, clona el DOM, quita
// lo que no es producto (scripts, artefactos de Vite/Svelte, franjas de revisión DEV), reescribe los enlaces
// y recoge el CSS aplicado. Se inyecta como texto con `toString()`, así que no usa nada de afuera salvo
// `mapHref`/`urlKey`, que `capture.mjs` le pasa también como texto.
//
// Devuelve `{ html, css, imports, warnings }`: en `html`, el marcador `/*@@CSS@@*/` va dentro del único
// <style>; en `css`, el marcador `/*@@IMPORT:<n>@@*/` ocupa el lugar de cada hoja externa (`imports[n]`),
// que `capture.mjs` resuelve con lo que el navegador descargó.

export async function serializePage({ linkMap, removeSelectors }) {
	const warnings = [];
	const base = location.href;

	// 1. Congelar los controles en atributos, que es lo único que sobrevive al clonado.
	for (const select of document.querySelectorAll("select")) {
		for (const option of select.options) option.toggleAttribute("selected", option.selected);
	}
	for (const input of document.querySelectorAll("input")) {
		if (input.type === "checkbox" || input.type === "radio") {
			input.toggleAttribute("checked", input.checked);
		} else if (input.type !== "file" && input.type !== "password") {
			input.setAttribute("value", input.value);
		}
	}
	for (const textarea of document.querySelectorAll("textarea"))
		textarea.textContent = textarea.value;

	const toDataUrl = async (url) => {
		const response = await fetch(url, { credentials: "include" });
		if (!response.ok) throw new Error(`${response.status} ${url}`);
		const blob = await response.blob();
		return await new Promise((resolve) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.readAsDataURL(blob);
		});
	};

	// 2. Clonar y limpiar.
	const root = document.documentElement.cloneNode(true);
	const drop = [
		"script",
		"noscript",
		"link",
		"style",
		"base",
		"vite-error-overlay",
		"#svelte-announcer",
		...removeSelectors,
	];
	for (const node of root.querySelectorAll(drop.join(","))) node.remove();
	for (const meta of root.querySelectorAll("meta")) {
		if (!meta.hasAttribute("charset") && meta.getAttribute("name") !== "viewport") meta.remove();
	}
	const comments = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
	const toRemove = [];
	while (comments.nextNode()) toRemove.push(comments.currentNode);
	for (const comment of toRemove) comment.remove();

	for (const element of root.querySelectorAll("*")) {
		for (const { name } of [...element.attributes]) {
			if (
				name.startsWith("on") ||
				name.startsWith("data-sveltekit") ||
				name === "data-svelte-h" ||
				name === "data-vite-dev-id"
			) {
				element.removeAttribute(name);
			}
		}
	}

	// 3. Enlaces: al artboard hermano, al ancla de la misma página, o inertes.
	let inert = 0;
	for (const anchor of root.querySelectorAll("a[href], area[href]")) {
		const target = mapHref(anchor.getAttribute("href"), base, linkMap);
		if (target === null) {
			anchor.removeAttribute("href");
			anchor.removeAttribute("target");
			anchor.removeAttribute("rel");
			inert++;
		} else {
			anchor.setAttribute("href", target);
		}
	}
	for (const form of root.querySelectorAll("form")) form.removeAttribute("action");
	for (const button of root.querySelectorAll("[formaction]")) button.removeAttribute("formaction");

	// 4. Imágenes como data: URIs.
	for (const img of root.querySelectorAll("img")) {
		const src = img.getAttribute("src");
		img.removeAttribute("srcset");
		if (src && !src.startsWith("data:")) {
			img.setAttribute("src", await toDataUrl(new URL(src, base).href));
		}
	}
	for (const image of root.querySelectorAll("image[href], use[href]")) {
		const href = image.getAttribute("href");
		if (href && !href.startsWith("#") && !href.startsWith("data:")) {
			warnings.push(`SVG con referencia externa: ${href}`);
		}
	}

	// 5. El CSS aplicado, en orden, con los url() del mismo origen embebidos.
	const imports = [];
	const parts = [];
	const inlineUrls = async (text, sheetBase) => {
		const matches = [...text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)];
		let out = text;
		for (const [whole, , url] of matches) {
			if (url.startsWith("data:") || url.startsWith("#")) continue;
			const absolute = new URL(url, sheetBase).href;
			if (new URL(absolute).origin !== location.origin) {
				warnings.push(`url() externa sin embeber: ${absolute}`);
				continue;
			}
			out = out.replace(whole, `url("${await toDataUrl(absolute)}")`);
		}
		return out;
	};
	const collect = async (sheet) => {
		let rules;
		try {
			rules = sheet.cssRules;
		} catch {
			parts.push(`/*@@IMPORT:${imports.push(sheet.href) - 1}@@*/`);
			return;
		}
		for (const rule of rules) {
			if (rule instanceof CSSImportRule) {
				const href = new URL(rule.href, sheet.href ?? base).href;
				if (new URL(href).origin === location.origin && rule.styleSheet) {
					await collect(rule.styleSheet);
				} else {
					parts.push(`/*@@IMPORT:${imports.push(href) - 1}@@*/`);
				}
			} else {
				parts.push(await inlineUrls(rule.cssText, sheet.href ?? base));
			}
		}
	};
	for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets])
		await collect(sheet);

	const head = root.querySelector("head");
	const style = document.createElement("style");
	style.textContent = "/*@@CSS@@*/";
	head.append(style);
	for (const element of root.querySelectorAll("[style]")) {
		const value = element.getAttribute("style");
		if (/url\(/.test(value)) element.setAttribute("style", await inlineUrls(value, base));
	}

	return {
		html: `<!doctype html>\n${root.outerHTML}\n`,
		css: parts.join("\n"),
		imports,
		inertLinks: inert,
		warnings,
	};
}
