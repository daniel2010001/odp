# Tasks: Resource Detail View

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: Foundation

- [x] 1.1 Add `getMockResourceById(id)` to `src/lib/mock/data.ts` that searches all mock datasets and showcase
- [x] 1.2 Create `src/lib/components/ui/breadcrumb/Breadcrumb.svelte` with `ol`/`li`, `aria-label="Breadcrumb"`, and `BreadcrumbItem` interface
- [x] 1.3 Optionally narrow `resource_type` union to `"file" | "api"` in `src/lib/types/ckan.ts` if safe

## Phase 2: Core Implementation

- [x] 2.1 Create `src/routes/dataset/[id]/resource/[resourceId]/+page.svelte` with runes-mode state (`resource`, `dataset`, `loading`, `error`)
- [x] 2.2 Fetch resource via `resourceApi.show(resourceId)` with `getMockResourceById` fallback
- [x] 2.3 Fetch parent dataset in parallel for breadcrumb org name and title
- [x] 2.4 Render all `resource_show` fields with human-readable labels and null handling
- [x] 2.5 Add API metadata section conditional on `extras` keys (`api_base_url`, `docs_url`, `example_request`)
- [x] 2.6 Add download button with `outline` variant, conditional on `url`
- [x] 2.7 Add preview placeholder area with "coming soon" indication
- [x] 2.8 Implement 404 state with link back to parent dataset

## Phase 3: Integration

- [x] 3.1 Modify `src/lib/components/dataset/ResourceCard.svelte` to wrap card in `<a>` linking to `dataset/[id]/resource/[resourceId]`
- [x] 3.2 Remove direct download button from `ResourceCard.svelte`
- [x] 3.3 Wire `Breadcrumb` into detail page with `Datasets > [Org] > [Dataset] > [Resource]` or 3-level fallback

## Phase 4: Verification

- [x] 4.1 Manual: card click navigates, keyboard Enter/Space activates (dataset-resource-listing spec)
- [x] 4.2 Manual: all fields render with labels, missing fields show "Not available"
- [x] 4.3 Manual: API extras surface endpoint/docs/example when present
- [x] 4.4 Manual: download button navigates to `url`, hidden when null
- [x] 4.5 Manual: breadcrumbs render full path or fallback without org
- [x] 4.6 Manual: unknown resourceId shows 404 state with back link
