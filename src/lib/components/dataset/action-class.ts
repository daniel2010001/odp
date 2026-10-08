// La **forma** de una acción del hero, en un solo lugar.
//
// Hasta el 2026-10-08 esta clase estaba escrita **dos veces** —el enlace «Editar» de la ficha y el control
// de solicitar— y una revisión la dejó como deuda declarada (`R3-hero-action-class-drift`). Al ir a unificarla
// se midió que **las dos copias no eran idénticas**: la del control lleva un ` disabled:opacity-60` al final,
// porque es un `<button>` y puede deshabilitarse; un enlace no.
//
// Así que lo compartido es la **base** y la diferencia queda **nombrada** en cada consumidor en vez de repetida
// entera. Unificar la copia completa habría cambiado uno de los dos dibujos: el enlace habría ganado un estilo
// que no puede usar, o el botón habría perdido el suyo.
export const ACCION_BASE =
	"inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
