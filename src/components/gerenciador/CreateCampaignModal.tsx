import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ArrowRight, Rocket, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string;
  onCreated?: () => void;
}

const OBJECTIVES = [
  { value: "OUTCOME_SALES", label: "Vendas (conversões)" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
];

const CTAS = [
  "SHOP_NOW", "LEARN_MORE", "SIGN_UP", "SUBSCRIBE", "GET_OFFER",
  "DOWNLOAD", "BOOK_TRAVEL", "CONTACT_US", "APPLY_NOW", "WATCH_MORE",
];

export function CreateCampaignModal({ open, onOpenChange, defaultProjectId, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [adAccounts, setAdAccounts] = useState<{ ad_account_id: string; nome: string }[]>([]);

  // Form state
  const [projectId, setProjectId] = useState<string>(defaultProjectId || "");
  const [adAccountId, setAdAccountId] = useState<string>("");
  const [pageId, setPageId] = useState<string>("");

  const [campName, setCampName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_SALES");

  const [adsetName, setAdsetName] = useState("");
  const [budget, setBudget] = useState<string>("50");
  const [ageMin, setAgeMin] = useState<string>("18");
  const [ageMax, setAgeMax] = useState<string>("65");
  const [gender, setGender] = useState<string>("all");
  const [country, setCountry] = useState<string>("BR");

  const [creativeName, setCreativeName] = useState("");
  const [message, setMessage] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [cta, setCta] = useState("SHOP_NOW");

  useEffect(() => {
    if (!open) return;
    setStep(1);
    (async () => {
      const { data } = await supabase.from("imphq_projects").select("id, name").order("name");
      setProjects(data || []);
      if (!projectId && defaultProjectId) setProjectId(defaultProjectId);
    })();
  }, [open]);

  useEffect(() => {
    if (!projectId) { setAdAccounts([]); return; }
    (async () => {
      const { data } = await supabase
        .from("imphq_ad_accounts")
        .select("ad_account_id, nome")
        .eq("plataforma", "Facebook");
      setAdAccounts(data || []);
    })();
  }, [projectId]);

  const canStep1 = useMemo(
    () => projectId && adAccountId && pageId.trim() && campName.trim() && objective,
    [projectId, adAccountId, pageId, campName, objective]
  );
  const canStep2 = useMemo(
    () => adsetName.trim() && Number(budget) > 0 && Number(ageMin) >= 13 && Number(ageMax) <= 65,
    [adsetName, budget, ageMin, ageMax]
  );
  const canSubmit = useMemo(
    () => creativeName.trim() && message.trim() && link.trim() && imageUrl.trim(),
    [creativeName, message, link, imageUrl]
  );

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const genders =
        gender === "male" ? [1] :
        gender === "female" ? [2] : [1, 2];

      const { data, error } = await supabase.functions.invoke("facebook-ads-create", {
        body: {
          project_id: projectId,
          ad_account_id: adAccountId,
          page_id: pageId.trim(),
          campaign: { name: campName.trim(), objective },
          adset: {
            name: adsetName.trim(),
            daily_budget_brl: Number(budget),
            targeting: {
              age_min: Number(ageMin),
              age_max: Number(ageMax),
              genders,
              geo_countries: [country.trim().toUpperCase()],
            },
          },
          creative: {
            name: creativeName.trim(),
            message: message.trim(),
            headline: headline.trim() || undefined,
            description: description.trim() || undefined,
            link: link.trim(),
            image_url: imageUrl.trim(),
            call_to_action: cta,
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Campanha criada em PAUSA. Revise no Meta antes de ativar.");
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar campanha");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            Nova Campanha Meta
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs mb-2">
          {["Campanha", "Conjunto", "Criativo"].map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] border",
                  active && "border-primary bg-primary/10 text-primary",
                  done && "border-primary bg-primary text-primary-foreground",
                  !active && !done && "border-border text-muted-foreground"
                )}>
                  {done ? <Check className="h-3 w-3" /> : n}
                </div>
                <span className={cn(active && "text-foreground", !active && "text-muted-foreground")}>{label}</span>
                {n < 3 && <div className="w-6 h-px bg-border mx-1" />}
              </div>
            );
          })}
        </div>

        <div className="space-y-4 leading-7">
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Projeto</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Conta de anúncios</Label>
                  <Select value={adAccountId} onValueChange={setAdAccountId} disabled={!adAccounts.length}>
                    <SelectTrigger><SelectValue placeholder={adAccounts.length ? "Selecione" : "Nenhuma conta conectada"} /></SelectTrigger>
                    <SelectContent>
                      {adAccounts.map(a => <SelectItem key={a.ad_account_id} value={a.ad_account_id}>{a.nome || a.ad_account_id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">ID da Página Facebook</Label>
                <Input value={pageId} onChange={e => setPageId(e.target.value)} placeholder="ex: 1234567890" />
                <p className="text-[10px] text-muted-foreground mt-1">Necessário para vincular o criativo.</p>
              </div>
              <div>
                <Label className="text-xs">Nome da campanha</Label>
                <Input value={campName} onChange={e => setCampName(e.target.value)} placeholder="ex: [PROD] Black Friday — Conversão" />
              </div>
              <div>
                <Label className="text-xs">Objetivo</Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBJECTIVES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label className="text-xs">Nome do conjunto</Label>
                <Input value={adsetName} onChange={e => setAdsetName(e.target.value)} placeholder="ex: ABO | Aberto | BR 25-45" />
              </div>
              <div>
                <Label className="text-xs">Orçamento diário (R$)</Label>
                <Input type="number" value={budget} onChange={e => setBudget(e.target.value)} min={1} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Idade mín.</Label>
                  <Input type="number" value={ageMin} onChange={e => setAgeMin(e.target.value)} min={13} max={65} />
                </div>
                <div>
                  <Label className="text-xs">Idade máx.</Label>
                  <Input type="number" value={ageMax} onChange={e => setAgeMax(e.target.value)} min={13} max={65} />
                </div>
                <div>
                  <Label className="text-xs">Gênero</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="male">Masculino</SelectItem>
                      <SelectItem value="female">Feminino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">País (código ISO)</Label>
                <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="BR" maxLength={2} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <Label className="text-xs">Nome do anúncio</Label>
                <Input value={creativeName} onChange={e => setCreativeName(e.target.value)} placeholder="ex: Criativo V1 — Promessa A" />
              </div>
              <div>
                <Label className="text-xs">Texto principal</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Copy do post…" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="(opcional)" />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="(opcional)" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Link de destino</Label>
                <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://…" />
              </div>
              <div>
                <Label className="text-xs">URL da imagem</Label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…/imagem.jpg" />
                <p className="text-[10px] text-muted-foreground mt-1">Será enviada para o Meta automaticamente.</p>
              </div>
              <div>
                <Label className="text-xs">Botão (CTA)</Label>
                <Select value={cta} onValueChange={setCta}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CTAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground border border-border/40 rounded p-2">
                ⚠️ A campanha será criada <strong>EM PAUSA</strong>. Revise no Gerenciador de Anúncios do Meta antes de ativar.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || submitting}>
            <ArrowLeft className="h-3 w-3 mr-1" /> Voltar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={(step === 1 && !canStep1) || (step === 2 && !canStep2)}
            >
              Avançar <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canSubmit || submitting}>
              {submitting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Rocket className="h-3 w-3 mr-1" />}
              Criar em pausa
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
