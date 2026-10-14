import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, ListTodo, Users, FileText, Target, Search } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  type: "projeto" | "tarefa" | "lead" | "doc" | "funil";
  url: string;
  subtitle?: string;
}

const TYPE_ICONS = {
  projeto: FolderKanban,
  tarefa: ListTodo,
  lead: Users,
  doc: FileText,
  funil: Target,
};

const TYPE_LABELS = {
  projeto: "Projetos",
  tarefa: "Tarefas",
  lead: "Leads",
  doc: "Docs",
  funil: "Funis",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (term: string) => {
    if (!term || term.length < 2) { setResults([]); return; }
    const like = `%${term}%`;

    const [projRes, taskRes, leadRes, docRes, funilRes, chatRes] = await Promise.all([
      supabase.from("imphq_projects").select("id, name, category").ilike("name", like).limit(5),
      supabase.from("imphq_kanban_cards").select("id, title, board").ilike("title", like).limit(5),
      supabase.from("imphq_leads").select("id, nome, email").or(`nome.ilike.${like},email.ilike.${like}`).limit(5),
      supabase.from("imphq_docs").select("id, title").ilike("title", like).limit(5),
      supabase.from("imphq_funis").select("id, nome").ilike("nome", like).limit(5),
      supabase.from("imphq_chat_messages").select("id, content, message_type, created_at").ilike("content", like).limit(5),
    ]);

    const items: SearchResult[] = [
      ...(projRes.data || []).map((p) => ({ id: p.id, title: p.name, type: "projeto" as const, url: `/projetos/${p.id}`, subtitle: p.category })),
      ...(taskRes.data || []).map((t) => ({ id: t.id, title: t.title, type: "tarefa" as const, url: "/kanban", subtitle: t.board })),
      ...(leadRes.data || []).map((l) => ({ id: l.id, title: l.nome || l.email, type: "lead" as const, url: "/leads", subtitle: l.email })),
      ...(docRes.data || []).map((d) => ({ id: d.id, title: d.title, type: "doc" as const, url: "/docs" })),
      ...(funilRes.data || []).map((f) => ({ id: f.id, title: f.nome, type: "funil" as const, url: "/funis" })),
      ...(chatRes.data || []).map((c) => ({ id: c.id, title: c.content?.slice(0, 80), type: "doc" as const, url: "/inbox?tab=whatsapp", subtitle: "Mensagem do chat" })),
    ];
    setResults(items);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const grouped = results.reduce((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const quickNav = [
    { label: "Hoje no Império", subtitle: "Rotina diária e prioridades", url: "/hoje" },
    { label: "Fila de Aprovação", subtitle: "Copies, anúncios e Pix travados", url: "/aprovar" },
    { label: "Mapa da Empresa", subtitle: "Canvas visual de funis e gargalos", url: "/mapa" },
    { label: "Ordens de Teste", subtitle: "Hipóteses e lotes de criativos", url: "/testes" },
    { label: "Inbox Unificada", subtitle: "WhatsApp, Instagram e Leads Quentes", url: "/inbox" },
    { label: "Projetos & Produtos", subtitle: "Lista completa de produtos", url: "/projetos" },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 h-[30px] px-3 border border-border rounded-full bg-[#101215] hover:border-[#2A2E35] text-subtle hover:text-muted-foreground transition-colors w-full max-w-[220px]"
      >
        <Search className="h-3.5 w-3.5 text-subtle" />
        <span className="font-mono text-[11px]">buscar</span>
        <span className="flex-1" />
        <kbd className="hidden sm:inline-flex items-center border border-input rounded px-1.5 py-0.5 text-[9px] font-mono text-subtle">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar projetos, tarefas, leads, docs ou páginas…"
          value={query}
          onValueChange={setQuery}
        />

        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {query.trim().length < 2 && (
            <CommandGroup heading="Acesso Rápido">
              {quickNav.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`${item.label} ${item.subtitle}`}
                  onSelect={() => { navigate(item.url); setOpen(false); setQuery(""); }}
                  className="cursor-pointer"
                >
                  <Target className="mr-2 h-4 w-4 text-primary" />
                  <div className="flex flex-col">
                    <span>{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
            return (
              <CommandGroup key={type} heading={TYPE_LABELS[type as keyof typeof TYPE_LABELS]}>
                {items.map(item => (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${item.subtitle || ""}`}
                    onSelect={() => { navigate(item.url); setOpen(false); setQuery(""); }}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col">
                      <span>{item.title}</span>
                      {item.subtitle && <span className="text-[10px] text-muted-foreground">{item.subtitle}</span>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
