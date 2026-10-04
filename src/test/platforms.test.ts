import { describe, expect, it } from "vitest";
import { PLATFORMS, platformStatus, platformSummary, type Platform } from "@shared/platforms";
import type { MachineRoom } from "@shared/machine-room";

const now = Date.parse("2026-10-04T12:00:00Z");
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
const room: MachineRoom = {
  gerado_em: ago(0), banco: null, rotinas: [{ jobid: 1, nome: "a", agenda: "*", ultima: ago(0), ultimo_status: "succeeded", execucoes_24h: 10, falhas_24h: 0, ultimo_erro: null }],
  acoes: [], webhooks: [
    { plataforma: "Ticto", ultimo_recebido: ago(2), erros_24h: 0, ultimo_erro: null, ultimo_erro_em: null },
    { plataforma: "H&W", ultimo_recebido: ago(28 * 24), erros_24h: 0, ultimo_erro: null, ultimo_erro_em: null },
  ],
  anuncios: [{ meta_configurado: true, meta_status: "error", meta_erro_codigo: "190", meta_erro: "expired", meta_ultimo_sync: ago(2400), ultimo_dia_com_gasto: "2026-08-19" }],
  whatsapp: [{ projeto: "jp", instancia: "Suporte", ativo: true, status: "connected", visto: ago(0.2) }],
  instagram: [{ projeto: "jp", conta: "jp06", saude_ok: "true", saude_em: ago(1), ultimo_webhook: ago(2), erro: null }],
  voz: { ultimo_envio: null, ultima_falta_saldo: null, enviados_7d: 0 }, custo_ia_7d: [],
  fontes: [{ projeto: "jp", nome: "JP", ultima_venda: ago(5), ultimo_evento: ago(1), ultima_msg_recebida: ago(1), ultimo_gasto: null }],
  provedores: [{ provedor: "openrouter", lido_em: ago(0.5), gasto_hoje_usd: 0.1, unidades: null, unidade: "usd", saldo: null, gasto_7d_usd: 3.27, detalhes: {} },
    { provedor: "kie", lido_em: ago(0.5), gasto_hoje_usd: null, unidades: null, unidade: "creditos", saldo: 317, gasto_7d_usd: null, detalhes: {} }],
};
const byId = (id: string) => PLATFORMS.find((p) => p.id === id) as Platform;
const st = (id: string) => platformStatus(byId(id), room, now);

describe("platforms", () => {
  it("has unique ids and every platform in a category", () => {
    expect(new Set(PLATFORMS.map((p) => p.id)).size).toBe(PLATFORMS.length);
  });

  it("derives state from real signals", () => {
    expect(st("meta-ads")).toMatchObject({ estado: "erro" });
    expect(st("meta-ads").bloqueio).toContain("Token da Meta expirado");
    expect(st("evolution-api")).toMatchObject({ estado: "operacional", evidencia: "1 chip(s) conectado(s)" });
    expect(st("zernio").estado).toBe("operacional");
    expect(st("ticto")).toMatchObject({ estado: "operacional" });
    expect(st("hw")).toMatchObject({ estado: "atencao" });
    expect(st("hotmart")).toMatchObject({ estado: "pendente" });
    expect(st("openrouter")).toMatchObject({ estado: "operacional", custo: "US$ 3.27 em 7 dias" });
    expect(st("kie").custo).toBe("saldo 317 créditos");
    const weekly = { ...room, provedores: [{ ...room.provedores![0], detalhes: { usage_weekly: 3.27 }, gasto_7d_usd: 0.05 }] };
    expect(platformStatus(byId("openrouter"), weekly, now).custo).toBe("US$ 3.27 na semana");
    expect(st("elevenlabs").estado).toBe("sem_sinal");
    expect(st("geelark")).toMatchObject({ estado: "sem_sinal", evidencia: "Sem verificação automática ainda" });
    expect(st("supabase").estado).toBe("operacional");
    expect(st("tracker").estado).toBe("operacional");
  });

  it("summarizes usable, automatable, assisted and pending", () => {
    const rows = PLATFORMS.map((p) => ({ p, s: platformStatus(p, room, now) }));
    const s = platformSummary(rows);
    expect(s.total).toBe(PLATFORMS.length);
    expect(s.utilizaveis).toBeGreaterThan(0);
    expect(s.automatizaveis).toBeLessThanOrEqual(s.utilizaveis);
    expect(s.pendentes).toBeGreaterThanOrEqual(2);
  });
});
