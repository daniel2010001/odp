// Subida de recursos a CKAN directo desde el browser.
//
// Por qué XHR y no fetch: `fetch` no puede reportar progreso de subida, y para un
// archivo de hasta 50 MB el progreso importa. Un form action del servidor tampoco
// puede mostrarlo.
//
// Por qué NO se fija `Content-Type`: el browser debe generar el boundary del
// multipart. Fijarlo a mano lo pierde y CKAN rechaza el archivo. Ésta es la
// diferencia con `src/lib/api/client.ts`, que hardcodea JSON porque el resto de
// las acciones de CKAN sí aceptan JSON.

import type { CkanResource } from "$lib/types/ckan";

export type UploadErrorCode = "aborted" | "network" | "http" | "ckan" | "timeout" | "nonjson";

export class UploadError extends Error {
	readonly code: UploadErrorCode;
	readonly status?: number;
	readonly ckanType?: string;

	constructor(message: string, code: UploadErrorCode, status?: number, ckanType?: string) {
		super(message);
		this.name = "UploadError";
		this.code = code;
		this.status = status;
		this.ckanType = ckanType;
	}
}

export interface UploadResourceOptions {
	/** Base de CKAN. Vacío = mismo origen (el proxy `/api/` del stack). */
	baseUrl?: string;
	token: string;
	packageId: string;
	file: Blob;
	/** Nombre con el que CKAN registra el recurso. */
	filename: string;
	/** Nombre visible del recurso en CKAN. Si está vacío, cae al nombre real del archivo. */
	name?: string;
	/** Descripción del recurso. Sólo se envía si tiene valor. */
	description?: string;
	onProgress?: (percent: number) => void;
	signal?: AbortSignal;
	/**
	 * Tiempo máximo de subida en ms. Por defecto 600000 (10 min): una subida
	 * colgada (proxy o red que no cierra la conexión) debe fallar y no quedar
	 * pendiente para siempre.
	 */
	timeoutMs?: number;
}

interface ResourceCreateEnvelope {
	success?: boolean;
	result?: CkanResource;
	error?: { message?: string; __type?: string };
}

/** Sube un archivo como recurso de un dataset. Resuelve con el recurso creado. */
export function uploadResourceFile(options: UploadResourceOptions): Promise<CkanResource> {
	const {
		baseUrl = "",
		token,
		packageId,
		file,
		filename,
		name,
		description,
		onProgress,
		signal,
		timeoutMs = 600000,
	} = options;

	if (signal?.aborted) {
		return Promise.reject(new UploadError("Subida cancelada", "aborted"));
	}

	return new Promise<CkanResource>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		const base = baseUrl.replace(/\/$/, "");

		xhr.open("POST", `${base}/api/3/action/resource_create`);
		xhr.setRequestHeader("Authorization", token);
		xhr.timeout = timeoutMs;

		xhr.upload.onprogress = (event) => {
			if (!event.lengthComputable || event.total === 0) return;
			onProgress?.(Math.round((event.loaded / event.total) * 100));
		};

		xhr.onload = () => {
			let body: ResourceCreateEnvelope | null = null;
			try {
				body = JSON.parse(xhr.responseText) as ResourceCreateEnvelope;
			} catch {
				// Respuesta no JSON (por ejemplo el HTML de un proxy): se distingue
				// según el status más abajo.
				body = null;
			}

			if (xhr.status !== 200) {
				reject(
					new UploadError(
						body?.error?.message ?? `HTTP ${xhr.status}`,
						"http",
						xhr.status,
						body?.error?.__type,
					),
				);
				return;
			}

			// 200 con cuerpo no-JSON: no es un error de CKAN (que siempre responde
			// JSON); algo intermedio (proxy, HTML de error) rompió el envelope.
			if (body === null) {
				reject(
					new UploadError(
						"El servidor respondió con un cuerpo ilegible (no JSON)",
						"nonjson",
						xhr.status,
					),
				);
				return;
			}

			if (!body.success || !body.result) {
				reject(
					new UploadError(
						body.error?.message ?? "La subida falló",
						"ckan",
						xhr.status,
						body.error?.__type,
					),
				);
				return;
			}

			resolve(body.result);
		};

		xhr.onerror = () => reject(new UploadError("No se pudo conectar con el servidor", "network"));
		xhr.onabort = () => reject(new UploadError("Subida cancelada", "aborted"));
		xhr.ontimeout = () => reject(new UploadError("La subida excedió el tiempo límite", "timeout"));

		signal?.addEventListener("abort", () => xhr.abort(), { once: true });

		const form = new FormData();
		form.append("package_id", packageId);
		// `name` es el nombre visible del recurso: si viene vacío, CKAN recibe el nombre real
		// del archivo (comportamiento previo a poder editarlo). El `filename` se conserva como
		// nombre de la parte `upload` para que CKAN infiera format/size/mimetype desde el archivo.
		form.append("name", name?.trim() || filename);
		if (description?.trim()) form.append("description", description.trim());
		form.append("upload", file, filename);

		xhr.send(form);
	});
}
