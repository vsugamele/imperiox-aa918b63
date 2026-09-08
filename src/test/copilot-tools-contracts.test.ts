import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

type RunTool = (name: string, args: unknown, ctx: unknown) => Promise<unknown>;
function loadTools(): RunTool {
  const source = readFileSync(resolve(process.cwd(), "supabase/functions/copilot-imperius/tools.ts"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replace(/export /g, "");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } });
  return new Function("z", "safeError", `${compiled.outputText};return runTool;`)(z, (value: unknown) => value instanceof Error ? value.message : String(value)) as RunTool;
}
const runTool = loadTools();
describe("Imperius tool contracts", () => {
  it.each([
    ["criarTarefas", { projeto_id: "p", tarefas: [{ titulo: 3 }] }],
    ["enviarWhatsapp", { lead_id: "l", mensagem: { text: "wrong" } }],
    ["enviarWhatsappEmMassa", { lead_ids: "l", mensagem: "text" }],
    ["ajustarOrcamentoAdset", { projeto_id: "p", adset_id: "a", novo_orcamento: "100" }],
  ])("rejects malformed %s before touching the database", async (name, args) => {
    const from = vi.fn();
    const result = await runTool(name, args, { supabase: { from }, userId: "u", projectId: "p" });
    expect(result).toHaveProperty("error");
    expect(from).not.toHaveBeenCalled();
  });
  it("preserves the existing project listing projection", async () => {
    const limit = vi.fn(async () => ({ data: [{ id: "p", name: "Projeto", active: true }], error: null }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const result = await runTool("listarProjetos", {}, { supabase: { from }, userId: "u", projectId: null });
    expect(result).toEqual({ projetos: [{ id: "p", nome: "Projeto", ativo: true }] });
    expect(from).toHaveBeenCalledWith("imphq_projects");
  });
  it("returns a tool error for unknown names without database work", async () => {
    const from = vi.fn();
    expect(await runTool("inventada", {}, { supabase: { from } })).toEqual({ error: "tool desconhecida: inventada" });
    expect(from).not.toHaveBeenCalled();
  });
});
