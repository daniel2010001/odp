// El estado de la cola de solicitudes: sus filas, la carga, la decisión en vuelo, las filas obsoletas y el anuncio.
// Vive en una clase con runes para que la cola y el panel de cada fila lean lo mismo sin pasarse diez props.

import { technicalDetail } from "$lib/api/failure";
import type {
	DecidePublicationRequest,
	PublicationDecisionResult,
} from "$lib/components/dataset/publication-decision";
import { applyDecision, isStaleDecision, type QueueItem } from "./requests-model";

export const APPROVED_NOTE = "La solicitud fue aprobada.";
export const REJECTED_NOTE = "La solicitud fue rechazada.";
/** Etiqueta neutral cuando el catálogo no devuelve quién decidió: la fila nunca cae a un id. */
const CATALOG_NAME_FALLBACK = "un usuario del catálogo";

export class QueueState {
	items = $state<QueueItem[]>([]);
	loading = $state(true);
	/**
	 * El fallo tal como se observó, **envuelto en un objeto**: el estado de fallo no puede depender de la verdad del
	 * valor lanzado, porque un `throw ""` es falsy y la cola caída se disfrazaría de cola vacía.
	 */
	error = $state<{ cause: unknown } | null>(null);
	/** Id de la fila con una decisión en vuelo: mientras haya una, las otras filas no ofrecen la suya. */
	deciding = $state<string | null>(null);
	/** Filas a las que el catálogo contestó «ya fue decidida» (409 de `request_id`). */
	stale = $state<Record<string, boolean>>({});
	announcement = $state<string | null>(null);

	readonly #decide: DecidePublicationRequest;
	readonly #viewerName: () => string | undefined;

	constructor(
		decide: DecidePublicationRequest,
		viewerName: () => string | undefined = () => undefined,
	) {
		this.#decide = decide;
		this.#viewerName = viewerName;
	}

	/** El dato técnico que sigue a la frase de fallo; `null` si no hay ninguno que citar. */
	get errorDetail(): string | null {
		return this.error ? technicalDetail(this.error.cause) : null;
	}

	/** Pide la lista al catálogo. La cola no cargada no se disfraza de cola vacía: guarda el fallo. */
	load = async (list: () => Promise<QueueItem[]>): Promise<void> => {
		this.loading = true;
		this.error = null;
		try {
			this.items = await list();
			this.stale = {};
		} catch (cause) {
			this.error = { cause };
			this.items = [];
		} finally {
			this.loading = false;
		}
	};

	/** La llamada que se le entrega al control de decidir: anota la carrera y deja subir el fallo intacto. */
	decide: DecidePublicationRequest = async (id, approve, comments) => {
		try {
			return await this.#decide(id, approve, comments);
		} catch (err) {
			if (isStaleDecision(err)) this.stale[id] = true;
			throw err;
		}
	};

	setDeciding = (pending: { id: string; approve: boolean } | null): void => {
		this.deciding = pending?.id ?? null;
		if (pending) this.announcement = null;
	};

	/**
	 * Una decisión confirmada: la fila **queda en la lista** como resuelta, con quién y cuándo, en vez de
	 * desaparecer —la decisión recién tomada es la que más se quiere volver a mirar—, y el anuncio nombra el
	 * desenlace. Quién y cuándo salen de la respuesta; si no los trae, de quien mira y de este momento.
	 */
	confirm = (result: PublicationDecisionResult): void => {
		this.items = applyDecision(this.items, result, {
			by: result.approved_by_name ?? this.#viewerName() ?? CATALOG_NAME_FALLBACK,
			at: result.decided_at ?? new Date().toISOString(),
		});
		this.announcement = result.status === "approved" ? APPROVED_NOTE : REJECTED_NOTE;
	};
}
