import type { Config, Decision } from "./engine.ts";

export interface ConsultativeMessage { role: "user" | "assistant"; content: string }
export interface ConsultativeRequest { system: string; messages: ConsultativeMessage[] }
export type ConsultativeComposer = (request: ConsultativeRequest) => Promise<unknown>;
export const acknowledgements = {
  listening: "I'm listening. We can take this one question at a time.",
  concern: "That sounds worrying, and I'm glad you brought it up.",
  overwhelmed: "That sounds like a lot to process. We can keep this simple.",
  clarity: "It makes sense to want a clear answer before deciding.",
  uncertainty: "I don't have enough verified information to answer that part.",
  choice: "Thanks for telling me what matters to you.",
  permission: "Of course. I'll explain it plainly.",
  timing: "There's no need to rush a decision.",
  listening_pt: "Estou ouvindo. Podemos conversar sobre uma dúvida de cada vez.",
} as const;
const questions = {
  clarify: "Which part would you like me to explain?",
  concern: "What would you most like to understand?",
  permission: "We can also look at the supplement whenever you feel ready.",
  none: "",
} as const;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const identity = /\b(are you (an? )?(ai|bot|human|doctor|nurse|real person)|who are you|are you artificial intelligence)\b/i;

/** Facts are rendered verbatim from the pinned policy, never generated or paraphrased. */
export async function composeConsultativeReply(config: Config, decision: Decision, incoming: string,
  history: ConsultativeMessage[], compose: ConsultativeComposer): Promise<string[] | null> {
  if (!config.consultative || decision.permissionPrompt || !["hold", "advance"].includes(decision.action) || identity.test(incoming)) return null;
  const advance = decision.action === "advance";
  if (!advance && decision.intent !== "question" && decision.intent !== "medical") return null;
  const beforeProduct = config.stages.findIndex(s => s.id === decision.stageId) <= config.stages.findIndex(s => s.id === "awareness");
  const snippets = config.consultative.approvedSnippets.filter(s => !beforeProduct || !/cinna|product|formula|checkout|offer/i.test(s.text));
  const messages = history.slice(-8).map(item => ({ role: item.role, content: item.content.slice(0, 800) }));
  messages.push({ role: "user", content: incoming.slice(0, 2000) });
  try {
    const result = await compose({ messages, system: [
      "You are Ana, a virtual support assistant, never a clinician or a human. Listen warmly and respond to the user's actual concern.",
      "Return only JSON {acknowledgementId:string,snippetIds:string[],questionId:'clarify'|'concern'|'permission'|'none'}.",
      `Choose the acknowledgement ID best matching the actual user concern, not a generic choice every time. Approved acknowledgements: ${JSON.stringify(acknowledgements)}. Do not produce free text.`,
      "Facts will be rendered verbatim from selected approved snippets. Never invent an ID. Select at most two relevant snippets, or none when there is no relevant approved information.",
      advance ? "The script is advancing: acknowledge only; snippetIds must be empty and questionId none. Do not repeat the next script." :
        `The script is holding. Select one safe question or none. ${beforeProduct ? "Do not introduce a product; permission is needed first." : "Do not add a checkout link or sell through unverified claims."}`,
      `Current script question: ${config.stages.find(stage => stage.id === decision.stageId)?.question ?? ""}`,
      `Approved snippets: ${JSON.stringify(snippets)}`,
    ].join("\n") });
    if (!isRecord(result) || Object.keys(result).some(key => !["acknowledgementId", "snippetIds", "questionId"].includes(key)) ||
      typeof result.acknowledgementId !== "string" || !Object.prototype.hasOwnProperty.call(acknowledgements, result.acknowledgementId) ||
      !Array.isArray(result.snippetIds) || result.snippetIds.length > 2 || !result.snippetIds.every(id => typeof id === "string" && snippets.some(s => s.id === id)) ||
      typeof result.questionId !== "string" || !Object.prototype.hasOwnProperty.call(questions, result.questionId)) return null;
    const ack = acknowledgements[result.acknowledgementId as keyof typeof acknowledgements];
    if (advance && (result.snippetIds.length || result.questionId !== "none")) return null;
    const selected = [...new Set(result.snippetIds)].map(id => snippets.find(s => s.id === id)!.text);
    const question = questions[result.questionId as keyof typeof questions];
    return [[ack, ...selected, question].filter(Boolean).join("\n\n")];
  } catch { return null; }
}
