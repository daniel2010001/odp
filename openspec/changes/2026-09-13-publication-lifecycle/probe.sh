#!/bin/sh
#
# probe.sh — live evidence for the publication-lifecycle enforcement guard (PR 1).
#
# WHAT THIS IS. A measurement harness, not a test suite. It is the only evidence
# that covers the *running* CKAN image; `pytest` in `ckanext-umss` proves the
# predicate in-process and cannot prove that the deployment runs this code. The
# expectations below are the post-guard target of design.md's truth table (D3);
# every `403` row answered `200` before the guard existed.
#
# WHERE IT LIVES AND WHY. The script sits in the change directory of the `odp`
# repository because that is the path a reviewer of PR 1 already reads, even
# though the enforcement it measures lives in `odp-docker`. Without PR 1 its
# expectations cannot be satisfied, so it is carried by PR 1.
#
# HOW TO RUN (from /home/danielblc/projects/odp):
#
#     sh openspec/changes/2026-09-13-publication-lifecycle/probe.sh
#
# Override the endpoint or the container with PROBE_API / PROBE_CKAN_CONTAINER.
# Needs: curl, jq, python3, and `docker exec` access to the CKAN container.
#
# WHAT IT TOUCHES. A `probe-lc-<timestamp>` organization, a second organization,
# a parent/child organization pair, four users, five private datasets and one
# token per user, all names carrying that prefix. P9 removes all of it inside
# this script: package_delete + `ckan dataset purge`, organization_purge,
# api_token_revoke by `jti` (verified by listing, because a revoke of an unknown
# `jti` also answers `success: true`), user_delete, and a final anonymous count
# check against the pre-run baseline. The only residual is that CKAN 2.11.6
# exposes no user hard-delete, so the four probe users survive as
# `state='deleted'` rows.
#
# MECHANICS WORTH NOT REDISCOVERING (measured 2026-09-14):
#   * `api_token_create {user: <other user>}` returns no `result.id`, so a
#     sysadmin-minted token's `jti` is only obtainable via `api_token_list`.
#   * `api_token_revoke` answers `success: true` when the `jti` matches no token,
#     so its success is not evidence; this run verifies by listing.
#   * the org-hierarchy row is inverted from the intuitive reading: it is
#     `{id: <child>, object: <parent>, object_type: "group", capacity: "parent"}`.
#     The other direction answers `200` and registers nothing the cascade reads.
#   * `expire_api_token` makes `expires_in` and `unit` mandatory.
#
set -u

API="${PROBE_API:-http://localhost:8082/api/3/action}"
CONTAINER="${PROBE_CKAN_CONTAINER:-odp-dev-ckan-dev-1}"
INI="${PROBE_CKAN_INI:-/srv/app/ckan.ini}"
STAMP="$(date +%Y%m%d%H%M%S)"
PREFIX="probe-lc-$STAMP"

CHECKS=0
FAILURES=0
STATUS=''
BODY=''

say() { printf '%s\n' "$*"; }
hr() { printf -- '--------------------------------------------------------------------------------\n'; }

# call <token|-> <action> <json-body> ; sets STATUS and BODY
call() {
    _token="$1"; _action="$2"; _data="$3"; _tmp="$(mktemp)"
    if [ "$_token" = '-' ]; then
        STATUS="$(curl -sS -o "$_tmp" -w '%{http_code}' -X POST "$API/$_action" \
            -H 'Content-Type: application/json' -d "$_data")"
    else
        STATUS="$(curl -sS -o "$_tmp" -w '%{http_code}' -X POST "$API/$_action" \
            -H 'Content-Type: application/json' -H "Authorization: $_token" -d "$_data")"
    fi
    BODY="$(cat "$_tmp")"; rm -f "$_tmp"
}

# jq_get <jq-filter> — prints nothing when BODY is not JSON
jq_get() { printf '%s' "$BODY" | jq -r "$1" 2>/dev/null; }

# jwt_jti <jwt> — the `jti` claim, used to revoke the token minted via the CLI
jwt_jti() {
    python3 -c 'import base64,json,sys
p=sys.argv[1].split(".")[1]
p+="="*(-len(p)%4)
print(json.loads(base64.urlsafe_b64decode(p))["jti"])' "$1"
}

# check <row-id> <expected-status> <description> [expected error.__type]
check() {
    CHECKS=$((CHECKS + 1)); _verdict=PASS
    [ "$STATUS" = "$2" ] || _verdict=FAIL
    if [ "$#" -ge 4 ]; then
        _type="$(jq_get '.error.__type')"
        [ "$_type" = "$4" ] || _verdict=FAIL
    fi
    [ "$_verdict" = FAIL ] && FAILURES=$((FAILURES + 1))
    printf '%-5s %-4s want=%s got=%s  %s\n' "$1" "$_verdict" "$2" "$STATUS" "$3"
    printf '      body: %s\n' "$(printf '%s' "$BODY" | tr -d '\n' | cut -c1-320)"
}

# value <row-id> <actual> <expected> <description> — for non-HTTP assertions
value() {
    CHECKS=$((CHECKS + 1)); _verdict=PASS
    [ "$2" = "$3" ] || { _verdict=FAIL; FAILURES=$((FAILURES + 1)); }
    printf '%-5s %-4s want=%s got=%s  %s\n' "$1" "$_verdict" "$3" "$2" "$4"
}

# row <row-id> <token|-> <action> <json> <expected-status> <description> [type]
row() {
    _row_id="$1"; shift
    call "$1" "$2" "$3"; shift 3
    check "$_row_id" "$@"
}

# raw <action> <json> <token|-> ; BODY only, for value extraction
raw() { call "$3" "$1" "$2"; }

# ---------------------------------------------------------------------------

hr
say "publication-lifecycle probe — CKAN enforcement guard (PR 1)"
say "api=$API container=$CONTAINER prefix=$PREFIX"
hr

# --- P0: pre-run anonymous catalogue baseline -------------------------------
raw package_search '{"q": "*:*", "rows": 0}' -
BASELINE_COUNT="$(jq_get '.result.count')"
say "P0    anonymous *:* count before the run: $BASELINE_COUNT"

# --- P1: fixtures, created and owned by a sysadmin --------------------------
SYS_TOKEN="$(docker exec "$CONTAINER" ckan -c "$INI" user token add ckan_admin \
    "$PREFIX-sysadmin" expires_in=1 unit=3600 -q 2>/dev/null | tail -1)"
if [ -z "$SYS_TOKEN" ]; then
    say "FATAL: could not mint a sysadmin token via 'ckan user token add'."
    exit 2
fi

ORG_A="$PREFIX-org"; ORG_B="$PREFIX-other"
ORG_PARENT="$PREFIX-parent"; ORG_CHILD="$PREFIX-child"
for _org in "$ORG_A" "$ORG_B" "$ORG_PARENT" "$ORG_CHILD"; do
    raw organization_create "{\"name\": \"$_org\", \"title\": \"$_org\"}" "$SYS_TOKEN"
    [ "$STATUS" = 200 ] || { say "FATAL: organization_create $_org -> $STATUS $BODY"; exit 2; }
done
raw organization_show "{\"id\": \"$ORG_A\"}" "$SYS_TOKEN"; ORG_A_ID="$(jq_get '.result.id')"
raw organization_show "{\"id\": \"$ORG_B\"}" "$SYS_TOKEN"; ORG_B_ID="$(jq_get '.result.id')"
raw organization_show "{\"id\": \"$ORG_PARENT\"}" "$SYS_TOKEN"; ORG_PARENT_ID="$(jq_get '.result.id')"
raw organization_show "{\"id\": \"$ORG_CHILD\"}" "$SYS_TOKEN"; ORG_CHILD_ID="$(jq_get '.result.id')"

# The hierarchy row is inverted: the child org *is* the member row's `id`.
raw member_create \
    "{\"id\": \"$ORG_CHILD_ID\", \"object\": \"$ORG_PARENT_ID\", \"object_type\": \"group\", \"capacity\": \"parent\"}" \
    "$SYS_TOKEN"
say "P1    parent/child row: child=$ORG_CHILD parent=$ORG_PARENT status=$STATUS"

EDITOR="$PREFIX-editor"; MEMBER="$PREFIX-member"
ADMIN="$PREFIX-admin"; OUTSIDER="$PREFIX-outsider"
for _user in "$EDITOR" "$MEMBER" "$ADMIN" "$OUTSIDER"; do
    raw user_create \
        "{\"name\": \"$_user\", \"email\": \"$_user@example.invalid\", \"password\": \"Probe-$STAMP-pw\"}" \
        "$SYS_TOKEN"
    [ "$STATUS" = 200 ] || { say "FATAL: user_create $_user -> $STATUS $BODY"; exit 2; }
done
raw user_show "{\"id\": \"$EDITOR\"}" "$SYS_TOKEN"; EDITOR_ID="$(jq_get '.result.id')"
raw user_show "{\"id\": \"$MEMBER\"}" "$SYS_TOKEN"; MEMBER_ID="$(jq_get '.result.id')"
raw user_show "{\"id\": \"$ADMIN\"}" "$SYS_TOKEN"; ADMIN_ID="$(jq_get '.result.id')"
raw user_show "{\"id\": \"$OUTSIDER\"}" "$SYS_TOKEN"; OUTSIDER_ID="$(jq_get '.result.id')"

raw member_create "{\"id\": \"$ORG_A_ID\", \"object\": \"$EDITOR_ID\", \"object_type\": \"user\", \"capacity\": \"editor\"}" "$SYS_TOKEN"
raw member_create "{\"id\": \"$ORG_A_ID\", \"object\": \"$MEMBER_ID\", \"object_type\": \"user\", \"capacity\": \"member\"}" "$SYS_TOKEN"
raw member_create "{\"id\": \"$ORG_A_ID\", \"object\": \"$ADMIN_ID\", \"object_type\": \"user\", \"capacity\": \"admin\"}" "$SYS_TOKEN"
raw member_create "{\"id\": \"$ORG_B_ID\", \"object\": \"$OUTSIDER_ID\", \"object_type\": \"user\", \"capacity\": \"editor\"}" "$SYS_TOKEN"
raw member_create "{\"id\": \"$ORG_PARENT_ID\", \"object\": \"$ADMIN_ID\", \"object_type\": \"user\", \"capacity\": \"admin\"}" "$SYS_TOKEN"
say "P1    memberships: editor/member/admin on $ORG_A, editor on $ORG_B, admin on $ORG_PARENT (status=$STATUS)"

# --- P1.2: one token per probe user, minted by the sysadmin -----------------
mint() {  # mint <user-name>
    raw api_token_create \
        "{\"user\": \"$1\", \"name\": \"$PREFIX-token-$1\", \"expires_in\": 1, \"unit\": 3600}" \
        "$SYS_TOKEN"
    jq_get '.result.token'
}
EDITOR_TOKEN="$(mint "$EDITOR")"
MEMBER_TOKEN="$(mint "$MEMBER")"
ADMIN_TOKEN="$(mint "$ADMIN")"
OUTSIDER_TOKEN="$(mint "$OUTSIDER")"
if [ -z "$EDITOR_TOKEN" ] || [ -z "$MEMBER_TOKEN" ] \
    || [ -z "$ADMIN_TOKEN" ] || [ -z "$OUTSIDER_TOKEN" ]; then
    say "FATAL: could not mint every probe-user token."; exit 2
fi
say "P1.2  4 per-user tokens minted with api_token_create {user: ...}"

# --- fixtures: five private datasets, created by the sysadmin ---------------
make_dataset() {  # make_dataset <name> <owner-org>
    raw package_create \
        "{\"name\": \"$1\", \"owner_org\": \"$2\", \"private\": true, \"title\": \"$1\"}" "$SYS_TOKEN"
    [ "$STATUS" = 200 ] || { say "FATAL: fixture $1 -> $STATUS $BODY"; exit 2; }
    jq_get '.result.id'
}
D1="$(make_dataset "$PREFIX-d1" "$ORG_A")"        # P3, P4*, P6, P8
D2="$(make_dataset "$PREFIX-d2" "$ORG_A")"        # P6.1
D3="$(make_dataset "$PREFIX-d3" "$ORG_A")"        # P6.2, P6.3
D6="$(make_dataset "$PREFIX-d6" "$ORG_CHILD")"    # P10
D7="$(make_dataset "$PREFIX-d7" "$ORG_A")"        # P7: never targeted by a publish row
# Every dataset name this run may create, including the ones only a *refused*
# call could create. P7 and P9 are complete only against this list.
DATASETS="$PREFIX-p2 $PREFIX-p5 $PREFIX-p5b $PREFIX-d1 $PREFIX-d2 $PREFIX-d3 $PREFIX-d6 $PREFIX-d7"
say "P1.3  5 private datasets seeded (d1,d2,d3,d7 in $ORG_A, d6 in $ORG_CHILD)"

hr
say "P2 forward — the wizard's payload must still work"
row P2 "$EDITOR_TOKEN" package_create \
    "{\"name\": \"$PREFIX-p2\", \"owner_org\": \"$ORG_A\", \"private\": true}" 200 \
    "editor package_create {private: true}"
P2_ID="$(jq_get '.result.id')"
raw package_show "{\"id\": \"$P2_ID\"}" "$SYS_TOKEN"
say "P2    stored: private=$(jq_get '.result.private') state=$(jq_get '.result.state')"

hr
say "P3 — the deliverable: an editor must not be able to publish"
row P3 "$EDITOR_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": false}" 403 \
    "editor package_patch {id, private: false}" 'Authorization Error'
row P4a "$EDITOR_TOKEN" package_patch "{\"id\": \"$D1\", \"state\": \"draft\"}" 403 \
    "editor package_patch {id, state: draft}" 'Authorization Error'
row P4b "$EDITOR_TOKEN" package_patch "{\"id\": \"$D1\", \"title\": \"probe metadata edit\"}" 200 \
    "editor package_patch {id, title} — a metadata edit must stay allowed"

# P4c: a full package_update built from package_show with `private` removed.
raw package_show "{\"id\": \"$D1\"}" "$EDITOR_TOKEN"
UPDATE_PAYLOAD="$(printf '%s' "$BODY" | jq -c \
    '.result | del(.private) | del(.tracking_summary) | .title = "probe full update"')"
row P4c "$EDITOR_TOKEN" package_update "$UPDATE_PAYLOAD" 200 \
    "editor full package_update omitting private"
raw package_show "{\"id\": \"$D1\"}" "$SYS_TOKEN"
say "P4c   stored after the full update: private=$(jq_get '.result.private') state=$(jq_get '.result.state')"

# P4d/P4e are NOT rows of design.md's step table. They exist because
# `boolean_validator` (ckan/logic/validators.py:160-173) is total: it returns
# False for every value outside {'true','yes','t','y','1'} and never raises
# Invalid. A `private` value the guard cannot interpret is therefore not a
# deferred validation error — core coerces it to False, i.e. to a publication.
row P4d "$EDITOR_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": \"banana\"}" 403 \
    "editor package_patch {id, private: 'banana'} — coerces to public" 'Authorization Error'
row P4e "$EDITOR_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": \"\"}" 403 \
    "editor package_patch {id, private: ''} — coerces to public" 'Authorization Error'

hr
say "P5 — the create-time holes (both measured 200 before the guard)"
row P5 "$EDITOR_TOKEN" package_create \
    "{\"name\": \"$PREFIX-p5\", \"owner_org\": \"$ORG_A\", \"private\": false}" 403 \
    "editor package_create {private: false}" 'Authorization Error'
row P5b "$EDITOR_TOKEN" package_create \
    "{\"name\": \"$PREFIX-p5b\", \"owner_org\": \"$ORG_A\"}" 403 \
    "editor package_create with private omitted" 'Authorization Error'
_created=0
for _name in "$PREFIX-p2" "$PREFIX-p5" "$PREFIX-p5b"; do
    raw package_show "{\"id\": \"$_name\"}" "$SYS_TOKEN"
    [ "$STATUS" = 200 ] && _created=$((_created + 1))
done
say "P5    of p2/p5/p5b, datasets that exist: $_created (p2 expected, p5 and p5b expected 0)"

hr
say "P6 — the approvers, and the preserved refusals"
row P6 "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": false}" 200 \
    "org admin package_patch {id, private: false}"
raw package_show "{\"id\": \"$D1\"}" "$SYS_TOKEN"
value P6.stored "$(jq_get '.result.private')" false "stored private after the admin's call"
row P6.1 "$SYS_TOKEN" package_patch "{\"id\": \"$D2\", \"private\": false}" 200 \
    "sysadmin package_patch {id, private: false}"
row P6.2a "$MEMBER_TOKEN" package_patch "{\"id\": \"$D3\", \"private\": false}" 403 \
    "org member package_patch {id, private: false}" 'Authorization Error'
row P6.2b "$OUTSIDER_TOKEN" package_patch "{\"id\": \"$D3\", \"private\": false}" 403 \
    "editor of another org package_patch {id, private: false}" 'Authorization Error'
row P6.3 - package_patch "{\"id\": \"$D3\", \"private\": false}" 403 \
    "anonymous package_patch {id, private: false}" 'Authorization Error'
row P10 "$ADMIN_TOKEN" package_patch "{\"id\": \"$D6\", \"private\": false}" 200 \
    "admin of the parent org publishes the child org's dataset"

hr
say "P7 — the catalogue follows private, with no portal query change"
raw package_search '{"q": "*:*", "rows": 0}' -
AFTER_COUNT="$(jq_get '.result.count')"
# A dataset counts as published when it is public *and* active: a `state=draft`
# dataset is public in the database yet absent from the catalogue, so counting
# it would make this row's arithmetic depend on an unrelated row.
_settled="$(k=0; for _name in $DATASETS; do
    raw package_show "{\"id\": \"$_name\"}" "$SYS_TOKEN"
    [ "$STATUS" = 200 ] && [ "$(jq_get '.result.private')" = false ] \
        && [ "$(jq_get '.result.state')" = active ] && k=$((k + 1))
done; printf '%s' "$k")"
say "P7    anonymous *:* count: $BASELINE_COUNT -> $AFTER_COUNT (delta $((AFTER_COUNT - BASELINE_COUNT)))"
say "P7    datasets of this run now public and active: $_settled"
value P7.delta "$((AFTER_COUNT - BASELINE_COUNT))" "$_settled" \
    "the anonymous count rose by exactly the number of published datasets"
for _pair in "$PREFIX-d2:1:published-by-the-sysadmin-and-must-be-visible" \
             "$PREFIX-d3:0:private-and-must-stay-absent" \
             "$PREFIX-d7:0:private-and-never-published"; do
    _nm="${_pair%%:*}"; _rest="${_pair#*:}"; _want="${_rest%%:*}"; _label="${_rest##*:}"
    raw package_search "{\"q\": \"name:$_nm\", \"rows\": 5}" -
    value "P7.${_nm##*-}" "$(jq_get '.result.count')" "$_want" "anonymous search $_nm ($_label)"
done

hr
say "P8 — bulk actions are not a publication path"
row P8 "$EDITOR_TOKEN" bulk_update_public \
    "{\"org_id\": \"$ORG_A_ID\", \"datasets\": [\"$D1\"]}" 403 \
    "editor bulk_update_public — refused by CKAN's own auth, not by the guard" 'Authorization Error'

# ---------------------------------------------------------------------------
hr
say "P9 — cleanup (inside this script, not a manual afterthought)"
LEFTOVER_TOKENS=0
for _pair in "$EDITOR $EDITOR_ID" "$MEMBER $MEMBER_ID" "$ADMIN $ADMIN_ID" "$OUTSIDER $OUTSIDER_ID"; do
    _name="${_pair%% *}"; _id="${_pair##* }"
    raw api_token_list "{\"user_id\": \"$_id\"}" "$SYS_TOKEN"
    for _jti in $(printf '%s' "$BODY" | jq -r --arg n "$PREFIX-token-$_name" \
            '.result[] | select(.name == $n) | .id' 2>/dev/null); do
        raw api_token_revoke "{\"jti\": \"$_jti\"}" "$SYS_TOKEN"
        say "P9    api_token_revoke $_name jti=$_jti -> $STATUS"
    done
    raw api_token_list "{\"user_id\": \"$_id\"}" "$SYS_TOKEN"
    _left="$(printf '%s' "$BODY" | jq --arg n "$PREFIX-token-$_name" \
        '[.result[] | select(.name == $n)] | length' 2>/dev/null)"
    [ "$_left" = 0 ] || LEFTOVER_TOKENS=$((LEFTOVER_TOKENS + 1))
done

for _name in $DATASETS; do
    raw package_show "{\"id\": \"$_name\"}" "$SYS_TOKEN"
    if [ "$STATUS" = 200 ]; then
        raw package_delete "{\"id\": \"$_name\"}" "$SYS_TOKEN"
        say "P9    package_delete $_name -> $STATUS"
    fi
    docker exec "$CONTAINER" ckan -c "$INI" dataset purge "$_name" >/dev/null 2>&1 || true
done
for _org in "$ORG_A" "$ORG_B" "$ORG_PARENT" "$ORG_CHILD"; do
    raw organization_show "{\"id\": \"$_org\"}" "$SYS_TOKEN"
    if [ "$STATUS" = 200 ]; then
        raw organization_purge "{\"id\": \"$_org\"}" "$SYS_TOKEN"
        say "P9    organization_purge $_org -> $STATUS"
    fi
done
for _user in "$EDITOR" "$MEMBER" "$ADMIN" "$OUTSIDER"; do
    raw user_show "{\"id\": \"$_user\"}" "$SYS_TOKEN"
    if [ "$STATUS" = 200 ]; then
        raw user_delete "{\"id\": \"$_user\"}" "$SYS_TOKEN"
        say "P9    user_delete $_user -> $STATUS"
    fi
done

hr
say "P9 — hygiene checks"
LEFTOVER_DATASETS=0
for _name in $DATASETS; do
    raw package_show "{\"id\": \"$_name\"}" "$SYS_TOKEN"
    [ "$STATUS" = 200 ] && LEFTOVER_DATASETS=$((LEFTOVER_DATASETS + 1))
done
LEFTOVER_ORGS=0
for _org in "$ORG_A" "$ORG_B" "$ORG_PARENT" "$ORG_CHILD"; do
    raw organization_show "{\"id\": \"$_org\"}" "$SYS_TOKEN"
    [ "$STATUS" = 200 ] && LEFTOVER_ORGS=$((LEFTOVER_ORGS + 1))
done
value P9.2 "$LEFTOVER_DATASETS" 0 "probe datasets still resolvable after the purge"
value P9.3 "$LEFTOVER_ORGS" 0 "probe organizations still resolvable after the purge"
value P9.4 "$LEFTOVER_TOKENS" 0 "probe users whose minted token survived revocation"

# The sysadmin token goes last: every privileged call above used it.
raw api_token_revoke "{\"jti\": \"$(jwt_jti "$SYS_TOKEN")\"}" "$SYS_TOKEN"
say "P9    api_token_revoke of the probe's own sysadmin token -> $STATUS"

raw package_search '{"q": "*:*", "rows": 0}' -
value P9.1 "$(jq_get '.result.count')" "$BASELINE_COUNT" \
    "anonymous *:* count back to its pre-run baseline"
say "P9    residual: the 4 probe users remain as state='deleted' rows; CKAN 2.11.6"
say "P9    exposes no user hard-delete, which is the residual design.md P9 records."

hr
say "RESULT: $((CHECKS - FAILURES))/$CHECKS checks passed, $FAILURES failed"
hr
[ "$FAILURES" = 0 ]
