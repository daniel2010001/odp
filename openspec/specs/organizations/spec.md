# Organizations Specification

## Purpose

Define the behavior of the public organization catalog: the list page (`/organizations`) and the organization detail page (`/organization/[id]`), backed by CKAN's `organization_list` and `organization_show` actions.

## Requirements

### Requirement: Organization Listing

The `/organizations` page MUST list all CKAN organizations with their title, description, category badge, and dataset count. Each card MUST link to the organization detail page.

#### Scenario: Organizations available

- GIVEN CKAN returns one or more organizations
- WHEN the user opens `/organizations`
- THEN each organization is rendered as a card with its title, description, category badge, and dataset count

#### Scenario: No organizations

- GIVEN CKAN returns an empty organization list
- WHEN the user opens `/organizations`
- THEN an empty state with the message "No hay organizaciones disponibles" is shown

#### Scenario: Catalog unavailable

- GIVEN CKAN is unreachable in production
- WHEN the user opens `/organizations`
- THEN an explicit error state with a retry action is shown
- AND no fabricated mock data is displayed

### Requirement: Organization Detail

The `/organization/[id]` page MUST resolve an organization by its id or slug and display its title, description, logo, dataset count, and the datasets it publishes.

#### Scenario: Organization found

- GIVEN a CKAN organization with id or slug `[id]`
- WHEN the user opens `/organization/[id]`
- THEN the page shows the organization title, description, logo, and dataset count
- AND lists the datasets published by that organization

#### Scenario: Organization not found

- GIVEN no CKAN organization matches `[id]`
- WHEN the user opens `/organization/[id]`
- THEN a "Organización no encontrada" state is shown with a link back to the catalog

#### Scenario: Organization has no datasets

- GIVEN an organization with zero published datasets
- WHEN the user opens its detail page
- THEN the message "Esta organización no tiene datasets publicados." is shown

### Requirement: Dataset Count Resolution

The dataset count for an organization MUST come from `package_count` when present, otherwise it MUST be derived from a `package_search` scoped to that organization with `limit: 0`.

#### Scenario: Count from package_count

- GIVEN an organization whose record includes `package_count`
- WHEN its card renders
- THEN the card shows the `package_count` value

#### Scenario: Count derived from search

- GIVEN an organization whose record does not include `package_count`
- WHEN its card renders
- THEN the card shows the `count` from a `package_search` filtered by that organization

### Requirement: Card Navigation and Accessibility

Each organization card MUST be a single clickable link to the detail page, operable by mouse and keyboard, with an accessible name that identifies the organization.

#### Scenario: Click navigates to detail

- GIVEN an organization card on the list page
- WHEN the user clicks it
- THEN the browser navigates to `/organization/[name]`

#### Scenario: Keyboard activation

- GIVEN an organization card focused via keyboard
- WHEN the user presses Enter
- THEN the browser navigates to `/organization/[name]`
