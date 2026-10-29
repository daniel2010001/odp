// Reglas puras del listado de organizaciones (`/organizations`, S25 de `odd/tasks/prototype-presentation.md`):
// búsqueda, cantidades por tipo, grupos y jerarquía. Sólo leen lo que el catálogo entrega: el tipo se deduce
// del título (`orgTypeOf`, Q11), la sigla es el extra `sigla` (Q13) y la dependencia, los grupos en los que
// está la organización (Q6).

import type { ListedOrganization } from "$lib/api/organizations";
import {
	ORG_TYPES,
	type OrgType,
	type OrgTypeInfo,
	orgTypeOf,
} from "$lib/components/organizations/org-type";
import { sortByLabel } from "$lib/utils/collate";

export interface DirectoryOrg {
	org: ListedOrganization;
	type: OrgType;
	count: number;
	acronym?: string;
	updated?: string;
}

export function toDirectoryOrg(
	org: ListedOrganization,
	updates: Map<string, string>,
): DirectoryOrg {
	return {
		org,
		type: orgTypeOf(org.title || ""),
		count: org.package_count ?? 0,
		acronym: org.extras?.find((extra) => extra.key === "sigla")?.value?.trim() || undefined,
		updated: updates.get(org.name),
	};
}

function fold(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

/** Busca por nombre, sigla o descripción, sin distinguir acentos ni mayúsculas. */
export function matchesQuery(item: DirectoryOrg, query: string): boolean {
	const needle = fold(query.trim());
	if (needle === "") return true;
	return [item.org.title || item.org.name, item.acronym ?? "", item.org.description ?? ""].some(
		(field) => fold(field).includes(needle),
	);
}

/** Cantidad por tipo de `items`, para cada tipo presente en `present`, en el orden institucional. */
export function typeCounts(
	items: DirectoryOrg[],
	present: DirectoryOrg[],
): { type: OrgTypeInfo; count: number }[] {
	return ORG_TYPES.filter((type) => present.some((item) => item.type === type.id)).map((type) => ({
		type,
		count: items.filter((item) => item.type === type.id).length,
	}));
}

function sortByTitle(items: DirectoryOrg[]): DirectoryOrg[] {
	return sortByLabel(
		items,
		(item) => item.org.title || item.org.name,
		(item) => item.org.name,
	);
}

/** Grupos por tipo, en el orden institucional; cada grupo, alfabético. Los grupos vacíos no aparecen. */
export function groupByType(items: DirectoryOrg[]): { type: OrgTypeInfo; items: DirectoryOrg[] }[] {
	return ORG_TYPES.map((type) => ({
		type,
		items: sortByTitle(items.filter((item) => item.type === type.id)),
	})).filter((group) => group.items.length > 0);
}

export interface OrgLink {
	name: string;
	title: string;
}

function linkOf(org: ListedOrganization): OrgLink {
	return { name: org.name, title: org.title || org.name };
}

/** La organización de la que depende, si el catálogo lo declara y está en el listado. */
export function parentOf(item: DirectoryOrg, all: DirectoryOrg[]): OrgLink | undefined {
	for (const group of item.org.groups ?? []) {
		const parent = all.find((candidate) => candidate.org.name === group.name);
		if (parent) return linkOf(parent.org);
	}
	return undefined;
}

export function dependentsOf(item: DirectoryOrg, all: DirectoryOrg[]): OrgLink[] {
	return sortByTitle(
		all.filter((candidate) =>
			(candidate.org.groups ?? []).some((group) => group.name === item.org.name),
		),
	).map((candidate) => linkOf(candidate.org));
}
