<!--
	Hoja de revisión de la vista previa de recursos — superficie sólo para desarrollo (`/dev/preview`).

	Renderiza el **componente real** (`$lib/components/resource/ResourcePreview.svelte`) en cada tipo
	que `previewKind` puede devolver —tabla, PDF, imagen, texto y los dos estados «none»— más los tres
	estados del tipo tabla que nadie puede provocar a mano (cargando, error, sin filas). Lo que se
	aprueba acá es lo que se publica: la hoja no dibuja la vista previa, la produce el componente.

	El `datastore` de esta hoja es un **stub** con filas de fixture: el real pega contra
	`datastore_search` de CKAN, y la hoja no puede depender de que el catálogo tenga una tabla cargada.
	Las URLs de los ejemplos son **archivos locales** de `static/dev/`: en producción el `src` del
	embed es el endpoint `/download/` de CKAN, que sirve el archivo del recurso.

	Medido el 2026-09-23 (sonda D0, sobre uploads reales de CSV, PDF y PNG): ese endpoint responde
	`Content-Disposition: inline` con el `Content-Type` correcto y **sin** `X-Frame-Options`, y eso es
	exactamente lo que hace que el `<iframe>` y el `<img>` funcionen. Sin esa medición el embed sería
	una suposición; con ella, los archivos locales son un sustituto fiel.

	La ruta no existe en producción: la compuerta está en `+page.ts`. Esta hoja es permanente (como
	`/dev/copy`, `/dev/error` y `/dev/kind`) porque los tipos no se producen a mano desde el catálogo:
	los 35 recursos medidos son enlaces externos sin tabla, así que un PDF alojado, una imagen, un
	texto y los dos «none» no se consiguen navegando. Si una sesión futura la borra «para limpiar»,
	borra la herramienta, no el borrador.
-->
<script lang="ts">
import { Info } from "@lucide/svelte";
import { page } from "$app/state";
import type { DatastoreApi } from "$lib/api/datastore";
import ResourcePreview from "$lib/components/resource/ResourcePreview.svelte";
import type { CkanResource } from "$lib/types/ckan";

// `safeExternalUrl` es fail-closed: sólo acepta URLs absolutas http/https. Los ejemplos son archivos
// locales de `static/dev/`, así que se resuelven contra el origen real de la petición —el puerto
// puede cambiar y la hoja no debe mentir— en vez de contra un `localhost:5173` escrito a mano.
const sampleUrl = (file: string) => `${page.url.origin}/dev/${file}`;

// El `datastore` de la hoja no pega contra CKAN: devuelve tres filas de una tabla de ejemplo.
const datastore: DatastoreApi = {
	search: async () => ({
		fields: [
			{ id: "municipio", type: "text" },
			{ id: "anio", type: "int4" },
			{ id: "vehiculos", type: "int4" },
		],
		records: [
			{ municipio: "Cochabamba", anio: 2024, vehiculos: 184320 },
			{ municipio: "Quillacollo", anio: 2024, vehiculos: 42110 },
			{ municipio: "Sacaba", anio: 2024, vehiculos: 38950 },
		],
		total: 3,
	}),
};

// Los otros dos estados del tipo tabla, cada uno con su propio stub: uno que falla y uno vacío. No se
// pueden provocar desde la interfaz sin romper el código, que es justamente por lo que hay hoja.
const failingDatastore: DatastoreApi = {
	search: async () => {
		throw new Error("stub de la hoja de revisión");
	},
};
const emptyDatastore: DatastoreApi = {
	search: async () => ({ fields: [], records: [], total: 0 }),
};
// Nunca resuelve: congela el estado de carga para poder revisarlo.
const pendingDatastore: DatastoreApi = {
	search: () => new Promise<never>(() => undefined),
};

// Un recurso alojado (`url_type: "upload"`) por tipo. Un enlace no llega acá: `previewKind` lo manda
// a «none» antes de mirar el formato, y la página del recurso resuelve su propio estado.
const TABLE_RESOURCE: CkanResource = {
	id: "dev-preview-table",
	package_id: "pkg-dev-preview",
	name: "Matrícula 2026",
	url: "https://data.umss.edu.bo/dataset/matricula-2026/resource/tabla.csv",
	url_type: "upload",
	format: "CSV",
	datastore_active: true,
	created: "2026-09-01T00:00:00Z",
	last_modified: "2026-09-01T00:00:00Z",
	state: "active",
	position: 0,
};

const PDF_RESOURCE: CkanResource = {
	id: "dev-preview-pdf",
	package_id: "pkg-dev-preview",
	name: "Informe de movilidad 2026",
	url: sampleUrl("preview-sample.pdf"),
	url_type: "upload",
	format: "PDF",
	created: "2026-09-01T00:00:00Z",
	last_modified: "2026-09-01T00:00:00Z",
	state: "active",
	position: 0,
};

const IMAGE_RESOURCE: CkanResource = {
	id: "dev-preview-image",
	package_id: "pkg-dev-preview",
	name: "Distribución de viajes",
	url: sampleUrl("preview-sample.svg"),
	url_type: "upload",
	format: "SVG",
	created: "2026-09-01T00:00:00Z",
	last_modified: "2026-09-01T00:00:00Z",
	state: "active",
	position: 0,
};

const TEXT_RESOURCE: CkanResource = {
	id: "dev-preview-text",
	package_id: "pkg-dev-preview",
	name: "Notas metodológicas",
	url: sampleUrl("preview-sample.txt"),
	url_type: "upload",
	format: "TXT",
	created: "2026-09-01T00:00:00Z",
	last_modified: "2026-09-01T00:00:00Z",
	state: "active",
	position: 0,
};

const NONE_TABULAR_RESOURCE: CkanResource = {
	id: "dev-preview-none-tabular",
	package_id: "pkg-dev-preview",
	name: "Flujos vehiculares",
	url: "https://data.umss.edu.bo/dataset/flujos/resource/tabla.csv",
	url_type: "upload",
	format: "CSV",
	datastore_active: false,
	created: "2026-09-01T00:00:00Z",
	last_modified: "2026-09-01T00:00:00Z",
	state: "active",
	position: 0,
};

const NONE_OTHER_RESOURCE: CkanResource = {
	id: "dev-preview-none-other",
	package_id: "pkg-dev-preview",
	name: "Anexos en ZIP",
	url: "https://data.umss.edu.bo/dataset/anexos/resource/anexos.zip",
	url_type: "upload",
	format: "ZIP",
	created: "2026-09-01T00:00:00Z",
	last_modified: "2026-09-01T00:00:00Z",
	state: "active",
	position: 0,
};

interface KindCard {
	id: string;
	title: string;
	note: string;
	resource: CkanResource;
}

const KIND_CARDS: KindCard[] = [
	{
		id: "table",
		title: "Tabla — `datastore_active: true`",
		note: "El DataStore tiene la tabla: se piden 20 filas con `datastore_search`. Acá responde el stub.",
		resource: TABLE_RESOURCE,
	},
	{
		id: "pdf",
		title: "PDF — embed",
		note: "El PDF entero, en un `<iframe>` de 520px de alto con carga diferida.",
		resource: PDF_RESOURCE,
	},
	{
		id: "image",
		title: "Imagen — `<img>`",
		note: "Centrada, con altura máxima de 520px y `object-contain`: se ve completa, nunca recortada.",
		resource: IMAGE_RESOURCE,
	},
	{
		id: "text",
		title: "Texto — `<iframe>`",
		note: "TXT y JSON, en un `<iframe>` de 360px. No es un `fetch`: CKAN no manda CORS. El ejemplo usa el TXT; el JSON tiene su propio archivo en `static/dev/`.",
		resource: TEXT_RESOURCE,
	},
	{
		id: "none-tabular",
		title: "Sin vista previa — formato tabular sin tabla",
		note: "Un CSV (o XLS, XLSX, TSV, ODS) que todavía no tiene tabla cargada. La copy es la aprobada por el autor.",
		resource: NONE_TABULAR_RESOURCE,
	},
	{
		id: "none-other",
		title: "Sin vista previa — otro tipo",
		note: "Un ZIP (o DOCX, o una extensión desconocida). Esta copy es una propuesta, a revisar en esta hoja.",
		resource: NONE_OTHER_RESOURCE,
	},
];

interface TableState {
	id: string;
	title: string;
	note: string;
	datastore: DatastoreApi;
}

const TABLE_STATES: TableState[] = [
	{
		id: "loading",
		title: "Tabla — cargando",
		note: "El spinner y «Cargando vista previa…», con `aria-busy`. Es el único estado que conserva la caja alta.",
		datastore: pendingDatastore,
	},
	{
		id: "error",
		title: "Tabla — error",
		note: "`datastore_search` falla. Antes era una caja de 420px con un círculo de 64px; ahora es la nota compacta.",
		datastore: failingDatastore,
	},
	{
		id: "empty",
		title: "Tabla — sin filas",
		note: "La tabla existe pero no tiene registros. Misma densidad compacta que el error y que «none».",
		datastore: emptyDatastore,
	},
];

// La copy de todos los estados, transcrita a mano para leerla sin el ruido visual. Las tarjetas de
// arriba son la autoridad: renderizan el componente real, así que si esta lista se desvía, se ve.
const COPY_INVENTORY = [
	{
		state: "table · cargando",
		title: "—",
		detail: "Cargando vista previa…",
	},
	{
		state: "table · error",
		title: "Vista previa no disponible",
		detail: "No se pudo cargar la vista previa de datos.",
	},
	{
		state: "table · sin filas",
		title: "Sin datos",
		detail: "Este recurso aún no tiene datos cargados en la vista previa.",
	},
	{
		state: "none · formato tabular sin tabla",
		title: "Sin vista previa disponible",
		detail: "Este recurso todavía no tiene datos cargados en la vista previa del portal.",
	},
	{
		state: "none · tipo no previsualizable o URL no embebible",
		title: "Sin vista previa disponible",
		detail: "El portal no puede previsualizar este tipo de archivo. Descárguelo para verlo.",
	},
];
</script>

<svelte:head>
	<title>Hoja de revisión de la vista previa — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
		<header>
			<h1 class="font-heading text-3xl font-bold text-primary">
				Hoja de revisión de la vista previa
			</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Renderiza el componente real —<code class="font-mono text-xs"
					>src/lib/components/resource/ResourcePreview.svelte</code
				>— en cada tipo que decide <code class="font-mono text-xs">previewKind</code>: tabla, PDF,
				imagen, texto y los dos estados «none». Lo que se aprueba acá es lo que se publica.
			</p>
		</header>

		<p
			data-testid="dev-only-note"
			class="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				Página sólo para desarrollo. En producción <code class="font-mono text-xs"
					>/dev/preview</code
				> no existe (responde 404).
			</span>
		</p>

		<p
			data-testid="preview-stub-note"
			class="mt-4 flex items-start gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				El <code class="font-mono text-xs">datastore</code> de esta hoja es un
				<strong class="font-semibold text-foreground">stub</strong>: devuelve filas de fixture en
				lugar de pegarle a <code class="font-mono text-xs">datastore_search</code> en CKAN. Las URLs
				de los ejemplos son <strong class="font-semibold text-foreground">archivos locales</strong>
				de <code class="font-mono text-xs">static/dev/</code>: en producción el
				<code class="font-mono text-xs">src</code> del embed es el endpoint
				<code class="font-mono text-xs">/download/</code> de CKAN, que sirve el archivo del recurso.
			</span>
		</p>

		<section class="mt-10" data-testid="preview-kinds" aria-labelledby="kinds-heading">
			<h2 id="kinds-heading" class="font-heading text-xl font-semibold text-foreground">
				Un tipo por tarjeta
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Lo que <code class="font-mono text-xs">previewKind</code> devuelve para un archivo alojado.
				El estado «none» tiene dos textos según el formato: uno para el tabular que todavía no tiene
				tabla, otro para el tipo que el portal no previsualiza.
			</p>

			<div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
				{#each KIND_CARDS as card (card.id)}
					<article
						data-testid={`preview-card-${card.id}`}
						class="overflow-hidden rounded-lg border border-border bg-card"
					>
						<div class="border-b border-border bg-muted/40 px-4 py-3">
							<h3 class="font-heading text-sm font-semibold text-card-foreground">
								{card.title}
							</h3>
							<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{card.note}</p>
						</div>
						<ResourcePreview resource={card.resource} datastore={datastore} />
					</article>
				{/each}
			</div>
		</section>

		<section class="mt-12" data-testid="preview-table-states" aria-labelledby="states-heading">
			<h2 id="states-heading" class="font-heading text-xl font-semibold text-foreground">
				Los estados del tipo tabla
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Cargando, error y sin filas no se provocan desde la interfaz sin romper el código, y por eso
				están acá: cada uno con su propio stub. El error y «sin filas» son los que cambiaron de
				densidad —caja compacta, sin el círculo de 64px— y esta es la superficie donde se aprueba.
			</p>

			<div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
				{#each TABLE_STATES as state (state.id)}
					<article
						data-testid={`preview-state-${state.id}`}
						class="overflow-hidden rounded-lg border border-border bg-card"
					>
						<div class="border-b border-border bg-muted/40 px-4 py-3">
							<h3 class="font-heading text-sm font-semibold text-card-foreground">
								{state.title}
							</h3>
							<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{state.note}</p>
						</div>
						<ResourcePreview resource={TABLE_RESOURCE} datastore={state.datastore} />
					</article>
				{/each}
			</div>
		</section>

		<section class="mt-12" data-testid="preview-none-compare" aria-labelledby="compare-heading">
			<h2 id="compare-heading" class="font-heading text-xl font-semibold text-foreground">
				Los dos «none», lado a lado
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				La comparación que el autor tiene que aprobar: el mismo componente, dos textos. El de la
				izquierda ya está aprobado; el de la derecha es una propuesta.
			</p>

			<div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
				<div class="overflow-hidden rounded-lg border border-border bg-card">
					<div class="border-b border-border bg-muted/40 px-4 py-3">
						<h3 class="font-heading text-sm font-semibold text-card-foreground">
							Formato tabular sin tabla (aprobado)
						</h3>
						<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
							CSV, XLS, XLSX, TSV y ODS: el DataPusher todavía no cargó la tabla, así que puede
							llegar.
						</p>
					</div>
					<ResourcePreview resource={NONE_TABULAR_RESOURCE} datastore={datastore} />
				</div>

				<div class="overflow-hidden rounded-lg border border-border bg-card">
					<div class="border-b border-border bg-muted/40 px-4 py-3">
						<h3 class="font-heading text-sm font-semibold text-card-foreground">
							Otro tipo (propuesta)
						</h3>
						<p class="mt-1 text-xs leading-relaxed text-muted-foreground">
							ZIP, DOCX o una extensión desconocida: el portal no puede mostrarlo.
						</p>
					</div>
					<ResourcePreview resource={NONE_OTHER_RESOURCE} datastore={datastore} />
				</div>
			</div>
		</section>

		<section class="mt-12" data-testid="preview-copy" aria-labelledby="copy-heading">
			<h2 id="copy-heading" class="font-heading text-xl font-semibold text-foreground">
				Toda la copy, como texto
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				La redacción de cada estado, para revisarla sin el ruido visual. Esta tabla está transcrita
				a mano; las tarjetas de arriba renderizan el componente real y son la autoridad.
			</p>

			<div class="mt-4 overflow-x-auto rounded-lg border border-border">
				<table class="w-full border-collapse text-left text-sm">
					<thead>
						<tr class="border-b border-border bg-muted/50">
							<th scope="col" class="px-4 py-2.5 font-semibold text-foreground">Estado</th>
							<th scope="col" class="px-4 py-2.5 font-semibold text-foreground">
								Línea principal
							</th>
							<th scope="col" class="px-4 py-2.5 font-semibold text-foreground">
								Línea explicativa
							</th>
						</tr>
					</thead>
					<tbody>
						{#each COPY_INVENTORY as line (line.state)}
							<tr class="border-b border-border/60 last:border-0">
								<td class="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
									{line.state}
								</td>
								<td class="px-4 py-2 text-foreground">{line.title}</td>
								<td class="px-4 py-2 text-muted-foreground">{line.detail}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>

		<p
			class="mt-12 max-w-3xl rounded-lg border border-border bg-muted px-4 py-3 text-sm leading-relaxed text-muted-foreground"
		>
			La hoja se queda: es una herramienta permanente, como <code class="font-mono text-xs"
				>/dev/copy</code
			>, <code class="font-mono text-xs">/dev/error</code> y <code class="font-mono text-xs"
				>/dev/kind</code
			>. Los tipos de la vista previa no se pueden producir a mano desde el catálogo —el catálogo
			medido no tiene ni un archivo alojado con tabla— y además renderiza el componente real, así que
			no se desincroniza: si la vista previa cambia, esta hoja lo muestra.
		</p>
	</div>
</div>
