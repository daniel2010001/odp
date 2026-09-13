import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadError, uploadResourceFile } from "./upload";

type ProgressEvent = { lengthComputable: boolean; loaded: number; total: number };

class FakeXhr {
	static instances: FakeXhr[] = [];

	method = "";
	url = "";
	headers: Record<string, string> = {};
	body: FormData | null = null;
	status = 200;
	responseText = '{"success": true, "result": {"id": "res-1"}}';
	upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onabort: (() => void) | null = null;
	ontimeout: (() => void) | null = null;
	timeout = 0;
	aborted = false;

	open(method: string, url: string) {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(key: string, value: string) {
		this.headers[key] = value;
	}

	send(body: FormData) {
		this.body = body;
		FakeXhr.instances.push(this);
	}

	abort() {
		this.aborted = true;
		this.onabort?.();
	}
}

function start(overrides: Partial<Parameters<typeof uploadResourceFile>[0]> = {}) {
	const promise = uploadResourceFile({
		baseUrl: "https://ckan.test",
		token: "tok-123",
		packageId: "ds-1",
		file: new Blob(["contenido"]),
		filename: "datos.csv",
		...overrides,
	});
	const xhr = FakeXhr.instances.at(-1);
	if (!xhr) throw new Error("no se instanció XMLHttpRequest");
	return { promise, xhr };
}

beforeEach(() => {
	FakeXhr.instances = [];
	vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("uploadResourceFile — transporte", () => {
	it("hace POST a resource_create", () => {
		const { promise, xhr } = start();

		expect(xhr.method).toBe("POST");
		expect(xhr.url).toBe("https://ckan.test/api/3/action/resource_create");

		xhr.onload?.();
		return promise;
	});

	it("no fija Content-Type (perdería el boundary del multipart)", () => {
		const { promise, xhr } = start();

		expect(Object.keys(xhr.headers).map((key) => key.toLowerCase())).not.toContain("content-type");

		xhr.onload?.();
		return promise;
	});

	it("manda el token en Authorization", () => {
		const { promise, xhr } = start();

		expect(xhr.headers.Authorization).toBe("tok-123");

		xhr.onload?.();
		return promise;
	});

	it("manda package_id y el archivo en la parte upload", () => {
		const { promise, xhr } = start();

		expect(xhr.body?.get("package_id")).toBe("ds-1");
		expect(xhr.body?.get("name")).toBe("datos.csv");
		expect(xhr.body?.get("upload")).toBeInstanceOf(Blob);

		xhr.onload?.();
		return promise;
	});

	it("respeta una baseUrl vacía (mismo origen)", () => {
		const { promise, xhr } = start({ baseUrl: "" });

		expect(xhr.url).toBe("/api/3/action/resource_create");

		xhr.onload?.();
		return promise;
	});
});

describe("uploadResourceFile — name y description", () => {
	it("manda el name provisto como nombre visible del recurso", () => {
		const { promise, xhr } = start({ name: "Matrícula 2026 (datos)" });

		expect(xhr.body?.get("name")).toBe("Matrícula 2026 (datos)");

		xhr.onload?.();
		return promise;
	});

	it("cae al nombre real del archivo cuando name viene vacío", () => {
		const { promise, xhr } = start({ name: "" });

		expect(xhr.body?.get("name")).toBe("datos.csv");

		xhr.onload?.();
		return promise;
	});

	it("agrega description sólo cuando tiene valor", () => {
		const { promise, xhr } = start({ description: "Tabla completa de matrícula." });

		expect(xhr.body?.get("description")).toBe("Tabla completa de matrícula.");

		xhr.onload?.();
		return promise;
	});

	it("omite description cuando viene vacía o en blanco", () => {
		const { promise, xhr } = start({ description: "   " });

		expect(xhr.body?.has("description")).toBe(false);

		xhr.onload?.();
		return promise;
	});

	it("conserva el nombre real del archivo en la parte upload", () => {
		const { promise, xhr } = start({ name: "Matrícula 2026 (datos)" });

		const upload = xhr.body?.get("upload") as File | null;
		expect(upload?.name).toBe("datos.csv");

		xhr.onload?.();
		return promise;
	});
});

describe("uploadResourceFile — resultado", () => {
	it("resuelve con el recurso creado", async () => {
		const { promise, xhr } = start();
		xhr.responseText = '{"success": true, "result": {"id": "res-1", "name": "datos.csv"}}';
		xhr.onload?.();

		await expect(promise).resolves.toMatchObject({ id: "res-1", name: "datos.csv" });
	});

	it("mapea success:false al error de CKAN", async () => {
		const { promise, xhr } = start();
		xhr.responseText =
			'{"success": false, "error": {"message": "subida rechazada", "__type": "Validation Error"}}';
		xhr.onload?.();

		const error = await promise.catch((err: unknown) => err);
		expect(error).toBeInstanceOf(UploadError);
		expect(error).toMatchObject({ message: "subida rechazada", code: "ckan" });
	});

	it("mapea una respuesta HTTP no exitosa sin romper el parseo", async () => {
		const { promise, xhr } = start();
		xhr.status = 413;
		xhr.responseText = "<html>413 Request Entity Too Large</html>";
		xhr.onload?.();

		await expect(promise).rejects.toMatchObject({ code: "http", status: 413 });
	});

	it("mapea un error de red", async () => {
		const { promise, xhr } = start();
		xhr.onerror?.();

		await expect(promise).rejects.toMatchObject({ code: "network" });
	});

	it("configura un timeout por defecto en el XHR", () => {
		const { promise, xhr } = start();

		expect(xhr.timeout).toBe(600000);

		xhr.onload?.();
		return promise;
	});

	it("respeta un timeoutMs explícito", () => {
		const { promise, xhr } = start({ timeoutMs: 3000 });

		expect(xhr.timeout).toBe(3000);

		xhr.onload?.();
		return promise;
	});

	it("rechaza con error tipado cuando la subida excede el tiempo límite", async () => {
		const { promise, xhr } = start();

		xhr.ontimeout?.();

		await expect(promise).rejects.toMatchObject({
			code: "timeout",
			message: expect.stringContaining("tiempo"),
		});
	});

	it("distingue un 200 con cuerpo no-JSON del error genérico de CKAN", async () => {
		const { promise, xhr } = start();
		xhr.status = 200;
		xhr.responseText = "<html>proxy devolvió HTML</html>";
		xhr.onload?.();

		await expect(promise).rejects.toMatchObject({ code: "nonjson" });
	});

	it("reporta el progreso en porcentaje", async () => {
		const onProgress = vi.fn();
		const { promise, xhr } = start({ onProgress });

		xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 });
		expect(onProgress).toHaveBeenCalledWith(25);

		xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
		expect(onProgress).toHaveBeenCalledWith(50);

		xhr.onload?.();
		await promise;
	});

	it("no reporta progreso cuando el total es desconocido", async () => {
		const onProgress = vi.fn();
		const { promise, xhr } = start({ onProgress });

		xhr.upload.onprogress?.({ lengthComputable: false, loaded: 10, total: 0 });
		expect(onProgress).not.toHaveBeenCalled();

		xhr.onload?.();
		await promise;
	});
});

describe("uploadResourceFile — cancelación", () => {
	it("aborta el request cuando se cancela", async () => {
		const controller = new AbortController();
		const { promise, xhr } = start({ signal: controller.signal });

		controller.abort();

		expect(xhr.aborted).toBe(true);
		await expect(promise).rejects.toMatchObject({ code: "aborted" });
	});

	it("no llega a enviar si el signal ya estaba cancelado", async () => {
		const controller = new AbortController();
		controller.abort();

		const promise = uploadResourceFile({
			baseUrl: "https://ckan.test",
			token: "tok-123",
			packageId: "ds-1",
			file: new Blob(["contenido"]),
			filename: "datos.csv",
			signal: controller.signal,
		});

		expect(FakeXhr.instances).toHaveLength(0);
		await expect(promise).rejects.toMatchObject({ code: "aborted" });
	});
});
