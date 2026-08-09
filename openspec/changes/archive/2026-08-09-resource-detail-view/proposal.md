# Proposal: Resource Detail View

## Intent

Users currently download resources blindly from the dataset page. A dedicated detail page lets them inspect metadata before downloading, and is essential for API-type resources where endpoint info matters more than the file itself.

## Scope

### In Scope
- New route `dataset/[id]/resource/[resourceId]` with detail page
- `ResourceCard` navigates to detail page instead of direct external download
- Display all `resource_show` fields (name, description, format, size, mimetype, created, modified, url, hash, state, extras)
- API resources: surface endpoint metadata, docs URL, examples when available
- Discreet download button
- Breadcrumbs: `Datasets > [Org name] > [Dataset title] > [Resource name]`
- Reserved preview placeholder slot for future data preview widget

### Out of Scope
- Data preview widget (table, chart, CSV preview)
- Edit/delete resource actions
- File ingestion or processing

## Capabilities

### New Capabilities
- `resource-detail-view`: Detail page for individual resources with full metadata, download action, and API-specific rendering.

### Modified Capabilities
- `dataset-resource-listing`: `ResourceCard` links change from direct external download to internal navigation to detail page.

## Approach

- Add SvelteKit route `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte`
- Load resource via `resourceApi.show(resourceId)` with mock fallback (`getMockResourceById`)
- Add `getMockResourceById` helper to `src/lib/mock/data.ts`
- Reuse existing design tokens (`max-w-4xl`, `font-heading`, OKLCH badges, shadcn-svelte Card)
- `ResourceCard` becomes a link wrapper to detail page; download action moves to detail page
- Breadcrumbs derived from parent dataset fetch (or cached org name)

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte` | New | Detail page route |
| `src/lib/components/dataset/ResourceCard.svelte` | Modified | Navigates to detail instead of direct download |
| `src/lib/mock/data.ts` | Modified | Add `getMockResourceById` helper |
| `src/lib/types/ckan.ts` | Modified | Extend `CkanResource` for API extras if needed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Parent dataset org name unavailable | Med | Fallback breadcrumb `Datasets > [Dataset] > [Resource]` |
| Mock helper missing nested resources | Low | Add `getMockResourceById` search across all datasets |
| API resource fields undefined | Med | Conditional rendering with null checks |

## Rollback Plan

- Revert `ResourceCard` anchor to direct download link
- Delete `dataset/[id]/resource/[resourceId]/` route
- Remove `getMockResourceById` from mock data

## Dependencies

- None

## Success Criteria

- [ ] Resource detail page renders all `resource_show` fields
- [ ] `ResourceCard` navigates to detail page
- [ ] Download button works on detail page
- [ ] API resource shows endpoint metadata
- [ ] Breadcrumbs present with fallback
