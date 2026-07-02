import { EditorialHeader } from "@/components/dashboard/cockpit/EditorialHeader";
import { ProjectSellingGrid } from "@/components/dashboard/cockpit/ProjectSellingGrid";
import { DecisionQueue } from "@/components/dashboard/cockpit/DecisionQueue";
import { BlendedFunnelStrip } from "@/components/dashboard/cockpit/BlendedFunnelStrip";
import { OperationsFooter } from "@/components/dashboard/cockpit/OperationsFooter";
import { Link } from "react-router-dom";

/**
 * Cockpit do Imperador — dashboard editorial denso.
 *
 * Hierarquia:
 * 1. Header editorial (receita hoje + MTD + projeção + ROAS + margem)
 * 2. Grid de projetos "vendendo" + fila de decisão à direita
 * 3. Funil blended 30d
 * 4. Rodapé operacional (IA, conversas, tarefas, recuperação)
 *
 * As páginas específicas (/financas, /saude-produtos, /imperius, /recuperacao)
 * continuam guardando os relatórios profundos.
 */
export default function Dashboard() {
  return (
    <div className="max-w-[1600px] mx-auto animate-fade-in space-y-8 pb-8">
      <EditorialHeader />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-8 min-w-0">
          <ProjectSellingGrid />
          <BlendedFunnelStrip />
        </div>
        <div className="xl:sticky xl:top-16 xl:self-start xl:max-h-[calc(100vh-5rem)]">
          <DecisionQueue />
        </div>
      </div>

      <OperationsFooter />

      <div className="pt-4 border-t border-border/40 flex items-center justify-between text-[10px] uppercase tracking-[0.28em] text-muted-foreground/60">
        <span>Fim da edição</span>
        <Link to="/financas" className="hover:text-gold transition-colors">
          Relatório completo →
        </Link>
      </div>
    </div>
  );
}
