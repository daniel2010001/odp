// Stub de `$app/navigation` para Vitest.
//
// SvelteKit resuelve `$app/navigation` como módulo virtual que no existe en el
// entorno de Vitest (vitest.config.ts solo aliases `$lib`). Este stub expone
// `vi.fn()` por cada export para que los tests puedan importar y asertar sobre
// `goto` directamente sin `vi.mock("$app/navigation", ...)`.
import { vi } from "vitest";

export const goto = vi.fn(async (_url: string | URL, _opts?: Record<string, unknown>) => {});
export const invalidate = vi.fn(async () => {});
export const invalidateAll = vi.fn(async () => {});
export const beforeNavigate = vi.fn();
export const afterNavigate = vi.fn();
export const onNavigate = vi.fn();
export const preloadCode = vi.fn(async () => {});
export const preloadData = vi.fn(async () => {});
export const pushState = vi.fn();
export const replaceState = vi.fn();
