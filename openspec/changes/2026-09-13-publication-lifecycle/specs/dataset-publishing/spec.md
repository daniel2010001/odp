# Delta for Dataset Publishing

## MODIFIED Requirements

### Requirement: Visibility

Datasets MUST always be created **private**: the wizard MUST NOT offer a visibility choice, and `package_create` MUST be called with `private: true` for every submission. Publication MUST be a separate, authorized transition performed by an administrator of the owning organization (see the `publication-lifecycle` capability), never a field of the creation form. The wizard MUST state in the UI that the dataset will be created private, that publishing it requires an organization administrator, and that a private dataset is readable by every member of the owning organization.

(Previously: visibility was an explicit private/public choice in the form, and a "public submission" called `package_create` with `private: false`.)

#### Scenario: The wizard always creates privately

- GIVEN a valid form submission
- WHEN the payload is built
- THEN `package_create` is called with `private: true`
- AND the payload carries no `state` key

#### Scenario: No visibility control is offered

- GIVEN a freshly loaded wizard
- WHEN the form renders
- THEN no private/public choice is rendered
- AND the copy states that the dataset will be created private

#### Scenario: The form cannot produce a public dataset

- GIVEN any wizard state, including one where every optional field is filled
- WHEN the payload is built
- THEN the payload never contains `private: false`

#### Scenario: Publication is not a form field

- GIVEN a dataset created by the wizard
- WHEN a caller that is not an organization administrator tries to make it public
- THEN the wizard performs no transition and CKAN refuses it
- AND the refusal is surfaced as an authorization error, not as a form validation error

#### Scenario: Private reach is described accurately

- GIVEN the wizard copy that describes privacy
- WHEN it renders
- THEN it states that a private dataset is visible to the members of the owning organization
- AND it does not claim that only the author can see it

#### Scenario: Who publishes is named

- GIVEN the wizard copy that mentions publication
- WHEN it renders
- THEN it names an administrator of the organization as the role that publishes the dataset
- AND it does not describe a review, approval or draft step

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
| Visibility | `private` | Always `private: true` | Not a form field: the wizard always creates private, and publication is a separate authorized transition (see `publication-lifecycle`) |
| Landing page | `url` | No | DCAT `dcat:landingPage` maps here natively |
| Maintainer | `maintainer` | No | DCAT publisher/contact fall back to this |
| Publisher email | `maintainer_email` | No | |

**No DCAT `extras` are written in `v0`.** The only `extras` entry the wizard writes is the portal's own `summary` key (RF-40, `SUMMARY_EXTRA_KEY = "summary"`), which maps to no external vocabulary and is omitted entirely when no summary is provided. See the deferred interoperability requirement below for the reason and the evidence.

The payload builder MUST omit empty optional values rather than sending empty strings.

(Previously: the rule claimed no `extras` were written at all, and the visibility row described a form field defaulting to private; both contradicted the shipped `summary` extra and the removed visibility control.)

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

#### Scenario: The portal summary is the only extras entry

- GIVEN a submission with the summary filled
- WHEN the payload is built
- THEN `extras` contains exactly one entry, with key `summary`
- AND no DCAT key is present

#### Scenario: No summary means no extras

- GIVEN a submission with the summary left empty
- WHEN the payload is built
- THEN the payload contains no `extras` entry

#### Scenario: Required field missing

- GIVEN the title, the slug or the organization is empty
- WHEN the user submits
- THEN submission is blocked
- AND each missing field is marked with an accessible error message
- AND no request to CKAN is issued

### Requirement: Deferred Interoperability Metadata

The wizard MUST NOT write DCAT-specific `extras` in `v0`. Interoperability fields that have no native CKAN equivalent MUST be deferred until a DCAT profile is actually adopted, and the deferral MUST be documented with its reason.

(Previously: the reason and the deferral are unchanged; only the blanket claim that no `extras` entry exists at all is corrected.)

Reason, verified against the ckanext-dcat source on 2026-09-11: the extras vocabulary is **not stable across ckanext-dcat's own profiles**. The legacy `euro_dcat_ap` converters write `dcat_issued`, `dcat_modified`, `dcat_publisher_name`, `dcat_publisher_email`, `dcat_creator_name`, `guid` and a bare `language` (comma-joined); the scheming-based profile stores the same properties as first-level custom fields instead. Freezing key names before choosing a profile would force a migration of every dataset created in the meantime.

What `v0` needs is already covered natively: `dct:issued` and `dct:modified` fall back to `metadata_created` and `metadata_modified`, the publisher falls back to the owning organization, and the creator falls back to `author`.

#### Scenario: No DCAT extras are written

- GIVEN a wizard submission with every optional field filled
- WHEN the payload is built
- THEN it contains no DCAT `extras` entries
- AND every collected value maps to a native CKAN field, except the portal's own `summary` key (RF-40)

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
