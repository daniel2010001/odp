// El tipo de una organización (Q11 de `design-system/datos-umss/preguntas-abiertas.md`).
//
// Mientras la organización no tenga su campo propio, el tipo se **deduce del título** con esta regla, que
// es la que la tarjeta usó siempre. Vive en un solo lugar para que la tarjeta, los grupos y el filtro de
// `/organizations` digan lo mismo; cuando el campo exista, se lee acá y el resto no cambia.

export type OrgType = "rectorado" | "facultad" | "direccion" | "instituto" | "unidad";

export interface OrgTypeInfo {
	id: OrgType;
	/** Rótulo de la tarjeta y del filtro. */
	label: string;
	/** Encabezado del grupo. */
	plural: string;
}

/**
 * Orden institucional, no alfabético: es una escala de dominio fija (README §11 bis) — el Rectorado
 * arriba y, al final, las unidades que la regla del título no clasifica.
 */
export const ORG_TYPES: readonly OrgTypeInfo[] = [
	{ id: "rectorado", label: "Rectorado", plural: "Rectorado" },
	{ id: "facultad", label: "Facultad", plural: "Facultades" },
	{ id: "direccion", label: "Dirección", plural: "Direcciones" },
	{ id: "instituto", label: "Instituto", plural: "Institutos y centros" },
	{ id: "unidad", label: "Unidad", plural: "Otras unidades" },
];

/** El tipo deducido del título. El orden de las preguntas es la regla: «facultad» gana. */
export function orgTypeOf(title: string): OrgType {
	const t = title.toLowerCase();
	if (t.includes("facultad")) return "facultad";
	if (t.includes("rectorado")) return "rectorado";
	if (t.includes("dirección") || t.includes("direccion")) return "direccion";
	if (t.includes("instituto") || t.includes("centro")) return "instituto";
	return "unidad";
}

export function orgTypeInfo(type: OrgType): OrgTypeInfo {
	return ORG_TYPES.find((info) => info.id === type) ?? ORG_TYPES[ORG_TYPES.length - 1];
}
