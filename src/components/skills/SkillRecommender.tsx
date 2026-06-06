// SkillRecommender.tsx — Sugere a próxima skill baseada no estado do projeto
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Brain, ArrowRight, CheckCircle2, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

interface Recommendation {
  skill_id: string;
  skill_nome: string;
  emoji: string;
  motivo: string;
  urgencia: "alta" | "media" | "baixa";
  pipeline_sugerido?: string;
}

interface Props {
  projectId: string;
  projectName: string;
  onRunSkill: (skillId: string) => void;
}

function analyzeProjectAndRecommend(
  project: any,
  recentOutputs: { skill_id: string; skill_nome: string; created_at: string }[],
): Recommendation[] {
  const recs: Recommendation[] = [];
  const d = typeof project?.data === "string" ? JSON.parse(project.data || "{}") : (project?.data || {});
  const hasAvatar = !!d.avatar || recentOutputs.some(o => o.skill_id === "avatar-architect");
  const hasMecanismo = recentOutputs.some(o => o.skill_id === "mecanismo-unico");
  const hasLP = recentOutputs.some(o => o.skill_id === "lp-persuasiva");
  const hasCopy = recentOutputs.some(o => ["devastador", "anams-copywriter"].includes(o.skill_id));
  const hasIntel = recentOutputs.some(o => o.skill_id === "market-intel");
  const hasTripwire = recentOutputs.some(o => o.skill_id === "tripwire-matador");
  const hasProdutos = d.produtos && d.produtos.length > 0;

  // Regra 1: Sem avatar é a prioridade máxima — tudo depende disso
  if (!hasAvatar) {
    recs.push({
      skill_id: "avatar-architect",
      skill_nome: "Avatar Architect",
      emoji: "🧠",
      motivo: "Você ainda não tem um dossiê de avatar para este projeto. Tudo na copy, na LP e nos anúncios dependem de entender quem é o seu comprador.",
      urgencia: "alta",
      pipeline_sugerido: "lancamento-zero",
    });
  }

  // Regra 2: Tem avatar mas sem mecanismo único
  if (hasAvatar && !hasMecanismo) {
    recs.push({
      skill_id: "mecanismo-unico",
      skill_nome: "Mecanismo Único",
      emoji: "⚗️",
      motivo: "Avatar criado! Próximo passo: definir o mecanismo único que diferencia seu produto no mercado.",
      urgencia: "alta",
      pipeline_sugerido: "lancamento-zero",
    });
  }

  // Regra 3: Sem inteligência de mercado
  if (!hasIntel && hasProdutos) {
    recs.push({
      skill_id: "market-intel",
      skill_nome: "Market Intel",
      emoji: "🕵️",
      motivo: "Rodar análise de mercado agora vai revelar ângulos que seus concorrentes não estão usando.",
      urgencia: "media",
    });
  }

  // Regra 4: Tem avatar e mecanismo mas sem LP
  if (hasAvatar && hasMecanismo && !hasLP) {
    recs.push({
      skill_id: "lp-persuasiva",
      skill_nome: "LP Persuasiva",
      emoji: "🎯",
      motivo: "Com avatar e mecanismo definidos, é hora de criar a landing page de alta conversão.",
      urgencia: "alta",
      pipeline_sugerido: "lancamento-zero",
    });
  }

  // Regra 5: Tem LP mas sem copy para tráfego
  if (hasLP && !hasCopy) {
    recs.push({
      skill_id: "devastador",
      skill_nome: "Devastador de Ângulos",
      emoji: "💣",
      motivo: "LP pronta! Agora precisa de ângulos de copy para os anúncios e conteúdos de topo de funil.",
      urgencia: "media",
      pipeline_sugerido: "pesquisa-copy",
    });
  }

  // Regra 6: Sem tripwire
  if (hasLP && !hasTripwire) {
    recs.push({
      skill_id: "tripwire-matador",
      skill_nome: "Tripwire Matador",
      emoji: "🪤",
      motivo: "Crie uma oferta de entrada irresistível para reduzir o CAC e preparar o lead para a oferta principal.",
      urgencia: "baixa",
    });
  }

  // Sem produtos cadastrados
  if (!hasProdutos) {
    recs.push({
      skill_id: "alquimia-escada-valor",
      skill_nome: "Alquimia de Escada de Valor",
      emoji: "📈",
      motivo: "Nenhum produto cadastrado ainda. Comece estruturando a escada de valor do seu negócio.",
      urgencia: "media",
    });
  }

  return recs.slice(0, 3); // Máx 3 sugestões para não sobrecarregar
}

const URGENCIA_STYLES = {
  alta: "border-red-500/30 bg-red-500/5",
  media: "border-amber-500/30 bg-amber-500/5",
  baixa: "border-blue-500/20 bg-blue-500/5",
};

const URGENCIA_BADGE = {
  alta: "bg-red-500/15 text-red-400",
  media: "bg-amber-500/15 text-amber-400",
  baixa: "bg-blue-500/15 text-blue-400",
};

export function SkillRecommender({ projectId, projectName, onRunSkill }: Props) {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!projectId) { setRecs([]); return; }
    setLoading(true);
    Promise.all([
      supabase.from("imphq_projects").select("name, data, avatar").eq("id", projectId).maybeSingle(),
      supabase.from("imphq_skill_outputs").select("skill_id, skill_nome, created_at")
        .eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    ]).then(([projRes, outputsRes]) => {
      const project = projRes.data;
      const outputs = outputsRes.data || [];
      if (project) {
        setRecs(analyzeProjectAndRecommend(project, outputs));
      }
    }).finally(() => setLoading(false));
  }, [projectId]);

  if (!projectId || loading || recs.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 transition-colors text-left"
        onClick={() => setCollapsed(v => !v)}
      >
        <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            🤖 Imperius recomenda para <span className="text-primary">{projectName}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            {recs.length} skill{recs.length > 1 ? "s sugeridas" : " sugerida"} com base no estado atual do projeto
          </p>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {recs.map((rec, i) => (
            <div key={rec.skill_id} className={`rounded-lg border p-3 ${URGENCIA_STYLES[rec.urgencia]}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{rec.emoji}</span>
                  <p className="text-xs font-semibold leading-snug">{rec.skill_nome}</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${URGENCIA_BADGE[rec.urgencia]}`}>
                  {rec.urgencia === "alta" ? "🔴 Urgente" : rec.urgencia === "media" ? "🟡 Importante" : "🔵 Recomendado"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">{rec.motivo}</p>
              <div className="flex gap-1.5">
                <Button
                  size="sm" variant="outline"
                  className="h-6 text-[10px] flex-1 gap-1"
                  onClick={() => onRunSkill(rec.skill_id)}
                >
                  <ArrowRight className="h-2.5 w-2.5" /> Executar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
