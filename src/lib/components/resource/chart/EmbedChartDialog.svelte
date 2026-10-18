<script lang="ts">
import { Check, Code, Copy, X } from "@lucide/svelte";
import { Dialog } from "bits-ui";
import { page } from "$app/stores";
import { embedSnippet, embedUrl } from "$lib/charts/embed";
import Button from "$lib/components/ui/button/button.svelte";
import { copyToClipboard } from "$lib/utils/citation";

// «Insertar» (P4): el código `<iframe>` de un gráfico guardado, listo para copiar. Es una acción de **lectura**,
// por eso la ve cualquier visitante: insertar un gráfico público no cambia nada en el catálogo. Lo que se
// inserta es `/embed/charts/<id>`, que el servidor deja enmarcar desde cualquier sitio (`$lib/charts/embed`).
//
// El origen sale de la página en que está el visitante: la URL del `src` tiene que ser absoluta para que
// funcione pegada en otro sitio.
let { view }: { view: { id: string; title: string } } = $props();

const title = $derived(view.title.trim() || "Gráfico sin título");
const snippet = $derived(embedSnippet(embedUrl($page.url.origin, view.id), title));

let open = $state(false);
let copied = $state<"idle" | "ok" | "failed">("idle");

// El aviso de copiado es de **esta** apertura: al reabrir el diálogo vuelve al estado inicial.
$effect(() => {
	if (open) copied = "idle";
});

async function copy() {
	copied = (await copyToClipboard(snippet)) ? "ok" : "failed";
}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		aria-label="Insertar el gráfico «{title}» en otra página"
		class="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
	>
		<Code class="size-4" aria-hidden="true" />
		Insertar
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 z-50 bg-foreground/40" />
		<Dialog.Content
			class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border border-border bg-card p-6 shadow-lg focus-visible:outline-none"
		>
			<div class="space-y-2">
				<Dialog.Title class="font-heading text-lg font-bold text-foreground">
					Insertar el gráfico en otra página
				</Dialog.Title>
				<Dialog.Description class="text-sm leading-relaxed text-muted-foreground">
					Copie este código y péguelo en el HTML de la página donde quiere mostrar «{title}». El
					gráfico se actualiza con los datos del recurso.
				</Dialog.Description>
			</div>
			<div class="space-y-1.5">
				<label for="embed-code-{view.id}" class="text-sm font-medium text-foreground">
					Código para insertar
				</label>
				<textarea
					id="embed-code-{view.id}"
					readonly
					rows="4"
					value={snippet}
					onfocus={(event) => event.currentTarget.select()}
					class="w-full resize-none rounded-md border border-input bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				></textarea>
			</div>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="min-h-5 text-sm" role="status" aria-live="polite">
					{#if copied === "ok"}
						<span class="inline-flex items-center gap-1.5 text-foreground">
							<Check class="size-4 text-primary" aria-hidden="true" />
							Código copiado
						</span>
					{:else if copied === "failed"}
						<span class="text-destructive">
							No se pudo copiar. Seleccione el código y cópielo manualmente.
						</span>
					{/if}
				</p>
				<div class="flex gap-2">
					<Dialog.Close>
						{#snippet child({ props })}
							<Button {...props} type="button" variant="outline">
								<X class="size-4" aria-hidden="true" />
								Cerrar
							</Button>
						{/snippet}
					</Dialog.Close>
					<Button type="button" onclick={copy}>
						<Copy class="size-4" aria-hidden="true" />
						Copiar código
					</Button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
