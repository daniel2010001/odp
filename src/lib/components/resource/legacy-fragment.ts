// Migra un fragmento heredado en español de la URL actual a su equivalente en inglés (`LEGACY_FRAGMENTS`), con
// `replaceState` (sin historial). Devuelve el fragmento nuevo, o `null` si la URL no llevaba uno heredado.
import { replaceState } from "$app/navigation";
import { upgradeFragment } from "./preview-views";

export function rewriteLegacyFragment(current: URL): string | null {
	const next = upgradeFragment(current.hash);
	if (!next) return null;
	const url = new URL(current);
	url.hash = next;
	replaceState(url, {});
	return next;
}
