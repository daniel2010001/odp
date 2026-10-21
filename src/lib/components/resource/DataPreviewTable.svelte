<script lang="ts">
import type { DatastoreField } from "$lib/api/datastore";

let {
	fields,
	records,
	total,
}: {
	fields: DatastoreField[];
	records: Record<string, unknown>[];
	total: number;
} = $props();

const columns = $derived(fields.filter((f) => f.id !== "_id"));

function cellValue(value: unknown): string {
	if (value === null || value === undefined || value === "") return "—";
	// Los tipos compuestos (objetos, arrays y también funciones y símbolos) van a JSON en vez de a
	// `String`, que para un objeto devuelve el literal `[object Object]`. `JSON.stringify` devuelve
	// `undefined` para funciones y símbolos sueltos: ese caso cae al guion, igual que un vacío.
	if (typeof value === "object" || typeof value === "function" || typeof value === "symbol") {
		return JSON.stringify(value) ?? "—";
	}
	return String(value);
}
</script>

<!-- El tope y el scroll van sólo en la tabla: el pie «Mostrando n de N» queda fuera y siempre a la vista.
     Tope = el alto de la ventana (100dvh − 140px, ver `PreviewWindow`) menos ~44px del pie. -->
<div class="max-h-[max(316px,calc(100dvh-184px-var(--tabs-h,0px)))] overflow-auto">
	<table class="w-full border-collapse text-left text-sm">
		<thead>
			<tr class="border-b border-border bg-muted/50">
				{#each columns as col}
					<th
						scope="col"
						class="whitespace-nowrap px-4 py-2.5 font-semibold text-foreground"
					>
						{col.id}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each records as row, rowIndex}
				<tr class="border-b border-border/60 last:border-0">
					{#each columns as col}
						<td class="whitespace-nowrap px-4 py-2 text-muted-foreground">
							{cellValue(row[col.id])}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<p class="px-4 py-3 text-xs text-muted-foreground">
	Mostrando {records.length} de {total} filas
</p>
