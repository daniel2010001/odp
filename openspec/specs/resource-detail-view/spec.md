# Resource Detail View Specification

## Purpose

Define the behavior of the dedicated page that displays full metadata for a single CKAN resource and enables download.

## Requirements

### Requirement: Field Display

The detail page MUST display every field returned by `resource_show`: name, description, format, size, mimetype, created, modified, url, hash, state, and extras. Fields that are empty or null MUST be omitted or shown as "Not available".

#### Scenario: Full metadata available

- GIVEN a resource with all `resource_show` fields populated
- WHEN the user opens the resource detail page
- THEN every field is rendered with a human-readable label
- AND the created and modified dates are formatted for the user's locale

#### Scenario: Missing optional fields

- GIVEN a resource where description, hash, and extras are null
- WHEN the user opens the detail page
- THEN those fields are hidden or shown as "Not available"
- AND the remaining fields still render correctly

### Requirement: API Metadata

When a resource's `extras` indicate it is an API-type resource, the page MUST surface endpoint metadata, documentation URL, and request/response examples if present.

#### Scenario: API resource with complete extras

- GIVEN a resource whose extras contain `api_base_url`, `docs_url`, and `example_request`
- WHEN the user opens the detail page
- THEN the API endpoint, documentation link, and example are displayed in a dedicated section

#### Scenario: API resource with partial extras

- GIVEN a resource whose extras contain only `api_base_url`
- WHEN the user opens the detail page
- THEN only the endpoint metadata is shown
- AND the missing documentation link and example are omitted

### Requirement: Download Action

The page MUST provide a discreet download button that links to the resource's `url`.

#### Scenario: Download available

- GIVEN a resource with a valid `url`
- WHEN the user activates the download action
- THEN the browser navigates to or downloads the resource file

#### Scenario: Download unavailable

- GIVEN a resource where `url` is null or empty
- WHEN the user views the detail page
- THEN the download action is disabled or hidden

### Requirement: Breadcrumbs

The page MUST display breadcrumbs: `Datasets > [Organization name] > [Dataset title] > [Resource name]`. If the organization name is unavailable, the fallback path MUST be `Datasets > [Dataset title] > [Resource name]`.

#### Scenario: Full breadcrumb path

- GIVEN the parent dataset has an organization name
- WHEN the user opens the resource detail page
- THEN the breadcrumb shows all four levels

#### Scenario: Fallback breadcrumb path

- GIVEN the parent dataset has no organization name
- WHEN the user opens the resource detail page
- THEN the breadcrumb omits the organization level

### Requirement: Preview Placeholder

The page MUST reserve a visible placeholder area for a future data preview widget.

#### Scenario: Placeholder present

- GIVEN any resource detail page
- WHEN the page renders
- THEN a clearly bounded area is reserved for a preview widget
- AND the placeholder indicates that preview is coming soon

### Requirement: Missing Resource

If the requested resource does not exist, the page MUST render a "Resource not found" state.

#### Scenario: Unknown resource

- GIVEN a `resourceId` that does not exist in the catalog
- WHEN the user navigates to that resource detail page
- THEN a "Resource not found" message is displayed
- AND a link back to the parent dataset is provided
