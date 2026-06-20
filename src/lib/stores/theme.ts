// ─── Theme store ─────────────────────────────────────────────────
// Manages dark/light mode with localStorage persistence and
// system preference detection via prefers-color-scheme.

import { writable } from "svelte/store";

export type Theme = "light" | "dark" | "system";

function getSystemPreference(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getStoredTheme(): Theme {
	if (typeof window === "undefined") return "system";
	const stored = localStorage.getItem("theme");
	if (stored === "light" || stored === "dark" || stored === "system") return stored;
	return "system";
}

function applyTheme(theme: Theme) {
	if (typeof document === "undefined") return;

	const isDark = theme === "dark" || (theme === "system" && getSystemPreference());

	if (isDark) {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}
}

function createThemeStore() {
	const stored = getStoredTheme();
	const { subscribe, set } = writable<Theme>(stored);

	// Apply on first load
	applyTheme(stored);

	// Listen to system preference changes
	if (typeof window !== "undefined") {
		window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
			// Re-read current theme from store
			const current = localStorage.getItem("theme") as Theme | null;
			if (current === "system" || !current) {
				applyTheme("system");
			}
		});
	}

	return {
		subscribe,
		set(theme: Theme) {
			localStorage.setItem("theme", theme);
			applyTheme(theme);
			set(theme);
		},
		/** Cycle: light → dark → system → light */
		cycle() {
			const current = localStorage.getItem("theme") as Theme | null;
			const next: Record<Theme, Theme> = {
				light: "dark",
				dark: "system",
				system: "light",
			};
			const nextTheme = next[current ?? "system"];
			this.set(nextTheme);
		},
		/** Get the resolved value (true if dark mode is active) */
		isDark(): boolean {
			const stored = localStorage.getItem("theme") as Theme | null;
			const theme = stored ?? "system";
			return theme === "dark" || (theme === "system" && getSystemPreference());
		},
	};
}

export const theme = createThemeStore();
