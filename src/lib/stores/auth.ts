import { derived, get, writable } from "svelte/store";
import type { CkanUser } from "$lib/types/ckan";

export interface AuthState {
	user: CkanUser | null;
	loading: boolean;
	error: string | null;
}

/**
 * Clave donde las versiones anteriores guardaban `{ token, user }`. El store ya no persiste nada: la identidad
 * la entrega el servidor en cada carga y la credencial vive en la cookie `httpOnly` del portal.
 */
const LEGACY_STORAGE_KEY = "auth";

/**
 * Borra la credencial heredada. Un navegador que inició sesión antes del despliegue guarda ahí un JWT vivo
 * hasta 24 h, legible por cualquier XSS: **no se lee, se borra**.
 */
function removeLegacySession() {
	if (typeof window === "undefined") return;
	try {
		localStorage.removeItem(LEGACY_STORAGE_KEY);
	} catch {
		// localStorage puede no estar disponible (modo privado) — se ignora
	}
}

/** El usuario tal como lo entrega el servidor en el layout (`locals.user`): sin token y sin los campos de CKAN. */
export interface SessionUserData {
	id: string;
	name: string;
	displayName?: string;
	sysadmin: boolean;
}

/** Traduce el usuario del servidor a la forma que el store y las pantallas ya leen (`display_name`, `sysadmin`). */
function fromSessionUser(user: SessionUserData): CkanUser {
	return {
		id: user.id,
		name: user.name,
		display_name: user.displayName ?? "",
		created: "",
		state: "active",
		sysadmin: user.sysadmin,
	};
}

function createAuthStore() {
	removeLegacySession();
	const store = writable<AuthState>({
		user: null,
		loading: false,
		error: null,
	});

	const { subscribe, set, update } = store;

	return {
		subscribe,

		/**
		 * Fijar el usuario: es lo que sigue a un login exitoso o a una sonda viva. Sólo toca el estado en
		 * memoria; la credencial no pasa por el navegador.
		 */
		setUser(user: CkanUser) {
			update((state) => ({ ...state, user, error: null }));
		},

		/**
		 * Adoptar la identidad que el servidor entregó en el layout. **El servidor gana**: sin usuario del
		 * servidor se cierra lo que hubiera, y si lo que hay es de otro usuario no se hereda nada de él.
		 *
		 * Sólo se llama en el navegador: el store es un singleton de módulo, y escribirlo durante el SSR
		 * mezclaría usuarios entre requests.
		 */
		hydrate(sessionUser: SessionUserData | null) {
			const current = get(store);
			if (!sessionUser) {
				if (current.user !== null) this.logout();
				return;
			}
			const same = current.user?.id === sessionUser.id;
			// Del mismo usuario se conservan los campos que el servidor no entrega (email, `created`…), y los
			// que sí entrega mandan.
			const user = { ...(same ? current.user : null), ...fromSessionUser(sessionUser) };
			update((state) => ({ ...state, user, error: null }));
		},

		/** Cerrar sesión */
		logout() {
			update((state) => ({ ...state, user: null, error: null }));
		},

		/** Marcar loading */
		setLoading(loading: boolean) {
			update((state) => ({ ...state, loading }));
		},

		/** Registrar error */
		setError(error: string) {
			update((state) => ({ ...state, error, loading: false }));
		},

		/** Resetear estado */
		reset() {
			set({ user: null, loading: false, error: null });
		},
	};
}

export const auth = createAuthStore();

// Stores derivados
export const isAuthenticated = derived(auth, ($auth) => $auth.user !== null);
export const isSuperAdmin = derived(auth, ($auth) => $auth.user?.sysadmin === true);
export const currentUser = derived(auth, ($auth) => $auth.user);
