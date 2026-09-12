# Design: Dataset Publishing (wizard) + Dashboard real

## Context

El portal es de solo lectura: `/dashboard` promete publicación "próximamente" y no hay
forma de crear un dataset ni subir recursos desde el frontend. Este cambio agrega el
wizard de publicación (PR3) y, en el mismo track, el dashboard real (S-D). PR1
(artefactos + fix de `owner_org`) y PR2 (módulos puros `dataset-payload.ts` y
`upload.ts` + tests) ya están cerrados y commiteados.

## Decision Summary

Todas las decisiones de arquitectura ya fueron tomadas en `proposal.md` y validadas por
la revisión RDD de PR1 (4 lentes). Este diseño las fija como contrato de implementación
y agrega el plan de absorción de los 3 hallazgos de la revisión de PR2.

| Decisión | Valor | Razón |
|---|---|---|
| Transporte de `package_create` | `fetch` JSON a `/api/3/action/package_create` | Toda acción CKAN acepta JSON salvo subida de archivos |
| Transporte de `resource_create` | `XMLHttpRequest` multipart | `fetch` no reporta progreso de subida; un form action de SvelteKit tampoco |
| `Content-Type` en la subida | Nunca se fija | El browser genera el boundary del multipart; fijarlo lo pierde y CKAN rechaza |
| Token | `Authorization: <token>` leído del store `auth` vía getter lazy | CKAN 2.10 exige el JWT sin `Bearer` |
| Bytes por el servidor | Ninguno | El browser habla con CKAN por el proxy `/api/`; `BODY_SIZE_LIMIT` queda en default |
| `extras` DCAT en v0 | Ninguno | Vocabulario de ckanext-dcat inestable entre perfiles; ver evidencia en `spec.md` |
| Visibilidad default | `private: true` | RF del PRD; se explicita en la UI |

## Arquitectura

```
browser ──POST /api/3/action/package_create    (JSON)      ─┐
   │                                                         ├─> nginx ──> CKAN
   └──POST /api/3/action/resource_create       (multipart)  ─┘
```

- **Lecturas previas al submit** (`organization_list_for_user`) pasan por el cliente JSON
  existente (`createCkanClient` + `createOrganizationApi`).
- **El wizard construye el payload** con `buildPackagePayload()` (ya existe en
  `src/lib/utils/dataset-payload.ts`) y valida con `datasetCreateSchema` (ya existe).
- **La subida** usa `uploadResourceFile()` (ya existe en `src/lib/api/upload.ts`).

## Estructura de componentes (PR3)

```
src/routes/dashboard/datasets/new/+page.svelte   → el wizard (shell + guard + estado)
src/lib/components/dataset/publish/                → componentes del wizard (opcional, si crece)
```

El wizard es una sola página Svelte 5 (runes `$state`/`$derived`/`$effect`) que orquesta:

1. **Guard de auth**: `onMount` → si `!get(isAuthenticated)` → `goto("/auth/login")` sin
   renderizar el formulario ni tocar CKAN (mismo patrón que `/dashboard/+page.svelte`).
2. **Carga de organizaciones**: `organization_list_for_user({ permission: "create_dataset" })`
   con el cliente autenticado (`apiKey: () => get(auth).token`). Estados: cargando, error
   con reintento, vacío ("necesita rol editor en una organización", sin select).
3. **Formulario de metadatos**: título, slug (con sugerencia + edición manual), descripción,
   organización (select), licencia, tags, visibilidad, landing page, maintainer, email.
4. **Selector de archivos**: validación de tamaño por archivo ANTES de enviar bytes
   (`validateResourceFile`, `MAX_RESOURCE_BYTES`).
5. **Submit**: `package_create` → luego `resource_create` secuencial por archivo, con
   progreso por archivo y cancelación.
6. **Fallo parcial**: reportar por archivo, conservar el dataset, ofrecer reintento.
7. **Éxito**: `goto("/dataset/[name]")`.

## Flujo de datos del submit

```
submit
  ├─ validar schema (datasetCreateSchema) → errores por campo si falla
  ├─ buildPackagePayload(form)             → payload sin extras ni opcionales vacíos
  ├─ packageApi.create(payload)            → CkanPackage (tiene .id y .name)
  ├─ por cada archivo (secuencial):
  │    validateResourceFile(file)          → rechaza >50MB antes de enviar
  │    uploadResourceFile({packageId, file, token, onProgress, signal})
  └─ goto(`/dataset/${pkg.name}`)
```

## Absorción de los 3 hallazgos de la revisión de PR2

Estos se corrigen en PR3 con TDD (RED → GREEN), en los módulos ya existentes:

| ID | Archivo | Fix concreto |
|---|---|---|
| `R3-no-timeout` | `src/lib/api/upload.ts` | Agregar `xhr.timeout` (opción `timeoutMs`, default 600000) y `xhr.ontimeout` que rechaza con `UploadError` tipada ("La subida excedió el tiempo límite"). Una subida colgada ya no queda pendiente para siempre. |
| `R3-nonjson-200` | `src/lib/api/upload.ts` | En `xhr.onload`, distinguir 200 con cuerpo no-JSON de un error CKAN real: si `xhr.responseText` no parsea como JSON, rechazar con un código/mensaje explícito de "respuesta ilegible", en lugar de colapsar en el error genérico `ckan`. |
| `R3-slug-boundary` | `src/lib/utils/dataset-payload.ts` | En `suggestSlug`, recortar ANTES de limpiar: `.slice(0, 100)` y luego `.replace(/[-_]+$/g, "")` para no dejar un separador colgando al truncar. Test nuevo que pise el límite exacto. |

## Dashboard (S-D, PR4)

Fuera del scope de este cambio de OpenSpec (es el ítem `[v0]` "Dashboard real del usuario"
del `BACKLOG.md`), pero entregado en el mismo track y en la misma página para no tocar
`/dashboard` dos veces:

- **"Mis datasets"**: `datasetApi.currentUser()` → `current_package_list_with_resources`
  (los datasets que el usuario puede editar).
- **"Mis organizaciones"**: `organizationApi.listForUser()` → `organization_list_for_user`.
- **CTA al wizard**: card "Publicar dataset" que enlaza a `/dashboard/datasets/new`.
- Reemplaza el placeholder actual en una sola pasada (placeholder → dashboard real, sin
  estado intermedio de "CTA únicamente").

## Work units

| Unit | Alcance | Files |
|---|---|---|
| PR3 | Wizard + absorción de 3 hallazgos | `src/routes/dashboard/datasets/new/+page.svelte`, `src/lib/api/upload.ts` (+test), `src/lib/utils/dataset-payload.ts` (+test) |
| PR4 | Dashboard real + CTA | `src/routes/dashboard/+page.svelte` (+test) |

## Testing

- `pnpm test` (vitest) con el patrón RED → GREEN de los módulos nuevos y los fixes.
- Test de componente del wizard (task 3.10): envío mínimo válido llama a `package_create`
  con el payload esperado; submit bloqueado ante campo requerido faltante; estado
  "sin organización escribible".
- Gates: `pnpm check` 0 errores · `pnpm lint` sin hallazgos nuevos.

## Rollback

Frontend-only. Revertir el commit elimina la ruta del wizard y los fixes. Los datasets ya
creados quedan en CKAN (se borran con `package_delete` o desde el UI de CKAN). Sin
migración, sin pérdida de datos.
