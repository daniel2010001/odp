> **DERIVADO** para el lienzo de Gentle Design: no es fuente de verdad, se regenera con «Design system sync».
> Fuente de verdad de los **valores**: `src/app.css`; del **significado**: `design-system/datos-umss/README.md` (AGENTS.md, regla de oro 1).
> Si este archivo y esos dos no coinciden, **mandan ellos**; corrija allá y vuelva a sincronizar.

# Sistema de diseño — Datos UMSS (derivado)

Sincronizado el 2026-10-28. Abreviaturas de fuentes:

- **CSS** = `src/app.css`
- **DS** = `design-system/datos-umss/README.md` (se cita la sección, p. ej. DS §3)
- **UI** = `src/lib/components/ui/…`
- **PROTO** = `src/routes/dev/prototype/…`

Todos los valores de abajo salen de esas fuentes. Ninguno es una propuesta. Las contradicciones entre
fuentes están en «Discrepancias» al final.

---

## 1. Colores

Los colores son tokens `oklch`: el modo claro está en `:root` y el oscuro en `.dark` (CSS). Tailwind los
expone con `@theme inline` como `--color-<token>`, y en el código se usan con utilidades (`bg-primary`,
`text-muted-foreground`…). Nunca con valores crudos (DS §3, AGENTS.md regla 3). El modo oscuro sigue a la
clase `.dark` y no a `prefers-color-scheme` (CSS, `@custom-variant dark`).

| Token | Claro (`:root`) | Oscuro (`.dark`) | Uso | Fuente |
|---|---|---|---|---|
| `--background` | `oklch(0.973 0.006 250)` | `oklch(0.22 0.02 257)` | Fondo de página (azulado casi blanco / azul-gris oscuro). | CSS; DS §3 |
| `--foreground` | `oklch(0.26 0.03 257)` | `oklch(0.93 0.008 250)` | Texto principal (slate suave, no negro puro). | CSS; DS §3 |
| `--card` | `oklch(0.995 0.001 250)` | `oklch(0.28 0.024 257)` | Fondo de tarjetas. | CSS; DS §3 |
| `--card-foreground` | `oklch(0.26 0.03 257)` | `oklch(0.93 0.008 250)` | Texto sobre tarjeta. | CSS |
| `--popover` | `oklch(0.995 0.001 250)` | `oklch(0.28 0.024 257)` | Superficie de menús, tooltips y desplegables. | CSS; UI `tooltip/tooltip-content.svelte` |
| `--popover-foreground` | `oklch(0.26 0.03 257)` | `oklch(0.93 0.008 250)` | Texto sobre popover. | CSS |
| `--primary` | `oklch(0.52 0.085 257)` | `oklch(0.66 0.1 257)` | Azul institucional: títulos, enlaces, marca, iconos, números, botón por defecto, pestaña activa. | CSS; DS §3 |
| `--primary-foreground` | `oklch(0.985 0.002 250)` | `oklch(0.2 0.03 257)` | Texto sobre `primary`. En oscuro es texto oscuro sobre relleno claro (5,81:1 en el botón, según el comentario de CSS). | CSS |
| `--secondary` | `oklch(0.74 0.06 250)` | `oklch(0.56 0.07 250)` | Azul claro: acentos y elementos secundarios; insignia «Privada» y «Pendiente». | CSS; DS §3; PROTO `collections/VisibilityBadge.svelte` |
| `--secondary-foreground` | `oklch(0.28 0.04 257)` | `oklch(0.98 0.002 250)` | Texto sobre `secondary`. | CSS |
| `--muted` | `oklch(0.945 0.008 250)` | `oklch(0.3 0.02 257)` | Fondos de bajo énfasis (código, cabeceras de tabla, insignia «Interna», conteos). | CSS; DS §3 |
| `--muted-foreground` | `oklch(0.42 0.02 257)` | `oklch(0.72 0.015 250)` | Texto secundario / de bajo énfasis. | CSS; DS §3 |
| `--accent` | `oklch(0.93 0.018 250)` | `oklch(0.34 0.04 257)` | Fondo de hover y estados suaves; insignias «Pública» y «Aprobada». | CSS; DS §3 |
| `--accent-foreground` | `oklch(0.42 0.07 257)` | `oklch(0.9 0.01 250)` | Texto sobre `accent`. | CSS |
| `--destructive` | `oklch(0.55 0.09 15)` | `oklch(0.74 0.09 15)` | **Coral**: acento institucional (rótulos eyebrow), acciones destructivas, botón «Iniciar sesión». | CSS; DS §3 |
| `--destructive-foreground` | `oklch(0.985 0.002 250)` | `oklch(0.2 0.03 257)` | Texto sobre coral. | CSS |
| `--positive` | `oklch(0.5 0.08 175)` | `oklch(0.76 0.09 175)` | **Verde azulado**: copiado, activo, aprobado, completado. Se usa en texto, icono o relleno (`/10`, `/20`), **nunca en acciones**. | CSS; DS §3; UI `copy-button/CopyButton.svelte` |
| `--positive-foreground` | `oklch(0.985 0.002 250)` | `oklch(0.2 0.03 257)` | Texto sobre `positive`. | CSS |
| `--border` | `oklch(0.905 0.01 250)` | `oklch(0.34 0.02 257)` | Bordes. Es el color por defecto de todo borde (`@layer base`, fix de Tailwind v4). | CSS; DS §3, §12 |
| `--input` | `oklch(0.905 0.01 250)` | `oklch(0.34 0.02 257)` | Borde de inputs y de botones `outline`. | CSS; DS §3 |
| `--ring` | `oklch(0.62 0.08 257)` | `oklch(0.6 0.1 257)` | Anillo de focus. | CSS; DS §3 |
| `--chart-1` | `oklch(0.56 0.13 257)` | `oklch(0.68 0.13 257)` | Serie de gráfico 1 (azul). | CSS |
| `--chart-2` | `oklch(0.64 0.13 25)` | `oklch(0.74 0.12 25)` | Serie de gráfico 2 (coral). | CSS |
| `--chart-3` | `oklch(0.6 0.1 185)` | `oklch(0.74 0.1 185)` | Serie de gráfico 3 (verde azulado). | CSS |
| `--chart-4` | `oklch(0.64 0.12 75)` | `oklch(0.76 0.12 75)` | Serie de gráfico 4 (ámbar). | CSS |
| `--chart-5` | `oklch(0.58 0.12 300)` | `oklch(0.72 0.12 300)` | Serie de gráfico 5 (violeta). | CSS |
| `--footer` | `oklch(0.44 0.09 257)` | `oklch(0.26 0.05 257)` | Fondo del footer (azul profundo). | CSS; DS §3 |
| `--footer-foreground` | `oklch(0.985 0.002 250)` | `oklch(0.93 0.008 250)` | Texto del footer. | CSS |

**Reglas de color** (DS §3, §11):

- El texto necesita un contraste mínimo de **4,5:1** (WCAG AA).
- Use como máximo **2 colores saturados** por pantalla: azul institucional + coral de acento.
- Los títulos, iconos y números van en `primary`. Los rótulos eyebrow en mayúsculas pueden ir en
  `destructive` (coral).
- No use colores hardcodeados en los componentes. Todo sale de los tokens, para que el modo oscuro
  funcione sin duplicar estilos (DS §6).
- Opacidades en uso: `primary/90` (hover del botón), `destructive/90`, `secondary/80`, `primary/10` y
  `primary/30` (insignia de pestaña activa), `muted/50` (chip de formato, panel punteado), `border/60`
  (divisores de la ficha). Fuentes: UI `button/button.svelte`, UI `tabs/OverflowTabs.svelte`,
  UI `meta/MetaGroup.svelte`, PROTO `+page.svelte`, PROTO `dataset-collections/+page.svelte`.

---

## 2. Tipografía

| Rol | Token | Pila (tal cual en CSS `@theme inline`) | Uso | Fuente |
|---|---|---|---|---|
| Headings | `--font-heading` | `"EB Garamond", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif` | Títulos de página y de dataset, aire académico/editorial. | CSS; DS §4 |
| Cuerpo / UI | `--font-sans` | `"Poppins", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | Texto, botones, inputs y todo lo demás (es la fuente del `body`). | CSS; DS §4 |
| Mono | `--font-mono` | `"JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` | Código, hashes, IDs técnicos, chips de formato. | CSS; DS §4 |

- **Pesos cargados** (CSS, `@import` de Google Fonts): EB Garamond 400/500/600/700 + 400 itálica, y
  Poppins 300/400/500/600/700. JetBrains Mono **no** se importa en CSS (ver Discrepancias).
- **Escala** (DS §4): Display 40–56 px · Heading 28–36 px · Subheading 20–24 px · Body 16–18 px ·
  Caption 13–14 px.
- **Interlineado** (DS §4): 1,1–1,2 en títulos y 1,4–1,6 en cuerpo. El markdown renderizado usa
  `line-height: 1.6` en `p` (CSS `.markdown-body`).
- **Tamaños de UI en uso** (utilidades de Tailwind en los componentes): `text-xs` (12 px) en insignias,
  etiquetas de ficha y eyebrow; `text-sm` (14 px) en botones, pestañas, migas y tooltips; `text-[11px]`
  en el rótulo de nivel del desplegable de migas. Fuentes: UI `button/button.svelte`,
  UI `breadcrumb/Breadcrumb.svelte`, UI `meta/MetaGroup.svelte`.
- **Patrones de título**:
  - Título de página: `font-heading text-3xl font-bold text-primary` (30 px) (PROTO `+page.svelte`).
  - Título de sección: `font-heading text-xl font-semibold text-primary` (20 px) (PROTO `+page.svelte`).
  - Títulos del markdown: `font-heading`, peso 600, color `primary` (CSS `.markdown-body`).
- **Eyebrow**: `text-xs font-medium uppercase tracking-wider text-destructive` (PROTO
  `collection/+page.svelte`, `collections/DatasetCollections.svelte`; DS §3).
- **Título de grupo de ficha**: `text-xs font-bold uppercase tracking-wide text-foreground` + una línea
  `h-px bg-border` (UI `meta/MetaGroup.svelte`).

---

## 3. Espaciado

No hay una escala de espaciado propia en CSS: Tailwind v4 usa su escala por defecto (unidad 0,25 rem).
La regla de uso sale de DS §5:

| Paso | Valor | Fuente |
|---|---|---|
| 1 | `4px` | DS §5 |
| 2 | `8px` | DS §5 |
| 3 | `16px` | DS §5 |
| 4 | `24px` | DS §5 |
| 5 | `32px` | DS §5 |
| 6 | `48px` | DS §5 |
| 7 | `64px` | DS §5 |

- Elementos relacionados: 8–16 px. Grupos: 24–32 px. Secciones: 48–80 px. Padding de sección: 60–80 px
  vertical (DS §5).
- Separación entre grupos de ficha: 32 px (`space-y-8`). Del título del grupo a su tarjeta: 8 px
  (UI `meta/MetaGroup.svelte`).
- Separación entre pestañas: `TAB_GAP = 4` px (UI `tabs/overflow-tabs.ts`).

**Tokens de layout** (CSS, `:root` aparte, independientes del tema):

| Token | Valor | Uso |
|---|---|---|
| `--header-h-max` | `5rem` (80 px) | Alto del encabezado en el tope; es lo que reserva el espaciador. |
| `--header-h-min` | `4rem` (64 px) | Alto del encabezado achicado. |
| `--header-h` | `var(--header-h-max)`; `4rem` con `html[data-header-shrunk]` | Alto vigente. Lo leen todos los pegados. |
| `--sticky-air` | `12px` | Aire entre el borde del encabezado y lo que se pega debajo: `calc(var(--header-h) + 1px + var(--sticky-air))`. |

**Formularios** (DS §5): `--label-offset: 0.5rem`. Alinea el label y el texto de ayuda con el
**texto** del input, no con su borde.

---

## 4. Radios

| Token | Valor | Resultado | Fuente |
|---|---|---|---|
| `--radius` | `0.5rem` | 8 px | CSS `:root` |
| `--radius-sm` | `calc(var(--radius) - 4px)` | 4 px | CSS `@theme inline` |
| `--radius-md` | `calc(var(--radius) - 2px)` | 6 px | CSS `@theme inline` |
| `--radius-lg` | `var(--radius)` | 8 px | CSS `@theme inline` |
| `--radius-xl` | `calc(var(--radius) + 4px)` | 12 px | CSS `@theme inline` |
| `rounded-full` | pill | — | DS §8 («Badges/Tags: pills redondeadas»); PROTO |

**Uso** (DS §5):

- Botones e inputs: 8 px. Cards: 12 px. Modales: 16 px.

**Uso en los componentes reales:**

- `rounded-md` (6 px): botón y campo desplegable (UI `button/button.svelte`, UI `tabs/overflow-tabs.ts`
  `FIELD_CLASS`); tooltip y menús (UI `tooltip/tooltip-content.svelte`, UI `breadcrumb/Breadcrumb.svelte`).
- `rounded-lg` (8 px): botón de copiar y tarjeta de ficha (UI `copy-button/CopyButton.svelte`,
  UI `meta/MetaGroup.svelte`).
- `rounded-xl` (12 px): card y listas (UI `card/card.svelte`, PROTO `+page.svelte`).
- `rounded-sm` (4 px): filas de menú.
- `0.25rem` en `code` y `0.5rem` en `pre` (CSS `.markdown-body`).

---

## 5. Sombras

CSS no define sombras. Los valores son los que documenta DS §5, que las llama «baja saturación,
utilidades Tailwind»:

| Nombre | Valor | Uso | Fuente |
|---|---|---|---|
| `sm` | `0 1px 2px rgba(0,0,0,.05)` | Card (`shadow-sm`). | DS §5; UI `card/card.svelte` |
| `md` | `0 4px 6px rgba(0,0,0,.10)` | Tooltip, menús desplegables; DS §8 la pide para cards. | DS §5, §8; UI `tooltip/tooltip-content.svelte` |
| `lg` | `0 10px 15px rgba(0,0,0,.10)` | Diálogo modal. | DS §5; PROTO `users/+page.svelte` |
| `xl` | `0 20px 25px rgba(0,0,0,.15)` | — | DS §5 |

---

## 6. Movimiento e interacción (DS §7, §11)

- Todo lo clickeable lleva `cursor: pointer` y un hover visible.
- Las transiciones duran **150–300 ms**: `transition-colors` en botones, migas y pestañas, y
  `duration-200` en el interruptor del prototipo.
- Los hovers **no desplazan el layout**: nada de `scale` ni `translate`.
- El focus siempre es visible: `focus-visible:ring-2 ring-ring`, y en el botón también
  `ring-offset-2 ring-offset-background` (UI `button/button.svelte`).
- Se respeta `prefers-reduced-motion`: CSS neutraliza animaciones y transiciones con `!important`.
- Responsive a 375 / 768 / 1024 / 1440 px, sin scroll horizontal en móvil.
- Iconos: sólo Lucide (`@lucide/svelte`), nunca emojis (DS §2, §11; AGENTS.md).

---

## 7. Reglas de componentes

### Botón — UI `button/button.svelte`

- **Base**: `inline-flex`, `gap-2`, `rounded-md`, `text-sm font-medium`, `transition-colors`, focus con
  `ring-2 ring-ring ring-offset-2`, y `disabled` con `opacity-50` y sin eventos.

| Variante | Clases | Uso |
|---|---|---|
| `default` | `bg-primary text-primary-foreground hover:bg-primary/90` | Acción principal. |
| `destructive` | `bg-destructive text-destructive-foreground hover:bg-destructive/90` | «Iniciar sesión» y acciones destructivas (DS §8). |
| `outline` | `border border-input bg-background hover:bg-accent hover:text-accent-foreground` | Acción neutra con borde. |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` | Acción secundaria. |
| `ghost` | `hover:bg-accent hover:text-accent-foreground` | Acción sin superficie. |
| `link` | `text-primary underline-offset-4 hover:underline` | Acción con aspecto de enlace. |

| Tamaño | Clases |
|---|---|
| `default` | `h-10 px-4 py-2` (40 px) |
| `sm` | `h-9 px-3` (36 px) |
| `lg` | `h-11 px-8` (44 px) |
| `icon` | `h-10 w-10` |

### Botón de copiar — UI `copy-button/CopyButton.svelte`

- **Superficie**: `rounded-lg border border-border bg-background text-muted-foreground`, con
  `hover:bg-accent hover:text-foreground`.
- **Tamaños**: `lg` mide h-9 (36 px), `md` h-8 (32 px) y `sm` h-7 (28 px).
- **Formas**:
  - `icon`: un cuadrado; el nombre de la acción va en un tooltip y en `aria-label`.
  - `label`: icono + texto. Con `collapseBelow`, se reduce al icono en contenedores angostos.
- **Al copiar**:
  - El icono pasa a `Check` en `text-positive`.
  - El texto cambia a «Copiado» sin cambiar el ancho, porque los dos textos comparten celda.
  - Un `role="status"` lo anuncia.

### Card — UI `card/card.svelte`

- `rounded-xl border bg-card text-card-foreground shadow-sm`.
- DS §8 pide además un hover con un lift sutil, sin layout shift.

### Breadcrumb — UI `breadcrumb/Breadcrumb.svelte`

- **Contenedor**: `<nav aria-label="Ruta de navegación">`, con `<ol>` en `text-sm gap-1`.
- **Migas**:
  - Separador: `ChevronRight` `size-3.5` en `text-muted-foreground`.
  - Ancestros: enlaces `text-muted-foreground hover:text-foreground`.
  - Miga actual: `font-medium text-foreground` con `aria-current="page"`.
- **`collapseMiddle`**: deja una sola línea. Conserva la primera miga y las dos últimas, y pliega las del
  medio tras un `Ellipsis`.
- **Desplegable**: `w-72 rounded-md border bg-popover p-1 shadow-md`. Cada fila lleva el rótulo de nivel
  en `text-[11px] text-muted-foreground`.
- **Móvil (`lg:hidden`)**: un disparador sin chip (icono + nombre + `ChevronDown`) que abre el
  «Recorrido».

### Pestañas — UI `tabs/OverflowTabs.svelte`, `tabs/overflow-tabs.ts`

- **Barra**: `border-b border-border bg-background`.
- **Pestaña**:
  - `h-12 px-4 text-sm font-medium text-muted-foreground border-b-2 border-transparent`.
  - Activa: `border-primary text-primary`.
  - Hover: `text-foreground`.
- **Insignia de conteo**: `rounded-full border px-1.5 text-xs font-semibold tabular-nums`.
  - Activa: `border-primary/30 bg-primary/10 text-primary`.
  - Inactiva: `border-border bg-muted text-muted-foreground`.
- **Desborde**: las pestañas que no caben van al menú «Más (n)», y la activa siempre queda visible.
- **Contenedor angosto**: por debajo de `mobileBelow` (32 rem por defecto) se usa un desplegable
  `FIELD_CLASS`: `h-11 rounded-md border border-input bg-background pl-3 pr-9 text-sm font-medium` con un
  chevron a la derecha.

### Tooltip — UI `tooltip/tooltip-content.svelte`

- `rounded-md border border-border bg-popover px-3 py-1.5 font-sans text-sm text-popover-foreground shadow-md`.
- No tiene transición.
- Lleva `role="tooltip"`.

### Ficha de metadatos — UI `meta/MetaGroup.svelte`

- **Título del grupo**: va afuera de la tarjeta, con una línea fina (ver Tipografía).
- **Tarjeta**: `rounded-lg border border-border`, con divisores `divide-border/60`.
- **Fila**: `px-4 py-3`.
  - Etiqueta: `<dt>` en `text-xs text-muted-foreground`.
  - Valor: `<dd>` en `text-sm font-medium`, o en `font-mono text-xs` si es técnico.
  - Copiar: un `CopyButton` `sm` al extremo.

### Insignias y chips (pills) — PROTO

Todas son `rounded-full`, en `text-xs font-medium`, con `px-2.5 py-0.5` salvo que se indique otra cosa
(DS §8: «pills redondeadas»).

| Pieza | Clases | Icono | Fuente |
|---|---|---|---|
| Visibilidad «Pública» | `bg-accent text-accent-foreground` | `Globe` `size-3` | PROTO `collections/VisibilityBadge.svelte` |
| Visibilidad «Interna» | `bg-muted text-muted-foreground` | `Users` `size-3` | ídem |
| Visibilidad «Privada» | `bg-secondary text-secondary-foreground` | `Lock` `size-3` | ídem |
| Estado «Aprobada» | `bg-accent text-accent-foreground` | `CircleCheck` | PROTO `collection/+page.svelte` |
| Estado «Pendiente» | `bg-secondary text-secondary-foreground` | `Clock` | ídem |
| Rol «Superadministrador» | `bg-primary text-primary-foreground px-2` | `ShieldCheck` | PROTO `users/+page.svelte` |
| «En preparación» | `bg-muted text-muted-foreground px-2` (sin `font-medium`) | — | PROTO `+page.svelte` |
| Chip de organización | `border border-border bg-background text-foreground px-3 py-1 gap-1.5` | `Building2` `size-3.5 text-primary` | PROTO `dataset-collections/+page.svelte` |
| Chip de formato | `border border-border bg-muted/50 font-mono text-muted-foreground px-3 py-1` | — | ídem |
| Avatar de iniciales | `size-9 rounded-full bg-accent text-xs font-semibold text-accent-foreground` | — | PROTO `users/+page.svelte` |

### Otros patrones

- **Lista con divisores**: `divide-y divide-border rounded-xl border border-border bg-card`, con filas
  `px-4 py-3` (PROTO `+page.svelte`).
- **Panel informativo**: `rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3`
  (PROTO `+page.svelte`).
- **Modal**: `max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg` (PROTO `users/+page.svelte`).
  DS §8 pide además un overlay con blur.
- **Inputs**: borde `--border`/`--input` y focus con anillo `--ring` (DS §8). Label y ayuda van con
  `--label-offset` (DS §5).

### Copy (DS §10)

- **Registro**: español neutro y formal, con trato de «usted», sin voseo y en tono institucional.
- **Ejemplos**: «Explore el catálogo», «Volver al catálogo», «Descargar recurso».
- **No nombra la implementación**: el visitante lee «catálogo», «conjunto de datos», «dirección web».
- **Roles**:
  - «Lector», «Editor» y «Administrador» (de la organización).
  - «Superadministrador» (la cuenta).
- **Orden de listas**: alfabético por la etiqueta visible, con `byLabel`, salvo las excepciones de DS §11 bis.

---

## 8. Fuente fuera del alcance de la app: `presentation/handouts/handout.css`

Es la hoja de impresión de los documentos de la presentación, no de la app. Sus valores **no son tokens
del proyecto**.

- **Copias de los tokens de CSS** (modo claro, valores idénticos): `--background`, `--foreground`,
  `--card`, `--primary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`,
  `--footer`, `--footer-foreground` y `--radius: 0.5rem`. Las pilas de EB Garamond, Poppins y
  JetBrains Mono son casi iguales a las de CSS.
- **Valores propios** (no son tokens del proyecto y no se usan en este lienzo):
  - `--coral-texto: oklch(0.42 0.1 15)`.
  - Tamaños en `pt` para impresión carta.
  - Los títulos van en `--footer` en lugar de `--primary`.

---

## Discrepancias encontradas (para corregir en la fuente, no aquí)

1. **`--primary` en oscuro**: DS §3 dice `oklch(0.6 0.1 257)` y CSS `oklch(0.66 0.1 257)`, que cambió el
   2026-10-19 por contraste. Este archivo usa el valor de CSS. La tabla de DS §3 quedó desactualizada.
2. **Sombra de card**: DS §8 pide `shadow-md`, pero UI `card/card.svelte` usa `shadow-sm`.
3. **Radio de botón e input**: DS §5 pide 8 px, pero el botón y `FIELD_CLASS` usan `rounded-md` (6 px).
   El botón de copiar sí usa 8 px (`rounded-lg`).
4. **Botón `secondary`**: DS §8 lo describe como «borde azul transparente», pero UI
   `button/button.svelte` lo rellena con `bg-secondary`. Lo más cercano a la descripción es `outline`.
5. **JetBrains Mono**: DS §2 dice que las tipografías se importan vía Google Fonts, pero el `@import` de
   CSS sólo trae EB Garamond y Poppins. JetBrains Mono cae a la pila del sistema salvo que esté instalada.
   `handout.css` sí la importa.
6. **Sombras**: CSS no las define, así que en la app rigen los valores por defecto de Tailwind v4, que no
   leí aquí. Los valores de DS §5 son los documentados y pueden no coincidir con los que se renderizan.
7. **Escala de espaciado**: CSS no tiene una propia. La escala de 8 px es una regla de DS §5, no un token.
