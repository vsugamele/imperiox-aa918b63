import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionHistoryDrawer } from "@/components/openflow/VersionHistoryDrawer";

const mocks = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const query = { select: () => query, eq: () => query, order: () => query, limit: async () => ({ data: [{ id: "version", automacao_id: "flow", versao_num: 1, snapshot: { nome: "Earlier", trigger_tipo: "novo_lead", acoes: [] }, criado_em: "2026-09-01T12:00:00Z", criado_por: null }], error: null }), update: mocks.update };
  return query;
} } }));
vi.mock("@/components/openflow/FlowLivePreview", () => ({ FlowLivePreview: () => <div>Read-only flow preview</div> }));

describe("version history preview", () => {
  it("does not restore or autosave a version merely by viewing it", async () => {
    const onRestore = vi.fn();
    render(<VersionHistoryDrawer open onOpenChange={vi.fn()} automacaoId="flow" onRestore={onRestore} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Visualizar" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Visualizar" }));
    expect(screen.getByText("Read-only flow preview")).toBeInTheDocument();
    expect(onRestore).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
