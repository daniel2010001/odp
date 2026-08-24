import adapter from "@sveltejs/adapter-node";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
			},

			// adapter-node genera un servidor Node.js autocontenido en build/.
			// Ver https://svelte.dev/docs/kit/adapter-node para más información.
			adapter: adapter(),
		}),
	],

	// En desarrollo, deriva /api/* a CKAN para evitar CORS
	server: {
		// Escucha en 0.0.0.0 para poder correr detrás de un proxy/contenedor.
		host: true,
		// Hosts permitidos: sin esto Vite bloquea las requests cuyo Host header
		// no sea localhost. Se accede por dominio (odp.hs.lan, vía Caddy/nginx)
		// y por IP LAN directa (:8082).
		allowedHosts: ["odp.hs.lan", "192.168.1.201"],
		proxy: {
			"/api": {
				target: process.env.CKAN_PROXY_TARGET ?? "http://localhost:5000",
				changeOrigin: true,
			},
		},
		// Permite HMR detrás de un reverse proxy: el cliente se conecta al
		// puerto público del proxy en vez del puerto interno de Vite.
		hmr: {
			clientPort: process.env.VITE_HMR_CLIENT_PORT
				? Number(process.env.VITE_HMR_CLIENT_PORT)
				: undefined,
		},
	},
});
