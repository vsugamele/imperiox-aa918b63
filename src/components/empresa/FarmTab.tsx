import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sprout, Plus, Flame, ShieldAlert, DollarSign, Pencil, Activity, Heart, CalendarClock, AlertTriangle, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { calcFarmHealth, nextWarmupAction } from "@/lib/farmHealthScore";

type Conta = any;
type Conteudo = any;
type Evento = any;

const WARMUP = ["novo", "aquecendo", "pronto", "pausado", "banido"];
const STATUS_VENDA = ["mantida", "listada", "negociando", "vendida"];
const RISCO_OPTIONS = ["queda_alcance", "shadowban", "captcha_frequente", "reset_senha", "checkpoint", "denuncia", "queda_engajamento"];

export function FarmTab() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [conteudo, setConteudo] = useState<Conteudo[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [edit, setEdit] = useState<Conta | null>(null);
  const [sub, setSub] = useState("contas");

  const load = async () => {
    const [c, ct, ev] = await Promise.all([
      supabase.from("imphq_empresa").select("*").in("tipo", ["instagram", "tiktok", "youtube"]).order("created_at", { ascending: false }),
      supabase.from("imphq_empresa_conteudo").select("*").order("horario_agendado", { ascending: true }).limit(200),
      supabase.from("imphq_empresa_eventos").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setContas(c.data || []);
    setConteudo(ct.data || []);
    setEventos(ev.data || []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit) return;
    const { id, nome, tipo, foto_url, mapa_node_id, extra, created_at, updated_at, ...patch } = edit;
    const { error } = await supabase.from("imphq_empresa").update(patch).eq("id", edit.id);
    if (error) return toast.error(error.message);
    toast.success("Atualizado");
    setEdit(null); load();
  };

  // Health por conta + agregados
  const enriched = useMemo(() => contas.map(c => ({ ...c, _h: calcFarmHealth(c) })), [contas]);
  const stats = useMemo(() => {
    const total = enriched.length || 1;
    const avgScore = Math.round(enriched.reduce((a, c) => a + c._h.score, 0) / total);
    return {
      total: enriched.length,
      prontas: enriched.filter(c => c.pronta_venda).length,
      risco: enriched.filter(c => (c.sinais_risco?.length || 0) > 0 || c._h.status === "critico" || c._h.status === "banido").length,
      vendidas: enriched.filter(c => c.status_venda === "vendida").length,
      avgScore,
      alertas: enriched.filter(c => c._h.status === "banido" || (c.sinais_risco?.length || 0) > 0),
    };
  }, [enriched]);

  const toggleRisco = (r: string) => {
    if (!edit) return;
    const arr = Array.isArray(edit.sinais_risco) ? edit.sinais_risco : [];
    const has = arr.includes(r);
    setEdit({ ...edit, sinais_risco: has ? arr.filter((x: string) => x !== r) : [...arr, r] });
  };

  const marcarBanido = async (c: Conta) => {
    if (!confirm(`Marcar ${c.nome} como BANIDA?`)) return;
    const { error } = await supabase.from("imphq_empresa").update({ warmup_status: "banido", status_venda: "mantida" } as any).eq("id", c.id);
    if (error) return toast.error(error.message);
    await supabase.from("imphq_empresa_eventos").insert({ conta_id: c.id, tipo: "banimento", payload: { motivo: "manual" } } as any);
    toast.success("Marcado como banido");
    load();
  };

  const marcarPronta = async (c: Conta) => {
    const { error } = await supabase.from("imphq_empresa").update({ warmup_status: "pronto", pronta_venda: true } as any).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Marcada como pronta");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={<Sprout className="h-4 w-4" />} label="Contas no farm" value={stats.total} />
        <Kpi icon={<Heart className="h-4 w-4 text-emerald-400" />} label="Health médio" value={`${stats.avgScore}`} suffix="/100" />
        <Kpi icon={<Flame className="h-4 w-4 text-primary" />} label="Prontas p/ venda" value={stats.prontas} />
        <Kpi icon={<ShieldAlert className="h-4 w-4 text-destructive" />} label="Em risco" value={stats.risco} />
        <Kpi icon={<DollarSign className="h-4 w-4 text-primary" />} label="Vendidas" value={stats.vendidas} />
      </div>

      {stats.alertas.length > 0 && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2 text-sm font-medium text-red-300">
              <AlertTriangle className="h-4 w-4" /> {stats.alertas.length} conta{stats.alertas.length > 1 ? "s" : ""} precisa{stats.alertas.length > 1 ? "m" : ""} de atenção
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stats.alertas.slice(0, 10).map((c: any) => (
                <button key={c.id} onClick={() => setEdit(c)}
                  className={`text-[11px] px-2 py-1 rounded border ${c._h.cor_bg} ${c._h.cor} hover:brightness-125`}>
                  {c.nome} · {c._h.statusLabel}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={sub} onValueChange={setSub}>
        <TabsList>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="warmup"><CalendarClock className="h-3.5 w-3.5 mr-1" /> Warmup</TabsTrigger>
          <TabsTrigger value="fila">Fila de conteúdo</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
        </TabsList>

        <TabsContent value="contas">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Conta</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Warmup</TableHead>
                <TableHead>Idade</TableHead>
                <TableHead>Seguidores</TableHead>
                <TableHead>Eng.</TableHead>
                <TableHead>Proxy</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {enriched.map((c: any) => {
                  const h = c._h;
                  return (
                    <TableRow key={c.id} className={h.status === "banido" ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{c.nome} <span className="text-xs text-muted-foreground">· {c.tipo}</span></TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded border text-[11px] font-semibold ${h.cor_bg} ${h.cor}`}>
                          <Heart className="h-3 w-3" /> {h.score}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {c.warmup_status || "novo"}
                          {h.warmupDiasRestantes !== null && ` · ${h.warmupDiasRestantes}d`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{h.idadeDias !== null ? `${h.idadeDias}d` : "—"}</TableCell>
                      <TableCell>{c.seguidores || 0}</TableCell>
                      <TableCell>{c.engajamento_medio || 0}%</TableCell>
                      <TableCell className="text-xs">{c.proxy_tipo || "—"} {c.proxy_geo ? `· ${c.proxy_geo}` : ""}</TableCell>
                      <TableCell>
                        {c.pronta_venda && <Badge className="mr-1">pronta</Badge>}
                        <Badge variant="secondary">{c.status_venda || "mantida"}</Badge>
                        {(c.sinais_risco?.length || 0) > 0 && (
                          <Badge variant="outline" className="ml-1 border-red-500/50 text-red-300 text-[9px]">⚠ {c.sinais_risco.length}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEdit(c)} title="Editar"><Pencil className="h-3.5 w-3.5" /></Button>
                          {c.warmup_status !== "banido" && (
                            <Button size="sm" variant="ghost" onClick={() => marcarBanido(c)} title="Marcar como banido">
                              <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {enriched.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">Nenhuma conta ainda. Cadastre em Instagram/TikTok/YouTube.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="warmup">
          <Card><CardContent className="p-4 space-y-3">
            <div className="text-xs text-muted-foreground">Roadmap de 21 dias por conta. Ações sugeridas pela IA baseadas no dia atual do warmup.</div>
            {enriched.filter((c: any) => c.warmup_status !== "banido" && c.status_venda !== "vendida").map((c: any) => {
              const h = c._h;
              const action = nextWarmupAction(c, h);
              const total = 21;
              const done = h.warmupDiasRestantes !== null ? total - h.warmupDiasRestantes : (c.warmup_status === "pronto" ? total : 0);
              const pct = Math.max(0, Math.min(100, (done / total) * 100));
              return (
                <div key={c.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{c.nome}</span>
                      <Badge variant="outline" className="text-[9px]">{c.tipo}</Badge>
                      <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] ${h.cor_bg} ${h.cor}`}>
                        <Heart className="h-2.5 w-2.5" /> {h.score}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      dia {done}/{total} · {c.warmup_status || "novo"}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {action && (
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11.5px] text-foreground/85 flex items-center gap-1.5">
                        <TrendingUp className="h-3 w-3 text-primary" /> {action}
                      </div>
                      {c.warmup_status !== "pronto" && done >= total && (
                        <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => marcarPronta(c)}>
                          Marcar pronta
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {enriched.filter((c: any) => c.warmup_status !== "banido" && c.status_venda !== "vendida").length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">Sem contas em warmup ativo.</div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fila">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Conta</TableHead><TableHead>Legenda</TableHead>
                <TableHead>Agendado</TableHead><TableHead>Status</TableHead>
                <TableHead>Alcance</TableHead><TableHead>Likes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {conteudo.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{contas.find(c => c.id === p.conta_id)?.nome || p.conta_id}</TableCell>
                    <TableCell className="text-xs max-w-xs truncate">{p.legenda}</TableCell>
                    <TableCell className="text-xs">{p.horario_agendado ? new Date(p.horario_agendado).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    <TableCell>{p.alcance}</TableCell><TableCell>{p.likes}</TableCell>
                  </TableRow>
                ))}
                {conteudo.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Fila vazia.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="eventos">
          <Card><CardContent className="p-4 space-y-2">
            {eventos.map(e => (
              <div key={e.id} className="flex items-center gap-3 text-xs border-b border-border/50 pb-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{e.tipo}</span>
                <span className="text-muted-foreground">{contas.find(c => c.id === e.conta_id)?.nome || e.conta_id}</span>
                <span className="ml-auto text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
            {eventos.length === 0 && <div className="text-center text-sm text-muted-foreground py-8">Sem eventos.</div>}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!edit} onOpenChange={o => !o && setEdit(null)}>
        <DialogContent className="max-w-2xl bg-secondary/40 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar conta do farm</DialogTitle></DialogHeader>
          {edit && (() => {
            const h = calcFarmHealth(edit);
            return (
              <div className="space-y-4">
                <div className={`rounded-lg border p-3 flex items-center gap-3 ${h.cor_bg}`}>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${h.cor}`}>{h.score}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Health</div>
                  </div>
                  <div className="flex-1 text-xs space-y-0.5">
                    <div className={`font-semibold ${h.cor}`}>{h.statusLabel}</div>
                    <div className="text-muted-foreground">
                      Idade {Math.round(h.idadeScore)} · Eng {Math.round(h.engScore)} · Alcance {Math.round(h.alcanceScore)} · Warmup {Math.round(h.warmupScore)}
                      {h.riscoPenalty > 0 && <span className="text-red-400"> · -{h.riscoPenalty} risco</span>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Nicho"><Input value={edit.nicho || ""} onChange={e => setEdit({ ...edit, nicho: e.target.value })} /></Field>
                  <Field label="Data criação da conta"><Input type="date" value={edit.data_criacao_conta || ""} onChange={e => setEdit({ ...edit, data_criacao_conta: e.target.value })} /></Field>
                  <Field label="Warmup">
                    <Select value={edit.warmup_status || "novo"} onValueChange={v => setEdit({ ...edit, warmup_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{WARMUP.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Dias em warmup"><Input type="number" value={edit.warmup_days || 0} onChange={e => setEdit({ ...edit, warmup_days: +e.target.value })} /></Field>
                  <Field label="Seguidores"><Input type="number" value={edit.seguidores || 0} onChange={e => setEdit({ ...edit, seguidores: +e.target.value })} /></Field>
                  <Field label="Engajamento médio (%)"><Input type="number" step="0.1" value={edit.engajamento_medio || 0} onChange={e => setEdit({ ...edit, engajamento_medio: +e.target.value })} /></Field>
                  <Field label="Último alcance"><Input type="number" value={edit.ultimo_alcance || 0} onChange={e => setEdit({ ...edit, ultimo_alcance: +e.target.value })} /></Field>
                  <Field label="Cloud phone provider"><Input placeholder="GeeLark, etc." value={edit.cloud_phone_provider || ""} onChange={e => setEdit({ ...edit, cloud_phone_provider: e.target.value })} /></Field>
                  <Field label="Cloud phone ID"><Input value={edit.cloud_phone_id || ""} onChange={e => setEdit({ ...edit, cloud_phone_id: e.target.value })} /></Field>
                  <Field label="Proxy tipo"><Input placeholder="residencial / mobile" value={edit.proxy_tipo || ""} onChange={e => setEdit({ ...edit, proxy_tipo: e.target.value })} /></Field>
                  <Field label="Proxy geo"><Input placeholder="BR-SP" value={edit.proxy_geo || ""} onChange={e => setEdit({ ...edit, proxy_geo: e.target.value })} /></Field>
                  <Field label="Fingerprint ID"><Input value={edit.fingerprint_id || ""} onChange={e => setEdit({ ...edit, fingerprint_id: e.target.value })} /></Field>
                  <Field label="Preço-alvo (R$)"><Input type="number" value={edit.preco_alvo || ""} onChange={e => setEdit({ ...edit, preco_alvo: +e.target.value })} /></Field>
                  <Field label="Status de venda">
                    <Select value={edit.status_venda || "mantida"} onValueChange={v => setEdit({ ...edit, status_venda: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUS_VENDA.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Marketplace"><Input value={edit.marketplace || ""} onChange={e => setEdit({ ...edit, marketplace: e.target.value })} /></Field>
                  <Field label="Comprador"><Input value={edit.comprador || ""} onChange={e => setEdit({ ...edit, comprador: e.target.value })} /></Field>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Sinais de risco</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {RISCO_OPTIONS.map(r => {
                      const active = (edit.sinais_risco || []).includes(r);
                      return (
                        <button key={r} type="button" onClick={() => toggleRisco(r)}
                          className={`text-[11px] px-2 py-1 rounded border transition ${active ? "bg-red-500/20 border-red-500/50 text-red-300" : "bg-secondary/40 border-border/50 text-muted-foreground hover:border-border"}`}>
                          {active ? "⚠ " : ""}{r.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ icon, label, value, suffix }: any) {
  return (
    <Card><CardContent className="p-3 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-display">{value}{suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}</div>
      </div>
    </CardContent></Card>
  );
}

function Field({ label, children }: any) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
