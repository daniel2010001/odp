#!/bin/sh
#
# probe.sh — live evidence for the publication-lifecycle enforcement guard (PR 1).
#
# WHAT THIS IS. A measurement harness, not a test suite. It is the only evidence
# that covers the *running* CKAN image; `pytest` in `ckanext-umss` proves the
# predicate in-process and cannot prove that the deployment runs this code. The
# expectations below are the post-A3 target of design.md's truth table (D3) **and of the wall**:
# every `403` row answered `200` before the guard and before the wall.
#
# LOS RÓTULOS (2026-10-07, noche). El autor decidió que cada negativa sea `<rótulo congelado>: <prosa libre>`,
# y **el conjunto quedó cerrado por construcción de su lado**: un test recorre todas las constantes de negativa
# y falla si alguna no empieza con un rótulo declarado. Son **nueve**, no siete. Para lo declarado como
# interfaz son los **rótulos**, nunca las oraciones: mejorar la redacción no puede romper a este consumidor.
#
# Cuando esa unidad aterrice, cada fila de negativa de este script afirma **dos capas** (y no una):
#   1. **la FORMA** — el mensaje es `Access denied: <Rótulo>: …` —, que es el invariante que ellos garantizan
#      por test. Esta capa **no necesita la lista** y por eso **no puede quedar vieja** si mañana aparece una
#      décima negativa: afirma la propiedad, no el inventario.
#   2. **el rótulo propio**, sólo en las filas cuya razón de existir es **distinguir** una negativa de otra
#      (cuatro ojos, capacidad del solicitante). Ahí sí la lista importa, y ahí se copia una vez.
#
# Hoy las filas afirman `error.__type`, que es `Authorization Error` en **las nueve** y por lo tanto **no dice
# de quién** es la negativa: el hueco que `P8` dejó abierto, y la razón por la que la capa 1 existe.
#
# Y UNA MEDICIÓN QUE ACOTA EL GUARDIÁN (2026-10-07/08). Se quiso que este script fuera el guardián **externo**
# de que los rótulos no vuelvan adentro de `_()`: una fila que afirme la forma con un `Accept-Language`
# no-inglés se pondría roja el día que alguien agregue la traducción. **Medido: no sirve, porque la API no
# negocia el idioma.** Con `Accept-Language: es`, `package_create` anónimo devolvió «User  not authorized to
# create packages» **en inglés**, aunque el catálogo español **sí** traduce esa cadena («El usuario %s no está
# autorizado para crear paquetes»), y la config dice `ckan.locale_default = en` con `locales_offered` vacío.
# Dato del mismo pase: el envoltorio `"Access denied: %s"` tiene **`msgstr ""`** en el catálogo español, así que
# se queda en inglés aun habiendo traducción, y lo que se traduce es el mensaje **interno**.
# **Consecuencia, declarada en vez de prometida: el poder de este script sobre ESE agujero es cero.** Lo que sí
# afirma es la **forma** —`Access denied: <Rótulo>: …`—, que rompe si alguien cambia el envoltorio, el rótulo o
# reescribe la negativa: es el guardián de la **forma**, no el de la **no-traducción**. El cierre estructural lo
# hace el otro repositorio (la etiqueta **fuera** de `_()`, con su test), y un guardián externo de esa propiedad
# exigiría una **fuente de locale en el camino de la API**, que hoy no existe.
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
# check against the pre-run baseline. The only residual is that CKAN exposes no user
# hard-delete, so the four probe users survive as `state='deleted'` rows.
#
# LA CONSECUENCIA PARA UN LECTOR CONCURRENTE (declarada el 2026-10-07). **Mientras corre, esta sonda muta la
# base de dev.** Un tercero que esté midiendo `ckandb` al mismo tiempo ve los conteos **moverse entre dos
# SELECT de sólo lectura** — mirado por la sesión par durante una corrida: paquetes `29→24→29`, usuarios
# `30→34`. No es un defecto de ninguno de los dos: es la sonda haciendo exactamente lo que dice. Dos
# consecuencias, las dos prácticas:
#   * **Nadie puede certificar «`ckandb` sin cambios» mientras esto corre.** Si alguien necesita una ventana
#     quieta para medir, se le avisa antes de correrla; su verificación, mientras tanto, tiene que apoyarse en
#     `ckan_test` y en el core de test, que no los toca esta sonda.
#   * **Lo que queda son cuatro usuarios** en `state='deleted'` por corrida —CKAN no borra usuarios de verdad,
#     tampoco en 2.12.0—, así que el **conteo de usuarios no es un invariante del stack**. Los datasets y las
#     organizaciones sí se purgan enteros.
#     *(Nota de versión: acá decía 2.11.6 y el stack corre 2.12.0 desde el upgrade.)*
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

# --- fixtures: private datasets, created by the sysadmin --------------------
# `make_dataset` **no imprime** el id: lo deja en `DATASET_ID`. La razón es un defecto real de este script
# (2026-10-07): cuando el id se capturaba con `$(make_dataset …)`, el `exit 2` del fallo **sólo mataba la
# subshell** de la sustitución, así que la corrida seguía con el texto del FATAL dentro de la variable y el
# error aparecía **tres pasos después** como un `400` de JSON ilegible. Sin sustitución el `exit 2` detiene la
# corrida donde corresponde, y el diagnóstico sale por **stderr** para que nadie lo confunda con un dato.
make_dataset() {  # make_dataset <name> <owner-org> ; leaves the id in DATASET_ID
    raw package_create \
        "{\"name\": \"$1\", \"owner_org\": \"$2\", \"private\": true, \"title\": \"$1\"}" "$SYS_TOKEN"
    if [ "$STATUS" != 200 ]; then
        say "FATAL: fixture $1 -> $STATUS $BODY" >&2
        [ "$STATUS" = 409 ] && say "       (409: el nombre ya existe — una corrida anterior dejó ese dataset sin purgar; P9 reporta si el purge falla)" >&2
        exit 2
    fi
    DATASET_ID="$(jq_get '.result.id')"
}
make_dataset "$PREFIX-d1" "$ORG_A"; D1="$DATASET_ID"          # P3, P4*, P6, P8
make_dataset "$PREFIX-d2" "$ORG_A"; D2="$DATASET_ID"          # P6.1
make_dataset "$PREFIX-d3" "$ORG_A"; D3="$DATASET_ID"          # P6.2, P6.3 — y **debe quedar privado** (P7.d3)
make_dataset "$PREFIX-gov" "$ORG_A"; D_GOV="$DATASET_ID"      # P12: el único que la puerta **publica**
make_dataset "$PREFIX-fe" "$ORG_A"; D_FE="$DATASET_ID"        # P13: el editor pide; su rechazo es el de capacidad
make_dataset "$PREFIX-fe2" "$ORG_A"; D_FE2="$DATASET_ID"      # P13: el admin pide; el de cuatro ojos es suyo
make_dataset "$PREFIX-d6" "$ORG_CHILD"; D6="$DATASET_ID"      # P10
make_dataset "$PREFIX-d7" "$ORG_A"; D7="$DATASET_ID"          # P7: never targeted by a publish row
make_dataset "$PREFIX-rj" "$ORG_A"; D_RJ="$DATASET_ID"        # P14: rechazo sin motivo, y anulación
# Every dataset name this run may create, including the ones only a *refused*
# call could create. P7 and P9 are complete only against this list.
DATASETS="$PREFIX-p2 $PREFIX-p5 $PREFIX-p5b $PREFIX-d1 $PREFIX-d2 $PREFIX-d3 $PREFIX-d6 $PREFIX-d7 $PREFIX-blk $PREFIX-gov $PREFIX-fe $PREFIX-fe2 $PREFIX-rj"
say "P1.3  private datasets seeded (d1,d2,d3,d7,blk in $ORG_A, gov too; d6 in $ORG_CHILD)"

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
say "P6 — the approvers, and the wall that now refuses them"
# A3: el admin de la organización **ya no** publica por la vía nativa. La fila esperaba `200` (el mundo
# anterior a la pared) y ahora mide `403` con el mensaje del muro; y la parte que de verdad importa es
# `P6.stored`: el dataset **sigue privado**. Antes de A3 esa fila afirmaba `false` —el valor publicado—, así
# que el cambio de expectativa es el cambio de mundo, no un ajuste cosmético.
row P6 "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": false}" 403 \
    "org admin package_patch {id, private: false} — refused by the wall, not by the guard" 'Authorization Error'
raw package_show "{\"id\": \"$D1\"}" "$SYS_TOKEN"
value P6.stored "$(jq_get '.result.private')" true "stored private **unchanged** after the admin's refused call"
row P6.1 "$SYS_TOKEN" package_patch "{\"id\": \"$D2\", \"private\": false}" 200 \
    "sysadmin package_patch {id, private: false}"
row P6.2a "$MEMBER_TOKEN" package_patch "{\"id\": \"$D3\", \"private\": false}" 403 \
    "org member package_patch {id, private: false}" 'Authorization Error'
row P6.2b "$OUTSIDER_TOKEN" package_patch "{\"id\": \"$D3\", \"private\": false}" 403 \
    "editor of another org package_patch {id, private: false}" 'Authorization Error'
row P6.3 - package_patch "{\"id\": \"$D3\", \"private\": false}" 403 \
    "anonymous package_patch {id, private: false}" 'Authorization Error'
row P10 "$ADMIN_TOKEN" package_patch "{\"id\": \"$D6\", \"private\": false}" 403 \
    "admin of the parent org publishes the child org's dataset — refused by the wall too" 'Authorization Error'

say "P6.b — los valores límite de \`private\`: todos son intento, ninguno es una excepción"
# Por qué estas filas existen. Medido en el CKAN que corre (2.12.0): `boolean_validator` es **total** —`0`,
# `0.0`, `[]`, `{}`, `'banana'`, `''`, `'false'` y `None` se guardan como **público**—, así que cada uno es un
# **intento de publicación** y el muro tiene que negarlo. **Ninguna** fila puede dar una excepción del
# validador: la versión que **sí lanza** con un `int` es la `2.12.0a0` de un checkout viejo de este disco, y
# de ahí salió el espejo que dejaba publicar con `private: 0`. La fila de `'false'` es propia porque es la
# contraintuitiva: **no está en la lista de verdaderos**, así que se guarda como público.
row P6b.0 "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": 0}" 403 \
    "admin package_patch {private: 0} — coerces to public, refused" 'Authorization Error'
row P6b.0f "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": 0.0}" 403 \
    "admin package_patch {private: 0.0} — coerces to public, refused" 'Authorization Error'
row P6b.arr "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": []}" 403 \
    "admin package_patch {private: []} — coerces to public, refused" 'Authorization Error'
row P6b.obj "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": {}}" 403 \
    "admin package_patch {private: {}} — coerces to public, refused" 'Authorization Error'
row P6b.nul "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": null}" 403 \
    "admin package_patch {private: null} — coerces to public, refused" 'Authorization Error'
row P6b.fal "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"private\": \"false\"}" 403 \
    "admin package_patch {private: 'false'} — the counterintuitive one: coerces to public, refused" 'Authorization Error'
# Y la fila que impide que el muro se pase de listo: un parche que **no** toca la visibilidad ni el estado no
# es un intento de publicación, así que tiene que pasar. Un muro que refusa todo pasa los `403` de arriba y
# rompe el portal.
row P6b.nop "$ADMIN_TOKEN" package_patch "{\"id\": \"$D1\", \"notes\": \"tocado por la sonda\"}" 200 \
    "admin package_patch without private/state — not a publication attempt, must pass"
# La comprobación que cierra el bloque: después de negar **todos** los valores límite, el dataset sigue
# privado. Una fila que devolviera `403` y publicara igual pasaría las de arriba y sería el peor resultado
# posible — una negativa que no niega nada.
raw package_show "{\"id\": \"$D1\"}" "$SYS_TOKEN"
value P6b.stored "$(jq_get '.result.private')" true \
    "stored private **unchanged** after every edge value was refused"

say "P6.c — las acciones en bloque que van al revés: dos actores, dos motivos"
# Estas dos filas salen de los **tests de la par**, no de mi lectura, y evitan el defecto que mi propio `P8`
# tenía: afirmar sólo el código **mezcla motivos**.
#  · `bulk_update_delete`: a un **editor** lo rechaza **core** —el rol `editor` tiene `update_dataset` pero no
#    `update`, así que core contesta **sin mensaje**—, y a un **admin** core lo admite y lo rechaza **el muro**.
#    Dos actores, dos motivos, y los dos `403`.
#  · `bulk_update_private` va al revés: **permitido al admin** (angostar visibilidad es intencional) y
#    **rechazado al editor por core**. Una sola frase para los dos mediría dos cosas distintas.
D_BLK=""; make_dataset "$PREFIX-blk" "$ORG_A"; D_BLK="$DATASET_ID"
row P6c.priv.admin "$ADMIN_TOKEN" bulk_update_private \
    "{\"org_id\": \"$ORG_A_ID\", \"datasets\": [\"$D_BLK\"]}" 200 \
    "admin bulk_update_private — narrowing visibility is intentional, so it passes"
row P6c.priv.editor "$EDITOR_TOKEN" bulk_update_private \
    "{\"org_id\": \"$ORG_A_ID\", \"datasets\": [\"$D_BLK\"]}" 403 \
    "editor bulk_update_private — refused by core, not by the wall, so it carries no message"
row P6c.del.editor "$EDITOR_TOKEN" bulk_update_delete \
    "{\"org_id\": \"$ORG_A_ID\", \"datasets\": [\"$D_BLK\"]}" 403 \
    "editor bulk_update_delete — refused by core (the editor role lacks org-level update), which answers without a message"
row P6c.del.admin "$ADMIN_TOKEN" bulk_update_delete \
    "{\"org_id\": \"$ORG_A_ID\", \"datasets\": [\"$D_BLK\"]}" 403 \
    "admin bulk_update_delete — core admits it; what refuses is the wall" 'Authorization Error'

hr
say "P11 — el contrato de las cinco acciones: existencia y alcance de la cola"
# **`NotFound`, no `403`** (regla 7 del contrato): un `request_id` o un `dataset_id` irresoluble **no** puede
# reportarse como capacidad faltante — eso diría que falta un permiso cuando lo que falta es la cosa. Las dos
# filas son la misma regla por las dos puertas.
row P11.nf.request "$ADMIN_TOKEN" publication_request_decide \
    "{\"request_id\": \"no-such-request-xyz\", \"approve\": true}" 404 \
    "decide with an unresolvable request_id — NotFound, not 403" 'Not Found Error'
row P11.nf.dataset "$SYS_TOKEN" publication_publish \
    "{\"dataset_id\": \"no-such-dataset-xyz\"}" 404 \
    "publish with an unresolvable dataset_id — NotFound, not 403" 'Not Found Error'
# Y la cola: la acción **no** tiene autorización forzada, la acota el **propio cuerpo**, así que un anónimo
# recibe una lista **vacía** y no un `403`. Es la fila que confirma desde afuera la corrección que el contrato
# hizo midiendo: hace dos unidades decía «un anónimo es rechazado por CKAN antes», y era falso.
row P11.list.anon - publication_request_list "{}" 200 \
    "anonymous publication_request_list — narrowed by the body, not refused by auth"

hr
say "P12 — la puerta y la segunda decisión: la carrera real de la cola"
# La puerta: un aprobador que **no** es el solicitante decide, y el dataset queda **público**. La
# confirmación es el **valor almacenado** —`package_show`— y no la fila que devolvió la acción: el contrato
# dice que la acción devuelve **sólo su fila**, así que medir el valor guardado es más fuerte que creerle al
# que lo escribió.
row P12.request "$ADMIN_TOKEN" publication_request_create "{\"dataset_id\": \"$D_GOV\"}" 200 \
    "the admin requests the publication of a private dataset"
REQ_GOV="$(jq_get '.result.id')"
row P12.decide.first "$SYS_TOKEN" publication_request_decide \
    "{\"request_id\": \"$REQ_GOV\", \"approve\": true}" 200 \
    "the door: an approver who is not the requester decides it"
raw package_show "{\"id\": \"$D_GOV\"}" "$SYS_TOKEN"
value P12.published "$(jq_get '.result.private')" false \
    "the stored value is public — the action's own row is not the confirmation"
# Y la carrera: dos administradores con la misma lista, uno decide primero, el otro recibe **`409` claveado
# por campo** (`request_id`) y **sin** el envoltorio `Access denied:` de los `403`. Es la fila más realista del
# bloque: un consumidor que afirmara «todo rechazo tiene la forma del `403`» daría acá un **falso negativo**,
# y el portal mostraría «error inesperado» donde la verdad es «ya estaba decidida».
row P12.decide.second "$SYS_TOKEN" publication_request_decide \
    "{\"request_id\": \"$REQ_GOV\", \"approve\": true}" 409 \
    "a second decision on the same request — validation, keyed by field, not the authorization shape" 'Validation Error'

hr
say "P13 — cuatro ojos, y la precedencia que hace que dos filas parezcan la misma"
# La precedencia medida por la par manda **qué rechazo recibe cada solicitante**, y estas dos filas existen
# para separarlos: la auth evalúa **capacidad primero y cuatro ojos después**, así que
#  · un **editor** solicitante **nunca** llega al rechazo de cuatro ojos —le toca el de capacidad, y es
#    correcto: no puede decidir **ninguna** solicitud, no sólo la suya—, y
#  · el rechazo de cuatro ojos lo ve **sólo un solicitante con capacidad de admin**.
# Las dos son `403`. Afirmar las dos con la misma frase mediría dos hechos distintos con una sola.
# Las dos direcciones salen del **bloque de fixtures** (arriba): crear acá otra vez fue el defecto que dejó
# este bloque en `400` toda una corrida, porque el `409` del nombre repetido quedó invisible dentro de una
# sustitución de comando. El id viene en `$D_FE` / `$D_FE2`.
row P13.editor.req "$EDITOR_TOKEN" publication_request_create "{\"dataset_id\": \"$D_FE\"}" 200 \
    "the editor requests the publication of a private dataset"
REQ_FE="$(jq_get '.result.id')"
row P13.editor.decide "$EDITOR_TOKEN" publication_request_decide \
    "{\"request_id\": \"$REQ_FE\", \"approve\": true}" 403 \
    "the editor decides their own request — the CAPACITY refusal, never four eyes" 'Authorization Error'
row P13.admin.req "$ADMIN_TOKEN" publication_request_create "{\"dataset_id\": \"$D_FE2\"}" 200 \
    "the admin requests the publication of another private dataset"
REQ_FE2="$(jq_get '.result.id')"
row P13.admin.decide "$ADMIN_TOKEN" publication_request_decide \
    "{\"request_id\": \"$REQ_FE2\", \"approve\": true}" 403 \
    "the admin decides their OWN request — THIS is four eyes, and the row stays pending" 'Authorization Error'
raw publication_request_list "{\"status\": \"pending\"}" "$ADMIN_TOKEN"
value P13.still.pending "$(jq_get "[.result[] | select(.id == \"$REQ_FE2\")] | length")" 1 \
    "the four-eyes refusal leaves the request pending — a refusal is not a cancellation"
# Y el par del dataset **ya público**, que también se lee al revés de lo que parece: la capacidad se evalúa
# **antes** que el estado, así que un no-sysadmin recibe la negativa del sysadmin (no filtra la visibilidad)
# y **sólo** el sysadmin recibe la de «ya es público».
row P13.pub.sysadmin "$SYS_TOKEN" publication_publish "{\"dataset_id\": \"$D2\"}" 403 \
    "a sysadmin publishing an ALREADY PUBLIC dataset — refused, not a second approved row" 'Authorization Error'
row P13.pub.editor "$EDITOR_TOKEN" publication_publish "{\"dataset_id\": \"$D2\"}" 403 \
    "a non-sysadmin on the same dataset — the SYSADMIN denial, because capability is checked before state" 'Authorization Error'

hr
say "P14 — los desenlaces que no son una decisión: motivo obligatorio y anulación"
row P14.req "$ADMIN_TOKEN" publication_request_create "{\"dataset_id\": \"$D_RJ\"}" 200 \
    "the admin requests the publication of a private dataset"
REQ_RJ="$(jq_get '.result.id')"
# **Rechazar sin motivo** es un `409` con la clave `comments`, **no** un fallo de autorización: es el respaldo
# del servidor a una regla que el formulario ya exige antes de mandar. La **clave** es lo que el portal tiene
# que leer para decir «falta el motivo» en vez de «no se pudo».
row P14.reject.noreason "$SYS_TOKEN" publication_request_decide \
    "{\"request_id\": \"$REQ_RJ\", \"approve\": false}" 409 \
    "reject without a reason — ValidationError keyed by `comments`, never an authorization failure" 'Validation Error'
# Y la **anulación**: el objeto desaparece —el dataset se borra— y la `pending` se anula **con su motivo**, que
# es un **token estable** y no prosa, para que el portal pueda decir *por qué* sin mostrar texto ajeno.
raw package_delete "{\"id\": \"$D_RJ\"}" "$SYS_TOKEN"
raw publication_request_list "{\"status\": \"annulled\"}" "$ADMIN_TOKEN"
value P14.annulled "$(jq_get "[.result[] | select(.id == \"$REQ_RJ\")] | length")" 1 \
    "a pending request whose dataset is gone is annulled — not left decidible"
value P14.motive "$(jq_get "[.result[] | select(.id == \"$REQ_RJ\")][0].motive")" "dataset_deleted" \
    "and the annulment names its trigger as a stable token, not prose"
# Y `create` sobre un dataset **ya público**: la misma compuerta que `publish`, para no acumular una segunda fila.
row P14.create.public "$ADMIN_TOKEN" publication_request_create "{\"dataset_id\": \"$D2\"}" 403 \
    "request the publication of an ALREADY PUBLIC dataset — refused by the same guard as publish" 'Authorization Error'

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
# CORREGIDO el 2026-10-07, y le toca a esta sonda: la negativa **no** viene de la auth propia de CKAN
# (ese decía el rótulo viejo) sino de **nuestra regla encadenada** sobre la auth de `bulk_update_public`.
# Y el camino interno **sí** existe: `_bulk_update_dataset` recorre `package_patch` — medido en el
# contenedor vivo (2.12.0, `0058b2eb`), no en el checkout 2.12.0a0 del disco, que hace un `UPDATE`
# directo. **Razón por la que A5 tiene que apretar acá:** la aserción de abajo pide `403` y el cuerpo
# del error de CKAN contiene «Authorization Error» **en los dos casos**, así que hoy no puede distinguir
# quién negó. Cuando `A5` reescriba esta fila, tiene que afirmar **el mensaje del plugin**, no sólo el
# código: una aserción que pasa por la razón equivocada es la que ya nos costó dos rondas.
row P8 "$EDITOR_TOKEN" bulk_update_public \
    "{\"org_id\": \"$ORG_A_ID\", \"datasets\": [\"$D1\"]}" 403 \
    "editor bulk_update_public — refused by this capability's chained rule, before the action body runs" 'Authorization Error'

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
    docker exec "$CONTAINER" ckan -c "$INI" dataset purge "$_name" >/dev/null 2>&1 \
        || say "P9    purge $_name FALLÓ — el nombre queda tomado y la próxima corrida dará 409 en su fixture"
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
