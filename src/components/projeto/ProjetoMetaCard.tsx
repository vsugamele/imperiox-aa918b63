import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Target, Pencil, TrendingUp, Users, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  receitaMes: number;
  leadsMes: number;
  vendasMes: number;
}

export function ProjetoMetaCard({ projectId, receitaMes, leadsMes, vendasMes }: Props) {
  const [goal, setGoal] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ meta_receita: 0, meta_leads: 0, meta_vendas: 0, meta_roas: 0 });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;

  const load = async () => {
    const { data } = await (supabase as any).from("imphq_project_goals")
      .select("*").eq("project_id", projectId).eq("ano", ano).eq("mes", mes).maybeSingle();
    setGoal(data);
    if (data) {
      setForm({
        meta_receita: Number(data.meta_receita) || 0,
        meta_leads: Number(data.meta_leads) || 0,
        meta_vendas: Number(data.meta_vendas) || 0,
        meta_roas: Number(data.meta_roas) || 0,
      });
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const save = async () => {
    setSaving(true);
    const payload = { project_id: projectId, ano, mes, ...form };
    const sb: any = supabase;
    const { error } = goal
      ? await sb.from("imphq_project_goals").update(payload).eq("id", goal.id)
      : await sb.from("imphq_project_goals").insert(payload);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar meta"); return; }
    toast.success("Meta salva");
    setOpen(false);
    load();
  };

  const { pctReceita, projecao, statusCor, diasRestantes, ritmoStatus } = useMemo(() => {
    const meta = Number(goal?.meta_receita) || 0;
    const pct = meta > 0 ? Math.min(100, (receitaMes / meta) * 100) : 0;
    const day = now.getDate();
    const lastDay = new Date(ano, mes, 0).getDate();
    const diasRestantes = lastDay - day;
    const proj = day > 0 ? (receitaMes / day) * lastDay : 0;
    let cor = "text-emerald-400";
    let ritmo = "no_ritmo";
    if (meta > 0) {
      if (proj < meta * 0.8) { cor = "text-red-400"; ritmo = "atrasado"; }
      else if (proj < meta) { cor = "text-amber-400"; ritmo = "atencao"; }
    }
    return { pctReceita: pct, projecao: proj, statusCor: cor, diasRestantes, ritmoStatus: ritmo };
  }, [goal, receitaMes]);

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Meta do Mês
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-7 px-2">
            <Pencil className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {!goal || Number(goal.meta_receita) === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              Nenhuma meta definida. <button onClick={() => setOpen(true)} className="text-primary hover:underline">Definir agora</button>
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[10px] uppercase text-muted-foreground tracking-wider">Receita</span>
                  <span className="text-[10px] text-muted-foreground">{pctReceita.toFixed(0)}%</span>
                </div>
                <Progress value={pctReceita} className="h-2" />
                <div className="flex justify-between mt-1 text-[10px]">
                  <span className="text-foreground font-medium">R$ {receitaMes.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                  <span className="text-muted-foreground">/ R$ {Number(goal.meta_receita).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <MiniGoal icon={<Users className="h-3 w-3" />} label="Leads" actual={leadsMes} target={Number(goal.meta_leads) || 0} />
                <MiniGoal icon={<ShoppingCart className="h-3 w-3" />} label="Vendas" actual={vendasMes} target={Number(goal.meta_vendas) || 0} />
                <MiniGoal icon={<TrendingUp className="h-3 w-3" />} label="ROAS" actual={0} target={Number(goal.meta_roas) || 0} hideValue />
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Projeção fim de mês</span>
                  <span className={`font-semibold ${statusCor}`}>R$ {projecao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Dias restantes</span>
                  <span className="text-foreground">{diasRestantes}</span>
                </div>
                {ritmoStatus === "atrasado" && (
                  <div className="text-[10px] text-red-400 mt-1">⚠ Ritmo abaixo do necessário pra bater meta.</div>
                )}
                {ritmoStatus === "atencao" && (
                  <div className="text-[10px] text-amber-400 mt-1">⚠ Ritmo na linha — precisa acelerar.</div>
                )}
                {ritmoStatus === "no_ritmo" && (
                  <div className="text-[10px] text-emerald-400 mt-1">✓ No ritmo pra bater a meta.</div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Meta de {String(mes).padStart(2, "0")}/{ano}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Receita (R$)</Label>
              <Input type="number" value={form.meta_receita} onChange={e => setForm({ ...form, meta_receita: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Leads</Label>
                <Input type="number" value={form.meta_leads} onChange={e => setForm({ ...form, meta_leads: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Vendas</Label>
                <Input type="number" value={form.meta_vendas} onChange={e => setForm({ ...form, meta_vendas: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>ROAS alvo</Label>
              <Input type="number" step="0.1" value={form.meta_roas} onChange={e => setForm({ ...form, meta_roas: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MiniGoal({ icon, label, actual, target, hideValue }: any) {
  const pct = target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  return (
    <div className="bg-muted/30 rounded p-2">
      <div className="flex items-center gap-1 text-muted-foreground mb-1">{icon}<span>{label}</span></div>
      {!hideValue && <div className="text-foreground font-semibold">{actual}/{target}</div>}
      {hideValue && <div className="text-foreground font-semibold">{target.toFixed(1)}x</div>}
      <Progress value={pct} className="h-1 mt-1" />
    </div>
  );
}
