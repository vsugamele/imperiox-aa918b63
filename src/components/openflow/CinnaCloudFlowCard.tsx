import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseConfig } from "@/lib/cinna-shield-x1/engine";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FlowSummary { stages: number; revision: number }

export function CinnaCloudFlowCard() {
  const [summary, setSummary] = useState<FlowSummary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const { data, error } = await supabase.functions.invoke("cinna-shield-x1", { body: { op: "get" } });
        if (error || !data || !Number.isInteger(data.revision)) throw new Error("Unavailable");
        const config = parseConfig(data.config);
        if (active) setSummary({ stages: config.stages.length, revision: data.revision });
      } catch { if (active) setFailed(true); }
    }
    void load();
    return () => { active = false; };
  }, []);
  return <Card className="bg-slate-900/40 border-white/5 overflow-hidden">
    <CardContent className="p-5 border-l-4 border-l-amber-500 space-y-4">
      <div><h3 className="font-bold text-slate-100">Cinna Shield X1 — Script + IA</h3><p className="text-[10px] text-muted-foreground uppercase">Cinna Shield</p></div>
      <Badge variant="outline">Em revisão · envio desativado</Badge>
      <p className="text-sm text-muted-foreground">{summary ? `${summary.stages} etapas · revisão ${summary.revision} salva no Supabase.` : failed ? "Abra o fluxo com uma conta administradora para conferir a configuração." : "Carregando configuração do Supabase…"}</p>
      <Button asChild variant="outline"><Link to="/openflow/cinna-shield">Conferir e testar fluxo</Link></Button>
    </CardContent>
  </Card>;
}
