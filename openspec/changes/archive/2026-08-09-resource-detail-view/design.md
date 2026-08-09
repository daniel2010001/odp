# Design: Resource Detail View

## Technical Approach

Add a nested SvelteKit route `dataset/[id]/resource/[resourceId]` that fetches a single resource via `resourceApi.show()` and renders all `resource_show` fields, API metadata, and a download action. Parent dataset data is fetched in parallel to build breadcrumbs. `ResourceCard` changes from a direct-download div to a navigation anchor. The page follows the exact runes-mode, OKLCH token, and shadcn-svelte patterns already used on the dataset detail page.

## Architecture Decisions

| Decision | Options | Trade-offs | Rationale |
|----------|---------|------------|-----------|
| Data loading | `+page.svelte` client-side `$effect` (A) vs `+page.ts` `load` (B) | A: matches existing dataset page, simple mock fallback. B: SSR/SEO, but codebase has no `+page.ts` pattern. | A — consistency with existing page. |
| Download button | Discreet `outline` (A) vs prominent `default` (B) | A: respects "discreet by default" contract. B: higher visibility. | A as default; spec allows B as optional variant for user comparison. |
| Breadcrumbs | Inline markup (A) vs new `Breadcrumb` component (B) | A: less boilerplate for one page. B: reusable for future pages. | B — dataset and search pages will likely need them too. |
| Resource card navigation | Wrap card in `<a>` (A) vs `<div>` + `goto` (B) | A: native keyboard/screen-reader behavior. B: more control but needs extra a11y code. | A — spec requires full keyboard activation. |
| API metadata surfacing | Read `extras` key-value (A) vs typed `CkanResource` extension (B) | A: zero type changes, resilient. B: stronger typing but requires upstream schema knowledge. | A — extras are free-form in CKAN; conditionally render known keys. |

## Data Flow

```
URL params (id, resourceId)
    │
    ├──► resourceApi.show(resourceId) ──► CkanResource
    │                                        │
    └──► datasetApi.show(id) ─────────► CkanPackage (org name, title)
                                              │
    ┌─────────────────────────────────────────┘
    │
    ▼
+page.svelte state ($state: resource, dataset, loading, error)
    │
    ├──► Breadcrumb (derived from dataset)
    ├──► Field list (render every resource_show field)
    ├──► API section (conditional on extras)
    ├──► Download button (conditional on url)
    └──► Preview placeholder (static)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte` | Create | Detail page: fetch resource + dataset, render metadata, download, preview placeholder |
| `src/lib/components/dataset/ResourceCard.svelte` | Modify | Replace outer `<div>` with `<a>` to detail route; remove download button |
| `src/lib/mock/data.ts` | Modify | Add `getMockResourceById(id)` that searches all mock datasets and showcase |
| `src/lib/components/ui/breadcrumb/Breadcrumb.svelte` | Create | Reusable breadcrumb list using `ol` + `li` with `aria-label="Breadcrumb"` |
| `src/lib/types/ckan.ts` | Modify | Optional: narrow `resource_type` union to `"file" \| "api"` if safe |

## Interfaces / Contracts

```typescript
// src/lib/mock/data.ts
export function getMockResourceById(id: string): CkanResource | undefined;

// Breadcrumb item contract
interface BreadcrumbItem {
  label: string;
  href?: string;
}
```

**Field labels** (human-readable, Spanish): `name → Nombre`, `description → Descripción`, `format → Formato`, `size → Tamaño`, `mimetype → Tipo MIME`, `created → Creado`, `last_modified → Modificado`, `url → URL`, `hash → Hash`, `state → Estado`, `resource_type → Tipo de recurso`.

**API extras keys** (rendered when present): `api_base_url`, `docs_url`, `example_request`, `example_response`.

**Page state**: `resource: CkanResource | null`, `dataset: CkanPackage | null`, `loading: boolean`, `error: string | null`.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `getMockResourceById` returns correct resource | Manual verification; no test runner configured |
| Integration | Page loads, breadcrumbs render, card click navigates | Manual browser walkthrough |
| E2E | Download button href, 404 resource state | Manual verification |

> No automated test runner is configured. Tests are manual for this slice.

## Migration / Rollout

No migration required. `ResourceCard` navigation change is user-facing but non-breaking. Rollback: revert the card anchor and delete the route.

## Open Questions

None.
