import { describe, expect, it } from "vitest";
import type { CkanPackage } from "$lib/types/ckan";
import {
	buildPackagePayload,
	buildRevisePayload,
	inferResourceFormat,
	MAX_RESOURCE_BYTES,
	suggestSlug,
	toLoadedDataset,
	validateResourceFile,
} from "./dataset-payload";
import { SUMMARY_EXTRA_KEY } from "./dataset-summary";

const base = {
	title: "Matrícula Estudiantil 2026",
	name: "matricula-estudiantil-2026",
	owner_org: "facultad-de-ciencias",
	private: true,
};

describe("buildPackagePayload", () => {
	it("con lo mínimo emite solo los campos obligatorios", () => {
		expect(buildPackagePayload(base)).toEqual({
			title: "Matrícula Estudiantil 2026",
			name: "matricula-estudiantil-2026",
			owner_org: "facultad-de-ciencias",
			private: true,
		});
	});

	it("omite los opcionales vacíos en lugar de mandar cadenas vacías", () => {
		const payload = buildPackagePayload({
			...base,
			notes: "",
			license_id: "",
			tag_string: "   ",
			url: "",
			maintainer: "",
		});

		expect(payload).not.toHaveProperty("notes");
		expect(payload).not.toHaveProperty("license_id");
		expect(payload).not.toHaveProperty("tag_string");
		expect(payload).not.toHaveProperty("url");
		expect(payload).not.toHaveProperty("maintainer");
	});

	it("coloca los opcionales en campos nativos de CKAN", () => {
		const payload = buildPackagePayload({
			...base,
			notes: "Descripción",
			license_id: "cc-by",
			tag_string: "matricula, estudiantes",
			url: "https://umss.edu.bo/datos",
			maintainer: "Dirección de Sistemas",
			maintainer_email: "datos@umss.edu.bo",
		});

		expect(payload.notes).toBe("Descripción");
		expect(payload.license_id).toBe("cc-by");
		expect(payload.tag_string).toBe("matricula, estudiantes");
		expect(payload.url).toBe("https://umss.edu.bo/datos");
		expect(payload.maintainer).toBe("Dirección de Sistemas");
		expect(payload.maintainer_email).toBe("datos@umss.edu.bo");
	});

	it("no escribe ningún extra (decisión v0: sin claves DCAT inventadas)", () => {
		const payload = buildPackagePayload({
			...base,
			notes: "Descripción",
			license_id: "cc-by",
			tag_string: "uno, dos",
			url: "https://umss.edu.bo/datos",
			maintainer: "Dirección de Sistemas",
			maintainer_email: "datos@umss.edu.bo",
		});

		expect(payload).not.toHaveProperty("extras");
	});

	it("recorta los espacios de los valores", () => {
		const payload = buildPackagePayload({
			...base,
			title: "  Matrícula 2026  ",
			owner_org: "  facultad-de-ciencias  ",
			notes: "  Descripción  ",
		});

		expect(payload.title).toBe("Matrícula 2026");
		expect(payload.owner_org).toBe("facultad-de-ciencias");
		expect(payload.notes).toBe("Descripción");
	});

	it("respeta la visibilidad pública", () => {
		expect(buildPackagePayload({ ...base, private: false }).private).toBe(false);
	});

	// Guarda de regresión del camino de creación: la edición usa otro builder, así que este
	// payload no debe cambiar cuando `buildRevisePayload` entra en escena. Byte a byte incluye
	// el orden de las claves, que es el del `JSON.stringify` que termina viajando a CKAN.
	it("con todos los campos emite hoy el mismo payload completo, byte a byte", () => {
		const payload = buildPackagePayload({
			...base,
			notes: "Descripción",
			summary: "Un resumen corto",
			license_id: "cc-by",
			tag_string: "matricula, estudiantes",
			url: "https://umss.edu.bo/datos",
			maintainer: "Dirección de Sistemas",
			maintainer_email: "datos@umss.edu.bo",
		});

		expect(payload).toEqual({
			title: "Matrícula Estudiantil 2026",
			name: "matricula-estudiantil-2026",
			owner_org: "facultad-de-ciencias",
			private: true,
			notes: "Descripción",
			license_id: "cc-by",
			tag_string: "matricula, estudiantes",
			url: "https://umss.edu.bo/datos",
			maintainer: "Dirección de Sistemas",
			maintainer_email: "datos@umss.edu.bo",
			extras: [{ key: SUMMARY_EXTRA_KEY, value: "Un resumen corto" }],
		});
		expect(JSON.stringify(payload)).toBe(
			'{"title":"Matrícula Estudiantil 2026","name":"matricula-estudiantil-2026","owner_org":"facultad-de-ciencias","private":true,"notes":"Descripción","license_id":"cc-by","tag_string":"matricula, estudiantes","url":"https://umss.edu.bo/datos","maintainer":"Dirección de Sistemas","maintainer_email":"datos@umss.edu.bo","extras":[{"key":"summary","value":"Un resumen corto"}]}',
		);
	});
});

describe("suggestSlug", () => {
	it("deriva el slug del título quitando acentos y separadores", () => {
		expect(suggestSlug("Matrícula Estudiantil 2026")).toBe("matricula-estudiantil-2026");
	});

	it("colapsa separadores repetidos y recorta los extremos", () => {
		expect(suggestSlug("  Datos   Abiertos -- UMSS  ")).toBe("datos-abiertos-umss");
	});

	it("descarta signos de puntuación", () => {
		expect(suggestSlug("¿Matrícula? (2026)")).toBe("matricula-2026");
	});

	it("conserva guiones y guión bajo existentes", () => {
		expect(suggestSlug("covid_19-bolivia")).toBe("covid_19-bolivia");
	});

	it("no supera los 100 caracteres que acepta el schema", () => {
		expect(suggestSlug("a".repeat(150)).length).toBeLessThanOrEqual(100);
	});

	it("no deja un separador colgando al truncar en el límite de 100 (guión y guión bajo)", () => {
		const long = "a".repeat(99);
		expect(suggestSlug(`${long}-b`)).toBe(long);
		expect(suggestSlug(`${long}_b`)).toBe(long);
	});

	it("recorta un título largo terminado en separador justo en el límite", () => {
		const hundred = "a".repeat(100);
		expect(suggestSlug(`${hundred}-`)).toBe(hundred);
	});

	it("devuelve una cadena vacía cuando no queda nada utilizable", () => {
		expect(suggestSlug("¡...!")).toBe("");
	});
});

describe("inferResourceFormat", () => {
	it("toma la extensión en mayúsculas", () => {
		expect(inferResourceFormat("matricula.csv")).toBe("CSV");
		expect(inferResourceFormat("informe.pdf")).toBe("PDF");
	});

	it("no depende de mayúsculas ni minúsculas en la extensión", () => {
		expect(inferResourceFormat("MATRICULA.CSV")).toBe("CSV");
	});

	it("devuelve una cadena vacía cuando no hay extensión", () => {
		expect(inferResourceFormat("sin-extension")).toBe("");
	});

	it("usa solo la última extensión cuando hay puntos en el nombre", () => {
		expect(inferResourceFormat("datos.2026.csv")).toBe("CSV");
	});
});

describe("validateResourceFile", () => {
	it("acepta un archivo de exactamente 50 MB", () => {
		expect(validateResourceFile({ name: "justo.csv", size: MAX_RESOURCE_BYTES })).toEqual({
			ok: true,
		});
	});

	it("rechaza un archivo mayor, nombrando el archivo y su tamaño", () => {
		const result = validateResourceFile({
			name: "grande.csv",
			size: MAX_RESOURCE_BYTES + 1024 * 1024,
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toContain("grande.csv");
			expect(result.message).toContain("51.0 MB");
			expect(result.message).toContain("50 MB");
		}
	});

	it("el límite es el de PRD RF-12 (50 MB)", () => {
		expect(MAX_RESOURCE_BYTES).toBe(50 * 1024 * 1024);
	});
});

describe("buildRevisePayload — edición parcial (package_revise)", () => {
	const datasetCargado = {
		id: "3f2a1b0c-1111-2222-3333-444455556666",
		metadata_modified: "2026-10-01T09:30:00.000000",
		extras: [
			{ key: "frequency", value: "anual" },
			{ key: SUMMARY_EXTRA_KEY, value: "Resumen viejo" },
		],
	};

	const edicion = {
		title: "  Matrícula Estudiantil 2026  ",
		name: "matricula-estudiantil-2026",
		notes: "Descripción editada",
		summary: "Resumen editado",
		license_id: "cc-by",
		tag_string: "matricula, estudiantes",
		url: "https://umss.edu.bo/datos",
		maintainer: "Dirección de Sistemas",
		maintainer_email: "datos@umss.edu.bo",
	};

	// 2. El `update` lleva EXACTAMENTE los campos del formulario: ni uno de más (nada de
	// `owner_org`, `private`, `state`, `id`, `resources` ni campos derivados de CKAN), ni uno de
	// menos. Las tags y los extras entran por sus propias claves (`tags`, `extras`), no planas.
	it("escribe exactamente los campos que el formulario gobierna", () => {
		const { update } = buildRevisePayload({ dataset: datasetCargado, input: edicion });

		expect(Object.keys(update).sort()).toEqual(
			[
				"title",
				"name",
				"notes",
				"license_id",
				"url",
				"maintainer",
				"maintainer_email",
				"extras",
				"tags",
			].sort(),
		);
	});

	it("recorta los espacios y escribe las tags del formulario como `[{ name }]`", () => {
		const { update } = buildRevisePayload({ dataset: datasetCargado, input: edicion });

		expect(update.title).toBe("Matrícula Estudiantil 2026");
		expect(update.tags).toEqual([{ name: "matricula" }, { name: "estudiantes" }]);
		expect(update.extras).toEqual([
			{ key: "frequency", value: "anual" },
			{ key: SUMMARY_EXTRA_KEY, value: "Resumen editado" },
		]);
	});

	it("no manda ningún campo que el formulario no gobierne", () => {
		const { update } = buildRevisePayload({ dataset: datasetCargado, input: edicion });

		for (const clave of [
			"owner_org",
			"private",
			"state",
			"id",
			"resources",
			"tag_string",
			"license_title",
			"metadata_created",
			"metadata_modified",
			"creator_user_id",
		]) {
			expect(update).not.toHaveProperty(clave);
		}
	});

	// 3. La lista cargada viaja ENTERA y en el orden cargado. Con el `filter`, CKAN la instala
	// verbatim: los extras que el portal no gobierna sobreviven tal cual y en su posición.
	it("reenvía los extras no gestionados verbatim, en su posición", () => {
		const { update } = buildRevisePayload({
			dataset: {
				...datasetCargado,
				extras: [
					{ key: "frequency", value: "anual" },
					{ key: SUMMARY_EXTRA_KEY, value: "Resumen viejo" },
					{ key: "source", value: "portal" },
				],
			},
			input: edicion,
		});

		expect(update.extras).toEqual([
			{ key: "frequency", value: "anual" },
			{ key: SUMMARY_EXTRA_KEY, value: "Resumen editado" },
			{ key: "source", value: "portal" },
		]);
	});

	// 4a. El resumen ya existe: se reemplaza su `value` en el lugar, sin duplicar ni reordenar.
	it("reemplaza el resumen en el lugar cuando el extra ya existe", () => {
		const { update } = buildRevisePayload({ dataset: datasetCargado, input: edicion });

		expect(update.extras).toEqual([
			{ key: "frequency", value: "anual" },
			{ key: SUMMARY_EXTRA_KEY, value: "Resumen editado" },
		]);
	});

	// 4b. El resumen no existe todavía: se agrega AL FINAL de la lista cargada, sin reordenarla.
	it("agrega el resumen al final cuando el dataset no tenía el extra", () => {
		const { update } = buildRevisePayload({
			dataset: { ...datasetCargado, extras: [{ key: "frequency", value: "anual" }] },
			input: edicion,
		});

		expect(update.extras).toEqual([
			{ key: "frequency", value: "anual" },
			{ key: SUMMARY_EXTRA_KEY, value: "Resumen editado" },
		]);
	});

	it("agrega el resumen cuando el dataset no trae ningún extra", () => {
		const { update } = buildRevisePayload({
			dataset: { id: "ds-1", metadata_modified: "2026-10-01T09:30:00.000000", extras: [] },
			input: edicion,
		});

		expect(update.extras).toEqual([{ key: SUMMARY_EXTRA_KEY, value: "Resumen editado" }]);
	});

	// 4f. Sin extra cargado y con el resumen limpio, no hay nada que borrar ni que crear: la lista
	// cargada queda igual (sin un extra de resumen vacío).
	it("no crea un extra de resumen vacío cuando el dataset no lo tenía cargado", () => {
		const { update } = buildRevisePayload({
			dataset: { ...datasetCargado, extras: [{ key: "frequency", value: "anual" }] },
			input: { ...edicion, summary: "   " },
		});

		expect(update.extras).toEqual([{ key: "frequency", value: "anual" }]);
	});

	// 2b. En edición los opcionales se escriben SIEMPRE, aunque queden vacíos. Omitir una clave en
	// `package_revise` significa "dejá el valor actual": una clave ausente convierte el borrado en
	// una mentira. A diferencia de la creación, acá no hay omisión de vacíos.
	it("escribe el conjunto completo de campos que el formulario gobierna, incluso vacíos", () => {
		const { update } = buildRevisePayload({
			dataset: { id: "ds-1", metadata_modified: "2026-10-01T09:30:00.000000", extras: [] },
			input: { title: "Sólo el título", name: "solo-el-titulo" },
		});

		expect(Object.keys(update).sort()).toEqual(
			[
				"title",
				"name",
				"notes",
				"license_id",
				"url",
				"maintainer",
				"maintainer_email",
				"extras",
				"tags",
			].sort(),
		);
	});

	// 2c. Borrar un campo debe verse en el `update`: cada opcional vacío viaja como cadena vacía,
	// una aserción por campo para que el fallo diga cuál se quedó afuera.
	it("escribe cada opcional vacío como cadena vacía, para que borrar sea efectivo", () => {
		const { update } = buildRevisePayload({
			dataset: datasetCargado,
			input: {
				title: "Sólo el título",
				name: "solo-el-titulo",
				notes: "",
				license_id: "",
				url: "",
				maintainer: "",
				maintainer_email: "",
			},
		});

		expect(update.notes).toBe("");
		expect(update.license_id).toBe("");
		expect(update.url).toBe("");
		expect(update.maintainer).toBe("");
		expect(update.maintainer_email).toBe("");
	});

	// 4c. Limpiar el resumen con `""` ELIMINA la entrada, igual que la creación omite el extra
	// cuando no hay nada que decir: dejar la entrada con valor vacío sería dejar basura.
	it("elimina la entrada del resumen cuando el formulario lo limpia", () => {
		const { update } = buildRevisePayload({
			dataset: datasetCargado,
			input: { ...edicion, summary: "" },
		});

		expect(update.extras).toEqual([{ key: "frequency", value: "anual" }]);
	});

	it("trata un resumen en blanco como limpieza del resumen cargado", () => {
		const { update } = buildRevisePayload({
			dataset: datasetCargado,
			input: { ...edicion, summary: "   " },
		});

		expect(update.extras).toEqual([{ key: "frequency", value: "anual" }]);
	});

	// El formulario codifica un campo vacío como `undefined` (`formValues()`), así que un resumen
	// ausente es "el lector lo vació", no "nadie habló": también elimina la entrada.
	it("elimina la entrada del resumen cuando el formulario no lo trae", () => {
		const { update } = buildRevisePayload({
			dataset: datasetCargado,
			input: { ...edicion, summary: undefined },
		});

		expect(update.extras).toEqual([{ key: "frequency", value: "anual" }]);
	});

	// 4d. Sin extra cargado y sin resumen no hay nada que borrar ni que agregar: la lista queda
	// vacía.
	it("no crea un extra de resumen si no había extra y el resumen está vacío", () => {
		const { update } = buildRevisePayload({
			dataset: { id: "ds-1", metadata_modified: "2026-10-01T09:30:00.000000", extras: [] },
			input: { ...edicion, summary: "" },
		});

		expect(update.extras).toEqual([]);
	});

	// 4e. Sin extra cargado y con resumen no vacío se agrega un solo elemento.
	it("agrega el resumen con un solo elemento cuando el dataset no trae extras", () => {
		const { update } = buildRevisePayload({
			dataset: { id: "ds-1", metadata_modified: "2026-10-01T09:30:00.000000", extras: [] },
			input: { ...edicion, summary: "Resumen nuevo" },
		});

		expect(update.extras).toEqual([{ key: SUMMARY_EXTRA_KEY, value: "Resumen nuevo" }]);
	});

	// 4f. Las tags salen del `tag_string` que el formulario sí manda. Ausente o vacío es lista
	// vacía, y una lista vacía LIMPIA: `filter: ["-tags"]` + `update.tags = []` es la única forma
	// medida de borrarlas (un `tag_string` vacío solo no borraba nada).
	it("instala las tags del `tag_string` separadas por coma, recortadas y sin vacíos", () => {
		const { update } = buildRevisePayload({
			dataset: datasetCargado,
			input: { ...edicion, tag_string: "  matricula , , estudiantes  " },
		});

		expect(update.tags).toEqual([{ name: "matricula" }, { name: "estudiantes" }]);
	});

	it.each([
		["vacío", ""],
		["ausente", undefined],
	])("limpia las tags cuando el `tag_string` está %s", (_caso, tag_string) => {
		const { update, filter } = buildRevisePayload({
			dataset: datasetCargado,
			input: { ...edicion, tag_string },
		});

		expect(update.tags).toEqual([]);
		expect(filter).toEqual(["-extras", "-tags"]);
	});

	it("siempre pide reemplazar extras y tags con `filter`", () => {
		const { filter } = buildRevisePayload({ dataset: datasetCargado, input: edicion });

		expect(filter).toEqual(["-extras", "-tags"]);
	});

	// 5. El `match` es la precondición de concurrencia: el `metadata_modified` que se cargó con el
	// formulario, nunca uno releído.
	it("el match lleva el id y el metadata_modified cargados", () => {
		const { match } = buildRevisePayload({ dataset: datasetCargado, input: edicion });

		expect(match).toEqual({
			id: "3f2a1b0c-1111-2222-3333-444455556666",
			metadata_modified: "2026-10-01T09:30:00.000000",
		});
	});

	// La verificación es un paso **propio** del builder: ningún caller arma un `update` sin pasar
	// por ella. El cast mantiene representable lo que la red puede entregar cuando el tipo se borró.
	const fuenteCruda = (overrides: Record<string, unknown> = {}) =>
		({
			id: "3f2a1b0c-1111-2222-3333-444455556666",
			metadata_modified: "2026-10-01T09:30:00.000000",
			extras: [{ key: SUMMARY_EXTRA_KEY, value: "Resumen viejo" }],
			...overrides,
		}) as unknown as Parameters<typeof buildRevisePayload>[0]["dataset"];

	it.each([
		["metadata_modified", "revision_unavailable"],
		["extras", "extras_unavailable"],
		["id", "identity_unavailable"],
	])("rechaza `%s` inválido con `%s`, sin armar el `update`", (campo, motivo) => {
		expect(() =>
			buildRevisePayload({ dataset: fuenteCruda({ [campo]: "" }), input: edicion }),
		).toThrow(new RegExp(motivo));
	});
});

describe("buildPackagePayload — resumen (RF-40)", () => {
	it("escribe el resumen como extra del dataset", () => {
		const payload = buildPackagePayload({ ...base, summary: "  Un resumen corto  " });
		expect(payload.extras).toEqual([{ key: SUMMARY_EXTRA_KEY, value: "Un resumen corto" }]);
	});

	it("no escribe extras si no hay resumen", () => {
		expect(buildPackagePayload({ ...base }).extras).toBeUndefined();
		expect(buildPackagePayload({ ...base, summary: "   " }).extras).toBeUndefined();
	});
});

describe("toLoadedDataset — chequeo runtime antes de armar la edición", () => {
	// El chequeo tiene que ser de runtime: el tipo `CkanPackage` afirma `extras`, `id` y
	// `metadata_modified`, pero el paquete llega de la red y el tipo no sobrevive al JSON. Por eso
	// se construyen los casos inválidos con casts que el compilador no puede volver vacuos.
	const pkg = (overrides: Record<string, unknown> = {}) =>
		({
			id: "3f2a1b0c-1111-2222-3333-444455556666",
			metadata_modified: "2026-10-01T09:30:00.000000",
			extras: [{ key: "frequency", value: "anual" }],
			...overrides,
		}) as unknown as CkanPackage;

	const edicion = {
		title: "Matrícula Estudiantil 2026",
		name: "matricula-estudiantil-2026",
		summary: "Resumen editado",
	};

	it("con un paquete válido devuelve exactamente el `LoadedDataset` que el builder necesita", () => {
		const cargado = pkg();
		const result = toLoadedDataset(cargado);

		expect(result).toEqual({
			ok: true,
			dataset: {
				id: "3f2a1b0c-1111-2222-3333-444455556666",
				metadata_modified: "2026-10-01T09:30:00.000000",
				extras: [{ key: "frequency", value: "anual" }],
			},
		});
		// La lista cargada se pasa tal cual, sin copiarla ni reemplazarla.
		if (result.ok) expect(result.dataset.extras).toBe(cargado.extras);
	});

	it("con `extras: []` es válido: la lista existe y está vacía", () => {
		const result = toLoadedDataset(pkg({ extras: [] }));

		expect(result).toEqual({
			ok: true,
			dataset: {
				id: "3f2a1b0c-1111-2222-3333-444455556666",
				metadata_modified: "2026-10-01T09:30:00.000000",
				extras: [],
			},
		});
	});

	// El punto del chequeo (advisory `R3-001`): sustituir la lista ausente por [] haría que el
	// builder leyera un resumen existente como inexistente y lo agregara con `extend`, dejando dos
	// resúmenes. El rechazo no entrega `dataset`, así que ningún update —y ningún `extend`— puede
	// salir de acá.
	it.each([
		["ausente", undefined],
		["null", null],
		["no-array", { key: SUMMARY_EXTRA_KEY, value: "Resumen viejo" }],
	])("rechaza `extras` %s con `extras_unavailable`, sin sustituirlo por []", (_caso, extras) => {
		const result = toLoadedDataset(pkg({ extras }));

		expect(result).toEqual({ ok: false, reason: "extras_unavailable" });
		expect(result).not.toHaveProperty("dataset");
	});

	it.each([
		["ausente", undefined],
		["vacío", ""],
	])("rechaza `id` %s con `identity_unavailable`", (_caso, id) => {
		expect(toLoadedDataset(pkg({ id }))).toEqual({
			ok: false,
			reason: "identity_unavailable",
		});
	});

	// El `match` es la precondición de concurrencia del `package_revise`: sin `metadata_modified`
	// dejaría de afirmar nada y el aviso de conflicto desaparecería en silencio.
	it.each([
		["ausente", undefined],
		["vacío", ""],
	])("rechaza `metadata_modified` %s con `revision_unavailable`", (_caso, metadata_modified) => {
		expect(toLoadedDataset(pkg({ metadata_modified }))).toEqual({
			ok: false,
			reason: "revision_unavailable",
		});
	});

	it("la lista de extras cargada sobrevive al rechazo por identidad o revisión", () => {
		// Aunque el rechazo exista por `id`, el motivo es sólo un código: no se devuelve ni una
		// parte del dataset que un caller apurado pudiera usar para escribir.
		const sinId = toLoadedDataset(pkg({ id: "" }));
		const sinRevision = toLoadedDataset(pkg({ metadata_modified: "" }));

		expect(sinId.ok).toBe(false);
		expect(sinRevision.ok).toBe(false);
		expect(sinId).not.toHaveProperty("dataset");
		expect(sinRevision).not.toHaveProperty("dataset");
	});
});
