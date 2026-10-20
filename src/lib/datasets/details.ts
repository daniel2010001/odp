// Qué muestra la ficha de un dataset: el «Resumen» del sidebar y los grupos de «Información técnica».
// Un dato que el catálogo no tiene no se inventa: su fila se omite, y un grupo sin filas no se rinde.

import { Clock, RefreshCw, Shield, User } from "@lucide/svelte";
import type { MetaGroupData, MetaRow } from "$lib/components/ui/meta";
import type { CkanPackage } from "$lib/types/ckan";
import { formatDate } from "$lib/utils/ckan";

export interface SummaryFact {
	key: string;
	label: string;
	value: string;
	icon: typeof User;
}

const FREQUENCY = "Frecuencia de actualización";
const STATE: Record<string, string> = { active: "Activo", draft: "Borrador", deleted: "Eliminado" };

const extra = (d: CkanPackage, key: string) => d.extras?.find((e) => e.key === key)?.value;
const license = (d: CkanPackage) => d.license_title || d.license_id;

const row = (
	label: string,
	value: string | undefined,
	options: { copy?: string; mono?: boolean } = {},
): MetaRow[] => (value ? [{ label, value, ...options }] : []);

/** El resumen responde «¿me sirve esto?»: quién lo mantiene, cada cuánto, desde cuándo, con qué licencia. */
export function summaryFacts(d: CkanPackage): SummaryFact[] {
	const owner = d.maintainer || d.author || d.organization?.title;
	const frequency = extra(d, FREQUENCY);
	const licence = license(d);
	return [
		owner ? { key: "owner", label: "Lo mantiene", value: owner, icon: User } : null,
		frequency
			? { key: "frequency", label: "Se actualiza", value: frequency, icon: RefreshCw }
			: null,
		{
			key: "modified",
			label: "Última actualización",
			value: formatDate(d.metadata_modified),
			icon: Clock,
		},
		licence ? { key: "license", label: "Licencia", value: licence, icon: Shield } : null,
	].filter((f): f is SummaryFact => f !== null);
}

/** Todos los campos del dataset, agrupados por la pregunta que responden. Sólo los grupos con filas. */
export function technicalGroups(d: CkanPackage): MetaGroupData[] {
	const groups: MetaGroupData[] = [
		{
			id: "responsables",
			title: "Responsables",
			rows: [
				...row("Autor", d.author),
				...row("Correo del autor", d.author_email, { copy: "Copiar correo del autor" }),
				...row("Mantenedor", d.maintainer),
				...row("Correo del mantenedor", d.maintainer_email, {
					copy: "Copiar correo del mantenedor",
				}),
			],
		},
		{
			id: "fechas",
			title: "Fechas y versión",
			rows: [
				...row("Creado", formatDate(d.metadata_created)),
				...row("Modificado", formatDate(d.metadata_modified)),
				...row("Versión", d.version),
				...row(FREQUENCY, extra(d, FREQUENCY)),
			],
		},
		{
			id: "condiciones",
			title: "Condiciones y estado",
			rows: [
				...row("Licencia", license(d)),
				...row("Visibilidad", d.private ? "Privado" : "Público"),
				...row("Estado", STATE[d.state]),
			],
		},
		{
			id: "origen",
			title: "Origen y cobertura",
			rows: [
				...row("Sitio de origen", d.url, { copy: "Copiar sitio de origen" }),
				...row("Cobertura geográfica", extra(d, "Cobertura geográfica")),
				...row("Cobertura temporal", extra(d, "Cobertura temporal")),
			],
		},
		{
			id: "identificadores",
			title: "Identificadores",
			rows: [
				...row("Dirección web", d.name, { copy: "Copiar dirección web", mono: true }),
				...row("Identificador", d.id, { copy: "Copiar identificador", mono: true }),
			],
		},
	];
	return groups.filter((g) => g.rows.length > 0);
}
