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

### Requirement: Authorization Failure Is Not a Missing Resource

An authorization failure (HTTP `403`) MUST NOT be rendered as the "not found" state, and the two MUST remain distinguishable to the viewer. Because the catalog answers the same `403` to a session that is no longer valid and to a genuine permission denial, the message MUST agree with what is known about the viewer's session instead of asserting a single cause.

#### Scenario: Authorization failure is not a missing resource

- GIVEN a resource that exists but is not readable by the current viewer
- WHEN the catalog answers with a `403` authorization failure
- THEN the page renders an authorization state
- AND the state does not state that the resource was not found

#### Scenario: Viewer with a live session is not authorized

- GIVEN a viewer whose stored session is still valid and whose account is not authorized to read the resource
- WHEN the catalog answers with a `403`
- THEN the message states that the resource exists but the account is not authorized to see it
- AND the message does not ask the viewer to sign in

#### Scenario: Stored session is no longer valid

- GIVEN a viewer whose stored session is no longer valid
- WHEN the catalog answers with a `403`
- THEN the viewer is handled as holding an invalid session, as the authentication capability defines
- AND the viewer is not shown an authorization message as if the account lacked permission

#### Scenario: Viewer with no session

- GIVEN a viewer with no stored session
- WHEN the catalog answers with a `403` for a private resource
- THEN the message states that the resource is private and asks the viewer to sign in with an authorized account
- AND the message does not state that the session expired

#### Scenario: Unavailable catalog is not an absent or private resource

- GIVEN the catalog cannot be reached, times out, or answers with a server error
- WHEN the page loads
- THEN the page reports a connection or catalog failure
- AND the state does not state that the resource is missing or private
- AND retrying is presented as reasonable

#### Scenario: Development does not mask a definitive answer

- GIVEN the application runs in development
- WHEN the catalog answers with a definitive `403` or `404`
- THEN the failure is reported to the viewer
- AND sample data is not substituted for the catalog's answer
