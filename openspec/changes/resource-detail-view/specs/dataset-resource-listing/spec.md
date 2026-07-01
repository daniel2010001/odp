# Dataset Resource Listing Specification

## Purpose

Define the behavior of the resource listing on a dataset page, including how each resource card links to its detail page.

## Requirements

### Requirement: Resource Card Navigation

Each resource card in the listing MUST act as a navigation element to the resource's detail page. The entire card MUST be clickable via mouse and keyboard.

#### Scenario: Click navigates to detail

- GIVEN a dataset page with one or more resource cards
- WHEN the user clicks a resource card
- THEN the browser navigates to `dataset/[id]/resource/[resourceId]`

#### Scenario: Keyboard activation

- GIVEN a dataset page with a resource card focused via keyboard
- WHEN the user presses Enter or Space
- THEN the browser navigates to the resource detail page

### Requirement: Card Information Display

Each resource card MUST display the resource name, format, and size. The card MUST NOT display a direct download action on the listing itself.

#### Scenario: Card renders metadata

- GIVEN a resource with name "Population CSV", format "CSV", and size "2.3 MB"
- WHEN the dataset page renders
- THEN the card shows "Population CSV", "CSV", and "2.3 MB"
- AND no direct download button is present on the card

#### Scenario: Missing size or format

- GIVEN a resource with name "API Endpoint" and no size or format
- WHEN the dataset page renders
- THEN the card shows "API Endpoint"
- AND the missing size and format labels are omitted

### Requirement: Accessibility

The resource listing MUST be traversable with a screen reader. Each card MUST have a descriptive accessible name that includes the resource name.

#### Scenario: Screen reader announces card

- GIVEN a resource card for "Population CSV"
- WHEN a screen reader focuses the card
- THEN the accessible name is announced as "Population CSV, resource detail"
