# Design System — Datos UMSS

> **Plataforma de Datos Abiertos — Universidad Mayor de San Simón (UMSS), Bolivia.**
>
> Este archivo es la **fuente de verdad de diseño** del frontend. Es canónico: si algo
> aquí contradice a otro documento, este archivo manda. La implementación real de los
> tokens vive en `src/app.css`; este documento describe su *significado* y las reglas de uso.

---

## 1. Qué es el proyecto

Portal de datos abiertos de la UMSS. Permite a facultades, direcciones e institutos
publicar, organizar, versionar y compartir datasets (conjuntos de datos) académicos y
administrativos bajo principios FAIR. Los usuarios buscan, visualizan, previsualizan y
descargan datasets.

- **Backend:** CKAN (plataforma open-source de datos abiertos) + Solr para búsqueda facetada.
- **Frontend:** SvelteKit 2 + Svelte 5 + TailwindCSS 4 + shadcn-svelte. TypeScript.
- **Entidades del dominio:** Dataset (título, descripción, organización propietaria,
  metadatos, etiquetas, licencia), Recurso (archivo o enlace dentro de un dataset, con
  formato, tamaño, tipo MIME, hash), Organización (facultad/dirección/instituto), Tags.
- **Roles y visibilidad:** superadmin, org_admin, editor, viewer; visibilidad en 3 niveles
  (privado, interno, público) y ciclo de vida (borrador → revisión → aprobado → publicado).
- **Tono visual:** ACADÉMICO, universitario, serio, tradicional, de confianza institucional.
  NO es un producto comercial moderno/de moda: es una universidad.

---

## 2. Stack de diseño

- **Sistema de tokens:** shadcn-svelte. Los valores se definen como variables CSS `oklch`
  en `src/app.css` (modo claro en `:root`, modo oscuro en `.dark`).
- **Tipografías:** importadas en `src/app.css` vía Google Fonts.
- **Iconos:** Lucide (SVG), exclusivamente. Prohibido usar emojis como iconos.

> **Fuente de verdad de los valores:** `src/app.css`. Si cambias un color/tipografía,
> lo cambias ahí; este documento se actualiza solo cuando cambia el *significado* de un token.

---

## 3. Paleta de color

Paleta **pastel** azul + coral. El sistema de tokens expone colores semánticos (no hex
hardcodeados). Usá los tokens vía utilidades de Tailwind (`bg-primary`, `text-foreground`,
`text-destructive`, etc.), nunca valores crudos.

| Token | Rol semántico | Claro (`:root`) | Oscuro (`.dark`) |
|---|---|---|---|
| `--primary` | Azul institucional. Títulos, enlaces, brand, iconos, números. | `oklch(0.52 0.085 257)` | `oklch(0.6 0.1 257)` |
| `--secondary` | Azul claro. Acentos y elementos secundarios. | `oklch(0.74 0.06 250)` | `oklch(0.56 0.07 250)` |
| `--destructive` | **Coral.** Acento institucional UMSS (rótulos eyebrow), acciones destructivas y botón "Iniciar Sesión". | `oklch(0.55 0.09 15)` | `oklch(0.74 0.09 15)` |
| `--background` | Fondo de página (azulado casi blanco). | `oklch(0.973 0.006 250)` | `oklch(0.22 0.02 257)` |
| `--foreground` | Texto principal (slate suave, no negro puro). | `oklch(0.26 0.03 257)` | `oklch(0.93 0.008 250)` |
| `--card` | Fondo de cards. | `oklch(0.995 0.001 250)` | `oklch(0.28 0.024 257)` |
| `--muted` / `--muted-foreground` | Texto secundario / de bajo énfasis. | `oklch(0.945 0.008 250)` / `oklch(0.42 0.02 257)` | `oklch(0.3 0.02 257)` / `oklch(0.72 0.015 250)` |
| `--accent` | Fondo de hover/estados suaves. | `oklch(0.93 0.018 250)` | `oklch(0.34 0.04 257)` |
| `--border` / `--input` | Bordes e inputs. | `oklch(0.905 0.01 250)` | `oklch(0.34 0.02 257)` |
| `--ring` | Anillo de focus. | `oklch(0.62 0.08 257)` | `oklch(0.6 0.1 257)` |
| `--footer` | Fondo del footer (azul profundo). | `oklch(0.44 0.09 257)` | `oklch(0.26 0.05 257)` |

**Reglas de color:**
- Contraste de texto de cuerpo mínimo **4.5:1** (WCAG AA).
- Máximo **2 colores saturados** por pantalla (azul institucional + coral de acento).
- Los títulos, iconos y números van en `primary`; los rótulos eyebrow en mayúsculas pueden
  usar `destructive` (coral) para recuperar el contraste institucional azul + coral.

---

## 4. Tipografía

| Rol | Token | Fuente | Uso |
|---|---|---|---|
| Headings | `--font-heading` | **EB Garamond** (serif) | Títulos, aire académico/editorial |
| Cuerpo / UI | `--font-sans` | **Poppins** (300–700) | Texto, botones, inputs, todo lo demás |
| Mono | `--font-mono` | **JetBrains Mono** | Código, hashes, IDs técnicos |

- **Escala:** Display 40–56px · Heading 28–36px · Subheading 20–24px · Body 16–18px ·
  Caption 13–14px.
- **Interlineado:** títulos 1.1–1.2 · cuerpo 1.4–1.6.
- Los títulos de página/dataset usan `font-heading` (serif) para el acento editorial.

---

## 5. Espaciado, radios y sombras

**Espaciado (escala de 8px):** `4px · 8px · 16px · 24px · 32px · 48px · 64px`.
Relacionados 8–16px, grupos 24–32px, secciones 48–80px. Padding de sección 60–80px vertical.

**Radios:** token `--radius` (`0.5rem`) con variantes `--radius-sm/md/lg/xl`.
- Botones/inputs: `8px` · Cards: `12px` · Modales: `16px`.

**Sombras (baja saturación, utilidades Tailwind):**
- `sm` `0 1px 2px rgba(0,0,0,.05)` · `md` `0 4px 6px rgba(0,0,0,.10)` ·
  `lg` `0 10px 15px rgba(0,0,0,.10)` · `xl` `0 20px 25px rgba(0,0,0,.15)`.

**Formularios — alineación de label y ayuda (obligatoria).** El **label y el texto de ayuda se alinean
con el TEXTO del input**, no con su borde. Como el input lleva `px-3` (12px) más 1px de borde, el label
queda ~13px a la izquierda y se nota («hace un toc»). La separación es la variable CSS
**`--label-offset`** (valor elegido: **`0.5rem`**), aplicada en el contenedor del campo:
`class="space-y-1.5 [&>label]:pl-[var(--label-offset)] [&>p]:pl-[var(--label-offset)]"` y definida en el
`<form>` con `style="--label-offset: …"`.

---

## 6. Modo oscuro

Soportado vía toggle claro/oscuro/sistema. La clase `.dark` redefine los tokens en
`src/app.css`. Todo color debe leerse desde tokens para que el dark mode funcione sin
duplicar estilos.

---

## 7. Reglas de interacción (obligatorias)

- Todo elemento clickeable debe tener `cursor:pointer` y un estado hover visible.
- Transiciones suaves de **150–300ms** en todos los cambios de estado (nunca instantáneos).
- Los hovers **NO** deben desplazar el layout (prohibido `scale`/`translate` que mueva contenido).
- Estados de focus **siempre visibles** (accesibilidad por teclado).
- Respetar `prefers-reduced-motion`.
- Responsive en **375px, 768px, 1024px, 1440px**. Sin scroll horizontal en móvil. Sin
  contenido oculto detrás de navbars fijos.

---

## 8. Componentes base (shadcn-svelte)

- **Botones:** `primary` (fondo `--primary`), `secondary` (borde azul transparente),
  `destructive` (coral, para "Iniciar Sesión" y acciones destructivas).
- **Cards:** fondo `--card`, radio 12px, `shadow-md`, hover con lift sutil (sin layout shift).
- **Inputs:** borde `--border`, focus con anillo `--ring`.
- **Modales:** overlay con blur + card blanca.
- **Badges/Tags:** pills redondeadas.
- **Breadcrumbs, Pagination, Tabs, Accordions (para filtros), Skeletons (estado de carga).**

---

## 9. Inventario de páginas

### Públicas (sin login)

1. **Home (`/`)** — Landing.
   - Header/navbar: logo "Datos UMSS", links "Catálogo" y "Acerca de", toggle de tema
     (claro/oscuro/sistema), botón "Iniciar Sesión" (coral). Menú hamburguesa en móvil.
   - Hero con gradiente azul institucional: título grande (serif), subtítulo, y 2 CTAs
     ("Explorar Catálogo" + "Más Información").
   - Sección "Sobre la plataforma": cards KPI (datasets, organizaciones, recursos, formatos).
   - Sección "Empiece a explorar": barra de búsqueda grande centrada.
   - Sección "Por organización": grid de cards de organizaciones (top 6 activas).
   - Footer institucional: "Universidad Mayor de San Simón — Plataforma de Datos Abiertos".

2. **Catálogo / Búsqueda (`/search`)** — Página de datos densa (core de la app).
   - Header con título + descripción + barra de búsqueda.
   - Sidebar izquierdo (~280px) con filtros facetados en accordions: Organización, Formato,
     Etiquetas, Licencia. Con pills de filtros activos y "Limpiar todos".
   - Barra de resultados: contador ("N resultados para «q»") + select de orden
     (Más recientes, A-Z, Relevancia, etc.).
   - Lista de cards de dataset (title-first): título, organización + visibilidad inline,
     descripción, etiquetas, formato, fecha. Sin botón de descarga directo en la card.
   - Estados: loading (skeleton), vacío ("Sin resultados" con sugerencias), error.
   - Paginación al pie.
   - Densidad de información alta; búsqueda con sugerencias al tipear (no exigir Enter).

3. **Detalle de Dataset (`/dataset/[id]`)** — Ficha de lectura.
   - Breadcrumb "Volver al catálogo".
   - Título grande (serif) + subrayado azul + organización + badge "Privado" si aplica.
   - Secciones: Descripción, Metadatos (lista clave/valor con iconos), Etiquetas (hashtags),
     Recursos (lista de cards clickeables con nombre, formato y tamaño — sin descarga directa).
   - Footer técnico: ID, slug, estado.

4. **Detalle de Recurso (`/dataset/[id]/resource/[resourceId]`)** — Ficha del archivo.
   - Breadcrumb completo: Datasets > [Organización] > [Dataset] > [Recurso].
   - Título + badge de estado (Activo/Eliminado).
   - Secciones: Descripción, Metadatos (formato, tamaño, tipo MIME, tipo, creado, hash),
     Sección "API" (si es recurso tipo API), botón "Descargar recurso", área "Vista previa"
     (placeholder "Próximamente").
   - Estados: loading, 404 ("Recurso no encontrado").

5. **Acerca de (`/about`)** — Página institucional simple de texto.

### Privadas (requieren login)

6. **Login (`/auth/login`)** — Formulario email + contraseña, botón coral institucional.
7. **Dashboard del usuario** — Panel con "Mis datasets", "Mis organizaciones", solicitudes
   pendientes, y accesos rápidos (crear dataset, subir recurso).
8. **Catálogo de Organizaciones (`/organizations`)** — Grid/listado de facultades y direcciones.
9. **Detalle de Organización (`/organization/[id]`)** — Datasets de esa org + info + roles.
10. **Formulario de Dataset (crear/editar)** — Wizard o formulario por secciones: título,
    descripción, organización, licencia, etiquetas, visibilidad; editor de metadatos
    (Dublin Core/DCAT-AP); carga de recursos (drag & drop, multi-formato, límite 50 MB).
    **Recursos — reglas de campos:** un recurso es archivo **o** enlace (nunca ambos); su **nombre**
    y su **descripción** no tienen mínimo ni máximo en CKAN, pero CKAN **no hereda el nombre del
    archivo**, así que si el título queda vacío el portal usa el nombre del archivo (o la URL del
    enlace). La descripción es *recomendada*, no obligatoria. Verificado en el PRD §7.
    En **móvil no hay arrastrar y soltar**: la zona de carga dice «Elija los archivos del equipo».
11. **Módulo de Análisis de CSV** — Cargar CSV, tabla normalizada, selector de columnas X/Y,
    gráficos (barras, líneas, pastel) con export PNG/CSV.
12. **Gestión de colaboradores/equipos y colecciones** — Paneles de permisos por rol.
13. **Auditoría (solo superadmin)** — Tabla de logs de operaciones críticas con filtros.

---

## 10. Idioma y tono del copy

- **Español neutro y formal (trato de "usted").** Sin voseo ni regionalismos. Ejemplos reales
  del producto: "Explore el catálogo", "Buscar datasets, organizaciones, temas...",
  "No encontramos datasets", "Limpiar búsqueda y filtros", "Volver al catálogo",
  "Descargar recurso", "Navegue por las organizaciones", "Intente nuevamente más tarde".
- **Tono institucional**, neutro y profesional; sin jerga de marketing agresivo.

---

## 11. Accesibilidad y anti-patrones

**Anti-patrones (NO usar):**
- ❌ Emojis como iconos — usar SVG (Lucide).
- ❌ Colores hardcodeados en componentes — usar tokens.
- ❌ Hovers que desplazan el layout.
- ❌ Texto de bajo contraste (< 4.5:1).
- ❌ Cambios de estado instantáneos (sin transición).
- ❌ Estados de focus invisibles.
- ❌ Scroll horizontal en móvil.
- ❌ Pantalla en blanco o "0 resultados" sin sugerencias en búsquedas.

**Checklist pre-entrega:**
- [ ] Iconos SVG de un set consistente (Lucide), sin emojis.
- [ ] Colores vía tokens, no hex crudos.
- [ ] `cursor-pointer` en todo elemento clickeable.
- [ ] Hover con transición 150–300ms, sin layout shift.
- [ ] Contraste 4.5:1 mínimo en texto.
- [ ] Focus visible (teclado).
- [ ] `prefers-reduced-motion` respetado.
- [ ] Responsive 375/768/1024/1440px, sin scroll horizontal en móvil.

---

## 12. Notas técnicas

- **Tailwind v4 y bordes:** la utilidad `border` (solo ancho) no define color por defecto;
  el fix en `src/app.css` (`@layer base`) apunta el color base al token `--border`. Usá
  utilidades con color explícito (`border-primary/15`) cuando quieras pisarlo.
- **Tokens como fuente de verdad:** cualquier cambio de color/tipografía se hace en
  `src/app.css`; este documento se actualiza solo si cambia el rol semántico de un token.
