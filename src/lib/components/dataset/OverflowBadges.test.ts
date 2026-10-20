// Pruebas de la fila de insignias del hero (T13): la regla es que una insignia es **enlace sólo si existe un
// filtro de búsqueda** para su valor; los estados informan y no son enlaces. jsdom no tiene layout —el ancho
// medido es 0—, así que acá ninguna insignia se oculta: el recorte («+N») se mide en Chromium.

import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import OverflowBadges, { type BadgeItem } from "./OverflowBadges.svelte";

const BADGES: BadgeItem[] = [
	{
		id: "org",
		label: "Facultad de Ciencias",
		priority: 0,
		shrinks: true,
		linkable: true,
		href: "/search?org=facultad-de-ciencias",
		linkLabel: "Ver datasets de Facultad de Ciencias en el catálogo",
		tone: "border-primary/20 bg-primary/10 text-primary",
	},
	{ id: "privacidad", label: "Privado", priority: 1, tone: "border-destructive/20" },
];

describe("OverflowBadges", () => {
	it("la insignia con filtro de búsqueda es un enlace con nombre accesible propio; el estado no lo es", () => {
		render(OverflowBadges, { props: { badges: BADGES } });

		const link = screen.getByRole("link", {
			name: "Ver datasets de Facultad de Ciencias en el catálogo",
		});
		expect(link).toHaveAttribute("href", "/search?org=facultad-de-ciencias");
		expect(link).toHaveAttribute("title", "Facultad de Ciencias");
		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByText("Privado", { selector: "span" })).toBeInTheDocument();
	});

	it("una insignia que encoge pero no tiene filtro (organización sin `name`) se muestra como texto", () => {
		render(OverflowBadges, {
			props: { badges: [{ ...BADGES[0], linkable: false, href: undefined }] },
		});

		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getAllByText("Facultad de Ciencias").length).toBeGreaterThan(0);
	});

	it("la fila nunca envuelve y no oculta nada cuando no hay medida", () => {
		const { container } = render(OverflowBadges, { props: { badges: BADGES } });

		const row = container.querySelector("[data-badges]") as HTMLElement;
		expect(row.dataset.hidden).toBe("0");
		expect(row.querySelector(".flex-nowrap")).not.toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
