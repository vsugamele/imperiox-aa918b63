import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Custo por automação (OP1.4): as edge functions chamam `installAiUsageTracking("nome")` no topo. Os testes que
// carregam o código de uma function tiram os imports; sem este nome global a carga falharia. Aqui ele não faz nada
// (os testes do registrador em si usam o módulo real, src/test/ai-usage.test.ts).
(globalThis as unknown as { installAiUsageTracking?: (name: string) => void }).installAiUsageTracking ??= () => {};
