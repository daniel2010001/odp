# Publication Lifecycle Specification

## Purpose

Define what makes a private dataset public, who may do it, what the platform guarantees about that permission, and what a caller sees when it is refused. The slice is deliberately minimal: **private → published only**.

This capability is specified separately from `dataset-publishing` because it is not a property of the creation wizard. The guarantee lives in CKAN's authorization layer, in the `umss` extension (`ckanext-umss`, repository `odp-docker`), while the portal only offers an affordance and reports CKAN's answer. `dataset-publishing` remains the contract of the portal's creation wizard; this capability is the contract of the transition itself.

**Out of scope for this slice** (explicit non-goals, not silent deferrals):

- Retraction: public → private after publication.
- Any `draft`, `review` or `approved` vocabulary, marker, or lifecycle `extras` key.
- A `publication_requests` store or any other durable approval record.
- Versioning of datasets.
- A collection-level approval gate.
- A search or facet filter by publication status.
- The known `current_package_list_with_resources` dashboard defect, which is independent of this lifecycle.

**Evidence (non-normative).** Enforcement is implemented in the `umss` extension in a different repository from the portal, so the portal's `pnpm test` cannot establish any requirement below. Every scenario is therefore stated as observable CKAN behavior that the extension's `pytest` suite or a live probe against the running CKAN can establish; portal-side scenarios are observable in Vitest component and API tests against a CKAN response. Measured baseline on 2026-09-14 against the running CKAN 2.11.6, **before** this change: an organization `editor` publishing its own organization's dataset with `package_patch {private: false}` answered `200` and stored `private: false`; `package_create {private: false}` and `package_create` with `private` omitted both answered `200` with a stored public dataset; a full `package_update` that omitted `private` left `private: true`; an organization `member` and an editor of another organization were already refused with `403`; `bulk_update_public` was already refused by CKAN's own authorization; and an `admin` of a **parent** organization publishing a dataset owned by a **child** organization answered `200` with `private=false`, so the approver cascade in `Approver Capacity` is measured rather than inferred from CKAN's source. Those measurements are the reason the requirements below name the create-time clause and the baseline they must not regress.

## Requirements

### Requirement: Publication Authorization

Making a private dataset public MUST require an explicit transition request that CKAN itself authorizes. A caller who holds only the dataset's ordinary edit capacity MUST be refused, and the refusal MUST be an authorization failure rather than a validation failure or a silent no-op: HTTP `403` with `error.__type = "Authorization Error"`, produced before validation or persistence, leaving every stored value of the dataset unchanged. Nothing of a refused request may be written.

#### Scenario: Organization editor attempts publication

- GIVEN a dataset stored with `private: true` and `state: "active"`, owned by an organization where the caller holds the `editor` capacity
- WHEN the caller sends `package_patch {id, private: false}` with its own token
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND a subsequent `package_show` reports `private: true` and `state: "active"`, unchanged

#### Scenario: Organization editor attempts a state change

- GIVEN the same caller and dataset
- WHEN the caller sends `package_patch {id, state: "draft"}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND a subsequent `package_show` reports `state: "active"`, unchanged
- AND this refusal is reachable, not theoretical: the same call answered `200` and stored `draft` before this change

#### Scenario: Organization editor attempts publication through a full update

- GIVEN the same caller and dataset
- WHEN the caller sends a `package_update` that carries the dataset's representation with `private: false`
- THEN CKAN answers `403` and the stored `private` remains `true`

#### Scenario: Organization editor attempts publication at create time with an explicit public value

- GIVEN the caller holds the `editor` capacity in the target organization
- WHEN the caller sends `package_create {name, owner_org, private: false}`
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND no dataset is created
- AND the same call answered `200` and stored a public dataset before this change

#### Scenario: Organization editor attempts publication at create time by omitting the field

- GIVEN the caller holds the `editor` capacity in the target organization
- WHEN the caller sends `package_create {name, owner_org}` with `private` absent
- THEN CKAN answers `403` with `error.__type = "Authorization Error"`
- AND no dataset is created
- AND an absent `private` is the same publish attempt as `false`, because at create time CKAN resolves it to its public column default

#### Scenario: Metadata edits stay allowed

- GIVEN the same caller and a dataset stored with `private: true`
- WHEN the caller sends `package_patch {id, title: "…", notes: "…"}`
- THEN CKAN answers `200` and applies the change
- AND the stored `private` and `state` remain unchanged

#### Scenario: A full update that omits `private` is not a publication attempt

- GIVEN the same caller and a dataset stored with `private: true`
- WHEN the caller sends a `package_update` with the dataset's full representation, omitting `private` and changing the title
- THEN CKAN answers `200` and applies the title change
- AND the stored `private` is still `true`
- AND omission is a publication attempt only at create time, never on update

#### Scenario: Unrelated writes stay allowed

- GIVEN the same caller and a dataset it can edit
- WHEN the caller creates a resource on it, or soft-deletes it with `package_delete`
- THEN CKAN answers `200` in both cases
- AND the publication rule does not refuse a request that asks for no visibility or state change

### Requirement: Approver Capacity

The publication transition MUST be allowed for a caller that holds the `admin` capacity in the dataset's owning organization, including an administrator of a parent organization in the organization hierarchy, and for a `sysadmin`. No extension-defined permission, custom action or new transport may be required for that call: the approver MUST be able to publish with stock `package_patch {id, private: false}`. The same predicate MUST be the only source of approver identity; the portal MUST NOT maintain its own role table.

#### Scenario: Organization administrator publishes

- GIVEN a dataset stored with `private: true` and a caller holding the `admin` capacity in its owning organization
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `200`
- AND the stored `private` is `false`, and the response body reports `private: false`

#### Scenario: Sysadmin publishes

- GIVEN a `sysadmin` caller and a dataset of any organization
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `200` and the stored `private` is `false`

#### Scenario: An administrator of a parent organization publishes

- GIVEN a caller holding the `admin` capacity in a parent organization and a dataset owned by a child organization
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `200` and the stored `private` is `false`

#### Scenario: One person holds both capacities

- GIVEN a caller that is both an `editor` and an `admin` of the owning organization
- WHEN the caller sends `package_patch {id, private: false}`
- THEN CKAN answers `200`
- AND no separate approver role has to be granted for the call to succeed

#### Scenario: An organization without an administrator has no other publication path

- GIVEN an organization whose members hold only the `editor` and `member` capacities
- WHEN any of them attempts the transition
- THEN CKAN answers `403` for all of them
- AND no portal-side role, setting or override grants it
- AND publishing such a dataset requires a `sysadmin`

### Requirement: Distinguishable Authorization Errors

Denials produced by the publication rule MUST be authorization failures: HTTP `403` with `error.__type = "Authorization Error"` and a message that names the missing capacity. Values the rule does not recognize and packages it cannot resolve MUST defer to core CKAN, which MUST answer with its own outcome, and MUST NOT be converted into a `403`.

#### Scenario: A refusal is not a validation error

- GIVEN an organization `editor` and a dataset it can edit
- WHEN it sends `package_patch {id, private: false}`
- THEN the response status is `403` with `error.__type = "Authorization Error"`
- AND it is not `409` and carries no field-level validation errors

#### Scenario: The message names the required role

- GIVEN the same refusal
- WHEN the response body is read
- THEN the message states that only an organization administrator can publish a dataset
- AND it is not a generic "not authorized to edit package" message

#### Scenario: An unrecognized value defers to core CKAN

- GIVEN an organization `editor`
- WHEN it sends `package_patch {id, private: "banana"}`
- THEN CKAN answers with its own validation error for the `private` field
- AND the publication rule does not turn that validation error into a `403`

#### Scenario: An unresolvable package defers to core CKAN

- GIVEN an organization `editor`
- WHEN it sends `package_patch {id: <an id that does not exist>, private: false}`
- THEN CKAN answers with its own not-found or validation outcome
- AND the publication rule does not answer `403` for a package it cannot resolve

#### Scenario: State at create time is not refused by this rule

- GIVEN a caller that is not a `sysadmin`
- WHEN it sends `package_create {name, owner_org, private: true, state: "draft"}`
- THEN the request is not refused by the publication rule
- AND CKAN's own behavior for a create-time `state` applies, so the stored `state` is `active`
- AND no refusal is issued for a request CKAN was not going to honor anyway

### Requirement: Preserved Refusals

Refusals that already held before this change MUST keep holding, and MUST NOT be attributed to the publication rule.

#### Scenario: A read-only member stays refused

- GIVEN a caller holding only the `member` capacity in the dataset's organization
- WHEN it sends `package_patch {id, private: false}`
- THEN CKAN answers `403`
- AND the stored `private` is unchanged

#### Scenario: An editor of another organization stays refused

- GIVEN a caller that is an `editor` of a different organization than the dataset's owner
- WHEN it sends `package_patch {id, private: false}`
- THEN CKAN answers `403`
- AND the stored `private` is unchanged

#### Scenario: Anonymous stays refused

- GIVEN a request with no API token
- WHEN it sends `package_patch {id, private: false}`
- THEN CKAN answers `403`
- AND the stored `private` is unchanged

#### Scenario: The bulk action is not a publication path

- GIVEN an organization `editor`
- WHEN it sends `bulk_update_public {org_id, datasets: [<a private dataset>]}`
- THEN CKAN answers `403` from its own authorization for that action
- AND the stored `private` is unchanged
- AND this is a documented non-path: the publication rule is not what refuses it

#### Scenario: An internal trusted caller is unaffected

- GIVEN an action executed inside CKAN with `ignore_auth` (a CLI command or a seed script)
- WHEN it publishes a dataset
- THEN it succeeds
- AND this escape hatch is intentional: it is the operational recovery path, and it does not weaken the refusals above

### Requirement: Published Datasets Reach The Catalogue

After an approver publishes a dataset, the dataset MUST be findable by an anonymous `package_search`, with no portal-side change to the catalogue query and without asking for private or draft results. A dataset that has not been published MUST stay absent from anonymous results. While a dataset is private, it MUST remain readable by every member of its owning organization.

#### Scenario: A published dataset appears

- GIVEN a dataset stored with `private: true` and a recorded anonymous result count
- WHEN an approver publishes it and an anonymous `package_search` is issued afterwards
- THEN the dataset appears in the results
- AND the anonymous result count has increased by one

#### Scenario: A private dataset stays absent

- GIVEN a dataset that has not been published
- WHEN an anonymous `package_search` is issued
- THEN the dataset does not appear in the results
- AND searching for a distinctive term from that dataset anonymously does not return it

#### Scenario: No private or draft flags are needed

- GIVEN an anonymous catalogue query issued by the portal
- WHEN the published dataset is returned
- THEN the query passed neither `include_private` nor `include_drafts`
- AND the portal's catalogue query is unchanged by this capability

#### Scenario: A private dataset is readable by its organization

- GIVEN a dataset stored with `private: true`
- WHEN a member of its owning organization that is not its creator calls `package_show`
- THEN CKAN answers `200`
- AND no user-facing copy may claim that a private dataset is visible only to its author

### Requirement: Portal Publish Affordance

The dataset page MUST offer the publication control only when CKAN reports the current user as an approver of the dataset's owning organization, determined by `organization_list_for_user {permission: "admin"}` cross-checked against the dataset's organization. The portal MUST NOT re-derive organization roles from any other source, MUST NOT treat an unfiltered organization list as proof, and MUST NOT offer the control when approval has not been confirmed. No control to reverse a publication may be offered, because retraction is out of this slice.

#### Scenario: A private dataset and an approver

- GIVEN a dataset whose stored `private` is `true`, and a user whose admin organizations include the dataset's organization
- WHEN the dataset page renders
- THEN a control labeled "Publicar dataset" is offered
- AND it states the consequence: "Será visible en el catálogo público."

#### Scenario: A private dataset and a non-approver

- GIVEN a dataset whose stored `private` is `true`, and a user who is not an administrator of its organization
- WHEN the dataset page renders
- THEN no publication control is offered
- AND the page states who can publish: "Solo un administrador de la organización puede publicar este dataset."

#### Scenario: The approver check fails

- GIVEN a dataset whose stored `private` is `true`
- WHEN the approver check cannot be completed
- THEN no publication control is offered
- AND an explicit state is shown: "No se pudo verificar su permiso para publicar."
- AND that state offers a retry action
- AND the affordance fails closed rather than showing a control that may be wrong

#### Scenario: An already-published dataset

- GIVEN a dataset whose stored `private` is `false`
- WHEN the dataset page renders
- THEN no publication control is offered
- AND no unpublish or make-private control is offered either

#### Scenario: The control performs the stock call

- GIVEN a rendered publication control
- WHEN the user activates it
- THEN the browser sends `POST /api/3/action/package_patch` with exactly `{id, private: false}`
- AND the request carries no `state` key
- AND the request carries no extension-specific action name

#### Scenario: The approver check uses the permission argument

- GIVEN an organization list obtained without `permission: "admin"`
- WHEN the portal decides whether to offer the control
- THEN that list is not treated as proof of approval
- AND the control is offered only after the admin-filtered check confirms it

### Requirement: No Fabricated Publication

The portal MUST render only what CKAN confirmed, and MUST NOT present a publication CKAN did not grant. The dataset state shown after a request MUST derive from CKAN's response, never from an optimistic assumption, and an authorization failure and a validation failure MUST be reported as different conditions.

#### Scenario: CKAN refuses with 403

- GIVEN a rendered publication control
- WHEN CKAN answers `403`
- THEN an inline alert is shown: "Solo un administrador de la organización puede publicar este dataset."
- AND the control is offered again
- AND the dataset is still shown as private

#### Scenario: CKAN answers 200 without granting publication

- GIVEN a rendered publication control
- WHEN CKAN answers `200` but the response reports `private` as `true`
- THEN the page states "El catálogo no confirmó la publicación."
- AND the dataset is still shown as private
- AND no success state is rendered

#### Scenario: CKAN confirms publication

- GIVEN a rendered publication control
- WHEN CKAN answers `200` and the response reports `private: false`
- THEN the page shows the dataset as public
- AND the page's dataset object is replaced by CKAN's response

#### Scenario: Another failure kind

- GIVEN a rendered publication control
- WHEN the request fails for a reason other than an authorization refusal
- THEN an explicit error state with a retry action is shown
- AND no success state is rendered

#### Scenario: No optimistic state and no promised lifecycle value

- GIVEN a publication request in flight
- WHEN the control renders while it is pending
- THEN the control reports a busy state and no success indicator
- AND no lifecycle value is asserted at dataset creation time by the portal alongside this call

### Requirement: Honest Lifecycle Copy

No user-facing string MUST promise a lifecycle step this slice does not implement. Shipped copy MUST NOT introduce `draft`, `review` or `approved` vocabulary, a publication-status marker, a review request or a versioning promise. Copy about who publishes MUST name the organization administrator, and copy about what private means MUST state that the dataset is readable by the members of its owning organization.

#### Scenario: No deferred vocabulary is shipped

- GIVEN every user-facing string shipped by this change
- WHEN it is reviewed
- THEN it contains no `draft`, `review` or `approved` term
- AND it contains no publication-status marker or review-request affordance

#### Scenario: Private reach is described accurately

- GIVEN any shipped string that describes what private means
- WHEN it is read
- THEN it states that the dataset is visible to the members of the owning organization
- AND it does not claim that only the author can see it

#### Scenario: A refusal names the missing capacity

- GIVEN a publication refusal surfaced to the user
- WHEN it is read
- THEN it names an administrator of the organization as the required role
- AND it is not a generic permission or network error message
