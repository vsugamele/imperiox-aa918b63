// Sala de máquinas (Story OP1.3): transforma o retrato de `imphq_machine_room()` em alertas com gravidade e ação.
// TS puro: usado pela tela, pela CLI (scripts/health.mjs) e testável no vitest.
import { adsSyncHealth, type AdsSyncHealthRow } from "./live-panel.ts";

export type Severity = "erro" | "atencao" | "info";
export type Area = "rotinas" | "acoes" | "webhooks" | "anuncios" | "whatsapp" | "instagram" | "voz" | "custo" | "fontes" | "banco";

export interface MachineAlert { area: Area; severidade: Severity; titulo: string; detalhe?: string; acao?: string }

export interface MachineRoom {
  gerado_em: string;
  banco?: { total_mb: number; historico_cron_mb: number } | null;
  rotinas: Array<{ jobid: number; nome: string; agenda: string; ultima: string | null; ultimo_status: string | null; execucoes_24h: number; falhas_24h: number; ultimo_erro: string | null }>;
  acoes: Array<{ origem: string; falhas_7d: number; executadas_7d: number; expiradas_7d: number; abertas: number; ultima_falha: string | null; ultimo_erro: string | null }>;
  webhooks: Array<{ plataforma: string; ultimo_recebido: string | null; erros_24h: number; ultimo_erro: string | null; ultimo_erro_em: string | null }>;
  anuncios: AdsSyncHealthRow[];
  whatsapp: Array<{ projeto: string | null; instancia: string | null; ativo: boolean; status: string | null; visto: string | null }>;
  instagram: Array<{ projeto: string | null; conta: string | null; saude_ok: string | null; saude_em: string | null; ultimo_webhook: string | null; erro: string | null }>;
  voz: { ultimo_envio: string | null; ultima_falta_saldo: string | null; enviados_7d: number };
  custo_ia_7d: Array<{ origem: string; projeto: string | null; chamadas: number; custo_usd: number | null }>;
  /** Consumo lido na conta de cada provedor (provider-usage-sync). */
  provedores?: Array<{ provedor: string; lido_em: string; gasto_hoje_usd: number | null; unidades: number | null; unidade: string | null; saldo: number | null; gasto_7d_usd: number | null; detalhes: Record<string, unknown> | null }>;
  fontes: Array<{ projeto: string; nome: string; ultima_venda: string | null; ultimo_evento: string | null; ultima_msg_recebida: string | null; ultimo_gasto: string | null }>;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const age = (iso: string | null | undefined, now: number) => (iso ? now - Date.parse(iso) : Infinity);
const dm = (iso: string) => iso.slice(0, 10).split("-").reverse().slice(0, 2).join("/");
const days = (ms: number) => Math.floor(ms / DAY);

/** Falha passageira de conexão do pg_net/pg_cron: vira atenção, não erro, se a última execução deu certo. */
const TRANSIENT = /connection failed|timeout|could not connect/i;

export function machineAlerts(r: MachineRoom, now: number = Date.now()): MachineAlert[] {
  const out: MachineAlert[] = [];

  for (const j of r.rotinas) {
    if (!j.falhas_24h) continue;
    const lastFailed = j.ultimo_status === "failed";
    const transient = TRANSIENT.test(j.ultimo_erro ?? "");
    // Queda isolada de conexão, com a última execução ok, não é alerta.
    if (transient && !lastFailed && j.falhas_24h < 3) continue;
    out.push({
      area: "rotinas",
      severidade: lastFailed && !transient ? "erro" : "atencao",
      titulo: `Rotina "${j.nome}": ${j.falhas_24h} falha(s) em 24 h${lastFailed ? ", inclusive a última" : ""}`,
      detalhe: j.ultimo_erro ?? undefined,
      acao: lastFailed && !transient ? "Corrigir ou desativar a rotina (cron.alter_job)." : undefined,
    });
  }

  for (const a of r.acoes) {
    if (a.falhas_7d) out.push({ area: "acoes", severidade: "atencao", titulo: `Ações de "${a.origem}": ${a.falhas_7d} falha(s) em 7 dias`, detalhe: a.ultimo_erro ?? undefined });
    if (a.expiradas_7d >= 10) out.push({ area: "acoes", severidade: "atencao", titulo: `"${a.origem}": ${a.expiradas_7d} propostas expiraram sem decisão em 7 dias`, acao: "Revisar em /aprovar ou desligar a proposta automática." });
    if (a.abertas >= 10) out.push({ area: "acoes", severidade: "info", titulo: `"${a.origem}": ${a.abertas} propostas esperando decisão`, acao: "Decidir em /aprovar." });
  }

  for (const w of r.webhooks) {
    const quiet = age(w.ultimo_recebido, now);
    if (w.erros_24h) out.push({ area: "webhooks", severidade: "erro", titulo: `Webhook ${w.plataforma}: ${w.erros_24h} erro(s) em 24 h`, detalhe: w.ultimo_erro ?? undefined });
    else if (quiet > 14 * DAY && quiet <= 120 * DAY) {
      // Parou há pouco (até 45 dias) pede atenção; calada há mais tempo provavelmente foi desativada.
      out.push({ area: "webhooks", severidade: quiet <= 45 * DAY ? "atencao" : "info", titulo: `${w.plataforma} parou de mandar avisos: o último foi em ${dm(w.ultimo_recebido!)} (${days(quiet)} dias)`, acao: "Conferir no painel da plataforma se houve venda e se o postback aponta para o Império." });
    }
  }

  for (const row of r.anuncios) {
    const h = adsSyncHealth(row, now);
    if (h.estado === "erro" || h.estado === "parado") {
      out.push({ area: "anuncios", severidade: h.estado === "erro" ? "erro" : "atencao", titulo: `Gasto de anúncio de ${row.project_id}: ${h.estado === "erro" ? "sync com erro" : "sync parado"}`, detalhe: h.problemas.join(" ") });
    }
  }

  for (const w of r.whatsapp) {
    const label = w.instancia || "sem nome";
    if (w.ativo && age(w.visto, now) > HOUR) out.push({ area: "whatsapp", severidade: "erro", titulo: `Chip "${label}" (${w.projeto ?? "?"}) sem sinal há ${w.visto ? `${Math.round(age(w.visto, now) / HOUR)} h` : "tempo indeterminado"}`, acao: "Reconectar o chip na Evolution." });
    if (!w.ativo && !w.visto) out.push({ area: "whatsapp", severidade: "info", titulo: `Instância "${label}" nunca conectou (status ${w.status ?? "?"})`, acao: "Conectar ou remover." });
  }

  for (const ig of r.instagram) {
    if (ig.saude_ok === "false") out.push({ area: "instagram", severidade: "erro", titulo: `Instagram @${ig.conta ?? "?"} com erro no Zernio`, detalhe: ig.erro ?? undefined });
    else if (age(ig.ultimo_webhook, now) > DAY) out.push({ area: "instagram", severidade: "atencao", titulo: `Instagram @${ig.conta ?? "?"} sem webhook do Zernio há ${days(age(ig.ultimo_webhook, now))} dia(s)` });
  }

  if (age(r.voz.ultima_falta_saldo, now) < DAY) out.push({ area: "voz", severidade: "erro", titulo: "Voz (ElevenLabs) sem saldo nas últimas 24 h", acao: "Recarregar créditos da ElevenLabs." });

  const total = r.custo_ia_7d.reduce((s, c) => s + (c.custo_usd ?? 0), 0);
  out.push({ area: "custo", severidade: "info", titulo: `Custo de IA medido em 7 dias: US$ ${total.toFixed(2)} em ${r.custo_ia_7d.reduce((s, c) => s + c.chamadas, 0)} chamada(s)`, detalhe: "Só o que já registra custo entra nesta soma." });

  for (const p of r.provedores ?? []) {
    if (age(p.lido_em, now) > 3 * HOUR) out.push({ area: "custo", severidade: "atencao", titulo: `Consumo da ${p.provedor} sem leitura há ${Math.round(age(p.lido_em, now) / HOUR)} h`, acao: "Conferir a rotina provider-usage-sync." });
    if (p.provedor === "openrouter") {
      const semana = typeof p.detalhes?.usage_weekly === "number" ? p.detalhes.usage_weekly as number : null;
      const naoAtribuido = semana !== null ? semana - r.custo_ia_7d.reduce((s, c) => s + (c.custo_usd ?? 0), 0) : null;
      out.push({ area: "custo", severidade: "info", titulo: `OpenRouter: US$ ${(p.gasto_hoje_usd ?? 0).toFixed(2)} hoje${semana !== null ? `, US$ ${semana.toFixed(2)} na semana` : ""}`,
        detalhe: naoAtribuido !== null && naoAtribuido > 0.01 ? `US$ ${naoAtribuido.toFixed(2)} da semana ainda sem automação registrada.` : undefined });
    }
    if (p.provedor === "elevenlabs" && p.unidades !== null && typeof p.detalhes?.character_limit === "number") {
      const limite = p.detalhes.character_limit as number;
      const pct = limite > 0 ? p.unidades / limite : 0;
      out.push({ area: "voz", severidade: pct >= 0.9 ? "erro" : pct >= 0.7 ? "atencao" : "info", titulo: `ElevenLabs: ${p.unidades.toLocaleString("pt-BR")} de ${limite.toLocaleString("pt-BR")} caracteres usados no ciclo (${Math.round(pct * 100)}%)` });
    }
    if (p.provedor === "kie" && p.saldo !== null) {
      out.push({ area: "custo", severidade: p.saldo < 50 ? "atencao" : "info", titulo: `Kie: saldo de ${p.saldo.toLocaleString("pt-BR")} créditos`, acao: p.saldo < 50 ? "Recarregar créditos da Kie (geração de imagem e vídeo)." : undefined });
    }
  }

  for (const f of r.fontes) {
    const ev = age(f.ultimo_evento, now);
    if (!f.ultimo_evento && !f.ultima_venda && !f.ultima_msg_recebida) out.push({ area: "fontes", severidade: "info", titulo: `${f.nome}: nenhum dado chegando (tracker, vendas e WhatsApp vazios)` });
    else if (ev > 7 * DAY && ev !== Infinity) out.push({ area: "fontes", severidade: "atencao", titulo: `${f.nome}: tracker sem eventos há ${days(ev)} dias`, acao: "Conferir se o script do tracker está na página." });
  }

  if (r.banco && r.banco.historico_cron_mb > 300) {
    out.push({ area: "banco", severidade: "atencao", titulo: `Histórico das rotinas ocupa ${r.banco.historico_cron_mb} MB de ${r.banco.total_mb} MB do banco`, acao: "Limpar execuções antigas e agendar limpeza diária." });
  }

  const rank: Record<Severity, number> = { erro: 0, atencao: 1, info: 2 };
  return out.sort((a, b) => rank[a.severidade] - rank[b.severidade]);
}

/** Contagem por gravidade para o selo da tela e o resumo da CLI. */
export function alertCounts(alerts: ReadonlyArray<MachineAlert>): Record<Severity, number> {
  return { erro: alerts.filter((a) => a.severidade === "erro").length, atencao: alerts.filter((a) => a.severidade === "atencao").length, info: alerts.filter((a) => a.severidade === "info").length };
}
