# odp — Plataforma de Datos Abiertos UMSS

Portal de datos abiertos de la Universidad Mayor de San Simón (UMSS). Frontend en SvelteKit que consume la API de [CKAN](https://ckan.org).

## Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (runes) + TailwindCSS 4 + shadcn-svelte
- **Lenguaje**: TypeScript (strict)
- **Package manager**: pnpm 10
- **Backend**: CKAN (Python) — ver `../odp-docker/ckan-docker`
- **Lint/format**: Biome 2

## Requisitos

- Node.js 20+
- pnpm 10

## Setup

```sh
pnpm install
cp .env.example .env    # ajustar PUBLIC_CKAN_URL si es necesario
pnpm dev                # http://localhost:5173 — sólo SIN Docker (ver abajo)
```

En desarrollo, el proxy de Vite deriva `/api/*` a `http://localhost:5000` (CKAN). Sin CKAN corriendo, la app usa datos mock.

> **Con Docker — el entorno de este proyecto — no corras `pnpm dev` en el host.** El portal se levanta con
> los contenedores de `../odp-docker` y **se abre en `http://localhost:8082`** (contenedor
> `frontend-proxy`; es la única URL publicada). El servidor de desarrollo ya corre **dentro** de
> `odp-dev-frontend-dev-1`, y su 5173 es un puerto **interno** sin publicar al host: un `pnpm dev` en el
> host no lo ve el proxy, no le sirve a nadie y deja un proceso vivo ocupando un puerto. Detalle de
> montajes y de por qué un worktree distinto no se ve: `AGENTS.md`, *«El entorno se corre con Docker»*.

---

## Scripts

| Comando          | Descripción                  |
| ---------------- | ---------------------------- |
| `pnpm dev`       | Servidor de desarrollo (Vite) |
| `pnpm build`     | Build de producción          |
| `pnpm preview`   | Previsualizar el build       |
| `pnpm check`     | Typecheck (svelte-check)     |
| `pnpm lint`      | Lint (Biome)                 |
| `pnpm format`    | Formatear (Biome)            |

## Estructura

```
src/
├── routes/              # páginas (file-based routing de SvelteKit)
│   ├── +page.svelte     # home
│   ├── search/          # catálogo con búsqueda facetada
│   ├── dataset/[id]/    # detalle de dataset
│   ├── organizations/   # listado de organizaciones
│   └── organization/[id]/  # detalle de organización
└── lib/
    ├── api/             # clientes CKAN (client, datasets, organizations, resources)
    ├── components/      # UI (ui/, search/, dataset/, organizations/)
    ├── stores/          # auth, search, theme
    ├── types/           # tipos CKAN y de dominio
    ├── utils/           # helpers (citation, ckan, csv)
    └── mock/            # datos mock para desarrollo sin CKAN
```

## Backend (CKAN)

El backend CKAN está dockerizado en `../odp-docker/ckan-docker` (`docker-compose.yml`). El plugin `ckanext-umss` vive en su carpeta `src/`.

## Autenticación

El login de usuarios usa un proxy server-side en SvelteKit (`POST /auth/login`) que ejecuta el flujo de CKAN (`user/login` → `user_show` → token CSRF → `api_token_create`) y devuelve un JWT guardado en `localStorage`. Las llamadas autenticadas a `/api/*` adjuntan `Authorization: <JWT>` en el cliente.

### `CKAN_INTERNAL_URL` (solo servidor)

`/auth/login` usa la variable **server-only** `CKAN_INTERNAL_URL` para localizar CKAN desde el servidor (no se expone al cliente):

- **Desarrollo local**: sin configurar → usa el proxy de Vite (`http://localhost:5000`)
- **Desarrollo (compose)**: `CKAN_INTERNAL_URL=http://ckan-dev:5000`
- **Producción (compose)**: `CKAN_INTERNAL_URL=http://ckan:5000`

### Wiring en `odp-docker` (repo externo)

El repo `odp-docker` (separado, `../odp-docker/ckan-docker`) debe inyectar la variable en el servicio del frontend:

- **Producción**: `CKAN_INTERNAL_URL=http://ckan:5000`
- **Desarrollo**: `CKAN_INTERNAL_URL=http://ckan-dev:5000`

Esta variable **no** se configura en este repo: se añade al `docker-compose.yml` de `odp-docker` en el despliegue.
