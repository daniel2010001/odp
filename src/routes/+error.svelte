<!--
	La página de error del portal.

	Deliberadamente fina: toda la presentación —los dos estados, la copia congelada, la política de no
	distinguir «no existe» de «no tiene permiso»— vive en `$lib/components/error/ErrorPage.svelte`, que
	es el mismo componente que muestra la hoja de revisión `/dev/error`. Acá sólo se traduce el error
	que SvelteKit entrega.

	─── De dónde sale el estado, y por qué NO de `page.error` ───────────
	`$page.status` es la fuente: es `number` siempre y SvelteKit lo documenta como «HTTP status code of
	the current page». `$page.error` es `App.Error | null`, y el `App.Error` por defecto de SvelteKit
	trae **sólo `message`** (este repo no lo amplía: `src/app.d.ts` tiene `interface Error {}`
	comentada), así que leer `$page.error.status` daría `undefined` en producción y **todo** error
	—404 incluido— renderizaría el estado del servidor. No «arreglar» esto pasando el status a
	`page.error` sin declarar la interfaz: además exigiría un gancho `handleError` que lo llene.

	Vive en la raíz de `src/routes`, así que se renderiza DENTRO de `+layout.svelte`: el encabezado y el
	pie sobreviven, y con ellos el camino hacia iniciar sesión — que es exactamente donde la política de
	existencia lo quiere. Un botón de login *dentro* del estado de error le confirmaría al espectador
	que el recurso existe; ver el encabezado de `src/lib/api/failure.ts`.
-->
<script lang="ts">
import { page } from "$app/stores";
import ErrorPage from "$lib/components/error/ErrorPage.svelte";
</script>

<ErrorPage status={$page.status} message={$page.error?.message} path={$page.url.pathname} />
