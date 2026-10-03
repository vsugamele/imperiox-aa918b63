import { describe, expect, it } from "vitest";
import { alertCounts, machineAlerts, type MachineRoom } from "@shared/machine-room";

const now = Date.parse("2026-10-03T21:00:00Z");
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
const base: MachineRoom = {
  gerado_em: ago(0), banco: { total_mb: 3000, historico_cron_mb: 100 },
  rotinas: [], acoes: [], webhooks: [], anuncios: [], whatsapp: [], instagram: [],
  voz: { ultimo_envio: null, ultima_falta_saldo: null, enviados_7d: 0 }, custo_ia_7d: [], fontes: [],
};
const titles = (r: Partial<MachineRoom>) => machineAlerts({ ...base, ...r }, now).filter((a) => a.area !== "custo");

describe("machine room alerts", () => {
  it("flags a routine whose last run failed, and ignores an isolated connection drop", () => {
    const a = titles({ rotinas: [
      { jobid: 1, nome: "limpeza", agenda: "0 3 * * *", ultima: ago(18), ultimo_status: "failed", execucoes_24h: 1, falhas_24h: 1, ultimo_erro: "function storage.delete(text) does not exist" },
      { jobid: 2, nome: "scanner", agenda: "*/15 * * * *", ultima: ago(0.1), ultimo_status: "succeeded", execucoes_24h: 96, falhas_24h: 1, ultimo_erro: "connection failed" },
    ] });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ area: "rotinas", severidade: "erro" });
    expect(a[0].titulo).toContain("limpeza");
  });

  it("warns when a platform recently stopped sending webhooks and only notes long-quiet ones", () => {
    const a = titles({ webhooks: [
      { plataforma: "H&W", ultimo_recebido: ago(28 * 24), erros_24h: 0, ultimo_erro: null, ultimo_erro_em: null },
      { plataforma: "PerfectPay", ultimo_recebido: ago(107 * 24), erros_24h: 0, ultimo_erro: null, ultimo_erro_em: null },
      { plataforma: "Ticto", ultimo_recebido: ago(1), erros_24h: 2, ultimo_erro: "timeout", ultimo_erro_em: ago(2) },
    ] });
    expect(a.find((x) => x.titulo.startsWith("H&W"))?.severidade).toBe("atencao");
    expect(a.find((x) => x.titulo.startsWith("PerfectPay"))?.severidade).toBe("info");
    expect(a.find((x) => x.titulo.includes("Ticto"))?.severidade).toBe("erro");
  });

  it("reads expired Meta token, silent chip, Zernio error, voice without credit and cron history size", () => {
    const a = titles({
      anuncios: [{ meta_configurado: true, meta_status: "error", meta_erro_codigo: "190", meta_erro: "Session has expired", meta_ultimo_sync: ago(2400), ultimo_dia_com_gasto: "2026-08-19", ...({ project_id: "jp" } as object) }],
      whatsapp: [{ projeto: "jp", instancia: "Suporte", ativo: true, status: "connected", visto: ago(3) }, { projeto: "default", instancia: "imp_1", ativo: false, status: "connecting", visto: null }],
      instagram: [{ projeto: "jp", conta: "jp06", saude_ok: "false", saude_em: ago(1), ultimo_webhook: ago(1), erro: "401" }],
      voz: { ultimo_envio: ago(30), ultima_falta_saldo: ago(2), enviados_7d: 1 },
      banco: { total_mb: 3089, historico_cron_mb: 1233 },
    });
    expect(a.find((x) => x.area === "anuncios")?.detalhe).toContain("Token da Meta expirado");
    expect(a.find((x) => x.area === "whatsapp" && x.severidade === "erro")?.titulo).toContain("Suporte");
    expect(a.find((x) => x.area === "whatsapp" && x.severidade === "info")?.titulo).toContain("nunca conectou");
    expect(a.find((x) => x.area === "instagram")?.severidade).toBe("erro");
    expect(a.find((x) => x.area === "voz")?.severidade).toBe("erro");
    expect(a.find((x) => x.area === "banco")?.titulo).toContain("1233 MB");
  });

  it("notes projects with no data and stale trackers, and sorts errors first", () => {
    const alerts = machineAlerts({ ...base, fontes: [
      { projeto: "a", nome: "Sem nada", ultima_venda: null, ultimo_evento: null, ultima_msg_recebida: null, ultimo_gasto: null },
      { projeto: "b", nome: "Parado", ultima_venda: null, ultimo_evento: ago(12 * 24), ultima_msg_recebida: null, ultimo_gasto: null },
      { projeto: "c", nome: "Vivo", ultima_venda: ago(5), ultimo_evento: ago(1), ultima_msg_recebida: ago(1), ultimo_gasto: null },
    ], voz: { ultimo_envio: null, ultima_falta_saldo: ago(1), enviados_7d: 0 } }, now);
    expect(alerts[0].severidade).toBe("erro");
    expect(alerts.some((x) => x.titulo.includes("Sem nada"))).toBe(true);
    expect(alerts.find((x) => x.titulo.includes("Parado"))?.titulo).toContain("12 dias");
    expect(alerts.some((x) => x.titulo.includes("Vivo"))).toBe(false);
    expect(alertCounts(alerts).erro).toBe(1);
  });

  it("always reports the measured AI cost", () => {
    const a = machineAlerts({ ...base, custo_ia_7d: [{ origem: "wa-ai-reply", projeto: "jp", chamadas: 283, custo_usd: 0.1963 }] }, now);
    expect(a.find((x) => x.area === "custo")?.titulo).toBe("Custo de IA medido em 7 dias: US$ 0.20 em 283 chamada(s)");
  });
});
