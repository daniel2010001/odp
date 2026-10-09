# Expediente ODD — reconciliación del `PRD.md` y del `BACKLOG.md` (tiers y divergencias)

**Autorizado por el autor el 2026-10-09** («me gustaría hacer el barrido del backlog, una revisión del doc en
general, junto al prd si se puede» → **GO**).

## Goal

Dejar el `PRD.md` y el `BACKLOG.md` **coherentes con lo que se construyó**, y **recortar `v1`**: censo de los ítems
`[v0]`, cruce requerimiento por requerimiento, re-tiering explícito, y una carilla «qué es `v0` y qué no es» que sirva
además de guion de presentación.

## La regla que el autor fijó (2026-10-09)

**El PRD no es la fuente de verdad de lo construido**: es un documento que alguien escribió en un momento, y puede
contradecir lo que hoy existe. Donde el PRD declara un módulo «con las features Y y Z completas» y `v0` tomó **sólo Y**,
**Z parcial**, o **Z con cambios hechos durante el desarrollo**, la **divergencia se registra en el propio PRD** —con
fecha y motivo— en vez de dejarla al lector deducirla. La misma regla vale para el `BACKLOG`.

Consecuencia directa, y es la que originó la autorización: **una contradicción entre el PRD y el portal no se resuelve
silenciosamente a favor del PRD**. Se mide qué existe y se escribe la diferencia.

## Los cuatro pasos

1. **Censo de los `[v0]` abiertos** (`13` al 2026-10-09) con medición por ítem (`path:line`, comando o URL) y **cierre de
   los stale**. Los dos primeros sospechosos ya identificados: el «`403` pintado como *Recurso no encontrado*» (la
   página ya renderiza `ErrorPage`) y la sonda de sesión (ya existe `src/lib/session-guard.ts`).
2. **Cruce `PRD` ↔ `BACKLOG` ↔ código**, requerimiento por requerimiento, con cuatro estados posibles: **hecho**,
   **parcial**, **ausente**, **sin equivalente en CKAN**.
3. **Re-tiering explícito de `v1`**: lo que no entra se mueve **con el motivo escrito**, y el destino puede ser `v1+`
   **o `v0`** — el autor lo precisó: no sólo se recorta hacia arriba, también se puede **traer a `v0`** lo que hoy está
   mal ubicado.
4. **Una carilla «qué es `v0` y qué no es»**: los tres estados anteriores en una página, más el **guion de la
   presentación**, incluida la **provisión de una instalación vacía** (sin organizaciones no hay dataset posible: la
   muleta aceptada es CKAN / `scripts/seed-ckan.mjs`).

## Reglas de trabajo

- **Las citas de código del **otro** repo van por **ancla** (función, símbolo, escenario), no por número de línea.** Una
  ruta ajena **envejece sin que su dueño se entere**, y el número de línea es lo primero que se corre: es la misma
  lección que este repo ya pagó con las citas del PRD, aplicada al otro repo. Lo mismo vale para el path cuando el
  ancla alcanza; el path se conserva sólo como procedencia de la medición. **Las tres citas con número de línea del
  otro repo que había el 2026-10-09 se corrigieron en el mismo movimiento** —el paso 2 no debería encontrar ninguna.
  *Origen (2026-10-09): la sesión par se negó a citar rutas nuestras en su contrato por esta misma razón (una ruta de
  otro repo envejece y su doc quedaría mintiendo por algo que no es suyo), y el criterio se aplicó de vuelta acá.*

- **Un archivo canónico por tema.** Los cambios al PRD van **al PRD**; los de pendientes, al `BACKLOG`. No se crea un
  archivo nuevo por sesión ni por decisión.
- **Ninguna afirmación de «hecho» sin medición.** Un `path:line`, un comando o una URL por afirmación.
- **No se toca código del portal en esta unidad** (es documentación; si un hallazgo pide código, se anota).
- El tier final lo define el autor: el agente propone con la medición delante.

## Estado

**Primera pasada NO INICIADA** al 2026-10-09. Los pasos se ejecutan en orden y cada uno se cierra con su commit de
documentación.
