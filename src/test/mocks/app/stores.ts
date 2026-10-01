// Stub de `$app/stores` para Vitest.
//
// SvelteKit resuelve `$app/stores` como módulo virtual que no existe en el
// entorno de Vitest, así que vitest.config.ts lo mapea a este stub: expone un
// store `page` mutable para que los tests de páginas puedan fijar `params`,
// `url`, el `status` que renderiza `+error.svelte` y el `error` con la MISMA
// forma que el `App.Error` real de SvelteKit (`{ message }`, sin `status`: el
// estado HTTP vive en `page.status`, y un doble que se lo invente tapa el
// defecto que ese detalle causa).
import { writable } from "svelte/store";

export interface StubPage {
	params: Record<string, string>;
	url: URL;
	/** El estado HTTP que SvelteKit expone en `page.status`. */
	status?: number;
	/** El error que SvelteKit entrega a la página de error, con la forma de `App.Error`. */
	error?: { message: string } | null;
}

export const page = writable<StubPage>({
	params: {},
	url: new URL("http://localhost/"),
	status: 200,
	error: null,
});

export const navigating = writable(null);
export const updated = writable(false);
