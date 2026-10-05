import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pencil, CreditCard, RefreshCw, Building2, AlertTriangle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { accountHealth, type AdAccountHealth } from "@/lib/ad-account-health";

type AdAccount = Tables<"imphq_ad_accounts">;

const STATUS_OPTIONS = ["ativo", "pausado", "banido", "desativado"];
const TIER_OPTIONS = ["TIER_1", "TIER_2", "TIER_3"];
const TIER_STYLE: Record<string, string> = {
  TIER_1: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  TIER_2: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  TIER_3: "bg-red-500/15 text-red-400 border-red-500/30",
};
const TIER_RANK: Record<string, number> = { TIER_1: 1, TIER_2: 2, TIER_3: 3 };

type Health = AdAccountHealth;

const HEALTH_STYLE: Record<Health["tone"], string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  fail: "bg-red-500/15 text-red-400 border-red-500/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

const emptyForm = { bm_id: "", bm_nome: "", ad_account_id: "", nome: "", plataforma: "Facebook", status: "ativo", trust_tier: "", project_id: "", produto_funil: "", notas: "" };

export function AdAccountsTab() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<AdAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [checking, setChecking] = useState(false);
  const [onlyUsable, setOnlyUsable] = useState(false);

  const load = async () => {
    const [{ data }, { data: projs }] = await Promise.all([
      supabase.from("imphq_ad_accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("imphq_projects").select("id, name").order("name"),
    ]);
    setAccounts((data || []) as AdAccount[]);
    setProjects((projs || []) as { id: string; name: string }[]);
  };

  useEffect(() => { load(); }, []);

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name || id || null;

  const groups = useMemo(() => {
    const list = onlyUsable ? accounts.filter((a) => accountHealth(a).tone === "ok" || accountHealth(a).tone === "warn") : accounts;
    const map = new Map<string, AdAccount[]>();
    for (const a of list) {
      const k = a.bm_nome || a.bm_id || "Sem BM";
      map.set(k, [...(map.get(k) || []), a]);
    }
    return [...map.entries()]
      .map(([bm, accs]) => {
        const best = Math.min(...accs.map((a) => TIER_RANK[a.trust_tier || ""] || 9));
        return { bm, bmId: accs.find((a) => a.bm_id)?.bm_id || "", accs: accs.sort((x, y) => (TIER_RANK[x.trust_tier || ""] || 9) - (TIER_RANK[y.trust_tier || ""] || 9)), best };
      })
      .sort((a, b) => a.best - b.best || a.bm.localeCompare(b.bm));
  }, [accounts, onlyUsable]);

  // Recomendações: projeto rodando em conta de tier pior que uma TIER_1 ativa e livre; TIER_1 sem pagamento.
  const insights = useMemo(() => {
    const out: string[] = [];
    const freeTier1 = accounts.filter((a) => a.trust_tier === "TIER_1" && accountHealth(a).tone === "ok" && !a.project_id);
    for (const a of accounts) {
      if (a.project_id && a.trust_tier && a.trust_tier !== "TIER_1" && freeTier1.length) {
        out.push(`${projectName(a.project_id)} roda em "${a.nome}" (${a.trust_tier.replace("_", " ")}). Há ${freeTier1.length} conta(s) TIER 1 ativas e livres: ${freeTier1.map((f) => f.nome).join(", ")}.`);
      }
    }
    const tier1NoPay = accounts.filter((a) => a.trust_tier === "TIER_1" && a.meta_billing_status === "missing");
    if (tier1NoPay.length) out.push(`TIER 1 sem forma de pagamento: ${tier1NoPay.map((a) => a.nome).join(", ")}.`);
    const dead = accounts.filter((a) => accountHealth(a).tone === "fail");
    if (dead.length) out.push(`${dead.length} conta(s) desativadas/bloqueadas: ${dead.map((a) => a.nome).join(", ")}. Considere marcar como "banido".`);
    return out;
  }, [accounts, projects]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastCheck = accounts.map((a) => a.ultima_checagem).filter(Boolean).sort().pop();

  const checkNow = async () => {
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("zernio-ad-accounts-sync", { body: {} });
    setChecking(false);
    if (error || data?.error) { toast.error(`Falha ao checar: ${error?.message || data?.error}`); return; }
    const extra = Array.isArray(data?.uncatalogued_active) ? data.uncatalogued_active.length : 0;
    toast.success(`${data?.updated ?? 0} conta(s) atualizadas pela Zernio${extra ? ` · ${extra} conta(s) ativas ainda fora do inventário` : ""}`);
    load();
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setShowDialog(true); };

  const openEdit = (acc: AdAccount) => {
    setEditing(acc);
    setForm({
      bm_id: acc.bm_id, bm_nome: acc.bm_nome || "", ad_account_id: acc.ad_account_id, nome: acc.nome,
      plataforma: acc.plataforma || "Facebook", status: acc.status || "ativo", trust_tier: acc.trust_tier || "",
      project_id: acc.project_id || "", produto_funil: acc.produto_funil || "", notas: acc.notas || "",
    });
    setShowDialog(true);
  };

  const save = async () => {
    if (!form.ad_account_id.trim() || !form.nome.trim()) {
      toast.error("Preencha Ad Account ID e Nome");
      return;
    }
    const payload = {
      bm_id: form.bm_id.trim(),
      bm_nome: form.bm_nome.trim() || null,
      ad_account_id: form.ad_account_id.trim().replace(/^act_/, ""),
      nome: form.nome.trim(),
      plataforma: form.plataforma,
      status: form.status,
      trust_tier: form.trust_tier || null,
      project_id: form.project_id || null,
      produto_funil: form.produto_funil.trim() || null,
      notas: form.notas || null,
    };
    if (editing) {
      const { error } = await supabase.from("imphq_ad_accounts").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Conta atualizada!");
    } else {
      if (!user?.id) { toast.error("Faça login novamente"); return; }
      const { error } = await supabase.from("imphq_ad_accounts").insert({ ...payload, user_id: user.id });
      if (error) { toast.error(error.message); return; }
      toast.success("Conta adicionada!");
    }
    setShowDialog(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover esta conta do inventário?")) return;
    await supabase.from("imphq_ad_accounts").delete().eq("id", id);
    toast.success("Conta removida");
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <p className="text-xs text-muted-foreground">
          BMs e contas de anúncio, com tier de confiança e saúde real na Meta (via Zernio).
          {lastCheck && <> Última checagem: {new Date(lastCheck).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.</>}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant={onlyUsable ? "secondary" : "ghost"} onClick={() => setOnlyUsable((v) => !v)}>
            {onlyUsable ? "Mostrando só utilizáveis" : "Só utilizáveis"}
          </Button>
          <Button size="sm" variant="outline" onClick={checkNow} disabled={checking}>
            <RefreshCw className={`h-4 w-4 mr-1 ${checking ? "animate-spin" : ""}`} /> Checar agora
          </Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Conta</Button>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
          {insights.map((t, i) => (
            <p key={i} className="text-xs text-foreground/90 flex gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />{t}</p>
          ))}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhuma conta de anúncios cadastrada</p>
          <p className="text-xs">Adicione suas BMs e Ad Accounts para organizar a operação</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.bm} className="rounded-lg border border-border bg-card/40">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium text-sm truncate">{g.bm}</span>
                  {g.bmId && <span className="text-[10px] font-mono text-muted-foreground truncate">{g.bmId}</span>}
                </div>
                {g.best === 1 && <Badge variant="outline" className={`text-[9px] ${TIER_STYLE.TIER_1}`}><ShieldCheck className="h-3 w-3 mr-0.5" />BM confiável</Badge>}
              </div>
              <ul className="divide-y divide-border/40">
                {g.accs.map((a) => {
                  const h = accountHealth(a);
                  return (
                    <li key={a.id} className="group px-3 py-2 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-medium truncate">{a.nome}</span>
                          {a.trust_tier && <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${TIER_STYLE[a.trust_tier] || ""}`}>{a.trust_tier.replace("_", " ")}</Badge>}
                          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${HEALTH_STYLE[h.tone]}`} title={h.detail}>{h.label}</Badge>
                          {a.project_id && <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{projectName(a.project_id)}</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono flex gap-2 flex-wrap mt-0.5">
                          <span>act_{a.ad_account_id.replace(/^act_/, "")}</span>
                          {a.ads_total != null && <span>{a.ads_ativos ?? 0} anúncio(s) ativo(s) / {a.ads_total}</span>}
                          {a.meta_funding && <span>{a.meta_funding}</span>}
                          {a.produto_funil && <span>· {a.produto_funil}</span>}
                        </div>
                        {a.notas && a.notas !== "import:planilha_v2" && <p className="text-[10px] text-muted-foreground truncate">{a.notas}</p>}
                      </div>
                      <div className="flex gap-0.5 opacity-60 group-hover:opacity-100">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(a.id)} aria-label="Remover"><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Adicionar"} conta de anúncio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: JP6" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Ad Account ID *</Label><Input value={form.ad_account_id} onChange={e => setForm({ ...form, ad_account_id: e.target.value })} placeholder="Ex: 1042156903760731" className="font-mono" /></div>
              <div>
                <Label>Tier de confiança</Label>
                <Select value={form.trust_tier || "none"} onValueChange={v => setForm({ ...form, trust_tier: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem tier</SelectItem>
                    {TIER_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome da BM</Label><Input value={form.bm_nome} onChange={e => setForm({ ...form, bm_nome: e.target.value })} placeholder="Ex: JP6 Studio" /></div>
              <div><Label>BM ID</Label><Input value={form.bm_id} onChange={e => setForm({ ...form, bm_id: e.target.value })} placeholder="preenchido pela Zernio" className="font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projeto</Label>
                <Select value={form.project_id || "none"} onValueChange={v => setForm({ ...form, project_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Livre (sem projeto)</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Produto/Funil</Label><Input value={form.produto_funil} onChange={e => setForm({ ...form, produto_funil: e.target.value })} placeholder="Ex: Corte Perfeito" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plataforma</Label>
                <Select value={form.plataforma} onValueChange={v => setForm({ ...form, plataforma: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="TikTok">TikTok</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status interno</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Textarea value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Limite diário, histórico de bloqueio, quem é o dono..." className="min-h-[60px]" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Atualizar" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
