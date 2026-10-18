// El mínimo y el máximo de una columna numérica, para proponer el paso de los rangos (L49).
//
// Se piden por el puente del portal con dos `datastore_search` de una fila, ordenados con `nulls last` en los
// dos sentidos. Postgres pone los nulos primero al ordenar descendente, y el filtro `{ col: null }` de CKAN no
// los encuentra (medido: cuenta 0 sobre una columna con vacíos), así que el modificador es la única forma de
// saltarlos; CKAN lo acepta en `sort` (medido sobre `monto_ejecutado`). El nombre va entre comillas por si
// trae espacios o mayúsculas.
//
// No lanza: cualquier fallo, una tabla vacía o un valor que no es un número dan `null`, y quien llama usa su
// paso de respaldo.

/** Lo único que la lectura necesita del cliente: el `post` del puente. La respuesta se valida acá. */
export interface ColumnRangeClient {
	post(action: string, body: Record<string, unknown>): Promise<unknown>;
}

export async function readColumnRange(
	client: ColumnRangeClient,
	resourceId: string,
	column: string,
): Promise<{ min: number; max: number } | null> {
	const edge = async (direction: "asc" | "desc"): Promise<number | null> => {
		const result = (await client.post("datastore_search", {
			resource_id: resourceId,
			limit: 1,
			fields: [column],
			sort: `"${column}" ${direction} nulls last`,
		})) as { records?: Record<string, unknown>[] } | null;
		const value = result?.records?.[0]?.[column];
		if (value === null || value === undefined || value === "") return null;
		const number = Number(value);
		return Number.isFinite(number) ? number : null;
	};
	try {
		const min = await edge("asc");
		const max = await edge("desc");
		return min === null || max === null ? null : { min, max };
	} catch {
		return null;
	}
}
