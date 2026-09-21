// Tests de contrato de la copia del estado vacío del dashboard.
//
// La copia de los cuatro estados vive en `$lib/copy/dashboard` y no dentro de la página para que la
// hoja de revisión de copia (`/dev/copy`) pueda mostrar **exactamente** lo que la aplicación
// renderiza. Si la hoja repitiera las cadenas a mano, podría aprobarse un texto que nunca se publica.
// Estos tests fijan las cadenas literales y la precedencia entre banderas; el orden importa porque
// es el de la cadena de `{#if}` que esta extracción reemplaza.

import { describe, expect, it } from "vitest";
import {
	EMPTY_STATE_BASE_MESSAGE,
	EMPTY_STATE_HEADING,
	EMPTY_STATE_NO_CREATE_PERMISSION_REQUIREMENT,
	EMPTY_STATE_NO_ORGANIZATION_REQUIREMENT,
	EMPTY_STATE_PRIMARY_ACTION_LABEL,
	emptyStateMessage,
} from "./dashboard";

const BASE = "Aún no ha creado ningún dataset. El asistente lo guía paso a paso.";
const ORG = "Publicar un dataset requiere pertenecer a una organización.";
const PERM = "Publicar un dataset requiere rol de editor o administrador en una organización.";

describe("emptyStateMessage — la copia del estado vacío de «Mis datasets»", () => {
	it("con permiso para publicar enuncia sólo el paso a paso", () => {
		expect(
			emptyStateMessage({
				canPublish: true,
				confirmedNoOrganizations: false,
				confirmedNoCreatePermission: false,
			}),
		).toBe(BASE);
	});

	it("con la lista de organizaciones terminada, sin error y vacía agrega el requisito de pertenecer a una", () => {
		expect(
			emptyStateMessage({
				canPublish: false,
				confirmedNoOrganizations: true,
				confirmedNoCreatePermission: false,
			}),
		).toBe(`${BASE} ${ORG}`);
	});

	it("con organizaciones pero sin pregunta de permiso respondida conserva la copia neutra", () => {
		expect(
			emptyStateMessage({
				canPublish: false,
				confirmedNoOrganizations: false,
				confirmedNoCreatePermission: false,
			}),
		).toBe(BASE);
	});

	it("con el permiso de creación respondido y negado nombra el rol de editor o administrador", () => {
		expect(
			emptyStateMessage({
				canPublish: false,
				confirmedNoOrganizations: false,
				confirmedNoCreatePermission: true,
			}),
		).toBe(`${BASE} ${PERM}`);
	});

	it("resuelve la precedencia en el orden de la cadena original: publicar, organizaciones, permiso", () => {
		// Con varias banderas verdaderas a la vez gana la primera de la cadena. Hoy las banderas son
		// mutuamente excluyentes por construcción; este test fija el orden por si una refactorización
		// las vuelve combinables.
		expect(
			emptyStateMessage({
				canPublish: true,
				confirmedNoOrganizations: true,
				confirmedNoCreatePermission: true,
			}),
		).toBe(BASE);
		expect(
			emptyStateMessage({
				canPublish: false,
				confirmedNoOrganizations: true,
				confirmedNoCreatePermission: true,
			}),
		).toBe(`${BASE} ${ORG}`);
	});

	it("mantiene las cadenas literales y la identidad entre «puede publicar» y el relleno neutro", () => {
		expect(BASE).toBe(EMPTY_STATE_BASE_MESSAGE);
		expect(ORG).toBe(EMPTY_STATE_NO_ORGANIZATION_REQUIREMENT);
		expect(PERM).toBe(EMPTY_STATE_NO_CREATE_PERMISSION_REQUIREMENT);
		// Tres oraciones distintas para cuatro estados: publicar y el relleno dicen lo mismo.
		expect(
			emptyStateMessage({
				canPublish: true,
				confirmedNoOrganizations: false,
				confirmedNoCreatePermission: false,
			}),
		).toBe(
			emptyStateMessage({
				canPublish: false,
				confirmedNoOrganizations: false,
				confirmedNoCreatePermission: false,
			}),
		);
	});

	it("exporta el encabezado y la etiqueta del llamado a la acción que sólo se renderizan en ese bloque", () => {
		expect(EMPTY_STATE_HEADING).toBe("Publique su primer dataset");
		expect(EMPTY_STATE_PRIMARY_ACTION_LABEL).toBe("Publicar dataset");
	});
});
