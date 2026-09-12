// Stub de `$app/stores` para Vitest.
//
// SvelteKit resuelve `$app/stores` como módulo virtual que no existe en el
// entorno de Vitest (vitest.config.ts sólo aliases `$app/navigation`). Este stub
// expone un store `page` mutable para que los tests de páginas puedan fijar
// `params` y `url` sin montar el router.
import { writable } from "svelte/store";

export interface StubPage {
	params: Record<string, string>;
	url: URL;
}

export const page = writable<StubPage>({
	params: {},
	url: new URL("http://localhost/"),
});

export const navigating = writable(null);
export const updated = writable(false);
