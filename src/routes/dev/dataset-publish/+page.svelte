<script lang="ts">
// Playground de revisión (AGENTS.md regla 8). Material temporal: no se promueve y no se commitea.
// Renderiza el componente **real** (`PublishControl.svelte`) en cada situación de la tabla D5 del
// diseño, con un dataset de fixture. Los stubs del escenario sólo sustituyen las dos llamadas que
// el componente recibe por prop; la lógica de qué ofrecer y qué reportar es la del componente.

import { RotateCcw } from "@lucide/svelte";
import { replaceState } from "$app/navigation";
import { page } from "$app/stores";
import type { DatasetApi } from "$lib/api/datasets";
import type { OrganizationApi } from "$lib/api/organizations";
import PublishControl from "$lib/components/dataset/PublishControl.svelte";
import Button from "$lib/components/ui/button/button.svelte";
import Card from "$lib/components/ui/card/card.svelte";
import { CkanApiError } from "$lib/types/api";
import type { CkanOrganization, CkanPackage } from "$lib/types/ckan";

const ORG: CkanOrganization = {
	id: "org-1",
	name: "facultad-tecnologia",
	title: "Facultad de Tecnología",
	description: "Datos de ingeniería y tecnología",
	created: "2026-01-01T00:00:00.000000",
	state: "active",
};

const OTRA_ORG: CkanOrganization = {
	...ORG,
	id: "org-2",
	name: "facultad-medicina",
	title: "Facultad de Medicina",
};

function makeFixture(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: true,
		state: "active",
		organization: ORG,
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

const FIXTURE = makeFixture();

type Escenario = {
	id: string;
	titulo: string;
	detalle: string;
	esPublico?: boolean;
	listAdminOrganizations: OrganizationApi["listForUser"];
	publish: DatasetApi["publish"];
};

const escenarios: Escenario[] = [
	{
		id: "publico",
		titulo: "1 · Dataset ya público",
		detalle:
			"No se ofrece nada: la retracción está fuera de este alcance, así que tampoco hay control para volver a privado.",
		esPublico: true,
		listAdminOrganizations: () => Promise.resolve([ORG]),
		publish: () => Promise.resolve(makeFixture({ private: false })),
	},
	{
		id: "aprobador",
		titulo: "2 · Privado · usuario aprobador",
		detalle: "Botón «Publicar dataset» con la consecuencia explícita.",
		listAdminOrganizations: () => Promise.resolve([ORG]),
		publish: () => Promise.resolve(makeFixture({ private: false })),
	},
	{
		id: "no-aprobador",
		titulo: "3 · Privado · usuario no aprobador",
		detalle:
			"Sin botón; se dice quién puede publicar. Nótese que la lista llega filtrada por «admin» pero igual se comprueba el id de la organización.",
		listAdminOrganizations: () => Promise.resolve([OTRA_ORG]),
		publish: () => Promise.reject(new Error("no debería llamarse")),
	},
	{
		id: "verificacion-fallida",
		titulo: "4 · Privado · la verificación falla",
		detalle:
			"Falla cerrada: sin botón, estado explícito y reintento. El primer reintento sí responde, para ver el paso al estado 2.",
		listAdminOrganizations: (() => {
			let intentos = 0;
			return () => {
				intentos += 1;
				return intentos === 1
					? Promise.reject(new Error("organization_list_for_user respondió 500"))
					: Promise.resolve([ORG]);
			};
		})(),
		publish: () => Promise.resolve(makeFixture({ private: false })),
	},
	{
		id: "verificando",
		titulo: "5 · Privado · verificación en curso",
		detalle:
			"Mientras la verificación no confirma nada, no hay control. Falla cerrada, no una suposición.",
		listAdminOrganizations: () => new Promise<CkanOrganization[]>(() => {}),
		publish: () => Promise.resolve(makeFixture({ private: false })),
	},
	{
		id: "rechazo-403",
		titulo: "6 · Click → CKAN 403",
		detalle:
			"Alerta de rechazo con el nombre de la capacidad faltante; el control se vuelve a ofrecer y el dataset sigue privado.",
		listAdminOrganizations: () => Promise.resolve([ORG]),
		publish: () =>
			Promise.reject(
				new CkanApiError(
					"Only an organization administrator can publish a dataset",
					403,
					"Authorization Error",
				),
			),
	},
	{
		id: "sin-confirmar",
		titulo: "7 · Click → 200 sin confirmar",
		detalle:
			"CKAN contesta 200 pero la respuesta sigue diciendo «private: true»: se dice que el catálogo no confirmó y no se muestra ningún éxito.",
		listAdminOrganizations: () => Promise.resolve([ORG]),
		publish: () => Promise.resolve(makeFixture({ private: true })),
	},
	{
		id: "confirmado",
		titulo: "8 · Click → 200 confirmado",
		detalle:
			"El estado del dataset se reemplaza por la respuesta de CKAN: la insignia de arriba pasa a «Público» y el control desaparece.",
		listAdminOrganizations: () => Promise.resolve([ORG]),
		publish: () =>
			Promise.resolve(
				makeFixture({ private: false, metadata_modified: "2026-09-14T12:00:00.000000" }),
			),
	},
	{
		id: "otro-error",
		titulo: "9 · Click → otro error",
		detalle: "Error explícito con reintento; ningún estado de éxito.",
		listAdminOrganizations: () => Promise.resolve([ORG]),
		publish: () => Promise.reject(new CkanApiError("502 Bad Gateway", 502)),
	},
	{
		id: "publicando",
		titulo: "10 · Click → en vuelo",
		detalle: "El control reporta ocupado, deshabilitado, y no anuncia nada.",
		listAdminOrganizations: () => Promise.resolve([ORG]),
		publish: () => new Promise<CkanPackage>(() => {}),
	},
];

// El escenario se puede enlazar por URL (`?e=<id>`): con diez estados, obligar a clicar cada uno hace
// la revisión lenta y no permite compartir un estado concreto.
const escenarioInicial = $derived(
	escenarios.find((item) => item.id === $page.url.searchParams.get("e")) ?? escenarios[0],
);
let escenario = $state<Escenario>(escenarioInicial);
let dataset = $state<CkanPackage>(FIXTURE);
// Remonta el componente al cambiar de escenario para descartar su estado interno.
let montaje = $state(0);

const datasetRenderizado = $derived(escenario.esPublico ? { ...dataset, private: false } : dataset);

function elegir(siguiente: Escenario) {
	escenario = siguiente;
	dataset = FIXTURE;
	montaje += 1;
	const url = new URL($page.url);
	url.searchParams.set("e", siguiente.id);
	void replaceState(url, {});
}

// `?auto=1` clica el control una vez. Los escenarios 6 a 10 sólo existen **después** del clic, así que
// sin esto no se pueden ver por URL: había que elegir el escenario y después clicar. Con el parámetro,
// cada estado es enlazable y revisable de a uno.
$effect(() => {
	// `montaje` entra a propósito como dependencia: al cambiar de escenario hay que volver a clicar.
	if ($page.url.searchParams.get("auto") !== "1" || montaje < 0) return;
	const intervalo = setInterval(() => {
		const boton = [...document.querySelectorAll("button")].find((b) =>
			/Publicar dataset/.test(b.textContent ?? ""),
		);
		if (boton && !boton.disabled) {
			clearInterval(intervalo);
			boton.click();
		}
	}, 150);
	return () => clearInterval(intervalo);
});
</script>

<svelte:head>
	<title>Playground · Publicar dataset</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-8 px-4 py-10 sm:px-6">
	<header class="space-y-2">
		<p class="text-xs font-medium uppercase tracking-wider text-destructive">
			Playground de revisión
		</p>
		<h1 class="font-heading text-3xl font-bold text-primary">Publicar dataset</h1>
		<p class="max-w-3xl text-sm leading-relaxed text-muted-foreground">
			Componente real (<code class="font-mono text-xs">PublishControl.svelte</code>) en cada
			situación de la tabla D5 del diseño. Las llamadas salen de stubs por escenario; la lógica de
			qué ofrecer y qué reportar es la del componente. Este playground no se promueve ni se
			commitea.
		</p>
	</header>

	<section class="space-y-3">
		<h2 class="font-heading text-lg font-bold text-primary">Escenario</h2>
		<div class="flex flex-wrap gap-2">
			{#each escenarios as item (item.id)}
				<button
					type="button"
					aria-pressed={escenario.id === item.id}
					class="rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors {escenario.id ===
					item.id
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border bg-card text-foreground hover:bg-accent'}"
					onclick={() => elegir(item)}
				>
					{item.titulo}
				</button>
			{/each}
		</div>
		<p class="text-sm text-muted-foreground">{escenario.detalle}</p>
	</section>

	<Card class="space-y-4 p-6">
		<div class="flex flex-wrap items-center gap-3 border-b border-border pb-4">
			<span class="font-heading text-xl font-bold text-primary">
				{datasetRenderizado.title}
			</span>
			<span class="text-xs text-muted-foreground">{datasetRenderizado.organization?.title}</span>
			<span
				class="inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold {datasetRenderizado.private
					? 'border-border bg-muted text-muted-foreground'
					: 'border-primary/20 bg-primary/10 text-primary'}"
			>
				{datasetRenderizado.private ? "Privado" : "Público"}
			</span>
			<Button variant="outline" size="sm" onclick={() => (dataset = FIXTURE)}>
				<RotateCcw class="size-4" />
				Reiniciar dataset
			</Button>
		</div>

		{#key montaje}
			<PublishControl
				dataset={datasetRenderizado}
				listAdminOrganizations={escenario.listAdminOrganizations}
				publish={escenario.publish}
				onpublished={(publicado) => (dataset = publicado)}
			/>
		{/key}

		<p class="text-xs text-muted-foreground">
			La insignia de visibilidad y el «Reiniciar dataset» son de esta página, no del componente:
			muestran que el estado sólo cambia cuando CKAN confirma la publicación.
		</p>
	</Card>
</div>
