import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { CkanPackage, CkanResource, CkanTag } from "$lib/types/ckan";
import DatasetCard from "./DatasetCard.svelte";

function makeTag(index: number): CkanTag {
	const name = `etiqueta-${index}`;
	return { id: name, name, display_name: name, state: "active" };
}

function makeResource(format: string): CkanResource {
	return {
		id: `res-${format}`,
		package_id: "pkg-1",
		name: `recurso-${format}`,
		url: `https://example.test/${format.toLowerCase()}`,
		format,
		created: "2026-01-01T00:00:00.000000",
		last_modified: "2026-01-01T00:00:00.000000",
		state: "active",
		position: 0,
	};
}

function makeDataset({
	tags = 0,
	formats = [],
}: {
	tags?: number;
	formats?: string[];
} = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: false,
		state: "active",
		resources: formats.map(makeResource),
		tags: Array.from({ length: tags }, (_, index) => makeTag(index + 1)),
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
	};
}

const EIGHT_TAGS_SIX_FORMATS = { tags: 8, formats: ["CSV", "JSON", "PDF", "XLSX", "XML", "RDF"] };

/** El único enlace de la card: la card entera es un `<a>`. */
function cardLink(): HTMLAnchorElement {
	const link = screen.getByRole("link");
	if (link.tagName !== "A") throw new Error(`Se esperaba un <a> y llegó <${link.tagName}>`);
	return link as HTMLAnchorElement;
}

describe("DatasetCard — recorte de tags y formatos", () => {
	it("con 5 tags muestra 3 y un `+2` pelado", () => {
		render(DatasetCard, { props: { dataset: makeDataset({ tags: 5 }) } });

		expect(screen.getAllByText(/^#/)).toHaveLength(3);
		expect(screen.getByText("+2")).toBeInTheDocument();
	});

	it("con exactamente 3 tags no hay contador `+N`", () => {
		render(DatasetCard, { props: { dataset: makeDataset({ tags: 3 }) } });

		expect(screen.getAllByText(/^#/)).toHaveLength(3);
		expect(screen.queryByText(/^\+\d/)).toBeNull();
	});

	it("con 0 tags no se renderiza el bloque de tags", () => {
		render(DatasetCard, { props: { dataset: makeDataset({ tags: 0 }) } });

		expect(screen.queryByText(/^#/)).toBeNull();
		expect(screen.queryByText(/^\+\d/)).toBeNull();
	});
});

// El `<a>` de la card es el disparador del tooltip: la card sigue siendo **un solo enlace**
// clicable y la divulgación cuelga de él. Es la única forma de la divulgación.
describe("DatasetCard — divulgación por tooltip", () => {
	it("conserva el recorte visible y agrega la divulgación de lo escondido", async () => {
		render(DatasetCard, { props: { dataset: makeDataset(EIGHT_TAGS_SIX_FORMATS) } });

		// El recorte visible no cambia: 3 tags + `+5`, 4 formatos + `+2 más`.
		expect(screen.getAllByText(/^#/)).toHaveLength(3);
		expect(screen.getByText("+5")).toBeInTheDocument();
		expect(screen.getByText("+2 más")).toBeInTheDocument();

		const link = cardLink();
		expect(link).toHaveAttribute("href", "/dataset/matricula-2026");
		// El `<a>` no puede heredar el `type="button"` que bits-ui inyecta en el disparador:
		// es un atributo inválido sobre un enlace. El recorte del `type` vive acá, donde se
		// elige el elemento, no en el envoltorio del tooltip (que debe ser pasamanos fiel).
		expect(link).not.toHaveAttribute("type");
		expect(link).not.toHaveAttribute("disabled");

		// El camino real, sin forzar: el foco abre el tooltip.
		link.focus();
		const tooltip = await screen.findByRole("tooltip");
		expect(tooltip).toHaveTextContent("etiqueta-4");
		expect(tooltip).toHaveTextContent("etiqueta-8");
		expect(tooltip).toHaveTextContent("XML");
		expect(tooltip).toHaveTextContent("RDF");
	});

	it("el enlace de la card no contiene contenido interactivo anidado", async () => {
		render(DatasetCard, { props: { dataset: makeDataset(EIGHT_TAGS_SIX_FORMATS) } });
		const link = cardLink();
		link.focus();
		await screen.findByRole("tooltip");

		// El tooltip se porta a `document.body`, así que no cuelga del enlace: cero
		// interactivos anidados dentro del `<a>` (un `<a>` o `<button>` adentro sería
		// HTML inválido y una trampa para el teclado).
		expect(link.querySelectorAll("a, button, input, select, textarea")).toHaveLength(0);
		expect(link.querySelectorAll("[tabindex]")).toHaveLength(0);
	});

	it("sin nada escondido el enlace queda sin disparador: no hay tooltip vacío", () => {
		render(DatasetCard, { props: { dataset: makeDataset({ tags: 2, formats: ["CSV"] }) } });

		const link = cardLink();

		// Un tooltip que no tiene nada que decir es ruido: sin recorte, la card degrada
		// al enlace normal. La aserción es sincrónica a propósito: mira la marca del
		// disparador (`data-tooltip-trigger`), que está o no está sin esperar a que monte
		// el contenido.
		expect(link).not.toHaveAttribute("data-tooltip-trigger");
		expect(document.querySelectorAll("[data-tooltip-content]")).toHaveLength(0);
	});
});

// Corrección a11y deliberada sobre comportamiento existente: el enlace de la card
// llevaba `focus-visible:outline-none` y nada en su lugar, así que el teclado no veía
// dónde estaba el foco. Se agrega el anillo con los tokens del repo.
describe("foco visible del enlace de la card", () => {
	const RING = [
		"focus-visible:ring-2",
		"focus-visible:ring-ring",
		"focus-visible:ring-offset-2",
		// Sin color de offset, Tailwind pinta el `#fff` crudo; el repo exige tokens.
		"focus-visible:ring-offset-background",
	];

	it("lo pone en el `<a>` de la card y conserva el `rounded-xl` del anillo", () => {
		render(DatasetCard, { props: { dataset: makeDataset(EIGHT_TAGS_SIX_FORMATS) } });

		const link = cardLink();
		for (const cls of RING) expect(link.className).toContain(cls);
		// El anillo tiene que seguir el radio de la card, no una esquina cuadrada.
		expect(link.className).toContain("rounded-xl");
	});
});
