import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  Play, Pause, ArrowUpRight, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, Sparkles, Filter, ChevronRight,
  Maximize2, Minimize2, ArrowRight
} from "lucide-react";

type CockpitTheme = "grafite" | "papel" | "terminal";

export default function Cockpit() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<CockpitTheme>(() => {
    try {
      const saved = localStorage.getItem("imphq:cockpit:theme");
      if (saved === "papel" || saved === "terminal") return saved;
    } catch {}
    return "grafite";
  });

  const [zenMode, setZenMode] = useState(false);
  const [pausedAdv, setPausedAdv] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("imphq:cockpit:theme", theme);
    } catch {}
  }, [theme]);

  const barData = [42, 55, 38, 61, 73, 49, 58, 80, 66, 52, 71, 88, 64, 79];

  const handlePauseAdv = () => {
    setPausedAdv(true);
    toast.success("ADV03 LinfaFlow pausado! R$ 1.240/dia realocado para ADV01.", {
      description: "Economia estimada de R$ 8.680 no orçamento da semana.",
    });
  };

  return (
    <div className="w-full min-h-screen relative">
      {/* ── BARRA FLUTUANTE DE CONTROLE TRI-MODO ───────────────────────────── */}
      <div 
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 p-1.5 rounded-lg border shadow-2xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-5"
        style={{
          background: theme === "papel" ? "#EDEAE3/95" : theme === "terminal" ? "#0D0F12/95" : "#101215/95",
          borderColor: theme === "papel" ? "#B5AEA2" : theme === "terminal" ? "#2A2F37" : "#23262C",
          color: theme === "papel" ? "#14120F" : theme === "terminal" ? "#D7DBE0" : "#E8EAED",
        }}
      >
        <div className="font-mono text-[9px] px-2 uppercase font-bold tracking-wider opacity-60">
          TEMA DO COCKPIT:
        </div>
        <button
          onClick={() => setTheme("grafite")}
          className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
            theme === "grafite" 
              ? "bg-[#D6FF4B] text-[#0A0B0D] font-bold shadow" 
              : "opacity-70 hover:opacity-100"
          }`}
        >
          🎛️ Grafite
        </button>
        <button
          onClick={() => setTheme("papel")}
          className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
            theme === "papel" 
              ? "bg-[#D93A14] text-white font-bold shadow" 
              : "opacity-70 hover:opacity-100"
          }`}
        >
          📰 Papel
        </button>
        <button
          onClick={() => setTheme("terminal")}
          className={`px-3 py-1.5 text-xs font-mono rounded transition-all ${
            theme === "terminal" 
              ? "bg-[#FFB020] text-[#07080A] font-bold shadow" 
              : "opacity-70 hover:opacity-100"
          }`}
        >
          📟 Terminal
        </button>

        <div className="h-4 w-px bg-current opacity-20 mx-1" />

        <Link
          to="/redesign"
          className="px-2.5 py-1.5 text-xs font-mono rounded hover:underline opacity-80 hover:opacity-100"
          style={{
            color: theme === "papel" ? "#D93A14" : theme === "terminal" ? "#FFB020" : "#D6FF4B",
          }}
        >
          Master Redesign ↗
        </Link>
      </div>

      {/* ────────────────────────────────────────────────────────────────────
          1. MODO GRAFITE (IMPERIOHQ REDESIGN MASTER)
      ──────────────────────────────────────────────────────────────────── */}
      {theme === "grafite" && (
        <CockpitGrafiteWithSidebar
          barData={barData}
          pausedAdv={pausedAdv}
          onPauseAdv={handlePauseAdv}
          zenMode={zenMode}
          onToggleZen={() => setZenMode(!zenMode)}
        />
      )}

      {/* ────────────────────────────────────────────────────────────────────
          2. MODO PAPEL OPERACIONAL (EDITORIAL)
      ──────────────────────────────────────────────────────────────────── */}
      {theme === "papel" && (
        <CockpitPapelWithSidebar
          barData={barData}
          pausedAdv={pausedAdv}
          onPauseAdv={handlePauseAdv}
          zenMode={zenMode}
        />
      )}

      {/* ────────────────────────────────────────────────────────────────────
          3. MODO TERMINAL BLOOMBERG
      ──────────────────────────────────────────────────────────────────── */}
      {theme === "terminal" && (
        <CockpitTerminalWithSidebar
          barData={barData}
          pausedAdv={pausedAdv}
          onPauseAdv={handlePauseAdv}
          zenMode={zenMode}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   1. MODO GRAFITE COM SIDEBAR NATIVA DO IMPERIOHQ REDESIGN
   ══════════════════════════════════════════════════════════════════════════════ */
function CockpitGrafiteWithSidebar({
  barData,
  pausedAdv,
  onPauseAdv,
  zenMode,
  onToggleZen,
}: {
  barData: number[];
  pausedAdv: boolean;
  onPauseAdv: () => void;
  zenMode: boolean;
  onToggleZen: () => void;
}) {
  const kpis = [
    { label: "FATURAMENTO", value: "R$ 284.320", delta: "+12,4%", color: "#E8EAED", deltaColor: "#4ADE80" },
    { label: "ADS", value: "R$ 96.140", delta: "+21,0%", color: "#E8EAED", deltaColor: "#FB7185" },
    { label: "ROAS", value: "2,96x", delta: "−0,18", color: "#D6FF4B", deltaColor: "#FBBF24" },
    { label: "LEADS", value: "1.842", delta: "+8,1%", color: "#E8EAED", deltaColor: "#4ADE80" },
    { label: "CPA", value: "R$ 52,20", delta: "−R$ 3,40", color: "#E8EAED", deltaColor: "#4ADE80" },
  ];

  const queue = [
    { label: "3 leads quentes sem resposta há 20min", dot: "#FB7185", link: "/redesign" },
    { label: "Checkout Care caiu 18% desde ontem", dot: "#FBBF24", link: "/redesign" },
    { label: "Saldo Meta cobre 6 dias", dot: "#FBBF24", link: "/redesign" },
    { label: "MemoFlow bateu meta do mês", dot: "#4ADE80", link: "/redesign" },
  ];

  const projects = [
    { name: "LinfaFlow", revenue: "R$ 121.400", roas: "3,42x", share: 100, fill: "#D6FF4B", roasColor: "#4ADE80" },
    { name: "MemoFlow", revenue: "R$ 78.900", roas: "2,88x", share: 65, fill: "#D6FF4B", roasColor: "#4ADE80" },
    { name: "Equilibre On", revenue: "R$ 44.260", roas: "1,94x", share: 36, fill: "#5F646D", roasColor: "#FBBF24" },
    { name: "Cinna Shield", revenue: "R$ 27.510", roas: "1,12x", share: 23, fill: "#5F646D", roasColor: "#FBBF24" },
    { name: "Slim Soda", revenue: "R$ 12.250", roas: "0,74x", share: 10, fill: "#3D424A", roasColor: "#FB7185" },
  ];

  const minor = [
    { label: "SLA MÉDIO", value: "3m 42s" },
    { label: "RECUPERAÇÃO PIX", value: "41,2%" },
    { label: "CUSTO IA", value: "$ 14,20 / dia" },
    { label: "LEADS HOJE", value: "148 leads" },
    { label: "BOLETOS A VENCER", value: "31 itens" },
    { label: "LTV ESTIMADO 90D", value: "R$ 684" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)] min-h-screen bg-[#0A0B0D] text-[#E8EAED] font-['Archivo',sans-serif]">
      {/* SIDEBAR NATIVA REDESIGN */}
      <aside className="border-r border-[#1B1E23] bg-[#0C0D10] flex flex-col md:sticky md:top-0 md:h-screen overflow-hidden">
        <div className="p-5 border-b border-[#1B1E23]">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-[#D6FF4B] flex items-center justify-center font-mono text-[11px] font-bold text-[#0A0B0D]">
              i
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight leading-none">
                IMPERIO<span className="text-[#8A8F98]">HQ</span>
              </span>
              <span className="font-mono text-[9px] tracking-widest text-[#5F646D] mt-0.5">
                OPERAÇÃO ÚNICA
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] px-2 mb-1.5 uppercase">HOJE</div>
            <div className="space-y-0.5">
              <Link to="/cockpit" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs bg-[#14161A] text-[#E8EAED] border-l-2 border-[#D6FF4B] font-medium">
                <span className="font-mono text-[9px] text-[#5F646D]">01</span>
                <span>Cockpit</span>
              </Link>
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">02</span>
                <span className="flex-1">Caixa de Entrada</span>
                <span className="font-mono text-[10px] font-bold text-[#0A0B0D] bg-[#D6FF4B] rounded-full px-1.5">6</span>
              </Link>
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">03</span>
                <span>Leads</span>
              </Link>
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">04</span>
                <span>Recuperação</span>
              </Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] px-2 mb-1.5 uppercase">VENDER</div>
            <div className="space-y-0.5">
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">05</span>
                <span>Funis / OpenFlow</span>
              </Link>
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">06</span>
                <span>Criativos · 21 Ângulos</span>
              </Link>
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">07</span>
                <span>Campanhas / Testes A/B</span>
              </Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] px-2 mb-1.5 uppercase">CAPITAL</div>
            <div className="space-y-0.5">
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">08</span>
                <span>Gerenciador Ads</span>
              </Link>
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">09</span>
                <span>Finanças</span>
              </Link>
            </div>
          </div>

          <div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] px-2 mb-1.5 uppercase">SISTEMA</div>
            <div className="space-y-0.5">
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">10</span>
                <span>Design System</span>
              </Link>
              <Link to="/redesign" className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-xs text-[#9BA1AA] hover:bg-[#121418] hover:text-[#E8EAED]">
                <span className="font-mono text-[9px] text-[#5F646D]">11</span>
                <span>Mapa do Sistema</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="p-3.5 border-t border-[#1B1E23] flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#1B1E23] flex items-center justify-center font-mono text-[10px] text-[#8A8F98]">
            VS
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">Vinicius Sugamele</div>
            <div className="font-mono text-[9px] text-[#5F646D]">OWNER</div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-6 border-b border-[#1B1E23] bg-[#0A0B0D]/85 backdrop-blur sticky top-0 z-30">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D]">OVERVIEW</span>
            <span className="text-[#33373F]">/</span>
            <span className="text-sm font-semibold tracking-tight text-[#E8EAED]">Cockpit Executivo</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#101215] border border-[#1B1E23] font-mono text-[10px] text-[#8A8F98]">
              <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
              AO VIVO · 14 LEADS/H
            </div>
            <button
              onClick={onToggleZen}
              className="font-mono text-[10px] px-3 py-1 rounded border border-[#23262C] text-[#8A8F98] hover:text-[#D6FF4B] hover:border-[#D6FF4B] transition-colors"
            >
              {zenMode ? "SAIR FOCO" : "MODO FOCO"}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-[1340px] mx-auto w-full space-y-6 animate-in fade-in duration-300">
          {/* A DECISÃO DE HOJE */}
          <section className="relative border border-[#2A2E35] rounded-lg bg-gradient-to-b from-[#14171B] to-[#101215] p-6 overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#D6FF4B]" />
            <div className="flex flex-wrap lg:flex-nowrap gap-8 items-start">
              <div className="flex-1 min-w-[280px]">
                <div className="font-mono text-[9px] tracking-[0.22em] text-[#D6FF4B] mb-2 uppercase font-semibold">
                  A DECISÃO DE HOJE
                </div>
                <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight mb-2.5">
                  LinfaFlow ADV03 queima{" "}
                  <span className="font-mono text-[#FB7185]">R$ 1.240/dia</span> com ROAS 0,74 há 3 dias.
                </h2>
                <p className="text-sm text-[#8A8F98] leading-relaxed max-w-2xl mb-6">
                  Pausar libera R$ 8.680 no orçamento da semana. O criativo ADV01 rodando no mesmo público está em 3,42x — capacidade comprovada de absorver a verba hoje.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={onPauseAdv}
                    disabled={pausedAdv}
                    className={`h-9 px-5 rounded font-semibold text-xs transition-all ${
                      pausedAdv
                        ? "bg-[#1F232A] text-[#8A8F98] cursor-not-allowed border border-[#2A2E35]"
                        : "bg-[#D6FF4B] text-[#0A0B0D] hover:bg-[#E9FF8E] active:scale-95 shadow-sm"
                    }`}
                  >
                    {pausedAdv ? "✓ ADV03 Pausado e Realocado" : "Pausar e Realocar"}
                  </button>
                  <Link
                    to="/redesign"
                    className="h-9 px-4 rounded border border-[#2A2E35] text-xs font-medium text-[#E8EAED] hover:border-[#3D424A] flex items-center gap-1.5 transition-colors"
                  >
                    Ver Criativo
                  </Link>
                  <button 
                    onClick={() => toast.info("Decisão adiada por 24 horas.")}
                    className="h-9 px-3 font-mono text-[10.5px] tracking-wider text-[#5F646D] hover:text-[#8A8F98] transition-colors"
                  >
                    IGNORAR HOJE
                  </button>
                </div>
              </div>

              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-[#23262C] pt-4 lg:pt-0 lg:pl-6 shrink-0">
                <div className="font-mono text-[9px] tracking-[0.18em] text-[#5F646D] mb-3 uppercase">
                  NA FILA · 4 PENDÊNCIAS
                </div>
                <div className="flex flex-col divide-y divide-[#1B1E23]">
                  {queue.map((q, idx) => (
                    <Link
                      key={idx}
                      to={q.link}
                      className="flex items-start gap-2.5 py-2.5 group hover:opacity-80 transition-opacity"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: q.dot }}
                      />
                      <span className="text-xs text-[#B7BCC4] group-hover:text-white leading-snug">
                        {q.label}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* KPIS 30D */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between font-mono text-[9px] tracking-[0.2em] text-[#5F646D]">
              <span>CAIXA · ÚLTIMOS 30 DIAS</span>
              <span className="hover:text-[#D6FF4B] cursor-pointer">EXPORTAR AUDITORIA</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 border-y border-[#23262C] divide-x divide-[#1B1E23]">
              {kpis.map((k, i) => (
                <div key={i} className="p-4 min-w-0">
                  <div className="font-mono text-[9px] tracking-wider text-[#5F646D] mb-2 truncate">
                    {k.label}
                  </div>
                  <div
                    className="font-mono text-2xl font-medium tracking-tight truncate"
                    style={{ color: k.color }}
                  >
                    {k.value}
                  </div>
                  <div
                    className="font-mono text-[11px] mt-1.5"
                    style={{ color: k.deltaColor }}
                  >
                    {k.delta}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* BARRAS 14D E PROJETOS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] p-5">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] mb-1">
                    RECEITA VS. ADS
                  </div>
                  <div className="text-base font-semibold text-[#E8EAED]">
                    Onde o capital vira caixa
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[#8A8F98]">14D</span>
              </div>

              <div className="flex items-end gap-1.5 h-36 border-b border-[#1B1E23] pb-2">
                {barData.map((v, i) => {
                  const rev = Math.round(v * 0.72);
                  const ads = Math.round(v * 0.3);
                  const isLast = i === barData.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 h-full">
                      <div
                        className="w-full rounded-t-sm transition-all"
                        style={{
                          height: `${rev}%`,
                          background: isLast ? "#D6FF4B" : "#3A4322",
                        }}
                      />
                      <div
                        className="w-full bg-[#23262C] rounded-b-sm"
                        style={{ height: `${ads}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-6 mt-4 pt-2 border-t border-[#1B1E23]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-[#D6FF4B]" />
                  <span className="font-mono text-[10px] text-[#8A8F98]">RECEITA BRUTA</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm bg-[#23262C]" />
                  <span className="font-mono text-[10px] text-[#8A8F98]">ADS INVESTIDO</span>
                </div>
              </div>
            </div>

            <div className="border border-[#1B1E23] rounded-lg bg-[#0E1013] p-5">
              <div className="font-mono text-[9px] tracking-[0.2em] text-[#5F646D] mb-1">
                PROJETOS
              </div>
              <div className="text-base font-semibold text-[#E8EAED] mb-4">
                Quem paga a conta
              </div>

              <div className="divide-y divide-[#1B1E23]">
                {projects.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_60px] items-center gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#E8EAED] truncate">
                        {p.name}
                      </div>
                      <div className="h-1 rounded-full bg-[#1B1E23] mt-1.5 overflow-hidden">
                        <div
                          className="h-1 rounded-full"
                          style={{ width: `${p.share}%`, background: p.fill }}
                        />
                      </div>
                    </div>
                    <div className="font-mono text-xs text-right text-[#E8EAED]">
                      {p.revenue}
                    </div>
                    <div
                      className="font-mono text-xs text-right font-medium"
                      style={{ color: p.roasColor }}
                    >
                      {p.roas}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SEGUNDO PLANO */}
          {!zenMode && (
            <section className="space-y-3 pt-2">
              <div className="font-mono text-[9px] tracking-[0.22em] text-[#5F646D]">
                SEGUNDO PLANO · SÓ CONSULTA
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-[#1B1E23] border border-[#1B1E23] rounded-lg overflow-hidden">
                {minor.map((m, i) => (
                  <div key={i} className="bg-[#0C0D10] p-4 hover:bg-[#101215] transition-colors">
                    <div className="font-mono text-[9px] tracking-wider text-[#5F646D] mb-1.5 truncate">
                      {m.label}
                    </div>
                    <div className="font-mono text-sm text-[#B7BCC4] font-medium truncate">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. MODO PAPEL OPERACIONAL COM SIDEBAR EDITORIAL NATIVA
   ══════════════════════════════════════════════════════════════════════════════ */
function CockpitPapelWithSidebar({
  barData,
  pausedAdv,
  onPauseAdv,
  zenMode,
}: {
  barData: number[];
  pausedAdv: boolean;
  onPauseAdv: () => void;
  zenMode: boolean;
}) {
  const kpis = [
    { label: "FATURAMENTO", value: "R$ 284.320", delta: "+12,4%", color: "#14120F", deltaColor: "#2E7D52" },
    { label: "ADS", value: "R$ 96.140", delta: "+21,0%", color: "#14120F", deltaColor: "#D93A14" },
    { label: "ROAS", value: "2,96x", delta: "−0,18", color: "#D93A14", deltaColor: "#B8860B" },
    { label: "LEADS", value: "1.842", delta: "+8,1%", color: "#14120F", deltaColor: "#2E7D52" },
    { label: "CPA", value: "R$ 52,20", delta: "−R$ 3,40", color: "#14120F", deltaColor: "#2E7D52" },
  ];

  const queue = [
    { n: "01", label: "3 leads quentes sem resposta há 20min", color: "#D93A14" },
    { n: "02", label: "Checkout Care caiu 18% desde ontem", color: "#B8860B" },
    { n: "03", label: "Saldo Meta cobre 6 dias", color: "#B8860B" },
    { n: "04", label: "MemoFlow bateu meta do mês", color: "#2E7D52" },
  ];

  const projects = [
    { name: "LinfaFlow", revenue: "R$ 121.400", roas: "3,42x", share: 100, fill: "#14120F", roasColor: "#2E7D52" },
    { name: "MemoFlow", revenue: "R$ 78.900", roas: "2,88x", share: 65, fill: "#14120F", roasColor: "#2E7D52" },
    { name: "Equilibre On", revenue: "R$ 44.260", roas: "1,94x", share: 36, fill: "#4A443B", roasColor: "#B8860B" },
    { name: "Cinna Shield", revenue: "R$ 27.510", roas: "1,12x", share: 23, fill: "#4A443B", roasColor: "#B8860B" },
    { name: "Slim Soda", revenue: "R$ 12.250", roas: "0,74x", share: 10, fill: "#8C857A", roasColor: "#D93A14" },
  ];

  const minor = [
    { label: "SLA MÉDIO", value: "3m 42s" },
    { label: "RECUPERAÇÃO PIX", value: "41,2%" },
    { label: "CUSTO IA", value: "$ 14,20 / dia" },
    { label: "LEADS HOJE", value: "148 leads" },
    { label: "BOLETOS A VENCER", value: "31 itens" },
    { label: "LTV ESTIMADO 90D", value: "R$ 684" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[212px_minmax(0,1fr)] min-h-screen bg-[#EDEAE3] text-[#14120F] font-['Familjen_Grotesk',sans-serif]">
      {/* SIDEBAR PAPEL OPERACIONAL */}
      <aside className="bg-[#14120F] text-[#EDEAE3] flex flex-col md:sticky md:top-0 md:h-screen overflow-hidden">
        <div className="p-5 border-b border-[#2C2822]">
          <div className="font-['Martian_Mono',monospace] text-[8.5px] tracking-[0.24em] text-[#8C857A] mb-1.5 uppercase">
            OPERAÇÃO
          </div>
          <div className="text-xl font-bold tracking-tight">IMPERIO HQ</div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
          <div>
            <div className="font-['Martian_Mono',monospace] text-[8px] tracking-[0.2em] text-[#6E675D] px-2 mb-1.5 uppercase">
              HOJE
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-[#221F1A] text-[#EDEAE3] font-semibold cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#D93A14] rounded-sm" />
                <span>Cockpit</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#B5AEA2] hover:bg-[#221F1A] cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#3A352E] rounded-sm" />
                <span className="flex-1">Caixa de Entrada</span>
                <span className="font-['Martian_Mono',monospace] text-[9px] bg-[#D93A14] text-[#14120F] px-1 font-bold">6</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#B5AEA2] hover:bg-[#221F1A] cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#3A352E] rounded-sm" />
                <span>Leads</span>
              </div>
            </div>
          </div>

          <div>
            <div className="font-['Martian_Mono',monospace] text-[8px] tracking-[0.2em] text-[#6E675D] px-2 mb-1.5 uppercase">
              VENDER
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#B5AEA2] hover:bg-[#221F1A] cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#3A352E] rounded-sm" />
                <span>Funis</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#B5AEA2] hover:bg-[#221F1A] cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#3A352E] rounded-sm" />
                <span>OpenFlow</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#B5AEA2] hover:bg-[#221F1A] cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#3A352E] rounded-sm" />
                <span>Campanhas</span>
              </div>
            </div>
          </div>

          <div>
            <div className="font-['Martian_Mono',monospace] text-[8px] tracking-[0.2em] text-[#6E675D] px-2 mb-1.5 uppercase">
              CAPITAL
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#B5AEA2] hover:bg-[#221F1A] cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#3A352E] rounded-sm" />
                <span>Gerenciador Ads</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-[#B5AEA2] hover:bg-[#221F1A] cursor-pointer">
                <span className="w-1.5 h-1.5 bg-[#3A352E] rounded-sm" />
                <span>Finanças</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3.5 border-t border-[#2C2822] font-['Martian_Mono',monospace] text-[9px] text-[#8C857A]">
          VINICIUS · OWNER
        </div>
      </aside>

      {/* CONTEÚDO PAPEL */}
      <div className="min-w-0 flex flex-col">
        <header className="flex flex-wrap items-end justify-between gap-4 p-6 md:p-8 border-b-2 border-[#14120F]">
          <div>
            <div className="font-['Martian_Mono',monospace] text-[9px] tracking-[0.24em] text-[#8C857A] mb-1.5 uppercase">
              BOLETIM · 18 SET 2026 · 17:40
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-[#14120F] leading-none">
              Cockpit Editorial
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-['Martian_Mono',monospace] text-[9.5px] tracking-wider border border-[#14120F] px-2.5 py-1 uppercase cursor-pointer hover:bg-[#14120F] hover:text-[#EDEAE3] transition-colors">
              30 DIAS
            </span>
            <span className="font-['Martian_Mono',monospace] text-[9.5px] tracking-wider border border-[#14120F] px-2.5 py-1 uppercase cursor-pointer hover:bg-[#14120F] hover:text-[#EDEAE3] transition-colors">
              TODOS OS PROJETOS
            </span>
          </div>
        </header>

        <main className="p-6 md:p-8 max-w-[1280px] space-y-8 animate-in fade-in duration-300">
          {/* DECISÃO DO DIA */}
          <section className="border-b border-[#C9C4B8] pb-8">
            <div className="flex flex-wrap lg:flex-nowrap gap-8">
              <div className="flex-1 min-w-[300px]">
                <div className="inline-flex items-center gap-2 bg-[#D93A14] text-white px-2.5 py-1 mb-3">
                  <span className="font-['Martian_Mono',monospace] text-[9px] tracking-[0.18em] font-semibold uppercase">
                    DECISÃO DE HOJE
                  </span>
                </div>
                <h2 className="text-3xl font-semibold tracking-tight leading-tight text-[#14120F] mb-3 max-w-xl">
                  LinfaFlow ADV03 queima R$ 1.240 por dia com ROAS 0,74.
                </h2>
                <p className="text-sm leading-relaxed text-[#4A443B] max-w-xl mb-6">
                  Terceiro dia consecutivo. Pausar devolve R$ 8.680 ao orçamento da semana — o ADV01 roda no mesmo público a 3,42x e aguenta a verba.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={onPauseAdv}
                    disabled={pausedAdv}
                    className={`h-10 px-5 text-sm font-semibold transition-all ${
                      pausedAdv
                        ? "bg-[#C9C4B8] text-[#4A443B] cursor-not-allowed"
                        : "bg-[#14120F] text-[#EDEAE3] hover:bg-[#D93A14] active:scale-95"
                    }`}
                  >
                    {pausedAdv ? "✓ Pausado e Realocado" : "Pausar e realocar"}
                  </button>
                  <Link
                    to="/redesign"
                    className="h-10 px-5 border border-[#14120F] text-sm text-[#14120F] hover:bg-[#E2DED5] flex items-center transition-colors font-medium"
                  >
                    Ver criativo
                  </Link>
                </div>
              </div>

              <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-[#C9C4B8] pt-4 lg:pt-0 lg:pl-6 shrink-0">
                <div className="font-['Martian_Mono',monospace] text-[9px] tracking-[0.18em] text-[#8C857A] mb-3 uppercase">
                  NA FILA · 4
                </div>
                <div className="flex flex-col divide-y divide-[#C9C4B8]">
                  {queue.map((q, i) => (
                    <div key={i} className="grid grid-cols-[20px_1fr] gap-2 py-2.5">
                      <span className="font-['Martian_Mono',monospace] text-[9px] font-bold" style={{ color: q.color }}>
                        {q.n}
                      </span>
                      <span className="text-xs text-[#4A443B] leading-snug">{q.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* GRADE DE KPIS */}
          <section className="border-b border-[#C9C4B8] pb-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-[#C9C4B8]">
              {kpis.map((k, i) => (
                <div key={i} className="bg-[#EDEAE3] p-4 min-w-0">
                  <div className="font-['Martian_Mono',monospace] text-[8.5px] tracking-[0.18em] text-[#8C857A] mb-2 uppercase truncate">
                    {k.label}
                  </div>
                  <div className="text-2xl font-bold tracking-tight leading-none mb-1.5 truncate" style={{ color: k.color }}>
                    {k.value}
                  </div>
                  <div className="font-['Martian_Mono',monospace] text-[10px] font-medium" style={{ color: k.deltaColor }}>
                    {k.delta}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* BARRAS E PROJETOS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-b border-[#C9C4B8] pb-8">
            <div>
              <div className="font-['Martian_Mono',monospace] text-[9px] tracking-[0.2em] text-[#8C857A] mb-1 uppercase">
                RECEITA VS. ADS · 14D
              </div>
              <div className="text-lg font-bold text-[#14120F] mb-4">
                Onde o capital vira caixa
              </div>
              <div className="flex items-end gap-1 h-32 border-b border-[#14120F] pb-1">
                {barData.map((v, i) => {
                  const rev = Math.round(v * 0.72);
                  const ads = Math.round(v * 0.3);
                  const isLast = i === barData.length - 1;
                  return (
                    <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 h-full">
                      <div
                        className="w-full transition-all"
                        style={{ height: `${rev}%`, background: isLast ? "#D93A14" : "#14120F" }}
                      />
                      <div className="w-full bg-[#C9C4B8]" style={{ height: `${ads}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#14120F]" />
                  <span className="font-['Martian_Mono',monospace] text-[9px] text-[#6E675D]">RECEITA</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#C9C4B8]" />
                  <span className="font-['Martian_Mono',monospace] text-[9px] text-[#6E675D]">ADS</span>
                </div>
              </div>
            </div>

            <div>
              <div className="font-['Martian_Mono',monospace] text-[9px] tracking-[0.2em] text-[#8C857A] mb-1 uppercase">
                PROJETOS
              </div>
              <div className="text-lg font-bold text-[#14120F] mb-4">Quem paga a conta</div>
              <div className="divide-y divide-[#C9C4B8]">
                {projects.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_96px_62px] items-center gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#14120F] truncate">{p.name}</div>
                      <div className="h-0.5 bg-[#DCD7CC] mt-1.5">
                        <div className="h-0.5" style={{ width: `${p.share}%`, background: p.fill }} />
                      </div>
                    </div>
                    <div className="font-['Martian_Mono',monospace] text-xs text-right text-[#14120F]">
                      {p.revenue}
                    </div>
                    <div className="font-['Martian_Mono',monospace] text-xs text-right font-bold" style={{ color: p.roasColor }}>
                      {p.roas}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* SEGUNDO PLANO */}
          {!zenMode && (
            <section>
              <div className="font-['Martian_Mono',monospace] text-[9px] tracking-[0.2em] text-[#8C857A] mb-3 uppercase">
                SEGUNDO PLANO · SÓ CONSULTA
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
                {minor.map((m, i) => (
                  <div key={i}>
                    <div className="font-['Martian_Mono',monospace] text-[8.5px] tracking-wider text-[#8C857A] mb-1 uppercase truncate">
                      {m.label}
                    </div>
                    <div className="text-sm font-semibold text-[#4A443B]">{m.value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. MODO TERMINAL BLOOMBERG COM SIDEBAR NATIVA
   ══════════════════════════════════════════════════════════════════════════════ */
function CockpitTerminalWithSidebar({
  barData,
  pausedAdv,
  onPauseAdv,
  zenMode,
}: {
  barData: number[];
  pausedAdv: boolean;
  onPauseAdv: () => void;
  zenMode: boolean;
}) {
  const ticker = [
    { label: "FAT 30D", value: "284.320", delta: "+12.4%", color: "#3ED598" },
    { label: "ADS", value: "96.140", delta: "+21.0%", color: "#F4526A" },
    { label: "ROAS", value: "2.96x", delta: "−0.18", color: "#F4526A" },
    { label: "LEADS", value: "1.842", delta: "+8.1%", color: "#3ED598" },
    { label: "CPA", value: "52.20", delta: "−3.40", color: "#3ED598" },
    { label: "FILA IA", value: "6", delta: "SLA 4M", color: "#FFB020" },
  ];

  const alertFacts = [
    { label: "GASTO 3D", value: "R$ 3.720", color: "#F4526A" },
    { label: "RECEITA 3D", value: "R$ 2.753", color: "#D7DBE0" },
    { label: "LIBERA NA SEMANA", value: "R$ 8.680", color: "#3ED598" },
    { label: "DESTINO SUGERIDO", value: "ADV01 · 3.42x", color: "#FFB020" },
  ];

  const queue = [
    { sev: "P1", label: "3 leads quentes sem resposta há 20min", color: "#F4526A" },
    { sev: "P2", label: "Checkout Care −18% vs. ontem", color: "#FFB020" },
    { sev: "P2", label: "Saldo Meta cobre 6 dias", color: "#FFB020" },
    { sev: "OK", label: "MemoFlow bateu meta do mês", color: "#3ED598" },
  ];

  const projects = [
    { name: "LinfaFlow", revenue: "R$ 121.400", roas: "3.42x", shareLabel: "42%", roasColor: "#3ED598" },
    { name: "MemoFlow", revenue: "R$ 78.900", roas: "2.88x", shareLabel: "28%", roasColor: "#3ED598" },
    { name: "Equilibre On", revenue: "R$ 44.260", roas: "1.94x", shareLabel: "15%", roasColor: "#FFB020" },
    { name: "Cinna Shield", revenue: "R$ 27.510", roas: "1.12x", shareLabel: "10%", roasColor: "#FFB020" },
    { name: "Slim Soda", revenue: "R$ 12.250", roas: "0.74x", shareLabel: "5%", roasColor: "#F4526A" },
  ];

  const minor = [
    { label: "SLA MÉDIO", value: "3M 42S" },
    { label: "RESGATE PIX", value: "41.2%" },
    { label: "CUSTO IA", value: "$ 14.20/DIA" },
    { label: "LEADS HOJE", value: "148 ITENS" },
    { label: "BOLETOS 48H", value: "31 ITENS" },
    { label: "LTV PROJ 90D", value: "R$ 684" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)] min-h-screen bg-[#07080A] text-[#D7DBE0] font-['JetBrains_Mono',monospace]">
      {/* SIDEBAR TERMINAL */}
      <aside className="border-r border-[#16191E] bg-[#090A0D] flex flex-col md:sticky md:top-0 md:h-screen overflow-hidden text-xs">
        <div className="h-8 flex items-center gap-2 px-3 border-b border-[#16191E] bg-[#0D0F12]">
          <span className="w-1.5 h-1.5 bg-[#FFB020] animate-pulse" />
          <span className="text-[10px] tracking-widest text-[#FFB020] font-bold">IMPERIOHQ</span>
          <span className="flex-1" />
          <span className="text-[9px] text-[#4E555F]">v12</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          <div>
            <div className="text-[8.5px] tracking-widest text-[#3E444C] px-2 mb-1 uppercase">HOJE</div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1 bg-[#12151A] text-[#FFB020] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">01</span>
                <span>Cockpit</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-[#8C939C] hover:bg-[#12151A] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">02</span>
                <span className="flex-1 truncate">Inbox</span>
                <span className="text-[9px] bg-[#FFB020] text-[#07080A] px-1 font-bold">6</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-[#8C939C] hover:bg-[#12151A] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">03</span>
                <span>Leads</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[8.5px] tracking-widest text-[#3E444C] px-2 mb-1 uppercase">VENDER</div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1 text-[#8C939C] hover:bg-[#12151A] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">04</span>
                <span>Funis</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-[#8C939C] hover:bg-[#12151A] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">05</span>
                <span>OpenFlow</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-[#8C939C] hover:bg-[#12151A] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">06</span>
                <span>Campanhas</span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[8.5px] tracking-widest text-[#3E444C] px-2 mb-1 uppercase">CAPITAL</div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1 text-[#8C939C] hover:bg-[#12151A] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">07</span>
                <span>Ads Manager</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 text-[#8C939C] hover:bg-[#12151A] cursor-pointer">
                <span className="text-[9px] text-[#3E444C]">08</span>
                <span>Finanças</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#16191E] p-2.5 text-[9px] text-[#4E555F]">
          SESSÃO · VS · 17:40
        </div>
      </aside>

      {/* CONTEÚDO TERMINAL */}
      <div className="min-w-0 flex flex-col">
        {/* TICKER */}
        <div className="h-8 flex items-center border-b border-[#16191E] bg-[#0D0F12] overflow-x-auto divide-x divide-[#16191E] px-2 text-[10px]">
          {ticker.map((t, idx) => (
            <div key={idx} className="flex items-center gap-2 px-3 whitespace-nowrap">
              <span className="tracking-wider text-[#4E555F]">{t.label}</span>
              <span className="text-[#D7DBE0] font-bold">{t.value}</span>
              <span style={{ color: t.color }}>{t.delta}</span>
            </div>
          ))}
        </div>

        <main className="p-4 md:p-6 space-y-6 animate-in fade-in duration-300">
          {/* ALERTA CRÍTICO */}
          <section className="border border-[#16191E] bg-[#0B0D10] rounded">
            <div className="flex items-center gap-2 h-7 px-3.5 border-b border-[#16191E] bg-[#101317] text-[9.5px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4526A] animate-ping" />
              <span className="tracking-widest text-[#F4526A] font-bold">ALERTA CRÍTICO · AÇÃO PENDENTE</span>
              <span className="flex-1" />
              <span className="text-[#4E555F]">03D · ID 8842</span>
            </div>

            <div className="flex flex-wrap lg:flex-nowrap gap-6 p-4 md:p-5">
              <div className="flex-1 min-w-[280px]">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight text-[#F2F5F8] mb-3">
                  ADV03 · LINFAFLOW <span className="text-[#F4526A]">−R$ 1.240/DIA</span> · ROAS 0.74
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#16191E] border border-[#16191E] my-3">
                  {alertFacts.map((f, i) => (
                    <div key={i} className="bg-[#0B0D10] p-2.5">
                      <div className="text-[8.5px] tracking-wider text-[#4E555F] mb-1">{f.label}</div>
                      <div className="text-xs font-bold" style={{ color: f.color }}>{f.value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4">
                  <button
                    onClick={onPauseAdv}
                    disabled={pausedAdv}
                    className={`h-8 px-4 text-xs font-bold tracking-wider transition-all ${
                      pausedAdv
                        ? "bg-[#16191E] text-[#4E555F] cursor-not-allowed"
                        : "bg-[#FFB020] text-[#07080A] hover:bg-[#FFC85C] active:scale-95"
                    }`}
                  >
                    {pausedAdv ? "[ PAUSADO E REALOCADO ]" : "[ PAUSAR + REALOCAR ]"}
                  </button>
                  <Link
                    to="/redesign"
                    className="h-8 px-4 border border-[#2A2E35] text-xs tracking-wider text-[#D7DBE0] hover:border-[#FFB020] hover:text-[#FFB020] flex items-center transition-colors"
                  >
                    [ VER CRIATIVO ]
                  </Link>
                </div>
              </div>

              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-[#16191E] pt-3 lg:pt-0 lg:pl-5 shrink-0">
                <div className="text-[8.5px] tracking-widest text-[#4E555F] mb-2 uppercase">
                  FILA DE EXECUÇÃO · 04 ITENS
                </div>
                <div className="divide-y divide-[#16191E]">
                  {queue.map((q, i) => (
                    <div key={i} className="grid grid-cols-[30px_1fr] gap-2 py-2">
                      <span className="text-[9px] font-bold" style={{ color: q.color }}>
                        {q.sev}
                      </span>
                      <span className="text-[11px] text-[#A8AEB6] leading-snug">{q.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* BARRAS E PROJETOS */}
          <section className="grid grid-cols-1 lg:grid-cols-2 border border-[#16191E] divide-y lg:divide-y-0 lg:divide-x divide-[#16191E] bg-[#07080A]">
            <div>
              <div className="h-7 flex items-center px-3.5 border-b border-[#16191E] bg-[#0D0F12] text-[9px] tracking-widest text-[#4E555F]">
                RECEITA / ADS · 14 DIAS
              </div>
              <div className="p-4">
                <div className="flex items-end gap-1 h-32 border-b border-[#1C2026] border-l pb-1 pl-1">
                  {barData.map((v, i) => {
                    const rev = Math.round(v * 0.72);
                    const ads = Math.round(v * 0.3);
                    const isLast = i === barData.length - 1;
                    return (
                      <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 h-full">
                        <div
                          className="w-full"
                          style={{
                            height: `${rev}%`,
                            background: isLast ? "#FFB020" : "#8C6A1A",
                          }}
                        />
                        <div className="w-full bg-[#1C2026]" style={{ height: `${ads}%` }} />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[8.5px] text-[#4E555F]">
                  <span>04 SET</span>
                  <span>REC ▮ AMBAR · ADS ▮ CINZA</span>
                  <span>18 SET</span>
                </div>
              </div>
            </div>

            <div>
              <div className="h-7 flex items-center px-3.5 border-b border-[#16191E] bg-[#0D0F12] text-[9px] tracking-widest text-[#4E555F]">
                PROJETOS · ORDEM POR RECEITA
              </div>
              <div className="p-1">
                <div className="grid grid-cols-[1fr_90px_60px_50px] gap-2 px-3 py-1.5 border-b border-[#16191E] text-[8.5px] tracking-wider text-[#4E555F]">
                  <span>PROJETO</span>
                  <span className="text-right">RECEITA</span>
                  <span className="text-right">ROAS</span>
                  <span className="text-right">SHARE</span>
                </div>
                <div className="divide-y divide-[#0F1216]">
                  {projects.map((p, i) => (
                    <div key={i} className="grid grid-cols-[1fr_90px_60px_50px] gap-2 px-3 py-2 text-[11px]">
                      <span className="text-[#D7DBE0] truncate">{p.name}</span>
                      <span className="text-right font-medium">{p.revenue}</span>
                      <span className="text-right font-bold" style={{ color: p.roasColor }}>
                        {p.roas}
                      </span>
                      <span className="text-right text-[#8C939C]">{p.shareLabel}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SECUNDÁRIO */}
          {!zenMode && (
            <section className="border border-[#16191E]">
              <div className="h-7 flex items-center px-3.5 border-b border-[#16191E] bg-[#0D0F12] text-[9px] tracking-widest text-[#4E555F]">
                SECUNDÁRIO · CONSULTA RÁPIDA
              </div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-[#16191E]">
                {minor.map((m, i) => (
                  <div key={i} className="bg-[#090A0D] p-3 hover:bg-[#0F1216] transition-colors">
                    <div className="text-[8.5px] tracking-wider text-[#3E444C] mb-1 truncate">
                      {m.label}
                    </div>
                    <div className="text-xs text-[#A8AEB6] font-medium">{m.value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
