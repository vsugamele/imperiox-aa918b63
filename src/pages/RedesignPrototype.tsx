import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  LayoutDashboard, Inbox, Users, LifeBuoy, Workflow,
  Clapperboard, Target, Activity, DollarSign, Palette,
  Map, Sparkles, Send, CheckCircle2, AlertTriangle, ArrowRight,
  Clock, ShieldAlert, Zap, Filter, Search, ChevronRight,
  TrendingUp, RefreshCw
} from "lucide-react";

const ACCENT = "#D6FF4B";
const MUTED = "#8A8F98";

interface RecBucket {
  id: string;
  short: string;
  title: string;
  desc: string;
  count: string;
  value: string;
  rate: string;
  tipo: string;
  canDispatch: boolean;
  rows: Array<{
    name: string;
    contact: string;
    product: string;
    value: string;
    age: string;
    ageColor: string;
    last: string;
    hasMail?: boolean;
    noPhone?: boolean;
    noLink?: boolean;
    note?: string;
  }>;
}

const REC_BUCKETS: RecBucket[] = [
  {
    id: "pix_urgent",
    short: "PIX 0–2H",
    title: "PIX urgente · gerado há menos de 2h",
    desc: "Pagamentos gerados há pouco tempo, ainda com alta intenção.",
    count: "18 ITENS",
    value: "R$ 24.180",
    rate: "41%",
    tipo: "PIX_2H",
    canDispatch: true,
    rows: [
      { name: "Cláudia Menezes", contact: "+55 11 9•••-2210 · claudia@•••", product: "Kit 90 dias LinfaFlow", value: "R$ 397", age: "há 14 min", ageColor: "#4ADE80", last: "Sem contato", hasMail: true },
      { name: "Ricardo Baptista", contact: "+55 21 9•••-7741", product: "Kit 90 dias LinfaFlow", value: "R$ 397", age: "há 38 min", ageColor: "#4ADE80", last: "Sem contato", hasMail: false },
      { name: "Fabiana Lopes", contact: "+55 31 9•••-0192 · fabi@•••", product: "MemoFlow 2 frascos", value: "R$ 274", age: "há 1 h", ageColor: "#FBBF24", last: "template_whatsapp • há 12 min", hasMail: true },
      { name: "Lead sem nome", contact: "sem telefone · vendas@•••", product: "Produto não identificado", value: "R$ 197", age: "há 1 h", ageColor: "#FBBF24", last: "Sem contato", hasMail: true, noPhone: true },
    ],
  },
  {
    id: "pix_cooling",
    short: "PIX 2–24H",
    title: "PIX esfriando · follow-up antes das 24h",
    desc: "Leads que geraram PIX e precisam de follow-up antes de esfriar.",
    count: "74 ITENS",
    value: "R$ 38.400",
    rate: "22%",
    tipo: "PIX_24H",
    canDispatch: true,
    rows: [
      { name: "Marina Rocha", contact: "+55 11 9•••-4482 · marina@•••", product: "Kit 90 dias LinfaFlow", value: "R$ 397", age: "há 4 h", ageColor: "#FBBF24", last: "template_whatsapp • há 3 h", hasMail: true },
      { name: "Joana Prado", contact: "+55 85 9•••-3308", product: "Kit 90 dias LinfaFlow", value: "R$ 397", age: "há 9 h", ageColor: "#FBBF24", last: "Sem contato", hasMail: false },
      { name: "Sérgio Almeida", contact: "+55 41 9•••-6620 · sergio@•••", product: "Equilibre On · 3 meses", value: "R$ 312", age: "há 16 h", ageColor: "#FB7185", last: "template_email • há 10 h", hasMail: true },
      { name: "Vera Lúcia Dias", contact: "+55 62 9•••-1175", product: "MemoFlow 2 frascos", value: "R$ 274", age: "há 21 h", ageColor: "#FB7185", last: "Sem contato", hasMail: false },
    ],
  },
  {
    id: "boleto_due",
    short: "BOLETO 48H",
    title: "Boleto a vencer · janela de 48h",
    desc: "Boletos recentes ou próximos do vencimento que ainda podem converter.",
    count: "31 ITENS",
    value: "R$ 19.260",
    rate: "14%",
    tipo: "BOLETO",
    canDispatch: true,
    rows: [
      { name: "Antônio Furtado", contact: "antonio@••• · +55 11 9•••-8834", product: "Kit 90 dias LinfaFlow", value: "R$ 397", age: "vence em 9 h", ageColor: "#FB7185", last: "template_email • há 1 d", hasMail: true },
      { name: "Neide Carvalho", contact: "neide@•••", product: "MemoFlow 3 frascos", value: "R$ 381", age: "vence em 1 d", ageColor: "#FBBF24", last: "Sem contato", hasMail: true, noPhone: true },
      { name: "Paulo Ribeiro", contact: "paulo@••• · +55 51 9•••-2003", product: "Cinna Shield · teste", value: "R$ 189", age: "vence em 2 d", ageColor: "#B7BCC4", last: "Sem contato", hasMail: true },
    ],
  },
  {
    id: "abandoned_cart",
    short: "CARRINHO",
    title: "Carrinho abandonado · últimos 7 dias",
    desc: "Checkout iniciado sem compra aprovada nos últimos dias.",
    count: "126 ITENS",
    value: "R$ 61.900",
    rate: "9%",
    tipo: "CARRINHO",
    canDispatch: true,
    rows: [
      { name: "Tatiane Moraes", contact: "+55 11 9•••-5567 · tati@•••", product: "Kit 90 dias LinfaFlow", value: "R$ 397", age: "há 6 h", ageColor: "#FBBF24", last: "Sem contato", hasMail: true },
      { name: "Rogério Sousa", contact: "+55 27 9•••-9912", product: "LinfaFlow · 1 frasco", value: "R$ 147", age: "há 1 d", ageColor: "#B7BCC4", last: "template_whatsapp • há 1 d", hasMail: false },
      { name: "Bianca Teles", contact: "bianca@•••", product: "Equilibre On · 3 meses", value: "R$ 312", age: "há 3 d", ageColor: "#5F646D", last: "Sem contato", hasMail: true, noPhone: true, noLink: true },
      { name: "Wesley Amâncio", contact: "+55 71 9•••-4409 · wes@•••", product: "MemoFlow 2 frascos", value: "R$ 274", age: "há 5 d", ageColor: "#5F646D", last: "marcado_perdido • há 2 d", hasMail: true },
    ],
  },
  {
    id: "refunds",
    short: "REEMBOLSO",
    title: "Reembolso e chargeback · causa raiz",
    desc: "Casos recentes para análise de causa e prevenção.",
    count: "12 ITENS",
    value: "R$ 7.480",
    rate: "—",
    tipo: "REEMBOLSO",
    canDispatch: false,
    rows: [
      { name: "Diego Nunes", contact: "diego@••• · +55 11 9•••-3312", product: "Kit 90 dias LinfaFlow", value: "R$ 397", age: "há 2 d", ageColor: "#FB7185", last: "template_email • há 1 d", hasMail: true, noLink: true, note: "motivo: prazo de entrega" },
      { name: "Simone Vargas", contact: "simone@•••", product: "MemoFlow 3 frascos", value: "R$ 381", age: "há 6 d", ageColor: "#8A8F98", last: "Sem contato", hasMail: true, noPhone: true, noLink: true, note: "chargeback · cartão" },
      { name: "Hélio Batista", contact: "helio@••• · +55 19 9•••-7788", product: "Cinna Shield · teste", value: "R$ 189", age: "há 11 d", ageColor: "#8A8F98", last: "marcado_perdido • há 9 d", hasMail: true, noLink: true, note: "motivo: sem resultado" },
    ],
  },
];

const CRI_ANGULOS = [
  { slug: "dor", nome: "Dor", cat: "CLÁSSICO" },
  { slug: "desejo", nome: "Desejo / Transformação", cat: "CLÁSSICO" },
  { slug: "prova", nome: "Prova Social", cat: "CLÁSSICO" },
  { slug: "autoridade", nome: "Autoridade", cat: "CLÁSSICO" },
  { slug: "curiosidade", nome: "Curiosidade", cat: "CLÁSSICO" },
  { slug: "antes-depois", nome: "Antes vs Depois", cat: "CLÁSSICO" },
  { slug: "objecao", nome: "Objeção Destruída", cat: "CLÁSSICO" },
  { slug: "conspiracao", nome: "Conspiração", cat: "FILEMON" },
  { slug: "controversia", nome: "Controvérsia", cat: "FILEMON" },
  { slug: "historia-emocional", nome: "História Emocional", cat: "FILEMON" },
  { slug: "promessa", nome: "Promessa", cat: "FILEMON" },
  { slug: "lista", nome: "Lista", cat: "WANDER" },
  { slug: "erro-comum", nome: "Erro Comum", cat: "WANDER" },
  { slug: "contrarian", nome: "Contrarian", cat: "WANDER" },
  { slug: "mecanismo-oculto", nome: "Mecanismo Oculto", cat: "WANDER" },
  { slug: "predicao", nome: "Predição", cat: "WANDER" },
  { slug: "quick-fast", nome: "Quick & Fast", cat: "WANDER" },
  { slug: "superestrutura", nome: "Superestrutura", cat: "WANDER" },
  { slug: "medo-consequencia", nome: "Medo + Consequência", cat: "WANDER" },
  { slug: "fofoca-descoberta", nome: "Fofoca + Descoberta", cat: "WANDER" },
  { slug: "trend", nome: "Trend Cultural", cat: "WANDER" },
];

export default function RedesignPrototype() {
  const [screen, setScreen] = useState<
    "cockpit" | "leads" | "funis" | "recuperacao" | "criativos" | "campanhas" | "ads" | "financas" | "system" | "mapa"
  >("cockpit");
  const [zen, setZen] = useState(false);
  const [bucketIdx, setBucketIdx] = useState(1);
  const [cTab, setCTab] = useState<"lotes" | "lote" | "novo">("lotes");
  const [selectedAngulos, setSelectedAngulos] = useState<string[]>(["dor", "desejo", "prova", "curiosidade"]);
  const [chatMessage, setChatMessage] = useState("");
  const [chatThread, setChatThread] = useState([
    { who: "MARINA", time: "17:18", align: "justify-start", bg: "#16191E", border: "#23262C", fg: "#E8EAED", text: "Oi! Eu vi o vídeo de vocês do LinfaFlow sobre retenção de líquidos... funciona mesmo pra quem tem hipotireoidismo?" },
    { who: "IA · CONSULTORA", time: "17:19", align: "justify-end", bg: "#1F2918", border: "#3A4D27", fg: "#D6FF4B", text: "Olá Marina! Sim, com certeza. Inclusive mais de 38% das mulheres que acompanhamos têm quadro de tireoide lenta. O composto foca exatamente em desentupir as vias linfáticas sem sobrecarregar seus hormônios." },
    { who: "MARINA", time: "17:21", align: "justify-start", bg: "#16191E", border: "#23262C", fg: "#E8EAED", text: "Qual kit você me recomendaria pra começar? Quero desinchar rápido antes do casamento da minha irmã no mês que vem." },
  ]);

  const activeBucket = REC_BUCKETS[bucketIdx] || REC_BUCKETS[0];

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    setChatThread((prev) => [
      ...prev,
      {
        who: "VOCÊ (HUMANO)",
        time: "Agora",
        align: "justify-end",
        bg: "#1F232A",
        border: "#2A2E35",
        fg: "#E8EAED",
        text: chatMessage,
      },
    ]);
    setChatMessage("");
    toast.success("Mensagem enviada no WhatsApp!");
  };

  const toggleAngulo = (slug: string) => {
    setSelectedAngulos((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const navGroups = [
    {
      label: "HOJE",
      items: [
        { key: "cockpit", label: "Cockpit", n: "01" },
        { key: "leads", label: "Caixa de Entrada / Leads", n: "02", badge: 6 },
        { key: "recuperacao", label: "Recuperação", n: "03" },
      ],
    },
    {
      label: "VENDER",
      items: [
        { key: "funis", label: "Funis / OpenFlow", n: "04" },
        { key: "criativos", label: "Criativos · Fábrica", n: "05" },
        { key: "campanhas", label: "Campanhas & Testes A/B", n: "06" },
      ],
    },
    {
      label: "CAPITAL",
      items: [
        { key: "ads", label: "Gerenciador Ads", n: "07" },
        { key: "financas", label: "Finanças", n: "08" },
      ],
    },
    {
      label: "SISTEMA",
      items: [
        { key: "system", label: "Design System", n: "09" },
        { key: "mapa", label: "Mapa do Sistema (74 rotas)", n: "10" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)] min-h-screen bg-[#0A0B0D] text-[#E8EAED] font-['Archivo',sans-serif]">
      {/* ── SIDEBAR DO REDESIGN ───────────────────────────────────────────── */}
      <aside className="border-r border-[#1B1E23] bg-[#0C0D10] flex flex-col md:sticky md:top-0 md:h-screen overflow-hidden">
        <div className="p-5 border-b border-[#1B1E23]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-[#D6FF4B] flex items-center justify-center font-mono text-xs font-bold text-[#0A0B0D]">
              i
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight leading-none">
                IMPERIO<span className="text-[#8A8F98]">HQ</span>
              </span>
              <span className="font-mono text-[9px] tracking-widest text-[#5F646D] mt-0.5">
                MASTER REDESIGN
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {navGroups.map((g, gIdx) => (
            <div key={gIdx}>
              <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] px-2 mb-1.5 uppercase">
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = screen === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => setScreen(item.key as any)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left transition-all ${
                        active
                          ? "bg-[#14161A] text-[#E8EAED] border-l-2 border-[#D6FF4B]"
                          : "text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]"
                      }`}
                    >
                      <span className="font-mono text-[9px] text-[#5F646D] w-3.5">
                        {item.n}
                      </span>
                      <span className="text-xs font-medium truncate flex-1">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className="font-mono text-[10px] font-bold text-[#0A0B0D] bg-[#D6FF4B] rounded-full px-1.5 py-0.2">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-[#1B1E23] flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#1B1E23] flex items-center justify-center font-mono text-[10px] text-[#8A8F98]">
            VS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">Vinicius Sugamele</div>
            <div className="font-mono text-[9px] text-[#5F646D]">OWNER · OPERAÇÃO DTC</div>
          </div>
        </div>
      </aside>

      {/* ── CONTEÚDO PRINCIPAL ────────────────────────────────────────────── */}
      <div className="flex flex-col min-w-0">
        {/* HEADER FLUTUANTE BLUR */}
        <header className="h-14 flex items-center gap-3.5 px-5 border-b border-[#1B1E23] bg-[#0A0B0D]/85 backdrop-blur sticky top-0 z-30">
          <div className="flex items-baseline gap-2 min-w-0 flex-1">
            <span className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] uppercase">
              {screen.toUpperCase()}
            </span>
            <span className="text-[#33373F]">/</span>
            <span className="text-sm font-semibold tracking-tight truncate">
              {screen === "cockpit" && "Cockpit Executivo & A Decisão de Hoje"}
              {screen === "leads" && "Caixa de Entrada · Fila Quente & Score"}
              {screen === "funis" && "Funis · LinfaFlow Care X1"}
              {screen === "recuperacao" && "Recuperação · 5 Buckets de Retenção"}
              {screen === "criativos" && "Criativos · Fábrica de 21 Ângulos"}
              {screen === "campanhas" && "Campanhas & Testes A/B Qui-Quadrado"}
              {screen === "ads" && "Gerenciador Ads · Corte do Dia"}
              {screen === "financas" && "Finanças & Caixa Comprometido"}
              {screen === "system" && "Design System · Regras Inquebráveis"}
              {screen === "mapa" && "Mapa do Sistema · 74 Rotas"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/cockpit"
              className="font-mono text-[10.5px] px-3 py-1 rounded bg-[#101215] border border-[#23262C] text-[#D6FF4B] hover:border-[#D6FF4B] transition-colors"
            >
              ABRIR COCKPIT TRI-MODO ↗
            </Link>
            <button
              onClick={() => setZen(!zen)}
              className={`font-mono text-[10.5px] px-3 py-1 rounded border transition-colors ${
                zen
                  ? "bg-[#D6FF4B] text-[#0A0B0D] border-[#D6FF4B] font-bold"
                  : "bg-[#101215] border-[#1B1E23] text-[#8A8F98] hover:text-[#E8EAED]"
              }`}
            >
              {zen ? "FOCO ON" : "FOCO"}
            </button>
          </div>
        </header>

        {/* TELAS */}
        <main className="flex-1 p-5 md:p-8 max-w-[1360px] mx-auto w-full space-y-6 animate-in fade-in duration-300">
          {/* TELA 1: COCKPIT */}
          {screen === "cockpit" && (
            <div className="space-y-6">
              <div className="border border-[#2A2E35] rounded-lg bg-gradient-to-b from-[#14171B] to-[#101215] p-6 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D6FF4B]" />
                <div className="font-mono text-[9px] tracking-[0.22em] text-[#D6FF4B] mb-2 uppercase font-semibold">
                  A DECISÃO DE HOJE
                </div>
                <h1 className="text-2xl md:text-3xl font-semibold mb-2">
                  LinfaFlow ADV03 queima <span className="font-mono text-[#FB7185]">R$ 1.240/dia</span> com ROAS 0,74 há 3 dias.
                </h1>
                <p className="text-sm text-[#8A8F98] max-w-2xl mb-4 leading-relaxed">
                  Pausar libera R$ 8.680 no orçamento da semana. O criativo ADV01 rodando no mesmo público está em 3,42x — dá pra realocar agora.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => toast.success("ADV03 pausado e verba realocada para ADV01!")}
                    className="h-9 px-4 rounded bg-[#D6FF4B] text-[#0A0B0D] text-xs font-bold hover:bg-[#E9FF8E]"
                  >
                    Pausar e Realocar
                  </button>
                  <button
                    onClick={() => setScreen("ads")}
                    className="h-9 px-4 rounded border border-[#2A2E35] text-xs font-medium hover:border-[#3D424A]"
                  >
                    Ver no Gerenciador
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 border-y border-[#23262C] divide-x divide-[#1B1E23]">
                {[
                  { label: "FATURAMENTO 30D", val: "R$ 284.320", delta: "+12,4%", good: true },
                  { label: "ADS INVESTIDO", val: "R$ 96.140", delta: "+21,0%", good: false },
                  { label: "ROAS BLENDED", val: "2,96x", delta: "−0,18", good: false },
                  { label: "LEADS NOVOS", val: "1.842", delta: "+8,1%", good: true },
                  { label: "CPA MÉDIO", val: "R$ 52,20", delta: "−R$ 3,40", good: true },
                ].map((k, i) => (
                  <div key={i} className="p-4">
                    <div className="font-mono text-[9px] tracking-wider text-[#5F646D] mb-1">{k.label}</div>
                    <div className="font-mono text-xl font-medium">{k.val}</div>
                    <div className={`font-mono text-[11px] mt-1 ${k.good ? "text-[#4ADE80]" : "text-[#FB7185]"}`}>{k.delta}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA 2: CAIXA DE ENTRADA / LEADS */}
          {screen === "leads" && (
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_300px] gap-4 items-start">
              {/* FILA QUENTE */}
              <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] overflow-hidden">
                <div className="p-3.5 border-b border-[#1B1E23] flex items-center justify-between">
                  <div>
                    <div className="font-mono text-[9px] tracking-[0.2em] text-[#D6FF4B]">RESPONDER AGORA · 6</div>
                    <div className="text-sm font-semibold">Fila Quente</div>
                  </div>
                  <span className="font-mono text-[10px] text-[#5F646D]">SLA 4M</span>
                </div>
                <div className="divide-y divide-[#14161A]">
                  {[
                    { name: "Marina Rocha", phone: "+55 11 9•••-4482", time: "há 2m", snippet: "Qual kit você recomenda pra começar?", tag: "QUENTE", channel: "WHATSAPP" },
                    { name: "Carlos Eduardo", phone: "+55 21 9•••-1109", time: "há 5m", snippet: "O frete é grátis pro Rio?", tag: "NOVO", channel: "DIRECT" },
                    { name: "Luciana Silva", phone: "+55 31 9•••-8843", time: "há 12m", snippet: "Gerei o PIX mas deu erro no banco", tag: "PIX", channel: "WHATSAPP" },
                  ].map((l, i) => (
                    <div key={i} className="p-3 hover:bg-[#121419] cursor-pointer transition-colors border-l-2 border-[#D6FF4B]">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-semibold">{l.name}</span>
                        <span className="font-mono text-[9px] text-[#5F646D]">{l.time}</span>
                      </div>
                      <div className="text-[11px] text-[#8A8F98] truncate mt-1">{l.snippet}</div>
                      <div className="flex gap-1.5 mt-2">
                        <span className="font-mono text-[8.5px] px-1.5 py-0.5 rounded bg-[#D6FF4B]/10 text-[#D6FF4B]">{l.tag}</span>
                        <span className="font-mono text-[8.5px] px-1.5 py-0.5 rounded border border-[#23262C] text-[#5F646D]">{l.channel}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CHAT CENTRAL */}
              <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] flex flex-col h-[580px]">
                <div className="p-3.5 border-b border-[#1B1E23] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Marina Rocha</div>
                    <div className="font-mono text-[9.5px] text-[#5F646D]">+55 11 9•••-4482 · LINFAFLOW CARE</div>
                  </div>
                  <button 
                    onClick={() => toast.success("Você assumiu a conversa da IA.")}
                    className="font-mono text-[10px] px-2.5 py-1 rounded border border-[#2A2E35] text-[#B7BCC4] hover:border-[#D6FF4B] hover:text-[#D6FF4B] transition-colors"
                  >
                    ASSUMIR DA IA
                  </button>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {chatThread.map((m, i) => (
                    <div key={i} className={`flex ${m.align}`}>
                      <div className="max-w-[80%]">
                        <div className="font-mono text-[9px] text-[#5F646D] mb-1">{m.who} · {m.time}</div>
                        <div 
                          className="p-3 rounded-lg text-xs leading-relaxed"
                          style={{ background: m.bg, border: `1px solid ${m.border}`, color: m.fg }}
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3 border-t border-[#1B1E23] space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      placeholder="Responder para Marina no WhatsApp..."
                      className="flex-1 bg-[#0A0B0D] border border-[#23262C] rounded px-3 py-2 text-xs focus:outline-none focus:border-[#D6FF4B]"
                    />
                    <button
                      onClick={handleSendMessage}
                      className="px-4 py-2 rounded bg-[#D6FF4B] text-[#0A0B0D] font-bold text-xs hover:bg-[#E9FF8E]"
                    >
                      ENVIAR
                    </button>
                  </div>
                </div>
              </div>

              {/* SCORE & TIMELINE */}
              <div className="space-y-4">
                <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] p-4">
                  <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] mb-2 uppercase">SCORE DO LEAD</div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-4xl font-bold text-[#D6FF4B]">87</span>
                    <span className="font-mono text-xs text-[#8A8F98]">/100 · ALTA INTENÇÃO</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#1B1E23] mt-3 overflow-hidden">
                    <div className="h-1.5 bg-[#D6FF4B] w-[87%]" />
                  </div>
                  <div className="mt-4 space-y-2 text-xs divide-y divide-[#1B1E23]">
                    <div className="flex justify-between pt-2 text-[#8A8F98]">
                      <span>Interação com ADV01</span>
                      <span className="font-mono text-[#D6FF4B]">+35 pts</span>
                    </div>
                    <div className="flex justify-between pt-2 text-[#8A8F98]">
                      <span>Tempo de retenção 3m</span>
                      <span className="font-mono text-[#D6FF4B]">+25 pts</span>
                    </div>
                    <div className="flex justify-between pt-2 text-[#8A8F98]">
                      <span>Iniciou checkout</span>
                      <span className="font-mono text-[#D6FF4B]">+27 pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TELA 3: RECUPERAÇÃO EM 5 BUCKETS */}
          {screen === "recuperacao" && (
            <div className="space-y-6">
              <div className="border border-[#2A2E35] rounded-lg bg-[#101215] p-5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FB7185]" />
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="font-mono text-[9px] tracking-[0.2em] text-[#FB7185] uppercase mb-1 font-semibold">
                      RESGATE DE HOJE
                    </div>
                    <h2 className="text-xl font-bold">
                      74 PIX esfriando somam <span className="font-mono text-[#FB7185]">R$ 38.400</span> e ninguém tocou neles
                    </h2>
                    <p className="text-xs text-[#8A8F98] mt-1 max-w-xl">
                      A janela útil fecha em 24h. Disparar a IA nos 25 mais recentes com o template de PIX 2–24h recupera em média 22% do volume.
                    </p>
                  </div>
                  <button
                    onClick={() => toast.success("Disparo de IA iniciado para os 25 leads do bucket!")}
                    className="h-9 px-5 rounded bg-[#D6FF4B] text-[#0A0B0D] font-bold text-xs hover:bg-[#E9FF8E]"
                  >
                    Disparar IA · 25 leads
                  </button>
                </div>
              </div>

              {/* BUCKETS */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {REC_BUCKETS.map((b, idx) => {
                  const active = bucketIdx === idx;
                  return (
                    <div
                      key={b.id}
                      onClick={() => setBucketIdx(idx)}
                      className={`border rounded-lg p-3.5 cursor-pointer transition-all ${
                        active
                          ? "border-[#D6FF4B] bg-[#14171A]"
                          : "border-[#1B1E23] bg-[#0E1013] hover:border-[#2A2E35]"
                      }`}
                    >
                      <div className="flex justify-between items-baseline font-mono text-[9.5px]">
                        <span className={active ? "text-[#D6FF4B] font-bold" : "text-[#5F646D]"}>{b.short}</span>
                        <span className="text-[#8A8F98]">{b.count}</span>
                      </div>
                      <div className="font-mono text-lg font-bold mt-2 text-[#E8EAED]">{b.value}</div>
                      <div className="text-[11px] text-[#5F646D] mt-1">Recup: {b.rate}</div>
                    </div>
                  );
                })}
              </div>

              {/* TABELA DE LEADS DO BUCKET */}
              <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] overflow-hidden">
                <div className="p-4 border-b border-[#1B1E23] flex justify-between items-center">
                  <div>
                    <div className="font-mono text-[9px] text-[#5F646D] uppercase">FILA DE RECUPERAÇÃO</div>
                    <div className="text-sm font-semibold">{activeBucket.title}</div>
                  </div>
                  <span className="font-mono text-xs text-[#D6FF4B] font-bold">{activeBucket.value} EM JOGO</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#23262C] font-mono text-[9px] text-[#5F646D]">
                        <th className="p-3">LEAD</th>
                        <th className="p-3">PRODUTO</th>
                        <th className="p-3 text-right">VALOR</th>
                        <th className="p-3">TEMPO</th>
                        <th className="p-3 text-right">AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1B1E23]">
                      {activeBucket.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-[#111317]">
                          <td className="p-3">
                            <div className="font-semibold">{r.name}</div>
                            <div className="font-mono text-[9.5px] text-[#5F646D]">{r.contact}</div>
                          </td>
                          <td className="p-3 text-[#B7BCC4]">{r.product}</td>
                          <td className="p-3 text-right font-mono font-bold text-[#E8EAED]">{r.value}</td>
                          <td className="p-3">
                            <span className="font-mono text-[10px]" style={{ color: r.ageColor }}>
                              {r.age}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => toast.success(`Mensagem de recuperação enviada para ${r.name}`)}
                              className="font-mono text-[10px] text-[#D6FF4B] hover:underline"
                            >
                              WHATSAPP →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TELA 4: CRIATIVOS · FÁBRICA DE 21 ÂNGULOS */}
          {screen === "criativos" && (
            <div className="space-y-6">
              <div className="flex gap-2 border-b border-[#23262C] pb-2 font-mono text-xs">
                <button
                  onClick={() => setCTab("lotes")}
                  className={`px-3 py-1 rounded ${cTab === "lotes" ? "bg-[#D6FF4B] text-[#0A0B0D] font-bold" : "text-[#8A8F98]"}`}
                >
                  LOTES DE GERAÇÃO
                </button>
                <button
                  onClick={() => setCTab("lote")}
                  className={`px-3 py-1 rounded ${cTab === "lote" ? "bg-[#D6FF4B] text-[#0A0B0D] font-bold" : "text-[#8A8F98]"}`}
                >
                  LOTE ABERTO (MEMOFLOW)
                </button>
                <button
                  onClick={() => setCTab("novo")}
                  className={`px-3 py-1 rounded ${cTab === "novo" ? "bg-[#D6FF4B] text-[#0A0B0D] font-bold" : "text-[#8A8F98]"}`}
                >
                  + NOVO LOTE (21 ÂNGULOS)
                </button>
              </div>

              {cTab === "lotes" && (
                <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] p-4 space-y-4">
                  <div className="text-sm font-semibold">Lotes Recentes na Fábrica</div>
                  <div className="divide-y divide-[#1B1E23]">
                    {[
                      { nome: "MemoFlow — 18/09/2026", angulos: "6 ângulos × 4 variações", progresso: "24/24", pct: 100, status: "COMPLETED" },
                      { nome: "LinfaFlow — Esteira P3", angulos: "4 ângulos × 4 variações", progresso: "16/16", pct: 100, status: "COMPLETED" },
                      { nome: "SlimSoda — Abertura DTC", angulos: "8 ângulos × 3 variações", progresso: "18/24", pct: 75, status: "GERANDO" },
                    ].map((b, i) => (
                      <div key={i} className="py-3 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold text-[#E8EAED]">{b.nome}</div>
                          <div className="font-mono text-[10px] text-[#5F646D]">{b.angulos}</div>
                        </div>
                        <div className="w-48 text-right">
                          <div className="font-mono text-xs">{b.progresso}</div>
                          <div className="h-1 rounded-full bg-[#1B1E23] mt-1 overflow-hidden">
                            <div className="h-1 bg-[#D6FF4B]" style={{ width: `${b.pct}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cTab === "lote" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold">MemoFlow — 24 Criativos Gerados</h2>
                      <p className="text-xs text-[#8A8F98]">Formato 4:5 · 6 ângulos × 4 variações · 14 aprovados</p>
                    </div>
                    <button 
                      onClick={() => toast.success("14 criativos enviados para Mídias!")}
                      className="px-4 py-2 rounded bg-[#D6FF4B] text-[#0A0B0D] font-bold text-xs"
                    >
                      Enviar Aprovados pra Mídias
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <div key={n} className="border border-[#1B1E23] rounded-lg bg-[#0E1013] overflow-hidden">
                        <div className="aspect-[4/5] bg-[#14161A] flex flex-col justify-end p-3 relative">
                          <span className="absolute top-2 left-2 font-mono text-[9px] bg-[#0A0B0D]/80 px-2 py-0.5 rounded text-[#D6FF4B]">
                            4:5 · MEMOFLOW
                          </span>
                          <span className="text-xs font-bold text-white drop-shadow">
                            "Depois dos 40, sua memória não falha por idade, mas por toxina."
                          </span>
                        </div>
                        <div className="p-3 flex justify-between items-center border-t border-[#1B1E23]">
                          <span className="font-mono text-[9px] text-[#5F646D]">ÂNGULO CURIOSIDADE</span>
                          <button
                            onClick={() => toast.success("Criativo aprovado!")}
                            className="font-mono text-[10px] text-[#D6FF4B] hover:underline font-bold"
                          >
                            APROVAR ✓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cTab === "novo" && (
                <div className="space-y-6 border border-[#1B1E23] rounded-lg bg-[#0E1013] p-6">
                  <div>
                    <div className="font-mono text-[9px] text-[#D6FF4B] uppercase mb-1">CATÁLOGO DE 21 ÂNGULOS PERSUASIVOS</div>
                    <h2 className="text-lg font-bold">Selecione os ângulos para disparar o lote</h2>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {CRI_ANGULOS.map((a) => {
                      const selected = selectedAngulos.includes(a.slug);
                      return (
                        <div
                          key={a.slug}
                          onClick={() => toggleAngulo(a.slug)}
                          className={`p-3 rounded border cursor-pointer transition-all ${
                            selected
                              ? "border-[#D6FF4B] bg-[#161B12]"
                              : "border-[#1B1E23] bg-[#0A0B0D] hover:border-[#2A2E35]"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-mono text-[8.5px] text-[#5F646D]">{a.cat}</span>
                            <span className={`w-2.5 h-2.5 rounded-sm border ${selected ? "bg-[#D6FF4B] border-[#D6FF4B]" : "border-[#3D424A]"}`} />
                          </div>
                          <div className="text-xs font-semibold">{a.nome}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-4 border-t border-[#1B1E23] flex justify-between items-center">
                    <span className="font-mono text-xs text-[#8A8F98]">
                      {selectedAngulos.length} ângulos selecionados × 4 variações = {selectedAngulos.length * 4} criativos
                    </span>
                    <button
                      onClick={() => {
                        toast.success(`Lote de ${selectedAngulos.length * 4} criativos iniciado na fábrica!`);
                        setCTab("lotes");
                      }}
                      className="px-5 py-2.5 rounded bg-[#D6FF4B] text-[#0A0B0D] font-bold text-xs"
                    >
                      Disparar Lote na Fábrica →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TELA 5: CAMPANHAS & TESTES A/B */}
          {screen === "campanhas" && (
            <div className="space-y-6">
              <div className="border border-[#2A2E35] rounded-lg bg-[#101215] p-5 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FB7185]" />
                <div className="font-mono text-[9px] text-[#FB7185] uppercase mb-1">VAZAMENTO DE NUTRIÇÃO</div>
                <h2 className="text-lg font-bold">3 campanhas ativas sem sequência padrão associada</h2>
                <p className="text-xs text-[#8A8F98] mt-1 max-w-xl">
                  Lead capturado nessas campanhas não entra em nenhuma automação. São 924 leads nos últimos 30 dias que não receberam nutrição.
                </p>
              </div>

              <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] overflow-hidden">
                <div className="p-4 border-b border-[#1B1E23]">
                  <h3 className="text-sm font-semibold">Testes A/B de Copy no WhatsApp (Avaliador Qui-Quadrado)</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="border border-[#23262C] rounded p-4 bg-[#101215] space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-xs">Teste 01 · Abertura X1 LinfaFlow</span>
                      <span className="font-mono text-[9.5px] bg-[#4ADE80]/10 text-[#4ADE80] px-2 py-0.5 rounded">
                        SIGNIFICÂNCIA p &lt; 0.01 (PROMOVIDO)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 border border-[#2A2E35] rounded bg-[#0A0B0D]">
                        <div className="font-bold text-[#D6FF4B] mb-1">Variante B (Vencedora · 42.1% conv)</div>
                        <p className="text-[#8A8F98] italic">"Oi, vi que você quer desinchar sem cortar comida. É isso mesmo?"</p>
                      </div>
                      <div className="p-3 border border-[#1B1E23] rounded bg-[#0A0B0D] opacity-60">
                        <div className="font-bold text-[#5F646D] mb-1">Variante A (Controle · 26.4% conv)</div>
                        <p className="text-[#8A8F98] italic">"Olá, tudo bem? Você gostaria de conhecer o LinfaFlow?"</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TELA 6: DESIGN SYSTEM */}
          {screen === "system" && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <div className="font-mono text-[9px] text-[#D6FF4B] uppercase mb-1">DIREÇÃO VISUAL</div>
                <h2 className="text-2xl font-bold">Painel de instrumentos, não revista.</h2>
                <p className="text-sm text-[#8A8F98] mt-2 leading-relaxed">
                  Grafite frio (`#0A0B0D`), hairlines em vez de caixas pesadas (`#1B1E23`), números em monoespaçado (`IBM Plex Mono`) e um único acento funcional cítrico (`#D6FF4B`). O acento nunca decora: ele marca a coisa que exige decisão.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { name: "Grafite Fundo", hex: "#0A0B0D" },
                  { name: "Hairline Borda", hex: "#1B1E23" },
                  { name: "Acento Decisão", hex: "#D6FF4B" },
                  { name: "Alerta Crítico", hex: "#FB7185" },
                ].map((s, i) => (
                  <div key={i} className="border border-[#1B1E23] rounded overflow-hidden">
                    <div className="h-12" style={{ background: s.hex }} />
                    <div className="p-2.5 bg-[#0C0D10] text-xs">
                      <div className="font-medium">{s.name}</div>
                      <div className="font-mono text-[10px] text-[#5F646D]">{s.hex}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TELA 7: MAPA DO SISTEMA */}
          {screen === "mapa" && (
            <div className="space-y-4">
              <div>
                <div className="font-mono text-[9px] text-[#D6FF4B] uppercase mb-1">INVENTÁRIO COMPLETO</div>
                <h2 className="text-xl font-bold">74 Rotas do ImperioHQ Mapeadas por Onda</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
                <div className="p-3 border border-[#1B1E23] bg-[#0E1013] rounded">
                  <span className="text-[#D6FF4B] font-bold">REDESENHADO</span>
                  <p className="text-[11px] text-[#8A8F98] mt-1">Cockpit, Leads, Recuperação, Fábrica e Testes A/B já possuem a casca nova.</p>
                </div>
                <div className="p-3 border border-[#1B1E23] bg-[#0E1013] rounded">
                  <span className="text-[#60A5FA] font-bold">ESPELHO · ONDA 2</span>
                  <p className="text-[11px] text-[#8A8F98] mt-1">Herda a casca das telas prontas sem decisão nova de arquitetura.</p>
                </div>
                <div className="p-3 border border-[#1B1E23] bg-[#0E1013] rounded">
                  <span className="text-[#8A8F98] font-bold">ONDA 3 · PROFUNDA</span>
                  <p className="text-[11px] text-[#8A8F98] mt-1">Uma por vez, com leitura prévia do código para não quebrar regras de negócio.</p>
                </div>
                <div className="p-3 border border-[#1B1E23] bg-[#0E1013] rounded">
                  <span className="text-[#FB7185] font-bold">NÃO MEXER</span>
                  <p className="text-[11px] text-[#8A8F98] mt-1">Funis públicos ao vivo com faturamento e conversão em jogo.</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
