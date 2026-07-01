import type { Acao } from "../FlowEditor";

export type IssueSeverity = "error" | "warn";

export interface FlowIssue {
  stepIndex: number;
  severity: IssueSeverity;
  message: string;
  field?: string;
}

const MSG_TIPOS = new Set(["whatsapp", "audio", "telegram", "email", "ia_message"]);

function hasContent(a: Acao): boolean {
  const m = (a.template || a.mensagem || a.corpo || a.conteudo || "").toString().trim();
  return m.length > 0;
}

function isValidUrl(u?: string): boolean {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * validateFlow — lint visual contínuo.
 * Não bloqueia salvamento sozinho; o caller decide com base em severity.
 */
export function validateFlow(acoes: Acao[]): FlowIssue[] {
  const out: FlowIssue[] = [];

  acoes.forEach((a, i) => {
    // Mensagem obrigatória (WhatsApp aceita só mídia, sem texto)
    if (MSG_TIPOS.has(a.tipo) && !hasContent(a)) {
      const waHasMedia = a.tipo === "whatsapp" && !!a.media?.url;
      if (!waHasMedia) {
        out.push({
          stepIndex: i,
          severity: "error",
          message: `Etapa ${i + 1}: ${a.tipo} sem mensagem/template.`,
          field: "template",
        });
      }
    }
    if (a.tipo === "email" && !a.assunto?.trim()) {
      out.push({ stepIndex: i, severity: "warn", message: `Etapa ${i + 1}: email sem assunto.`, field: "assunto" });
    }

    // Wait event
    if ((a.tipo === "wait_event" || a.tipo === "stop_on_event") && !a.event_name?.trim() && !a.stop_event_type?.trim()) {
      out.push({
        stepIndex: i,
        severity: "error",
        message: `Etapa ${i + 1}: aguardar/parar sem nome do evento.`,
        field: "event_name",
      });
    }

    // AB split — pesos
    if (a.tipo === "ab_split") {
      const p = Number(a.rota_a_porcentagem ?? 50);
      if (Number.isNaN(p) || p <= 0 || p >= 100) {
        out.push({
          stepIndex: i,
          severity: "error",
          message: `Etapa ${i + 1}: A/B precisa de % entre 1 e 99 (atual: ${a.rota_a_porcentagem}).`,
          field: "rota_a_porcentagem",
        });
      }
      if (!a.template?.trim() && !a.mensagem_b?.trim()) {
        out.push({ stepIndex: i, severity: "warn", message: `Etapa ${i + 1}: A/B sem variantes definidas.` });
      }
    }

    // Condições
    if (a.tipo === "condicao" && !a.condicao_tipo) {
      out.push({ stepIndex: i, severity: "error", message: `Etapa ${i + 1}: condição sem tipo.`, field: "condicao_tipo" });
    }
    if (a.tipo === "condicao_lead") {
      if (!a.condition_field || !a.condition_operator) {
        out.push({
          stepIndex: i,
          severity: "error",
          message: `Etapa ${i + 1}: condição de lead incompleta (campo/operador).`,
        });
      }
    }

    // Branch by awareness/score
    if (a.tipo === "branch_by_awareness") {
      const min = Number(a.awareness_min ?? -1);
      const max = Number(a.awareness_max ?? -1);
      if (min < 0 || max < 0 || min >= max) {
        out.push({ stepIndex: i, severity: "warn", message: `Etapa ${i + 1}: faixa de consciência inválida.` });
      }
    }

    // Webhook
    if (a.tipo === "webhook_call" && !isValidUrl(a.webhook_url)) {
      out.push({
        stepIndex: i,
        severity: "error",
        message: `Etapa ${i + 1}: webhook sem URL válida (http/https).`,
        field: "webhook_url",
      });
    }

    // Loop infinito
    if (a.tipo === "loop_steps") {
      const back = Number(a.loop_jump_back_steps ?? 0);
      const count = Number(a.loop_count ?? 0);
      const hasCond = !!a.loop_until_condition_field;
      if (back <= 0) {
        out.push({ stepIndex: i, severity: "error", message: `Etapa ${i + 1}: loop sem passos pra voltar.` });
      }
      if (count <= 0 && !hasCond) {
        out.push({
          stepIndex: i,
          severity: "error",
          message: `Etapa ${i + 1}: loop sem limite de iterações nem condição de saída — risco de loop infinito.`,
        });
      }
    }

    // Tag actions
    if ((a.tipo === "adicionar_tag" || a.tipo === "remover_tag") && !a.tag?.trim()) {
      out.push({ stepIndex: i, severity: "error", message: `Etapa ${i + 1}: tag não informada.`, field: "tag" });
    }

    // GPT prompt
    if (a.tipo === "gpt_prompt" && !a.template?.trim()) {
      out.push({ stepIndex: i, severity: "error", message: `Etapa ${i + 1}: prompt GPT vazio.`, field: "template" });
    }

    // Delays negativos
    if (typeof a.delay_min === "number" && a.delay_min < 0) {
      out.push({ stepIndex: i, severity: "warn", message: `Etapa ${i + 1}: delay negativo.` });
    }
  });

  // Fluxo vazio
  if (acoes.length === 0) {
    out.push({ stepIndex: -1, severity: "warn", message: "Fluxo sem etapas." });
  }

  return out;
}

export function countBySeverity(issues: FlowIssue[]) {
  return issues.reduce(
    (acc, i) => {
      acc[i.severity] = (acc[i.severity] ?? 0) + 1;
      return acc;
    },
    { error: 0, warn: 0 } as Record<IssueSeverity, number>
  );
}
