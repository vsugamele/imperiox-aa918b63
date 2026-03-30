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
      ...(projRes.data || []).map((p: any) => ({ id: p.id, title: p.name, type: "projeto" as const, url: `/projetos/${p.id}`, subtitle: p.category })),
      ...(taskRes.data || []).map((t: any) => ({ id: t.id, title: t.title, type: "tarefa" as const, url: "/kanban", subtitle: t.board })),
      ...(leadRes.data || []).map((l: any) => ({ id: l.id, title: l.nome || l.email, type: "lead" as const, url: "/leads", subtitle: l.email })),
      ...(docRes.data || []).map((d: any) => ({ id: d.id, title: d.title, type: "doc" as const, url: "/docs" })),
      ...(funilRes.data || []).map((f: any) => ({ id: f.id, title: f.nome, type: "funil" as const, url: "/funis" })),
      ...(chatRes.data || []).map((c: any) => ({ id: c.id, title: c.content?.slice(0, 80), type: "doc" as const, url: "/chat", subtitle: "Mensagem do chat" })),
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground text-sm transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar projetos, tarefas, leads, docs..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          {Object.entries(grouped).map(([type, items], gi) => {
            const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS];
            return (
              <CommandGroup key={type} heading={TYPE_LABELS[type as keyof typeof TYPE_LABELS]}>
                {items.map(item => (
                  <CommandItem
                    key={item.id}
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
