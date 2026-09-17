import { z } from "zod";
import { diagnosisSchema } from "@/components/assistente/diagnosis-schema";
import type { Json } from "@/integrations/supabase/types";
import { jsonFields, jsonText } from "@/lib/json-fields";
import { errorMessage } from "@/lib/error-message";
import { useEffect, useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistPanel } from "@/components/assistente/ChecklistPanel";
import { DiagnosticPanel } from "@/components/assistente/DiagnosticPanel";
import { HealthCard } from "@/components/assistente/HealthCard";
import { BuilderWizard } from "@/components/assistente/BuilderWizard";
import { AREA_LABEL, type Area } from "@/lib/assistenteFrameworks";
import { toast } from "sonner";



interface Props {
  area: Area;
  projectId?: string;
  produto?: string;
  trigger?: React.ReactNode;
}

export function GuideDrawer({ area, projectId, produto, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; nome: string }>>([]);
  const [pid, setPid] = useState<string | undefined>(projectId);
  const [data, setData] = useState<z.infer<typeof diagnosisSchema> | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const wizardTipo = area === "campanhas" ? "campanha" : area === "lancamento" ? "lancamento" : "nutricao";

  useEffect(() => {
    if (!open) return;
    if (projects.length === 0) {
      supabase.from("imphq_projects").select("id,name,is_archived").order("name")
        .then(({ data }) => setProjects(((data || [])).filter((p) => !p.is_archived).map((p) => ({ id: p.id, nome: p.name }))));
    }
  }, [open, projects.length]);

  const load = useCallback(async (force = false) => {
    if (!pid) return;
    setLoading(true);
    try {
      const { data: r, error } = await supabase.functions.invoke<Json>("assistente-diagnose", {
        body: { project_id: pid, area, force },
      });
      if (error || jsonFields(r).error) throw new Error(jsonText(jsonFields(r).error) || error?.message);
      const results = jsonFields(r).results;
      setData(diagnosisSchema.parse(Array.isArray(results) ? results[0] : undefined));
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "Erro no diagnóstico");
    } finally { setLoading(false); }
  }, [pid, area]);

  useEffect(() => { if (open && pid) load(false); }, [open, pid, load]);

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm" className="gap-1.5">
              <Compass className="h-3.5 w-3.5" /> Guia + IA
            </Button>
          )}
        </SheetTrigger>
        <SheetContent className="bg-secondary/40 w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-serif flex items-center gap-2">
              <Compass className="h-4 w-4 text-gold" /> Guia · {AREA_LABEL[area]}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {!projectId && (
              <div>
                <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Projeto</label>
                <Select value={pid} onValueChange={setPid}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecione um projeto..." /></SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!pid ? (
              <p className="text-sm text-muted-foreground">Escolha um projeto para diagnosticar.</p>
            ) : loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</div>
            ) : data ? (
              <>
                <HealthCard score={data.score} label={`Saúde · ${AREA_LABEL[area]}`} nextAction={data.next_action} />

                <section>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">O que falta</h3>
                    <Button variant="ghost" size="sm" onClick={() => load(true)} className="h-7 px-2">
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                  <ChecklistPanel items={(data.checklist || []).map(item => ({ key: item.key, label: item.label, weight: item.weight, done: item.done }))} />
                </section>

                <section>
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">O que melhorar</h3>
                  <DiagnosticPanel gargalos={(data.gargalos || []).map(item => ({ titulo: item.titulo, desc: item.desc, impacto: item.impacto }))} />
                </section>

                <section className="pt-3 border-t border-border/40">
                  <h3 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Acelerar com IA</h3>
                  <Button className="w-full gap-1.5" onClick={() => setWizardOpen(true)}>
                    <Sparkles className="h-4 w-4" /> Construir com IA
                  </Button>
                </section>
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {pid && (
        <BuilderWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          tipo={wizardTipo}
          projectId={pid}
          produto={produto}
          onDone={() => load(true)}
        />
      )}
    </>
  );
}
