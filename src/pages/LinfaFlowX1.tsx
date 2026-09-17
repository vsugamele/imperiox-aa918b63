import { FormEvent, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ClipboardList,
  ImagePlus,
  MessageCircle,
  RotateCcw,
  Send,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

type Sender = "ai" | "lead" | "system";

type Message = {
  id: number;
  sender: Sender;
  text: string;
  tag?: string;
};

type LeadProfile = {
  name: string;
  age: string;
  pain: string;
  moment: string;
  routine: string;
  objection: string;
};

const starterMessages: Message[] = [
  {
    id: 1,
    sender: "ai",
    tag: "Acolhimento",
    text:
      "Oi, eu sou a assistente da LinfaFlow. Vou te fazer algumas perguntas simples para entender seu caso e montar uma orientação personalizada. Isso não substitui avaliação médica, mas ajuda a separar o que merece atenção e qual rotina pode fazer sentido para você.",
  },
  {
    id: 2,
    sender: "ai",
    tag: "Pergunta 1",
    text: "Para começar: o que mais te incomoda hoje nas pernas ou na retenção?",
  },
];

const quickReplies = [
  "Minhas pernas ficam pesadas no fim do dia.",
  "Tenho inchaço nos tornozelos e marcas de meia.",
  "Já tentei drenagem, mas não consigo manter rotina.",
  "Tenho medo de comprar e não funcionar para mim.",
];

const scriptSteps = [
  {
    title: "1. Acolher",
    body: "Validar o incômodo sem assustar e explicar que é uma triagem educativa.",
  },
  {
    title: "2. Investigar",
    body: "Perguntar dor, peso, marca de meia, rotina, tempo em pé/sentada e tentativas anteriores.",
  },
  {
    title: "3. Personalizar",
    body: "Conectar a resposta do lead a um plano simples: constância, massagem, movimento e hidratação.",
  },
  {
    title: "4. Provar",
    body: "Mostrar por que LinfaFlow entra como facilitador da rotina, sem prometer cura.",
  },
  {
    title: "5. Vender",
    body: "Fechar com recomendação compatível com o perfil, garantia e CTA para checkout.",
  },
];

const defaultProfile: LeadProfile = {
  name: "Marina",
  age: "47",
  pain: "pernas pesadas, tornozelo inchado e sensação de retenção no fim do dia",
  moment: "chega em casa cansada e evita roupa curta porque a perna parece maior",
  routine: "fica muitas horas sentada, bebe pouca água e não consegue manter drenagem toda semana",
  objection: "tem receio de gastar com mais uma coisa que acaba ficando parada",
};

function scoreFromProfile(profile: LeadProfile, imageNote: string) {
  const text = `${profile.pain} ${profile.moment} ${profile.routine} ${profile.objection} ${imageNote}`.toLowerCase();
  let score = 42;
  if (text.includes("tornozelo") || text.includes("meia")) score += 14;
  if (text.includes("pesad") || text.includes("fim do dia")) score += 12;
  if (text.includes("sentad") || text.includes("em pé") || text.includes("pe")) score += 9;
  if (text.includes("drenagem") || text.includes("massagem")) score += 8;
  if (text.includes("medo") || text.includes("receio") || text.includes("não funcionar")) score += 6;
  return Math.min(score, 94);
}

function nextAiMessage(input: string, profile: LeadProfile, imageNote: string, count: number): Message {
  const lower = input.toLowerCase();
  const name = profile.name.trim() || "você";
  const imageContext = imageNote
    ? " Como você também trouxe imagem/contexto visual, eu trataria isso como sinal para acompanhar evolução por foto e procurar avaliação profissional se houver dor forte, vermelhidão, calor local ou piora rápida."
    : "";

  if (lower.includes("foto") || lower.includes("imagem") || lower.includes("tornozelo") || lower.includes("meia")) {
    return {
      id: Date.now(),
      sender: "ai",
      tag: "Leitura visual",
      text:
        `${name}, pela sua descrição, o ponto importante não é só a aparência: é entender se esse inchaço muda ao longo do dia, se deixa marca e se melhora com elevação ou movimento.${imageContext} Para personalizar, eu colocaria você no perfil "retenção de rotina": precisa de um ritual curto, repetível e fácil de manter.`,
    };
  }

  if (lower.includes("preço") || lower.includes("caro") || lower.includes("funcionar") || lower.includes("medo")) {
    return {
      id: Date.now(),
      sender: "ai",
      tag: "Objeção",
      text:
        `${name}, faz sentido ter esse cuidado. Eu não te venderia como promessa médica. A recomendação é: se você quer algo para facilitar uma rotina diária de massagem e autocuidado, LinfaFlow encaixa melhor do que depender de drenagem toda semana. Começaria pelo kit com garantia, acompanhando sensação de peso, marca de meia e fotos semanais.`,
    };
  }

  if (count > 7) {
    return {
      id: Date.now(),
      sender: "ai",
      tag: "Fechamento",
      text:
        `${name}, pelo que você contou: ${profile.pain}. O caminho mais realista é um protocolo simples de 10 minutos por dia, com acompanhamento visual e sem promessa de cura. Se você quer testar com baixo atrito, minha recomendação é seguir para o kit LinfaFlow com garantia e começar hoje pelo ritual guiado.`,
    };
  }

  return {
    id: Date.now(),
    sender: "ai",
    tag: count < 4 ? "Investigação" : "Personalização",
    text:
      `${name}, isso combina com o que muitas mulheres relatam quando a rotina trava circulação e retenção: ${profile.routine}. Quero entender uma coisa antes de recomendar: isso piora mais no fim do dia, depois de ficar sentada/em pé, ou aparece mesmo ao acordar?`,
  };
}

function buildPersonalizedScript(profile: LeadProfile, score: number, imageNote: string) {
  const firstName = profile.name.trim() || "lead";
  return [
    `Abrir chamando pelo nome: "${firstName}, vi que seu ponto principal é ${profile.pain}."`,
    `Validar o momento emocional: "${profile.moment}."`,
    `Investigar rotina: ${profile.routine}.`,
    imageNote
      ? `Usar leitura de imagem como apoio: ${imageNote}. Nunca diagnosticar pela foto; orientar sinais de alerta.`
      : "Pedir foto opcional de tornozelo/perna apenas para acompanhar evolução visual, não para diagnóstico.",
    `Classificar intenção em ${score >= 75 ? "alta" : score >= 58 ? "média" : "fria"} e avançar para recomendação de rotina.`,
    `Fechar objeção: ${profile.objection}.`,
    "CTA: levar para /go/linfaflow/ com garantia, protocolo de uso e aviso de que não substitui consulta.",
  ];
}

export default function LinfaFlowX1() {
  const [profile, setProfile] = useState<LeadProfile>(defaultProfile);
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [draft, setDraft] = useState("");
  const [imageNote, setImageNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const score = useMemo(() => scoreFromProfile(profile, imageNote), [profile, imageNote]);
  const script = useMemo(() => buildPersonalizedScript(profile, score, imageNote), [profile, score, imageNote]);
  const leadType = score >= 75 ? "Pronto para oferta" : score >= 58 ? "Precisa de prova" : "Ainda em educação";

  function updateProfile(key: keyof LeadProfile, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  function sendMessage(text: string) {
    const value = text.trim();
    if (!value) return;

    const leadMessage: Message = { id: Date.now(), sender: "lead", text: value };
    const aiMessage = nextAiMessage(value, profile, imageNote, messages.length + 1);
    setMessages((current) => [...current, leadMessage, aiMessage]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  function resetConversation() {
    setMessages(starterMessages);
    setDraft("");
    setImageNote("");
  }

  function handleFile(file?: File) {
    if (!file) return;
    const detail = file.type.startsWith("image/")
      ? `Imagem recebida: ${file.name}. A IA deve observar simetria visual, marcas de meia, vermelhidão aparente e evolução ao longo do tempo, sem diagnosticar.`
      : `Arquivo recebido: ${file.name}. Encaminhar para leitura multimodal quando a API estiver conectada.`;
    setImageNote(detail);
    setMessages((current) => [
      ...current,
      { id: Date.now(), sender: "system", tag: "Imagem", text: detail },
      {
        id: Date.now() + 1,
        sender: "ai",
        tag: "Próximo passo",
        text:
          "Recebi o arquivo. Para a versão com IA real, eu leria a imagem e cruzaria com seus sintomas. Nesta simulação, vou usar isso como contexto e manter o limite correto: imagem ajuda a orientar perguntas, não fecha diagnóstico.",
      },
    ]);
  }

  return (
    <div className="page-oxygen space-y-6">
      <section className="page-header">
        <div>
          <span className="page-header-kicker">LinfaFlow X1</span>
          <h1 className="page-header-title">Simulador de conversa personalizada</h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Protótipo em português para testar o atendimento no blog: entende o lead, sai do roteiro quando necessário,
            aceita imagem como contexto e conduz para uma oferta sem simular diagnóstico médico.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-2 rounded-md border border-gold/25 bg-gold/10 px-3 py-2 text-xs text-gold">
          <Stethoscope className="h-4 w-4" />
          Atendimento educativo
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="rounded-md border border-border/50 bg-card/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="kicker">Lead</p>
              <h2 className="mt-1 font-display text-2xl italic">Contexto usado pela IA</h2>
            </div>
            <Badge variant="outline" className="border-gold/30 text-gold">
              {score}%
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Nome
              <Input value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Idade
              <Input value={profile.age} onChange={(event) => updateProfile("age", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Dor principal
              <Textarea value={profile.pain} onChange={(event) => updateProfile("pain", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Momento emocional
              <Textarea value={profile.moment} onChange={(event) => updateProfile("moment", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Rotina
              <Textarea value={profile.routine} onChange={(event) => updateProfile("routine", event.target.value)} />
            </label>
            <label className="space-y-1.5 text-xs text-muted-foreground">
              Objeção provável
              <Textarea value={profile.objection} onChange={(event) => updateProfile("objection", event.target.value)} />
            </label>
          </div>
        </aside>

        <main className="flex min-h-[720px] flex-col rounded-md border border-border/50 bg-card/50">
          <div className="flex flex-col gap-3 border-b border-border/50 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-gold" />
                <p className="kicker">Preview do blog</p>
              </div>
              <h2 className="mt-1 font-display text-2xl italic">Conversa como atendimento 1:1</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-success/20 text-success-foreground hover:bg-success/20">{leadType}</Badge>
              <Button variant="outline" size="sm" onClick={resetConversation}>
                <RotateCcw className="h-4 w-4" />
                Reiniciar
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "lead" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[86%] rounded-md border px-4 py-3 text-sm leading-relaxed ${
                    message.sender === "lead"
                      ? "border-gold/35 bg-gold/15 text-foreground"
                      : message.sender === "system"
                        ? "border-border/60 bg-secondary/60 text-muted-foreground"
                        : "border-border/60 bg-background/70 text-foreground"
                  }`}
                >
                  {message.tag && (
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-gold/80">
                      {message.sender === "lead" ? <UserRound className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                      {message.tag}
                    </div>
                  )}
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
                  onClick={() => sendMessage(reply)}
                  className="rounded-md border border-border/70 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
                >
                  {reply}
                </button>
              ))}
            </div>

            <div className="mb-3 rounded-md border border-dashed border-border/70 p-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-between gap-3 text-left text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-gold" />
                  Enviar imagem para a IA sair do script quando precisar
                </span>
                <Camera className="h-4 w-4" />
              </button>
              {imageNote && <p className="mt-2 text-xs text-gold/85">{imageNote}</p>}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Digite como o lead responderia..."
                className="h-11"
              />
              <Button type="submit" className="h-11">
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </form>
          </div>
        </main>

        <aside className="space-y-4">
          <div className="rounded-md border border-border/50 bg-card/55 p-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gold" />
              <p className="kicker">Roteiro vivo</p>
            </div>
            <div className="mt-4 space-y-3">
              {scriptSteps.map((step, index) => (
                <div key={step.title} className="flex gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold/30 text-xs text-gold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-border/50 bg-card/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="kicker">Score</p>
                <h3 className="mt-1 font-display text-xl italic">Chance de avançar</h3>
              </div>
              <span className="kpi-value text-3xl">{score}%</span>
            </div>
            <Progress value={score} className="mt-3" />
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              O score sobe quando aparecem sinais de dor cotidiana, frustração com tentativas anteriores, imagem/contexto
              visual e objeção clara. Ele decide se a IA educa, prova ou vende.
            </p>
          </div>

          <div className="rounded-md border border-border/50 bg-card/55 p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gold" />
              <p className="kicker">Prompt base</p>
            </div>
            <div className="mt-4 space-y-2">
              {script.map((item) => (
                <div key={item} className="rounded-md border border-border/50 bg-background/55 p-3 text-xs leading-relaxed text-muted-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-gold/30 bg-gold/10 p-4">
            <div className="flex items-center gap-2 text-gold">
              <ShoppingBag className="h-4 w-4" />
              <p className="text-xs uppercase tracking-[0.18em]">Oferta no final</p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-foreground">
              Recomendação: kit LinfaFlow com protocolo diário, garantia e acompanhamento de evolução por sensação/foto.
            </p>
            <Button className="mt-4 w-full">
              Simular clique para checkout
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-md border border-warning/35 bg-warning/10 p-4 text-xs leading-relaxed text-muted-foreground">
            <div className="mb-2 flex items-center gap-2 text-warning">
              <ShieldAlert className="h-4 w-4" />
              Limite de segurança
            </div>
            A IA deve orientar, personalizar e vender rotina de autocuidado. Ela não deve diagnosticar, prometer cura,
            dizer que trata lipedema/linfedema ou substituir consulta profissional.
          </div>
        </aside>
      </section>
    </div>
  );
}
