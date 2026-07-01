// Utilidades para formatear citas de datasets
// Estándares: DataCite + CSL (Citation Style Language) + FORCE11 Joint Declaration

import type { CkanPackage } from "$lib/types/ckan";

// ─── Helpers ────────────────────────────────────────────────────────

/** Extraer el año de una fecha ISO (YYYY-MM-DD o full ISO) */
function getYear(iso?: string): number | null {
	if (!iso) return null;
	const year = parseInt(iso.substring(0, 4), 10);
	return Number.isFinite(year) ? year : null;
}

/** Formatear nombre de autor: "Juan Pérez" -> "Pérez, J." para APA */
function formatAuthorAPA(name?: string): string | null {
	if (!name) return null;
	const parts = name.trim().split(/\s+/);
	if (parts.length === 0) return null;
	if (parts.length === 1) return parts[0];

	const lastName = parts[parts.length - 1];
	const initials = parts
		.slice(0, -1)
		.map((p) => `${p[0].toUpperCase()}.`)
		.join(" ");
	return `${lastName}, ${initials}`;
}

/** Escapar caracteres especiales LaTeX para BibTeX */
function escapeBibTeX(text: string): string {
	return text
		.replace(/\\/g, "\\textbackslash{}")
		.replace(/[{}]/g, "\\$&")
		.replace(/&/g, "\\&")
		.replace(/%/g, "\\%")
		.replace(/\$/g, "\\$")
		.replace(/#/g, "\\#")
		.replace(/_/g, "\\_")
		.replace(/~/g, "\\textasciitilde{}")
		.replace(/\^/g, "\\textasciicircum{}");
}

/** Construir URL canónica del dataset */
function buildDatasetUrl(dataset: CkanPackage, baseUrl = "https://datos.umss.edu"): string {
	return `${baseUrl}/dataset/${dataset.name}`;
}

// ─── APA 7 ──────────────────────────────────────────────────────────

/**
 * Formatear cita en APA 7
 * @see https://apastyle.apa.org/style-grammar-guidelines/references/data-sets
 *
 * Formato:
 * Author, A. A. (Year). Title of dataset (Version x.x) [Data set]. Publisher. URL
 */
export function formatCitationAPA(dataset: CkanPackage): string {
	const author =
		formatAuthorAPA(dataset.author) ||
		dataset.organization?.title ||
		"Universidad Mayor de San Simón";
	const year = getYear(dataset.metadata_created) ?? new Date().getFullYear();
	const title = dataset.title || dataset.name;
	const version = dataset.version ? ` (Version ${dataset.version})` : "";
	const publisher = dataset.organization?.title
		? `Universidad Mayor de San Simón, ${dataset.organization.title}`
		: "Universidad Mayor de San Simón";
	const url = buildDatasetUrl(dataset);

	return `${author} (${year}). ${title}${version} [Data set]. ${publisher}. ${url}`;
}

// ─── BibTeX ─────────────────────────────────────────────────────────

/**
 * Formatear cita en BibTeX
 * @see https://www.bibtex.com/format/
 *
 * @type dataset
 * @key autor_anio_slug
 */
export function formatCitationBibTeX(dataset: CkanPackage): string {
	const author = dataset.author || "Universidad Mayor de San Simón";
	const year = getYear(dataset.metadata_created) ?? new Date().getFullYear();
	const title = dataset.title || dataset.name;
	const version = dataset.version || "1.0";
	const publisher = dataset.organization?.title
		? `Universidad Mayor de San Simón, ${dataset.organization.title}`
		: "Universidad Mayor de San Simón";
	const url = buildDatasetUrl(dataset);

	// Construir key única: apellido + año + primera palabra del título
	const authorKey = author.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
	const titleKey = title
		.split(/\s+/)[0]
		.toLowerCase()
		.replace(/[^a-z]/g, "");
	const key = `${authorKey}${year}${titleKey}`;

	const fields = [
		`@dataset{${key},`,
		`  author    = {${escapeBibTeX(author)}},`,
		`  title     = {${escapeBibTeX(title)}},`,
		`  year      = {${year}},`,
		`  version   = {${escapeBibTeX(version)}},`,
		`  publisher = {${escapeBibTeX(publisher)}},`,
		`  url       = {${url}},`,
		`  note      = {Data set}`,
		"}",
	];

	return fields.join("\n");
}

// ─── Clipboard ──────────────────────────────────────────────────────

/**
 * Copiar texto al portapapeles.
 * Retorna Promise<boolean> indicando éxito.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		if (navigator?.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
		// Fallback para entornos sin clipboard API
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.style.position = "fixed";
		textarea.style.opacity = "0";
		document.body.appendChild(textarea);
		textarea.select();
		const ok = document.execCommand("copy");
		document.body.removeChild(textarea);
		return ok;
	} catch {
		return false;
	}
}

// ─── Formato "natural" / human-readable ────────────────────────────

/**
 * Cita en formato natural para mostrar al usuario (no académica)
 * Ej: "Universidad Mayor de San Simón, Facultad de Medicina. (2026). Indicadores de salud pública 2020-2024. Datos UMSS."
 */
export function formatCitationNatural(dataset: CkanPackage): string {
	const org = dataset.organization?.title
		? `Universidad Mayor de San Simón, ${dataset.organization.title}`
		: "Universidad Mayor de San Simón";
	const year = getYear(dataset.metadata_created) ?? new Date().getFullYear();
	const title = dataset.title || dataset.name;
	return `${org}. (${year}). ${title}. Datos UMSS.`;
}
