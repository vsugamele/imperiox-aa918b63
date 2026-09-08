/** CSX1.1: pure, channel-independent conversation policy. No network or storage. */
export type Intent = "answer" | "question" | "price" | "budget" | "timing" | "buy" | "trust" | "shipping" | "ingredients" | "medical" | "stop" | "human";
export const answerFields = ["name", "concern", "goal", "previousExperience", "idealRoutine", "objection"] as const;
export type AnswerField = typeof answerFields[number];
export interface Stage {
  id: string;
  title: string;
  sourceGroups: string[];
  messages: string[];
  question: string;
  input: "name" | "free" | "confirm";
  choices?: { label: string; acknowledgement: string }[];
  capture?: AnswerField;
}
export interface Config {
  product: "cinna-shield";
  consultative?: { personaName: "Ana"; approvedSnippets: { id: string; text: string }[] };
  version: string;
  language: "en-US";
  stages: Stage[];
  offer: { approved: boolean; checkoutUrl: string | null; priceLabel: string | null };
  replies: Record<Exclude<Intent, "answer" | "buy">, string>;
}
export interface State {
  product: "cinna-shield";
  version: string;
  stageIndex: number;
  revision: number;
  status: "active" | "stopped" | "human" | "complete";
  checkoutSent: boolean;
  awaitingProductConsent?: boolean;
  awaitingPurchaseLink?: boolean;
  answers?: Partial<Record<AnswerField, string>>;
  processedEventIds: string[];
}
export interface Input { eventId: string; message: string; state?: State; }
export interface Decision {
  messages: string[];
  state: State;
  action: "start" | "advance" | "hold" | "checkout" | "stop" | "human" | "complete" | "ignored";
  intent: Intent | "start";
  source: "script" | "rules" | "ai" | "fallback";
  stageId: string;
  warning?: string;
  permissionPrompt?: boolean;
  choices?: string[];
}
export type Classifier = (request: { message: string; question: string; allowedIntents: readonly Intent[] }) => Promise<unknown>;
const intents: readonly Intent[] = ["answer", "question", "price", "budget", "timing", "buy", "trust", "shipping", "ingredients", "medical", "stop", "human"];
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validCheckout(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && u.port === "" &&
      /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) &&
      !/(^|\.)(example\.(com|org|net)|localhost)$|\.(example|test|invalid|local)$/i.test(u.hostname);
  } catch { return false; }
}

export function parseConfig(value: unknown): Config {
  if (!record(value) || value.product !== "cinna-shield" || !text(value.version) || value.language !== "en-US" ||
      !Array.isArray(value.stages) || value.stages.length !== 9 || !record(value.offer) || !record(value.replies)) throw new Error("Invalid Cinna Shield configuration");
  if (value.consultative !== undefined) {
    const consultative = value.consultative;
    if (!record(consultative) || Object.keys(consultative).some(key => !["personaName", "approvedSnippets"].includes(key)) || consultative.personaName !== "Ana" || !Array.isArray(consultative.approvedSnippets) ||
        consultative.approvedSnippets.length < 1 || consultative.approvedSnippets.length > 12 ||
        !consultative.approvedSnippets.every(snippet => record(snippet) && Object.keys(snippet).some(key => !["id", "text"].includes(key)) === false && typeof snippet.id === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/.test(snippet.id) && text(snippet.text) && snippet.text.length <= 1200) ||
        new Set(consultative.approvedSnippets.map(snippet => snippet.id)).size !== consultative.approvedSnippets.length) throw new Error("Invalid consultative policy");
  }
  for (const stage of value.stages) {
    if (record(stage) && stage.capture !== undefined && !answerFields.includes(stage.capture as AnswerField)) throw new Error("Invalid answer capture field");
    if (!record(stage) || !text(stage.id) || !text(stage.title) || !text(stage.question) ||
        !["name", "free", "confirm"].includes(String(stage.input)) ||
        !Array.isArray(stage.messages) || !stage.messages.length || !stage.messages.every(text) ||
        !Array.isArray(stage.sourceGroups) || !stage.sourceGroups.every(text)) throw new Error("Invalid stage");
    if (stage.choices !== undefined && (!Array.isArray(stage.choices) || stage.choices.length > 4 || !stage.choices.every(c => record(c) && text(c.label) && text(c.acknowledgement)))) throw new Error("Invalid choices");
  }
  if (new Set(value.stages.map(s => s.id)).size !== 9) throw new Error("Duplicate stage");
  const offer = value.offer;
  if (typeof offer.approved !== "boolean" || !(offer.checkoutUrl === null || validCheckout(offer.checkoutUrl)) ||
      !(offer.priceLabel === null || text(offer.priceLabel)) ||
      (offer.approved && (!validCheckout(offer.checkoutUrl) || !text(offer.priceLabel)))) throw new Error("Invalid or incomplete offer");
  for (const intent of intents.filter(i => i !== "answer" && i !== "buy")) {
    if (!text(value.replies[intent])) throw new Error(`Missing reply: ${intent}`);
  }
  return value as unknown as Config;
}

export function initialState(config: Config): State {
  return { product: "cinna-shield", version: config.version, stageIndex: 0, revision: 0, status: "active", checkoutSent: false, processedEventIds: [] };
}
export function validateState(value: unknown, config: Config): asserts value is State {
  if (record(value) && value.answers !== undefined && (!record(value.answers) || Object.entries(value.answers).some(([key, answer]) => !answerFields.includes(key as AnswerField) || !text(answer) || answer.length > 240))) throw new Error("Invalid conversation answers");
  if (!record(value) || value.product !== config.product || value.version !== config.version ||
      !Number.isInteger(value.stageIndex) || Number(value.stageIndex) < 0 || Number(value.stageIndex) >= config.stages.length ||
      !Number.isInteger(value.revision) || Number(value.revision) < 0 || typeof value.checkoutSent !== "boolean" ||
      (value.awaitingProductConsent !== undefined && typeof value.awaitingProductConsent !== "boolean") ||
      (value.awaitingPurchaseLink !== undefined && typeof value.awaitingPurchaseLink !== "boolean") ||
      !["active", "stopped", "human", "complete"].includes(String(value.status)) ||
      !Array.isArray(value.processedEventIds) || value.processedEventIds.length > 1000 || !value.processedEventIds.every(text)) throw new Error("Invalid or incompatible state");
}

export function detectIntent(message: string, stage: Stage): Intent | null {
  const m = message.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(unsubscribe|stop messaging|stop sending|leave me alone|opt out|nao me mande|pare de|cancelar mensagens)\b/.test(m) || /^(stop|parar|pare|cancel|sair)[.! ]*$/.test(m)) return "stop";
  if (/\b(human|real person|agent|atendente|humano|pessoa real)\b/.test(m)) return "human";
  if (/\b(medication|medicine|insulin|metformin|diagnos\w*|cure|treat\w*|pregnan\w*|diabet\w*|medicamento|remedio|gravida|insulina|metformina|blood sugar|glicemia)\b/.test(m)) return "medical";
  if (/\b(too expensive|expensive|can't afford|cannot afford|budget|caro|sem dinheiro)\b/.test(m)) return "budget";
  if (/\b(think about it|sleep on it|maybe later|not ready|not now|pensar|depois)\b/.test(m)) return "timing";
  if (stage.capture === "previousExperience" && /^(?:no|nope|never|no,? (?:i haven't|i have not|never)|i (?:haven't|have not|have never|never) tried (?:a |any )?supplements?)(?: before)?[.! ]*$/i.test(m)) return "answer";
  if (stage.capture === "previousExperience" && !m.includes("?") && !/\b(don'?t|do not|no thanks|not interested|buy|purchase|checkout|order|link)\b/.test(m) && /^(?:i |i've |i have )(?:tried|used)\b/.test(m)) return "answer";
  if (stage.capture === "goal" && /^(?:understanding (?:the )?ingredients|the ingredients|ingredients|keeping things simple|a simple routine)[.! ]*$/.test(m)) return "answer";
  if (stage.capture === "objection" && /^(?:i (?:don't|do not) trust (?:it|this|the seller)|trust)[.! ]*$/.test(m)) return "trust";
  if (/\b(don'?t|do not|not ready|not now|no thanks|nao quero|nao vou|not interested|maybe later)\b/.test(m) || /^(no|nope|nah|nao)[.! ]*$/.test(m)) return "question";
  if (/\b(price|cost|how much|preco|quanto custa|expensive|caro)\b/.test(m)) return "price";
  if (/\b(buy|purchase|checkout|order now|send.{0,10}link|comprar|manda.{0,10}link|quero o link)\b/.test(m)) return "buy";
  if (/\b(scam|trust|proof|reviews?|legit|golpe|prova|confiar|depoimento)\b/.test(m)) return "trust";
  if (/\b(shipping|delivery|frete|entrega|ship)\b/.test(m)) return "shipping";
  if (/\b(ingredients?|formula|cinnamon|composition|ingredientes|composicao)\b/.test(m)) return "ingredients";
  if (stage.capture && stage.input === "free" && /^(skip|prefer not to say|pular|prefiro nao responder)[.! ]*$/.test(m)) return "answer";
  if (/\?|^(how|what|where|why|can|is|does|do|when|qual|como|quando|posso)\b/.test(m)) return "question";
  if (/^(yes|ok|okay|sure|continue|go on|sim|pode|seguir|vamos)[.! ]*$/.test(m)) return "answer";
  if (stage.id === "close" && /^(finish here|finish|all done|terminar|encerrar)[.! ]*$/.test(m)) return "answer";
  if (stage.input === "name" && /^(?:my name is|me chamo) [\p{L}][\p{L}'-]*(?: [\p{L}][\p{L}'-]*){0,2}$/iu.test(message.trim()) && message.trim().length < 60) return "answer";
  return null;
}

/** AI can choose only an intent; it cannot produce claims, prices, URLs or move a cursor. */
export async function decide(config: Config, input: Input, classify?: Classifier): Promise<Decision> {
  if (!text(input.eventId) || input.eventId.length > 180 || typeof input.message !== "string" || input.message.length > 2000) throw new Error("Invalid message/event");
  const previous = input.state ?? initialState(config);
  validateState(previous, config);
  const state: State = { ...previous, ...(previous.answers ? { answers: { ...previous.answers } } : {}), processedEventIds: [...previous.processedEventIds] };
  const stage = config.stages[state.stageIndex];
  const base = { state, stageId: stage.id };
  if (state.processedEventIds.includes(input.eventId) || state.status !== "active") return { ...base, messages: [], action: "ignored", intent: "question", source: "rules" };
  if (state.processedEventIds.length >= 1000) throw new Error("Session event limit reached");
  state.processedEventIds.push(input.eventId);
  state.revision++;
  if (config.consultative) { state.awaitingProductConsent = false; state.awaitingPurchaseLink = false; }
  const emitStage = (s: Stage) => [...s.messages, s.question];
  if (!input.message.trim()) {
    if (previous.revision !== 0) throw new Error("Empty message");
    if (config.consultative && stage.id === "awareness" && stage.input === "confirm") state.awaitingProductConsent = true;
    if (config.consultative && stage.id === "close") state.awaitingPurchaseLink = true;
    return { ...base, messages: emitStage(stage), action: "start", intent: "start", source: "script", choices: stage.choices?.map(c => c.label) };
  }
  const normalized = input.message.trim().toLowerCase();
  if (config.consultative && detectIntent(input.message, stage) !== "stop") {
    const emergency = /\b(emergency|emergencia|ketoacidosis|cetoacidose|cannot breathe|can'?t breathe|trouble breathing|chest pain|passed out|unconscious|falta de ar|dor no peito|desmai\w*)\b/i.test(normalized) ||
      (/\b(vomit\w*)\b/i.test(normalized) && /\b(fruity|breath|confus\w*|halito|respir\w*)\b/i.test(normalized));
    const personalMedical = /\b(safe for me|suitable for me)\b/i.test(normalized) ||
      /\b(can i|should i|is it safe|posso|devo).{0,100}\b(insulin|metformin|medicat\w*|insulina|medicamento)\b/i.test(normalized) ||
      /\b(can i|should i|posso|devo).{0,60}\b(take|use|mix|stop|change|tomar|usar|misturar|parar)\s+(?:(?:this|the|a|este|esse|o)\s+)?(supplement|product|suplemento|produto)\b/i.test(normalized) ||
      /\b(what dose|how much.{0,20}(take|insulin)|diagnose me|do i have diabetes|am i diabetic|qual dose|tenho diabetes\?)\b/i.test(normalized) ||
      (/\b(insulin|metformin|medicat\w*|pregnan\w*|prescription)\b/i.test(normalized) && /\b(compatible|compatibility|interact\w*|safe|stop|replace|adjust|increase|decrease)\b/i.test(normalized));
    if (emergency || personalMedical) {
      state.status = "human";
      return { ...base, messages: [emergency ? "I'm sorry you're dealing with this. I can't assess an emergency here. Please contact local emergency services or seek urgent medical care now. I've paused this automated conversation." : config.replies.medical], action: "human", intent: "medical", source: "rules" };
    }
    if (/\b(are you (an? )?(ai|bot|human|doctor|nurse|real person)|who are you|are you artificial intelligence)\b/i.test(normalized)) {
      return { ...base, messages: ["I'm Ana, a virtual support assistant, not a doctor or nurse. I can listen and share general information, and I can pause this chat if you'd prefer a person."], action: "hold", intent: "question", source: "rules" };
    }
  }
  const choice = stage.choices?.find(c => c.label.toLowerCase() === input.message.trim().toLowerCase());
  let intent = detectIntent(input.message, stage);
  if (choice && (intent === null || intent === "question")) intent = "answer";
  const permissionStep = Boolean(config.consultative && stage.id === "awareness" && stage.input === "confirm");
  const explicitPermission = /^(?:yes[,! ]*)?(?:(?:can|could|would) you )?(?:please )?(?:tell me about|explain|show me|i want to (?:know|learn) about) (?:the |this |your )?(?:product|supplement)[.!? ]*$/i.test(normalized);
  if (config.consultative && stage.id === "connection" && explicitPermission) intent = "answer";
  const affirmative = /^(yes|yes please|sure|ok|okay|please do|go ahead|continue|sim|pode|pode sim)[.! ]*$/i.test(normalized);
  if (config.consultative && stage.id === "close" && /^(yes|yes please|sure|sim|pode sim)[.! ]*$/i.test(normalized)) {
    if (!previous.awaitingPurchaseLink) {
      state.awaitingPurchaseLink = true;
      return { ...base, messages: [stage.question], action: "hold", intent: "question", source: "rules", permissionPrompt: true };
    }
    intent = "buy";
  }
  if (config.consultative && stage.id === "decision" && /^(no|none|nothing else|no more questions|nao|não)[.! ]*$/i.test(normalized)) intent = "answer";
  if (permissionStep && affirmative && !previous.awaitingProductConsent) {
    state.awaitingProductConsent = true;
    return { ...base, messages: [stage.question], action: "hold", intent: "question", source: "rules", permissionPrompt: true, choices: stage.choices?.map(c => c.label) };
  }
  if (permissionStep) intent = explicitPermission || (affirmative && previous.awaitingProductConsent) ? "answer" : (intent === "answer" || intent === "buy" || intent === null ? "question" : intent);
  if (config.consultative && intent === "buy" && state.stageIndex <= config.stages.findIndex(s => s.id === "awareness")) intent = "question";
  if (config.consultative && intent === "medical") intent = "question";
  if (config.consultative && /\b(worried|scared|anxious|diabet\w*|blood sugar|glucose)\b/i.test(normalized) && intent !== "stop" && intent !== "human") intent = "question";
  let source: Decision["source"] = "rules";
  let warning: string | undefined;
  if ((intent === null || intent === "question") && classify) {
    try {
      // Once recognized as a question/refusal, AI cannot turn it into an answer or a sale.
      const allowedIntents = intent === "question" || (config.consultative && stage.input === "confirm") ? intents.filter(i => i !== "answer" && i !== "buy") : intents;
      const result = await classify({ message: input.message, question: stage.question, allowedIntents });
      if (!record(result) || Object.keys(result).some(k => k !== "intent") || !allowedIntents.includes(result.intent as Intent)) throw new Error("Invalid AI classification");
      intent = result.intent as Intent;
      source = "ai";
    } catch { warning = "AI unavailable or invalid output; question preserved."; source = "fallback"; }
  }
  if (intent === null) { intent = "question"; source = "fallback"; warning ??= "No AI classification; use an explicit answer or continue."; }
  if (config.consultative && intent === "buy" && state.stageIndex <= config.stages.findIndex(s => s.id === "awareness")) intent = "question";
  if (intent === "stop" || intent === "human") {
    state.status = intent === "stop" ? "stopped" : "human";
    return { ...base, messages: [config.replies[intent]], action: intent, intent, source, warning };
  }
  // A volunteered concern is the user's own account, not a clinical finding. A hold still answers it first.
  if (stage.capture === "concern" && intent === "question" && !/[?]/.test(input.message) &&
      /^(?:i (?:feel|have|struggle|am worried)|i'm (?:worried|scared|struggling)|my (?:main|biggest) (?:concern|problem))\b/i.test(input.message.trim())) {
    state.answers = { ...state.answers, concern: input.message.replace(/[\p{Cc}\p{Cf}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 240) };
  }
  // A declared objection can be remembered even while its FAQ keeps the cursor on this stage.
  if (stage.capture === "objection" && ["budget", "price", "trust", "timing", "ingredients", "shipping"].includes(intent) && !input.message.includes("?")) {
    state.answers = { ...state.answers, objection: input.message.replace(/[\p{Cc}\p{Cf}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 240) };
  }
  if (intent === "buy") {
    if (!config.offer.approved || !validCheckout(config.offer.checkoutUrl)) {
      state.status = "human";
      return { ...base, messages: ["The checkout and current offer still need to be confirmed. I've paused the automated conversation so our team can check them with you."], action: "human", intent, source, warning: "Checkout disabled: approved offer required. No operator notification is sent by the local simulator." };
    }
    state.checkoutSent = true;
    state.status = "complete";
    return { ...base, messages: [`Here is the approved offer: ${config.offer.priceLabel}.`, config.offer.checkoutUrl], action: "checkout", intent, source, warning };
  }
  if (intent === "answer") {
    // Only answers to an explicitly configured question are retained. Never infer a diagnosis.
    if (stage.capture && (!/^(yes|no|ok|okay|sure|continue|go on|skip|prefer not to say|pular|prefiro n[aã]o responder|sim|n[aã]o|pode|seguir)[.! ]*$/i.test(normalized) || (stage.capture === "previousExperience" && /^no[.! ]*$/i.test(normalized)))) {
      const answer = input.message.replace(/[\p{Cc}\p{Cf}<>]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 240);
      if (answer) state.answers = { ...state.answers, [stage.capture]: answer };
      const name = input.message.match(/\b(?:my name is|me chamo|I'm called)\s+([\p{L}][\p{L}'-]{0,39})\b/iu)?.[1];
      if (name) state.answers = { ...state.answers, name };
    }
    if (state.stageIndex === config.stages.length - 1) {
      state.status = "complete";
      return { ...base, messages: ["Thanks for taking a look. If you want to order later, our team can help confirm the current offer."], action: "complete", intent, source, warning };
    }
    state.stageIndex++;
    const next = config.stages[state.stageIndex];
    if (config.consultative && next.id === "awareness" && next.input === "confirm") state.awaitingProductConsent = true;
    if (config.consultative && next.id === "close") state.awaitingPurchaseLink = true;
    return { state, stageId: next.id, messages: [...(choice ? [choice.acknowledgement] : []), ...emitStage(next)], action: "advance", intent, source, warning, choices: next.choices?.map(c => c.label) };
  }
  const reply = intent === "price" && config.offer.approved ? `The approved offer is ${config.offer.priceLabel}.` : config.replies[intent];
  const pauseWithoutPrompt = Boolean(config.consultative) || intent === "budget" || intent === "timing" || intent === "medical";
  return { ...base, messages: pauseWithoutPrompt ? [reply] : [reply, stage.question], action: "hold", intent, source, warning, choices: pauseWithoutPrompt ? [] : stage.choices?.map(c => c.label) };
}
