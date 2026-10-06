import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackerEvidence } from "@/components/tracker/TrackerEvidence";
import { NodeRevenueBadge, RevenueOverlayBar } from "@/components/funis/RevenueOverlay";
import { getProductRevenue, useFunnelRevenue } from "@/hooks/useFunnelRevenue";
import { paginatedQuery } from "@/lib/paginated-query";
import Tracker from "@/pages/Tracker";

type Reply = { data: unknown; error: { message: string } | null };
type PageReply = { data: Record<string, unknown>[] | null; error: { message: string } | null };
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), range: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc,
  from: (table: string) => {
    const filters: Record<string, string> = {};
    const query = {
      select: () => query, order: () => query,
      gte: (column: string, value: string) => { filters[`gte:${column}`] = value; return query; },
      lte: (column: string, value: string) => { filters[`lte:${column}`] = value; return query; },
      lt: (column: string, value: string) => { filters[`lt:${column}`] = value; return query; },
      range: (from: number, to: number) => mocks.range(table, from, to, filters),
    };
    return query;
  },
} }));
// Legacy chart rendering is independent of these RPC/load regression checks.
vi.mock("recharts", () => ({
  AreaChart: () => null, Area: () => null, XAxis: () => null, YAxis: () => null,
  Tooltip: () => null, ResponsiveContainer: () => null, CartesianGrid: () => null, Legend: () => null,
}));

const since = "2026-10-01T03:00:00.000Z";
const until = "2026-10-07T03:00:00.000Z";
const props = { projectId: "project-1", since, until };
function report() {
  return {
    measured_at: "2026-10-06T12:00:00Z", since, until,
    quality: { events: 40, sessions: 20, missing_event_ids: 2, missing_click_ids: 3,
      missing_creative_ids: 4, unattributed_sales: 1, latest_event_at: "2026-10-06T11:00:00Z",
      webhook_failures: 5, unprocessed_hw: 6 },
    financial: [
      { project_id: "project-1", currency: "BRL", ad_id: "ad-brl", gross: 120, net: 0,
        unknown_net: 0, approved_sales: 2, refunds: 1, refunded_net: 20, spend: 0,
        profit_after_media: 0, attributed_sales: 2 },
      { project_id: "project-1", currency: "USD", ad_id: "ad-usd", gross: 70, net: null,
        unknown_net: 1, approved_sales: 1, refunds: 0, refunded_net: 0, spend: null,
        profit_after_media: null, attributed_sales: 1 },
    ],
    vsl: [{ project_id: "project-1", player_id: "player-1", views: 20, plays: 17,
      pitch: 8, reached_25: 15, reached_50: 12, reached_75: 9, reached_90: 6 }],
  };
}
function revenue() {
  return { currency: "BRL", total: 0, vendas: 1, unknown_net: 0,
    porProduto: { "produto a": { produto: "Produto A", receita: 0, vendas: 1, ticket: 0, currency: "BRL" } } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  mocks.rpc.mockReset().mockResolvedValue({ data: report(), error: null });
  mocks.range.mockReset().mockResolvedValue({ data: [], error: null });
  localStorage.clear();
});
afterEach(cleanup);

describe("TRK1.1 tracker evidence", () => {
  it("requests the project/window and shows separate currencies, real zeros, nulls, quality and VSL milestones", async () => {
    render(<TrackerEvidence {...props} projects={[{ id: "project-1", name: "Projeto piloto" }]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando evidências");
    expect(mocks.rpc).toHaveBeenCalledWith("imphq_tracker_report", {
      p_project_id: "project-1", p_since: since, p_until: until,
    });
    const brl = await screen.findByRole("row", { name: /ad-brl/ });
    expect(brl).toHaveTextContent("Projeto piloto");
    expect(brl).toHaveTextContent("BRL 120,00");
    expect(within(brl).getAllByText("BRL 0,00")).toHaveLength(3);
    const usd = screen.getByRole("row", { name: /ad-usd/ });
    expect(usd).toHaveTextContent("USD 70,00");
    expect(within(usd).getAllByText("Indisponível")).toHaveLength(3);
    expect(screen.queryByText(/190,00|ROAS|confiança/i)).not.toBeInTheDocument();
    const quality = screen.getByRole("region", { name: "Qualidade dos dados" });
    expect(quality).toHaveTextContent("Eventos40");
    expect(quality).toHaveTextContent("Eventos sem ID de clique3");
    expect(quality).toHaveTextContent("Vendas sem atribuição1");
    expect(quality).toHaveTextContent("Falhas de webhook5");
    expect(quality).toHaveTextContent("Webhooks H&W não processados6");
    expect(screen.getByRole("columnheader", { name: "Alcançaram o pitch" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Alcançaram 90%" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sessões instrumentadas" })).toBeInTheDocument();
    const vsl = within(screen.getByRole("row", { name: /player-1/ })).getAllByRole("cell");
    expect(vsl.map(cell => cell.textContent).slice(2)).toEqual(["20", "Não medido", "17", "8", "15", "12", "9", "6"]);
  });

  it("maps all to null and distinguishes a successful empty report from an error", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...report(), financial: [], vsl: [],
      quality: { ...report().quality, events: 0, sessions: 0, latest_event_at: null } }, error: null });
    render(<TrackerEvidence {...props} projectId="all" />);
    expect(await screen.findByText("Sem registros financeiros no período.")).toBeInTheDocument();
    expect(screen.getByText("Sem registros VSL no período.")).toBeInTheDocument();
    expect(screen.getByText("Último evento: Sem registro")).toBeInTheDocument();
    expect(mocks.rpc).toHaveBeenCalledWith("imphq_tracker_report", {
      p_project_id: null, p_since: since, p_until: until,
    });
  });

  it("preserves UNKNOWN currency and nullable refunds, and separates unmeasured VSL milestones from measured zero", async () => {
    const data = report();
    mocks.rpc.mockResolvedValue({ data: { ...data,
      financial: [{ ...data.financial[0], currency: "UNKNOWN", ad_id: "unattributed", refunded_net: null, profit_after_media: null }],
      vsl: [{ ...data.vsl[0], plays: null, pitch: null, reached_25: null, reached_50: null, reached_75: null, reached_90: 0 }],
    }, error: null });
    render(<TrackerEvidence {...props} />);
    const financial = await screen.findByRole("row", { name: /Sem criativo atribuído/ });
    expect(financial).toHaveTextContent("Moeda desconhecida");
    expect(financial).toHaveTextContent("120,00 (moeda desconhecida)");
    expect(within(financial).getAllByText("Indisponível")).toHaveLength(2);
    const cells = within(screen.getByRole("row", { name: /player-1/ })).getAllByRole("cell");
    expect(cells.map(cell => cell.textContent).slice(2)).toEqual(["20", "Não medido", "Não medido", "Não medido", "Não medido", "Não medido", "Não medido", "0"]);
  });

  it.each([0, 12])("shows instrumented coverage %i separately from historical views and explains the milestone base", async instrumentedSessions => {
    const data = report();
    mocks.rpc.mockResolvedValue({ data: { ...data,
      vsl: [{ ...data.vsl[0], instrumented_sessions: instrumentedSessions,
        plays: instrumentedSessions, pitch: null, reached_25: null,
        reached_50: null, reached_75: null, reached_90: null }],
    }, error: null });
    render(<TrackerEvidence {...props} />);
    const cells = within(await screen.findByRole("row", { name: /player-1/ })).getAllByRole("cell");
    expect(cells.map(cell => cell.textContent).slice(2, 6)).toEqual(["20", String(instrumentedSessions), String(instrumentedSessions), "Não medido"]);
    const section = screen.getByRole("region", { name: "Sessões VSL por player" });
    expect(section).toHaveTextContent("Visualizaram inclui sessões antigas e novas");
    expect(section).toHaveTextContent("podem cobrir apenas parte do histórico do player");
    expect(section).toHaveTextContent("use a cobertura de sessões instrumentadas como base, em vez de todas as visualizações");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nullable gross for UNKNOWN currency as unavailable without a zero fallback", async () => {
    const data = report();
    mocks.rpc.mockResolvedValue({ data: { ...data,
      financial: [{ ...data.financial[0], currency: "UNKNOWN", gross: null, net: null,
        refunded_net: null, spend: null, profit_after_media: null }],
    }, error: null });
    render(<TrackerEvidence {...props} />);
    const row = await screen.findByRole("row", { name: /ad-brl/ });
    expect(within(row).getAllByText("Indisponível")).toHaveLength(5);
    expect(row).toHaveTextContent("Moeda desconhecida");
    expect(row).not.toHaveTextContent("0,00");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports RPC failure without financial zeros and can retry", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "RPC indisponível" } });
    render(<TrackerEvidence {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("RPC indisponível");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem registros financeiros no período.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("ad-brl")).toBeInTheDocument();
  });

  it.each([null, { quality: {} }])("rejects missing/malformed RPC data: %j", async data => {
    mocks.rpc.mockResolvedValue({ data, error: null });
    render(<TrackerEvidence {...props} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Resposta do relatório inválida");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("ignores older responses after project/window changes, including old errors", async () => {
    const old = deferred<Reply>();
    mocks.rpc.mockReturnValueOnce(old.promise);
    const { rerender } = render(<TrackerEvidence {...props} />);
    rerender(<TrackerEvidence {...props} projectId="project-2" since="2026-10-02T03:00:00Z" />);
    expect(await screen.findByText("ad-brl")).toBeInTheDocument();
    await act(async () => old.resolve({ data: null, error: { message: "old error" } }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("ad-brl")).toBeInTheDocument();
  });

  it("does not replace newer financial data with an older successful response", async () => {
    const old = deferred<Reply>();
    mocks.rpc.mockReturnValueOnce(old.promise);
    const { rerender } = render(<TrackerEvidence {...props} />);
    rerender(<TrackerEvidence {...props} projectId="project-2" />);
    await screen.findByText("ad-brl");
    await act(async () => old.resolve({ data: { ...report(), financial: [] }, error: null }));
    expect(screen.getByText("ad-brl")).toBeInTheDocument();
    expect(screen.queryByText("Sem registros financeiros no período.")).not.toBeInTheDocument();
  });

  it("hides the old report while a new period loads", async () => {
    const next = deferred<Reply>();
    const { rerender } = render(<TrackerEvidence {...props} />);
    await screen.findByText("ad-brl");
    mocks.rpc.mockReturnValueOnce(next.promise);
    rerender(<TrackerEvidence {...props} until="2026-10-08T03:00:00Z" />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    await act(async () => next.resolve({ data: report(), error: null }));
    expect(screen.getByText("ad-brl")).toBeInTheDocument();
  });
});

describe("TRK1.1 funnel product revenue", () => {
  it("uses the aggregation RPC and preserves legitimate zero commission", async () => {
    mocks.rpc.mockResolvedValue({ data: revenue(), error: null });
    const { result } = renderHook(() => useFunnelRevenue("project-1", 7));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.rpc).toHaveBeenCalledWith("imphq_product_revenue", {
      p_project_id: "project-1", p_since: expect.any(String),
    });
    const args = mocks.rpc.mock.calls[0][1];
    expect(Date.now() - Date.parse(args.p_since)).toBeCloseTo(7 * 86400000, -4);
    expect(result.current).toMatchObject({ total: 0, ticket: 0, currency: "BRL", vendas: 1, error: null });
    expect(getProductRevenue(result.current, " PRODUTO A ")).toMatchObject({ receita: 0, ticket: 0 });
    expect(mocks.range).not.toHaveBeenCalled();
  });

  it("renders mixed totals/products as unavailable while retaining compatible product currency", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...revenue(), currency: null, total: null, vendas: 3, unknown_net: 1,
      porProduto: {
        "produto a": { produto: "Produto A", receita: null, vendas: 2, ticket: null, currency: null },
        "produto b": { produto: "Produto B", receita: 12, vendas: 1, ticket: 12, currency: "USD" },
      } }, error: null });
    const { result } = renderHook(() => useFunnelRevenue("project-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ total: null, ticket: null, currency: null, unknown_net: 1 });
    render(<>
      <RevenueOverlayBar revenue={result.current} days={30} onDaysChange={vi.fn()} liveCount={0} onClose={vi.fn()} />
      <NodeRevenueBadge data={getProductRevenue(result.current, "Produto A")} />
      <NodeRevenueBadge data={getProductRevenue(result.current, "Produto B")} />
    </>);
    expect(screen.getAllByText(/Indisponível/)).toHaveLength(3);
    expect(screen.getByText(/USD 12/)).toBeInTheDocument();
    expect(screen.queryByText(/R\$/)).not.toBeInTheDocument();
  });

  it("keeps unknown net nullable even for a single currency", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...revenue(), total: null, unknown_net: 1,
      porProduto: { "produto a": { ...revenue().porProduto["produto a"], receita: null, ticket: null } } }, error: null });
    const { result } = renderHook(() => useFunnelRevenue("project-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ total: null, ticket: null, currency: "BRL", unknown_net: 1 });
  });

  it.each(["RPC error", "invalid response", "network error"])("exposes %s without showing a zero revenue/sale count", async kind => {
    if (kind === "network error") mocks.rpc.mockRejectedValue(new Error("Offline"));
    else mocks.rpc.mockResolvedValue(kind === "RPC error"
      ? { data: null, error: { message: "Falha RPC" } } : { data: {}, error: null });
    const { result } = renderHook(() => useFunnelRevenue("project-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBeNull();
    expect(result.current.error).toBeTruthy();
    render(<RevenueOverlayBar revenue={result.current} days={30} onDaysChange={vi.fn()} liveCount={0} onClose={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Receita indisponível");
    expect(screen.getAllByText("Indisponível")).toHaveLength(3);
  });

  it("ignores old project/day responses and clears data when disabled", async () => {
    const old = deferred<Reply>();
    mocks.rpc.mockReturnValueOnce(old.promise).mockResolvedValue({ data: revenue(), error: null });
    const { result, rerender } = renderHook(({ id, days }) => useFunnelRevenue(id, days),
      { initialProps: { id: "old-project", days: 30 } });
    rerender({ id: "new-project", days: 7 });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => old.resolve({ data: { ...revenue(), total: 999 }, error: null }));
    expect(result.current.total).toBe(0);
    rerender({ id: "", days: 7 });
    expect(result.current.total).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});

describe("complete-or-error range pagination", () => {
  it("fetches every row even if the server returns fewer rows than requested", async () => {
    const records = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const query = vi.fn(async (from: number) => ({ data: records.slice(from, from + 2), error: null }));
    expect(await paginatedQuery("Fonte", query, 1000)).toEqual(records);
    expect(query.mock.calls.map(call => call[0])).toEqual([0, 2, 3]);
  });

  it("throws on a later page instead of returning partial rows", async () => {
    await expect(paginatedQuery("Vendas", async from => from === 0
      ? { data: [{ id: "a" }], error: null }
      : { data: null, error: { message: "timeout" } }, 1)).rejects.toThrow("Vendas: timeout");
  });

  it("rejects null data, thrown transport errors and invalid page sizes", async () => {
    await expect(paginatedQuery("Leads", async () => ({ data: null, error: null }))).rejects.toThrow("Leads: Resposta indisponível");
    await expect(paginatedQuery("Cliques", async () => { throw new Error("Offline"); })).rejects.toThrow("Cliques: Offline");
    await expect(paginatedQuery("Fonte", vi.fn(), 0)).rejects.toThrow("Tamanho de página inválido");
  });
});

describe("TRK1.1 legacy Tracker load boundaries", () => {
  const sources = ["imphq_tracking_links", "imphq_ads_spend", "imphq_vendas", "imphq_projects", "imphq_leads", "imphq_clicks"];
  it.each(sources)("shows failure from %s instead of a zero dashboard and preserves link creation", async table => {
    mocks.range.mockImplementation(async (source: string): Promise<PageReply> => source === table
      ? { data: null, error: { message: `${table} failed` } } : { data: [], error: null });
    render(<Tracker />);
    expect(await screen.findByRole("alert")).toHaveTextContent(`${table} failed`);
    expect(screen.queryByText("Total Gasto")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo Link" })).toBeInTheDocument();
    expect(screen.getByText("Receita por moeda e evidências do tracker")).toBeInTheDocument();
  });

  it("paginates all six sources and retries failed loads", async () => {
    mocks.range.mockResolvedValueOnce({ data: null, error: { message: "temporary" } });
    render(<Tracker />);
    await screen.findByRole("alert");
    mocks.range.mockClear();
    mocks.range.mockImplementation(async (source: string, from: number): Promise<PageReply> => {
      if (from > 0) return { data: [], error: null };
      const row: Record<string, unknown> = { id: source, project_id: "project-1", created_at: since,
        name: "Projeto", nome: "Link", destino: "https://example.com", ativo: true, data: {},
        data_ref: "2026-10-01", criado_em: since, score: 0, produto_nome: "Produto A" };
      return { data: [row], error: null };
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar carregar fontes novamente" }));
    await screen.findByRole("tab", { name: "Links UTM" });
    expect(screen.getByText(/Os KPIs monetários em BRL exigem valores conhecidos na mesma moeda/)).toBeInTheDocument();
    expect(screen.queryByText("Total Gasto")).not.toBeInTheDocument();
    for (const source of sources) {
      expect(mocks.range.mock.calls.filter(call => call[0] === source).map(call => call.slice(1, 3))).toEqual([[0, 999], [1, 1000]]);
    }
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Links UTM" }), { button: 0, ctrlKey: false });
    expect(await screen.findByText("Link")).toBeInTheDocument();
  });

  it("prevents an older period load from overwriting a newer result", async () => {
    const old = deferred<PageReply>();
    mocks.range.mockImplementation((table: string, from: number) => table === "imphq_projects" && from === 0
      ? old.promise : Promise.resolve({ data: [], error: null }));
    render(<Tracker />);
    expect(screen.queryByText("Total Gasto")).not.toBeInTheDocument();
    mocks.range.mockResolvedValue({ data: [], error: null });
    fireEvent.click(screen.getByRole("button", { name: "7D" }));
    await screen.findByText("Total Gasto");
    await act(async () => old.resolve({ data: null, error: { message: "old failure" } }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Total Gasto")).toBeInTheDocument();
    const reportArgs = mocks.rpc.mock.calls[mocks.rpc.mock.calls.length - 1][1];
    expect(new Date(reportArgs.p_since).toISOString()).toBe(reportArgs.p_since);
    expect(new Date(reportArgs.p_until).toISOString()).toBe(reportArgs.p_until);
    expect(reportArgs.p_project_id).toBeNull();
    expect(reportArgs.p_since).toMatch(/T03:00:00\.000Z$/);
    expect(reportArgs.p_until).toMatch(/T03:00:00\.000Z$/);
    for (const source of ["imphq_vendas", "imphq_clicks", "imphq_leads"]) {
      const filters = mocks.range.mock.calls.find(call => call[0] === source)?.[3];
      const column = source === "imphq_leads" ? "criado_em" : source === "imphq_vendas" ? "data_venda" : "created_at";
      expect(Object.keys(filters)).toContain(`lt:${column}`);
    }
  });

  it("uses BRT day bounds with the following midnight as the exclusive upper bound", async () => {
    render(<Tracker />);
    await screen.findByText("Total Gasto");
    fireEvent.click(screen.getByRole("button", { name: "Ontem" }));
    await screen.findByText("Total Gasto");
    const args = mocks.rpc.mock.calls[mocks.rpc.mock.calls.length - 1][1];
    expect(Date.parse(args.p_until) - Date.parse(args.p_since)).toBe(86400000);
    expect(args.p_since).toMatch(/T03:00:00\.000Z$/);
    expect(args.p_until).toMatch(/T03:00:00\.000Z$/);
  });
});
