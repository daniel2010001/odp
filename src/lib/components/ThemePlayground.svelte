<script lang="ts">
import { Palette, RotateCcw, X } from "lucide-svelte";
import { theme } from "$lib/stores/theme";

let open = $state(false);

type ColorSlot = {
	label: string;
	varName: string;
	description: string;
};

const colorSlots: ColorSlot[] = [
	{
		label: "Primario",
		varName: "--primary",
		description: "Azul institucional — links, títulos, foco",
	},
	{ label: "Secundario", varName: "--secondary", description: "Rojo — CTAs, acentos de acción" },
	{
		label: "Acento (fondo)",
		varName: "--accent",
		description: "Fondo suave para badges y highlights",
	},
	{ label: "Fondo página", varName: "--background", description: "Fondo general del sitio" },
	{ label: "Texto principal", varName: "--foreground", description: "Color de texto body" },
	{
		label: "Texto secundario",
		varName: "--muted-foreground",
		description: "Texto apagado / labels",
	},
	{ label: "Bordes", varName: "--border", description: "Separadores y bordes" },
];

let slotValues = $state<Record<string, string>>({});
let currentTheme = $state<"light" | "dark" | "system">("system");

const unsub = theme.subscribe((v) => {
	currentTheme = v;
});

function readCurrentValues() {
	const root = document.documentElement;
	const computed = getComputedStyle(root);
	for (const slot of colorSlots) {
		const val = computed.getPropertyValue(slot.varName).trim();
		slotValues[slot.varName] = oklchToHex(val) || "#1E56A0";
	}
}

function updateColor(varName: string, hex: string) {
	slotValues[varName] = hex;
	const oklch = hexToOklch(hex);
	if (oklch) {
		document.documentElement.style.setProperty(varName, oklch, "important");
	}
}

function resetAll() {
	const root = document.documentElement;
	for (const slot of colorSlots) {
		root.style.removeProperty(slot.varName);
	}
	readCurrentValues();
}

// ─── Color conversion utils ─────────────────────────────────

function oklchToHex(oklchStr: string): string | null {
	if (!oklchStr) return null;
	const match = oklchStr.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
	if (!match) {
		if (oklchStr.startsWith("#")) return oklchStr;
		return null;
	}
	const L = parseFloat(match[1]);
	const C = parseFloat(match[2]);
	const H = parseFloat(match[3]);
	return oklchToHexValues(L, C, H);
}

function oklchToHexValues(L: number, C: number, H: number): string {
	const a = C * Math.cos((H * Math.PI) / 180);
	const b = C * Math.sin((H * Math.PI) / 180);
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = L - 0.0894841775 * a - 1.291485548 * b;
	const l = l_ * l_ * l_;
	const m = m_ * m_ * m_;
	const s = s_ * s_ * s_;
	const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const b_ = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
	return rgbToHex(linearToSrgb(r) * 255, linearToSrgb(g) * 255, linearToSrgb(b_) * 255);
}

function linearToSrgb(c: number): number {
	return c >= 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c;
}

function srgbToLinear(c: number): number {
	return c >= 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
}

function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
	return "#" + [clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function hexToOklch(hex: string): string | null {
	if (!hex.startsWith("#") || hex.length < 7) return null;
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	const lr = srgbToLinear(r);
	const lg = srgbToLinear(g);
	const lb = srgbToLinear(b);
	const L = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
	const M = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
	const S = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
	const l_ = Math.cbrt(L);
	const m_ = Math.cbrt(M);
	const s_ = Math.cbrt(S);
	const L_ = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
	const a_ = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
	const C = Math.sqrt(a_ * a_ + b_ * b_);
	const H = Math.atan2(b_, a_) * (180 / Math.PI);
	const hue = H >= 0 ? H : H + 360;
	return `oklch(${L_.toFixed(3)} ${C.toFixed(3)} ${hue.toFixed(3)})`;
}

function exportPalette() {
	const root = document.documentElement;
	const computed = getComputedStyle(root);
	const lines: string[] = ["/* Custom UMSS Palette */", ":root {"];
	for (const slot of colorSlots) {
		const val = computed.getPropertyValue(slot.varName).trim();
		lines.push(`\t${slot.varName}: ${val};`);
	}
	lines.push("}");

	root.classList.add("dark");
	void root.offsetHeight;
	const darkComputed = getComputedStyle(root);
	lines.push("", ".dark {");
	for (const slot of colorSlots) {
		const val = darkComputed.getPropertyValue(slot.varName).trim();
		lines.push(`\t${slot.varName}: ${val};`);
	}
	lines.push("}");

	if (currentTheme !== "dark") root.classList.remove("dark");

	navigator.clipboard.writeText(lines.join("\n")).then(() => {
		alert("Paleta copiada.\n\nPegala en src/app.css reemplazando :root y .dark.");
	});
}

function applyPreset(primary: string, secondary: string, accent: string) {
	resetAll();
	updateColor("--primary", primary);
	updateColor("--secondary", secondary);
	updateColor("--accent", accent);
}
</script>

{#if open}
	<div
		class="fixed bottom-4 right-4 z-50 w-80 max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
	>
		<div class="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3">
			<h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Palette class="size-4" />
				Theme Playground
			</h3>
			<div class="flex items-center gap-1">
				<button
					onclick={resetAll}
					class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					title="Resetear"
				>
					<RotateCcw class="size-3.5" />
				</button>
				<button
					onclick={() => (open = false)}
					class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					aria-label="Cerrar"
				>
					<X class="size-3.5" />
				</button>
			</div>
		</div>

		<!-- Theme mode -->
		<div class="border-b border-border px-4 py-3">
			<label class="mb-1 block text-xs font-medium text-muted-foreground">Modo</label>
			<div class="flex gap-1">
				<button
					onclick={() => theme.set("light")}
					class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {currentTheme === 'light' ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground'}"
				>
					Claro
				</button>
				<button
					onclick={() => theme.set("dark")}
					class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {currentTheme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground'}"
				>
					Oscuro
				</button>
				<button
					onclick={() => theme.set("system")}
					class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors {currentTheme === 'system' ? 'bg-primary text-primary-foreground' : 'bg-accent text-foreground'}"
				>
					Sistema
				</button>
			</div>
		</div>

		<!-- Color pickers -->
		<div class="space-y-3 px-4 py-3">
			{#each colorSlots as slot (slot.varName)}
				<div>
					<div class="flex items-center justify-between">
						<label for="color-{slot.varName}" class="text-xs font-medium text-foreground">
							{slot.label}
						</label>
						<span class="text-[10px] font-mono text-muted-foreground">{slotValues[slot.varName] || '...'}</span>
					</div>
					<p class="mb-1.5 text-[10px] text-muted-foreground">{slot.description}</p>
					<div class="flex items-center gap-2">
						<input
							id="color-{slot.varName}"
							type="color"
							value={slotValues[slot.varName] || '#1E56A0'}
							oninput={(e) => updateColor(slot.varName, e.currentTarget.value)}
							class="h-8 w-10 cursor-pointer rounded border border-border"
						/>
						<input
							type="text"
							value={slotValues[slot.varName] || ''}
							oninput={(e) => {
								const val = e.currentTarget.value;
								if (/^#[0-9a-fA-F]{6}$/.test(val)) {
									updateColor(slot.varName, val);
								}
							}}
							class="h-8 flex-1 rounded border border-border bg-background px-2 font-mono text-xs text-foreground"
						/>
					</div>
				</div>
			{/each}
		</div>

		<!-- Presets -->
		<div class="border-t border-border px-4 py-3">
			<label class="mb-2 block text-xs font-medium text-muted-foreground">Presets</label>
			<div class="grid grid-cols-2 gap-2">
				<button
					onclick={() => applyPreset('#1E56A0', '#DC3545', '#EEF2F7')}
					class="rounded-md border border-border px-2 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
				>
					UMSS Suave
				</button>
				<button
					onclick={() => applyPreset('#003770', '#E30613', '#E8F0FA')}
					class="rounded-md border border-border px-2 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
				>
					UMSS Oficial
				</button>
				<button
					onclick={() => applyPreset('#2563EB', '#F59E0B', '#EFF6FF')}
					class="rounded-md border border-border px-2 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
				>
					Tech
				</button>
				<button
					onclick={() => applyPreset('#0F766E', '#DC2626', '#F0FDFA')}
					class="rounded-md border border-border px-2 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
				>
					Cívico
				</button>
			</div>
		</div>

		<!-- Export -->
		<div class="border-t border-border px-4 py-3">
			<button
				onclick={exportPalette}
				class="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				Copiar paleta como CSS
			</button>
			<p class="mt-1 text-center text-[10px] text-muted-foreground">
				Pega en <code class="rounded bg-muted px-1">src/app.css</code>
			</p>
		</div>
	</div>
{:else}
	<button
		onclick={() => { open = true; readCurrentValues(); }}
		class="fixed bottom-4 right-4 z-50 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
		aria-label="Editar colores del tema"
		title="🎨 Colores"
	>
		<Palette class="size-5" />
	</button>
{/if}