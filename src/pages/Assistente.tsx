import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Compass, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChecklistPanel } from "@/components/assistente/ChecklistPanel";
import { DiagnosticPanel } from "@/components/assistente/DiagnosticPanel";
import { HealthCard } from "@/components/assistente/HealthCard";
import { BuilderWizard } from "@/components/assistente/BuilderWizard";
import { AREA_LABEL, type Area } from "@/lib/assistenteFrameworks";
import { toast } from "sonner";

export default function Assistente() {
  const [projects, setProjects] = useState<Array<{ id: string; nome: string }>>([]);
  const [pid, setPid] = useState<string | undefined>();
  const [area, setArea] = useState<Area>("campanhas");
  const [results, setResults] = useState<Record<Area, any>>({} as any);
  const [loading, setLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    supabase.from("imphq_projects").select("id,name,is_archived,status").order("name")
      .then(({ data }) => {
        const list = ((data || []) as any[]).filter((p) => !p.is_archived);
        // priorizar 'vendendo'
        list.sort((a, b) => (a.status === "vendendo" ? -1 : 1) - (b.status === "vendendo" ? -1 : 1));
        setProjects(list.map((p) => ({ id: p.id, nome: p.name })));
        if (!pid && list[0]) setPid(list[0].id);
      });
  }, []);

  const load = async (force = false) => {
    if (!pid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("assistente-diagnose", {
        body: { project_id: pid, area: "all", force },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const map: any = {};
      (data.results || []).forEach((r: any) => { map[r.area] = r; });
      setResults(map);
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (pid) load(false); }, [pid]);

  const current = results[area];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl flex items-center gap-2">
            <Compass className="h-7 w-7 text-gold" /> Assistente
          </h1>
          <p className="text-sm text-muted-foreground mt-1 leading-7">
            Guia + diagnóstico + IA construtora para Campanhas, Lançamento e Nutrição.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={pid} onValueChange={setPid}>
            <SelectTrigger className="h-9 w-[240px]"><SelectValue placeholder="Selecione projeto" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {pid && Object.keys(results).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["campanhas", "lancamento", "nutricao"] as Area[]).map((a) => (
            <button key={a} onClick={() => setArea(a)} className={`text-left transition ${area === a ? "ring-2 ring-gold/60 rounded-lg" : ""}`}>
              <HealthCard score={results[a]?.score || 0} label={AREA_LABEL[a]} nextAction={results[a]?.next_action} />
            </button>
          ))}
        </div>
      )}

      <Tabs value={area} onValueChange={(v) => setArea(v as Area)}>
        <TabsList>
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="lancamento">Lançamento</TabsTrigger>
          <TabsTrigger value="nutricao">Nutrição</TabsTrigger>
        </TabsList>

        {(["campanhas", "lancamento", "nutricao"] as Area[]).map((a) => (
          <TabsContent key={a} value={a} className="mt-4">
            {loading ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground"><Loader2 className="h-5 w-5 mx-auto animate-spin" /></CardContent></Card>
            ) : !current ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione um projeto.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="bg-secondary/30">
                  <CardContent className="p-5">
                    <h3 className="font-serif text-lg mb-3">O que falta</h3>
                    <ChecklistPanel items={current.checklist || []} />
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30">
                  <CardContent className="p-5 space-y-4">
                    <div>
                      <h3 className="font-serif text-lg mb-3">O que melhorar</h3>
                      <DiagnosticPanel gargalos={current.gargalos || []} />
                    </div>
                    <div className="pt-3 border-t border-border/40">
                      <Button className="w-full gap-1.5" onClick={() => setWizardOpen(true)}>
                        <Sparkles className="h-4 w-4" /> Construir com IA · {AREA_LABEL[area]}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {pid && (
        <BuilderWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          tipo={area === "campanhas" ? "campanha" : area === "lancamento" ? "lancamento" : "nutricao"}
          projectId={pid}
          onDone={() => load(true)}
        />
      )}
    </div>
  );
}
