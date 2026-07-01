import ReactMarkdown from "react-markdown";
import { Crown, User, Wrench, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export interface ToolActivity {
  name: string;
  args: any;
  result: any;
  ts?: string;
}

interface Props {
  role: "user" | "assistant";
  content: string;
  tools?: ToolActivity[];
}

const TOOL_LABELS: Record<string, string> = {
  listarProjetos: "Listou projetos",
  buscarProjeto: "Buscou projeto",
  vendasDoDia: "Vendas do dia",
  vendasResumo: "Resumo de vendas",
  leadsTravadosWhatsapp: "Leads travados WhatsApp",
  ultimasMensagensWhatsapp: "Últimas mensagens WhatsApp",
  adsPerformance: "Performance de ads",
  buscarLead: "Buscou lead",
  criarTarefas: "Criou tarefas",
  adicionarChecklistNaTarefa: "Adicionou checklist",
  moverTarefa: "Moveu tarefa",
  agendarLembrete: "Agendou lembrete",
  anotarLead: "Anotou no lead",
  enviarWhatsapp: "WhatsApp (aprovação)",
  enviarWhatsappEmMassa: "WhatsApp em massa (aprovação)",
};

function toolSummary(t: ToolActivity): string {
  const r = t.result || {};
  if (r.error) return `erro: ${String(r.error).slice(0, 60)}`;
  switch (t.name) {
    case "vendasDoDia": return `${r.total_vendas ?? 0} vendas · R$${Number(r.receita_total || 0).toFixed(0)}`;
    case "vendasResumo": return `R$${Number(r.receita_total || 0).toFixed(0)} (${r.total_vendas} vendas, ${r.periodo_dias}d)`;
    case "leadsTravadosWhatsapp": return `${r.total ?? 0} leads travados ≥${r.horas_min}h`;
    case "ultimasMensagensWhatsapp": return `${r.mensagens?.length ?? 0} mensagens`;
    case "adsPerformance": return `gasto R$${Number(r.gasto_total || 0).toFixed(0)} · ROAS ${r.roas?.toFixed(2) ?? "n/d"}`;
    case "buscarProjeto": return `${r.matches?.length ?? 0} match`;
    case "buscarLead": return `${r.matches?.length ?? 0} lead(s)`;
    case "listarProjetos": return `${r.projetos?.length ?? 0} projetos`;
    case "criarTarefas": return `${r.criadas ?? 0} criada(s) em ${r.projeto || "?"}`;
    case "adicionarChecklistNaTarefa": return `${r.adicionados ?? 0} item(s) em "${r.tarefa || "?"}"`;
    case "moverTarefa": return `"${r.tarefa || "?"}" → ${r.novaColuna || "?"}`;
    case "agendarLembrete": return `${r.lembrete || "?"} (${r.quando || ""})`;
    case "anotarLead": return `nota em ${r.lead || "?"}`;
    case "enviarWhatsapp": return r.status === "pending_approval" ? `pendente · ${r.lead || ""}` : "enviado";
    case "enviarWhatsappEmMassa": return r.status === "pending_approval" ? `${r.total ?? 0} pendente(s)` : "enviado";
    default: return "ok";
  }
}

function ToolChip({ tool }: { tool: ToolActivity }) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[tool.name] || tool.name;
  const hasError = tool.result?.error;
  const isPending = tool.result?.status === "pending_approval";
  return (
    <div className={cn(
      "text-[11px] border rounded-md mb-1.5 overflow-hidden",
      hasError ? "border-red-500/30 bg-red-500/5"
        : isPending ? "border-amber-500/40 bg-amber-500/5"
        : "border-primary/20 bg-primary/5"
    )}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-2 py-1 flex items-center gap-1.5 hover:bg-primary/10"
      >
        <Wrench className={cn("h-3 w-3 shrink-0", isPending ? "text-amber-400" : "text-primary")} />
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground truncate">· {toolSummary(tool)}</span>
        {isPending && (
          <span className="ml-1 px-1.5 py-[1px] rounded text-[9px] uppercase tracking-wide bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Aguardando aprovação
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <pre className="text-[10px] bg-black/30 p-2 overflow-x-auto max-h-64">
{JSON.stringify(tool.result, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function CopilotMessage({ role, content, tools }: Props) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn(
        "h-7 w-7 shrink-0 rounded-full flex items-center justify-center",
        isUser ? "bg-muted text-foreground" : "bg-primary/15 text-primary"
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Crown className="h-3.5 w-3.5" />}
      </div>
      <div className={cn(
        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
        isUser ? "bg-primary/10 text-foreground" : "bg-muted/40 text-foreground"
      )}>
        {!isUser && tools && tools.length > 0 && (
          <div className="mb-2">
            {tools.map((t, i) => <ToolChip key={i} tool={t} />)}
          </div>
        )}
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-li:my-0.5 prose-headings:mt-2 prose-headings:mb-1">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
