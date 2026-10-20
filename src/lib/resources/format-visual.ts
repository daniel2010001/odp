import {
	File,
	FileBraces,
	FileSpreadsheet,
	FileText,
	Link as LinkIcon,
	Map as MapIcon,
} from "@lucide/svelte";
import type { Component } from "svelte";
import { cn } from "$lib/utils";

/**
 * Token de acento por formato: `--chart-N`, nunca colores crudos (AGENTS regla 3; BACKLOG «La paleta de
 * formato»). Es el **único** mapa formato → color: lo leen el cuadro del ícono y el punto del chip de la
 * fila de recursos. Un enlace o un formato desconocido no tiene token y queda neutro.
 */
export const FORMAT_TOKEN = {
	CSV: 1,
	XLSX: 3,
	XLS: 3,
	JSON: 4,
	GEOJSON: 5,
	PDF: 2,
} as const;

export type FormatToken = 1 | 2 | 3 | 4 | 5;

/** Token del formato, o `null` si no tiene (desconocido, vacío o ausente). */
export function formatToken(format: string | null | undefined): FormatToken | null {
	const key = format?.trim().toUpperCase();
	if (!key || !Object.hasOwn(FORMAT_TOKEN, key)) return null;
	return FORMAT_TOKEN[key as keyof typeof FORMAT_TOKEN];
}

// Las clases son literales porque Tailwind sólo genera lo que lee escrito.
const TOKEN_CLASS: Record<FormatToken, { dot: string; tile: string }> = {
	1: {
		dot: "bg-chart-1",
		tile: "border-chart-1/40 bg-chart-1/15 text-[color-mix(in_oklab,var(--chart-1)_70%,var(--foreground))]",
	},
	2: {
		dot: "bg-chart-2",
		tile: "border-chart-2/40 bg-chart-2/15 text-[color-mix(in_oklab,var(--chart-2)_70%,var(--foreground))]",
	},
	3: {
		dot: "bg-chart-3",
		tile: "border-chart-3/40 bg-chart-3/15 text-[color-mix(in_oklab,var(--chart-3)_70%,var(--foreground))]",
	},
	4: {
		dot: "bg-chart-4",
		tile: "border-chart-4/40 bg-chart-4/15 text-[color-mix(in_oklab,var(--chart-4)_70%,var(--foreground))]",
	},
	5: {
		dot: "bg-chart-5",
		tile: "border-chart-5/40 bg-chart-5/15 text-[color-mix(in_oklab,var(--chart-5)_70%,var(--foreground))]",
	},
};

const TILE_BASE = "inline-flex size-10 shrink-0 items-center justify-center rounded-lg border";
const NEUTRAL_TILE = "border-muted-foreground/30 bg-muted text-muted-foreground";

/**
 * Cuadro del ícono (40 px con el borde incluido): teñido con el token al 15 %, borde al 40 % y el ícono
 * en el token mezclado 70/30 con `--foreground` (único tratamiento por formato que llega a 3:1 en claro y
 * en oscuro). Un enlace es neutro aunque declare un formato.
 */
export function formatTileClass(format: string | null | undefined, isLink: boolean): string {
	const token = isLink ? null : formatToken(format);
	return cn(TILE_BASE, token ? TOKEN_CLASS[token].tile : NEUTRAL_TILE);
}

/** Punto de color del chip de formato; neutro si el formato no tiene token. */
export function formatDotClass(format: string | null | undefined): string {
	const token = formatToken(format);
	return token ? TOKEN_CLASS[token].dot : "bg-muted-foreground";
}

const FORMAT_ICON: Record<string, Component> = {
	CSV: FileSpreadsheet,
	XLSX: FileSpreadsheet,
	XLS: FileSpreadsheet,
	JSON: FileBraces,
	GEOJSON: MapIcon,
	PDF: FileText,
};

/** Ícono por formato; un enlace lleva `Link` y un formato desconocido cae en `File`. */
export function formatIcon(format: string | null | undefined, isLink: boolean): Component {
	if (isLink) return LinkIcon;
	return FORMAT_ICON[format?.trim().toUpperCase() ?? ""] ?? File;
}
