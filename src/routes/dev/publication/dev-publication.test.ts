// Tests de la hoja `/dev/publication`: **espeja** la ficha que decide, promovida el 2026-10-14.
//
// ─── Qué protegen ────────────────────────────────────────────────────
// La hoja es material de revisión: duplica las superficies reales con los **componentes reales** y los
// dobles de las llamadas. Lo que se protege acá es lo que la hoja afirma sobre el producto:
//
//  1. **La tarjeta de la ficha decide** cuando quien mira administra la organización y la solicitud es
//     ajena, con el mismo control de la cola.
//  2. **Cuatro ojos**: el editor no decide su propia solicitud, y la hoja lo dice con la nota real.
//  3. **Una solicitud ya resuelta no ofrece decidir**: no hay nada que decidir, y el control no se
//     dibuja para que no parezca que sí.
//  4. **La superadministración de la plataforma recibe el control**: la pregunta al catálogo no
//     discrimina para ella (quirk medido de `organization_list_for_user`), y la hoja lo dice.
//  5. **Rechazar exige motivo**, y con motivo la decisión viaja y el estado se refleja.
//
// La frase del estado no se escribe a mano: se calcula con `estadoDeLaSolicitud`, la función que usa la
// página real. Una hoja que repite la cadena puede mostrar un texto que el portal nunca renderiza, y
// entonces el autor aprobaría algo que no existe.
//
// Las reglas de **decidir** en sí —la confirmación contra el valor almacenado, el `403`, la relectura
// que no concede— viven en `PublicationQueue.test.ts` y en el test de la ficha real
// (`src/routes/dataset/[id]/dataset-page.test.ts`): acá no se re-prueban, se comprueba que la hoja las
// muestre por el mismo componente.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import { page } from "$app/stores";
import { estadoDeLaSolicitud } from "$lib/copy/publication";
import PublicationSheet from "./+page.svelte";
import { MOTIVO_RECHAZO, makeRequest } from "./fixtures";

const COMMENT_LABEL = "Comentario (obligatorio para rechazar)";

// El stub de `$app/stores` (ver vitest.config.ts) expone `page` como store escribible, pero el tipo
// real de SvelteKit es de sólo lectura: se fija con un cast explícito limitado al test.
const pageStore = page as unknown as {
	set: (value: { params: Record<string, string>; url: URL }) => void;
};

/** Abre la hoja con su estado en la URL, que es donde el panel lo guarda. */
function abrir(params: Record<string, string>): void {
	const url = new URL("http://localhost/dev/publication");
	for (const [clave, valor] of Object.entries(params)) url.searchParams.set(clave, valor);
	pageStore.set({ params: {}, url });
	render(PublicationSheet);
}

/** La tarjeta de la ficha del rol pedido, ya acotada: los tres roles no comparten superficie. */
function tarjetaDe(rol: "editor" | "administrador" | "sysadmin") {
	return within(screen.getByTestId(`vista-${rol}`));
}

describe("hoja de publicación — la ficha que decide", () => {
	it("la ficha del administrador muestra el estado y ofrece decidir", () => {
		abrir({ vista: "administrador", caso: "pendiente" });

		const card = tarjetaDe("administrador");

		expect(card.getByTestId("estado-solicitud")).toHaveTextContent(
			estadoDeLaSolicitud(makeRequest()),
		);
		expect(card.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
		expect(card.getByRole("button", { name: "Rechazar" })).toBeInTheDocument();
		expect(card.getByLabelText(COMMENT_LABEL)).toBeInTheDocument();
	});

	it("cuatro ojos: el editor no decide su propia solicitud", () => {
		abrir({ vista: "editor", caso: "pendiente" });

		const card = tarjetaDe("editor");

		expect(card.getByText("No puede aprobar su propia solicitud.")).toBeInTheDocument();
		expect(card.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
		expect(card.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
	});

	it("una solicitud ya resuelta no ofrece decidir", () => {
		const rechazada = makeRequest({ status: "rejected", comments: MOTIVO_RECHAZO });
		abrir({ vista: "administrador", caso: "rechazada" });

		const card = tarjetaDe("administrador");

		expect(card.getByTestId("estado-solicitud")).toHaveTextContent(estadoDeLaSolicitud(rechazada));
		expect(card.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
		expect(card.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
	});

	it("la superadministración de la plataforma recibe el control, y la hoja dice por qué", () => {
		abrir({ vista: "sysadmin", caso: "pendiente" });

		const card = tarjetaDe("sysadmin");

		// Quirk medido: con el permiso `admin`, `organization_list_for_user` devuelve **todas** las
		// organizaciones para un sysadmin, así que la pregunta del portal no discrimina para él.
		expect(card.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
		// La nota parte la frase con un `<em>`: `getByText` no cruza elementos, así que se afirma sobre la
		// tarjeta, cuyo texto completo sí la contiene.
		expect(card.getByTestId("ficha-solicitud")).toHaveTextContent(/todas las organizaciones/i);
	});

	it("rechazar desde la ficha sin motivo no envía la decisión y pide el motivo", async () => {
		abrir({ vista: "administrador", caso: "pendiente" });

		const card = tarjetaDe("administrador");
		await fireEvent.click(card.getByRole("button", { name: "Rechazar" }));

		expect(await card.findByRole("alert")).toHaveTextContent(
			"Para rechazar una solicitud debe escribir un motivo.",
		);
		// Sin llamada no hay registro: el instrumento de la hoja sólo existe si viajó algo.
		expect(screen.queryByTestId("registro-llamadas")).not.toBeInTheDocument();
	});

	it("rechazar con motivo: la decisión viaja con él y el estado de la tarjeta lo refleja", async () => {
		abrir({ vista: "administrador", caso: "pendiente" });

		const card = tarjetaDe("administrador");
		await fireEvent.input(card.getByLabelText(COMMENT_LABEL), {
			target: { value: MOTIVO_RECHAZO },
		});
		await fireEvent.click(card.getByRole("button", { name: "Rechazar" }));

		await waitFor(() => {
			expect(screen.getByTestId("registro-llamadas")).toHaveTextContent(MOTIVO_RECHAZO);
		});
		// La ficha real volvería a leer y mostraría el estado nuevo; la hoja refleja lo mismo. El control
		// desaparece porque ya no hay nada pendiente que decidir.
		expect(card.getByTestId("estado-solicitud")).toHaveTextContent(
			`Rechazada. Motivo: ${MOTIVO_RECHAZO}`,
		);
		expect(card.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
	});
});
