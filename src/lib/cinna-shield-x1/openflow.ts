import type { Acao } from "@/components/openflow/FlowEditor";
import { parseConfig, type Config, type Stage } from "@/lib/cinna-shield-x1/engine";

export const CINNA_NATIVE_FLOW_ID = "cinna-shield-x1-native";
export const CINNA_NATIVE_FLOW_URL = `/openflow?automacao=${CINNA_NATIVE_FLOW_ID}`;
export interface CinnaNativeAction extends Acao {
  cinna_stage?: Omit<Stage, "messages" | "question">;
  cinna_policy?: Omit<Config, "stages"> & { model: string };
}

/** One-time import. Subsequent edits belong to imphq_automacoes, never regenerated on load. */
export function toNativeCinnaFlow(value: unknown, model: string): CinnaNativeAction[] {
  const config = parseConfig(value);
  if (!model.trim()) throw new Error("Modelo de IA não configurado.");
  const actions: CinnaNativeAction[] = [];
  config.stages.forEach((stage, stageIndex) => {
    [...stage.messages, stage.question].forEach((template, messageIndex) => {
      actions.push({ id: `cinna-${stage.id}-message-${messageIndex}`, tipo: "whatsapp", template, delay_min: 0 });
    });
    const { messages: _messages, question: _question, ...metadata } = stage;
    const wait: CinnaNativeAction = {
      id: `cinna-${stage.id}-reply`, tipo: "wait_reply", template: "", delay_min: 0,
      cinna_stage: structuredClone(metadata),
    };
    if (stageIndex === 0) {
      wait.cinna_policy = { product: config.product, version: config.version, language: config.language,
        offer: structuredClone(config.offer), replies: structuredClone(config.replies), model,
        ...(config.consultative ? { consultative: structuredClone(config.consultative) } : {}) };
    }
    actions.push(wait);
  });
  return actions;
}
