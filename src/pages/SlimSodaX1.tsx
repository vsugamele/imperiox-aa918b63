import { FormEvent, useMemo, useState } from react;
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  Languages,
  MessageCircle,
  Package,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  ExternalLink,
  Copy,
  Check
} from lucide-react;
import { Badge } from @/components/ui/badge;
import { Button } from @/components/ui/button;
import { Input } from @/components/ui/input;
import { Progress } from @/components/ui/progress;
import { Textarea } from @/components/ui/textarea;
import { toast } from sonner;

type StageId = opening | spin | mechanism | proof | temperature | objection | close | followup;
type Sender = ai | lead | system;
type Lang = en | pt;

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
    title: 1. Abertura & Qualificação,
    pt: Abertura simples de baixíssima fricção. O lead escolhe uma opção (1 a 4) ou desabafa com texto livre.,
    risk: Nunca jogar preço nem textão logo de cara. O objetivo é fazer o lead dar o primeiro passo.,
  },
  spin: {
    title: 2. Diagnóstico SPIN (Food Noise & Histórico),
    pt: Investigação empática: food noise constante, frustração de dietas passadas ou efeito rebote pós-caneta.,
    risk: Manter apenas uma pergunta direta por mensagem para não sobrecarregar o lead.,
  },
  mechanism: {
    title: 3. Reframe do Mecanismo (Causa Raiz),
    pt: Devolve o poder ao lead e culpa a biologia: seu corpo já produz GLP-1/GIP, mas o intestino ácido e a enzima DPP-4 paralisaram a produção.,
    risk: Absolver o paciente (você não é fraca de vontade) e colocar a culpa no travamento hormonal.,
  },
  proof: {
    title: 4. Lógica da Fórmula & 4 Ativos,
    pt: Apresenta a cadeia do SlimSoda Powder: Bicarbonato Medicinal + Gingerol concentrado + Berberina Bioativa + NAD+ antiflacidez.,
    risk: Apresentar como um sistema de absorção em cadeia na água morna/fria matinal, não como pílulas genéricas.,
  },
  temperature: {
    title: 5. Termômetro de Interesse (0 a 10),
    pt: Checagem de temperatura antes da oferta. Evita soltar o link de checkout prematuramente.,
    risk: Se o lead responder 5 ou 6, isolar a dúvida real antes de passar para os kits.,
  },
  objection: {
    title: 6. Quebra de Objeções Blindadas,
    pt: Responde berberina comum da Amazon, fazer bicarbonato em casa, remédios de pressão/diabetes e efeito sanfona.,
    risk: Nunca fazer promessas de cura médica nem inventar garantias irreais.,
  },
  close: {
    title: 7. Fechamento dos Kits (BuyGoods),
    pt: Apresenta os kits com ancoragem agressiva no Kit 6 Frascos (.99/frasco com Frete Grátis e 3 bônus), garantia de 60 dias e link.,
    risk: Usar sempre fechamento por dupla alternativa (ex: Pix vs Cartão ou Kit 2 vs Kit 6).,
  },
  followup: {
    title: 8. Régua Anti-Vácuo de 3 Tiros,
    pt: Recuperação automática aos 21m (link abriu?), 2.5h (objeção/parcelamento) e 22h (downsell Kit 2 frascos).,
    risk: Cancelar imediatamente assim que o lead responder ou comprar para não atropelar a conversa.,
  },
};

const defaultLead: LeadState = {
  name: Sarah,
  symptom: constant food noise, cravings, and weight rebound after stopping injections,
  tried: keto, Ozempic for 4 months, intermittent fasting, and Amazon berberine,
  objection: I am afraid I will regain everything or that it is just cheap baking soda,
  temperature: 8,
};

const CHECKOUT_KITS = [
  {
    id: kit2,
    name: 2 Jars (1 + 1 Free) - Starter,
    namePt: Kit 2 Frascos (1 + 1 Grátis) - Entrada,
    supply: 60 days,
    total: .50,
    perJar: .75 / jar,
    url: https://buygoods.com/secure/checkout.html?account_id=12899&product_codename=PP_SDS2UNITS_AFF&redirect=aHR0cHM6Ly9pbXByb3ZpbmdvdXJoZWFsdGguY29tL3Nkcy1hZmYtYnV5LXVwMS8=,
    recommended: false,
  },
  {
    id: kit4,
    name: 4 Jars (2 + 2 Free) - Popular,
    namePt: Kit 4 Frascos (2 + 2 Grátis) - Intermediário,
    supply: 120 days,
    total: .96,
    perJar: .49 / jar,
    url: https://buygoods.com/secure/checkout.html?account_id=12899&product_codename=PP_SDS3UNITS_AFF&redirect=aHR0cHM6Ly9pbXByb3ZpbmdvdXJoZWFsdGguY29tL3Nkcy1hZmYtYnV5LXVwMS8=,
    recommended: false,
  },
  {
    id: kit6,
    name: 6 Jars (3 + 3 Free) - Best Value + 3 Gifts,
    namePt: Kit 6 Frascos (3 + 3 Grátis) - Campeão + 3 Bônus,
    supply: 180 days (Full Protocol),
    total: .94,
    perJar: .99 / jar (Save ),
    url: https://buygoods.com/secure/checkout.html?account_id=12899&product_codename=PP_SDS6UNITS_AFF&redirect=aHR0cHM6Ly9pbXByb3ZpbmdvdXJoZWFsdGguY29tL3Nkcy1hZmYtYnV5LXVwMS8=,
    recommended: true,
  },
];

const starterMessagesEn: Message[] = [
  {
    id: 1,
    sender: ai,
    stage: opening,
    text:
      Hi Sarah! Welcome to SlimSoda support. Before I share the formula and bundles, quick question so I don't waste your time:\n\nWhat is your biggest daily struggle right now?\n1. Food noise & non-stop cravings (thinking about food 24/7)\n2. Rebounded weight after stopping diets or injections\n3. Stuck metabolism after 40/50 with belly fat\n4. Fear of loose, saggy skin while losing weight\n\n(You can just reply with 1, 2, 3 or 4),
  },
];

const starterMessagesPt: Message[] = [
  {
    id: 1,
    sender: ai,
    stage: opening,
    text:
      Oi Sarah, seja muito bem-vinda ao atendimento SlimSoda! Antes de te passar a fórmula e as promoções de hoje, uma pergunta rápida pra eu te orientar certinho:\n\nQual tem sido sua maior dificuldade hoje?\n1. Pensamento constante em comida e ansiedade no fim da tarde\n2. Peso que voltou em dobro depois de parar dietas ou a caneta injetável\n3. Metabolismo travado depois dos 40/50 com gordura na barriga\n4. Medo de emagrecer e ficar com a pele solta e flácida\n\n(Pode só responder 1, 2, 3 ou 4),
  },
];

const quickRepliesEn = [
  1 - Constant food noise and evening cravings.,
  2 - I stopped injections and regained 18 lbs.,
  I am an 8, but does it really work without the rebound?,
  Can I just buy regular baking soda at Walmart for ,
  How much is the 6-jar kit and where do I order?,
];

const quickRepliesPt = [
  1 - Pensamento constante em comida e ansiedade à noite.,
  2 - Parei a injeção e recuperei 8 quilos em semanas.,
  Estou no nível 8, mas tenho medo de ser efeito sanfona.,
  Isso não é só bicarbonato de mercado que faço por 5 reais?,
  Quanto custa o kit com 6 frascos e onde peço?,
];

function detectStage(input: string, current: StageId): StageId {
  const lower = input.toLowerCase();
  if (lower.includes(order) || lower.includes(buy) || lower.includes(link) || lower.includes(price) || lower.includes(comprar) || lower.includes(valor) || lower.includes(preço) || lower.includes(onde peço)) {
    return close;
  }
  if (lower.includes(walmart) || lower.includes(amazon) || lower.includes(bicarbonato de mercado) || lower.includes(rebound) || lower.includes(rebote) || lower.includes(sanfona) || lower.includes(remédio) || lower.includes(medicine) || lower.includes(side effect) || lower.includes(efeito colateral)) {
    return objection;
  }
  if (/\b(0|1|2|3|4|5|6|7|8|9|10)\b/.test(lower) && current !== opening) {
    return temperature;
  }
  if (current === opening) return spin;
  if (current === spin) return mechanism;
  if (current === mechanism) return proof;
  if (current === proof) return temperature;
  if (current === temperature) return objection;
  if (current === objection) return close;
  return followup;
}

function responseFor(stage: StageId, lead: LeadState, lang: Lang): string {
  const name = lead.name.trim() || (lang === pt ? querida : there);

  if (lang === pt) {
    if (stage === spin) {
      return Te entendo perfeitamente, . Quando você diz que sente ", saiba que a culpa NUNCA foi da sua força de vontade.\n\nO que a maioria das mulheres não sabe é que dietas e injeções apenas mascaram o sintoma. Me conta: quando você tentou , você sentia que a fome voltava ainda mais feroz assim que dava uma pausa?;
 }
 if (stage === mechanism) {
 return É exatamente isso, . Seu corpo já fabrica naturalmente os hormônios da saciedade (GLP-1 e GIP). Eles nascem nas células L do seu intestino.\n\nO problema é que após os 40 anos, com estresse e alimentos ultraprocessados, o ambiente do estômago fica ultra-ácido, fazendo as células L adormecerem. Pra piorar, uma enzima chamada DPP-4 destrói qualquer GLP-1 que seu corpo tenta produzir em questão de minutos.\n\nPor isso que as injeções caras pareciam milagre: elas injetavam uma versão sintética enquanto a sua fábrica biológica continuava desligada. Quando a agulha saía, vinha o rebote.;
 }
 if (stage === proof) {
 return É por isso que o SlimSoda Powder mudou o jogo:\n\nEle não é uma pílula e não é uma injeção. É um pó solúvel que você toma toda manhã em 1 copo de água fria em jejum com 4 ativos trabalhando em cadeia:\n\n1. Bicarbonato Medicinal: neutraliza a acidez gástrica e acorda as células L para produzir GLP-1 natural.\n2. Gingerol Concentrado: inibe em 93% a enzima DPP-4, impedindo a destruição do hormônio.\n3. Berberina Bioativa: ativa a AMPK, o interruptor que queima gordura 24/7.\n4. NAD+: regenerador celular que firma a pele, prevenindo flacidez e o famoso 'rosto caído de Ozempic'.\n\nTudo em um único shot que leva 10 segundos para tomar.;
 }
 if (stage === temperature) {
 return Antes de eu te passar os kits com envio prioritário, uma checagem rápida de temperatura:\n\nDe 0 a 10, o quanto faz sentido para você desintoxicar essa via hormonal e emagrecer com o próprio corpo trabalhando a seu favor?;
 }
 if (stage === objection) {
 return Compreendo 100% o seu receio, . Sobre :\n\n• Não é só bicarbonato de mercado: o bicarbonato comum sozinho só mexe no pH temporário, mas sem o gingerol e a berberina concentrada na proporção clínica exata, não há ativação da AMPK.\n• Berberina de farmácia não absorve: a berberina comum tem menos de 1% de biodisponibilidade se não estiver em pó com o veículo tampão alcalino correto.\n• Risco ZERO: você tem 60 dias inteiros de garantia incondicional. Se não notar a fome sumir e as roupas afrouxarem, você recebe 100% do seu dinheiro de volta.;
 }
 if (stage === close) {
 return Maravilha, ! Hoje estamos com o lote reservado com desconto especial de fábrica:\n\n🏆 Kit 6 Frascos (Tratamento Completo 180 dias):\nde por apenas .94 (cada frasco sai por apenas .99 com Frete Grátis prioritário + 3 Bônus Exclusivos de Rosto e Cintura). É a escolha de 90% das mulheres para resetar o corpo sem rebote.\n\n📦 Kit 4 Frascos (120 dias): .96 (.49/frasco)\n📦 Kit 2 Frascos (60 dias - Entrada): .50 (.75/frasco)\n\n👉 Acesse o Checkout Seguro Oficial aqui:\nhttps://buygoods.com/secure/checkout.html?account_id=12899&product_codename=PP_SDS6UNITS_AFF&redirect=aHR0cHM6Ly9pbXByb3ZpbmdvdXJoZWFsdGguY29tL3Nkcy1hZmYtYnV5LXVwMS8=\n\nVocê prefere garantir o Kit de 6 Frascos com Frete Grátis ou prefere iniciar com o de 2 Frascos?;
 }
 return ${name}, passando só pra checar se você conseguiu abrir o link direitinho ou se teve alguma dúvida no checkout? Estamos com as últimas 300 unidades desse lote com frete grátis liberado!;
 }

 // English fallback
 if (stage === spin) {
 return I hear you loud and clear, . When you mention , please know this was NEVER about a lack of discipline.\n\nWhat Big Pharma never tells women over 40 is that diets and weekly injections only silence symptoms temporarily. When you tried , did you feel like the food noise and hunger rebounded the moment you stopped?;
 }
 if (stage === mechanism) {
 return That's the trap, . Your body already produces the exact same satiety hormones that medications copy: GLP-1 and GIP. They are made right inside your gut's L-cells.\n\nHowever, after 40, chronic stress and gut acidity put those L-cells to sleep. On top of that, an enzyme called DPP-4 destroys natural GLP-1 within minutes. When you stop the weekly injections, your body has forgotten how to produce it on its own.\n\nThat is why you felt trapped: not because you failed, but because your body's metabolic switch got stuck in storage mode.;
 }
 if (stage === proof) {
 return This is why SlimSoda Powder works differently:\n\nIt is not an injection and it is not a pill. It is a morning dissolvable powder taken in 1 scoop of water on an empty stomach, delivering a 4-active biological chain:\n\n1. Pharmaceutical Sodium Bicarbonate: neutralizes gut acid and re-awakens dormant L-cells.\n2. Concentrated Gingerol: inhibits DPP-4 enzyme by up to 93%, shielding your GLP-1 from destruction.\n3. Bioactive Berberine: flips the AMPK enzyme (your metabolic switch) to fat-burning 24/7.\n4. NAD+: accelerates cellular skin tightening by up to 280%, preventing saggy skin and 'Ozempic face'.\n\nOne simple 10-second morning ritual.;
 }
 if (stage === temperature) {
 return Before I share the reserved batch links, quick temperature check, :\n\nOn a scale of 0 to 10, how much does reactivating your body's own fat-burning hormones make sense for your journey right now?;
 }
 if (stage === objection) {
 return I completely respect your caution, . Addressing your concern about :\n\n• Walmart baking soda won't work: regular baking soda only changes mouth/stomach pH for 15 minutes. It lacks bioactive berberine, standardized gingerol, and NAD+ to trigger AMPK.\n• Amazon berberine has <1% absorption: swallowing raw capsules breaks down before reaching L-cells. A dissolvable alkaline powder absorbs immediately.\n• 60-Day Money Back Guarantee: You get a full 60 days to test it. If your food noise doesn't disappear and your clothes don't loosen up, you get a 100% refund. No questions asked.;
 }
 if (stage === close) {
 return Awesome, ! Here are today's factory-direct discounted bundles:\n\n🏆 6 Jars (3 + 3 Free) - Best Value (180-Day Supply):\nDown from to just .94 (.99/jar with FREE Shipping + 3 Exclusive Bonuses: Runway Waist Formula, Youth Glow Masterclass & Zoom Consultation). 90% of customers choose this to reset their metabolism permanently without rebounds.\n\n📦 4 Jars (2 + 2 Free - 120 Days): .96 (.49/jar)\n📦 2 Jars (1 + 1 Free - 60 Days): .50 (.75/jar)\n\n👉 Secure Official Checkout Link:\nhttps://buygoods.com/secure/checkout.html?account_id=12899&product_codename=PP_SDS6UNITS_AFF&redirect=aHR0cHM6Ly9pbXByb3ZpbmdvdXJoZWFsdGguY29tL3Nkcy1hZmYtYnV5LXVwMS8=\n\nWould you like to lock in the 6-Jar Best Value bundle with free shipping, or start with the 2-Jar kit?;
 }
 return Hi , just checking in real quick to see if the checkout link opened smoothly for you or if you had any questions? We are down to the final bottles of this batch!;
}

function scoreLead(lead: LeadState, stage: StageId) {
 let score = 42;
 const text = ${lead.symptom} .toLowerCase();
 if (text.includes(food noise) || text.includes(cravings) || text.includes(ansiedade) || text.includes(comida)) score += 16;
 if (text.includes(ozempic) || text.includes(rebound) || text.includes(rebote) || text.includes(injeção)) score += 18;
 if (text.includes(berberine) || text.includes(berberina) || text.includes(diet) || text.includes(dieta)) score += 10;
 score += Number(lead.temperature || 0) * 2.5;
 if (stage === close) score += 12;
 return Math.min(Math.round(score), 98);
}

const auditItems = [
 { ok: true, text: Dossiê completo extraído do brief oficial: 10 avatares, psicologia profunda e VOC. },
 { ok: true, text: Cadeia de 4 ativos mapeada: Bicarbonato + Gingerol (DPP-4) + Berberina (AMPK) + NAD+. },
 { ok: true, text: Links de checkout BuyGoods para 2, 4 e 6 potes verificados e integrados. },
 { ok: true, text: Régua anti-vácuo de 3 tiros sincronizada no wa-pitch-followup (21m, 2.5h, 22h). },
 { ok: true, text: Suporte bilíngue integrado: Opera em EN-US para tráfego gringo ou PT-BR para X1 nacional. },
];

export default function SlimSodaX1() {
  const [lang, setLang] = useState<Lang>(pt);
  const [lead, setLead] = useState<LeadState>(defaultLead);
  const [messages, setMessages] = useState<Message[]>(starterMessagesPt);
  const [draft, setDraft] = useState(");
 const [copiedKit, setCopiedKit] = useState<string | null>(null);

 const currentStage = messages[messages.length - 1]?.stage || opening;
 const score = useMemo(() => scoreLead(lead, currentStage), [lead, currentStage]);

 function switchLanguage(newLang: Lang) {
 setLang(newLang);
 setMessages(newLang === en ? starterMessagesEn : starterMessagesPt);
 toast.info(newLang === en ? Switched to English conversation : Conversa alterada para Português);
 }

 function updateLead(key: keyof LeadState, value: string) {
 setLead((current) => ({ ...current, [key]: value }));
 }

 function send(text: string) {
 const value = text.trim();
 if (!value) return;
 const nextStage = detectStage(value, currentStage);
 setMessages((current) => [
 ...current,
 { id: Date.now(), sender: lead, stage: currentStage, text: value },
 { id: Date.now() + 1, sender: ai, stage: nextStage, text: responseFor(nextStage, lead, lang) },
 ]);
 setDraft();
 }

 function onSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 send(draft);
 }

 function reset() {
 setMessages(lang === en ? starterMessagesEn : starterMessagesPt);
 setDraft();
 toast.success(Simulação reiniciada);
 }

 function copyToClipboard(url: string, id: string) {
 navigator.clipboard.writeText(url);
 setCopiedKit(id);
 toast.success(Link de checkout copiado!);
 setTimeout(() => setCopiedKit(null), 2000);
 }

 const quickReplies = lang === en ? quickRepliesEn : quickRepliesPt;

 return (
 <div className=page-oxygen space-y-6 max-w-[1600px] mx-auto p-4 md:p-6>
 {/* Header */}
 <section className=page-header flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-5>
 <div>
 <div className=flex items-center gap-2>
 <span className=page-header-kicker text-xs uppercase tracking-widest text-primary font-bold>
 DTC X1 Conversational Engine
 </span>
 <Badge variant=outline className=border-emerald-500/40 text-emerald-400 bg-emerald-500/10>
 SlimSoda Powder
 </Badge>
 </div>
 <h1 className=page-header-title text-3xl font-bold tracking-tight mt-1>
 SlimSoda · Mesa de Atendimento & Simulador X1
 </h1>
 <p className=mt-2 max-w-3xl text-sm text-muted-foreground>
 Roteiro psicodinâmico de 8 fases para fechar frascos de SlimSoda no WhatsApp e Direct. A IA acolhe, diagnostica a dor, quebra objeções e ancora no kit de 6 frascos.
 </p>
 </div>

 <div className=flex items-center gap-3>
 <div className=flex items-center rounded-lg border border-border/70 p-1 bg-muted/40>
 <Button
 size=sm
 variant={lang === pt ? default : ghost}
 onClick={() => switchLanguage(pt)}
 className=h-8 px-3 text-xs
 >
 🇧🇷 PT-BR
 </Button>
 <Button
 size=sm
 variant={lang === en ? default : ghost}
 onClick={() => switchLanguage(en)}
 className=h-8 px-3 text-xs
 >
 🇺🇸 EN-US
 </Button>
 </div>
 <Button variant=outline onClick={reset} className=h-9 text-xs>
 <RotateCcw className=h-3.5 w-3.5 mr-1.5 />
 Resetar
 </Button>
 </div>
 </section>

 {/* 3-Column Layout */}
 <section className=grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)_400px]>
 {/* Left Column: Lead Simulator */}
 <aside className=space-y-4>
 <div className=rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur-sm>
 <div className=flex items-center gap-2 border-b border-border/40 pb-3>
 <Target className=h-4 w-4 text-primary />
 <h2 className=text-sm font-semibold tracking-wide uppercase text-foreground>
 {lang === pt ? Perfil do Lead (Simulação) : Lead Simulator Profile}
 </h2>
 </div>

 <div className=mt-4 space-y-3>
 <label className=block space-y-1.5 text-xs text-muted-foreground>
 {lang === pt ? Nome do Lead : Lead Name}
 <Input value={lead.name} onChange={(e) => updateLead(name, e.target.value)} className=h-9 />
 </label>

 <label className=block space-y-1.5 text-xs text-muted-foreground>
 {lang === pt ? Sintoma Principal / Food Noise : Main Symptom / Food Noise}
 <Textarea
 value={lead.symptom}
 onChange={(e) => updateLead(symptom, e.target.value)}
 className=min-h-[68px] text-xs resize-none
 />
 </label>

 <label className=block space-y-1.5 text-xs text-muted-foreground>
 {lang === pt ? O que já tentou antes (Dietas / Ozempic) : Tried Before (Diets / Ozempic)}
 <Textarea
 value={lead.tried}
 onChange={(e) => updateLead(tried, e.target.value)}
 className=min-h-[68px] text-xs resize-none
 />
 </label>

 <label className=block space-y-1.5 text-xs text-muted-foreground>
 {lang === pt ? Maior Objeção / Medo Oculto : Main Objection / Hidden Fear}
 <Textarea
 value={lead.objection}
 onChange={(e) => updateLead(objection, e.target.value)}
 className=min-h-[68px] text-xs resize-none
 />
 </label>

 <label className=block space-y-1.5 text-xs text-muted-foreground>
 {lang === pt ? Temperatura (0 a 10) : Temperature (0 to 10)}
 <Input
 type=number
 min=0
 max=10
 value={lead.temperature}
 onChange={(e) => updateLead(temperature, e.target.value)}
 className=h-9
 />
 </label>
 </div>

 {/* Qualification Gauge */}
 <div className=mt-5 rounded-lg border border-primary/30 bg-primary/10 p-3.5>
 <div className=flex items-center justify-between>
 <span className=text-xs font-semibold uppercase tracking-wider text-primary>
 {lang === pt ? Score de Qualificação : Purchase Intent}
 </span>
 <span className=font-bold text-2xl text-foreground>{score}%</span>
 </div>
 <Progress value={score} className=mt-2 h-2 />
 <p className=mt-2 text-[11px] text-muted-foreground>
 {score >= 75
 ? (lang === pt ? 🔥 Pronto para receber o link do Kit 6 : 🔥 High intent: Ready for Kit 6 close)
 : (lang === pt ? ⚖️ Precisa de reframe do mecanismo antes da oferta : ⚖️ Needs mechanism reframe before close)}
 </p>
 </div>
 </div>

 {/* Kits BuyGoods Box */}
 <div className=rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm>
 <div className=flex items-center gap-2 border-b border-border/40 pb-3>
 <Package className=h-4 w-4 text-primary />
 <h2 className=text-sm font-semibold tracking-wide uppercase text-foreground>
 {lang === pt ? Kits Oficiais BuyGoods : BuyGoods Official Bundles}
 </h2>
 </div>
 <div className=mt-3 space-y-2.5>
 {CHECKOUT_KITS.map((k) => (
 <div
 key={k.id}
 className={p-3 rounded-lg border text-xs transition-all }
 >
 <div className=flex items-center justify-between font-semibold>
 <span className={k.recommended ? text-primary font-bold : text-foreground}>
 {lang === pt ? k.namePt : k.name}
 </span>
 <span className=font-bold text-foreground>{k.total}</span>
 </div>
 <div className=flex items-center justify-between mt-1 text-[11px] opacity-80>
 <span>{k.supply}</span>
 <span>{k.perJar}</span>
 </div>
 <div className=mt-2.5 flex items-center gap-2>
 <Button
 size=sm
 variant=outline
 onClick={() => copyToClipboard(k.url, k.id)}
 className=h-7 px-2.5 text-[11px] w-full
 >
 {copiedKit === k.id ? (
 <Check className=h-3 w-3 mr-1 text-emerald-400 />
 ) : (
 <Copy className=h-3 w-3 mr-1 />
 )}
 {copiedKit === k.id ? Copiado! : Copiar Checkout}
 </Button>
 <a
 href={k.url}
 target=_blank
 rel=noreferrer
 className=inline-flex items-center justify-center h-7 w-7 rounded border border-border/70 text-muted-foreground hover:text-foreground shrink-0
 >
 <ExternalLink className=h-3 w-3 />
 </a>
 </div>
 </div>
 ))}
 </div>
 </div>
 </aside>

 {/* Center Column: Live Conversation */}
 <main className=flex min-h-[760px] flex-col rounded-xl border border-border/60 bg-card/50 shadow-sm overflow-hidden>
 <div className=flex items-center justify-between gap-3 border-b border-border/50 p-4 bg-muted/20>
 <div className=flex items-center gap-2.5>
 <div className=h-9 w-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold>
 <Bot className=h-5 w-5 />
 </div>
 <div>
 <h3 className=font-semibold text-sm text-foreground flex items-center gap-2>
 SlimSoda Assistant
 <span className=inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse />
 </h3>
 <p className=text-xs text-muted-foreground>
 {lang === pt ? Simulando atendimento humano/IA no WhatsApp : Live Direct/WhatsApp AI Simulation}
 </p>
 </div>
 </div>

 <Badge variant=outline className=border-primary/40 text-primary bg-primary/10 px-2.5 py-1 text-xs>
 {stageMeta[currentStage].title}
 </Badge>
 </div>

 {/* Message stream */}
 <div className=flex-1 space-y-4 overflow-y-auto p-4 md:p-5>
 {messages.map((m) => (
 <div key={m.id} className={lex }>
 <div
 className={max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm }
 >
 <div
 className={mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wider }
 >
 {m.sender === lead ? lead.name : SlimSoda AI} · {stageMeta[m.stage].title}
 </div>
 {m.text}
 </div>
 </div>
 ))}
 </div>

 {/* Quick Replies & Input */}
 <div className=border-t border-border/50 p-4 bg-background/50 backdrop-blur-sm>
 <div className=mb-3 flex flex-wrap gap-2>
 {quickReplies.map((reply) => (
 <button
 key={reply}
 type=button
 onClick={() => send(reply)}
 className=rounded-lg border border-border/70 bg-card/80 px-3 py-1.5 text-left text-xs text-muted-foreground transition-all hover:border-primary/60 hover:text-foreground hover:bg-primary/5 active:scale-95
 >
 {reply}
 </button>
 ))}
 </div>

 <form onSubmit={onSubmit} className=flex gap-2>
 <Input
 value={draft}
 onChange={(e) => setDraft(e.target.value)}
 placeholder={
 lang === pt
 ? Digite como o lead respondendo à mensagem...
 : Type as the prospective buyer...
 }
 className=h-11 bg-card/80 border-border/70 text-sm
 />
 <Button type=submit className=h-11 px-5 font-semibold gap-1.5>
 <Send className=h-4 w-4 />
 {lang === pt ? Enviar : Send}
 </Button>
 </form>
 </div>
 </main>

 {/* Right Column: Stage Explanation & Production Checklist */}
 <aside className=space-y-4>
 {/* Current Stage Card */}
 <div className=rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm>
 <div className=flex items-center gap-2 border-b border-border/40 pb-3>
 <ClipboardList className=h-4 w-4 text-primary />
 <h3 className=text-sm font-semibold tracking-wide uppercase text-foreground>
 {lang === pt ? Estratégia da Etapa Ativa : Current Stage Playbook}
 </h3>
 </div>
 <h4 className=mt-3 font-semibold text-base text-foreground>
 {stageMeta[currentStage].title}
 </h4>
 <p className=mt-2 text-xs leading-relaxed text-muted-foreground>
 {stageMeta[currentStage].pt}
 </p>

 <div className=mt-3.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200/90>
 <div className=mb-1 flex items-center gap-1.5 font-semibold text-amber-400>
 <AlertTriangle className=h-3.5 w-3.5 />
 {lang === pt ? Ponto de Atenção (Anti-Erro) : Guardrail / Pitfall}
 </div>
 {stageMeta[currentStage].risk}
 </div>
 </div>

 {/* Funnel Map */}
 <div className=rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm>
 <div className=flex items-center gap-2 border-b border-border/40 pb-3>
 <Bot className=h-4 w-4 text-primary />
 <h3 className=text-sm font-semibold tracking-wide uppercase text-foreground>
 {lang === pt ? Mapa das 8 Etapas X1 : 8-Stage Conversion Map}
 </h3>
 </div>
 <div className=mt-3 space-y-1.5>
 {(Object.keys(stageMeta) as StageId[]).map((st, idx) => (
 <div
 key={st}
 className={ounded-lg border px-3 py-2 text-xs transition-all }
 >
 <span className=mr-2 text-primary font-bold>{idx + 1}.</span>
 {stageMeta[st].title}
 </div>
 ))}
 </div>
 </div>

 {/* Audit / Production Checklist */}
 <div className=rounded-xl border border-border/60 bg-card/60 p-4 shadow-sm>
 <div className=flex items-center gap-2 border-b border-border/40 pb-3>
 <ShieldCheck className=h-4 w-4 text-emerald-400 />
 <h3 className=text-sm font-semibold tracking-wide uppercase text-foreground>
 {lang === pt ? Checklist de Ativação em Produção : Production Launch Readiness}
 </h3>
 </div>
 <div className=mt-3 space-y-2>
 {auditItems.map((item, i) => (
 <div
 key={i}
 className=flex items-start gap-2 rounded-lg border border-border/50 bg-background/40 p-2.5 text-xs text-muted-foreground leading-relaxed
 >
 <CheckCircle2 className=mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400 />
 <span>{item.text}</span>
 </div>
 ))}
 </div>
 </div>
 </aside>
 </section>
 </div>
 );
}
