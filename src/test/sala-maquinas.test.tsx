import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import SalaMaquinas from "@/pages/SalaMaquinas";

const room = {
  gerado_em: new Date().toISOString(), banco: { total_mb: 3089, historico_cron_mb: 1233 },
  rotinas: [{ jobid: 1, nome: "limpeza", agenda: "0 3 * * *", ultima: new Date().toISOString(), ultimo_status: "failed", execucoes_24h: 1, falhas_24h: 1, ultimo_erro: "function storage.delete(text) does not exist" }],
  acoes: [], webhooks: [], anuncios: [], whatsapp: [], instagram: [],
  voz: { ultimo_envio: null, ultima_falta_saldo: null, enviados_7d: 0 },
  custo_ia_7d: [{ origem: "wa-ai-reply", projeto: "jp", chamadas: 283, custo_usd: 0.1963 }], fontes: [],
};

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(async () => ({ data: room, error: null })) } }));

describe("Sala de máquinas", () => {
  it("lists alerts from the machine room, filterable by severity", async () => {
    render(<QueryClientProvider client={new QueryClient()}><SalaMaquinas /></QueryClientProvider>);
    expect(await screen.findByText(/Rotina "limpeza"/)).toBeInTheDocument();
    expect(screen.getByText(/Histórico das rotinas ocupa 1233 MB/)).toBeInTheDocument();
    expect(screen.getByText(/US\$ 0.20 em 283/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Erro \(1\)/ }));
    expect(screen.getByText(/Rotina "limpeza"/)).toBeInTheDocument();
    expect(screen.queryByText(/US\$ 0.20/)).not.toBeInTheDocument();
  });
});
