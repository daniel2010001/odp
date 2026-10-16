// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { BridgeSession } from "$lib/server/ckan-bridge";
import type { SessionUser } from "$lib/server/session";

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** La sesión del request, resuelta por `hooks.server.ts`. */
			session: BridgeSession;
			/** El usuario de la sesión (nunca el token), o `null` si el request es anónimo o la sesión murió. */
			user: SessionUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
