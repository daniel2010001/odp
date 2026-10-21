<!--
	Historial de solicitudes de publicación de un dataset (S12/S19 de v0.1.1, variante H2 de
	`/dev/request-history`): una tarjeta propia de la columna lateral, bajo «Resumen». Una entrada por
	solicitud, la más nueva primero (el orden lo da el catálogo): estado, quién la pidió y cuándo, quién la
	resolvió y cuándo, la nota de quien pidió, el comentario de la decisión y, si se anuló, la causa.

	Sólo muestra lo que la fila trae: un campo ausente se omite en vez de inventarse. Eso cubre las filas
	anteriores a la migración 0002 (cancelaciones sin fecha ni autor; aprobaciones con el comentario sin
	atribuir en `comments`, que se rotula «Comentario» a secas). Sin filas no dibuja nada.
-->
<script lang="ts">
import { Ban, CircleCheck, CircleHelp, CircleX, Clock, Undo2 } from "@lucide/svelte";
import type { Component } from "svelte";
import type { PublicationRequest } from "$lib/api/publication";
import Card from "$lib/components/ui/card/card.svelte";
import { estadoDelHistorial, motivoDeAnulacion, nombreDelHistorial } from "$lib/copy/publication";
import { cn } from "$lib/utils";
import { formatDate } from "$lib/utils/ckan";
import AnchorLink from "./AnchorLink.svelte";

let { rows }: { rows: PublicationRequest[] } = $props();

/** Cuántas entradas se ven antes de «Ver más». */
const LIMITE = 4;
let showAll = $state(false);
const visibles = $derived(showAll ? rows : rows.slice(0, LIMITE));
const ocultas = $derived(rows.length - visibles.length);

const ICONOS: Record<PublicationRequest["status"], Component> = {
	pending: Clock,
	approved: CircleCheck,
	rejected: CircleX,
	cancelled: Undo2,
	annulled: Ban,
};

/** El icono del estado; uno desconocido cae a una interrogación neutral. */
function icono(status: PublicationRequest["status"]): Component {
	return Object.hasOwn(ICONOS, status) ? ICONOS[status] : CircleHelp;
}

/** «Pedida por Ana el 17 de octubre de 2026», con lo que haya: nombre y fecha son opcionales. */
function frase(rotulo: string, nombre: string | null, fecha: string | null | undefined): string {
	return [rotulo, nombre ? `por ${nombre}` : null, fecha ? `el ${formatDate(fecha)}` : null]
		.filter(Boolean)
		.join(" ");
}

function pedida(r: PublicationRequest): string {
	return frase("Pedida", nombreDelHistorial(r.requested_by_name), r.created_at);
}

/** `null` si no hay nada que decir: pendiente, o una fila vieja sin nombre ni fecha. */
function resuelta(r: PublicationRequest): string | null {
	const rotulo = estadoDelHistorial(r.status).resolvio;
	if (!rotulo) return null;
	// Las aprobaciones y rechazos anteriores a la 0002 guardaron a quien decidió sólo en `approved_by_name`.
	const antiguo = r.status === "approved" || r.status === "rejected" ? r.approved_by_name : null;
	const nombre = nombreDelHistorial(r.resolved_by_name ?? antiguo);
	if (!nombre && !r.decided_at) return null;
	return frase(rotulo, nombre, r.decided_at);
}

/** Las notas de la entrada, cada una con su rótulo y sólo si existe. */
function notas(r: PublicationRequest): { rotulo: string; texto: string }[] {
	const salida: { rotulo: string; texto: string }[] = [];
	const pedido = r.request_comment?.trim();
	const decision = r.decision_comment?.trim();
	if (pedido) salida.push({ rotulo: "Nota de quien pidió", texto: pedido });
	if (decision) {
		salida.push({
			rotulo: r.status === "rejected" ? "Motivo del rechazo" : "Comentario de la decisión",
			texto: decision,
		});
	}
	// Fila anterior a la 0002: un único `comments`. En una pendiente es la nota de quien pidió; en las
	// demás no se sabe de quién es, así que se rotula sin atribución.
	const suelto = r.comments?.trim();
	if (suelto && !pedido && !decision) {
		salida.push({
			rotulo: r.status === "pending" ? "Nota de quien pidió" : "Comentario",
			texto: suelto,
		});
	}
	return salida;
}
</script>

{#if rows.length > 0}
	<Card
		id="history"
		class="scroll-mt-[calc(var(--header-h-min)+1px+var(--sticky-air))] p-5"
		data-testid="historial-solicitudes"
	>
		<div class="group/ancla flex h-4 items-center gap-2">
			<p class="text-xs font-medium uppercase tracking-wider text-destructive">
				Historial de solicitudes
			</p>
			<AnchorLink id="history" title="Historial de solicitudes" />
		</div>
		<ol class="relative mt-3">
			<span class="absolute bottom-2 left-2.5 top-2 w-px bg-border" aria-hidden="true"></span>
			{#each visibles as r (r.id)}
				{@const e = estadoDelHistorial(r.status)}
				{@const Icono = icono(r.status)}
				{@const res = resuelta(r)}
				<li class="relative flex gap-3 pb-4 last:pb-0" data-testid="historial-entrada">
					<span class="relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-card">
						<Icono class={cn("size-4", e.tone)} aria-hidden="true" />
					</span>
					<div class="min-w-0 text-sm leading-snug">
						<p class="font-semibold text-foreground">{e.label}</p>
						<p class="text-xs text-muted-foreground">{pedida(r)}</p>
						{#if res}<p class="text-xs text-muted-foreground">{res}</p>{/if}
						{#each notas(r) as n (n.rotulo)}
							<p class="mt-1 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
								<span class="text-muted-foreground">{n.rotulo}:</span>
								{n.texto}
							</p>
						{/each}
						{#if r.status === "annulled"}
							<p class="mt-1 text-xs leading-relaxed text-foreground">
								<span class="text-muted-foreground">Causa de la anulación:</span>
								{motivoDeAnulacion(r.motive)}
							</p>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
		{#if rows.length > LIMITE}
			<button
				type="button"
				aria-expanded={showAll}
				onclick={() => (showAll = !showAll)}
				class="mt-3 inline-flex min-h-8 items-center text-xs font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			>
				{showAll ? "Ver menos" : `Ver ${ocultas} más`}
			</button>
		{/if}
	</Card>
{/if}
