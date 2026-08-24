# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────
# Stage 1: build
# Instala dependencias completas (incluye dev) y compila la app.
# PUBLIC_CKAN_URL se inyecta en tiempo de build (SvelteKit la inline
# en $env/static/public). Vacío => el cliente usa rutas relativas /api/...
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# pnpm 10 (pin a la versión del packageManager para reproducibilidad)
RUN npm install -g pnpm@10.12.1

# Copiar manifests primero para cachear la capa de instalación
# --ignore-scripts: evita el `prepare` (husky) que no es necesario en el
# contenedor y fallaría al no haber .git ni dependencias de git hooks.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copiar el resto del código fuente
COPY . .

# URL de CKAN para build. Vacío por defecto => frontend usa /api/... relativo
# (same-origin vía nginx reverse proxy; sin CORS).
ARG PUBLIC_CKAN_URL=""
ENV PUBLIC_CKAN_URL=$PUBLIC_CKAN_URL

# URL pública del frontend. src/lib/env.ts la importa de $env/static/public y
# exige que esté definida (y sea una URL válida) en build; como .env no se
# incluye en la imagen, se provee aquí. Detrás del proxy se sirve en :8080.
ARG PUBLIC_APP_URL="http://localhost:8080"
ENV PUBLIC_APP_URL=$PUBLIC_APP_URL

RUN pnpm build

# ─────────────────────────────────────────────────────────────
# Stage 2: runtime
# Solo dependencias de producción + build/ del stage anterior.
# No se incluye .env, fuentes, ni devDependencies.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN npm install -g pnpm@10.12.1

ENV NODE_ENV=production

# Instalar únicamente dependencias de producción
# --ignore-scripts: sin `prepare` (husky) ni postinstall; el build ya está hecho.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copiar el build generado (servidor Node autocontenido de adapter-node)
COPY --from=build /app/build ./build

EXPOSE 3000

CMD ["node", "build/index.js"]
