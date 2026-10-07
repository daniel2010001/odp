import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Re-export desde modules específicos para acceso centralizado
export { formatDate, formatRelativeAge, formatSize } from "./utils/ckan";
