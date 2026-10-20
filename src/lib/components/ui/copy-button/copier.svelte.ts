// El estado de «Copiado» de un botón de copiar: escribe en el portapapeles y mantiene `copied` encendido
// 2 s. Vive acá una sola vez; las páginas lo repetían por botón (`xCopied` + su `setTimeout`).
import { copyToClipboard } from "$lib/utils/citation";

const FEEDBACK_MS = 2000;

export class Copier {
	copied = $state(false);
	#timer: ReturnType<typeof setTimeout> | undefined;

	async copy(text: string): Promise<void> {
		if (!(await copyToClipboard(text))) return;
		this.copied = true;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => {
			this.copied = false;
		}, FEEDBACK_MS);
	}

	/** Cancela el temporizador pendiente; llamarlo al desmontar. */
	dispose(): void {
		clearTimeout(this.#timer);
	}
}
