<!--
	Hoja de revisión de copia — superficie sólo para desarrollo (`/dev/copy`).

	Muestra en un solo lugar el texto de los estados del portal para revisarlo sin reproducir cada
	situación a mano. La restricción que la hace útil: **cada cadena sale del módulo que la produce**,
	llamado desde acá (`describeFailure`, `failureActions`, `emptyStateMessage`). Nunca se copia el
	texto: una hoja que lo repite a mano puede mostrar algo que la aplicación no renderiza y el autor
	aprobaría algo que no se publica. `dev-copy.test.ts` fija esa propiedad.

	La ruta no existe en producción: la compuerta está en `+page.ts`. Esta hoja es permanente y no un
	borrador para borrar al promover una página (ver el comentario de `+page.ts`).
-->
<script lang="ts">
import { Info, TriangleAlert } from "@lucide/svelte";
import {
	type AccessContext,
	type ApiFailureKind,
	type ApiSubject,
	describeFailure,
	type FailureActions,
	failureActions,
} from "$lib/api/failure";
import {
	EMPTY_STATE_HEADING,
	EMPTY_STATE_PRIMARY_ACTION_LABEL,
	type EmptyStateFlags,
	emptyStateMessage,
} from "$lib/copy/dashboard";
import {
	SESSION_EXPIRED_MESSAGE,
	SESSION_EXPIRED_PARAM,
	sessionExpiredLoginUrl,
} from "$lib/session";
import { CkanApiError } from "$lib/types/api";

// ─── Estados de fallo ────────────────────────────────────────────
// Los fallos de ejemplo son los mínimos que producen cada clase: 0 (sin respuesta) para
// `unavailable`, 404 y 403. El texto no depende del mensaje del error, sólo de la clase.
interface FailureSituation {
	kind: ApiFailureKind;
	access: AccessContext;
	error: unknown;
	/** La situación en palabras, para que el revisor sepa qué está leyendo. */
	condition: string;
	/** Por qué esta combinación no se puede provocar desde el navegador; `null` si sí se puede. */
	manualNote: string | null;
}

/**
 * Las cinco combinaciones alcanzables por sujeto.
 *
 * La sonda de sesión sólo corre ante un `403` con token: `unavailable` y `not-found` nunca llegan
 * con un contexto identificado (el espectador sin sesión no alcanza la rama inconclusa), así que
 * esas filas no se inventan acá. Ver `src/lib/session-guard.ts` y
 * `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`.
 */
const FAILURE_SITUATIONS: FailureSituation[] = [
	{
		kind: "unavailable",
		access: "anonymous",
		error: new CkanApiError("Sin respuesta del catálogo", 0),
		condition:
			"El catálogo no respondió: conexión caída, timeout del cliente, cualquier 5xx o un valor lanzado que no es una respuesta de CKAN. El espectador puede o no tener sesión; el texto es el mismo.",
		manualNote: null,
	},
	{
		kind: "not-found",
		access: "anonymous",
		error: new CkanApiError("Not Found", 404),
		condition: "El identificador solicitado no existe y el espectador no tiene sesión.",
		manualNote: null,
	},
	{
		kind: "unauthorized",
		access: "anonymous",
		error: new CkanApiError("Access denied", 403),
		condition:
			"El ítem es privado —o no existe— y el espectador no tiene sesión. Es la única oración con la que el portal no distingue las dos lecturas, a propósito: distinguirlas filtraría la existencia de un ítem privado.",
		manualNote: null,
	},
	{
		kind: "unauthorized",
		access: "session-alive",
		error: new CkanApiError("Access denied", 403),
		condition:
			"El espectador tiene una sesión válida, pero su cuenta no está autorizada para ver este ítem.",
		manualNote: null,
	},
	{
		kind: "unauthorized",
		access: "unknown",
		error: new CkanApiError("Access denied", 403),
		condition:
			"La sonda de sesión no pudo decidir: la respuesta al sondeo de la sesión fue un fallo (5xx, timeout, red) o la navegación de expulsión falló. El texto cubre las dos lecturas sin afirmar ninguna.",
		manualNote:
			"No se puede reproducir a mano. No depende de lo que se haga en el navegador: la sonda tiene que quedar sin resolver por sí sola. Es el estado que motiva esta hoja.",
	},
];

interface FailureSubjectEntry {
	subject: ApiSubject;
	label: string;
	where: string;
}

const FAILURE_SUBJECTS: FailureSubjectEntry[] = [
	{
		subject: "resource",
		label: "Recurso",
		where:
			"Se renderiza en el estado de error de la página de recurso (`src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`).",
	},
	{
		subject: "dataset",
		label: "Dataset",
		where:
			"Se renderiza en el estado de error de la página de dataset (`src/routes/dataset/[id]/+page.svelte`).",
	},
];

/** Etiqueta de cada acción que `failureActions` puede ofrecer. `Record` obliga a etiquetar toda acción nueva. */
const ACTION_LABEL: Record<keyof FailureActions, string> = {
	retry: "Reintentar",
};

function actionLabels(actions: FailureActions): string[] {
	return (Object.keys(actions) as (keyof FailureActions)[])
		.filter((name) => actions[name])
		.map((name) => ACTION_LABEL[name]);
}

const KIND_LABEL: Record<ApiFailureKind, string> = {
	unauthorized: "Sin autorización (403)",
	"not-found": "No encontrado (404)",
	unavailable: "Catálogo inalcanzable (sin respuesta, timeout o 5xx)",
};

const ACCESS_LABEL: Record<AccessContext, string> = {
	anonymous: "Sin sesión",
	"session-alive": "Con sesión válida",
	unknown: "Sesión sin confirmar (sonda inconclusa)",
};

// Cada fila se arma llamando a los módulos, no escribiendo sus cadenas.
const failureRows = FAILURE_SUBJECTS.flatMap((entry) =>
	FAILURE_SITUATIONS.map((situation) => {
		const presentation = describeFailure(situation.error, entry.subject, situation.access);
		return {
			entry,
			situation,
			presentation,
			actions: actionLabels(failureActions(presentation, situation.access)),
		};
	}),
);

// ─── Estado vacío del panel ──────────────────────────────────────
// Cuatro estados, tres oraciones: «puede crear» y el relleno neutro dicen lo mismo.
const EMPTY_STATE_CASES: {
	id: string;
	label: string;
	condition: string;
	flags: EmptyStateFlags;
}[] = [
	{
		id: "can-create",
		label: "Puede crear (permiso afirmativo)",
		condition:
			"El usuario puede crear: la pregunta de permiso se resolvió y fue afirmativa. El llamado a la acción «Crear dataset» aparece sólo en esta variante.",
		flags: {
			canCreate: true,
			confirmedNoOrganizations: false,
			confirmedNoCreatePermission: false,
		},
	},
	{
		id: "no-organizations",
		label: "No pertenece a ninguna organización",
		condition:
			"El usuario no pertenece a ninguna organización: la lista terminó de cargar, sin error y vacía.",
		flags: {
			canCreate: false,
			confirmedNoOrganizations: true,
			confirmedNoCreatePermission: false,
		},
	},
	{
		id: "no-create-permission",
		label: "Sin permiso de creación en su organización",
		condition:
			'El usuario pertenece a organizaciones, la pregunta de permiso se respondió y fue negativa. No se puede producir a mano: exige una sesión autenticada a la que le falte el permiso de creación (medido: una membresía `capacity: "member"` figura en `organization_list_for_user {}` pero no en `{permission: "create_dataset"}`).',
		flags: {
			canCreate: false,
			confirmedNoOrganizations: false,
			confirmedNoCreatePermission: true,
		},
	},
	{
		id: "neutral",
		label: "Pregunta abierta (relleno neutro)",
		condition:
			"Pregunta abierta: las organizaciones siguen cargando, la carga falló, o la pregunta de permiso quedó sin responder. La copia no afirma nada sobre el requisito, y por eso dice lo mismo que la variante de «puede crear».",
		flags: {
			canCreate: false,
			confirmedNoOrganizations: false,
			confirmedNoCreatePermission: false,
		},
	},
];

/**
 * Las banderas que producen una variante, leídas del mismo objeto que recibe el selector: así la
 * etiqueta no puede mentir sobre la combinación que el revisor está leyendo.
 */
function flagSummary(flags: EmptyStateFlags): string {
	return Object.entries(flags)
		.map(([name, value]) => `${name}=${value}`)
		.join(" · ");
}
</script>

<svelte:head>
	<title>Hoja de revisión de copia — UMSS</title>
</svelte:head>

<div class="min-h-screen bg-background font-sans text-foreground">
	<div class="mx-auto max-w-4xl px-4 py-10 sm:px-6">
		<header>
			<h1 class="font-heading text-3xl font-bold text-primary">Hoja de revisión de copia</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Reúne el texto que el portal renderiza en sus estados para revisarlo sin reproducir cada
				situación a mano. Cada cadena se obtiene llamando al módulo que la produce
				(<code class="font-mono text-xs">describeFailure</code>,
				<code class="font-mono text-xs">failureActions</code>,
				<code class="font-mono text-xs">emptyStateMessage</code>): lo que se lee acá es lo que se
				publica. La prueba <code class="font-mono text-xs">dev-copy.test.ts</code> falla si esta hoja
				deja de usar esos módulos.
			</p>
		</header>

		<p
			data-testid="dev-only-note"
			class="mt-6 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
		>
			<Info class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
			<span>
				Página sólo para desarrollo. En producción <code class="font-mono text-xs">/dev/copy</code
				> no existe (responde 404), y por eso se mantiene: hay estados —los marcados abajo— que no se
				pueden provocar desde el navegador.
			</span>
		</p>

		<!-- ─── 1. Estados de fallo ─────────────────────────────────── -->
		<section class="mt-10">
			<h2 class="font-heading text-2xl font-semibold text-foreground">Estados de fallo del catálogo</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				La tabla de textos y la clasificación viven en
				<code class="font-mono text-xs">src/lib/api/failure.ts</code>. Se listan las combinaciones que
				el portal puede alcanzar de verdad: la sonda de sesión sólo corre ante un 403 con token, así
				que un espectador sin sesión nunca llega al contexto sin confirmar.
			</p>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Las acciones acompañan al estado, y su ausencia es parte de la política: no hay acción de
				iniciar sesión, porque ofrecerla en el estado de error confirmaría que el recurso existe. El
				camino al login vive en el encabezado de la aplicación.
			</p>

			{#each FAILURE_SUBJECTS as subjectEntry (subjectEntry.subject)}
				<h3 class="mt-8 font-heading text-xl font-semibold text-primary">
					Sujeto: {subjectEntry.label}
				</h3>
				<p class="mt-1 text-xs text-muted-foreground">{subjectEntry.where}</p>

				<div class="mt-4 space-y-4">
					{#each failureRows.filter((row) => row.entry.subject === subjectEntry.subject) as row (row.situation.kind + row.situation.access)}
						<article
							data-testid={`failure-${subjectEntry.subject}-${row.situation.kind}-${row.situation.access}`}
							class="rounded-lg border border-border bg-card p-4"
						>
							<div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
								<h4 class="font-heading text-lg font-semibold text-card-foreground">
									{KIND_LABEL[row.situation.kind]} · {ACCESS_LABEL[row.situation.access]}
								</h4>
								<p class="font-mono text-xs text-muted-foreground">
									{row.situation.kind} / {row.situation.access}
								</p>
							</div>

							<p class="mt-1 text-sm leading-relaxed text-muted-foreground">
								{row.situation.condition}
							</p>

							<div class="mt-3 space-y-2">
								<p
									class="rounded-md border border-border bg-muted px-3 py-2 font-heading text-base text-card-foreground"
								>
									{row.presentation.title}
								</p>
								<p
									class="rounded-md border border-border bg-muted px-3 py-2 text-sm leading-relaxed text-card-foreground"
								>
									{row.presentation.message}
								</p>
							</div>

							<p class="mt-3 text-xs text-muted-foreground">
								Acciones que ofrece el portal:
								{#each row.actions as label (label)}
									<span class="font-medium text-foreground">{label}</span>
								{:else}
									<span class="font-medium text-foreground">Ninguna acción</span>
								{/each}
							</p>

							{#if row.situation.manualNote}
								<p
									data-testid="unreproducible-marker"
									class="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
								>
									<TriangleAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
									<span>{row.situation.manualNote}</span>
								</p>
							{/if}
						</article>
					{/each}
				</div>
			{/each}
		</section>

		<!-- ─── 2. Aviso de sesión expirada ─────────────────────────── -->
		<section class="mt-12">
			<h2 class="font-heading text-2xl font-semibold text-foreground">Aviso de sesión expirada</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Aparece en la pantalla de login (<code class="font-mono text-xs"
					>/auth/login · src/routes/auth/login/+page.svelte</code
				>) cuando la URL lleva el parámetro <code class="font-mono text-xs">{SESSION_EXPIRED_PARAM}</code
				>. La condición, el texto y la URL se construyen en
				<code class="font-mono text-xs">src/lib/session.ts</code>.
			</p>

			<article
				data-testid="session-expired-notice"
				class="mt-4 rounded-lg border border-border bg-card p-4"
			>
				<h3 class="font-heading text-lg font-semibold text-card-foreground">
					Sesión expirada o inválida
				</h3>
				<p
					class="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-relaxed text-card-foreground"
				>
					{SESSION_EXPIRED_MESSAGE}
				</p>
				<p class="mt-3 text-xs leading-relaxed text-muted-foreground">
					URL que lo dispara (ejemplo con destino original <code class="font-mono text-xs"
						>/dashboard</code
					>): <code class="font-mono break-all text-xs">{sessionExpiredLoginUrl("/dashboard")}</code>
				</p>
			</article>
		</section>

		<!-- ─── 3. Estado vacío del panel ───────────────────────────── -->
		<section class="mt-12">
			<h2 class="font-heading text-2xl font-semibold text-foreground">
				Estado vacío de «Mis datasets»
			</h2>
			<p class="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
				Se renderiza en el panel cuando la grilla no tiene datasets
				(<code class="font-mono text-xs">src/routes/dashboard/+page.svelte</code>). El texto se elige
				en <code class="font-mono text-xs">src/lib/copy/dashboard.ts</code>. Cuatro estados, tres
				oraciones: «puede crear» y el relleno neutro dicen exactamente lo mismo.
			</p>

			<div class="mt-4 space-y-2">
				<p class="text-xs font-medium text-muted-foreground">
					Encabezado (siempre presente) y llamado a la acción (sólo con permiso para crear):
				</p>
				<p
					data-testid="empty-state-heading"
					class="rounded-md border border-border bg-muted px-3 py-2 font-heading text-base text-card-foreground"
				>
					{EMPTY_STATE_HEADING}
				</p>
				<p
					data-testid="empty-state-primary-action"
					class="rounded-md border border-border bg-muted px-3 py-2 text-sm text-card-foreground"
				>
					{EMPTY_STATE_PRIMARY_ACTION_LABEL}
				</p>
			</div>

			<div class="mt-6 space-y-4">
				{#each EMPTY_STATE_CASES as variant (variant.id)}
					<article
						data-testid={`empty-state-${variant.id}`}
						class="rounded-lg border border-border bg-card p-4"
					>
						<h3 class="font-heading text-lg font-semibold text-card-foreground">
							{variant.label}
						</h3>
						<p class="mt-1 text-sm leading-relaxed text-muted-foreground">{variant.condition}</p>
						<p class="mt-1 font-mono text-xs text-muted-foreground">
							{variant.id} · {flagSummary(variant.flags)}
						</p>
						<p
							class="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-relaxed text-card-foreground"
						>
							{emptyStateMessage(variant.flags)}
						</p>
					</article>
				{/each}
			</div>
		</section>
	</div>
</div>
