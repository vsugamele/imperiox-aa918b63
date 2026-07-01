import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, MessageSquare, ExternalLink, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Automation {
  id: string;
  nome: string;
  project_id?: string | null;
  trigger_tipo?: string | null;
  ativo?: boolean;
}

interface Props {
  lead: any;
  automations: Automation[];
}

export default function LeadActionsMenu({ lead, automations }: Props) {
  const [running, setRunning] = useState<string | null>(null);
  const navigate = useNavigate();

  const projectAutomations = (automations || []).filter(
    (a) => a.ativo && (!a.project_id || a.project_id === lead.project_id),
  );

  const phoneDigits = lead.phone ? String(lead.phone).replace(/\D/g, "") : "";
  const normalizedPhone = phoneDigits
    ? (phoneDigits.startsWith("55") ? phoneDigits : "55" + phoneDigits)
    : "";
  const waUrl = normalizedPhone ? `https://wa.me/${normalizedPhone}` : null;
  const internalChatUrl = normalizedPhone
    ? `/inbox?tab=whatsapp&phone=${normalizedPhone}${lead.project_id ? `&project=${lead.project_id}` : ""}`
    : null;

  const runAutomation = async (auto: Automation) => {
    if (!lead.project_id) {
      toast.error("Lead sem projeto vinculado.");
      return;
    }
    try {
      setRunning(auto.id);
      const { data, error } = await supabase.functions.invoke("openflow-executor", {
        body: {
          trigger_tipo: auto.trigger_tipo || "lead_capturado",
          project_id: lead.project_id,
          automacao_id: auto.id,
          lead_data: {
            lead_id: lead.id,
            nome: lead.nome,
            email: lead.email,
            phone: lead.phone,
            produto: (lead.data as any)?.ultimo_produto,
          },
        },
      });
      if (error) throw error;
      toast.success(`Automação "${auto.nome}" disparada.`, {
        description: data?.executed ? `${data.executed} step(s) executados.` : undefined,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao disparar automação.");
    } finally {
      setRunning(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={(e) => e.stopPropagation()}
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          ) : (
            <MessageCircle className="h-4 w-4 text-emerald-400" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        className="w-56"
      >
        <DropdownMenuLabel className="text-[11px]">Ações no lead</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {internalChatUrl ? (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); navigate(internalChatUrl); }} className="cursor-pointer">
            <MessageSquare className="h-3.5 w-3.5 mr-2 text-primary" />
            Abrir chat interno
          </DropdownMenuItem>
        ) : null}
        {waUrl ? (
          <DropdownMenuItem asChild>
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="cursor-pointer">
              <ExternalLink className="h-3.5 w-3.5 mr-2 text-emerald-400" />
              Abrir wa.me
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <ExternalLink className="h-3.5 w-3.5 mr-2" /> Sem telefone
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Zap className="h-3.5 w-3.5 mr-2 text-primary" />
            Rodar automação
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64 max-h-80 overflow-y-auto">
            {projectAutomations.length === 0 ? (
              <DropdownMenuItem disabled className="text-xs">
                Nenhuma automação ativa para este projeto
              </DropdownMenuItem>
            ) : (
              projectAutomations.map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    runAutomation(a);
                  }}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-xs font-medium">{a.nome}</span>
                  {a.trigger_tipo && (
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                      {a.trigger_tipo}
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
