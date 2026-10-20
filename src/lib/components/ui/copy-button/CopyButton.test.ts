import { fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CopyButton from "./CopyButton.svelte";

const writeText = vi.fn();

beforeEach(() => {
	writeText.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => {
	vi.useRealTimers();
});

describe("CopyButton — la forma de ícono", () => {
	it("tiene el nombre accesible de la acción, sin texto visible", () => {
		render(CopyButton, { props: { text: "https://x/y", label: "Copiar enlace", icon: "link" } });

		const button = screen.getByRole("button", { name: "Copiar enlace" });
		expect(button.textContent?.trim()).toBe("");
		expect(button.querySelector(".lucide-link-2")).not.toBeNull();
	});

	it("copia el texto, avisa «Copiado» por role=status y vuelve a los 2 s", async () => {
		render(CopyButton, { props: { text: "https://x/y", label: "Copiar enlace" } });
		const button = screen.getByRole("button", { name: "Copiar enlace" });
		expect(screen.getByRole("status").textContent).toBe("");

		vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
		await fireEvent.click(button);
		await vi.advanceTimersByTimeAsync(0);

		expect(writeText).toHaveBeenCalledWith("https://x/y");
		expect(screen.getByRole("status").textContent).toBe("Copiado");
		expect(button.querySelector(".lucide-check")).not.toBeNull();

		await vi.advanceTimersByTimeAsync(2000);
		expect(screen.getByRole("status").textContent).toBe("");
		expect(button.querySelector(".lucide-check")).toBeNull();
	});

	it("usa el texto de aviso que se le da", async () => {
		render(CopyButton, {
			props: { text: "t", label: "Copiar enlace", copiedLabel: "Enlace copiado" },
		});
		await fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));

		expect(await screen.findByText("Enlace copiado")).toBeTruthy();
		expect(screen.getByRole("status").textContent).toBe("Enlace copiado");
	});

	it("no avisa si el portapapeles falla", async () => {
		writeText.mockRejectedValue(new Error("denegado"));
		const exec = vi.fn().mockReturnValue(false);
		document.execCommand = exec;
		render(CopyButton, { props: { text: "t", label: "Copiar enlace" } });
		await fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
		await Promise.resolve();

		expect(screen.getByRole("status").textContent).toBe("");
	});
});

describe("CopyButton — la forma con etiqueta", () => {
	it("muestra el texto visible y conserva el nombre accesible completo", () => {
		render(CopyButton, {
			props: { text: "abc", label: "Copiar hash", visibleLabel: "Copiar", form: "label" },
		});

		const button = screen.getByRole("button", { name: "Copiar hash" });
		expect(button.textContent).toContain("Copiar");
	});

	it("con `collapseBelow` el texto sólo aparece desde ese ancho de contenedor y el botón queda cuadrado antes", () => {
		render(CopyButton, {
			props: {
				text: "abc",
				label: "Copiar hash",
				visibleLabel: "Copiar",
				form: "label",
				collapseBelow: "24rem",
				size: "sm",
			},
		});

		const button = screen.getByRole("button", { name: "Copiar hash" });
		expect(button.className).toContain("size-7");
		expect(button.className).toContain("@[24rem]:w-auto");
		const text = button.querySelector("[data-label]") as HTMLElement;
		expect(text.className).toContain("hidden");
		expect(text.className).toContain("@[24rem]:inline-grid");
	});

	it("no cambia de ancho al copiar: «Copiado» comparte celda con la etiqueta", async () => {
		render(CopyButton, {
			props: { text: "abc", label: "Copiar hash", visibleLabel: "Copiar", form: "label" },
		});
		const button = screen.getByRole("button", { name: "Copiar hash" });
		const text = button.querySelector("[data-label]") as HTMLElement;
		const [idle, done] = Array.from(text.children) as HTMLElement[];
		expect(idle.className).toContain("col-start-1");
		expect(done.className).toContain("col-start-1");
		expect(done.className).toContain("invisible");

		await fireEvent.click(button);
		await screen.findByText("Copiado", { selector: "[role=status]" });

		expect(idle.className).toContain("invisible");
		expect(done.className).not.toContain("invisible");
	});
});
