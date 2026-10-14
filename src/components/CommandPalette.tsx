// CommandPalette.tsx — Cmd+K global para ações rápidas
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  MessageSquare, Users, Bot, Zap, TrendingUp, Instagram,
  PauseCircle, BarChart2, Send, Settings, Flame, Target,
  Calendar, BookOpen, ArrowRight, Search, Sparkles,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  badge?: string;
}

interface CommandPaletteProps {
  onCreateWACampaign?: () => void;
}

export function CommandPalette({ onCreateWACampaign }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const commands: Command[] = [
    {
      id: "hoje",
      label: "Hoje no Império (Rotina Diária)",
      description: "Ver suas 3 prioridades, etapas da IA e destravar operação",
      icon: <Flame className="h-4 w-4 text-primary" />,
      action: () => navigate("/hoje"),
      category: "Operação Diária",
      badge: "☀️",
    },
    {
      id: "aprovar",
      label: "Fila de Aprovação",
      description: "Aprovar copies, pausar ads sangrando e recuperar Pix",
      icon: <Zap className="h-4 w-4 text-amber-400" />,
      action: () => navigate("/aprovar"),
      category: "Operação Diária",
      badge: "✅",
    },
    {
      id: "testes",
      label: "Ordens de Teste & Criativos",
      description: "Hipóteses, variantes, vencedores e lotes de anúncios",
      icon: <Target className="h-4 w-4 text-primary" />,
      action: () => navigate("/testes"),
      category: "Operação Diária",
    },
    {
      id: "mapa",
      label: "Mapa da Empresa (Canvas)",
      description: "Abrir mapa visual de funis, etapas e gargalos",
      icon: <BarChart2 className="h-4 w-4 text-emerald-400" />,
      action: () => navigate("/mapa"),
      category: "Funis & Estratégia",
    },
    {
      id: "estrategias",
      label: "Biblioteca de Estratégias",
      description: "Playbooks validados (Perpétuo, Lançamento, Desafio, High Ticket)",
      icon: <BookOpen className="h-4 w-4 text-blue-400" />,
      action: () => navigate("/estrategias"),
      category: "Funis & Estratégia",
    },
    {
      id: "funnel-architect",
      label: "Arquiteto de Funis IA",
      description: "Conceber fluxo, o que deve ter no site e criar funil",
      icon: <Sparkles className="h-4 w-4 text-primary" />,
      action: () => window.dispatchEvent(new CustomEvent("imphq:open-funnel-architect")),
      category: "Funis & Estratégia",
      badge: "✨ RAG",
    },
    {
      id: "hot-leads",
      label: "Ver Leads Quentes",
      description: "Abre leads com intenção de compra detectada",
      icon: <Flame className="h-4 w-4 text-red-400" />,
      action: () => navigate("/inbox?tab=hot"),
      category: "CRM & Atendimento",
      badge: "🔥",
    },
    {
      id: "wa-campaign",
      label: "Criar Campanha WhatsApp",
      description: "Nova campanha de disparo WA",
      icon: <Send className="h-4 w-4 text-emerald-400" />,
      action: () => { navigate("/campanhas?tab=whatsapp"); onCreateWACampaign?.(); },
      category: "WhatsApp & Instagram",
    },
    {
      id: "ig-dms",
      label: "Abrir DMs Instagram",
      description: "Ver e responder DMs e automações do Instagram",
      icon: <Instagram className="h-4 w-4 text-pink-400" />,
      action: () => navigate("/inbox?tab=instagram"),
      category: "WhatsApp & Instagram",
    },
    {
      id: "chat-wa",
      label: "Chat WhatsApp (SDR)",
      description: "Abrir conversas do WhatsApp na Inbox Unificada",
      icon: <MessageSquare className="h-4 w-4 text-green-400" />,
      action: () => navigate("/inbox?tab=whatsapp"),
      category: "WhatsApp & Instagram",
    },
    {
      id: "imperius",
      label: "Console Imperius IA",
      description: "Ver fila de ações prioritárias e motor autônomo",
      icon: <Bot className="h-4 w-4 text-yellow-400" />,
      action: () => navigate("/imperius"),
      category: "IA",
      badge: "⚡",
    },
    {
      id: "skills",
      label: "Catálogo de Skills IA",
      description: "Consultar skills de Copy, VSL, Avatar, Funil e Criativos",
      icon: <BookOpen className="h-4 w-4 text-purple-400" />,
      action: () => navigate("/claude-skills"),
      category: "IA",
    },
    {
      id: "dashboard",
      label: "Cockpit Executivo",
      description: "Visão consolidada de faturamento, ROAS e metas",
      icon: <BarChart2 className="h-4 w-4 text-muted-foreground" />,
      action: () => navigate("/"),
      category: "Navegação",
    },
    {
      id: "revenue",
      label: "Relatório Financeiro & DRE",
      description: "Ver receita, despesas e ROAS do período",
      icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
      action: () => navigate("/financas"),
      category: "Analytics",
    },
    {
      id: "leads-inbox",
      label: "CRM de Leads",
      description: "Base completa de leads, tags e histórico",
      icon: <Users className="h-4 w-4 text-blue-400" />,
      action: () => navigate("/leads"),
      category: "CRM & Atendimento",
    },
    {
      id: "lancamentos",
      label: "Gerenciar Lançamentos",
      description: "Ver e controlar lançamentos ativos",
      icon: <Calendar className="h-4 w-4 text-orange-400" />,
      action: () => navigate("/campanhas?tab=lancamentos"),
      category: "Negócio",
    },
    {
      id: "config",
      label: "Configurações & Integrações",
      description: "Ajustar APIs, provedores WhatsApp e regras do sistema",
      icon: <Settings className="h-4 w-4 text-muted-foreground" />,
      action: () => navigate("/configuracoes"),
      category: "Config",
    },
  ];

  const filtered = query
    ? commands.filter(
        c =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()),
      )
    : commands;

  const categories = [...new Set(filtered.map(c => c.category))];

  const handleSelect = useCallback(
    (cmd: Command) => {
      cmd.action();
      setOpen(false);
      setQuery("");
    },
    [],
  );

  // Cmd+J / Ctrl+J hotkey for quick actions
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Trigger button — discrete, top bar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/70 text-xs text-muted-foreground transition-colors"
        title="Abrir ações rápidas (Cmd+J)"
      >
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span>Ações</span>
        <kbd className="ml-0.5 text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono border border-border/40">⌘J</kbd>
      </button>

      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setQuery(""); }}>
        <DialogContent className="p-0 max-w-lg overflow-hidden gap-0 border-border/60 bg-card shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="O que você quer fazer? (ex: leads quentes, campanha WA...)"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              onKeyDown={e => {
                if (e.key === "Enter" && filtered.length > 0) handleSelect(filtered[0]);
              }}
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground text-[10px]">
                limpar
              </button>
            )}
          </div>

          {/* Commands list */}
          <div className="max-h-[400px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-xs text-muted-foreground">Nenhuma ação encontrada para "{query}"</p>
            ) : (
              categories.map(cat => (
                <div key={cat}>
                  <p className="px-4 py-1.5 text-[9px] uppercase font-bold tracking-widest text-muted-foreground/70">
                    {cat}
                  </p>
                  {filtered.filter(c => c.category === cat).map(cmd => (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors text-left group"
                    >
                      <span className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md bg-secondary/50 group-hover:bg-secondary">
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium flex items-center gap-2">
                          {cmd.label}
                          {cmd.badge && <span>{cmd.badge}</span>}
                        </p>
                        {cmd.description && (
                          <p className="text-[11px] text-muted-foreground truncate">{cmd.description}</p>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-border/40 px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground/60">
            <span><kbd className="bg-muted px-1 rounded font-mono border border-border/40">↵</kbd> selecionar</span>
            <span><kbd className="bg-muted px-1 rounded font-mono border border-border/40">esc</kbd> fechar</span>
            <span className="ml-auto"><kbd className="bg-muted px-1 rounded font-mono border border-border/40">⌘J</kbd> ações rápidas</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
