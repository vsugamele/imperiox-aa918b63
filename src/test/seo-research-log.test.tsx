import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
const store = vi.hoisted(() => ({ rows: new Map<string, { id: string; project_id: string; content: string; created_at: string }>(), upsert: vi.fn() }));
vi.mock("@/contexts/auth-context", () => ({ useAuth: () => ({ user: { id: "user-id" } }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({
  select: () => ({ eq: (_field: string, project: string) => ({ like: () => ({ order: () => ({ limit: async () => ({ data: [...store.rows.values()].filter(r => r.project_id === project), error: null }) }) }) }) }),
  upsert: store.upsert,
}) } }));
import { SeoResearchLog } from "@/components/dashboard/SeoResearchLog";
import { radarResearch, SEO_PREFIX, seoNoteId } from "@/lib/seo-research";
it("reimports into the explicit project without overwriting prior editorial decisions or results", async () => {
  const report = { project: "Healthy Legs Daily", generated_at: "2026-10-05T19:47:18.541Z", opportunities: [{ keyword: "heavy legs", source: "google-suggest", score: 28 }] };
  const [research] = radarResearch(report), id = await seoNoteId("linfaflow", research);
  const content = SEO_PREFIX + JSON.stringify({ ...research, decision: "Revisão médica pendente", result: "Nenhum artigo publicado" });
  store.rows.set(id, { id, project_id: "linfaflow", content, created_at: research.collectedAt });
  store.upsert.mockImplementation(async (rows: Array<{ id: string; project_id: string; content: string; created_at: string }>, options: { ignoreDuplicates: boolean }) => {
    for (const row of rows) if (!options.ignoreDuplicates || !store.rows.has(row.id)) store.rows.set(row.id, row);
    return { error: null };
  });
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><SeoResearchLog projectId="linfaflow" /></QueryClientProvider>);
  const file = new File([JSON.stringify(report)], "radar.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => JSON.stringify(report) });
  fireEvent.change(screen.getByLabelText("Carregar relatório JSON do radar"), { target: { files: [file] } });
  const button = await screen.findByText("Associar e importar no projeto linfaflow");
  fireEvent.click(button);
  await waitFor(() => expect(store.upsert).toHaveBeenCalled());
  expect(store.upsert.mock.calls[0][1]).toEqual({ onConflict: "id", ignoreDuplicates: true });
  expect(store.upsert.mock.calls[0][0][0]).toMatchObject({ id, project_id: "linfaflow", created_at: report.generated_at });
  expect(store.rows.size).toBe(1); expect(store.rows.get(id)?.content).toBe(content);
  expect(await screen.findByText("Decisão: Revisão médica pendente")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Registrar decisão / resultado"));
  fireEvent.change(screen.getByLabelText("Decisão SEO"), { target: { value: "Alteração cancelada" } });
  fireEvent.click(screen.getByText("Cancelar"));
  expect(screen.queryByLabelText("Decisão SEO")).not.toBeInTheDocument();
  expect(store.rows.get(id)?.content).toBe(content);
  // Exercise a second actual import through the UI, rather than only comparing identity hashes.
  await waitFor(() => expect(screen.queryByText("Associar e importar no projeto linfaflow")).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Carregar relatório JSON do radar"), { target: { files: [file] } });
  fireEvent.click(await screen.findByText("Associar e importar no projeto linfaflow"));
  await waitFor(() => expect(store.upsert).toHaveBeenCalledTimes(2));
  expect(store.rows.size).toBe(1); expect(store.rows.get(id)?.content).toBe(content);
});
