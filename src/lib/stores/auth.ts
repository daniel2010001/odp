import { derived, get, writable } from "svelte/store";
import type { CkanUser } from "$lib/types/ckan";

export interface AuthState {
	token: string | null;
	user: CkanUser | null;
	loading: boolean;
	error: string | null;
}

const STORAGE_KEY = "auth";

interface StoredSession {
	token: string;
	user: CkanUser;
}

function loadSession(): StoredSession | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<StoredSession>;
		if (typeof parsed.token === "string" && parsed.user && typeof parsed.user === "object") {
			return { token: parsed.token, user: parsed.user as CkanUser };
		}
		return null;
	} catch {
		return null;
	}
}

function persist(token: string | null, user: CkanUser | null) {
	if (typeof window === "undefined") return;
	try {
		if (token && user) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
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
	const stored = loadSession();
	const store = writable<AuthState>({
		token: stored?.token ?? null,
		user: stored?.user ?? null,
		loading: false,
		error: null,
	});

	const { subscribe, set, update } = store;

	return {
		subscribe,

		/** Iniciar sesión con API Key de CKAN */
		login(token: string, user: CkanUser) {
			update((state) => ({ ...state, token, user, error: null }));
			persist(token, user);
		},

		/**
		 * Fijar el usuario sin tocar el token: es lo que sigue a una sonda viva (la identidad se refresca, la
		 * credencial no se toca). Persiste sólo si hay un token guardado que lo acompañe.
		 */
		setUser(user: CkanUser) {
			update((state) => ({ ...state, user, error: null }));
			persist(get(store).token, user);
		},

		/**
		 * Adoptar la identidad que el servidor entregó en el layout. **El servidor gana**: sin usuario del
		 * servidor se cierra lo guardado, y si lo guardado es de otro usuario su token se descarta. Hasta T4b el
		 * token guardado de **ese mismo** usuario se conserva, porque la subida por XHR todavía lo lee.
		 *
		 * Sólo se llama en el navegador: el store es un singleton de módulo, y escribirlo durante el SSR
		 * mezclaría usuarios entre requests.
		 */
		hydrate(sessionUser: SessionUserData | null) {
			const current = get(store);
			if (!sessionUser) {
				if (current.user !== null || current.token !== null) this.logout();
				return;
			}
			const same = current.user?.id === sessionUser.id;
			const token = same ? current.token : null;
			// Del mismo usuario se conservan los campos que el servidor no entrega (email, `created`…), y los
			// que sí entrega mandan.
			const user = { ...(same ? current.user : null), ...fromSessionUser(sessionUser) };
			update((state) => ({ ...state, token, user, error: null }));
			persist(token, user);
		},

		/** Cerrar sesión */
		logout() {
			update((state) => ({
				...state,
				token: null,
				user: null,
				error: null,
			}));
			persist(null, null);
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
			set({ token: null, user: null, loading: false, error: null });
		},
	};
}

export const auth = createAuthStore();

// Stores derivados
export const isAuthenticated = derived(auth, ($auth) => $auth.user !== null);
export const isSuperAdmin = derived(auth, ($auth) => $auth.user?.sysadmin === true);
export const currentUser = derived(auth, ($auth) => $auth.user);
