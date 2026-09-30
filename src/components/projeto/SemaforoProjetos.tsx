import { useState, useMemo } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  Zap, 
  ArrowRight, 
  ExternalLink,
  Bot,
  MessageCircle,
  CreditCard,
  Target
} from "lucide-react";
import { jsonFields } from "@/lib/json-fields";
import { useNavigate } from "react-router-dom";

interface Props {
  projects: Tables<"imphq_projects">[];
  onOpenGrowthCopilot: (project?: Tables<"imphq_projects">) => void;
}

export function SemaforoProjetos({ projects, onOpenGrowthCopilot }: Props) {
  const navigate = useNavigate();
  const [filterHealth, setFilterHealth] = useState<"all" | "green" | "yellow" | "red">("all");

  const projectsHealth = useMemo(() => {
    return projects.map((p) => {
      const pData = jsonFields(p.data);
      const avatar = jsonFields(p.avatar);

      // Avaliação de Saúde e Prontidão
      const hasCheckout = !!(pData.checkout_url || (Array.isArray(pData.produtos) && pData.produtos.length > 0));
      const hasAvatar = !!(avatar && avatar.nome);
      const hasLinks = !!(pData.links && (Array.isArray(pData.links) ? pData.links.length > 0 : Object.keys(pData.links).length > 0));
      const isNutra = p.category === "DTC Nutra";
      const isJP = p.id === "jp_freitas";

      let statusColor: "green" | "yellow" | "red" = "green";
      let statusLabel = "Rodando / Ativo";
      let gargalo = "Operação saudável";
      let proximaAcao = "Escalar tráfego e testar novos criativos";

      if (!hasCheckout && !hasLinks) {
        statusColor = "red";
        statusLabel = "Parado / Sem Checkout";
        gargalo = "Falta cadastrar página de vendas ou checkout";
        proximaAcao = "Adicionar link de checkout na aba Geral";
      } else if (!hasAvatar) {
        statusColor = "yellow";
        statusLabel = "Atenção / Sem Avatar";
        gargalo = "Avatar psicológico ainda não foi estruturado";
        proximaAcao = "Completar pesquisa de avatar e dores";
      } else if (isJP) {
        statusColor = "yellow";
        statusLabel = "Preparação Low Ticket";
        gargalo = "Campanha de R$ 200 pendente de validação";
        proximaAcao = "Rodar Growth Copilot para Código dos Cortes";
      } else if (isNutra) {
        statusColor = "green";
        statusLabel = "Pronto para Escala";
        gargalo = "Aguardando ativação de novas frentes de tráfego";
        proximaAcao = "Alocar verba em PDP ou Advertorial";
      }

      return {
        project: p,
        statusColor,
        statusLabel,
        gargalo,
        proximaAcao,
        hasCheckout,
        hasAvatar,
        hasLinks,
      };
    });
  }, [projects]);

  const filtered = useMemo(() => {
    if (filterHealth === "all") return projectsHealth;
    return projectsHealth.filter((x) => x.statusColor === filterHealth);
  }, [projectsHealth, filterHealth]);

  const counts = useMemo(() => {
    return {
      total: projectsHealth.length,
      green: projectsHealth.filter((x) => x.statusColor === "green").length,
      yellow: projectsHealth.filter((x) => x.statusColor === "yellow").length,
      red: projectsHealth.filter((x) => x.statusColor === "red").length,
    };
  }, [projectsHealth]);

  return (
    <Card className="bg-[#0A0B0D] border-[#1B1E23] overflow-hidden shadow-xl">
      <CardHeader className="pb-3 border-b border-[#1B1E23]/60 bg-gradient-to-r from-emerald-500/5 via-amber-500/5 to-transparent">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🚦</span>
              <CardTitle className="text-base font-semibold text-white tracking-tight">
                Semáforo Executivo da Empresa
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-400">
                Visão Macro Sócios & Equipe
              </Badge>
            </div>
            <CardDescription className="text-xs text-[#8A8F98] mt-1">
              Status em tempo real de cada projeto, gargalos críticos e ações recomendadas da IA.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-[#121418] border border-[#1B1E23] rounded-lg p-1 text-xs">
              <button
                onClick={() => setFilterHealth("all")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                  filterHealth === "all" ? "bg-[#1B1E23] text-white font-semibold" : "text-[#8A8F98] hover:text-white"
                }`}
              >
                Todos ({counts.total})
              </button>
              <button
                onClick={() => setFilterHealth("green")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all ${
                  filterHealth === "green" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-emerald-500 hover:text-emerald-400"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {counts.green} Ativos
              </button>
              <button
                onClick={() => setFilterHealth("yellow")}
                className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all ${
                  filterHealth === "yellow" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-amber-500 hover:text-amber-400"
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-amber-500" /> {counts.yellow} Atenção
              </button>
              {counts.red > 0 && (
                <button
                  onClick={() => setFilterHealth("red")}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-all ${
                    filterHealth === "red" ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-rose-500 hover:text-rose-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-rose-500" /> {counts.red} Parados
                </button>
              )}
            </div>

            <Button
              size="sm"
              onClick={() => onOpenGrowthCopilot()}
              className="bg-[#D6FF4B] hover:bg-[#D6FF4B]/90 text-[#0A0B0D] font-mono font-semibold text-xs gap-1.5 shadow-md"
            >
              <Zap className="h-3.5 w-3.5 fill-[#0A0B0D]" /> Growth Copilot
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#1B1E23] bg-[#0E1013] text-[#8A8F98] uppercase tracking-wider font-mono text-[10px]">
              <th className="py-2.5 px-4">Projeto</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Ativos no Sistema</th>
              <th className="py-2.5 px-4">Gargalo Atual</th>
              <th className="py-2.5 px-4">Próxima Ação IA</th>
              <th className="py-2.5 px-4 text-right">Ação Rápida</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1B1E23]/60">
            {filtered.map(({ project, statusColor, statusLabel, gargalo, proximaAcao, hasCheckout, hasAvatar, hasLinks }) => (
              <tr 
                key={project.id}
                className="hover:bg-[#121418]/60 transition-colors group cursor-pointer"
                onClick={() => navigate(`/projetos/${project.id}`)}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{project.icon || "📁"}</span>
                    <div>
                      <div className="font-medium text-white group-hover:text-[#D6FF4B] transition-colors flex items-center gap-1.5">
                        {project.name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#8A8F98]" />
                      </div>
                      <span className="text-[10px] text-[#8A8F98] font-mono">{project.category || "Geral"}</span>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium ${
                      statusColor === "green"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        : statusColor === "yellow"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        statusColor === "green"
                          ? "bg-emerald-400 animate-pulse"
                          : statusColor === "yellow"
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                    />
                    {statusLabel}
                  </span>
                </td>

                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className={`text-[9px] font-mono px-1.5 py-0 ${hasAvatar ? "border-emerald-500/30 text-emerald-400" : "border-border text-[#8A8F98]"}`}
                    >
                      Avatar {hasAvatar ? "✓" : "✗"}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-[9px] font-mono px-1.5 py-0 ${hasCheckout ? "border-emerald-500/30 text-emerald-400" : "border-border text-[#8A8F98]"}`}
                    >
                      Checkout {hasCheckout ? "✓" : "✗"}
                    </Badge>
                    <Badge 
                      variant="outline" 
                      className={`text-[9px] font-mono px-1.5 py-0 ${hasLinks ? "border-emerald-500/30 text-emerald-400" : "border-border text-[#8A8F98]"}`}
                    >
                      Funil {hasLinks ? "✓" : "✗"}
                    </Badge>
                  </div>
                </td>

                <td className="py-3 px-4">
                  <span className="text-[11px] text-[#C1C7CD] flex items-center gap-1.5">
                    {statusColor === "yellow" && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                    {statusColor === "red" && <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
                    {statusColor === "green" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                    <span className="truncate max-w-[240px]">{gargalo}</span>
                  </span>
                </td>

                <td className="py-3 px-4">
                  <span className="text-[11px] text-white/90 font-medium flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5 text-[#D6FF4B] shrink-0" />
                    <span className="truncate max-w-[260px]">{proximaAcao}</span>
                  </span>
                </td>

                <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onOpenGrowthCopilot(project)}
                    className="h-7 text-[11px] font-mono border-[#1B1E23] hover:border-[#D6FF4B]/50 hover:bg-[#D6FF4B]/10 hover:text-[#D6FF4B] gap-1"
                  >
                    <Target className="h-3 w-3" /> Alocar Verba
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
