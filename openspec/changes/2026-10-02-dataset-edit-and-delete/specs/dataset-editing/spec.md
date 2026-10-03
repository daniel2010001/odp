# Dataset Editing Specification

## Purpose

Define what the portal may do to a dataset that already exists: edit its metadata, edit its resources
(including replacing a resource's file), and delete it logically. Everything is written from the
browser to CKAN's action API through the same-origin `/api/` proxy; the SvelteKit server MUST NOT
receive dataset payloads or file bytes. Visibility is deliberately outside this capability.

## Requirements

### Requirement: Edit Affordances Are Fail-Closed

The portal MUST render an edit or delete affordance only when it has asked CKAN whether the caller may
update the dataset's owning organization (`permission="update_dataset"`), and MUST NOT render such an
affordance otherwise. Hiding an affordance MUST NOT be treated as the security boundary: CKAN remains
the authority, and a request that CKAN rejects MUST be surfaced honestly.

#### Scenario: A caller who may edit

- GIVEN an authenticated user whose role in the dataset's `owner_org` allows `update_dataset`
- WHEN the dataset page or the dashboard row is rendered
- THEN the edit and delete affordances are present

#### Scenario: A caller who may not edit

- GIVEN an authenticated user whose role in the dataset's `owner_org` does not allow `update_dataset`
- WHEN the dataset page or the dashboard row is rendered
- THEN no edit or delete affordance is rendered
- AND no request to CKAN is made to discover this by failing

#### Scenario: The permission question fails

- GIVEN the permission question cannot be answered (network failure, 5xx, timeout)
- WHEN the page is rendered
- THEN no edit or delete affordance is rendered
- AND the page states that the permission could not be resolved instead of implying the user lacks it

### Requirement: The Edit Form Is the Creation Form

Editing MUST reuse the same form as creation — same fields, same validation, same resource list —
through a single component that receives a mode. The dataset's current values MUST populate that form,
and the slug MUST NOT be silently changeable: changing it would break every existing link to the
dataset.

#### Scenario: Opening the edit form

- GIVEN a dataset the caller may edit
- WHEN the edit route loads
- THEN the form is rendered in edit mode with the dataset's current values
- AND the slug is presented as fixed, or requires an explicit unlock to change

#### Scenario: Invalid input

- GIVEN the edit form with a field made invalid
- WHEN the caller submits
- THEN no request is sent to CKAN
- AND the offending field shows the same validation message the creation form shows

#### Scenario: The owning organization is not editable

- GIVEN a dataset that belongs to an organization
- WHEN the caller opens the edit form
- THEN the organization is shown as a fact, not as a control to change
- AND the write contains no organization field
- AND the form states that moving a dataset between organizations is a separate operation

### Requirement: Concurrent Edits Are Not Silently Lost

Saving an edit MUST assert the state the form was built from. If the dataset changed in the meantime,
the write MUST abort and the portal MUST tell the reader that the dataset changed, so the edit can be
re-applied against the current values. The portal MUST NOT silently overwrite a change it did not see,
and it MUST NOT build a locking or presence system for this: detecting the conflict is enough.

#### Scenario: Nobody else touched the dataset

- GIVEN a dataset the caller may edit and no other change since the form loaded
- WHEN the caller saves
- THEN the edit is applied and the portal reports it as saved

#### Scenario: The dataset changed while the form was open

- GIVEN a dataset that was modified after the form was loaded
- WHEN the caller saves
- THEN no field is overwritten
- AND the portal states that the dataset changed since the form was opened, and that the save must be
  redone against the current values

### Requirement: Metadata Edits Are Partial

An edit MUST send only the fields the form owns, using CKAN's partial update. The portal MUST NOT send a
full dataset payload for an edit, because CKAN's non-partial update removes every field that is not
present in it — including fields the portal does not know about. Fields that live inside a **list**
(`extras`, `resources`) MUST NOT be written by replacing that list: they MUST be written with an action
that updates the nested value and leaves the rest of the list alone.

#### Scenario: Fields the portal does not own survive an edit

- GIVEN a dataset carrying an extra the portal does not manage
- WHEN the caller edits the title through the portal
- THEN the edit is sent as a partial update containing only the form's fields
- AND the unmanaged extra is still present afterwards

#### Scenario: Editing a field that lives inside extras

- GIVEN a dataset with an unmanaged extra (for example `frequency`) and a portal-managed `summary` extra
- WHEN the caller edits the summary through the portal
- THEN the write updates the `summary` entry without replacing the extras list
- AND the unmanaged `frequency` extra is still present afterwards
- AND no other extra changed

#### Scenario: Creation keeps its full payload

- GIVEN the creation flow
- WHEN a dataset is created
- THEN the payload is the complete one the wizard has always sent
- AND the two payload shapes are asserted to differ on purpose

#### Scenario: Clearing a field clears it

- GIVEN a dataset whose summary and URL have values, opened for editing
- WHEN the caller empties those fields and saves
- THEN the write carries them as empty values instead of omitting them
- AND after saving, the summary and the URL are gone

#### Scenario: Nothing to clear and nothing to add

- GIVEN a dataset with no summary extra, opened for editing
- WHEN the caller saves with the summary still empty
- THEN the write adds no summary extra at all

### Requirement: Resources Are Written One at a Time

Editing a resource's metadata MUST NOT send the dataset's resource list as a whole, because a package
patch replaces that list entirely and a concurrent edit would be lost. Each resource is written
individually, and the order of the remaining resources MUST be preserved.

#### Scenario: Editing one resource of several

- GIVEN a dataset with three resources
- WHEN the caller edits the second resource's description
- THEN only that resource is written
- AND the other two keep their order, ids and metadata

### Requirement: Replacing a Resource File Requires a Reason

Replacing a resource's file MUST require a reason, and the portal MUST record the new file's SHA-256
hash, computed in the browser, because CKAN stores that field but never computes it. A replacement whose
bytes are identical to the current file MUST be refused with an explicit message rather than written as
a change.

#### Scenario: Replacing a file with a different one

- GIVEN a resource whose file has a recorded hash
- WHEN the caller uploads a different file and provides a reason
- THEN the file is replaced
- AND the portal reports that the bytes changed, with the previous and new hashes

#### Scenario: Replacing with the same bytes

- GIVEN a resource whose file has a recorded hash
- WHEN the caller uploads a file whose hash matches the recorded one
- THEN no write is issued
- AND the portal states that the file is identical

#### Scenario: A replacement without a reason

- GIVEN a resource whose file would change
- WHEN the caller submits the replacement without a reason
- THEN the write is refused and the reason is required

#### Scenario: A resource with no recorded hash

- GIVEN a resource created before hashes were recorded
- WHEN the resource is displayed
- THEN the portal states that no hash is recorded, and does not imply the file never changed

### Requirement: Datasets Are Deleted Logically

Deleting a dataset MUST use CKAN's logical delete, which is what a user of the portal may perform.
Permanent removal MUST NOT be offered. The confirmation MUST state three things: the dataset leaves the
portal and the catalogue; the portal offers no undo; and the dataset's slug remains taken, so the same
name cannot be reused for a new dataset.

#### Scenario: Deleting a dataset

- GIVEN a dataset the caller may edit
- WHEN the caller confirms the deletion
- THEN the dataset is deleted logically and disappears from the portal
- AND the dashboard list no longer shows it
- AND visiting its page shows the portal's honest not-found or forbidden state, never a broken page

#### Scenario: Recreating the same slug

- GIVEN a dataset that was deleted
- WHEN the caller tries to create a dataset with the same slug
- THEN CKAN's refusal is surfaced with the honest reason instead of a generic error

### Requirement: Visibility Is Out of This Capability

The edit form MUST NOT change a dataset's visibility. Changing visibility is governed by the
publication request flow and MUST be implemented by that capability, not by this one.

#### Scenario: Editing a dataset does not touch visibility

- GIVEN a dataset that is private
- WHEN the caller edits any metadata field
- THEN the partial update contains no visibility field
- AND the dataset remains private

#### Scenario: A draft state offered by CKAN

- GIVEN CKAN's `state` field, which a patch can set
- WHEN this capability writes metadata
- THEN it does not write `state`, except for the logical deletion defined above
