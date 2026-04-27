import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Calendar } from "lucide-react";
import { toLocalDateStr, localDaysAgo } from "@/lib/periodUtils";
import { CampanhasTable } from "@/components/gerenciador/CampanhasTable";
import { AcoesHistorico } from "@/components/gerenciador/AcoesHistorico";

const PERIODS = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "14 dias", days: 14 },
  { label: "30 dias", days: 30 },
  { label: "60 dias", days: 60 },
];

export default function Gerenciador() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string>("__all__");
  const [days, setDays] = useState<number>(30);
  const [ads, setAds] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Carregar projetos
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      setProjects(data || []);
    })();
  }, []);

  // Carregar ads + vendas pelo período
  useEffect(() => {
    (async () => {
      const from = localDaysAgo(days);
      const to = toLocalDateStr();
      let qa = supabase.from("imphq_ads_spend").select("*").gte("data_ref", from).lte("data_ref", to).limit(2000);
      let qv = supabase.from("imphq_vendas").select("id, project_id, produto_nome, valor, plataforma, data_venda, utm_campaign").gte("data_venda", from).lte("data_venda", to).limit(2000);
      if (projectId !== "__all__") {
        qa = qa.eq("project_id", projectId);
        qv = qv.eq("project_id", projectId);
      }
      const [{ data: aData }, { data: vData }] = await Promise.all([qa, qv]) as any;
      setAds(aData || []);
      setVendas(vData || []);
    })();
  }, [projectId, days, refreshKey]);

  const periodLabel = useMemo(() => {
    const from = localDaysAgo(days);
    const to = toLocalDateStr();
    const fmt = (s: string) => s.split("-").reverse().slice(0, 2).join("/");
    return `${fmt(from)} → ${fmt(to)}`;
  }, [days]);

  const exportCsv = () => {
    if (ads.length === 0) return;
    const headers = Object.keys(ads[0]);
    const csv = [
      headers.join(","),
      ...ads.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `gerenciador-${periodLabel.replace(/[^\d]/g, "")}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-light tracking-tight" style={{ fontFamily: "Cormorant Garamond, serif" }}>Gerenciador</h1>
          <p className="text-xs text-muted-foreground mt-1">Controle direto das suas campanhas Meta — pausar, ativar e diagnosticar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[200px] h-9 bg-secondary/30 border-border/40 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os projetos</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-[160px] h-9 bg-secondary/30 border-border/40 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 h-9 text-xs">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums px-2">{periodLabel}</span>
        </div>
      </div>

      <Tabs defaultValue="meta" className="space-y-4">
        <TabsList className="bg-transparent border-b border-border/30 rounded-none h-auto p-0 gap-1">
          <TabsTrigger value="meta" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4 py-2 text-xs uppercase tracking-wider">Meta Ads</TabsTrigger>
          <TabsTrigger value="google" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4 py-2 text-xs uppercase tracking-wider">Google Ads</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-6 mt-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Todas as Campanhas</p>
            <CampanhasTable
              ads={ads.filter(a => a.plataforma === "Facebook" || a.plataforma === "Meta")}
              vendas={vendas}
              projectId={projectId !== "__all__" ? projectId : undefined}
              onAfterToggle={() => setRefreshKey(k => k + 1)}
            />
          </div>

          <AcoesHistorico projectId={projectId !== "__all__" ? projectId : undefined} />
        </TabsContent>

        <TabsContent value="google" className="mt-4">
          <Card className="bg-secondary/30 border-border/40">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Google Ads em breve. Conecte sua conta na seção Empresa para começar.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
