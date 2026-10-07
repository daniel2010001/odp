// Pruebas de `PublishControl`: el **camino directo de publicación**, reservado a la
// superadministración de la plataforma. Lo que se prueba acá es la compuerta y la honestidad del
// portal: un administrador de organización **no** recibe el control directo (su camino es aprobar
// solicitudes), y sólo cuenta como publicación lo que el catálogo confirmó.
//
// La llamada que publica es **inyectada** (`publish`): la acción no existe todavía del lado del
// catálogo, así que el componente no la cablea por defecto. La capacidad también es inyectable
// (`canPublish`) para que la hoja de revisión y la página real la conduzcan; sin ella, el default es
// el flag `sysadmin` que el portal ya mantiene (`isSuperAdmin`), sin ninguna llamada nueva.

import { fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "$lib/stores/auth";
import { CkanApiError } from "$lib/types/api";
import type { CkanPackage, CkanUser } from "$lib/types/ckan";
import PublishControl from "./PublishControl.svelte";

// La frase que ve un administrador de organización: nombra quién aprueba y no le promete el camino
// directo, que no existe para él.
const NOT_OFFERED = "Solo un administrador de la organización puede aprobar esta publicación.";
// La negativa honesta de un `403` sobre el camino directo: nombra la capacidad que falta.
const REFUSAL = "Solo la superadministración de la plataforma puede publicar este dataset.";
// Mensaje crudo del catálogo, distinto de la frase amable: si el `403` cayera en la rama genérica,
// la alerta mostraría este texto y las aserciones de abajo fallarían.
const SERVER_403_PUBLISH =
	"Authorization Error: la acción 'publication_publish' requiere el flag sysadmin.";
const UNCONFIRMED = "El catálogo no confirmó la publicación.";
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

// La respuesta de `publication_publish`: la fila que el catálogo ya devolvía, más el dataset
// resultante bajo `dataset`. La publicación se lee de `dataset`, no del nivel superior.
type PublishResult = CkanPackage & { dataset: CkanPackage };

type ControlProps = {
	dataset: CkanPackage;
	publish: (id: string) => Promise<PublishResult>;
	canPublish?: boolean;
	onpublished?: (dataset: CkanPackage) => void;
};

/** Renderiza un dataset privado con la capacidad de publicar ya concedida. */
function renderPrivate(overrides: Partial<ControlProps> = {}) {
	const publish = vi.fn<(id: string) => Promise<PublishResult>>();
	const onpublished = vi.fn();

	const resultado = render(PublishControl, {
		props: {
			dataset: makeDataset(),
			publish,
			canPublish: true,
			onpublished,
			...overrides,
		} satisfies ControlProps,
	});

	return { publish, onpublished, ...resultado };
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
				canPublish: false,
			} satisfies ControlProps,
		});

		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
		expect(screen.getByText(NOT_OFFERED)).toBeInTheDocument();
	});

	it("sin capacidad inyectada, la compuerta por defecto es el flag `sysadmin`", async () => {
		auth.login("tok", makeUser({ sysadmin: true }));

		render(PublishControl, {
			props: { dataset: makeDataset(), publish: vi.fn() } satisfies ControlProps,
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
			props: { dataset: makeDataset(), publish: vi.fn() } satisfies ControlProps,
		});

		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
		expect(screen.getByText(NOT_OFFERED)).toBeInTheDocument();
	});
});

describe("PublishControl — qué reporta después del click", () => {
	it("llama a publish con el id del dataset y muestra el resultado como éxito sólo si el catálogo confirmó", async () => {
		// La confirmación vive bajo `dataset`: es ese objeto —no el nivel superior— el que reemplaza al
		// dataset y el que se reporta.
		const respuesta: PublishResult = { ...makeDataset(), dataset: makeDataset({ private: false }) };
		const { publish, onpublished } = renderPrivate();
		publish.mockResolvedValue(respuesta);

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(onpublished).toHaveBeenCalledWith(respuesta.dataset));
		expect(publish).toHaveBeenCalledWith("pkg-1");
		// El dataset renderizado es la respuesta del catálogo: el control desaparece porque ya es
		// público.
		expect(screen.queryByRole("button", { name: PUBLISH_LABEL })).toBeNull();
	});

	it("403: alerta de rechazo, control disponible otra vez y el dataset sigue privado", async () => {
		const { publish, onpublished } = renderPrivate();
		publish.mockRejectedValue(new CkanApiError(SERVER_403_PUBLISH, 403, "Authorization Error"));

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		// Anclado: la alerta debe ser exactamente la frase honesta, no un mensaje genérico que la
		// contenga por casualidad. Y el mensaje crudo del servidor no debe aparecer.
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(new RegExp(`^${REFUSAL}$`)),
		);
		expect(screen.getByRole("alert")).not.toHaveTextContent(SERVER_403_PUBLISH);
		const boton = screen.getByRole("button", { name: PUBLISH_LABEL });
		expect(boton).toBeEnabled();
		expect(onpublished).not.toHaveBeenCalled();
	});

	it("no confirma por el nivel superior: el dataset devuelto sigue privado aunque arriba diga público", async () => {
		const { publish, onpublished } = renderPrivate();
		// El nivel superior de la respuesta dice `private: false`, pero el dataset que el catálogo
		// devuelve bajo `dataset` sigue privado: la publicación no se concedió. Si la regla volviera al
		// objeto superior, este caso pasaría por éxito, `onpublished` se llamaría y el control
		// desaparecería.
		publish.mockResolvedValue({
			...makeDataset({ private: false }),
			dataset: makeDataset({ private: true }),
		});

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(UNCONFIRMED));
		expect(onpublished).not.toHaveBeenCalled();
		// La lectura del dataset no cambió: sigue siendo privado y el control sigue ofrecido.
		expect(screen.getByRole("button", { name: PUBLISH_LABEL })).toBeInTheDocument();
	});

	it("otro fallo: error explícito con reintento que vuelve a intentar", async () => {
		const respuesta: PublishResult = { ...makeDataset(), dataset: makeDataset({ private: false }) };
		const { publish, onpublished } = renderPrivate();
		publish.mockRejectedValueOnce(new Error("502 Bad Gateway")).mockResolvedValueOnce(respuesta);

		await fireEvent.click(screen.getByRole("button", { name: PUBLISH_LABEL }));

		await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("502 Bad Gateway"));
		expect(publish).toHaveBeenCalledTimes(1);

		await fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

		await waitFor(() => expect(onpublished).toHaveBeenCalledWith(respuesta.dataset));
		expect(publish).toHaveBeenCalledTimes(2);
		expect(publish).toHaveBeenLastCalledWith("pkg-1");
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
