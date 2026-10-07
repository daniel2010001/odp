// Pruebas de `PublishControl`: el **camino directo de publicación**, reservado a la
// superadministración de la plataforma. Lo que se prueba acá es la compuerta y la honestidad del
// portal: un administrador de organización **no** recibe el control directo (su camino es aprobar
// solicitudes), y sólo cuenta como publicación lo que el catálogo confirmó.
//
// El contrato de retorno es **uniforme**: la acción `publish` devuelve sólo su fila
// `publication_requests`, sin `dataset`. La confirmación de la publicación entra por una segunda
// llamada inyectada (`readDataset`), que relee el **valor almacenado**; el portal no la toma de la
// respuesta de quien escribió. Las tres situaciones se mantienen separadas: *la acción falló*,
// *la acción concedió y la confirmación no se pudo establecer* —porque la relectura sigue privada o
// porque la relectura misma falló— y *confirmada*.
//
// La capacidad también es inyectable (`canPublish`) para que la hoja de revisión y la página real
// la conduzcan; sin ella, el default es el flag `sysadmin` que el portal ya mantiene
// (`isSuperAdmin`), sin ninguna llamada nueva.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanUser } from "$lib/types/ckan";
import PublishControl from "./PublishControl.svelte";
import type { PublicationRequest } from "./RequestPublicationControl.svelte";

// La frase que ve un administrador de organización: nombra quién aprueba y no le promete el camino
// directo, que no existe para él.
const NOT_OFFERED = "Solo un administrador de la organización puede aprobar esta publicación.";
// La negativa honesta de un `403` sobre el camino directo: nombra la capacidad que falta.
const REFUSAL = "Solo la superadministración de la plataforma puede publicar este dataset.";
// Mensaje crudo del catálogo, distinto de la frase amable: si el `403` cayera en la rama genérica,
// la alerta mostraría este texto y las aserciones de abajo fallarían.
const SERVER_403_PUBLISH =
	"Authorization Error: la acción 'publication_publish' requiere el flag sysadmin.";
// La confirmación que no se pudo establecer: cubre la relectura que sigue privada y la que falla.
const UNCONFIRMED = "El catálogo no confirmó la publicación.";
// El estado confirmado, distinto de los dos vecinos.
const CONFIRMED = "El catálogo confirmó la publicación.";
const ERROR_PREFIX = "No se pudo publicar el dataset";
const CONSEQUENCE = "Será visible en el catálogo público.";
const PUBLISH_LABEL = "Publicar dataset";

function makeDataset(overrides: Partial<CkanPackage> = {}): CkanPackage {
	return {
		id: "pkg-1",
		name: "matricula-2026",
		title: "Matrícula 2026",
		private: true,
		state: "active",
		resources: [],
		tags: [],
		groups: [],
		extras: [],
		metadata_created: "2026-01-01T00:00:00.000000",
		metadata_modified: "2026-01-01T00:00:00.000000",
		...overrides,
	};
}

function makeUser(overrides: Partial<CkanUser> = {}): CkanUser {
	return {
		id: "user-1",
		name: "admin.tecnologia",
		display_name: "Administración de Tecnología",
		created: "2026-01-01T00:00:00.000000",
		state: "active",
		...overrides,
	};
}

// La respuesta de `publication_publish`: **sólo** su fila `publication_requests`. No hay `dataset` en
// la forma; la confirmación sale de `readDataset`, que relee el valor almacenado.
function makeRow(overrides: Partial<PublicationRequest> = {}): PublicationRequest {
	return {
		id: "pub-1",
		dataset_id: "pkg-1",
		status: "approved",
		...overrides,
	};
}

type ControlProps = {
	dataset: CkanPackage;
	publish: (id: string) => Promise<PublicationRequest>;
	readDataset: (id: string) => Promise<CkanPackage>;
	canPublish?: boolean;
	onpublished?: (dataset: CkanPackage) => void;
	/** Presentación: `"accion"` lo dibuja como una acción del hero; `"bloque"` (hoy) con el texto debajo. */
	apariencia?: "bloque" | "accion";
};

/** Renderiza un dataset privado con la capacidad de publicar ya concedida. */
function renderPrivate(overrides: Partial<ControlProps> = {}) {
	const publish = vi.fn<(id: string) => Promise<PublicationRequest>>();
	const readDataset = vi.fn<(id: string) => Promise<CkanPackage>>();
	const onpublished = vi.fn();

	const resultado = render(PublishControl, {
		props: {
			dataset: makeDataset(),
			publish,
			readDataset,
			canPublish: true,
			onpublished,
			...overrides,
		} satisfies ControlProps,
	});

	return { publish, readDataset, onpublished, ...resultado };
}

beforeEach(() => {
	vi.clearAllMocks();
	auth.reset();
});

describe("PublishControl — qué se ofrece", () => {
	it("un dataset ya público no renderiza nada: ni publicar ni volver a privado", () => {
		const { container } = render(PublishControl, {
			props: {
				dataset: makeDataset({ private: false }),
				publish: vi.fn(),
				readDataset: vi.fn(),
				canPublish: true,
			} satisfies ControlProps,
		});

		expect(container.textContent?.trim()).toBe("");
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.queryByText(/despublicar|privado|público/i)).toBeNull();
	});

	it("privado + capacidad inyectada: ofrece el control y enuncia la consecuencia", () => {
		renderPrivate();

		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument();
		expect(screen.getByText(CONSEQUENCE)).toBeInTheDocument();
	});

	it("privado + sin capacidad: no ofrece el control directo y dice quién aprueba", () => {
		render(PublishControl, {
			props: {
				dataset: makeDataset(),
				publish: vi.fn(),
				readDataset: vi.fn(),
				canPublish: false,
			} satisfies ControlProps,
		});

		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
		expect(screen.getByText(NOT_OFFERED)).toBeInTheDocument();
	});

	it("sin capacidad inyectada, la compuerta por defecto es el flag `sysadmin`", async () => {
		auth.login("tok", makeUser({ sysadmin: true }));

		render(PublishControl, {
			props: {
				dataset: makeDataset(),
				publish: vi.fn(),
				readDataset: vi.fn(),
			} satisfies ControlProps,
		});

		await waitFor(() =>
			expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument(),
		);
	});

	it("sin capacidad inyectada, un administrador de organización sin el flag no publica en directo", () => {
		// La distinción que la regla necesita: `capacity: "admin"` no es `sysadmin`. Si la compuerta
		// volviera a mirar la capacidad de organización, este caso ofrecería el control y fallaría.
		auth.login("tok", makeUser({ capacity: "admin", sysadmin: false }));

		render(PublishControl, {
			props: {
				dataset: makeDataset(),
				publish: vi.fn(),
				readDataset: vi.fn(),
			} satisfies ControlProps,
		});

		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
		expect(screen.getByText(NOT_OFFERED)).toBeInTheDocument();
	});
});

describe("PublishControl — qué reporta después del click", () => {
	it("la fila de la acción no trae dataset y la relectura pública confirma la publicación", async () => {
		// La acción devuelve SÓLO su fila: la confirmación no puede salir de ahí. La relectura del
		// valor almacenado trae el dataset ya público y es la única fuente del estado.
		const { publish, readDataset, onpublished } = renderPrivate();
		const fila = makeRow();
		publish.mockResolvedValue(fila);
		const almacenado = makeDataset({ private: false });
		readDataset.mockResolvedValue(almacenado);

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(onpublished).toHaveBeenCalledWith(almacenado));
		expect(publish).toHaveBeenCalledWith("pkg-1");
		// La relectura es la fuente: pidió el mismo dataset que la acción publicó.
		expect(readDataset).toHaveBeenCalledWith("pkg-1");
		// Mutación que lo rompe: leer `private` de la fila de la acción (donde la forma ya no lleva
		// `dataset`) dejaría el control ofrecido, sin `onpublished` y sin el estado confirmado.
		expect((fila as PublicationRequest & { dataset?: unknown }).dataset).toBeUndefined();
		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
		expect(screen.getByText(CONFIRMED)).toBeInTheDocument();
	});

	it("la relectura sigue privada: no confirma y el dataset de la UI no cambia", async () => {
		const { publish, readDataset, onpublished } = renderPrivate();
		publish.mockResolvedValue(makeRow());
		// El valor almacenado sigue privado: la acción resolvió, pero no concedió lo que dice.
		readDataset.mockResolvedValue(makeDataset({ private: true }));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNCONFIRMED));
		// La confirmación sí se intentó: la relectura del valor almacenado se pidió.
		expect(readDataset).toHaveBeenCalledWith("pkg-1");
		expect(onpublished).not.toHaveBeenCalled();
		// El dataset renderizado sigue privado y el control sigue ofrecido.
		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument();
		expect(screen.queryByText(CONFIRMED)).toBeNull();
		// No se confundió con un fallo de la acción.
		expect(screen.getByRole("alert")).not.toHaveTextContent(ERROR_PREFIX);
	});

	it("la relectura falla: estado intermedio, distinguible de un fallo de la acción", async () => {
		const { publish, readDataset, onpublished } = renderPrivate();
		publish.mockResolvedValue(makeRow());
		readDataset.mockRejectedValue(new Error("502 Bad Gateway"));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		// La acción resolvió: se ejecutó una vez y no es su fallo.
		expect(publish).toHaveBeenCalledTimes(1);
		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNCONFIRMED));
		// La relectura se intentó y falló: la confirmación no se pudo establecer.
		expect(readDataset).toHaveBeenCalledWith("pkg-1");
		// Distinguible del vecino de abajo: no es el error genérico del intento de publicación.
		expect(screen.getByRole("alert")).not.toHaveTextContent(ERROR_PREFIX);
		expect(screen.getByRole("alert")).not.toHaveTextContent(REFUSAL);
		expect(onpublished).not.toHaveBeenCalled();
		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument();
	});

	it("403: alerta de rechazo, control disponible otra vez y el dataset sigue privado", async () => {
		const { publish, readDataset, onpublished } = renderPrivate();
		publish.mockRejectedValue(new CkanApiError(SERVER_403_PUBLISH, 403, "Authorization Error"));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		// Anclado: la alerta debe ser exactamente la frase honesta, no un mensaje genérico que la
		// contenga por casualidad. Y el mensaje crudo del servidor no debe aparecer.
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(new RegExp(`^${REFUSAL}$`)),
		);
		expect(screen.getByRole("alert")).not.toHaveTextContent(SERVER_403_PUBLISH);
		// La acción no concedió nada: no hay nada que releer.
		expect(readDataset).not.toHaveBeenCalled();
		const boton = screen.getByRole("button", { name: PUBLISH_LABEL });
		expect(boton).toBeEnabled();
		expect(onpublished).not.toHaveBeenCalled();
	});

	it("otro fallo de la acción: error explícito con reintento que vuelve a intentar", async () => {
		const { publish, readDataset, onpublished } = renderPrivate();
		const almacenado = makeDataset({ private: false });
		publish.mockRejectedValueOnce(new Error("502 Bad Gateway")).mockResolvedValueOnce(makeRow());
		readDataset.mockResolvedValue(almacenado);

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("502 Bad Gateway"));
		expect(publish).toHaveBeenCalledTimes(1);
		expect(readDataset).not.toHaveBeenCalled();

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(onpublished).toHaveBeenCalledWith(almacenado));
		expect(publish).toHaveBeenCalledTimes(2);
		expect(publish).toHaveBeenLastCalledWith("pkg-1");
		expect(readDataset).toHaveBeenCalledTimes(1);
	});

	it("en vuelo: el control reporta ocupado y no anuncia éxito", async () => {
		const { publish, onpublished } = renderPrivate();
		publish.mockReturnValue(new Promise(() => {}));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		const boton = screen.getByRole("button", { name: /publicando/i });
		expect(boton).toBeDisabled();
		expect(screen.queryByRole("alert")).toBeNull();
		expect(onpublished).not.toHaveBeenCalled();
	});
});

// La presentación de **acción**: el control en la fila del hero de la ficha. Ahí tiene que verse como
// sus hermanos —«Copiar enlace» y «Editar»— y la explicación que en la presentación de bloque va debajo
// del botón pasa al `title`, que es el mecanismo que el hermano «Copiar enlace» ya usa.
describe("PublishControl — la presentación de acción", () => {
	it("en `accion` dibuja sólo el botón, con la forma de las acciones del hero y la explicación en el tooltip", async () => {
		renderPrivate({ apariencia: "accion" });

		const boton = await screen.findByRole("button", { name: PUBLISH_LABEL });

		// La forma de sus hermanos del hero, no la del botón de bloque.
		expect(boton.className).toContain("h-9");
		expect(boton.className).toContain("border-input");
		expect(boton.className).toContain("bg-background");

		// La explicación no ocupa lugar en el flujo: no hay ningún párrafo con ella...
		expect(screen.queryByText(CONSEQUENCE, { selector: "p" })).toBeNull();
		// ...pero no se pierde. Es el tooltip, y además queda asociada al botón: el `title` solo alcanza
		// al puntero, no al teclado.
		expect(boton).toHaveAttribute("title", CONSEQUENCE);
		const descrito = boton.getAttribute("aria-describedby");
		expect(descrito).toBeTruthy();
		const copia = document.getElementById(descrito ?? "");
		expect(copia).toHaveTextContent(CONSEQUENCE);
		expect(copia).toHaveClass("sr-only");
	});

	it("en `bloque` la explicación sigue debajo del botón, y sin tooltip", async () => {
		renderPrivate();

		expect(await screen.findByText(CONSEQUENCE)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).not.toHaveAttribute("title");
	});
});
