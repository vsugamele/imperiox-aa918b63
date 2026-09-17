import { FormEvent, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

type StageId = "opening" | "spin" | "mechanism" | "proof" | "temperature" | "objection" | "close" | "followup";
type Sender = "ai" | "lead" | "system";

type Message = {
  id: number;
  sender: Sender;
  stage: StageId;
  text: string;
};

type LeadState = {
  name: string;
  symptom: string;
  tried: string;
  objection: string;
  temperature: string;
};

const stageMeta: Record<StageId, { title: string; pt: string; risk: string }> = {
  opening: {
    title: "Opening",
    pt: "Abertura com escolha simples. Baixa friccao: o lead responde 1, 2, 3 ou texto livre.",
    risk: "Bom para Messenger. So precisa garantir que a primeira pergunta nao pareca diagnostico.",
  },
  spin: {
    title: "SPIN diagnosis",
    pt: "IA investiga situacao, problema, implicacao e necessidade. Essa e a parte que faz o lead sentir personalizacao.",
    risk: "O risco e a IA perguntar demais antes de avancar. Precisa manter uma pergunta por vez.",
  },
  mechanism: {
    title: "Mechanism reframe",
    pt: "Reframe: exames normais nao encerram a conversa sobre rotina, sensacao de peso e suporte diario.",
    risk: "Nao pode contradizer medico nem prometer efeito terapeutico.",
  },
  proof: {
    title: "Proof + product logic",
    pt: "Mostra por que LinfaFlow e uma rotina diferente de drenagem, meia ou diuretico.",
    risk: "Provas e imagens precisam ser assets reais ou aprovados. Placeholder derruba confianca.",
  },
  temperature: {
    title: "Temperature read",
    pt: "Pergunta 0-10 antes de vender. Isso evita mandar checkout cedo demais.",
    risk: "Se o lead der 6-8, a IA precisa descobrir a lacuna antes do link.",
  },
  objection: {
    title: "Objection handling",
    pt: "Responde preco, ceticismo, 'ja tentei tudo', medico, medicacao e timing.",
    risk: "A IA nao deve inventar desconto, prazo, preco ou alegacao medica.",
  },
  close: {
    title: "Assumptive close",
    pt: "Fecha com escolha entre 1 bottle e bundle, garantia e checkout.",
    risk: "Precisa do `link_checkout` real configurado, senao o fluxo conversa mas nao vende.",
  },
  followup: {
    title: "Follow-up",
    pt: "Follow-up sem urgencia falsa: reabre com garantia, inercia e angulo novo.",
    risk: "Cadencia longa precisa parar quando houver compra ou resposta sensivel.",
  },
};

const defaultLead: LeadState = {
  name: "Linda",
  symptom: "heavy swollen legs by the end of the day and sock marks around my ankles",
  tried: "compression socks, leg elevation, and lymphatic drainage once a month",
  objection: "I am afraid this will be another supplement that does not work for me",
  temperature: "8",
};

const starterMessages: Message[] = [
  {
    id: 1,
    sender: "ai",
    stage: "opening",
    text:
      "Hi Linda. Quick one before we start - which one bothers you more right now?\n\n1. Waking up with a puffy face and eyes\n2. Heavy, swollen legs by the end of the day\n3. Bloating / fluid retention\n4. A little bit of everything",
  },
];

const quickReplies = [
  "2 - Heavy swollen legs by the end of the day.",
  "I already tried compression socks and drainage.",
  "I am around an 8, but I am skeptical.",
  "How much is it and where do I order?",
];

function detectStage(input: string, current: StageId): StageId {
  const lower = input.toLowerCase();
  if (lower.includes("order") || lower.includes("buy") || lower.includes("link") || lower.includes("price")) return "close";
  if (lower.includes("skept") || lower.includes("expensive") || lower.includes("tried") || lower.includes("doctor")) return "objection";
  if (/\b(0|1|2|3|4|5|6|7|8|9|10)\b/.test(lower)) return "temperature";
  if (lower.includes("compression") || lower.includes("drainage") || lower.includes("sock")) return "proof";
  if (current === "opening") return "spin";
  if (current === "spin") return "mechanism";
  if (current === "mechanism") return "proof";
  if (current === "proof") return "temperature";
  if (current === "temperature") return "objection";
  if (current === "objection") return "close";
  return "followup";
}

function responseFor(stage: StageId, lead: LeadState): string {
  const name = lead.name.trim() || "there";

  if (stage === "spin") {
    return `${name}, that makes sense. When you say "${lead.symptom}", I want to understand the pattern first: how long has this been happening, and is it worse in the evening, after standing/sitting, or even when you wake up?`;
  }

  if (stage === "mechanism") {
    return `Thank you for being so specific. The frustrating part is that many women hear "everything looks normal" and still feel the same heaviness every day.\n\nI'm not here to diagnose you. I just want to understand what this has already cost you in real life: shoes, clothes, photos, plans, confidence?`;
  }

  if (stage === "proof") {
    return `What you tried matters: ${lead.tried} all work mostly from the outside or for a short window.\n\nLINFAFLOW is positioned differently: a liquid daily wellness ritual that supports lymphatic flow, healthy circulation and fluid balance from the inside. Not a cure, not a water pill, not a miracle. Just a 30-second routine that is easier to keep.`;
  }

  if (stage === "temperature") {
    return `Before I send you anything, quick temperature check: from 0 to 10, how much does this make sense for your situation right now?`;
  }

  if (stage === "objection") {
    return `I hear you. When you say "${lead.objection}", I would not push you with hype.\n\nThe safest way to think about it is this: one bottle is a 30-day test of the routine. If medication or a diagnosed condition is involved, run the ingredient list by your doctor or pharmacist first. If your concern is wasting money, the guarantee is there so the risk is not all on you.`;
  }

  if (stage === "close") {
    return `Perfect, ${name}. Based on what you told me, I would start simple: follow the ritual for 30 days and track how your mornings, ankles and end-of-day heaviness feel.\n\nYou can start with one bottle or choose the multi-bottle bundle for better value per day.\n\nSecure checkout: {{link_checkout}}\n\n30-day money-back guarantee applies according to the checkout terms.`;
  }

  return `${name}, maybe this is not the right time, and that is okay. I just wanted to check one thing: has the heaviness you told me about changed at all since we last talked?\n\nIf you want to look again, here is the checkout: {{link_checkout}}`;
}

function scoreLead(lead: LeadState, stage: StageId) {
  let score = 38;
  const text = `${lead.symptom} ${lead.tried} ${lead.objection}`.toLowerCase();
  if (text.includes("swollen") || text.includes("heavy") || text.includes("sock")) score += 18;
  if (text.includes("compression") || text.includes("drainage") || text.includes("tried")) score += 14;
  if (text.includes("afraid") || text.includes("skeptical") || text.includes("not work")) score += 10;
  score += Number(lead.temperature || 0) * 3;
  if (stage === "close") score += 10;
  return Math.min(score, 96);
}

const auditItems = [
  { ok: true, text: "Fluxo real EN-US existe no OpenFlow e ja usa IA Conversacional." },
  { ok: true, text: "A versao PT-BR foi criada so como rascunho/entendimento, inativa." },
  { ok: true, text: "Executor agora resolve {{link_checkout}} usando o checkout da automacao." },
  { ok: false, text: "Assets de prova ainda precisam ser ligados como midia real, nao placeholders." },
  { ok: false, text: "Antes de ativar PT/EN em producao, precisa testar provider, tag, checkout e parada por compra." },
];

export default function LinfaFlowX1Ready() {
  const [lead, setLead] = useState(defaultLead);
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [draft, setDraft] = useState("");
  const currentStage = messages[messages.length - 1]?.stage || "opening";
  const score = useMemo(() => scoreLead(lead, currentStage), [lead, currentStage]);

  function updateLead(key: keyof LeadState, value: string) {
    setLead((current) => ({ ...current, [key]: value }));
  }

  function send(text: string) {
    const value = text.trim();
    if (!value) return;
    const nextStage = detectStage(value, currentStage);
    setMessages((current) => [
      ...current,
      { id: Date.now(), sender: "lead", stage: currentStage, text: value },
      { id: Date.now() + 1, sender: "ai", stage: nextStage, text: responseFor(nextStage, lead) },
    ]);
    setDraft("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(draft);
  }

  function reset() {
    setMessages(starterMessages);
    setDraft("");
  }

  return (
    <div className="page-oxygen space-y-6">
      <section className="page-header">
        <div>
          <span className="page-header-kicker">LinfaFlow X1 Ready Preview</span>
          <h1 className="page-header-title">English flow, Portuguese strategy view</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Preview visual do fluxo real em ingles. A conversa mostra o que o lead veria; os paineis em portugues explicam
            a logica, riscos e melhorias antes de ativar em producao.
          </p>
        </div>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="rounded-md border border-border/50 bg-card/55 p-4">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-gold" />
            <p className="kicker">Lead simulator</p>
          </div>
          <div className="mt-4 space-y-3">
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Name
              <Input value={lead.name} onChange={(event) => updateLead("name", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Main symptom
              <Textarea value={lead.symptom} onChange={(event) => updateLead("symptom", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Tried before
              <Textarea value={lead.tried} onChange={(event) => updateLead("tried", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Main objection
              <Textarea value={lead.objection} onChange={(event) => updateLead("objection", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Temperature 0-10
              <Input value={lead.temperature} onChange={(event) => updateLead("temperature", event.target.value)} />
            </label>
          </div>

          <div className="mt-5 rounded-md border border-gold/25 bg-gold/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-gold">Intent</span>
              <span className="font-display text-3xl text-foreground">{score}%</span>
            </div>
            <Progress value={score} className="mt-2" />
          </div>
        </aside>

        <main className="flex min-h-[720px] flex-col rounded-md border border-border/50 bg-card/50">
          <div className="flex items-center justify-between gap-3 border-b border-border/50 p-4">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-gold" />
                <p className="kicker">Lead-facing conversation</p>
              </div>
              <h2 className="mt-1 font-display text-2xl italic">What the project shows in English</h2>
            </div>
            <Badge variant="outline" className="border-gold/30 text-gold">
              {stageMeta[currentStage].title}
            </Badge>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === "lead" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[86%] whitespace-pre-wrap rounded-md border px-4 py-3 text-sm leading-relaxed ${
                    message.sender === "lead"
                      ? "border-gold/35 bg-gold/15 text-foreground"
                      : "border-border/60 bg-background/70 text-foreground"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-gold/80">
                    {message.sender === "lead" ? "Lead" : "LinfaFlow AI"} - {stageMeta[message.stage].title}
                  </div>
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/50 p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => send(reply)}
                  className="rounded-md border border-border/70 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                >
                  {reply}
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex gap-2">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Type as the English-speaking lead..."
                className="h-11"
              />
              <Button type="submit" className="h-11">
                <Send className="h-4 w-4" />
                Send
              </Button>
            </form>
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-md border border-border/50 bg-card/55 p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gold" />
              <p className="kicker">Explicacao em PT</p>
            </div>
            <h3 className="mt-2 font-display text-2xl italic">{stageMeta[currentStage].title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-foreground">{stageMeta[currentStage].pt}</p>
            <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                Atencao
              </div>
              {stageMeta[currentStage].risk}
            </div>
          </div>

          <div className="rounded-md border border-border/50 bg-card/55 p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-gold" />
              <p className="kicker">Mapa do funil</p>
            </div>
            <div className="mt-4 space-y-2">
              {(Object.keys(stageMeta) as StageId[]).map((stage, index) => (
                <div
                  key={stage}
                  className={`rounded-md border p-3 text-xs ${
                    stage === currentStage ? "border-gold/50 bg-gold/10 text-foreground" : "border-border/50 bg-background/40 text-muted-foreground"
                  }`}
                >
                  <span className="mr-2 text-gold">{index + 1}.</span>
                  {stageMeta[stage].title}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border/50 bg-card/55 p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-gold" />
              <p className="kicker">Checklist de producao</p>
            </div>
            <div className="mt-4 space-y-2">
              {auditItems.map((item) => (
                <div key={item.text} className="flex gap-2 rounded-md border border-border/50 bg-background/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
                  {item.text}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-gold/30 bg-gold/10 p-4">
            <div className="flex items-center gap-2 text-gold">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Proxima melhoria</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              Ligar a pagina de preview ao registro real do OpenFlow para testar bloco por bloco com dados do banco, sem disparar mensagens reais.
            </p>
            <Button className="mt-4 w-full" asChild>
              <a href="/openflow?automacao=7bb7549a-981d-494c-a1af-3ab3bd53f1f1">
                Abrir fluxo real EN-US
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </aside>
      </section>
    </div>
  );
}
