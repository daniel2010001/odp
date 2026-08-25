import { derived, writable } from "svelte/store";
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

function createAuthStore() {
	const stored = loadSession();
	const { subscribe, set, update } = writable<AuthState>({
		token: stored?.token ?? null,
		user: stored?.user ?? null,
		loading: false,
		error: null,
	});

	return {
		subscribe,

		/** Iniciar sesión con API Key de CKAN */
		login(token: string, user: CkanUser) {
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
export const isAuthenticated = derived(auth, ($auth) => $auth.token !== null);
export const isSuperAdmin = derived(auth, ($auth) => $auth.user?.sysadmin === true);
export const currentUser = derived(auth, ($auth) => $auth.user);
