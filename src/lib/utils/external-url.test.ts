import { describe, expect, it } from "vitest";
import { safeExternalUrl, unsafeUrlReason } from "./external-url";

describe("safeExternalUrl", () => {
	it("acepta http y https y devuelve la URL sin espacios alrededor", () => {
		expect(safeExternalUrl("https://datos.umss.edu/dataset.csv")).toBe(
			"https://datos.umss.edu/dataset.csv",
		);
		expect(safeExternalUrl("http://localhost:8080/api/3/action/status_show")).toBe(
			"http://localhost:8080/api/3/action/status_show",
		);
		expect(safeExternalUrl("  https://example.com/recurso.pdf  ")).toBe(
			"https://example.com/recurso.pdf",
		);
	});

	it("rechaza esquemas ejecutables (XSS almacenado)", () => {
		expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
		expect(safeExternalUrl("JavaScript:alert(1)")).toBeNull();
		expect(safeExternalUrl(" javascript:alert(1)")).toBeNull();
		expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
		expect(safeExternalUrl("vbscript:msgbox(1)")).toBeNull();
		expect(safeExternalUrl("file:///etc/passwd")).toBeNull();
	});

	it("rechaza valores vacíos, ausentes y no parseables", () => {
		expect(safeExternalUrl(null)).toBeNull();
		expect(safeExternalUrl(undefined)).toBeNull();
		expect(safeExternalUrl("")).toBeNull();
		expect(safeExternalUrl("   ")).toBeNull();
		expect(safeExternalUrl("datos.umss.edu/dataset.csv")).toBeNull();
		expect(safeExternalUrl("/dataset/matricula")).toBeNull();
		expect(safeExternalUrl("no es una url")).toBeNull();
	});
});

describe("unsafeUrlReason", () => {
	it("clasifica el rechazo para que el llamador elija el mensaje", () => {
		expect(unsafeUrlReason("https://example.com/a.csv")).toBeNull();
		expect(unsafeUrlReason("javascript:alert(1)")).toBe("protocol");
		expect(unsafeUrlReason("data:text/html,x")).toBe("protocol");
		expect(unsafeUrlReason("datos.umss.edu/a.csv")).toBe("not-absolute");
		expect(unsafeUrlReason("/dataset/matricula")).toBe("not-absolute");
		expect(unsafeUrlReason("no es una url")).toBe("not-absolute");
		expect(unsafeUrlReason("")).toBe("empty");
		expect(unsafeUrlReason("   ")).toBe("empty");
		expect(unsafeUrlReason(null)).toBe("empty");
		expect(unsafeUrlReason(undefined)).toBe("empty");
	});
});
