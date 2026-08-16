import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  ImagePlus,
  Loader2,
  Mic,
  MessageCircle,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Volume2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type RoomStage = "intake" | "queue" | "consult" | "offer";
type ScriptStepId = "intake" | "situation" | "problem" | "implication" | "mechanism" | "proof" | "objection" | "close";
type LeadTemperature = "cold" | "warm" | "hot" | "red_flag";
type CareView = "quiz" | "preparing" | "chat";

const careOpenFlowPath = "/openflow?automacao=2266ddbd-cdd0-41b4-acae-428da8f324f6";

type Intake = {
  name: string;
  concern: string;
  timeline: string;
  tried: string;
  contact: string;
  age_range: string;
  swelling_area: string;
  worst_time: string;
  triggers: string;
  impact: string;
  red_flags: string;
  meds_or_conditions: string;
  photo_consent: boolean;
  contact_consent: boolean;
};
type IntakeTextKey = Exclude<keyof Intake, "photo_consent" | "contact_consent">;

type ChatMessage = {
  sender: "assistant" | "lead";
  text: string;
  source?: "openrouter" | "fallback" | "fallback_after_error" | "local";
  voice_cache_key?: string;
  attachments?: LeadAttachment[];
  audio_url?: string;
  audio_kind?: "cached" | "personalized";
  media?: ScriptMedia;
};

type ScriptMedia = {
  src: string;
  alt: string;
  eyebrow: string;
  title: string;
  caption: string;
};

type LeadAttachment = {
  kind: "image" | "audio";
  name: string;
  mime: string;
  data_url?: string;
  transcript?: string;
};

type QuizQuestion = {
  key: IntakeTextKey;
  eyebrow: string;
  question: string;
  helper: string;
  placeholder: string;
  options: string[];
};

type QuizCompanion = {
  eyebrow: string;
  title: string;
  text: string;
  image?: string;
  imageAlt?: string;
};

const checkoutUrl =
  "https://cc.linfaflow.com/dtcnew/checkout.php?hid=b2lkPW9mZl8wMDQyMzQ2JmFpZD1hZmZfNjgyMTM3NyZ1aWQ9YmxfNjY2ODExMQ%3D%3D&affid=aff_6821377";

const defaultIntake: Intake = {
  name: "",
  concern: "",
  timeline: "",
  tried: "",
  contact: "",
  age_range: "45-64",
  swelling_area: "",
  worst_time: "",
  triggers: "",
  impact: "",
  red_flags: "No sudden one-sided swelling, chest pain, wounds, or severe pain.",
  meds_or_conditions: "No diagnosed condition shared yet.",
  photo_consent: true,
  contact_consent: false,
};

type CareDemo = {
  id: string;
  label: string;
  subtitle: string;
  intake: Intake;
  scriptStep: number;
  messages: ChatMessage[];
};

const careDemos: CareDemo[] = [
  {
    id: "maya",
    label: "Maya, nurse on her feet",
    subtitle: "High intent: standing all day, outside-in fixes, practical close.",
    intake: {
      ...defaultIntake,
      name: "Maya Thompson",
      concern: "My legs feel heavy by the end of a twelve-hour nursing shift and my socks leave deep marks.",
      swelling_area: "Ankles and lower legs",
      worst_time: "Evening, after standing",
      triggers: "Standing for hours and heat",
      timeline: "More than 6 months",
      tried: "Compression socks and leg elevation",
      impact: "Shoes feel tight and I have less energy after work",
      contact: "maya@example.com",
    },
    scriptStep: 7,
    messages: [
      { sender: "assistant", source: "local", text: "You are not asking to be sold to. You are asking to be heard about something no one has named yet.", voice_cache_key: "linfaflow-empathy-line-1-v1" },
      { sender: "lead", text: "I am a nurse and by the end of a twelve-hour shift my ankles are puffy and my socks leave deep marks." },
      { sender: "assistant", source: "local", text: "That is a very specific daily pattern, Maya. You have a job that does not let you stop and elevate whenever your body asks for it. Before I suggest anything, what have you already tried?" },
      { sender: "lead", text: "Compression socks, elevation when I get home, and massage. They help for a while but the next shift puts me right back where I started." },
      { sender: "assistant", source: "local", text: "That makes sense. Those are outside-in tools, and it does not mean you failed when the same pattern returns once a real shift begins again. The reason I am asking about timing and what you tried is to see whether a simple inside-support routine fits your day better than another complicated protocol." },
      { sender: "lead", text: "What would the routine actually look like?" },
      { sender: "assistant", source: "local", text: "LinfaFlow is positioned as a liquid wellness ritual led by Cleavers, followed by Stillingia, Prickly Ash and Red Clover. The directions are 1 mL twice a day, so it is about a 30-second routine. It is not a diagnosis, medication, water pill, or replacement for medical care." },
      { sender: "lead", text: "I could do that. I just do not want another thing that does not fit a shift." },
      { sender: "assistant", source: "local", text: "A thirty second daily ritual that does not require stopping the workday. If you cannot lie down to elevate, you can still support the inside.", voice_cache_key: "linfaflow-close-standing-v1" },
      { sender: "assistant", source: "local", text: `Based on the pattern you described, the simplest first step is one 30-day bottle. Track your sock marks, end-of-day heaviness, and how your shoes feel. Compare bundle value and guarantee terms at checkout before deciding. Secure checkout: ${checkoutUrl}` },
    ],
  },
  {
    id: "linda",
    label: "Linda, normal tests but not normal life",
    subtitle: "Recognition first: dismissed by labs, confidence impact, mechanism before offer.",
    intake: {
      ...defaultIntake,
      name: "Linda Brooks",
      concern: "My ankles swell, shoes get tight, and I avoid photos because I do not feel like myself.",
      swelling_area: "Ankles and lower legs",
      worst_time: "Evening after normal errands",
      triggers: "Heat and long days on my feet",
      timeline: "A year or more",
      tried: "Compression socks, drainage massage, and cutting salt",
      impact: "I avoid photos and make excuses for plans",
      contact: "linda@example.com",
    },
    scriptStep: 7,
    messages: [
      { sender: "assistant", source: "local", text: "If your body is showing you something the labs did not, it deserves an answer that is not a guess in a white coat.", voice_cache_key: "linfaflow-empathy-line-3-v1" },
      { sender: "lead", text: "My labs were normal, but by dinner my shoes are tight and my ankles look different. I feel silly bringing it up again." },
      { sender: "assistant", source: "local", text: "You are not silly, Linda. Normal tests can be reassuring without explaining how your body feels at the end of a normal day. What changes most for you when the pattern is there?" },
      { sender: "lead", text: "Photos, plans, and clothes. I have compression socks and have paid for drainage massage, but it all feels temporary." },
      { sender: "assistant", source: "local", text: "That slow retreat is often the part nobody sees. You already put effort into outside-in options, so this is not about blaming you or promising a diagnosis. It is about testing a simpler daily routine that supports the inside angle alongside the practical things you already do." },
      { sender: "lead", text: "How is LinfaFlow different from the random supplements I have seen?" },
      { sender: "assistant", source: "local", text: "The product story is Cleavers first, then Stillingia, Prickly Ash, and Red Clover as complementary botanicals in a liquid routine. The goal is consistency: 1 mL twice daily for 30 days, not a harsh cleanse or a water-pill effect. If medication or a diagnosed condition is involved, the ingredient list should be reviewed with a doctor or pharmacist." },
      { sender: "lead", text: "I would be willing to try something simple if I can start small." },
      { sender: "assistant", source: "local", text: `Based on what you shared, one bottle is the cleanest 30-day test. Review the bundle options, directions, and guarantee terms at checkout, then choose the option that feels right for you. Secure checkout: ${checkoutUrl}` },
    ],
  },
  {
    id: "denise",
    label: "Denise, skeptical after trying everything",
    subtitle: "Objection-led: validates skepticism, explains fit, then makes a low-pressure pitch.",
    intake: {
      ...defaultIntake,
      name: "Denise Walker",
      concern: "My legs are heavy and puffy after travel and I am tired of buying things that do not last.",
      swelling_area: "Feet and shoes",
      worst_time: "After flights and long car rides",
      triggers: "Travel, sitting, and heat",
      timeline: "More than 3 months",
      tried: "Compression socks, elevation, detox tea, and massage",
      impact: "It changes travel plans and makes shoes uncomfortable",
      contact: "denise@example.com",
    },
    scriptStep: 7,
    messages: [
      { sender: "assistant", source: "local", text: "You are not asking to be sold to. You are asking to be heard about something no one has named yet.", voice_cache_key: "linfaflow-empathy-line-1-v1" },
      { sender: "lead", text: "I have tried socks, elevation, detox teas and massage. Travel makes my feet puffy and I do not want another supplement pitch." },
      { sender: "assistant", source: "local", text: "That skepticism is earned, Denise. Nothing in this conversation requires you to believe a big promise. I want to separate what gave temporary outside relief from what could be realistic as a daily routine between travel days." },
      { sender: "lead", text: "Why would drops be any different?" },
      { sender: "assistant", source: "local", text: "They are not presented as a cure, a medication, or a quick detox. LinfaFlow is a liquid wellness ritual: Cleavers leads the formula, with Stillingia, Prickly Ash, and Red Clover in support. The practical test is 1 mL twice daily for 30 days while you track the situations you already notice, especially travel and tight shoes." },
      { sender: "lead", text: "I still worry I will spend money and get nowhere." },
      { sender: "assistant", source: "local", text: "That is a reasonable concern. Rather than asking for blind confidence, use the checkout to review the one-bottle and bundle options, the exact directions, and the guarantee terms. Then you can decide whether a 30-day routine test is worth it for your own pattern." },
      { sender: "lead", text: "Okay, what would you start with?" },
      { sender: "assistant", source: "local", text: "Based on what you shared, the only thing left to test is the inside support angle. One bottle is enough to know if it fits.", voice_cache_key: "linfaflow-close-hot-v1" },
      { sender: "assistant", source: "local", text: `Start with one bottle if you want the clearest test. If you prefer to compare longer-routine value, review the bundle options at checkout. Secure checkout: ${checkoutUrl}` },
    ],
  },
];

const stageCopy: Record<RoomStage, { title: string; pt: string }> = {
  intake: {
    title: "Private assessment",
    pt: "Captura contexto antes do chat. Isso aumenta personalizacao e separa curiosos de leads com dor real.",
  },
  queue: {
    title: "Private preparation",
    pt: "O sistema prepara o contexto antes da conversa sem mostrar score, posicao de fila ou linguagem operacional para o lead.",
  },
  consult: {
    title: "Private pattern review",
    pt: "A IA conversa como concierge: ouve, resume, faz uma pergunta por vez e evita prometer cura.",
  },
  offer: {
    title: "Personalized recommendation",
    pt: "A venda entra depois de entendimento, temperatura e objecao. O checkout aparece como proximo passo, nao como empurrao.",
  },
};

const safetyItems = [
  "No diagnosis, no cure claims, no medication advice.",
  "Escalate red flags: sudden swelling, chest pain, pregnancy, severe pain, wounds.",
  "Use approved product language: wellness ritual, support, routine, guarantee terms.",
];

const assessmentSteps = [
  { label: "1. Intake", text: "You describe the pattern in your own words." },
  { label: "2. Quiz", text: "We ask age range, area, timing, triggers and red flags." },
  { label: "3. Optional photo", text: "Add a photo if you can. If not, the quiz still works." },
  { label: "4. Pattern read", text: "The assistant checks timing, triggers, what you tried and what to avoid." },
  { label: "5. Mechanism", text: "You learn why outside-in fixes often feel temporary." },
  { label: "6. Checkout", text: "You get a simple 30-day next step if it fits." },
];

const proofPoints = [
  {
    title: "Not another external fix",
    text: "Compression, elevation, massage and dry brushing can help temporarily. This flow explains the inside-support angle before selling.",
  },
  {
    title: "Liquid 30-second routine",
    text: "LinfaFlow is positioned as a liquid wellness ritual, easier to keep consistent than a complicated routine.",
  },
  {
    title: "Cleavers-led botanical logic",
    text: "The product story starts with Cleavers, then Stillingia, Prickly Ash and Red Clover as complementary support.",
  },
];

const quizQuestions: QuizQuestion[] = [
  {
    key: "concern",
    eyebrow: "First, your pattern",
    question: "What made you look for help today?",
    helper: "Start with the exact thing you notice. This helps the assistant avoid generic advice.",
    placeholder: "Example: my legs feel heavy and my socks leave marks...",
    options: [
      "Heavy swollen legs by the end of the day",
      "Sock marks around my ankles",
      "Shoes feel tight later in the day",
      "Puffiness that keeps coming back",
    ],
  },
  {
    key: "swelling_area",
    eyebrow: "Where it shows up",
    question: "Where do you notice it most?",
    helper: "The area helps separate a daily pattern from a safety-first situation.",
    placeholder: "Example: ankles, lower legs, feet, hands...",
    options: ["Ankles and lower legs", "Feet and shoes", "Hands or rings", "Face or general puffiness"],
  },
  {
    key: "worst_time",
    eyebrow: "Timing",
    question: "When does it usually feel worst?",
    helper: "Timing is one of the strongest clues for a personalized next step.",
    placeholder: "Example: evening after standing all day...",
    options: ["Evening, after standing", "After sitting for hours", "After travel", "Already there when I wake up"],
  },
  {
    key: "triggers",
    eyebrow: "Daily triggers",
    question: "What seems to bring it out?",
    helper: "These are recognizable situations, not a diagnosis.",
    placeholder: "Example: heat, salty meals, travel, standing...",
    options: ["Standing for hours", "Heat or humid days", "Salty meals or wine", "Flights or long car rides"],
  },
  {
    key: "timeline",
    eyebrow: "How long",
    question: "How long has this been happening?",
    helper: "Knowing how long it has been going on helps me read your pattern.",
    placeholder: "Example: more than 6 months...",
    options: ["A few weeks", "More than 3 months", "More than 6 months", "A year or more"],
  },
  {
    key: "tried",
    eyebrow: "What you tried",
    question: "What have you already tried?",
    helper: "Nothing you tried was wrong. I just need to know it before suggesting anything.",
    placeholder: "Example: compression socks, elevation, massage...",
    options: ["Compression socks", "Leg elevation", "Lymphatic drainage or massage", "Water pills or detox teas"],
  },
  {
    key: "impact",
    eyebrow: "What it costs you",
    question: "What does this affect most day to day?",
    helper: "Tell me what you would like back in your day. That matters more than the symptom alone.",
    placeholder: "Example: shoes, confidence, photos, comfort...",
    options: ["Shoes feel tight", "I avoid photos of my legs", "I feel older than I am", "It changes my plans"],
  },
  {
    key: "red_flags",
    eyebrow: "Safety check",
    question: "Any sudden or severe warning signs?",
    helper: "If yes, the flow pauses selling and recommends medical evaluation first.",
    placeholder: "Example: no sudden one-sided swelling, chest pain, wounds, or severe pain.",
    options: [
      "No sudden one-sided swelling, chest pain, wounds, or severe pain.",
      "Sudden one-sided swelling",
      "Severe pain, red/hot skin, or wounds",
      "Chest symptoms or pregnancy",
    ],
  },
  {
    key: "meds_or_conditions",
    eyebrow: "Medication context",
    question: "Any medication or diagnosed condition we should respect?",
    helper: "This is not for diagnosis. It keeps the recommendation safer.",
    placeholder: "Example: no diagnosed condition shared yet...",
    options: [
      "No diagnosed condition shared yet.",
      "I take medication",
      "Heart or kidney condition",
      "Blood thinner, diuretic, or diabetes medication",
    ],
  },
  {
    key: "contact",
    eyebrow: "Keep your place",
    question: "Would you like a private link to continue later?",
    helper: "Optional. Add a WhatsApp number or email only if you want follow-up. Your review still works without it.",
    placeholder: "WhatsApp number or email (optional)",
    options: [],
  },
];

const quizCompanions: Partial<Record<IntakeTextKey, QuizCompanion>> = {
  swelling_area: {
    eyebrow: "Pattern map",
    title: "The location matters as much as the symptom.",
    text: "This is a simple way to organize what you notice before the conversation. It is not a diagnosis.",
    image: "/linfaflow-care/lymphatic-system-explainer.png",
    imageAlt: "Simple green illustration of the lymphatic system",
  },
  tried: {
    eyebrow: "Your history counts",
    title: "You should not have to repeat the same temporary fixes.",
    text: "The conversation uses what you have already tried so the next step can address the pattern, not dismiss your effort.",
  },
  impact: {
    eyebrow: "The real reason",
    title: "Comfort, confidence and daily plans all count.",
    text: "This answer helps the assistant speak to the moment you want back, rather than reducing everything to a symptom checklist.",
  },
  red_flags: {
    eyebrow: "Safety first",
    title: "Some patterns deserve medical attention before a wellness routine.",
    text: "A clear safety check makes the rest of the conversation more responsible and useful.",
  },
};

const SESSION_KEY = "linfaflow-care-session-id";

const scriptSteps: Array<{ id: ScriptStepId; label: string; pt: string }> = [
  { id: "intake", label: "Intake summary", pt: "Resumo inicial do que o lead contou." },
  { id: "situation", label: "Situation pattern", pt: "Entende quando acontece e em qual contexto." },
  { id: "problem", label: "Problem depth", pt: "Aprofunda o incomodo real e o que ja tentou." },
  { id: "implication", label: "Implication", pt: "Liga a dor ao impacto na rotina e decisao." },
  { id: "mechanism", label: "Mechanism reframe", pt: "Explica a logica da rotina sem promessa medica." },
  { id: "proof", label: "Proof logic", pt: "Mostra por que e diferente de tentativas anteriores." },
  { id: "objection", label: "Objection", pt: "Trabalha preco, ceticismo, ingredientes e timing." },
  { id: "close", label: "Close", pt: "Agora sim recomenda e mostra o checkout." },
];

const mechanismMedia: ScriptMedia = {
  src: "/linfaflow-care/lymphatic-system-explainer.png",
  alt: "Simple illustration of the lymphatic system",
  eyebrow: "Why the pattern can feel connected",
  title: "A simple inside-support explanation",
  caption: "This is educational context, not a diagnosis. The goal is to explain why timing, heaviness and recurring puffiness can be worth looking at as one daily pattern.",
};

const routineMedia: ScriptMedia = {
  src: "/linfaflow-care/daily-use-ritual.png",
  alt: "LinfaFlow liquid drops being added to water as part of a daily routine",
  eyebrow: "What the routine looks like",
  title: "A small daily ritual, not a harsh cleanse",
  caption: "LinfaFlow is presented as a liquid wellness routine. Review the checkout ingredients and directions, and speak with a doctor or pharmacist if medication or a diagnosed condition is involved.",
};

function mediaForScriptStep(step: number, canClose: boolean, temperature: LeadTemperature): ScriptMedia | undefined {
  if (temperature === "red_flag") return undefined;
  if (step === 4) return mechanismMedia;
  if (step >= 6 || canClose) return routineMedia;
  return undefined;
}

function leadScore(intake: Intake) {
  const text = `${intake.concern} ${intake.timeline} ${intake.tried} ${intake.worst_time} ${intake.triggers} ${intake.impact}`.toLowerCase();
  let score = 32;
  if (text.includes("heavy") || text.includes("swollen") || text.includes("marks")) score += 22;
  if (text.includes("month") || text.includes("year")) score += 12;
  if (text.includes("compression") || text.includes("drainage") || text.includes("elevation")) score += 18;
  if (text.includes("standing") || text.includes("evening") || text.includes("travel") || text.includes("heat")) score += 8;
  if (intake.contact.trim()) score += 8;
  return Math.min(score, 94);
}

function hasRedFlagSignal(intake: Intake) {
  const redFlags = intake.red_flags.toLowerCase();
  const meds = intake.meds_or_conditions.toLowerCase();
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

const temperatureCopy: Record<LeadTemperature, { label: string; title: string; text: string; className: string }> = {
  hot: {
    label: "High intent",
    title: "Ready for a personalized recommendation",
    text: "The pattern is specific, repeated, and she already tried outside-in fixes. Move toward mechanism, objection, and checkout.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  warm: {
    label: "Warm lead",
    title: "Needs one more belief shift",
    text: "She has enough pain to continue. Build the internal-drainage mechanism before showing the checkout.",
    className: "border-lime-200 bg-lime-50 text-lime-900",
  },
  cold: {
    label: "Needs context",
    title: "Keep discovery educational",
    text: "Ask about timing, triggers, sock marks, shoes, travel, standing, and what changed day to day.",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  red_flag: {
    label: "Safety first",
    title: "Pause the sales flow",
    text: "Recommend timely medical evaluation before any wellness routine. Do not push checkout.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
};

function fallbackRecommendation(intake: Intake) {
  const name = intake.name.trim() || "there";
  return `${name}, based on what you shared, I would not treat this as a random supplement decision.\n\nHere is your review summary:\nPattern: ${intake.concern}\nTiming and triggers: ${intake.worst_time}; ${intake.triggers}\nAlready tried: ${intake.tried}\nDaily impact: ${intake.impact}\n\nThe cleanest angle is a simple 30-day daily ritual, not another complicated routine. LinfaFlow is positioned as a liquid wellness ritual that supports lymphatic flow, healthy circulation and fluid balance. The ingredient line is led by Cleavers aerial parts, then Stillingia root, Prickly Ash bark and Red Clover blossom in that order. The routine is 1 mL twice a day and takes about 30 seconds.\n\nIf you have a diagnosed condition, take medication, are pregnant, or have sudden or severe swelling, review the ingredient list with your doctor or pharmacist first.\n\nThe safest first step is one bottle for 30 days. If daily value matters more, compare the bundle options, pricing, and guarantee terms at checkout.\n\nSecure checkout: ${checkoutUrl}`;
}

export default function LinfaFlowCareRoom() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAdminPreview = location.pathname.startsWith("/funis/");
  const requestedDemoId = searchParams.get("demo");
  const isDemoPreview = Boolean(requestedDemoId);
  const [careView, setCareView] = useState<CareView>("quiz");
  const [quizStep, setQuizStep] = useState(0);
  const [stage, setStage] = useState<RoomStage>("intake");
  const [scriptStep, setScriptStep] = useState(0);
  const [intake, setIntake] = useState(defaultIntake);
  const [draft, setDraft] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiSource, setAiSource] = useState<"ready" | "openrouter" | "fallback" | "error">("ready");
  const [attachments, setAttachments] = useState<LeadAttachment[]>([]);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [sessionId, setSessionId] = useState(() => localStorage.getItem(SESSION_KEY) || "");
  const sessionIdRef = useRef(sessionId);
  const voiceRepliesRef = useRef(false);
  const stagePersistRef = useRef<Promise<string | null> | null>(null);
  const quizPersistRef = useRef<Promise<string | null> | null>(null);
  const [publicToken, setPublicToken] = useState("");
  const [persisted, setPersisted] = useState(false);
  const [activeDemoId, setActiveDemoId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "assistant",
      text: "Welcome. If you have been wondering whether the same daily pattern you keep noticing is something the normal tests simply do not explain, you are in the right place. I will ask a few quick questions first so the guidance feels specific to you. You can also attach a photo or use voice if typing is easier.",
    },
  ]);

  useEffect(() => {
    const demo = careDemos.find((item) => item.id === requestedDemoId);
    if (demo) loadCareDemo(demo);
  }, [requestedDemoId]);

  useEffect(() => {
    const resumeToken = searchParams.get("resume");
    if (!resumeToken) return;
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("linfaflow-care-ai", {
          body: { action: "resume_session", public_token: resumeToken },
        });
        if (error || !data?.ok || cancelled) return;
        const savedIntake = { ...defaultIntake, ...(data.intake || {}) } as Intake;
        setIntake(savedIntake);
        setQuizStep(Math.max(0, Math.min(Number(data.script_step || 0), quizQuestions.length - 1)));
        setScriptStep(Number(data.script_step || 0));
        rememberSession(data.session_id, resumeToken, true);
        if (data.stage === "quiz") {
          setCareView("quiz");
          return;
        }
        const restoredMessages = Array.isArray(data.messages)
          ? data.messages
              .filter((message: { sender?: string; text?: string }) => (message.sender === "lead" || message.sender === "assistant") && message.text)
              .map((message: { sender: "lead" | "assistant"; text: string; source?: ChatMessage["source"] }) => ({
                sender: message.sender,
                text: message.text,
                source: message.source,
              }))
          : [];
        setMessages([
          ...restoredMessages,
          {
            sender: "assistant",
            source: "local",
            text: `Welcome back${savedIntake.name ? `, ${savedIntake.name.split(/\\s+/)[0]}` : ""}. I saved your place and the pattern you described. We can continue from where you stopped.`,
          },
        ]);
        setStage(data.stage === "offer" ? "offer" : "consult");
        setCareView("chat");
      } catch {
        // A bad or expired resume link falls back to a new private quiz.
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const score = useMemo(() => leadScore(intake), [intake]);
  const temperature = useMemo(() => leadTemperature(intake, score), [intake, score]);
  const temperatureDetails = temperatureCopy[temperature];
  const hasSubmittedPhoto = useMemo(
    () => attachments.some((attachment) => attachment.kind === "image") || messages.some((message) => message.attachments?.some((attachment) => attachment.kind === "image")),
    [attachments, messages],
  );
  const recommendationPoints = useMemo(
    () => [
      { label: "Pattern", value: intake.concern || "Repeated end-of-day heaviness or swelling." },
      { label: "Timing", value: intake.worst_time || intake.timeline || "This has been happening often enough to deserve a simple routine." },
      { label: "Triggers", value: intake.triggers || "It tends to show up after specific daily situations." },
      { label: "Already tried", value: intake.tried || "You have already tried outside-in fixes." },
      { label: "Daily impact", value: intake.impact || "It affects comfort, shoes, confidence, or daily plans." },
      {
        label: "Photo status",
        value: hasSubmittedPhoto
          ? "Photo attached for visual context."
          : "No photo needed. The review can continue from your answers.",
      },
    ],
    [hasSubmittedPhoto, intake],
  );
  const canClose = scriptStep >= 6 && temperature !== "red_flag";
  const hasCheckoutOffer = stage === "offer" || messages.some((message) => message.text.includes(checkoutUrl));

  function updateIntake(key: IntakeTextKey, value: string) {
    setIntake((current) => ({ ...current, [key]: value }));
  }

  function updateIntakeBoolean(key: "photo_consent" | "contact_consent", value: boolean) {
    setIntake((current) => ({ ...current, [key]: value }));
  }

  function answerQuiz(value: string) {
    const question = quizQuestions[quizStep];
    const nextIntake = { ...intake, [question.key]: value };
    setIntake(nextIntake);
    void trackQuizProgress(nextIntake, quizStep, "answered");
  }

  function nextQuizStep() {
    void trackQuizProgress(intake, quizStep, "step_completed");
    setQuizStep((current) => Math.min(current + 1, quizQuestions.length - 1));
  }

  function previousQuizStep() {
    setQuizStep((current) => Math.max(current - 1, 0));
  }

  function completeQuiz() {
    void trackQuizProgress(intake, quizStep, "completed");
    // O lead vai direto para o chat: o resumo aparece como primeira bolha do assistente.
    setCareView("chat");
    setIsAiThinking(true);
    window.setTimeout(() => {
      setIsAiThinking(false);
      startQueue();
    }, 800);
  }


  async function trackQuizProgress(nextIntake: Intake, step: number, quizStatus: "answered" | "step_completed" | "completed") {
    const previousPersist = quizPersistRef.current;
    const run = (async () => {
      const pendingSessionId = sessionIdRef.current || (previousPersist ? await previousPersist : "");
      const { data } = await supabase.functions.invoke("linfaflow-care-ai", {
        body: {
          action: "quiz_progress",
          session_id: pendingSessionId || undefined,
          intake: nextIntake,
          script_step: step,
          quiz_key: quizQuestions[step]?.key || "unknown",
          quiz_status: quizStatus,
          quiz_total: quizQuestions.length,
        },
      });
      rememberSession(data?.session_id || pendingSessionId, data?.public_token, Boolean(data?.persisted));
      return data?.session_id || pendingSessionId || null;
    })();
    quizPersistRef.current = run;
    try {
      await run;
    } catch {
      // Quiz tracking is non-blocking: the lead can keep answering if persistence is unavailable.
    }
  }

  function rememberSession(nextSessionId?: string | null, nextPublicToken?: string | null, nextPersisted = true) {
    if (nextSessionId) {
      sessionIdRef.current = nextSessionId;
      setSessionId(nextSessionId);
      localStorage.setItem(SESSION_KEY, nextSessionId);
    }
    if (nextPublicToken) setPublicToken(nextPublicToken);
    setPersisted(nextPersisted);
  }

  function speakWithBrowserFallback(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(checkoutUrl, "secure checkout link"));
    utterance.lang = "en-US";
    utterance.rate = 0.96;
    window.speechSynthesis.speak(utterance);
  }

  function shouldGenerateVoiceReply(text: string, preferredCacheKey = "") {
    const isPriorityMoment = preferredCacheKey.startsWith("linfaflow-empathy-") || preferredCacheKey.startsWith("linfaflow-close-");
    if (!voiceRepliesRef.current && !isPriorityMoment) return false;
    if (text.trim().length < 80) return false;
    return true;
  }

  function firstName() {
    return intake.name.trim().split(/\s+/)[0] || "there";
  }

  async function hydrateDemoAudio(demo: CareDemo) {
    for (const message of demo.messages) {
      if (message.sender !== "assistant" || !message.voice_cache_key) continue;
      try {
        const { data } = await supabase.functions.invoke("linfaflow-care-voice", {
          body: { text: message.text, cache_key: message.voice_cache_key },
        });
        if (!data?.ok || !data?.audio_url) continue;
        setMessages((current) => current.map((item) => (
          item.text === message.text && item.voice_cache_key === message.voice_cache_key
            ? { ...item, audio_url: data.audio_url, audio_kind: "cached" }
            : item
        )));
      } catch {
        // Demo review remains useful even if a signed audio URL cannot be generated.
      }
    }
  }

  function loadCareDemo(demo: CareDemo) {
    setActiveDemoId(demo.id);
    setIntake(demo.intake);
    setScriptStep(demo.scriptStep);
    setStage("offer");
    setCareView("chat");
    setDraft("");
    setAttachments([]);
    setSessionId("");
    sessionIdRef.current = "";
    setPublicToken("");
    setPersisted(false);
    setMessages(demo.messages.map((message) => ({ ...message })));
    void hydrateDemoAudio(demo);
  }

  function cachedVoicePlan(cacheKey: string) {
    const cacheLines: Record<string, string> = {
      "linfaflow-empathy-line-1-v1": "You are not asking to be sold to. You are asking to be heard about something no one has named yet.",
      "linfaflow-empathy-line-2-v1": "The hardest part is not the swelling. It is the slow retreat from photos, plans and shoes you used to love, and the way that retreat never gets announced.",
      "linfaflow-empathy-line-3-v1": "If your body is showing you something the labs did not, it deserves an answer that is not a guess in a white coat.",
      "linfaflow-close-standing-v1": "A thirty second daily ritual that does not require stopping the workday. If you cannot lie down to elevate, you can still support the inside.",
      "linfaflow-close-hot-v1": "Based on what you shared, the only thing left to test is the inside support angle. One bottle is enough to know if it fits.",
    };
    const line = cacheLines[cacheKey];
    return line ? { text: line, cacheKey, kind: "cached" as const } : null;
  }

  function voicePlanForReply(text: string, step: number, nextStage: RoomStage, preferredCacheKey = "") {
    const leadName = firstName();
    const cachedPlan = cachedVoicePlan(preferredCacheKey);
    if (cachedPlan) return cachedPlan;
    if (temperature === "red_flag") {
      return {
        text: `${leadName}, I want to be careful here. If swelling is sudden, one-sided, painful, red or hot, connected with chest symptoms, pregnancy, wounds, medication, or a diagnosed condition, this should be checked with a healthcare professional before thinking about any wellness routine.`,
        cacheKey: "",
        kind: "personalized" as const,
      };
    }

    if (nextStage === "offer" || step >= 7 || text.includes(checkoutUrl)) {
      return {
        text: `${leadName}, based on what you shared, I would start simple: one 30-day LinfaFlow routine. Track three things: sock marks, end-of-day heaviness, and how your shoes feel. LinfaFlow is not a diagnosis, cure, medication, or water pill. It is a liquid daily wellness ritual that supports lymphatic flow, healthy circulation, and fluid balance. If you take medication or have a diagnosed condition, review the ingredients with your doctor or pharmacist first.`,
        cacheKey: "",
        kind: "personalized" as const,
      };
    }

    if (/how to take|dosage|1 ml|twice daily|dropper|30-day|30 day/i.test(text)) {
      return {
        text: "The routine is intentionally simple: 1 mL twice daily as part of a 30-day bottle. The point is consistency, not a harsh cleanse or a water-pill effect. You can think of it like a small daily wellness ritual rather than another complicated protocol.",
        cacheKey: "linfaflow-usage-1ml-2x-daily-v1",
        kind: "cached" as const,
      };
    }

    if (/ingredient|cleavers|stillingia|prickly ash|red clover|medication|doctor|pharmacist|safety/i.test(text)) {
      return {
        text: "The formula is led by Cleavers, with Stillingia, Prickly Ash, and Red Clover as complementary botanicals. LinfaFlow is not a diagnosis, cure, medication, or water pill. If you take medication, are pregnant, or have a diagnosed condition, review the ingredient list with your doctor or pharmacist first.",
        cacheKey: "linfaflow-ingredients-cleavers-safety-v1",
        kind: "cached" as const,
      };
    }

    if (step >= 6 || /skeptical|tried|expensive|not work|another supplement/i.test(text)) {
      return {
        text: "I understand the skepticism. If you already tried compression, elevation, massage, or random supplements, the point is not to pretend those efforts were wrong. The point is that outside-in fixes can feel temporary. LinfaFlow is framed as a simple 30-day routine test, not a miracle and not a medical treatment.",
        cacheKey: "linfaflow-objection-skepticism-v1",
        kind: "cached" as const,
      };
    }

    if (step >= 5 || /compression|drainage|elevation|sock/i.test(text)) {
      return {
        text: "Compression, elevation, and drainage can help for a short window, but they work mostly from the outside. Once the day starts again, the same pattern can come back. That is why this review looks at timing, triggers, sock marks, and daily consistency before recommending anything.",
        cacheKey: "linfaflow-proof-outside-in-v1",
        kind: "cached" as const,
      };
    }

    if (step >= 4 || /different|linfaflow|mechanism|routine/i.test(text)) {
      return {
        text: "The key idea is simple: your swelling, heaviness, and puffiness may not be separate daily annoyances. They can be part of the same slow-drainage pattern. LinfaFlow is positioned as a liquid wellness ritual led by Cleavers, with Stillingia, Prickly Ash, and Red Clover as complementary botanicals.",
        cacheKey: "linfaflow-mechanism-cleavers-v1",
        kind: "cached" as const,
      };
    }

    return {
      text: `${leadName}, I read what you shared. I am looking at where it shows up, when it feels worst, what seems to trigger it, what you already tried, and what it affects day to day. That is what lets me make this feel specific instead of generic.`,
      cacheKey: "",
      kind: "personalized" as const,
    };
  }

  function toggleVoiceReplies() {
    const next = !voiceRepliesRef.current;
    voiceRepliesRef.current = next;
    setVoiceReplies(next);
  }

  async function attachVoiceReply(text: string, source: ChatMessage["source"], step = scriptStep, nextStage = stage, preferredCacheKey = "") {
    if (!shouldGenerateVoiceReply(text, preferredCacheKey)) return;
    const voicePlan = voicePlanForReply(text, step, nextStage, preferredCacheKey);
    try {
      const { data } = await supabase.functions.invoke("linfaflow-care-voice", {
        body: {
          text: voicePlan.text,
          session_id: sessionIdRef.current || sessionId || undefined,
          cache_key: voicePlan.cacheKey,
        },
      });
      if (!data?.ok || !data?.audio_url) {
        speakWithBrowserFallback(voicePlan.text);
        return;
      }
      setMessages((current) => {
        const next = [...current];
        for (let index = next.length - 1; index >= 0; index -= 1) {
          const item = next[index];
          if (item.sender === "assistant" && item.text === text && item.source === source && !item.audio_url) {
            next[index] = { ...item, audio_url: data.audio_url, audio_kind: data.cache_hit ? "cached" : voicePlan.kind };
            break;
          }
        }
        return next;
      });
    } catch {
      speakWithBrowserFallback(voicePlan.text);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    Array.from(files)
      .slice(0, 3)
      .forEach((file) => {
        const kind: LeadAttachment["kind"] | null = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : null;
        if (!kind) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (kind === "image") {
            setIntake((current) => ({ ...current, photo_consent: true }));
          }
          setAttachments((current) => [
            ...current,
            {
              kind,
              name: file.name,
              mime: file.type,
              data_url: String(reader.result),
              transcript: kind === "audio" ? "Audio note attached. Use live voice dictation for direct transcription when available." : undefined,
            },
          ].slice(-3));
        };
        reader.readAsDataURL(file);
      });
  }

  function removeAttachment(name: string) {
    setAttachments((current) => current.filter((attachment) => attachment.name !== name));
  }

  function startVoiceInput() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setDraft((current) => current || "Voice typing is not available in this browser. I will type my answer.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setDraft((current) => `${current ? `${current} ` : ""}${transcript}`.trim());
      setAttachments((current) => ([
        ...current,
        {
          kind: "audio" as const,
          name: "live-voice-note",
          mime: "speech-recognition/browser",
          transcript,
        },
      ] satisfies LeadAttachment[]).slice(-3));
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  async function persistStage(stageName: RoomStage, step: number) {
    const previousPersist = stagePersistRef.current;
    const run = (async () => {
      const pendingSessionId = sessionIdRef.current || (previousPersist ? await previousPersist : "") || (quizPersistRef.current ? await quizPersistRef.current : "");
      const { data } = await supabase.functions.invoke("linfaflow-care-ai", {
        body: {
          action: "stage_update",
          session_id: pendingSessionId || undefined,
          intake,
          latest: "",
          script_step: step,
          stage: stageName,
        },
      });
      rememberSession(data?.session_id || pendingSessionId, data?.public_token, Boolean(data?.persisted));
      return data?.session_id || pendingSessionId || null;
    })();
    stagePersistRef.current = run;
    try {
      await run;
    } catch {
      setPersisted(false);
    }
  }

  function startQueue() {
    setStage("consult");
    setScriptStep(2);
    persistStage("consult", 2);
    const firstName = intake.name.trim() || "there";
    const area = intake.swelling_area || "the area you mentioned";
    const timing = intake.worst_time || "the timing you described";
    const triggers = intake.triggers || "your daily triggers";
    const photoLine = hasSubmittedPhoto
      ? "I see you attached a photo. I can use it only as visual context, not as a medical diagnosis."
      : "A photo is optional. If you cannot send one now, I can still guide the review from your answers.";
    const safetyLine =
      temperature === "red_flag"
        ? "One thing you shared may need a medical-check-first approach, so I will be careful and avoid recommending a wellness routine as the first step."
        : "I do not see an obvious urgent warning sign from your answers, but this is still a wellness review, not a medical diagnosis.";
    setMessages([
      {
        sender: "assistant",
        text: `Thanks, ${firstName}. I read your answers and I am going to keep this focused on your real pattern, not generic swelling advice.`,
      },
      {
        sender: "assistant",
        text:
          temperature === "red_flag"
            ? `${safetyLine}\n\nTo make this useful, tell me what changed recently: did it start suddenly, is it one-sided, painful, red/hot, or connected to chest symptoms?`
            : `Here is what I am using to personalize this: it shows up around ${area}, tends to feel worse ${timing}, and seems connected with ${triggers}.\n\n${photoLine}\n\n${safetyLine}\n\nBefore I recommend any next step, what is the most frustrating part of this for you day to day?`,
      },
    ]);
  }

  function nextScriptStep(value: string) {
    const lower = value.toLowerCase();
    const buyingIntent = lower.includes("price") || lower.includes("order") || lower.includes("buy") || lower.includes("checkout") || lower.includes("cost");
    const objection = lower.includes("skept") || lower.includes("tried") || lower.includes("expensive") || lower.includes("ingredient") || lower.includes("doctor");
    if (temperature === "red_flag") return Math.min(scriptStep + 1, 5);
    if (buyingIntent && scriptStep >= 4) return 7;
    if (objection && scriptStep >= 4) return Math.max(scriptStep + 1, 6);
    return Math.min(scriptStep + 1, 6);
  }

  async function sendMessage(text: string) {
    const value = text.trim();
    const currentAttachments = attachments;
    if ((!value && currentAttachments.length === 0) || isAiThinking) return;
    const messageText =
      value ||
      (currentAttachments.some((attachment) => attachment.kind === "image")
        ? "I attached a photo. Please review what you can see and help me understand the pattern."
        : "I added a voice note. Please use the transcript and help me understand the pattern.");
    const next = value.toLowerCase().includes("price") || value.toLowerCase().includes("order") || value.toLowerCase().includes("buy");
    const nextStep = nextScriptStep(messageText);
    const nextCanClose = nextStep >= 7 && temperature !== "red_flag";
    const leadMessage: ChatMessage = { sender: "lead", text: messageText, attachments: currentAttachments };
    const nextMessages = [...messages, leadMessage];
    setMessages(nextMessages);
    setDraft("");
    setAttachments([]);
    setScriptStep(nextStep);
    if (nextCanClose) setStage("offer");
    else setStage("consult");

    setIsAiThinking(true);
    try {
      const pendingSessionId = sessionIdRef.current || (stagePersistRef.current ? await stagePersistRef.current : "");
      const { data, error } = await supabase.functions.invoke("linfaflow-care-ai", {
        body: {
          session_id: pendingSessionId || undefined,
          intake,
          messages: nextMessages,
          latest: messageText,
          attachments: currentAttachments,
          script_step: nextStep,
          can_close: nextCanClose,
          stage: nextCanClose ? "offer" : "consult",
        },
      });
      if (error) throw error;
      const source = (data?.source || "fallback") as ChatMessage["source"];
      rememberSession(data?.session_id || pendingSessionId, data?.public_token, Boolean(data?.persisted));
      setAiSource(source === "openrouter" ? "openrouter" : "fallback");
      const replyText =
        data?.reply ||
        (nextCanClose
          ? fallbackRecommendation(intake)
          : "That helps. Before I recommend anything, from 0 to 10, how ready are you to try a simple 30-day routine?");
      const media = mediaForScriptStep(nextStep, nextCanClose, temperature);
      setMessages((current) => [
        ...current,
        {
          sender: "assistant",
          source,
          text: replyText,
          media: media && current.some((message) => message.media?.src === media.src) ? undefined : media,
        },
      ]);
      attachVoiceReply(replyText, source, nextStep, nextCanClose ? "offer" : "consult", String(data?.voice_cache_key || ""));
    } catch {
      setAiSource("error");
      const replyText = nextCanClose
        ? fallbackRecommendation(intake)
        : "That helps. I am having trouble reaching the AI right now, so I will keep this simple: when is it worst, and from 0 to 10 how ready are you to try a 30-day daily routine?";
      const media = mediaForScriptStep(nextStep, nextCanClose, temperature);
      setMessages((current) => [
        ...current,
        {
          sender: "assistant",
          source: "local",
          text: replyText,
          media: media && current.some((message) => message.media?.src === media.src) ? undefined : media,
        },
      ]);
      attachVoiceReply(replyText, "local", nextStep, nextCanClose ? "offer" : "consult");
    } finally {
      setIsAiThinking(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  function trackCheckoutClick() {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;
    supabase.functions.invoke("linfaflow-care-ai", {
      body: { action: "checkout_click", session_id: currentSessionId },
    });
  }

  const currentQuiz = quizQuestions[quizStep];
  const quizProgress = Math.round(((quizStep + 1) / quizQuestions.length) * 100);
  const currentQuizValue = intake[currentQuiz.key];
  const isLastQuizStep = quizStep === quizQuestions.length - 1;
  const currentQuizCompanion = quizCompanions[currentQuiz.key];

  if (careView === "preparing") {
    const summary = [
      { label: "What you notice", value: intake.concern || "A repeated comfort pattern worth understanding." },
      { label: "When it is strongest", value: intake.worst_time || intake.timeline || "The timing you described." },
      { label: "What you already tried", value: intake.tried || "The outside-in fixes you have already explored." },
    ];

    return (
      <div className="min-h-screen bg-[#f5fbf8] text-slate-950">
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-6 sm:py-10">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden rounded-md border border-emerald-100 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.75, 1, 0.75] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-white"
                >
                  <ClipboardCheck className="h-4 w-4" />
                </motion.div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">Private pattern review</p>
                  <h1 className="mt-1 font-display text-2xl italic text-slate-950">Putting your answers together</h1>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <p className="text-sm leading-relaxed text-slate-700">
                This is not a diagnosis. It is a clearer starting point for a conversation that reflects your daily pattern instead of generic advice.
              </p>

              <div className="space-y-2">
                {summary.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + index * 0.18, duration: 0.25 }}
                    className="flex gap-3 rounded-md border border-emerald-100 bg-emerald-50/70 p-3"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">{item.label}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-800">{item.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.25 }} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-medium text-slate-900">Recognizable daily situations matter here.</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Long periods standing or sitting, travel, heat, and changes in routine can all be useful context. None of them mean something is wrong with you.
                </p>
                {temperature === "red_flag" && (
                  <p className="mt-2 text-xs leading-relaxed text-amber-900">One answer needs a medical-check-first conversation, so the next screen will prioritize that rather than a product recommendation.</p>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.25 }} className="flex items-center gap-2 text-xs text-emerald-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening your private conversation...
              </motion.div>
            </div>
          </motion.section>
        </main>
      </div>
    );
  }

  if (careView === "quiz") {
    return (
      <div className="min-h-screen bg-[#f5fbf8] text-slate-950">
        <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-5 sm:py-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <Stethoscope className="h-4 w-4" />
              <span className="text-[11px] font-medium uppercase tracking-[0.22em]">LinfaFlow Care</span>
            </div>
            <Badge variant="outline" className="border-emerald-200 bg-white text-[11px] text-emerald-800">
              {quizProgress}% ready
            </Badge>
          </div>

          <section className="flex flex-1 flex-col justify-center py-6">
            <div className="mb-5">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-emerald-700">
                <span>Private intake</span>
                <span>
                  {quizStep + 1}/{quizQuestions.length}
                </span>
              </div>
              <Progress value={quizProgress} className="mt-2 h-2" />
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentQuiz.key}
                initial={{ opacity: 0, y: 14, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.99 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm sm:p-5"
              >
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">{currentQuiz.eyebrow}</p>
              <h1 className="mt-3 font-display text-3xl italic leading-tight text-slate-950 sm:text-4xl">
                {currentQuiz.question}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{currentQuiz.helper}</p>

              {currentQuizCompanion && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.22 }}
                  className="mt-4 overflow-hidden rounded-md border border-emerald-100 bg-emerald-50/70"
                >
                  {currentQuizCompanion.image && (
                    <img
                      src={currentQuizCompanion.image}
                      alt={currentQuizCompanion.imageAlt || "LinfaFlow Care context"}
                      className="h-32 w-full bg-white object-contain object-center"
                      loading="eager"
                    />
                  )}
                  <div className="p-3">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700">{currentQuizCompanion.eyebrow}</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{currentQuizCompanion.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{currentQuizCompanion.text}</p>
                  </div>
                </motion.div>
              )}

              <div className="mt-5 grid gap-2">
                {currentQuiz.options.map((option) => {
                  const selected = currentQuizValue === option;
                  return (
                    <motion.button
                      key={option}
                      type="button"
                      onClick={() => answerQuiz(option)}
                      whileTap={{ scale: 0.985 }}
                      animate={{
                        scale: selected ? 1.01 : 1,
                        transition: { type: "spring", stiffness: 420, damping: 24 },
                      }}
                      className={`w-full rounded-md border px-4 py-3 text-left text-sm leading-relaxed transition ${
                        selected
                          ? "border-emerald-400 bg-emerald-50 text-emerald-950 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span>{option}</span>
                        {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <Textarea
                className="mt-4 min-h-24 border-emerald-100 bg-white text-slate-950"
                value={currentQuizValue}
                onChange={(event) => updateIntake(currentQuiz.key, event.target.value)}
                placeholder={currentQuiz.placeholder}
              />

              {quizStep === quizQuestions.length - 1 && (
                <div className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex items-start gap-3">
                    <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <p className="text-sm font-medium text-emerald-950">Optional photo or audio</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        If you can send a photo today, attach it. If not, no problem. The conversation will continue from your quiz answers.
                      </p>
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:border-emerald-300">
                        <Paperclip className="h-3.5 w-3.5" />
                        Attach file
                        <input type="file" accept="image/*,audio/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
                      </label>
                    </div>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {attachments.map((attachment) => (
                        <span key={`${attachment.name}-${attachment.kind}`} className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-900">
                          {attachment.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <label className="mt-3 flex cursor-pointer items-start gap-2 border-t border-emerald-100 pt-3 text-xs leading-relaxed text-slate-600">
                    <input
                      type="checkbox"
                      checked={intake.contact_consent}
                      onChange={(event) => updateIntakeBoolean("contact_consent", event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-700"
                    />
                    <span>I agree that LinfaFlow Care may use the contact I provided to send my private continuation link or follow up about this review.</span>
                  </label>
                </div>
              )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-4 rounded-md border border-emerald-100 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-emerald-700">Private review</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    Your answers are shaping a more personal conversation.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    The assistant will use this to summarize your pattern before recommending any next step.
                  </p>
                </div>
              </div>
              {temperature === "red_flag" && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                  This may need medical guidance first. The conversation will organize your notes and pause selling.
                </div>
              )}
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 border-t border-emerald-100 bg-[#f5fbf8]/95 px-4 py-3 backdrop-blur">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={previousQuizStep} disabled={quizStep === 0} className="border-emerald-100 bg-white text-slate-700">
                Back
              </Button>
              {isLastQuizStep ? (
                <Button type="button" onClick={completeQuiz} className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800">
                  Start private conversation
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button type="button" onClick={nextQuizStep} className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
              Private wellness support only. Not a medical diagnosis, cure, or medication advice.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5fbf8] text-slate-950">
      {isAdminPreview && (
      <>
      <section className="border-b border-emerald-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Stethoscope className="h-4 w-4" />
              <span className="text-xs uppercase tracking-[0.22em]">LinfaFlow Care Room</span>
            </div>
            <h1 className="mt-3 max-w-4xl font-display text-4xl italic text-slate-950 md:text-5xl">
              Get a private doctor-style review of your swelling pattern.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
              Answer a short quiz, add a photo if you can, and get guided support before choosing LinfaFlow. This is not a medical diagnosis, but it helps organize your symptoms, triggers, and next step.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-emerald-800">
              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">Doctor-style intake</span>
              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">Photo review for context</span>
              <span className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2">Personalized before checkout</span>
            </div>
          </div>
          <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
            {isAdminPreview
              ? aiSource === "openrouter"
                ? "OpenRouter connected"
                : aiSource === "error"
                  ? "Local fallback active"
                  : "Safe preview - no real messages sent"
              : "Private guided support"}
          </Badge>
        </div>
      </section>

      <section className="border-b border-emerald-100 bg-emerald-50/70">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <ClipboardCheck className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.2em]">Private wellness assessment</p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {assessmentSteps.map((step) => (
                <div key={step.label} className="rounded-md border border-emerald-100 bg-emerald-50/60 p-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-emerald-800">{step.label}</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-700">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.2em]">Why this feels personal</p>
            </div>
            <div className="mt-4 space-y-3">
              {proofPoints.map((item) => (
                <div key={item.title} className="flex gap-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      </>
      )}

      <main className={`mx-auto grid gap-4 px-4 py-5 ${isAdminPreview ? "max-w-7xl lg:grid-cols-[360px_minmax(0,1fr)_340px]" : "max-w-3xl"}`}>
        {isAdminPreview && (
        <aside className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-emerald-700" />
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Doctor-style intake quiz</p>
          </div>
          <div className="mt-4 space-y-3">
            <label className="space-y-1.5 text-xs text-slate-500">
              Name
              <Input className="border-emerald-100 bg-white text-slate-950" value={intake.name} onChange={(event) => updateIntake("name", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Age range
              <select className="h-10 w-full rounded-md border border-emerald-100 bg-white px-3 text-sm text-slate-950" value={intake.age_range} onChange={(event) => updateIntake("age_range", event.target.value)}>
                <option>35-44</option>
                <option>45-64</option>
                <option>65+</option>
                <option>Prefer not to say</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Where do you notice it most?
              <Input className="border-emerald-100 bg-white text-slate-950" value={intake.swelling_area} onChange={(event) => updateIntake("swelling_area", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Main concern
              <Textarea className="border-emerald-100 bg-white text-slate-950" value={intake.concern} onChange={(event) => updateIntake("concern", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Timeline
              <Input className="border-emerald-100 bg-white text-slate-950" value={intake.timeline} onChange={(event) => updateIntake("timeline", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              When is it worst?
              <Input className="border-emerald-100 bg-white text-slate-950" value={intake.worst_time} onChange={(event) => updateIntake("worst_time", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              What seems to trigger it?
              <Textarea className="border-emerald-100 bg-white text-slate-950" value={intake.triggers} onChange={(event) => updateIntake("triggers", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              How does it affect your day?
              <Textarea className="border-emerald-100 bg-white text-slate-950" value={intake.impact} onChange={(event) => updateIntake("impact", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Tried before
              <Textarea className="border-emerald-100 bg-white text-slate-950" value={intake.tried} onChange={(event) => updateIntake("tried", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Safety check
              <Textarea className="border-emerald-100 bg-white text-slate-950" value={intake.red_flags} onChange={(event) => updateIntake("red_flags", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Medications or diagnosed conditions
              <Textarea className="border-emerald-100 bg-white text-slate-950" value={intake.meds_or_conditions} onChange={(event) => updateIntake("meds_or_conditions", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-slate-500">
              Preferred contact
              <Input className="border-emerald-100 bg-white text-slate-950" value={intake.contact} onChange={(event) => updateIntake("contact", event.target.value)} />
            </label>
          </div>
          <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-start gap-3">
              <ImagePlus className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              <div>
                <p className="text-sm font-medium text-emerald-950">Optional photo today</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  A clear photo of sock marks, ankle puffiness, or tight-shoe marks helps the assistant understand visible context. If you cannot send one, no problem. The review still works from your answers.
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:border-emerald-300">
                  <Paperclip className="h-3.5 w-3.5" />
                  Attach photo or audio
                  <input type="file" accept="image/*,audio/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
                </label>
              </div>
            </div>
            <label className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-600">
              <input
                type="checkbox"
                checked={intake.photo_consent}
                onChange={(event) => updateIntakeBoolean("photo_consent", event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-700"
              />
              I agree to share the photo/audio as context for this private wellness assessment.
            </label>
          </div>
          {temperature === "red_flag" && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Safety signal detected. The assistant should pause selling and recommend timely medical evaluation before any wellness routine.</p>
                </div>
              </div>
            )}
          <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-emerald-700">Fit score</span>
              <span className="font-display text-3xl text-emerald-950">{score}%</span>
            </div>
            <Progress value={score} className="mt-2" />
          </div>
          <div className={`mt-3 rounded-md border p-3 text-xs leading-relaxed ${temperatureDetails.className}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium uppercase tracking-[0.16em]">{temperatureDetails.label}</span>
              <span>{temperature}</span>
            </div>
            <p className="mt-2 font-medium">{temperatureDetails.title}</p>
            <p className="mt-1">{temperatureDetails.text}</p>
          </div>
          <Button className="mt-4 w-full bg-emerald-700 text-white hover:bg-emerald-800" onClick={startQueue}>
            Check my situation
            <ArrowRight className="h-4 w-4" />
          </Button>
        </aside>
        )}

        <section className="flex min-h-[680px] flex-col rounded-md border border-emerald-100 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <MessageCircle className="h-4 w-4" />
                <p className="text-xs uppercase tracking-[0.2em]">Lead web experience</p>
              </div>
              <h2 className="mt-1 font-display text-2xl italic text-slate-950">{stageCopy[stage].title}</h2>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              Private review
            </div>
            {isDemoPreview && (
              <div className="flex w-full flex-wrap items-center gap-2 border-t border-emerald-100 pt-3">
                <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700">Simulation</span>
                {careDemos.map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    onClick={() => loadCareDemo(demo)}
                    className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                      activeDemoId === demo.id
                        ? "border-emerald-500 bg-emerald-700 text-white"
                        : "border-emerald-100 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-900"
                    }`}
                    title={demo.subtitle}
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {stage === "queue" && (
            <div className="border-b border-emerald-100 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div>
                  <p className="text-sm font-medium text-emerald-950">Your private review is being prepared.</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    We are preparing the conversation using your answers. This keeps the guidance specific instead of generic.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message, index) => (
              <div key={`${message.sender}-${index}`} className={`flex ${message.sender === "lead" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm leading-relaxed sm:max-w-[78%] ${
                    message.sender === "lead" ? "rounded-br-md border-emerald-200 bg-emerald-50 text-emerald-950" : "rounded-bl-md border-slate-200 bg-white text-slate-800 shadow-sm"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-emerald-700">
                    {message.sender === "lead" ? "You" : "LinfaFlow assistant"}
                    {isAdminPreview && message.source === "openrouter" && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] text-emerald-800">OpenRouter</span>}
                  </div>
                  {message.text}
                  {message.media && (
                    <figure className="mt-3 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/60">
                      <img src={message.media.src} alt={message.media.alt} className="max-h-72 w-full object-cover" loading="lazy" />
                      <figcaption className="p-3">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-700">{message.media.eyebrow}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">{message.media.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{message.media.caption}</p>
                      </figcaption>
                    </figure>
                  )}
                  {message.audio_url && (
                    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-2">
                      {isAdminPreview && (
                        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-emerald-700">
                          {message.audio_kind === "cached" ? "Cached script audio" : "Personalized voice"}
                        </p>
                      )}
                      <audio controls src={message.audio_url} className="h-9 w-full" />
                    </div>
                  )}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-3 grid gap-2">
                      {message.attachments.map((attachment) => (
                        <div key={`${attachment.name}-${attachment.kind}`} className="rounded-md border border-emerald-100 bg-white/80 p-2 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            {attachment.kind === "image" ? <ImagePlus className="h-3.5 w-3.5 text-emerald-700" /> : <Mic className="h-3.5 w-3.5 text-emerald-700" />}
                            <span className="font-medium text-slate-800">{attachment.name}</span>
                          </div>
                          {attachment.kind === "image" && attachment.data_url && (
                            <img src={attachment.data_url} alt={attachment.name} className="mt-2 max-h-40 rounded border border-emerald-100 object-contain" />
                          )}
                          {attachment.transcript && <p className="mt-2 leading-relaxed">{attachment.transcript}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isAiThinking && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />
                  LinfaFlow assistant is reviewing your answers...
                </div>
              </div>
            )}
          </div>

          {hasCheckoutOffer && (
            <div className="border-t border-emerald-100 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-emerald-950">Your personalized assessment summary is ready.</p>
                    <span className={`rounded px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] ${temperatureDetails.className}`}>
                      {temperatureDetails.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    This is not a diagnosis. It is a structured review of what you shared so the next step feels specific instead of generic.
                  </p>
                  <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                    {recommendationPoints.map((item) => (
                      <div key={item.label} className="rounded-md border border-emerald-100 bg-emerald-50/70 p-3">
                        <p className="font-medium text-emerald-900">{item.label}</p>
                        <p className="mt-1 line-clamp-3 leading-relaxed">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-600">
                    Based on that pattern, the simplest next step is a 30-day LinfaFlow wellness routine. The logic is inside support: Cleavers-led botanical support, a liquid 30-second ritual, and a simpler daily routine than repeating outside-in fixes. Review checkout terms and ingredients first. Ask a doctor or pharmacist if you have a diagnosed condition, take medication, are pregnant, or have sudden/severe swelling.
                  </p>
                </div>
                <Button asChild className="shrink-0 bg-emerald-700 text-white hover:bg-emerald-800">
                  <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" onClick={trackCheckoutClick}>
                    Start my 30-day routine
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="border-t border-emerald-100 bg-slate-50/70 p-4">
            <div className="mb-2 flex flex-wrap gap-2">
              <button type="button" disabled={isAiThinking} onClick={() => sendMessage("It is worst in the evening after standing.")} className="rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-900 disabled:opacity-50">
                Evening after standing
              </button>
              <button type="button" disabled={isAiThinking} onClick={() => sendMessage("I am skeptical because I already tried many things.")} className="rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-900 disabled:opacity-50">
                I tried many things
              </button>
              <button type="button" disabled={isAiThinking} onClick={() => sendMessage("Can you explain how LinfaFlow is different before I decide?")} className="rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-900 disabled:opacity-50">
                How is it different?
              </button>
              <button type="button" disabled={isAiThinking} onClick={() => sendMessage("I can send a photo of the swelling and sock marks if that helps.")} className="rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-900 disabled:opacity-50">
                I can send a photo
              </button>
              <button type="button" disabled={isAiThinking} onClick={() => sendMessage("I cannot send a photo right now, but I can describe the timing, sock marks, and how my shoes feel.")} className="rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-600 hover:border-emerald-300 hover:text-emerald-900 disabled:opacity-50">
                No photo now
              </button>
            </div>
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((attachment) => (
                  <div key={`${attachment.name}-${attachment.kind}`} className="flex items-center gap-2 rounded-md border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-600">
                    {attachment.kind === "image" ? <ImagePlus className="h-3.5 w-3.5 text-emerald-700" /> : <Mic className="h-3.5 w-3.5 text-emerald-700" />}
                    <span className="max-w-[180px] truncate">{attachment.name}</span>
                    <button type="button" onClick={() => removeAttachment(attachment.name)} className="text-slate-400 hover:text-red-600" aria-label={`Remove ${attachment.name}`}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input className="border-emerald-100 bg-white text-slate-950" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write your answer..." />
              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-emerald-100 bg-white px-3 text-slate-600 hover:border-emerald-300 hover:text-emerald-900" title="Attach photo or audio">
                <Paperclip className="h-4 w-4" />
                <input type="file" accept="image/*,audio/*" multiple className="hidden" onChange={(event) => handleFiles(event.target.files)} />
              </label>
              <Button type="button" variant="outline" disabled={isAiThinking || isListening} onClick={startVoiceInput} className="border-emerald-100 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-900" title="Speak instead of typing">
                {isListening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="outline" onClick={toggleVoiceReplies} className={`border-emerald-100 bg-white hover:border-emerald-300 ${voiceReplies ? "text-emerald-800" : "text-slate-600"}`} title="Assistant voice replies">
                <Volume2 className="h-4 w-4" />
              </Button>
              <Button type="submit" disabled={isAiThinking} className="bg-emerald-700 text-white hover:bg-emerald-800">Send</Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              You can attach a photo for visual context or use the microphone to dictate. Photos are read as context only, not as a medical diagnosis.
            </p>
          </form>
        </section>

        {isAdminPreview && (
        <aside className="space-y-4">
          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-emerald-700" />
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">OpenFlow stage</p>
            </div>
            <div className="mt-4 space-y-2">
              {scriptSteps.map((item, index) => (
                <div
                  key={item.id}
                  className={`rounded-md border p-3 text-xs ${
                    index === scriptStep
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : index < scriptStep
                        ? "border-emerald-100 bg-white text-slate-500"
                        : "border-slate-100 bg-slate-50 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{index + 1}. {item.label}</span>
                    {index < scriptStep && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                  </div>
                  <p className="mt-1 leading-relaxed">{item.pt}</p>
                </div>
              ))}
            </div>
            <div className={`mt-4 rounded-md border p-3 text-xs ${canClose ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
              {canClose ? "Pronto para fechamento: ja passou por entendimento e objecao." : temperature === "red_flag" ? "Nao fechar: sinal de seguranca pede orientacao medica primeiro." : "Ainda nao vender direto: usar interesse como sinal e continuar qualificando."}
            </div>
            <div className={`mt-3 rounded-md border p-3 text-xs leading-relaxed ${temperatureDetails.className}`}>
              <p><span className="font-medium">Temperatura:</span> {temperatureDetails.label}</p>
              <p className="mt-1">{temperatureDetails.text}</p>
              <p className="mt-2"><span className="font-medium">Foto:</span> {hasSubmittedPhoto ? "enviada como contexto visual" : "nao enviada, seguir por quiz/conversa"}</p>
            </div>
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <p><span className="font-medium text-slate-800">Supabase:</span> {persisted ? "sessao salva" : "aguardando primeira resposta salva"}</p>
              <p><span className="font-medium text-slate-800">Session:</span> {sessionId || "-"}</p>
              <p><span className="font-medium text-slate-800">Public token:</span> {publicToken || "-"}</p>
            </div>
          </div>

          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-emerald-700" />
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Por que melhora</p>
            </div>
            <h3 className="mt-2 font-display text-2xl italic text-slate-950">{stageCopy[stage].title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{stageCopy[stage].pt}</p>
          </div>

          <div className="rounded-md border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Compliance guardrails</p>
            </div>
            <div className="mt-4 space-y-2">
              {safetyItems.map((item) => (
                <div key={item} className="flex gap-2 rounded-md border border-emerald-100 bg-emerald-50/70 p-3 text-xs leading-relaxed text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.2em]">Falta para producao</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Sessao e eventos ja salvam no Supabase. O proximo passo e sincronizar estes registros com contato/tag do Messenger e disparar handoff humano quando houver sinal sensivel ou alta intencao.
            </p>
          </div>

          <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-center gap-2 text-teal-700">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.2em]">Script unico</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              O desenho do atendimento esta no OpenFlow como um script unico inativo: intake, seguranca, IA para saidas do roteiro, realidade, prova, audio, objecoes, pitch, checkout e follow-up.
            </p>
            <Button asChild variant="outline" className="mt-4 w-full border-teal-200 bg-white text-teal-800 hover:bg-teal-100">
              <a href={careOpenFlowPath}>
                Ver script no OpenFlow
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </aside>
        )}
      </main>
    </div>
  );
}
