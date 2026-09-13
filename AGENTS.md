# AGENTS.md — Convenciones del proyecto

> Guía de convenciones y de "dónde viven las cosas" para agentes de IA y
> desarrolladores humanos. Léela antes de tocar código, documentación o diseño.

## Dónde vive cada cosa (fuentes de verdad)

| Tema | Ubicación | Notas |
|---|---|---|
| Requerimientos de producto | `PRD.md` | Documento de requisitos del portal. |
| **Valores** de tokens de diseño (colores, tipografía, radios) | `src/app.css` | Tokens shadcn-svelte `oklch`. Es la verdad; cualquier cambio de color/fuente va acá. |
| **Significado** del sistema de diseño (reglas, roles semánticos, inventario de páginas, copy) | `design-system/datos-umss/README.md` | Doc canónico. Si contradice otro doc, manda este. |
| Contratos de comportamiento de features | `openspec/specs/` | Specs OpenSpec (formato GIVEN/WHEN/THEN). |
| Cambios en curso (SDD) | `openspec/changes/` | Artefactos de cambios activos. |
| Cambios cerrados | `openspec/changes/archive/` | Trazabilidad de cambios ya archivados. |
| **Pendientes y para-futuro** | `BACKLOG.md` | Fuente única de pendientes. Todo lo que quede "para después" en una sesión se anota acá antes de cerrar; al cerrar un ítem se borra (git guarda el historial). |
| Mockups visuales | `design-system/datos-umss/pages/*.op` | Archivos OpenPencil. |

## Reglas de oro

1. **Un archivo canónico por tema, versionado con git.** No crear archivos nuevos por
   sesión o por decisión; actualizá el archivo existente en su lugar. El historial de git
   es el registro de "qué cambió y cuándo".
2. **Las decisiones durables van al repo.** Un token, un contrato de comportamiento o una
   decisión de arquitectura debe quedar escrita en un archivo del repo, no solo en memoria
   de trabajo efímera. La memoria de sesión es continuidad, no documentación.
3. **Colores vía tokens, nunca hex crudos.** Usá utilidades de Tailwind (`bg-primary`,
   `text-destructive`, etc.). Los tokens son `oklch` (paleta pastel azul + coral).
4. **Tipografías:** EB Garamond (headings, `font-heading`), Poppins (cuerpo, `font-sans`),
   JetBrains Mono (código/hashes, `font-mono`).
5. **Iconos:** Lucide (SVG). Prohibido emojis como iconos.
6. **Copy de UI en español neutro y formal (trato de "usted"):** "Explore", "Navegue",
   "Limpie los filtros", "Volver al catálogo". Sin voseo ni regionalismos. Tono institucional,
   sin marketing agresivo.
7. **Accesibilidad:** contraste de texto ≥ 4.5:1, focus visible, `prefers-reduced-motion`,
   hovers que no desplazan el layout, responsive sin scroll horizontal en móvil.
8. **UI: el agente propone, el usuario revisa, se itera.** Para cualquier trabajo de interfaz
   (página, componente, layout), el agente propone un diseño concreto y verificable — no una
   descripción abstracta. Se implementa en un playground `/dev/<page>` que duplica la página real,
   el usuario lo revisa, y se itera ahí hasta que quede; recién entonces se promueve a la página
   real y se borra el playground. Los mockups de OpenPencil son punto de partida, no fuente de
   verdad.

## Stack

SvelteKit 2 + Svelte 5 (runes) + TailwindCSS 4 + shadcn-svelte · TypeScript (strict) ·
pnpm 10 · CKAN (backend) · Biome (lint/format).

**Componentes de UI — decisión (2026-09-13).** Vendorizamos los componentes **en nuestro propio
estilo**, sobre los tokens de `src/app.css` (que son la fuente de verdad visual). **No** adoptamos
el estilo `nova` de shadcn-svelte ni `tailwind-variants`. Los primitivos interactivos son
**bits-ui** (`Combobox`, `Command`, `Popover`, `Dialog`, `DropdownMenu`, `Select`, `Tabs`,
`Tooltip`): úselos antes de escribir comportamiento a mano. **No** corra `shadcn-svelte add` a
ciegas: el CLI (1.x) sólo ofrece `nova` y pisaría/contaminaría los componentes existentes. Cuando
haga falta un componente nuevo, se vendoriza a mano: se toma su estructura (del registry o del
componente equivalente) y se reemplazan las clases por las nuestras. Iconos: **`@lucide/svelte`**
(`lucide-svelte` está deprecado).

## Comandos útiles

```sh
pnpm install     # instalar dependencias
pnpm dev         # http://localhost:5173
pnpm test        # vitest
pnpm check       # typecheck
pnpm build       # build de producción
pnpm lint        # Biome
```
