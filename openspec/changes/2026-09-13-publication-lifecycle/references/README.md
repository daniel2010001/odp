# References

External and preserved material for this change. **Nothing here is a change artifact.**
The four OpenSpec artifacts (`proposal.md`, `design.md`, `tasks.md`, `specs/`) remain the
contract; this directory is evidence and history, kept so a future reader can see where a
design came from and what was already considered. It never overrides the artifacts, and
nothing here is normative.

## `visibility-lifecycle-draft.ts.txt`

**Provenance.** A TypeScript draft of a document / visibility lifecycle written by the
maintainer for an **earlier, unrelated project** (Next.js), offered on 2026-09-17 as prior
art while this change is being replanned. It models a *different product*: the mismatch
table below lists where it cannot be followed. It is preserved as a design record, not
adopted as a design.

**Status: a non-functional draft, not an implementation.** It was executed as received on
2026-09-17 (`bun run`, from a copy outside this repository) and it computes nothing. The
statement that would evaluate each action is commented out, so the accumulator is never
filled: the output is **351 keys, every one `{true: "", false: ""}`**, and the only
distinct value ever produced is the empty string. The three state objects it iterates over
are `{} as any` placeholders mutated in place, and the dimension that distinguishes an
approved request from a rejected one is commented out as well. Read it as a sketch of a
model, never as a source of behavior.

**Preserved verbatim.** The file is byte-for-byte the draft as received. No comment,
correction or annotation was added to it, on purpose — an annotated copy would no longer
be "the draft as it was". Every observation about it lives in this document instead.

| | |
|---|---|
| `sha256` | `51b833ea050879a5aecfeefb552c05521bce92af075827371bdffac0f1fc9909` |
| size | 18 169 bytes |
| origin | `example.ts`, repository root, untracked, 2026-09-17 |
| moved here | 2026-09-17, hash verified unchanged after the move |

**Why the `.ts.txt` extension.** Verified on 2026-09-17: with a plain `.ts` extension
anywhere Biome scans (it scans the whole repository), `pnpm lint` treats this draft as
portal source and **fails** — 109 files checked, 1 error, exit 1. Renamed to `.ts.txt`,
Biome ignores it and the gate is exactly as before — 108 files, exit 0. The extension keeps
the language visible in the filename while keeping a never-compiled, non-source draft out
of the toolchain. **Do not rename it to `.ts`.** If the draft ever becomes real code, it
gets rewritten as portal or extension source in the right tree, not promoted from here.

## Deliberate intents, and what blocks adopting them

> **Corrected 2026-09-17, the same day.** The first version of this section attributed several of
> these elements to design oversights. The author then explained the intent behind each one, and two
> of those explanations changed the conclusion: the elements were **deliberate**, and one of them —
> per-version visibility — turns out to be a **requirement this product already has** (`RF-14`), not
> an imported idea. What is blocked is adopting each element **verbatim in this product**, not the
> idea behind it. The correction stays visible on purpose: misattributing intent is exactly the kind
> of error this directory exists to prevent.

| Element | Deliberate intent (author, 2026-09-17) | What blocks adopting it verbatim here |
|---|---|---|
| Three visibility levels `private` / `restricted` / `public` with a rank | A **wider axis than the PRD's three levels**: sharing beyond one organization, or with groups inside it. That is why the middle level is named `restricted` and not the PRD's `internal` | Not the intent — the **carrier**. CKAN's visibility is one package-level boolean, so a *level* cannot express an arbitrary audience. An audience-scoped model is a **grant list**, and CKAN's only extension point is `IPermissionLabels` — the same path `PRD §7` names for the author-only level deferred to `v1+`. The durable insight is that the draft's axis **conflates two things**: the level (who, in general) and the audience set (which organizations or groups). A future model has to split them |
| `Visibility` carried on a *version* (`DocumentVersion`) | Versions carry their own visibility, so sensitive content inside an already-public version can be hidden | **Nothing about the intent: `RF-14` already requires it** — "cada versión tiene: … visibilidad propia (hereda de la versión base, pero puede ser distinta)". What blocks it today is that CKAN has a single package-level flag and no versioned approval state (`PRD §7`: `versions` → `activity` "insuficiente"), and that versioning is its own feature. This is a **deferred requirement, not a discarded idea** |
| `ActorRole = 'admin' \| 'reviewer'`, organization-free | An **abstraction over roles**, not a literal role list to be taken at face value | The abstraction needs a **scope** parameter. In this product the approver is not a global role but an organization capacity (`PRD §9`), so the abstraction has to be `(role, scope)`; otherwise it cannot express "admin *of this* organization" |
| `approve_visibility` guarded by `canWorkEditorial` | (not stated) | It lets the **reviewer** (≈ steward) approve a visibility change. `PRD §9` grants that approval to Org Admin only — a conformance question to settle whenever the draft's roles are mapped onto CKAN capacities |
| `set_visibility` — direct change, any direction, no reason | One refactor covering **both directions**, with another layer still to be added to tell them apart | That missing layer **is** the security boundary. Under `RF-15.5` the two directions are different operations: raising = request + approval; lowering = direct organization-admin action with a mandatory reason (`RF-42`). The draft's single action under a single guard is the bypass; the split the author already anticipated is the fix |
| `delete` / `restore` guarded by `canManageLifecycle` | **Conceptual**, like `ActorRole` | Nothing conceptual. It is **out of scope for this change** (`RF-35`/`RF-36`, later tiers). One boundary to settle when that feature is designed: `PRD §9` reserves soft-delete to superadmin |
| `DocumentStatus` (`active`/`archived`/`disabled`) and soft-delete | Analysed **because soft-delete cannot be undone by ordinary users** — the status exists to express who may revert what | Nothing conceptual; it is `RF-35`/`RF-36`, another feature. The privilege boundary (who restores) is the real design content and should be kept when that feature is built |
| `published` as the *editorial* state name | (not stated) | In the draft it means "review passed", which the PRD calls `approved`. Adopting it would give the word `published` three meanings in a repository that already uses CKAN's `state` and the PRD's `published` |

## What is worth carrying over

1. **`can` / `apply` split with a mapped-type handler map** (`{[K in Action['type']]: Handler<K>}`).
   Gives compile-time exhaustiveness: adding an action without its handler is a type error.
   The right shape for the portal's state machines.
2. **A pure `apply` that returns the next state *and* the audit events it produced.** The audit
   becomes a return value instead of a side effect. This is what makes "the portal renders only
   what CKAN confirmed" (`No Fabricated Publication`) testable, and it fits `RF-33`.
3. **A generalized `cancelPendingRequest`.** Any transition that makes a pending request moot
   cancels it, with a reason. This is `RF-42`'s annulment generalized to `delete`/`reject`/
   `back_to_draft`, and it is a better rule than the one this change had written.
4. **The gate direction.** `propose_visibility` requires the editorial state to be already
   approved. Confirms `RF-15.3 → RF-15.4`: review approval precedes a visibility request. The
   design has to encode that ordering.
5. **Three separate axes** — access, editorial, visibility — instead of one enum. `RF-09` mixes
   lifecycle and visibility, and `RF-35`/`RF-36` add access status. Keeping the axes distinct is
   a real modelling improvement even while only one is implemented.
6. **`visibilityRank` plus `isHigher`/`isLower`.** Needed for direction: `RF-42`'s
   direct degradation is downward-only.

## Findings this draft corroborates

Both were found independently while reviewing this change's artifacts; the draft reproduces
them, which is why they are worth trusting.

- **Level naming is a trap — and it is our trap, not the draft's.** The hazard lives in `PRD §7`:
  the level the PRD calls `private` is the one CKAN does not have, while CKAN's own `private: true`
  **is** the PRD's "internal". The draft simply reuses the same word for its narrowest level, so
  adopting its vocabulary would carry the collision into the schema. A `requested_visibility` column
  storing the word `private` would be describing something else. With two levels, the only reachable
  targets today are *internal* and *public*.
- **The annulled state is missing from the schema.** The draft "cancels" a pending request by
  writing `status: 'resolved'`, `resolution: 'rejected'` — after which "the approver rejected
  it" and "it became moot" are indistinguishable. `PRD §7`'s `publication_requests` schema
  declares only `pending`/`approved`/`rejected` and has the same gap, while `RF-42` requires
  annulment. Two independent sources, same conclusion: the request needs an annulled/cancelled
  outcome (or equivalent fields), not a reused `rejected`.

## What happens next

- These six items are to be folded into `design.md` when the change is replanned
  (`proposal → spec → design → tasks`), as the reason each pattern is used. Until then, this
  document is the only place they are recorded.
- The corrected intents are also design material for **other** features, and should travel with
  them: per-version visibility belongs to the versioning feature (`RF-14`/`RF-16`/`RF-17`), and the
  audience-set axis (many organizations or groups, as opposed to a level) belongs to the deferred
  `v1+` visibility work that `IPermissionLabels` would carry.
- If the replan renames or replaces this change directory, **this directory moves with it**,
  so the record archives next to whatever change actually consumes it.
- The draft is untracked until the next commit of the change's artifacts. It is deliberately
  left that way rather than committed on its own.
