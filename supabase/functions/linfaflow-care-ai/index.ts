import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Intake = {
  name?: string;
  concern?: string;
  timeline?: string;
  tried?: string;
  contact?: string;
  age_range?: string;
  swelling_area?: string;
  worst_time?: string;
  triggers?: string;
  impact?: string;
  red_flags?: string;
  meds_or_conditions?: string;
  photo_consent?: boolean;
  contact_consent?: boolean;
};

type ChatMessage = {
  sender?: "assistant" | "lead";
  text?: string;
};

type Attachment = {
  kind?: "image" | "audio";
  name?: string;
  mime?: string;
  data_url?: string;
  transcript?: string;
  storage_path?: string;
};

type LeadTemperature = "cold" | "warm" | "hot" | "red_flag";

const MODEL = "google/gemini-3-flash-preview";
const CHECKOUT_URL = "https://cc.linfaflow.com/dtcnew/checkout.php?hid=b2lkPW9mZl8wMDQyMzQ2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfNjY2ODExMQ%3D%3D&affid=aff_6821377";
const MEDIA_BUCKET = "linfaflow-care-media";
const CARE_OPENFLOW_AUTOMACAO_ID = "2266ddbd-cdd0-41b4-acae-428da8f324f6";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const scriptStages = [
  "intake_summary",
  "situation_pattern",
  "problem_depth",
  "implication",
  "mechanism_reframe",
  "proof_logic",
  "objection",
  "close",
];

function getClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function scoreLead(intake: Intake) {
  const text = `${intake.concern || ""} ${intake.timeline || ""} ${intake.tried || ""} ${intake.worst_time || ""} ${intake.triggers || ""} ${intake.impact || ""}`.toLowerCase();
  let score = 32;
  if (text.includes("heavy") || text.includes("swollen") || text.includes("marks")) score += 22;
  if (text.includes("month") || text.includes("year")) score += 12;
  if (text.includes("compression") || text.includes("drainage") || text.includes("elevation")) score += 18;
  if (text.includes("standing") || text.includes("evening") || text.includes("travel") || text.includes("heat")) score += 8;
  if ((intake.contact || "").trim()) score += 8;
  return Math.min(score, 94);
}

function hasRedFlagSignal(intake: Intake) {
  const redFlags = String(intake.red_flags || "").toLowerCase();
  const meds = String(intake.meds_or_conditions || "").toLowerCase();
  const redFlagsDenied = /\b(no|none|without|not|never)\b/.test(redFlags);
  const medsDenied = /\b(no|none|without|not|never)\b/.test(meds);
  const hasSymptomFlag = !redFlagsDenied && /(sudden|one-sided|chest|severe|wound|red|hot|pregnan|pain|does not improve)/i.test(redFlags);
  const hasMedicalContext = !medsDenied && /(medication|diagnosed|heart|kidney|blood thinner|diuretic|pregnan)/i.test(meds);
  return hasSymptomFlag || hasMedicalContext;
}

function leadTemperature(intake: Intake, score: number): LeadTemperature {
  if (hasRedFlagSignal(intake)) return "red_flag";
  if (score >= 80) return "hot";
  if (score >= 62) return "warm";
  return "cold";
}

function normalizeTags(tags: Array<string | null | undefined>) {
  return Array.from(new Set(tags.map((tag) => String(tag || "").trim()).filter(Boolean)));
}

function contactIdentity(contact?: string) {
  const raw = String(contact || "").trim();
  const email = raw.includes("@") ? raw.toLowerCase() : "";
  const phoneDigits = raw.replace(/\D/g, "");
  const phone = !email && phoneDigits.length >= 8 ? phoneDigits : "";
  return { raw, email, phone };
}

function stageTags(stage: string, temperature: LeadTemperature, scriptStep: number) {
  const tags = ["linfaflow-care", `linfaflow-care-stage-${stage}`, `linfaflow-care-${temperature}`];
  if (scriptStep >= 5) tags.push("linfaflow-care-objection-or-proof");
  if (stage === "offer") tags.push("linfaflow-care-offer-seen");
  if (stage === "offer" && temperature === "hot") tags.push("linfaflow-care-high-intent-no-purchase");
  if (temperature === "hot") tags.push("linfaflow-care-high-intent");
  if (temperature === "red_flag") tags.push("linfaflow-care-safety-review");
  return tags;
}

function intakeText(intake: Intake, latest = "") {
  return `${intake.name || ""} ${intake.concern || ""} ${intake.timeline || ""} ${intake.tried || ""} ${intake.age_range || ""} ${intake.swelling_area || ""} ${intake.worst_time || ""} ${intake.triggers || ""} ${intake.impact || ""} ${intake.red_flags || ""} ${intake.meds_or_conditions || ""} ${latest}`.toLowerCase();
}

type PersuasionProfile = {
  avatar: string;
  avatar_reason: string;
  awareness: string;
  likely_objection: string;
  emotional_mirror: string;
  mechanism_bridge: string;
  proof_asset: string;
  close_frame: string;
  next_question: string;
  voice_cache_key: string;
};

function buildPersuasionProfile(intake: Intake, latest = "", scriptStep = 0, canClose = false): PersuasionProfile {
  const text = intakeText(intake, latest);
  const triedExternal = /(compression|sock|stocking|massage|drainage|elevation|elevate|cream|gel|dry brush|gua sha)/i.test(text);
  const standing = /(stand|standing|teacher|nurse|salon|hair|retail|shift|work all day|on my feet)/i.test(text);
  const normalTests = /(normal test|normal labs|doctor said|nothing wrong|bloodwork|exam|checked and)/i.test(text);
  const photoShame = /(photo|picture|mirror|shoes|rings|clothes|pants|dress|hide|embarrass|confidence|avoid)/i.test(text);
  const bloating = /(bloat|belly|puffy face|face|morning puff|water weight)/i.test(text);
  const skepticism = /(skeptic|scam|tried everything|supplement|does it work|work for me|waste|believe|proof)/i.test(text);
  const safety = hasRedFlagSignal(intake);

  let avatar = "mysterious_swelling";
  let avatarReason = "The lead describes a repeated pattern but has not named a clear cause yet.";
  let emotionalMirror = "You are not asking for hype. You are trying to understand why the same pattern keeps coming back after normal daily life.";
  let closeFrame = "A simple 30-day internal-support routine test, not a miracle promise.";

  if (safety) {
    avatar = "safety_review";
    avatarReason = "The intake includes a possible medical/safety context.";
    emotionalMirror = "The careful next step is not a product decision first. It is making sure nothing urgent or medical is being missed.";
    closeFrame = "Pause sales and encourage qualified medical review.";
  } else if (normalTests) {
    avatar = "normal_tests_invisible";
    avatarReason = "She may feel dismissed because tests or conversations did not explain what she feels.";
    emotionalMirror = "Normal tests can make you feel like you have to prove what your body is already showing you by the end of the day.";
    closeFrame = "Validate her lived pattern, then explain daily drainage support without claiming diagnosis.";
  } else if (standing) {
    avatar = "standing_all_day";
    avatarReason = "Her trigger is being on her feet or unable to rest during the day.";
    emotionalMirror = "You cannot build a routine that depends on lying down when your day does not let you stop.";
    closeFrame = "A 30-second daily ritual that does not require stopping the workday.";
  } else if (triedExternal) {
    avatar = "external_fix_prisoner";
    avatarReason = "She already tried outside-in fixes and needs the internal-vs-external contrast.";
    emotionalMirror = "The frustrating part is not that compression or elevation never help. It is that the same pattern can come back when real life starts again.";
    closeFrame = "Not another outside-in fix; a daily inside-support ritual.";
  } else if (photoShame) {
    avatar = "body_confidence_withdrawal";
    avatarReason = "The impact is identity, photos, clothes, shoes, or hiding.";
    emotionalMirror = "This often shows up slowly: different shoes, different clothes, fewer photos, and calling it a phase because explaining it feels exhausting.";
    closeFrame = "A practical 30-day step toward feeling more comfortable in her body.";
  } else if (bloating) {
    avatar = "silent_bloating";
    avatarReason = "The lead describes bloating or puffiness rather than only ankles/legs.";
    emotionalMirror = "It is especially frustrating when you change food, water, or salt and still feel puffy at the wrong time.";
    closeFrame = "Connect puffiness and heaviness as a systemic daily drainage-support conversation.";
  }

  let likelyObjection = "fit";
  if (safety) likelyObjection = "safety";
  else if (skepticism || triedExternal) likelyObjection = "skepticism";
  else if (/(price|cost|expensive|money|afford)/i.test(text)) likelyObjection = "price";
  else if (/(ingredient|natural|side effect|medication|medicine|doctor)/i.test(text)) likelyObjection = "ingredients_safety";
  else if (/(how to take|dosage|use|routine|drop|ml)/i.test(text)) likelyObjection = "usage";

  const awareness = canClose || scriptStep >= 7
    ? "product_aware"
    : triedExternal || skepticism
      ? "solution_aware"
      : normalTests || photoShame || standing
        ? "problem_aware"
        : "early_problem_aware";

  const mechanismBridge = triedExternal
    ? "Compare outside-in relief with inside-support consistency. Compression, elevation and massage can help temporarily; LinfaFlow is framed as daily support from within."
    : "Connect repeated puffiness/heaviness/tightness to a sluggish internal drainage pattern, then introduce LinfaFlow as a liquid daily support routine.";

  const proofAsset = likelyObjection === "usage"
    ? "Use the 1 mL twice-daily, 30-day ritual explanation."
    : likelyObjection === "ingredients_safety"
      ? "Use Cleavers-led ingredient explanation plus doctor/pharmacist boundary."
      : likelyObjection === "skepticism"
        ? "Use the outside-vs-inside contrast and the 30-day routine-test frame."
        : "Use self-verifiable situational triggers: standing, sitting, travel, heat, salty food, sleep disruption.";

  const nextQuestion = canClose
    ? "Ask for the decision only after summarizing why it fits."
    : likelyObjection === "safety"
      ? "Ask whether symptoms are sudden, one-sided, painful, hot/red, chest-related, pregnancy-related, medication-related, or diagnosed-condition-related."
      : likelyObjection === "skepticism"
        ? "Ask what would make her feel comfortable trying a simple 30-day routine: proof, ingredients, usage, or fit."
        : "Ask when the pattern is worst and what it changes in her daily life.";

  const voiceCacheKey = likelyObjection === "skepticism"
    ? "linfaflow-objection-skepticism-v1"
    : likelyObjection === "usage"
      ? "linfaflow-usage-1ml-2x-daily-v1"
      : likelyObjection === "ingredients_safety"
        ? "linfaflow-ingredients-cleavers-safety-v1"
        : triedExternal
          ? "linfaflow-proof-outside-in-v1"
          : "linfaflow-mechanism-cleavers-v1";

  return {
    avatar,
    avatar_reason: avatarReason,
    awareness,
    likely_objection: likelyObjection,
    emotional_mirror: emotionalMirror,
    mechanism_bridge: mechanismBridge,
    proof_asset: proofAsset,
    close_frame: closeFrame,
    next_question: nextQuestion,
    voice_cache_key: voiceCacheKey,
  };
}

async function syncCareLead(params: {
  intake: Intake;
  score: number;
  temperature: LeadTemperature;
  stage: string;
  scriptStep: number;
  sessionId?: string | null;
  persuasionProfile?: PersuasionProfile;
}) {
  const supabase = getClient();
  if (!supabase) return null;

  const name = String(params.intake.name || "").trim();
  const identity = contactIdentity(params.intake.contact);
  if (!params.intake.contact_consent || (!identity.email && !identity.phone)) return null;

  const basePayload = {
    linfaflow_care: {
      session_id: params.sessionId || null,
      automacao_id: CARE_OPENFLOW_AUTOMACAO_ID,
      stage: params.stage,
      script_step: params.scriptStep,
      temperature: params.temperature,
      score: params.score,
      intake: params.intake,
      persuasion_profile: params.persuasionProfile || buildPersuasionProfile(params.intake, "", params.scriptStep, params.stage === "offer"),
      checkout_url: CHECKOUT_URL,
      updated_at: new Date().toISOString(),
    },
  };

  let existing: any = null;
  if (identity.email) {
    const { data } = await supabase
      .from("imphq_leads")
      .select("id, tags, data, lead_memory")
      .eq("email", identity.email)
      .limit(1)
      .maybeSingle();
    existing = data;
  }
  if (!existing && identity.phone) {
    const { data } = await supabase
      .from("imphq_leads")
      .select("id, tags, data, lead_memory")
      .eq("phone", identity.phone)
      .limit(1)
      .maybeSingle();
    existing = data;
  }

  const tags = stageTags(params.stage, params.temperature, params.scriptStep);
  const profileTags = params.persuasionProfile
    ? [`linfaflow-care-avatar-${params.persuasionProfile.avatar}`, `linfaflow-care-objection-${params.persuasionProfile.likely_objection}`]
    : [];
  const dorPrincipal = params.intake.concern || params.intake.swelling_area || null;
  const objecaoAtual = params.persuasionProfile?.likely_objection || (params.scriptStep >= 5 ? params.intake.tried || "needs proof / fit reassurance" : null);
  const leadMemory = {
    ...(existing?.lead_memory || {}),
    linfaflow_care_profile: basePayload.linfaflow_care,
  };

  if (existing?.id) {
    const mergedTags = normalizeTags([...(existing.tags || []), ...tags, ...profileTags]);
    const { error } = await supabase
      .from("imphq_leads")
      .update({
        nome: name || undefined,
        phone: identity.phone || undefined,
        email: identity.email || undefined,
        plataforma: "linfaflow-care",
        status: params.stage === "offer" ? "oferta" : params.temperature === "red_flag" ? "revisao" : "lead",
        score: params.score,
        tags: mergedTags,
        data: { ...(existing.data || {}), ...basePayload },
        lead_memory: leadMemory,
        ultimo_interesse: "LinfaFlow",
        dor_principal: dorPrincipal,
        objecao_atual: objecaoAtual,
        nivel_qualificacao: params.temperature,
        qualificacao_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw error;
    return existing.id as string;
  }

  const leadId = crypto.randomUUID();
  const { error } = await supabase.from("imphq_leads").insert({
    id: leadId,
    nome: name || identity.email || identity.phone || "LinfaFlow Care Lead",
    email: identity.email || null,
    phone: identity.phone || null,
    project_id: "lipo",
    plataforma: "linfaflow-care",
    status: params.stage === "offer" ? "oferta" : params.temperature === "red_flag" ? "revisao" : "lead",
    score: params.score,
    tags: normalizeTags([...tags, ...profileTags]),
    data: {
      visitor_id: leadId,
      ultimo_evento: "linfaflow_care_session",
      captura_origem: "linfaflow-care",
      capturado_em: new Date().toISOString(),
      ...basePayload,
    },
    lead_memory: leadMemory,
    ultimo_interesse: "LinfaFlow",
    dor_principal: dorPrincipal,
    objecao_atual: objecaoAtual,
    nivel_qualificacao: params.temperature,
    qualificacao_updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return leadId;
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mime: match[1], bytes };
}

async function uploadAttachments(sessionId: string, attachments: Attachment[]) {
  const supabase = getClient();
  if (!supabase || !attachments.length) return attachments;

  await supabase.storage.createBucket(MEDIA_BUCKET, { public: false }).catch(() => null);

  const uploaded: Attachment[] = [];
  for (const attachment of attachments) {
    if (!attachment.data_url) {
      uploaded.push(attachment);
      continue;
    }
    const decoded = decodeDataUrl(attachment.data_url);
    if (!decoded) {
      uploaded.push(attachment);
      continue;
    }
    const safeName = (attachment.name || `${attachment.kind || "file"}`).replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80);
    const path = `${sessionId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, decoded.bytes, {
      contentType: attachment.mime || decoded.mime,
      upsert: false,
    });
    uploaded.push({ ...attachment, storage_path: error ? undefined : path });
  }
  return uploaded;
}

async function upsertSession(params: {
  sessionId?: string | null;
  intake: Intake;
  scriptStep: number;
  stage: string;
  latest: string;
  attachments?: Attachment[];
  persuasionProfile?: PersuasionProfile;
  syncLead?: boolean;
}) {
  const supabase = getClient();
  if (!supabase) return { persisted: false, sessionId: params.sessionId || null, publicToken: null };

  try {
    const score = scoreLead(params.intake);
    const temperature = leadTemperature(params.intake, score);
    const payload = {
      automacao_id: CARE_OPENFLOW_AUTOMACAO_ID,
      name: params.intake.name || null,
      contact: params.intake.contact || null,
      intake: {
        ...params.intake,
        lead_temperature: temperature,
        persuasion_profile: params.persuasionProfile || buildPersuasionProfile(params.intake, params.latest, params.scriptStep, params.stage === "offer"),
      },
      score,
      stage: params.stage || "consult",
      status: temperature === "red_flag" ? "red_flag" : params.stage === "offer" ? "offer" : temperature,
      script_step: params.scriptStep,
      checkout_url: CHECKOUT_URL,
      last_message_at: params.latest ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = params.sessionId
      ? await supabase
          .from("imphq_linfaflow_care_sessions")
          .update(payload)
          .eq("id", params.sessionId)
          .select("id, public_token")
          .maybeSingle()
      : await supabase
          .from("imphq_linfaflow_care_sessions")
          .insert(payload)
          .select("id, public_token")
          .single();

    if (error) throw error;
    const sessionId = data?.id || params.sessionId || null;
    const leadId = params.syncLead === false
      ? null
      : await syncCareLead({
          intake: params.intake,
          score,
          temperature,
          stage: params.stage || "consult",
          scriptStep: params.scriptStep,
          sessionId,
          persuasionProfile: params.persuasionProfile,
        }).catch((error) => {
          console.error("[linfaflow-care-ai] lead sync error", error?.message || error);
          return null;
        });
    if (sessionId && leadId) {
      await supabase
        .from("imphq_linfaflow_care_sessions")
        .update({ lead_id: leadId, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    const storedAttachments = sessionId ? await uploadAttachments(sessionId, params.attachments || []) : [];
    if (sessionId && params.latest) {
      await supabase.from("imphq_linfaflow_care_events").insert({
        session_id: sessionId,
        event_type: "lead_message",
        script_step: params.scriptStep,
        payload: {
          text: params.latest,
          lead_temperature: temperature,
          attachments: storedAttachments.map((attachment) => ({
            kind: attachment.kind,
            name: attachment.name,
            mime: attachment.mime,
            storage_bucket: attachment.storage_path ? MEDIA_BUCKET : undefined,
            storage_path: attachment.storage_path,
            has_image_payload: Boolean(attachment.kind === "image" && attachment.data_url),
            has_transcript: Boolean(attachment.transcript),
            transcript: attachment.transcript,
          })),
        },
      });
    }
    return { persisted: Boolean(sessionId), sessionId, publicToken: data?.public_token || null };
  } catch (error) {
    console.error("[linfaflow-care-ai] persistence error", error);
    return { persisted: false, sessionId: params.sessionId || null, publicToken: null };
  }
}

async function persistCareEvent(sessionId: string | null, eventType: string, scriptStep: number, payload: Record<string, unknown>) {
  const supabase = getClient();
  if (!supabase || !sessionId) return;
  try {
    await supabase.from("imphq_linfaflow_care_events").insert({
      session_id: sessionId,
      event_type: eventType,
      script_step: scriptStep,
      payload,
    });
  } catch (error) {
    console.error("[linfaflow-care-ai] event persistence error", error);
  }
}

async function resumePublicSession(publicToken: string) {
  const supabase = getClient();
  if (!supabase || !publicToken) return null;

  const { data: session, error } = await supabase
    .from("imphq_linfaflow_care_sessions")
    .select("id, public_token, intake, script_step, stage")
    .eq("public_token", publicToken)
    .maybeSingle();
  if (error || !session) return null;

  const { data: events } = await supabase
    .from("imphq_linfaflow_care_events")
    .select("event_type, sender, payload, created_at")
    .eq("session_id", session.id)
    .in("event_type", ["lead_message", "assistant_reply"])
    .order("created_at", { ascending: true })
    .limit(16);

  const messages = (events || [])
    .map((event) => ({
      sender: event.event_type === "lead_message" ? "lead" : "assistant",
      text: String(event.payload?.text || ""),
      source: event.payload?.source || undefined,
    }))
    .filter((message) => message.text);

  return {
    session_id: session.id,
    public_token: session.public_token,
    intake: session.intake || {},
    script_step: session.script_step,
    stage: session.stage,
    messages,
  };
}

async function persistAssistantReply(sessionId: string | null, scriptStep: number, reply: string, source: string) {
  const supabase = getClient();
  if (!supabase || !sessionId) return;
  try {
    await supabase.from("imphq_linfaflow_care_events").insert({
      session_id: sessionId,
      event_type: "assistant_reply",
      script_step: scriptStep,
      payload: { source, text: reply },
    });
  } catch (error) {
    console.error("[linfaflow-care-ai] assistant event error", error);
  }
}

async function trackCheckoutClick(sessionId?: string | null) {
  const supabase = getClient();
  if (!supabase || !sessionId) return { persisted: false };
  try {
    const { data: session } = await supabase
      .from("imphq_linfaflow_care_sessions")
      .select("lead_id, intake")
      .eq("id", sessionId)
      .maybeSingle();
    await supabase
      .from("imphq_linfaflow_care_sessions")
      .update({ status: "checkout_clicked", checkout_clicked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (session?.lead_id) {
      const { data: lead } = await supabase
        .from("imphq_leads")
        .select("tags, data, lead_memory")
        .eq("id", session.lead_id)
        .maybeSingle();
      const tags = normalizeTags([...(lead?.tags || []), "linfaflow-care-checkout-clicked", "linfaflow-care-stage-checkout"]);
      const linfaflowCare = {
        ...((lead?.data || {}).linfaflow_care || {}),
        checkout_clicked_at: new Date().toISOString(),
        stage: "checkout",
      };
      await supabase
        .from("imphq_leads")
        .update({
          status: "checkout",
          tags,
          data: { ...(lead?.data || {}), linfaflow_care: linfaflowCare },
          lead_memory: {
            ...(lead?.lead_memory || {}),
            linfaflow_care_profile: {
              ...((lead?.lead_memory || {}).linfaflow_care_profile || {}),
              checkout_clicked_at: linfaflowCare.checkout_clicked_at,
              stage: "checkout",
            },
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.lead_id);
    }
    await supabase.from("imphq_linfaflow_care_events").insert({
      session_id: sessionId,
      event_type: "checkout_click",
      payload: { checkout_url: CHECKOUT_URL },
    });
    return { persisted: true };
  } catch (error) {
    console.error("[linfaflow-care-ai] checkout click error", error);
    return { persisted: false };
  }
}

function fallbackReply(intake: Intake, latest: string, scriptStep = 0, canClose = false, profile = buildPersuasionProfile(intake, latest, scriptStep, canClose)) {
  const name = intake.name?.trim() || "there";
  const lower = latest.toLowerCase();
  const score = scoreLead(intake);
  const temperature = leadTemperature(intake, score);
  const buyingIntent = lower.includes("price") || lower.includes("order") || lower.includes("buy");
  const noPhoto = lower.includes("no photo") || lower.includes("cannot send") || lower.includes("can't send") || lower.includes("without a photo");
  if (temperature === "red_flag") {
    return `${name}, I want to be careful with this. Because your intake mentions a possible safety factor, I would not treat this as a supplement decision first.\n\nPlease get timely medical guidance before starting any new wellness routine, especially if the swelling is sudden, one-sided, painful, hot/red, connected with chest symptoms, pregnancy, medication, or a diagnosed condition.\n\nIf helpful, I can organize your notes for that conversation: where it shows up, when it is worst, what triggered it, and what changed recently.`;
  }
  if (noPhoto && !canClose) {
    return `No problem. A photo is optional, and your answers are enough to continue the review.\n\nFrom what you shared, I will focus on timing, triggers, sock marks or tight shoes, what you already tried, and what it affects day to day.\n\nQuick check: when it is worst, is it mainly after standing, sitting, travel, heat, salty meals, or does it start when you wake up?`;
  }
  if (buyingIntent && canClose) {
    return `${name}, based on what you shared, I would start with the simplest option: one bottle as a 30-day daily wellness ritual.\n\n${profile.emotional_mirror}\n\nYour assessment summary:\nPattern: ${intake.concern || "repeated heaviness, puffiness, or tightness"}\nTiming/triggers: ${intake.worst_time || "daily timing not specified"}; ${intake.triggers || "triggers not specified"}\nAlready tried: ${intake.tried || "outside-in fixes or general habits"}\nImpact: ${intake.impact || "daily comfort and confidence"}\n\nLinfaFlow is not a diagnosis, cure, medication or water pill. ${profile.mechanism_bridge}\n\nIf you have a diagnosed condition, take medication, are pregnant, or have sudden/severe swelling, review the ingredient list with your doctor or pharmacist first.\n\nSecure checkout: ${CHECKOUT_URL}`;
  }
  if (buyingIntent && !canClose) {
    return `I can show you the checkout, but I do not want to rush you into the wrong decision.\n\n${profile.emotional_mirror}\n\nBefore that, one quick check: ${profile.next_question}`;
  }
  if (scriptStep <= 2) {
    return `That helps, ${name}. ${profile.emotional_mirror}\n\nI want to understand the pattern before recommending anything. When is it worst: morning, evening, after sitting, after standing, heat, or travel?`;
  }
  if (scriptStep <= 4) {
    return `That pattern matters. ${profile.mechanism_bridge}\n\nWhat has this affected most for you: comfort, shoes/clothes, confidence, photos, sleep, or daily plans?`;
  }
  return `That makes sense. ${profile.proof_asset}\n\nLinfaFlow is best framed as a simple daily wellness ritual, not a diagnosis, cure or medication.\n\nBefore I send the checkout, what is your biggest hesitation: price, skepticism, ingredients, or whether it fits your situation?`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const body = await req.json().catch(() => ({}));
    const intake: Intake = body?.intake || {};
    const messages: ChatMessage[] = Array.isArray(body?.messages) ? body.messages.slice(-10) : [];
    const attachments: Attachment[] = Array.isArray(body?.attachments) ? body.attachments.slice(0, 3) : [];
    const latest = String(body?.latest || messages[messages.length - 1]?.text || "");
    const scriptStep = Math.max(0, Math.min(Number(body?.script_step ?? 0), scriptStages.length - 1));
    const score = scoreLead(intake);
    const temperature = leadTemperature(intake, score);
    const canClose = temperature !== "red_flag" && (Boolean(body?.can_close) || scriptStep >= 7);
    const requestedStage = String(body?.stage || (canClose ? "offer" : "consult"));
    const stage = temperature === "red_flag" && requestedStage === "offer" ? "consult" : requestedStage;
    const sessionId = typeof body?.session_id === "string" ? body.session_id : null;
    const persuasionProfile = buildPersuasionProfile(intake, latest, scriptStep, canClose);

    if (body?.action === "resume_session") {
      const resume = await resumePublicSession(String(body?.public_token || ""));
      if (!resume) {
        return new Response(JSON.stringify({ ok: false, error: "Private continuation link not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, ...resume }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body?.action === "checkout_click") {
      const tracked = await trackCheckoutClick(sessionId);
      return new Response(JSON.stringify({
        ok: true,
        action: "checkout_click",
        persisted: tracked.persisted,
        session_id: sessionId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body?.action === "quiz_progress") {
      const quizKey = typeof body?.quiz_key === "string" ? body.quiz_key : "unknown";
      const quizStatus = typeof body?.quiz_status === "string" ? body.quiz_status : "answered";
      const session = await upsertSession({
        sessionId,
        intake,
        scriptStep,
        stage: "quiz",
        latest: "",
        persuasionProfile,
        syncLead: false,
      });
      await persistCareEvent(session.sessionId, `quiz_${quizStatus}`, scriptStep, {
        quiz_key: quizKey,
        quiz_status: quizStatus,
        quiz_total: Number(body?.quiz_total || 0),
      });
      return new Response(JSON.stringify({
        ok: true,
        action: "quiz_progress",
        persisted: session.persisted,
        session_id: session.sessionId,
        public_token: session.publicToken,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const session = await upsertSession({ sessionId, intake, scriptStep, stage, latest, attachments, persuasionProfile });
    if (body?.action === "stage_update") {
      return new Response(JSON.stringify({
        ok: true,
        action: "stage_update",
        persisted: session.persisted,
        session_id: session.sessionId,
        public_token: session.publicToken,
        lead_temperature: temperature,
        persuasion_profile: persuasionProfile,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!apiKey) {
      const reply = fallbackReply(intake, latest, scriptStep, canClose, persuasionProfile);
      await persistAssistantReply(session.sessionId, scriptStep, reply, "fallback");
      return new Response(JSON.stringify({
        ok: true,
        source: "fallback",
        model: "local-fallback",
        reply,
        checkout_url: CHECKOUT_URL,
        persisted: session.persisted,
        session_id: session.sessionId,
        public_token: session.publicToken,
        lead_temperature: temperature,
        persuasion_profile: persuasionProfile,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const system = `You are LinfaFlow Care Assistant, a careful wellness intake concierge for an English-speaking lead.

Goal:
- Make the lead feel heard and understood.
- Ask one useful question at a time.
- Follow the script stage, but do not over-consult when the lead has already shared situation, attempts, objection, and buying intent.
- If the lead asks about price/order/buying before can_close=true, acknowledge the buying intent and ask the next qualifying question. Do not include checkout.
- If can_close=true, stop asking new discovery questions. Give a personalized recommendation, explain why it fits what they shared, handle one likely objection, and include the exact checkout URL provided in context.
- If the lead cannot send a photo, say that is fine and continue from the quiz answers. Never make photo upload feel required.
- Use lead_temperature to decide pace: hot can move to summary/close, warm needs one belief shift, cold needs more discovery, red_flag must pause sales.
- Use the persuasion profile to choose the psychological angle. Mirror the exact emotional pattern before teaching or selling.

Conversion script:
1. Summarize their pattern in their own words.
2. Add one emotional mirror line from the persuasion profile. It should feel like "you understood me", not like diagnosis.
3. Name what they already tried without criticizing it.
4. Reframe LinfaFlow as a simpler daily wellness routine, not a medical treatment.
5. Use the safe proof asset from the persuasion profile. Do not invent testimonials, news, studies, or results.
6. If skeptical, validate skepticism and compare "another random supplement" vs "a 30-day routine test".
7. When closing, recommend the simplest first step and invite checkout.
8. In the close, include a short "assessment summary" with pattern, timing/triggers, what they tried, and why an inside-support routine may fit.

Product positioning:
- LinfaFlow is a liquid daily wellness ritual.
- Use only support language: supports lymphatic flow, healthy circulation, fluid balance, daily routine.

Strict safety:
- Do not diagnose, treat, cure, prevent disease, or promise medical results.
- You may say "I can prepare this like a doctor-style wellness assessment", but do not claim to be a doctor or that a licensed doctor personally reviewed it unless the context explicitly says so.
- If an image is attached, describe only visible non-diagnostic observations such as sock marks, visible puffiness, redness, asymmetry, skin changes, or whether the image is unclear. Never diagnose from a photo.
- If an audio transcript is attached, treat it like the lead's own words and summarize it.
- Do not give medication advice.
- If red flags are present, pause the sales flow and tell the lead to seek timely medical evaluation. Red flags include sudden swelling, one-sided swelling, chest pain, severe pain, wounds, redness/heat, pregnancy, diagnosed conditions, medication, or symptoms that do not improve.
- Tell the lead to consult a doctor/pharmacist for diagnosed conditions, medication, pregnancy, sudden/severe swelling, chest pain, wounds, or severe pain.
- Never invent discounts, scarcity, guarantees beyond "according to checkout terms", ingredients, clinical studies, or testimonials.
- Never say LinfaFlow will drain, eliminate, cure, reverse, repair, detox, or remove fluid. Use support/routine language.

Style:
- English only for the lead-facing reply.
- 2 to 5 short paragraphs.
- Warm, calm, specific, not hypey.
- Use one clear call to action in the close.
- No markdown tables.`;

    const transcript = messages.map((m) => ({
      role: m.sender === "lead" ? "user" : "assistant",
      content: String(m.text || "").slice(0, 1800),
    }));

    const userContext = `Lead intake:
Name: ${intake.name || ""}
Main concern: ${intake.concern || ""}
Timeline: ${intake.timeline || ""}
Tried before: ${intake.tried || ""}
Preferred contact: ${intake.contact || ""}
Age range: ${intake.age_range || ""}
Area: ${intake.swelling_area || ""}
Worst time: ${intake.worst_time || ""}
Triggers: ${intake.triggers || ""}
Impact: ${intake.impact || ""}
Red flags: ${intake.red_flags || ""}
Medication or conditions: ${intake.meds_or_conditions || ""}
Photo consent: ${intake.photo_consent ? "yes" : "no"}
Attachments: ${attachments.map((attachment) => `${attachment.kind || "file"}:${attachment.name || "unnamed"}${attachment.transcript ? ` transcript="${attachment.transcript.slice(0, 500)}"` : ""}`).join(", ") || "none"}
Lead temperature: ${temperature}
Lead score: ${score}
Current script stage: ${scriptStages[scriptStep] || "intake_summary"} (${scriptStep + 1}/${scriptStages.length})
Can close now: ${canClose ? "yes" : "no"}
Checkout URL if and only if Can close now is yes: ${CHECKOUT_URL}

Persuasion profile:
Avatar: ${persuasionProfile.avatar}
Why this avatar: ${persuasionProfile.avatar_reason}
Awareness: ${persuasionProfile.awareness}
Likely objection: ${persuasionProfile.likely_objection}
Emotional mirror to use: ${persuasionProfile.emotional_mirror}
Mechanism bridge: ${persuasionProfile.mechanism_bridge}
Safe proof asset: ${persuasionProfile.proof_asset}
Close frame: ${persuasionProfile.close_frame}
Best next question/CTA: ${persuasionProfile.next_question}

Latest lead message: ${latest}`;

    const imageParts = attachments
      .filter((attachment) => attachment.kind === "image" && attachment.data_url)
      .slice(0, 2)
      .map((attachment) => ({
        type: "image_url",
        image_url: { url: attachment.data_url },
      }));

    const finalUserMessage = imageParts.length
      ? {
          role: "user",
          content: [
            { type: "text", text: userContext },
            ...imageParts,
          ],
        }
      : { role: "user", content: userContext };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://imperiox.lovable.app",
        "X-Title": "Imperio X - LinfaFlow Care Room",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.45,
        messages: [
          { role: "system", content: system },
          ...transcript,
          finalUserMessage,
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[linfaflow-care-ai] OpenRouter error", response.status, detail.slice(0, 500));
      const reply = fallbackReply(intake, latest, scriptStep, canClose, persuasionProfile);
      await persistAssistantReply(session.sessionId, scriptStep, reply, "fallback_after_error");
      return new Response(JSON.stringify({
        ok: true,
        source: "fallback_after_error",
        model: "local-fallback",
        reply,
        error: `openrouter_${response.status}`,
        checkout_url: CHECKOUT_URL,
        persisted: session.persisted,
        session_id: session.sessionId,
        public_token: session.publicToken,
        lead_temperature: temperature,
        persuasion_profile: persuasionProfile,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const buyingIntent = /\b(price|order|buy|checkout|cost|purchase)\b/i.test(latest);
    let reply = data?.choices?.[0]?.message?.content?.trim() || fallbackReply(intake, latest, scriptStep, canClose, persuasionProfile);
    reply = reply
      .replace(/designed to support/gi, "positioned as a routine that supports")
      .replace(/lymphatic flow throughout the day/gi, "lymphatic flow as part of a daily wellness routine");
    if (!canClose) {
      reply = reply.replace(CHECKOUT_URL, "").replace(/\{\{link_checkout\}\}/g, "").trim();
    }
    if (buyingIntent && canClose && !reply.includes(CHECKOUT_URL)) {
      reply += `\n\nSecure checkout: ${CHECKOUT_URL}`;
    }
    await persistAssistantReply(session.sessionId, scriptStep, reply, "openrouter");

    return new Response(JSON.stringify({
      ok: true,
      source: "openrouter",
      model: MODEL,
      reply,
      checkout_url: CHECKOUT_URL,
      persisted: session.persisted,
      session_id: session.sessionId,
      public_token: session.publicToken,
      lead_temperature: temperature,
      persuasion_profile: persuasionProfile,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("[linfaflow-care-ai] error", error?.message || error);
    return new Response(JSON.stringify({ ok: false, error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
