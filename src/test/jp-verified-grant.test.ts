import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jpPrepareAccessReply } from "@shared/crmBridgeJP";
import { activeProgramIds, phoneTail, pickVerifiedPurchase, programForProduct } from "@shared/jp-verified-grant";

const CCP = "3c368b42-5b73-4d86-a1cd-35c3022b142d";
const email = "aluna@example.test";
const link = "https://www.jphaireducation.com.br/auth/verify?token=" + "b".repeat(64);
const json = (body: unknown) => new Response(JSON.stringify(body));

describe("compra verificada → programa", () => {
  it("mapeia só produtos conhecidos e escolhe a compra aprovada mais recente que ainda não está ativa", () => {
    expect(programForProduct("Código dos Cortes Perfeitos")?.program_id).toBe(CCP);
    expect(programForProduct("Formação JP Hair Education")).toBeNull();
    const sales = [
      { id: "v1", produto_nome: "Código dos Cortes Perfeitos", status: "aprovado", data_venda: "2026-10-06T10:00:00Z", created_at: "2026-10-06T10:00:00Z" },
      { id: "v2", produto_nome: "Finalização Express", status: "recusado", data_venda: "2026-10-06T11:00:00Z", created_at: "2026-10-06T11:00:00Z" },
      { id: "v3", produto_nome: "Formação JP Hair Education", status: "aprovado", data_venda: "2026-10-06T12:00:00Z", created_at: "2026-10-06T12:00:00Z" },
    ];
    expect(pickVerifiedPurchase(sales, [])).toMatchObject({ venda_id: "v1", program_id: CCP, programa: "O Código dos Cortes Perfeitos" });
    expect(pickVerifiedPurchase(sales, [CCP])).toBeNull();
    expect(activeProgramIds([{ program_id: CCP }, { id: "x" }, {}])).toEqual([CCP, "x"]);
    expect(phoneTail("+55 (37) 99982-3318")).toBe("99823318");
  });
});

describe("liberação verificada no atendimento", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "test-only-secret" } });
    vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("comprou e ficou travado: libera o programa da compra, confere e manda o link do curso", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ ok: true, exists: false, entitlements: [] }))
      .mockResolvedValueOnce(json({ ok: true, user_id: "u1", created: true }))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ok: true, exists: true, entitlements: [{ is_active: true, program_id: CCP }] }))
      .mockResolvedValueOnce(json({ magic_link: link }));
    vi.stubGlobal("fetch", fetch);
    const onGranted = vi.fn(async () => {});
    const findPurchase = vi.fn(async () => ({ venda_id: "v1", program_id: CCP, programa: "O Código dos Cortes Perfeitos", produto_nome: "Código dos Cortes Perfeitos", data_venda: "2026-10-06" }));
    const result = await jpPrepareAccessReply("Pronto!", email, "Comprei e não consigo acessar", "Comprei e não consigo acessar", false, { findPurchase, onGranted });
    expect(result).toMatchObject({ needsHandoff: false });
    expect(result.text).toContain("liberei seu acesso");
    expect(result.text).toContain(link);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ action: "create_account", email });
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toMatchObject({ action: "grant_access", email, program_ids: [CCP], source_ref: "v1" });
    expect(JSON.parse(fetch.mock.calls[4][1].body).redirect_path).toBe(`/programs/${CCP}`);
    expect(onGranted).toHaveBeenCalledWith(expect.objectContaining({ venda_id: "v1" }), email);
  });

  it("sem compra aprovada continua indo para a equipe e não libera nada", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ ok: true, exists: true, entitlements: [] }));
    vi.stubGlobal("fetch", fetch);
    const result = await jpPrepareAccessReply("Liberado!", email, "Paguei e não consigo acessar", "Paguei e não consigo acessar", false, { findPurchase: async () => null, onGranted: vi.fn() });
    expect(result.needsHandoff).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("se a liberação não aparecer no cadastro, não anuncia acesso", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ ok: true, exists: true, entitlements: [] }))
      .mockResolvedValueOnce(json({ ok: true, created: false }))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ok: true, exists: true, entitlements: [] })));
    const onGranted = vi.fn();
    const result = await jpPrepareAccessReply("Pronto!", email, "Não consigo acessar", "Não consigo acessar", false, {
      findPurchase: async () => ({ venda_id: "v1", program_id: CCP, programa: "O Código dos Cortes Perfeitos", produto_nome: "CCP", data_venda: "2026-10-06" }), onGranted,
    });
    expect(result.needsHandoff).toBe(true);
    expect(result.text).not.toContain("liberei");
    expect(onGranted).not.toHaveBeenCalled();
  });
});
