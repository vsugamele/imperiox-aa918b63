export type MemoflowAngle = "lithium" | "ikaria" | "anti_scam" | "caregiver" | "stress" | "unknown";
export type MemoflowPain = "word_recall" | "repeating" | "misplacing" | "brain_fog" | "aging_worry" | "caregiver_worry" | "unknown";
export type MemoflowObjection = "price" | "trust" | "safety" | "proof" | "scam" | "family" | "timing" | "none";
export type MemoflowTemperature = "cold" | "curious" | "warm" | "hot";
export type MemoflowResolution = "continue" | "safe_pause" | "checkout" | "followup";
export type MemoflowStage =
  | "open"
  | "why_clicked"
  | "mirror"
  | "mechanism"
  | "proof"
  | "crm"
  | "offer"
  | "checkout"
  | "followup"
  | "safe_pause";

export interface MemoflowCrmState {
  first_name?: string | null;
  email?: string | null;
  phone?: string | null;
  channel_id?: string | null;
  consent?: "implicit_channel" | "explicit_email" | "explicit_sms" | "none";
  capture_stage?: "none" | "soft_identity" | "checkout_recovery" | "followup";
}

export interface MemoflowX1State {
  product: "memoflow";
  funnel: "memoflow_x1";
  stage: MemoflowStage;
  entry_angle: MemoflowAngle;
  buyer: "self" | "parent" | "spouse" | "research" | "unknown";
  pain: MemoflowPain;
  medical_flag: "none" | "medication" | "diagnosis" | "alzheimers_dementia" | "unsure";
  temperature: MemoflowTemperature;
  objection: MemoflowObjection;
  script_anchor: MemoflowStage;
  checkout_sent: boolean;
  checkout_send_count: number;
  auto_resolution: MemoflowResolution;
  score: number;
  crm: MemoflowCrmState;
}

export interface MemoflowX1Input {
  message: string;
  state?: Partial<MemoflowX1State> | null;
  channel?: "instagram" | "messenger" | "whatsapp" | "webchat" | "site";
  checkout_url?: string | null;
  ad_angle?: MemoflowAngle | null;
  lead_name?: string | null;
}

export interface MemoflowX1Decision {
  reply: string;
  state: MemoflowX1State;
  events: Array<{ name: string; data: Record<string, unknown> }>;
  crm_patch: Record<string, unknown>;
  followup: null | { delay_minutes: number; message: string; reason: string };
  action: MemoflowResolution;
  compliance: { safe: boolean; reason: string | null };
  debug: {
    detected: {
      angle: MemoflowAngle;
      pain: MemoflowPain;
      objection: MemoflowObjection;
      temperature: MemoflowTemperature;
      medical_flag: MemoflowX1State["medical_flag"];
      buyer: MemoflowX1State["buyer"];
    };
    selected_block: string;
  };
}

const DEFAULT_CHECKOUT = "https://memopryl.com/cc2/pay/checkout.php?package=3bottles&campaignkey=pg-cyb";

export function defaultMemoflowState(): MemoflowX1State {
  return {
    product: "memoflow",
    funnel: "memoflow_x1",
    stage: "open",
    entry_angle: "unknown",
    buyer: "unknown",
    pain: "unknown",
    medical_flag: "none",
    temperature: "curious",
    objection: "none",
    script_anchor: "open",
    checkout_sent: false,
    checkout_send_count: 0,
    auto_resolution: "continue",
    score: 0,
    crm: { consent: "none", capture_stage: "none" },
  };
}

function normalizeState(input?: Partial<MemoflowX1State> | null): MemoflowX1State {
  const base = defaultMemoflowState();
  return {
    ...base,
    ...(input || {}),
    product: "memoflow",
    funnel: "memoflow_x1",
    crm: { ...base.crm, ...(input?.crm || {}) },
    checkout_send_count: Number(input?.checkout_send_count || 0),
    score: Number(input?.score || 0),
  };
}

function has(text: string, patterns: RegExp[]) {
  return patterns.some((re) => re.test(text));
}

function detectBuyer(text: string): MemoflowX1State["buyer"] {
  if (has(text, [/\b(mae|mãe|pai|mother|mom|dad|father|parents?)\b/i])) return "parent";
  if (has(text, [/\b(espos[ao]|marido|mulher|husband|wife|spouse)\b/i])) return "spouse";
  if (has(text, [/\b(eu|meu caso|pra mim|para mim|for me|myself)\b/i])) return "self";
  if (has(text, [/\b(curios|pesquis|entender|research|just checking)\b/i])) return "research";
  return "unknown";
}

function detectAngle(text: string, explicit?: MemoflowAngle | null): MemoflowAngle {
  if (explicit && explicit !== "unknown") return explicit;
  if (has(text, [/\b(lithium|litio|lítio|mineral|harvard|research|pesquisa|nature)\b/i])) return "lithium";
  if (has(text, [/\b(ikaria|icaria|grega|greek|honey|mel|blue zone|ilha)\b/i])) return "ikaria";
  if (has(text, [/\b(golpe|scam|fake|bill gates|dr\.?\s*oz|celebridade|celebrity)\b/i])) return "anti_scam";
  if (has(text, [/\b(mae|mãe|pai|mother|father|familia|família|cuidador|caregiver)\b/i])) return "caregiver";
  if (has(text, [/\b(stress|estresse|cortisol|brain fog|névoa|nevoa|cansaco|cansaço)\b/i])) return "stress";
  return "unknown";
}

function detectPain(text: string): MemoflowPain {
  if (has(text, [/\b(nome|nomes|palavra|palavras|words?|names?|branco)\b/i])) return "word_recall";
  if (has(text, [/\b(repete|repetindo|mesma coisa|same thing|same story|repeat)\b/i])) return "repeating";
  if (has(text, [/\b(chave|carteira|oculos|óculos|perco|perde|misplace|lost)\b/i])) return "misplacing";
  if (has(text, [/\b(brain fog|nevoa|névoa|confuso|confusa|cansaco|cansaço)\b/i])) return "brain_fog";
  if (has(text, [/\b(envelhec|idade|aging|old|velh)\b/i])) return "aging_worry";
  if (has(text, [/\b(mae|mãe|pai|familia|família|mother|father|parents?)\b/i])) return "caregiver_worry";
  return "unknown";
}

function detectMedicalFlag(text: string): MemoflowX1State["medical_flag"] {
  if (has(text, [/\b(alzheimer|dementia|demencia|demência)\b/i])) return "alzheimers_dementia";
  if (has(text, [/\b(remedio|remédio|medica[cç][aã]o|medication|prescription|tarja|statin|press[aã]o)\b/i])) return "medication";
  if (has(text, [/\b(diagn[oó]stico|diagnosed|doctor said|m[eé]dico falou|laudo)\b/i])) return "diagnosis";
  if (has(text, [/\b(n[aã]o sei|not sure|talvez)\b/i])) return "unsure";
  return "none";
}

function detectObjection(text: string): MemoflowObjection {
  if (has(text, [/\b(caro|pre[cç]o|valor|expensive|price|cost)\b/i])) return "price";
  if (has(text, [/\b(golpe|scam|fake|confiar|trust|legit)\b/i])) return "scam";
  if (has(text, [/\b(seguro|safety|risco|efeito|colateral|side effect)\b/i])) return "safety";
  if (has(text, [/\b(prova|funciona|work|evidence|estudo|study)\b/i])) return "proof";
  if (has(text, [/\b(familia|família|filha|filho|esposa|marido|ask|perguntar)\b/i])) return "family";
  if (has(text, [/\b(depois|later|amanh[aã]|agora n[aã]o|not now)\b/i])) return "timing";
  return "none";
}

function detectTemperature(text: string, objection: MemoflowObjection): MemoflowTemperature {
  if (has(text, [/\b(manda|envia|link|checkout|comprar|compr(o|ar)|pagar|quero|fechado|send.*link|buy|order)\b/i])) return "hot";
  if (objection !== "none") return "warm";
  if (has(text, [/\b(entendi|faz sentido|ok|sim|yes|interessante)\b/i])) return "warm";
  if (has(text, [/\b(n[aã]o quero|no thanks|stop|para|encerrar)\b/i])) return "cold";
  return "curious";
}

function scoreDelta(input: {
  pain: MemoflowPain;
  temperature: MemoflowTemperature;
  objection: MemoflowObjection;
  medical: MemoflowX1State["medical_flag"];
  crm: Partial<MemoflowCrmState>;
}) {
  let score = 0;
  if (input.pain !== "unknown") score += 2;
  if (input.temperature === "hot") score += 4;
  if (input.temperature === "warm") score += 2;
  if (["proof", "trust", "scam", "price", "safety"].includes(input.objection)) score += 1;
  if (input.crm.first_name) score += 1;
  if (input.crm.email || input.crm.phone) score += 2;
  if (input.medical !== "none" && input.medical !== "unsure") score -= 3;
  if (input.temperature === "cold") score -= 2;
  return score;
}

function chooseStage(state: MemoflowX1State): MemoflowStage {
  if (state.medical_flag === "medication" || state.medical_flag === "diagnosis" || state.medical_flag === "alzheimers_dementia") return "safe_pause";
  if (state.temperature === "hot") return "checkout";
  if (state.objection === "scam" || state.objection === "proof" || state.objection === "safety") return "proof";
  if (!state.crm.first_name && state.pain !== "unknown" && ["mirror", "mechanism", "proof"].includes(state.stage)) return "crm";
  if (state.pain === "unknown") return "why_clicked";
  if (state.stage === "open" || state.stage === "why_clicked") return "mirror";
  if (state.stage === "mirror") return "mechanism";
  if (state.stage === "mechanism") return "proof";
  if (state.stage === "proof") return "offer";
  return state.stage || "open";
}

function firstNameFromMessage(text: string): string | null {
  const m = text.match(/\b(me chamo|sou|aqui e|aqui é|my name is|i am)\s+([A-Za-zÀ-ÿ]{2,24})\b/i);
  if (!m) return null;
  const name = m[2].trim();
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function contactFromMessage(text: string): Pick<MemoflowCrmState, "email" | "phone" | "consent"> {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || null;
  const phone = text.match(/(?:\+?\d[\s().-]*){10,16}/)?.[0]?.replace(/[^\d+]/g, "") || null;
  return {
    email,
    phone,
    consent: email ? "explicit_email" : phone ? "explicit_sms" : undefined,
  };
}

function contextLabel(state: MemoflowX1State) {
  if (state.buyer === "parent") return "sua mae/pai";
  if (state.buyer === "spouse") return "seu esposo(a)";
  if (state.buyer === "self") return "voce";
  return "esse caso";
}

function painLabel(pain: MemoflowPain) {
  return ({
    word_recall: "nomes ou palavras somem por alguns segundos",
    repeating: "repeticao de conversas ou perguntas",
    misplacing: "objetos comecaram a sumir na rotina",
    brain_fog: "sensacao de nevoa mental",
    aging_worry: "preocupacao com envelhecimento e memoria",
    caregiver_worry: "preocupacao com alguem da familia",
    unknown: "memoria menos confiavel",
  })[pain];
}

function openingByAngle(angle: MemoflowAngle) {
  if (angle === "lithium") return "Vi que voce veio pela parte do mineral ligado a memoria. Antes de eu te mandar qualquer link, voce esta olhando isso por curiosidade ou porque percebeu alguma mudanca?";
  if (angle === "ikaria") return "Voce veio pela historia de Ikaria e do mel, certo? O que mais te chamou atencao: a ilha, a memoria depois dos 60, ou a ideia de um ritual diario?";
  if (angle === "anti_scam") return "Se voce veio desconfiado, eu entendo. Esse nicho tem anuncio demais prometendo coisa que nao deveria prometer. Sua maior duvida e se e real, seguro ou se faz sentido para seu caso?";
  if (angle === "caregiver") return "Quando alguem olha isso para pai ou mae, normalmente nao e por curiosidade. E porque percebeu alguma mudanca e nao quer esperar piorar. O que voce percebeu primeiro?";
  if (angle === "stress") return "Voce veio pela parte de stress/nevoa mental? Me fala uma coisa: isso aparece mais como cansaco mental, esquecimento de palavras ou preocupacao com envelhecimento?";
  return "Antes de eu te mandar qualquer link, me fala uma coisa: o que fez voce parar aqui? Esquecimento seu, preocupacao com alguem da familia, ou duvida se esse produto e real?";
}

function mirrorByPain(state: MemoflowX1State) {
  if (state.pain === "word_recall") return 'O ponto nao e a palavra em si. E aquele segundo de branco que faz voce pensar: "por que isso esta acontecendo comigo?"';
  if (state.pain === "repeating") return "Repetir uma historia ou pergunta mexe porque normalmente alguem de fora percebe antes. Isso deixa a preocupacao mais real.";
  if (state.pain === "misplacing") return "Perder chave, carteira ou oculos uma vez e normal. O que assusta e quando vira padrao e voce comeca a desconfiar da propria rotina.";
  if (state.pain === "caregiver_worry") return "Quando e pai ou mae, a dor e dupla: voce quer ajudar, mas tambem nao quer transformar uma preocupacao em susto ou briga.";
  return `Entendi. Entao a preocupacao central aqui e ${painLabel(state.pain)}. Isso merece uma explicacao limpa, sem promessa exagerada.`;
}

function mechanismByAngle(state: MemoflowX1State) {
  if (state.entry_angle === "lithium") return "O lithium aqui nao deve ser entendido como remedio psiquiatrico. A conversa limpa e sobre dose traco de mineral dentro de uma formula de suporte, nao tratamento medico.";
  if (state.entry_angle === "ikaria") return 'A parte de Ikaria funciona como uma pista de origem. Nao e "mel cura memoria"; e uma formula que usa esse angulo dentro de um ritual diario de suporte.';
  return "O jeito simples de entender o MemoFlow e este: nao e uma capsula generica de memoria. E um ritual sublingual de suporte de memoria, feito para combinar ingredientes claros com uma entrega mais direta pela boca.";
}

function proofByObjection(state: MemoflowX1State) {
  if (state.objection === "scam") return "Eu tambem desconfiaria. A maioria dos anuncios ruins tenta vender por choque. Aqui a decisao tem que ser pela oferta real: ingredientes, rotina, garantia e checkout.";
  if (state.objection === "safety") return "Seguranca vem primeiro. Se existe remedio, diagnostico ou acompanhamento medico, confere com medico/farmaceutico antes. Se nao existe isso, olha ingredientes e garantia com calma antes de decidir.";
  if (state.objection === "proof") return "Justo pedir prova. Nesse nicho, eu nao confiaria em promessa solta. Eu olharia se o mecanismo e claro, se os ingredientes fazem sentido e se a garantia reduz seu risco.";
  return "Eu julgaria por tres coisas: ingredientes claros, promessa limpa e garantia real. Se um desses pontos falha, eu nao compraria.";
}

function buildReply(state: MemoflowX1State, checkoutUrl: string): { reply: string; selected: string; followup: MemoflowX1Decision["followup"] } {
  if (state.stage === "open" || state.stage === "why_clicked") {
    return { reply: openingByAngle(state.entry_angle), selected: `opening.${state.entry_angle}`, followup: null };
  }
  if (state.stage === "safe_pause") {
    const reply = "Nesse caso eu pauso a venda. Se tem remedio, diagnostico ou acompanhamento medico, o certo e conferir a lista de ingredientes com medico ou farmaceutico primeiro. O produto pode ser entendido como suporte de memoria, nao tratamento.";
    return { reply, selected: "safe_pause.medical", followup: null };
  }
  if (state.stage === "mirror") {
    return { reply: `${mirrorByPain(state)}\n\nIsso e para ${contextLabel(state)}?`, selected: `mirror.${state.pain}`, followup: null };
  }
  if (state.stage === "mechanism") {
    return { reply: `${mechanismByAngle(state)}\n\nFaz sentido eu te explicar a logica do teste de 90 dias?`, selected: `mechanism.${state.entry_angle}`, followup: null };
  }
  if (state.stage === "proof") {
    return { reply: `${proofByObjection(state)}\n\nNo seu caso, a duvida maior e confiar na oferta ou entender se o mecanismo faz sentido?`, selected: `proof.${state.objection}`, followup: null };
  }
  if (state.stage === "crm") {
    return { reply: "Para eu nao te responder de forma generica: como posso te chamar?", selected: "crm.first_name", followup: null };
  }
  if (state.stage === "offer") {
    const reply = "Pelo que voce me contou, o caminho mais logico nao e comprar no impulso. E olhar como um teste de 90 dias. O kit de 3 frascos faz mais sentido porque memoria e rotina nao se avaliam em uma semana.";
    return { reply: `${reply}\n\nQuer que eu te mande o checkout certo?`, selected: "offer.90_day_test", followup: null };
  }
  if (state.stage === "checkout") {
    const reply = `Te mando o checkout certo agora:\n${checkoutUrl}\n\nQuando abrir, confere tres coisas: kit selecionado, garantia e dados de envio.`;
    return {
      reply,
      selected: "checkout.send",
      followup: { delay_minutes: 15, reason: "checkout_recovery", message: "Conseguiu abrir o checkout? Confere se apareceu o kit com garantia antes de finalizar." },
    };
  }
  return {
    reply: "Sua duvida ficou mais em preco, seguranca ou se isso faz sentido para o seu caso?",
    selected: "followup.objection_probe",
    followup: null,
  };
}

export function decideMemoflowX1(input: MemoflowX1Input): MemoflowX1Decision {
  const message = String(input.message || "").trim();
  const text = message.toLowerCase();
  const previous = normalizeState(input.state);
  const detected = {
    angle: detectAngle(text, input.ad_angle || previous.entry_angle),
    pain: detectPain(text),
    objection: detectObjection(text),
    medical_flag: detectMedicalFlag(text),
    buyer: detectBuyer(text),
    temperature: "curious" as MemoflowTemperature,
  };
  detected.temperature = detectTemperature(text, detected.objection);

  const extractedName = firstNameFromMessage(message);
  const contact = contactFromMessage(message);
  const crmPatch: Record<string, unknown> = {};
  if (extractedName && !previous.crm.first_name) crmPatch.first_name = extractedName;
  if (contact.email && !previous.crm.email) crmPatch.email = contact.email;
  if (contact.phone && !previous.crm.phone) crmPatch.phone = contact.phone;
  if (contact.consent) crmPatch.consent = contact.consent;

  const state: MemoflowX1State = {
    ...previous,
    entry_angle: detected.angle !== "unknown" ? detected.angle : previous.entry_angle,
    pain: detected.pain !== "unknown" ? detected.pain : previous.pain,
    objection: detected.objection !== "none" ? detected.objection : previous.objection,
    medical_flag: detected.medical_flag !== "none" ? detected.medical_flag : previous.medical_flag,
    buyer: detected.buyer !== "unknown" ? detected.buyer : previous.buyer,
    temperature: detected.temperature,
    crm: {
      ...previous.crm,
      ...crmPatch,
      channel_id: previous.crm.channel_id || null,
      capture_stage: Object.keys(crmPatch).length ? (contact.email || contact.phone ? "checkout_recovery" : "soft_identity") : previous.crm.capture_stage || "none",
    },
    score: Math.max(0, previous.score + scoreDelta({
      pain: detected.pain,
      temperature: detected.temperature,
      objection: detected.objection,
      medical: detected.medical_flag,
      crm: crmPatch,
    })),
  };

  state.stage = chooseStage(state);
  state.script_anchor = state.stage;
  state.auto_resolution = state.stage === "safe_pause" ? "safe_pause" : state.stage === "checkout" ? "checkout" : "continue";
  if (state.stage === "checkout") {
    state.checkout_sent = true;
    state.checkout_send_count = previous.checkout_send_count + 1;
  }

  const checkoutUrl = input.checkout_url || DEFAULT_CHECKOUT;
  const built = buildReply(state, checkoutUrl);
  const events: MemoflowX1Decision["events"] = [
    { name: "LeadIntentDetected", data: { angle: state.entry_angle, temperature: state.temperature } },
  ];
  if (detected.pain !== "unknown") events.push({ name: "PainIdentified", data: { pain: state.pain, buyer: state.buyer } });
  if (Object.keys(crmPatch).length) events.push({ name: contact.email || contact.phone ? "CRMContactCaptured" : "CRMSoftIdentityCaptured", data: crmPatch });
  if (contact.consent) events.push({ name: "ConsentCaptured", data: { consent: contact.consent } });
  if (state.stage === "mechanism") events.push({ name: "MechanismDelivered", data: { angle: state.entry_angle } });
  if (state.stage === "proof") events.push({ name: "ProofDelivered", data: { objection: state.objection } });
  if (state.stage === "safe_pause") events.push({ name: "SafetyFlagged", data: { medical_flag: state.medical_flag } });
  if (state.stage === "checkout") events.push({ name: "CheckoutSent", data: { checkout_send_count: state.checkout_send_count } });

  return {
    reply: built.reply,
    state,
    events,
    crm_patch: crmPatch,
    followup: built.followup,
    action: state.auto_resolution,
    compliance: {
      safe: state.stage !== "safe_pause",
      reason: state.stage === "safe_pause" ? "medical_or_support_risk" : null,
    },
    debug: {
      detected,
      selected_block: built.selected,
    },
  };
}
