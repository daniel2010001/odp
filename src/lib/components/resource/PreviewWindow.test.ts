// La «ventana» de una vista: el mismo encabezado para tabla, gráfico, PDF, imagen y texto.
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PreviewWindow from "./PreviewWindow.svelte";

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const body = createRawSnippet(() => ({ render: () => "<p>contenido</p>" }));

function open(props: Record<string, unknown> = {}) {
	return render(PreviewWindow, {
		props: {
			id: "pdf",
			label: "PDF",
			link: "http://localhost/dataset/a/resource/b#pdf",
			children: body,
			...props,
		},
	});
}

beforeEach(() => {
	Element.prototype.scrollIntoView = vi.fn();
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({ matches: false })),
	);
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText: vi.fn(async () => {}) },
		configurable: true,
	});
});

describe("PreviewWindow — alto (T37, S40)", () => {
	const FILL = "min-h-[max(360px,calc(100dvh-140px-var(--tabs-h,0px)))]";

	it("la ventana de una vista (con id) llena la pantalla: el cuerpo tiene el piso de alto de toda vista", () => {
		open();
		expect(screen.getByText("contenido").parentElement?.className).toContain(FILL);
	});

	it("la nota sin id (enlace externo, tipo sin vista previa) no se estira", () => {
		open({ id: undefined, label: undefined });
		expect(screen.getByText("contenido").parentElement?.className ?? "").not.toContain(
			"min-h-[max",
		);
	});
});

describe("PreviewWindow", () => {
	it("lleva el id de la vista, el margen bajo el encabezado y el rótulo «Vista previa · …»", () => {
		open();
		const win = document.getElementById("pdf") as HTMLElement;
		expect(win.className).toContain(
			"scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air)+var(--tabs-h,0px))]",
		);
		expect(screen.getByText("Vista previa · PDF")).toBeInTheDocument();
		expect(screen.getByText("contenido")).toBeInTheDocument();
	});

	it("«Copiar enlace» copia la URL completa con el fragmento de la ventana", async () => {
		open();
		await fireEvent.click(screen.getByRole("button", { name: "Copiar enlace de la vista" }));
		await vi.waitFor(() =>
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
				"http://localhost/dataset/a/resource/b#pdf",
			),
		);
	});

	it("los dos botones colapsan bajo el MISMO corte de contenedor (24 rem) y conservan su nombre", () => {
		open();
		const copiar = screen.getByRole("button", { name: "Copiar enlace de la vista" });
		const ajustar = screen.getByRole("button", { name: "Ajustar a la pantalla" });
		for (const b of [copiar, ajustar]) {
			expect(b.className).toContain("size-7");
			expect(b.className).toContain("@[24rem]:w-auto");
			expect(b.querySelector("[data-label]")?.className).toContain("@[24rem]:inline");
		}
	});

	it("«Ajustar a la pantalla» sube el contenedor #vista-previa y le pasa el foco", async () => {
		const host = document.createElement("div");
		host.id = "vista-previa";
		document.body.append(host);
		render(PreviewWindow, {
			target: host,
			props: { id: "pdf", label: "PDF", link: "http://localhost/#pdf", children: body },
		});
		const focus = vi.spyOn(host, "focus");
		await fireEvent.click(within(host).getByRole("button", { name: "Ajustar a la pantalla" }));
		expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "start",
		});
		const el = vi.mocked(Element.prototype.scrollIntoView).mock.contexts[0] as HTMLElement;
		expect(el.id).toBe("vista-previa");
		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
	});

	it("sin id (nota de enlace externo o tipo sin vista) no hay botones", () => {
		open({ id: undefined, label: undefined });
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("Vista previa")).toBeInTheDocument();
	});
});
