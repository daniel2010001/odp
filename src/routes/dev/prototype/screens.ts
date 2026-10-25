// Inventario de pantallas del prototipo: el mismo de `odd/tasks/prototype-presentation.md`.
//
// `built` son las páginas que ya existen y se capturan tal cual, desde su ruta real. `mock` son las
// pantallas que todavía no se construyeron: viven como maquetas en `/dev/prototype/<slug>`. Una maqueta
// que aún no se armó queda con `ready: false` y el índice la muestra sin enlace activo.

export type ScreenKind = "built" | "mock";

export interface Screen {
	kind: ScreenKind;
	title: string;
	href: string;
	/** Rol que la usa, para ordenar el recorrido de la presentación. */
	audience: string;
	/** Indicación para capturarla: qué abrir o qué estado mostrar. */
	note?: string;
	/** Sólo para maquetas: si ya está armada. */
	ready?: boolean;
}

export const SCREENS: Screen[] = [
	// ─── Construidas ────────────────────────────────────────────────
	{ kind: "built", title: "Inicio", href: "/", audience: "Visitante" },
	{
		kind: "built",
		title: "Catálogo y búsqueda",
		href: "/search",
		audience: "Visitante",
		note: "Capturar también una búsqueda sin resultados.",
	},
	{
		kind: "built",
		title: "Organizaciones",
		href: "/organizations",
		audience: "Visitante",
		note: "La propuesta de cambios se revisa en el playground /dev/organizations.",
	},
	{
		kind: "built",
		title: "Ficha de organización",
		href: "/organizations",
		audience: "Visitante",
		note: "Abrir una organización desde el listado.",
	},
	{
		kind: "built",
		title: "Ficha de dataset",
		href: "/search",
		audience: "Visitante",
		note: "Abrir un dataset con varios recursos desde el catálogo.",
	},
	{
		kind: "built",
		title: "Ficha de recurso",
		href: "/search",
		audience: "Visitante",
		note: "Un CSV (tabla y gráfico) y un PDF (visor).",
	},
	{ kind: "built", title: "Acerca de", href: "/about", audience: "Visitante" },
	{ kind: "built", title: "Inicio de sesión", href: "/auth/login", audience: "Usuario" },
	{ kind: "built", title: "Panel del usuario", href: "/dashboard", audience: "Editor" },
	{ kind: "built", title: "Nuevo dataset", href: "/dashboard/datasets/new", audience: "Editor" },
	{
		kind: "built",
		title: "Constructor de gráficos",
		href: "/search",
		audience: "Editor",
		note: "Desde la ficha de un recurso CSV propio: «Crear gráfico».",
	},
	{
		kind: "built",
		title: "Solicitudes de publicación",
		href: "/dashboard/requests",
		audience: "Administrador de organización",
	},
	{
		kind: "built",
		title: "Página de error",
		href: "/no-existe",
		audience: "Visitante",
	},

	// ─── Nuevas (maquetas) ──────────────────────────────────────────
	{
		kind: "mock",
		title: "Administración de usuarios",
		href: "/dev/prototype/users",
		audience: "Superadministrador",
		ready: true,
		note: "Con ?vista=nuevo se abre el formulario de alta.",
	},
	{
		kind: "mock",
		title: "Gestión de la organización",
		href: "/dev/prototype/organization-admin",
		audience: "Administrador de organización",
		ready: false,
	},
	{
		kind: "mock",
		title: "Nueva organización",
		href: "/dev/prototype/organization-new",
		audience: "Superadministrador",
		ready: false,
	},
	{
		kind: "mock",
		title: "Colaboradores del dataset",
		href: "/dev/prototype/collaborators",
		audience: "Editor",
		ready: false,
	},
	{
		kind: "mock",
		title: "Colecciones",
		href: "/dev/prototype/collections",
		audience: "Investigador",
		ready: true,
	},
	{
		kind: "mock",
		title: "Ficha de colección",
		href: "/dev/prototype/collection",
		audience: "Visitante",
		ready: true,
		note: "?vista=publica (por defecto) es lo que ve un visitante; ?vista=curador, el bloque de aprobación por organización. Con ?c=investigacion-laboratorios-fcyt se ve una colección ya publicada.",
	},
	{
		kind: "mock",
		title: "Colecciones de un dataset",
		href: "/dev/prototype/dataset-collections",
		audience: "Visitante",
		ready: true,
	},
	{
		kind: "mock",
		title: "Equipos",
		href: "/dev/prototype/teams",
		audience: "Administrador de organización",
		ready: false,
	},
	{
		kind: "mock",
		title: "Versiones del dataset",
		href: "/dev/prototype/versions",
		audience: "Editor",
		ready: false,
	},
	{
		kind: "mock",
		title: "Perfil y clave de API",
		href: "/dev/prototype/profile",
		audience: "Usuario",
		ready: false,
	},
	{
		kind: "mock",
		title: "Auditoría",
		href: "/dev/prototype/audit",
		audience: "Superadministrador",
		ready: false,
	},
];
