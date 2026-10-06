// Auditoría de idioma de implementación del copy visible.
//
// ─── Qué protege ─────────────────────────────────────────────────────
// La regla del sistema de diseño (`design-system/datos-umss/README.md` §10 «Idioma y tono del copy»)
// dice que el copy visible no nombra la implementación. Este test es el ancla más barata de esa
// regla: mira texto literal de los archivos listados —cadenas y nodos de texto de markup— y se pone
// rojo cuando reaparece un nombre de tecnología, un servicio interno o una etiqueta de campo cruda.
//
// ─── Qué NO puede ver (límites declarados) ───────────────────────────
// No prueba que «ningún nombre interno llegue nunca a la pantalla». Sólo ve:
//   · literales en `src/lib/copy/**` y `src/lib/schemas/**`, y en los archivos tocados por el pase
//     de copy (lista `ARCHIVOS_TOCADOS`);
//   · texto entre `>` y `<` de esos mismos archivos.
// NO ve:
//   · cadenas compuestas en tiempo de ejecución (p.ej. un `err.message` del servidor, o una clave
//     que cae en un `?? key`): eso no está en el fuente como literal;
//   · texto en atributos no capturados, ni nombres de campo que se renderizan como identificadores
//     desde datos;
//   · etiquetas en inglés que no son nombres de implementación (`Dashboard`, `Breadcrumb`): esas
//     pertenecen a la regla de idioma, no a esta lista.
// Los comentarios se recortan antes de mirar: el repo argumenta sobre CKAN/Datastore en sus propios
// comentarios, y eso es legítimo. Cada excepción viva va en `EXCEPCIONES`, con su motivo.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");

/** Archivos que el pase de copy tocó y que el escáner debe mirar además de `copy`/`schemas`. */
const ARCHIVOS_TOCADOS = [
	"src/routes/+layout.svelte",
	"src/routes/about/+page.svelte",
	"src/routes/auth/login/+page.svelte",
	"src/routes/dataset/[id]/+page.svelte",
	"src/routes/dataset/[id]/resource/[resourceId]/+page.svelte",
	"src/routes/dashboard/+page.svelte",
	"src/routes/dashboard/datasets/new/+page.svelte",
	"src/routes/dashboard/datasets/[id]/edit/+page.svelte",
	"src/lib/components/auth/UserMenu.svelte",
	"src/lib/components/datasets/DatasetForm.svelte",
	"src/lib/components/ui/breadcrumb/Breadcrumb.svelte",
];

/**
 * Cada excepción permite una cadena concreta dentro de un archivo, con su motivo escrito. La
 * excepción sólo aplica si el fragmento contiene el `fragmento` declarado, así que no abre la puerta
 * a cualquier aparición de la palabra en el archivo.
 */
const EXCEPCIONES: { archivo: string; fragmento: string; motivo: string }[] = [
	{
		archivo: "src/routes/about/+page.svelte",
		fragmento: "CKAN",
		motivo:
			"«Acerca de» declara la tecnología como respaldo de credibilidad de la plataforma. Decisión del autor pendiente (flagged en el pase de copy): si se mantiene, ésta es la única excepción visible del portal.",
	},
	{
		archivo: "src/routes/about/+page.svelte",
		fragmento: "SvelteKit",
		motivo: "Misma decisión pendiente que el CKAN de «Acerca de».",
	},
	{
		archivo: "src/routes/dataset/[id]/resource/[resourceId]/+page.svelte",
		fragmento: "$lib/api/datastore",
		motivo: "Ruta de módulo de un `import`, no copy visible.",
	},
	{
		archivo: "src/routes/dashboard/datasets/new/+page.svelte",
		fragmento: "slug «",
		motivo:
			"La oración del nombre ya tomado la fija `wizard.test.ts` con el término `slug`, y el commit de copy dejó ese término como decisión pendiente del autor. La entrada del denylist ahora sí lo marca; la excepción queda explícita para que reescribirla sea una decisión, no un hueco silencioso.",
	},
	{
		archivo: "src/lib/components/datasets/DatasetForm.svelte",
		fragmento: "El slug identifica",
		motivo:
			"La etiqueta y la ayuda del campo usan el término que el autor eligió para el valor, decisión pendiente registrada en el commit de copy; `DatasetForm.svelte` queda fuera de las superficies de este cambio.",
	},
	{
		archivo: "src/lib/schemas/dataset.ts",
		fragmento: "El slug debe tener al menos 2 caracteres",
		motivo:
			"El mensaje de validación del nombre usa el mismo término; `src/lib/schemas/dataset.ts` queda fuera de las superficies de este cambio. La excepción es explícita y revisable, no un hueco: el escáner de regexs destapó este string al arreglar el escáner de literales.",
	},
];

/** Los nombres que no deben aparecer en el copy visible, con la etiqueta del hallazgo. */
const PROHIBIDOS: { token: string; re: RegExp }[] = [
	{ token: "CKAN", re: /\bCKAN\b/ },
	{ token: "SvelteKit", re: /\bSvelteKit\b/ },
	{ token: "DataStore", re: /\bDataStore\b/ },
	{ token: "datastore", re: /\bdatastore\b/ },
	{ token: "package_revise", re: /\bpackage_revise\b/ },
	{ token: "package_patch", re: /\bpackage_patch\b/ },
	{ token: "ckanext", re: /\bckanext\b/i },
	{ token: "headless", re: /\bheadless\b/i },
	{ token: "endpoint", re: /\bendpoints?\b/i },
	{ token: "ID:", re: /\bID:/ },
	// El término crudo `slug` se persigue en las dos formas en que llegaba a la pantalla: la etiqueta
	// con dos puntos (`Slug:`) y la palabra dentro de una oración (`Elija otro slug e intente...`).
	// No se marca un identificador de código (`id: "slug"`, `slug-hint`): la alternativa exige el
	// término precedido de un espacio y no seguido de guion o letra, porque el escáner también ve
	// los strings del script.
	{ token: "slug", re: /\bslugs?:|\sslug(?![\w-])/i },
];

type Violacion = { archivo: string; token: string; fragmento: string };

/**
 * Recorta `<!-- -->`, `/* *\/` y `//`. Los literales de regex del repo (p.ej. el patrón de email en
 * `schemas/dataset.ts`) contienen comillas y llaves, así que un escáner carácter a carácter que
 * siguiera las cadenas se confundiría; recortar por forma es más robusto acá. El guardia `[^:]`
 * evita comerse el `//` de un `https://`.
 */
function recortarComentarios(fuente: string): string {
	return fuente
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * Saca los literales de regex (`/…/flags`). Un literal de regex **no es copy**, pero puede contener
 * comillas o backticks (el patrón de email de `schemas/dataset.ts` trae los dos) y desalinear al
 * escáner de cadenas: medido, una racha de strings de ese archivo quedaba dentro de un falso
 * template y `quitarLlaves` la borraba, así que un mensaje visible como «El slug debe tener al menos
 * 2 caracteres» no se veía. El lookbehind exige un contexto donde JS sólo admite un literal
 * (tras `=`, `(`, `,`, `:`, `[`, `{`, `;`, …), que es donde el repo los escribe.
 */
function recortarLiteralesRegex(fuente: string): string {
	return fuente.replace(
		/(?<=[(,=:[!&|?{};]\s*)\/(?![/*])(?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+\/[a-z]*/g,
		"(regex)",
	);
}

/** Saca las expresiones `{...}` (incluye `{#if}`, `{/if}` y `${...}`). */
function quitarLlaves(texto: string): string {
	let salida = "";
	let i = 0;
	const n = texto.length;
	while (i < n) {
		if (texto[i] === "{") {
			let profundidad = 0;
			while (i < n) {
				const c = texto[i];
				if (c === '"' || c === "'" || c === "`") {
					const comilla = c;
					i++;
					while (i < n) {
						if (texto[i] === "\\") {
							i += 2;
							continue;
						}
						if (texto[i] === comilla) {
							i++;
							break;
						}
						i++;
					}
					continue;
				}
				if (c === "{") profundidad++;
				else if (c === "}") {
					profundidad--;
					if (profundidad === 0) {
						i++;
						break;
					}
				}
				i++;
			}
			continue;
		}
		salida += texto[i];
		i++;
	}
	return salida;
}

/** Junta los fragmentos de copy literal: cadenas y nodos de texto de markup. */
function fragmentosDe(fuente: string): string[] {
	const sinComentarios = recortarLiteralesRegex(recortarComentarios(fuente));
	const fragmentos: string[] = [];
	const cadenas = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
	for (const m of sinComentarios.matchAll(cadenas)) {
		fragmentos.push(quitarLlaves(m[1] ?? m[2] ?? m[3] ?? ""));
	}
	const markup = sinComentarios
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "");
	for (const m of quitarLlaves(markup).matchAll(/>([^<>]*)</g)) {
		const texto = (m[1] ?? "").trim();
		if (texto) fragmentos.push(texto);
	}
	return fragmentos;
}

/** Hallazgos de implementación en un archivo, ya aplicada la lista de excepciones. */
function auditar(archivo: string, fuente: string): Violacion[] {
	const violaciones: Violacion[] = [];
	for (const fragmento of fragmentosDe(fuente)) {
		for (const { token, re } of PROHIBIDOS) {
			if (!re.test(fragmento)) continue;
			const permitido = EXCEPCIONES.some(
				(e) => e.archivo === archivo && fragmento.includes(e.fragmento),
			);
			if (!permitido) violaciones.push({ archivo, token, fragmento: fragmento.slice(0, 200) });
		}
	}
	return violaciones;
}

function objetivos(): string[] {
	const archivos = [...ARCHIVOS_TOCADOS];
	for (const dir of ["src/lib/copy", "src/lib/schemas"]) {
		for (const entry of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
			if (!entry.isFile()) continue;
			if (!/\.(ts|svelte)$/.test(entry.name)) continue;
			if (/\.test\.ts$/.test(entry.name)) continue;
			archivos.push(`${dir}/${entry.name}`);
		}
	}
	return [...new Set(archivos)];
}

describe("El detector de palabras prohibidas está afilado", () => {
	it("marca un nombre de tecnología en una cadena o en un nodo de texto", () => {
		expect(auditar("sintetico.svelte", "<p>Hecho con CKAN</p>")).toHaveLength(1);
		expect(auditar("sintetico.svelte", '<p>{"Hecho con SvelteKit"}</p>')).toHaveLength(1);
	});

	it("marca una etiqueta de campo cruda en el texto visible", () => {
		expect(auditar("sintetico.svelte", "<span>ID: 42</span>")).toHaveLength(1);
		expect(auditar("sintetico.svelte", "<span>Slug: matricula</span>")).toHaveLength(1);
	});

	it("marca el término crudo en minúscula dentro de una oración, sin dos puntos", () => {
		// El caso que la entrada anterior dejaba escapar: el copy del error de creación usaba `slug`
		// en minúscula y sin dos puntos. La entrada ensanchada lo cubre en las dos formas.
		expect(
			auditar("sintetico.svelte", "<p>Elija otro slug e intente nuevamente.</p>"),
		).toHaveLength(1);
		expect(auditar("sintetico.svelte", '"El valor del slug ya existe."')).toHaveLength(1);
	});

	it("no marca un identificador de código que sólo comparte el término", () => {
		// `id: "slug"` y las clases `slug-hint` son strings del fuente, no copy: el ensanchamiento
		// exige el término como palabra de una oración para no volver ruidoso al escáner.
		expect(auditar("sintetico.svelte", '{ id: "slug" }')).toHaveLength(0);
		expect(auditar("sintetico.svelte", '"slug-hint slug-error"')).toHaveLength(0);
	});

	it("ve una cadena visible aunque un literal de regex anterior traiga comillas o backticks", () => {
		// El patrón de email de `schemas/dataset.ts` mete `'` y un backtick dentro de un `/…/`; sin
		// sacar los literales de regex, el escáner abría un falso template que `quitarLlaves` borraba
		// junto con el mensaje de validación, y la infracción no se veía.
		const fuente = [
			"const re = /[`]/;",
			'const obj = { a: "El valor del slug ya existe." };',
			"const otro = `x`;",
		].join("\n");
		expect(auditar("sintetico.svelte", fuente)).toHaveLength(1);
	});

	it("no marca un nombre que sólo vive en un comentario", () => {
		expect(auditar("sintetico.svelte", "<!-- hablamos de CKAN --><p>Catálogo</p>")).toHaveLength(0);
		expect(auditar("sintetico.svelte", "<p>Catálogo</p>")).toHaveLength(0);
	});

	it("no confunde un nombre de campo de datos con el servicio interno", () => {
		// `datastore_search` y `datastore_active` son campos/acciones del servicio; el límite de
		// palabra del token no los alcanza. Es el borde exacto que separa «no nombrar el sistema» de
		// «romper una URL que funciona».
		expect(auditar("sintetico.svelte", "<code>datastore_search</code>")).toHaveLength(0);
	});

	it("respeta una excepción declarada, con su motivo", () => {
		const excepcion = {
			archivo: "sintetico.svelte",
			fragmento: "CKAN",
			motivo: "excepción de prueba",
		};
		EXCEPCIONES.push(excepcion);
		expect(auditar("sintetico.svelte", "<p>Hecho con CKAN</p>")).toHaveLength(0);
		EXCEPCIONES.pop();
	});
});

describe("El copy visible no nombra la implementación", () => {
	for (const archivo of objetivos()) {
		it(`${archivo} no expone tecnología, servicios internos ni identificadores crudos`, () => {
			const fuente = readFileSync(join(RAIZ, archivo), "utf8");
			expect(auditar(archivo, fuente)).toEqual([]);
		});
	}
});
