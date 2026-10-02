# Apply progress — dataset edit and delete

Record kept per slice: what landed, the evidence behind it, the receipt, and what the receipt's
advisories produced.

## Slice 1a — extract the form (a move, not a behaviour change)

**Commit:** `d6c693c` · **Receipt:** `review-ff8d537a39fa1a81` — **approved**, tier medium, one lens
(`review-reliability`), 3 files / **2966 changed lines**, **0 blocking findings, 1 advisory**.

### What landed

`src/lib/components/datasets/DatasetForm.svelte` (1486 lines) holds the field markup, the validation
wiring, the field-error map, the resource mini-form and list, the summary panel and the submit guard,
and takes `mode`, `initial`, the organization and license data and callbacks. The wizard page went from
**1747 to 369 lines** and keeps what is not the form: the session probe, organization and license
loading, resource upload execution, package creation and navigation. Net repo delta ≈ **108 lines** of
glue; the diff is overwhelmingly moved lines, and the commit body says so for the reviewer.

### Evidence

| Check | Result |
|---|---|
| Wizard tests | **30/30**, with the test file **byte-identical** |
| Full suite | **709/709** |
| `pnpm check` | 0 errors / 4 preexisting warnings |
| Biome | exit 0 |
| Live creation against CKAN | throwaway dataset created with the payload shape the form builds (title, notes, owning org, private, license, tags, `summary` as an extra) **plus a resource**; read back with both; purged; database count verified back to baseline (21 → 20) |
| Credentials | temporary token minted and revoked **inside the container**, never from a `.env` file; revocation proved by behaviour (0 tokens left in the list, the token's requests now answer 404) |
| Anti-drift anchor | `layout-header.test.ts` moved to the panel's new home **and extended** — the component is now also asserted not to drift back to a literal offset — instead of deleting the assertion |

### Declared deviation from `strict_tdd`

A pure move has no RED to observe: there is no new behaviour to fail first. `tasks.md` 1a declares this
and it applies only to this slice.

### The advisory, and why it was not chased

`R3-001` (WARNING): the new component concentrates submit validation and callback wiring, and this
candidate adds no test that mounts it directly, so its behaviour is proved only through the wizard's page
tests.

**Assessed and recorded, not chased.** The behaviour *is* exercised — the component renders inside the
wizard, and its 30 tests cover validation, resource add/edit, submit/cancel/retry, and pass untouched —
and the real path was proved end-to-end against CKAN. What the advisory points at is the component's
**own contract** (props, callbacks, mode), and that contract is exactly what slice 1b must pin: its spec
requires tests for the edit-mode payload and validation. If 1b's tests do not naturally cover the
component's contract, this becomes a task there rather than a footnote. The failure mode here would be a
loud one (the page tests would break), not a silent false green — which is the distinction this project
uses to decide what to chase.

### Also measured while verifying (worth keeping)

Two CKAN behaviours that cost time and will cost it again if forgotten:

- `ckan user token add` **ignores `--json`** in this version and prints `API Token created:` plus the
  token, with the CLI's `INFO` logs mixed into **stdout**; parsing the output as JSON fails.
- **`api_token_revoke` can return `{"success": true}` without revoking anything.** The token stayed
  alive and listed. The CLI (`ckan user token revoke <jti>`) is what actually revoked it, verified by
  effect: gone from the list, and its requests now answer 404.

## Next

Slice 1b (the edit route, the mode-aware payload, the fail-closed permission question and the concurrency
notice).
