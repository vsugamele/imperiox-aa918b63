// CommandPalette.tsx — Cmd+K global para ações rápidas
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  MessageSquare, Users, Bot, Zap, TrendingUp, Instagram,
  PauseCircle, BarChart2, Send, Settings, Flame, Target,
  Calendar, BookOpen, ArrowRight, Search,
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
      id: "hot-leads",
      label: "Ver Leads Quentes",
      description: "Abre leads com intenção de compra detectada",
      icon: <Flame className="h-4 w-4 text-red-400" />,
      action: () => navigate("/leads?filter=hot"),
      category: "CRM",
      badge: "🔥",
    },
    {
      id: "wa-campaign",
      label: "Criar Campanha WhatsApp",
      description: "Nova campanha de disparo WA",
      icon: <Send className="h-4 w-4 text-emerald-400" />,
      action: () => { navigate("/campanhas"); onCreateWACampaign?.(); },
      category: "WhatsApp",
    },
    {
      id: "ig-dms",
      label: "Abrir DMs Instagram",
      description: "Ver e responder DMs do Instagram",
      icon: <Instagram className="h-4 w-4 text-pink-400" />,
      action: () => navigate("/instagram"),
      category: "Instagram",
    },
    {
      id: "ig-funnel",
      label: "Funil de Leads IG",
      description: "Ver Kanban de leads por estágio",
      icon: <Target className="h-4 w-4 text-amber-400" />,
      action: () => navigate("/instagram?tab=funil"),
      category: "Instagram",
    },
    {
      id: "simulate-dm",
      label: "Simular DM WhatsApp",
      description: "Testar a IA com uma mensagem simulada",
      icon: <Bot className="h-4 w-4 text-blue-400" />,
      action: () => navigate("/chat?simulate=true"),
      category: "WhatsApp",
    },
    {
      id: "imperius",
      label: "Ações do Imperius",
      description: "Ver fila de ações prioritárias detectadas",
      icon: <Zap className="h-4 w-4 text-yellow-400" />,
      action: () => navigate("/imperius"),
      category: "IA",
      badge: "⚡",
    },
    {
      id: "dashboard",
      label: "Cockpit Principal",
      description: "Voltar ao dashboard",
      icon: <BarChart2 className="h-4 w-4 text-muted-foreground" />,
      action: () => navigate("/"),
      category: "Navegação",
    },
    {
      id: "revenue",
      label: "Relatório de Receita",
      description: "Ver receita e conversões do período",
      icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
      action: () => navigate("/financas"),
      category: "Analytics",
    },
    {
      id: "leads-inbox",
      label: "Inbox de Leads",
      description: "Leads priorizados por temperatura",
      icon: <Users className="h-4 w-4 text-blue-400" />,
      action: () => navigate("/leads"),
      category: "CRM",
    },
    {
      id: "chat-wa",
      label: "Chat WhatsApp (SDR)",
      description: "Abrir conversas do WhatsApp",
      icon: <MessageSquare className="h-4 w-4 text-green-400" />,
      action: () => navigate("/chat"),
      category: "WhatsApp",
    },
    {
      id: "skills",
      label: "Executar Skills IA",
      description: "Rodar skills: Avatar, Funil, LP, Copy...",
      icon: <BookOpen className="h-4 w-4 text-purple-400" />,
      action: () => navigate("/assistente"),
      category: "IA",
    },
    {
      id: "config",
      label: "Configurações IA",
      description: "Ajustar persona, tom e regras da IA",
      icon: <Settings className="h-4 w-4 text-muted-foreground" />,
      action: () => navigate("/configuracoes"),
      category: "Config",
    },
    {
      id: "lancamentos",
      label: "Gerenciar Lançamentos",
      description: "Ver e controlar lançamentos ativos",
      icon: <Calendar className="h-4 w-4 text-orange-400" />,
      action: () => navigate("/lancamentos"),
      category: "Negócio",
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

  // Cmd+K / Ctrl+K hotkey
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
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
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/60 bg-secondary/20 hover:bg-secondary/50 text-xs text-muted-foreground transition-colors"
        title="Abrir paleta de comandos (Cmd+K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Ação rápida</span>
        <kbd className="ml-1 text-[9px] bg-muted px-1.5 py-0.5 rounded font-mono border border-border/40">⌘K</kbd>
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
            <span className="ml-auto"><kbd className="bg-muted px-1 rounded font-mono border border-border/40">⌘K</kbd> abrir</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
