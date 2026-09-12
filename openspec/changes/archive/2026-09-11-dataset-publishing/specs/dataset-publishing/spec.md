# Dataset Publishing Specification

## Purpose

Define the behavior of the portal's dataset creation wizard (`/dashboard/datasets/new`): who may use it, which metadata it collects, how that metadata maps onto CKAN's `package_create` payload, and how resources are uploaded to CKAN's FileStore. All writes go from the browser to CKAN's action API through the same-origin `/api/` proxy; the SvelteKit server MUST NOT receive dataset payloads or file bytes.

## Requirements

### Requirement: Wizard Access Control

The wizard MUST be reachable only by authenticated users. An unauthenticated visitor MUST be redirected to `/auth/login`. The redirect MUST happen without rendering the form, and MUST NOT send any request to CKAN.

#### Scenario: Unauthenticated visitor

- GIVEN no session token in the auth store
- WHEN the user opens `/dashboard/datasets/new`
- THEN the browser is redirected to `/auth/login`
- AND no request to `/api/3/action/*` is issued

#### Scenario: Authenticated user

- GIVEN a session token in the auth store
- WHEN the user opens `/dashboard/datasets/new`
- THEN the metadata form is rendered

### Requirement: Organization Selection Scope

The organization select MUST be populated from `organization_list_for_user` with `permission="create_dataset"`, so that only organizations where the current user is allowed to create datasets are offered. The feature MUST NOT fall back to the full organization list or to the same action without the permission argument, because CKAN rejects `package_create` for organizations the user cannot write to.

Measured on the dev instance on 2026-09-11: with the argument, an `editor` sees the organization and a plain `member` sees an empty list. **Without** the argument, a plain `member` also sees the organization — so the permission argument is what makes the select correct, not a refinement of it.

#### Scenario: User belongs to one or more writable organizations

- GIVEN the user has editor or admin rights in at least one organization
- WHEN the wizard loads
- THEN the select lists exactly those organizations, by title, with the slug as value

#### Scenario: Plain member is not offered the organization

- GIVEN the user is only a `member` of an organization
- WHEN the wizard loads
- THEN that organization does not appear in the select
- AND the wizard does not fall back to an unfiltered organization list

#### Scenario: User has no writable organization

- GIVEN `organization_list_for_user` returns an empty list
- WHEN the wizard loads
- THEN the form is not usable and an explicit state is shown explaining that the user needs editor rights in an organization
- AND no organization select is rendered

#### Scenario: Organization list unavailable

- GIVEN the organizations request fails
- WHEN the wizard loads
- THEN an explicit error state with a retry action is shown
- AND the form is not rendered with a fabricated or empty organization

### Requirement: Dataset Metadata Fields

The wizard MUST collect the following metadata and map it onto CKAN's `package_create` payload, using **native CKAN fields only**:

| Form field | CKAN field | Required | Notes |
|---|---|---|---|
| Title | `title` | Yes | |
| Slug | `name` | Yes | Slug or CKAN-generated; see the slug contract |
| Description | `notes` | No | |
| Organization | `owner_org` | Yes | Slug or UUID; the select submits the slug |
| License | `license_id` | No | |
| Tags | `tag_string` | No | Comma-separated; CKAN splits it |
| Visibility | `private` | Yes, defaults to private | |
| Landing page | `url` | No | DCAT `dcat:landingPage` maps here natively |
| Maintainer | `maintainer` | No | DCAT publisher/contact fall back to this |
| Publisher email | `maintainer_email` | No | |

**No `extras` are written in `v0`.** See the deferred interoperability requirement below for the reason and the evidence.

The payload builder MUST omit empty optional values rather than sending empty strings.

#### Scenario: Minimum valid submission

- GIVEN a title, a slug and an organization
- WHEN the user submits
- THEN `package_create` is called with `title`, `name`, `owner_org` and `private: true`
- AND the payload carries no empty optional values

#### Scenario: Optional metadata included

- GIVEN the user filled description, license, tags, landing page and maintainer
- WHEN the user submits
- THEN the payload includes `notes`, `license_id`, `tag_string`, `url` and `maintainer`
- AND every one of those values sits in a native CKAN field, not in `extras`

#### Scenario: Required field missing

- GIVEN the title, the slug or the organization is empty
- WHEN the user submits
- THEN submission is blocked
- AND each missing field is marked with an accessible error message
- AND no request to CKAN is issued

### Requirement: Deferred Interoperability Metadata

The wizard MUST NOT write DCAT-specific `extras` in `v0`. Interoperability fields that have no native CKAN equivalent MUST be deferred until a DCAT profile is actually adopted, and the deferral MUST be documented with its reason.

Reason, verified against the ckanext-dcat source on 2026-09-11: the extras vocabulary is **not stable across ckanext-dcat's own profiles**. The legacy `euro_dcat_ap` converters write `dcat_issued`, `dcat_modified`, `dcat_publisher_name`, `dcat_publisher_email`, `dcat_creator_name`, `guid` and a bare `language` (comma-joined); the scheming-based profile stores the same properties as first-level custom fields instead. Freezing key names before choosing a profile would force a migration of every dataset created in the meantime.

What `v0` needs is already covered natively: `dct:issued` and `dct:modified` fall back to `metadata_created` and `metadata_modified`, the publisher falls back to the owning organization, and the creator falls back to `author`.

#### Scenario: No DCAT extras are written

- GIVEN a wizard submission with every optional field filled
- WHEN the payload is built
- THEN it contains no `extras` entries
- AND every collected value maps to a native CKAN field

#### Scenario: Deferred fields are not offered

- GIVEN the wizard form
- WHEN it renders
- THEN it offers no language or update-frequency input
- AND the deferral and its reason are recorded in the change artifacts

#### Scenario: DCAT keys are fixed only with a profile

- GIVEN a future decision to export DCAT-AP
- WHEN extra key names are chosen
- THEN the chosen keys match the profile in use, legacy or scheming
- AND the choice is recorded before any dataset is created with them

### Requirement: Slug Contract

The slug MUST match `^[a-z0-9_-]+$` with a length of 2 to 100 characters. The wizard MUST suggest a slug derived from the title, and MUST let the user edit it. If CKAN rejects the creation because the slug already exists, the wizard MUST show an explicit conflict message that names the slug, and MUST keep the user's input so it can be corrected without retyping the rest of the form.

#### Scenario: Slug suggested from the title

- GIVEN the user types the title "Matrícula Estudiantil 2026"
- WHEN the slug field has not been edited manually
- THEN the slug is suggested as `matricula-estudiantil-2026`

#### Scenario: Manually edited slug is preserved

- GIVEN the user edited the slug by hand
- WHEN the title changes afterwards
- THEN the slug is NOT overwritten

#### Scenario: Slug collision

- GIVEN a dataset already uses the submitted slug
- WHEN the user submits
- THEN an explicit message names the colliding slug and asks for a different one
- AND the rest of the form keeps its values

### Requirement: Visibility

Visibility MUST be an explicit choice between private and public, defaulting to **private**. A private dataset MUST be created with `private: true`; a public one with `private: false`. The wizard MUST state in the UI that a private dataset is visible only to the owning organization.

#### Scenario: Default visibility

- GIVEN a freshly loaded wizard
- WHEN the form renders
- THEN private is the selected visibility

#### Scenario: Public submission

- GIVEN the user selects public
- WHEN the user submits
- THEN `package_create` is called with `private: false`

### Requirement: Resource Upload Transport

Resource upload MUST be a browser-direct `POST` to `/api/3/action/resource_create` as `multipart/form-data`, with the file in a part named `upload` and the dataset in a part named `package_id`. The request MUST NOT set the `Content-Type` header explicitly, because doing so drops the multipart boundary and CKAN rejects the file. The request MUST carry the session token in the `Authorization` header. No file bytes may pass through the SvelteKit server.

#### Scenario: Single file upload

- GIVEN a created dataset and one selected file
- WHEN the upload runs
- THEN a multipart request is sent to `/api/3/action/resource_create`
- AND the body contains a file part named `upload` and a `package_id` part
- AND the `Content-Type` header is left unset so the browser supplies the boundary
- AND the `Authorization` header carries the session token

#### Scenario: Multiple files

- GIVEN several selected files
- WHEN the upload runs
- THEN one `resource_create` request is issued per file
- AND files are uploaded sequentially, not in parallel, so progress stays readable

#### Scenario: Link resource instead of a file

- GIVEN the user provides a URL and a name instead of a file
- WHEN the user submits
- THEN `resource_create` is called with JSON containing `url` and `package_id`

### Requirement: Resource Size Limit

A single resource MUST NOT exceed 50 MB (PRD RF-12). The wizard MUST validate file size in the browser **before** sending any bytes, and MUST report the offending file by name with its actual size. The limit MUST come from one exported constant.

#### Scenario: File within the limit

- GIVEN a file of exactly 50 MB
- WHEN the user submits
- THEN the file is accepted for upload

#### Scenario: File over the limit

- GIVEN a file larger than 50 MB
- WHEN the user selects or submits it
- THEN the file is rejected with a message naming it and stating its size
- AND no request is issued for that file

### Requirement: Upload Progress and Cancellation

While a file is uploading, the wizard MUST show per-file progress and MUST allow cancelling the upload. Cancelling MUST abort the in-flight request and MUST NOT leave the file marked as uploaded.

#### Scenario: Progress is reported

- GIVEN an upload in flight
- WHEN the transfer advances
- THEN the progress for that file is updated
- AND the user cannot submit the same file twice while it is in flight

#### Scenario: Upload cancelled

- GIVEN an upload in flight
- WHEN the user cancels it
- THEN the request is aborted
- AND the file is shown as cancelled rather than uploaded

### Requirement: Partial Failure Handling

If the dataset is created but one or more uploads fail, the wizard MUST keep the dataset and report the failure **per file**. It MUST NOT present the operation as fully successful, and it MUST NOT silently swallow the error. The user MUST be given a way to retry the failed files against the already-created dataset.

#### Scenario: One of several uploads fails

- GIVEN a created dataset and three selected files
- WHEN two uploads succeed and one fails
- THEN the wizard reports exactly which file failed and why
- AND the dataset remains created
- AND the successful resources remain attached

#### Scenario: Dataset creation fails

- GIVEN `package_create` returns an error
- WHEN the user submits
- THEN the error is shown against the form
- AND no upload is attempted, because there is no dataset to attach to

### Requirement: Success Navigation

On full success the wizard MUST navigate to the created dataset's page, so the user immediately sees the dataset and its resources.

#### Scenario: Dataset and resources created

- GIVEN the dataset was created and every selected file uploaded
- WHEN the last upload completes
- THEN the browser navigates to `/dataset/[name]` of the created dataset

#### Scenario: Dataset created with no resources

- GIVEN the dataset was created and no file was selected
- WHEN creation succeeds
- THEN the browser navigates to the created dataset's page
- AND the dataset is shown without resources

### Requirement: Form Accessibility

Every field MUST have a programmatically associated label. Validation errors MUST be associated with their field and announced to assistive technology. The submit control MUST be reachable and operable by keyboard, and MUST expose a disabled or busy state while a request is in flight.

#### Scenario: Error announced

- GIVEN an invalid field on submit
- WHEN the error is rendered
- THEN the field references its error message
- AND the error is discoverable by assistive technology without moving focus away from the field

#### Scenario: Busy state

- GIVEN a submission in flight
- WHEN the form renders
- THEN the submit control reports itself as busy and is not operable again until the request resolves

#### Scenario: No horizontal scroll on mobile

- GIVEN a viewport width of 360 px
- WHEN the wizard renders
- THEN the page has no horizontal scrolling

### Requirement: Dashboard Overview

The dashboard (`/dashboard`) MUST present the authenticated user's workspace: the datasets they can edit, the organizations they belong to, and a call to action that opens the publishing wizard. It MUST be reachable only by authenticated users, redirecting unauthenticated visitors to `/auth/login` without issuing a CKAN request.

#### Scenario: Authenticated user sees their workspace

- GIVEN a session token in the auth store
- WHEN the user opens `/dashboard`
- THEN the page lists the datasets the user can edit, by title, linking to each dataset page
- AND it lists the organizations the user belongs to, by title, linking to each organization page
- AND it offers a call to action to `/dashboard/datasets/new`

#### Scenario: Unauthenticated visitor

- GIVEN no session token
- WHEN the user opens `/dashboard`
- THEN the browser is redirected to `/auth/login`
- AND no request to `/api/3/action/*` is issued

#### Scenario: Empty dataset list

- GIVEN the user can edit no dataset
- WHEN the page loads
- THEN an explicit empty state is shown instead of a blank list
- AND the call to action to publish a dataset is still offered

#### Scenario: A request fails

- GIVEN the dataset or the organization request fails
- WHEN the page loads
- THEN the failure is shown with a retry action
- AND the section that did load stays visible
