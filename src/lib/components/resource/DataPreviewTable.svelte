<script lang="ts">
import type { DatastoreField } from "$lib/api/datastore";

let {
	fields,
	records,
	total,
	limit = 20,
}: {
	fields: DatastoreField[];
	records: Record<string, unknown>[];
	total: number;
	limit?: number;
} = $props();

const columns = $derived(fields.filter((f) => f.id !== "_id"));

function cellValue(value: unknown): string {
	if (value === null || value === undefined || value === "") return "—";
	return String(value);
}
</script>

<div class="overflow-x-auto">
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
