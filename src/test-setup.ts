import "@testing-library/jest-dom/vitest";

// jsdom (v30) no expone `localStorage` en este setup. Se provee una
// implementación en memoria determinista para los tests de persistencia
// (stores que hidratan/persisten sesión, tema, etc.).
const memoryStorage = (() => {
	const store = new Map<string, string>();
	return {
		get length() {
			return store.size;
		},
		clear: () => {
			store.clear();
		},
		getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
		key: (index: number) => Array.from(store.keys())[index] ?? null,
		removeItem: (key: string) => {
			store.delete(key);
		},
		setItem: (key: string, value: string) => {
			store.set(key, String(value));
		},
	};
})();

Object.defineProperty(globalThis, "localStorage", {
	value: memoryStorage,
	writable: true,
	configurable: true,
});
