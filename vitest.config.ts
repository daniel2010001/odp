import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		svelte({
			compilerOptions: {
				// Force runes mode para el proyecto, igual que vite.config.ts.
				// Las librerías (node_modules, ej. lucide-svelte) siguen en modo legacy.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
			},
		}),
		// Configura la resolución "browser" de Svelte (evita `mount` server-only en tests).
		svelteTesting(),
	],
	resolve: {
		alias: {
			$lib: fileURLToPath(new URL("./src/lib", import.meta.url)),
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		include: ["src/**/*.{test,spec}.{js,ts}"],
		setupFiles: ["./src/test-setup.ts"],
	},
});
