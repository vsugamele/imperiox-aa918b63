import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Plus, ListTodo, CalendarIcon, FolderKanban, Users, Hash, MessageSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id: string;
  user_id: string;
  content: string;
  message_type: string;
  metadata: any;
  project_id: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
}

const COMMANDS = [
  { cmd: "/tarefa", desc: "Criar tarefa", icon: ListTodo, example: "/tarefa Revisar landing page" },
  { cmd: "/evento", desc: "Criar evento", icon: CalendarIcon, example: "/evento Live de vendas 2024-04-01" },
  { cmd: "/projeto", desc: "Vincular a projeto", icon: FolderKanban, example: "/projeto Nome do Projeto" },
  { cmd: "/lead", desc: "Criar lead rápido", icon: Users, example: "/lead João 11999999999" },
];

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [showCommands, setShowCommands] = useState(false);
  const [sending, setSending] = useState(false);
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMessages();
    loadProjects();
    loadMembers();
    const channel = supabase
      .channel("chat-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "imphq_chat_messages" }, (payload) => {
        setMessages((prev) => [...prev, payload.new as ChatMessage]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "imphq_chat_messages" }, (payload) => {
        setMessages((prev) => prev.filter(m => m.id !== (payload.old as any).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    setShowCommands(input.startsWith("/") && !input.includes(" "));
  }, [input]);

  async function loadMessages() {
    const { data } = await supabase
      .from("imphq_chat_messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMessages(data);
  }

  async function deleteMessage(id: string) {
    await supabase.from("imphq_chat_messages").delete().eq("id", id);
    setMessages((prev) => prev.filter(m => m.id !== id));
  }

  async function loadMembers() {
    const { data } = await supabase.from("imphq_team_members").select("user_id, name");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((m: any) => { if (m.user_id && m.name) map[m.user_id] = m.name; });
      setMemberNames(map);
    }
  }

  async function loadProjects() {
    const { data } = await supabase.from("imphq_projects").select("id, name, icon, color").order("name");
    if (data) setProjects(data as Project[]);
  }

  const logActivity = useCallback(async (action: string, entityType: string, entityId: string, entityName: string, details = {}) => {
    if (!user) return;
    await supabase.from("imphq_activity_log").insert({
      user_id: user.id, action, entity_type: entityType, entity_id: entityId, entity_name: entityName, details,
    });
  }, [user]);

  async function handleCommand(content: string) {
    if (!user) return;
    const parts = content.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ");

    if (cmd === "/tarefa" && args) {
      const { data, error } = await supabase.from("imphq_tasks").insert({
        id: crypto.randomUUID(), title: args, status: "todo", user_id: user.id, project_id: activeProject,
      }).select().single();
      if (error) { toast.error("Erro ao criar tarefa"); return null; }
      await logActivity("task_created", "task", data.id, args);
      return { type: "task_created", title: args, id: data.id };
    }

    if (cmd === "/evento" && args) {
      const dateMatch = args.match(/(\d{4}-\d{2}-\d{2})/);
      const eventDate = dateMatch ? dateMatch[1] : new Date().toISOString().split("T")[0];
      const title = args.replace(/\d{4}-\d{2}-\d{2}/, "").trim();
      const { data, error } = await supabase.from("imphq_calendar_events").insert({
        id: crypto.randomUUID(), title: title || args, event_date: eventDate, event_type: "general", project_id: activeProject, user_id: user.id,
      }).select().single();
      if (error) { toast.error("Erro ao criar evento"); return null; }
      await logActivity("event_created", "event", data.id, title || args);
      return { type: "event_created", title: title || args, date: eventDate, id: data.id };
    }

    if (cmd === "/projeto" && args) {
      const proj = projects.find((p) => p.name.toLowerCase().includes(args.toLowerCase()));
      if (proj) {
        setActiveProject(proj.id);
        toast.success(`Projeto vinculado: ${proj.icon} ${proj.name}`);
        return { type: "project_linked", name: proj.name, icon: proj.icon };
      }
      toast.error("Projeto não encontrado");
      return null;
    }

    if (cmd === "/lead" && args) {
      const leadParts = args.split(/\s+/);
      const nome = leadParts.slice(0, -1).join(" ") || leadParts[0];
      const telefone = leadParts.length > 1 ? leadParts[leadParts.length - 1] : "";
      const { data, error } = await supabase.from("imphq_leads").insert({
        id: crypto.randomUUID(), nome, telefone, origem: "chat", project_id: activeProject, user_id: user.id,
      }).select().single();
      if (error) { toast.error("Erro ao criar lead"); return null; }
      await logActivity("lead_created", "lead", data.id, nome);
      return { type: "lead_created", nome, telefone, id: data.id };
    }

    return null;
  }

  async function sendMessage() {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");

    const isCommand = content.startsWith("/");
    let metadata = {};
    let messageType = "text";

    if (isCommand) {
      messageType = "command";
      const result = await handleCommand(content);
      if (result) metadata = result;
      else { setSending(false); return; }
    }

    await supabase.from("imphq_chat_messages").insert({
      user_id: user.id, content, message_type: messageType, metadata, project_id: activeProject,
    });

    setSending(false);
  }

  function selectCommand(cmd: string) {
    setInput(cmd + " ");
    setShowCommands(false);
    inputRef.current?.focus();
  }

  function quickAction(cmd: string) {
    setInput(cmd + " ");
    inputRef.current?.focus();
  }

  const activeProj = projects.find((p) => p.id === activeProject);

  return (
    <div className="flex h-[calc(100vh-4rem)] animate-fade-in">
      {/* Sidebar canais */}
      <div className="w-56 border-r border-border bg-card/50 flex flex-col shrink-0">
        <div className="p-3 border-b border-border">
          <h3 className="font-display text-sm font-bold text-primary flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Canais
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            onClick={() => setActiveProject(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              !activeProject ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Hash className="h-3.5 w-3.5" /> geral
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveProject(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeProject === p.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <span className="text-xs">{p.icon || "📁"}</span>
              <span className="truncate">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {activeProj ? `${activeProj.icon || "📁"} ${activeProj.name}` : "geral"}
          </span>
          {activeProj && (
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: activeProj.color }}>
              projeto
            </Badge>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages
            .filter((m) => !activeProject || !m.project_id || m.project_id === activeProject)
            .map((msg) => (
              <div key={msg.id} className="group flex gap-3 hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {(memberNames[msg.user_id] || "U")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-foreground">{memberNames[msg.user_id] || "Usuário"}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.created_at), { locale: ptBR, addSuffix: true })}
                    </span>
                    {user && msg.user_id === user.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        title="Excluir mensagem"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {msg.message_type === "command" ? (
                    <div className="mt-1">
                      <p className="text-xs text-muted-foreground font-mono">{msg.content}</p>
                      {msg.metadata && <CommandResult metadata={msg.metadata} />}
                    </div>
                  ) : (
                    <div className="text-sm prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
          <div ref={bottomRef} />
        </div>

        {/* Command autocomplete */}
        {showCommands && (
          <div className="mx-4 mb-1 border border-border rounded-lg bg-card overflow-hidden">
            {COMMANDS.filter((c) => c.cmd.startsWith(input)).map((c) => (
              <button
                key={c.cmd}
                onClick={() => selectCommand(c.cmd)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/50 transition-colors text-left"
              >
                <c.icon className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <span className="text-sm font-mono font-medium text-primary">{c.cmd}</span>
                  <span className="text-xs text-muted-foreground ml-2">{c.desc}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-3 border-t border-border flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {COMMANDS.map((c) => (
                <DropdownMenuItem key={c.cmd} onClick={() => quickAction(c.cmd)}>
                  <c.icon className="mr-2 h-4 w-4" />
                  {c.desc}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={`Mensagem em #${activeProj?.name || "geral"} — digite / para comandos`}
            className="flex-1 bg-secondary/50 border-none"
          />
          <Button onClick={sendMessage} size="icon" className="shrink-0 h-9 w-9" disabled={sending || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommandResult({ metadata }: { metadata: any }) {
  const icons: Record<string, any> = {
    task_created: ListTodo,
    event_created: CalendarIcon,
    project_linked: FolderKanban,
    lead_created: Users,
  };
  const colors: Record<string, string> = {
    task_created: "border-amber-500/30 bg-amber-500/5",
    event_created: "border-primary/30 bg-primary/5",
    project_linked: "border-violet-500/30 bg-violet-500/5",
    lead_created: "border-emerald-500/30 bg-emerald-500/5",
  };
  const Icon = icons[metadata.type] || MessageSquare;
  const color = colors[metadata.type] || "border-border";

  const labels: Record<string, string> = {
    task_created: "Tarefa criada",
    event_created: "Evento criado",
    project_linked: "Projeto vinculado",
    lead_created: "Lead criado",
  };

  return (
    <Card className={`mt-2 p-3 border ${color} max-w-sm`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs font-medium text-primary">{labels[metadata.type] || metadata.type}</span>
      </div>
      <p className="text-sm font-medium mt-1">
        {metadata.icon && <span className="mr-1">{metadata.icon}</span>}
        {metadata.title || metadata.name || metadata.nome}
      </p>
      {metadata.date && <p className="text-xs text-muted-foreground mt-0.5">📅 {metadata.date}</p>}
      {metadata.telefone && <p className="text-xs text-muted-foreground mt-0.5">📞 {metadata.telefone}</p>}
    </Card>
  );
}
