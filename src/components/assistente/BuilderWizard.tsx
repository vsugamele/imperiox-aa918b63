import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Check, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";



type Tipo = "campanha" | "lancamento" | "nutricao";
interface Props {
  open: boolean;
  onClose: () => void;
  tipo: Tipo;
  projectId: string;
  produto?: string;
  onDone?: () => void;
}

const TITULOS: Record<Tipo, string> = {
  campanha: "Construir Campanha WhatsApp com IA",
  lancamento: "Construir Plano de Lançamento com IA",
  nutricao: "Construir Sequência de Nutrição com IA",
};

export function BuilderWizard({ open, onClose, tipo, projectId, produto, onDone }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [briefing, setBriefing] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [count, setCount] = useState(tipo === "nutricao" ? 12 : 7);
  const [prazoDias, setPrazoDias] = useState(30);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  const reset = () => { setStep(1); setBriefing(""); setObjetivo(""); setPreview(null); };
  const close = () => { reset(); onClose(); };

  // Auto-preencher briefing com contexto do projeto ao abrir
  useEffect(() => {
    if (!open || !projectId || briefing.trim()) return;
    (async () => {
      setAutoLoading(true);
      try {
        const { data: proj } = await supabase.from("imphq_projects").select("name,data").eq("id", projectId).maybeSingle();
        if (!proj) return;

        const d: any = (proj as any).data || {};
        const avatar = d.avatar || d.avatars_por_produto || null;
        const branding = d.branding || d.brand || null;
        const produtos: any[] = Array.isArray(d.produtos) ? d.produtos : [];
        const prod = produto ? produtos.find(p => p.nome === produto || p.slug === produto) : produtos[0];

        const parts: string[] = [];
        parts.push(`Projeto: ${(proj as any).name || ""}`);
        if (prod?.nome) parts.push(`Produto: ${prod.nome}${prod.preco_por || prod.preco ? ` (R$ ${prod.preco_por || prod.preco})` : ""}`);
        if (prod?.promessa || prod?.descricao) parts.push(`Promessa: ${prod.promessa || prod.descricao}`);
        if (avatar) {
          const av = typeof avatar === "string" ? avatar : (avatar?.descricao || avatar?.resumo || JSON.stringify(avatar).slice(0, 400));
          parts.push(`Avatar: ${av}`);
        }
        if (branding) {
          const tom = typeof branding === "string" ? branding : (branding?.tom_voz || branding?.tom || branding?.voz || "");
          if (tom) parts.push(`Tom de voz: ${tom}`);
        }
        setBriefing(parts.join("\n"));
      } catch { /* silent */ }
      finally { setAutoLoading(false); }
    })();
  }, [open, projectId, produto]);



  const gerar = async () => {
    setLoading(true);
    try {
      if (tipo === "lancamento") {
        const { data, error } = await supabase.functions.invoke("lancamento-ai-generate", {
          body: { project_id: projectId, produto, objetivo, prazo_dias: prazoDias, briefing, apply: false },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        setPreview(data.plano);
      } else if (tipo === "nutricao") {
        // gera direto (cria sequência rascunho + e-mails). Sem preview porque já vai pro banco.
        const { data, error } = await supabase.functions.invoke("nurture-ai-generate", {
          body: { project_id: projectId, produto_nome: produto || "Produto", objetivo, count, briefing },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        toast.success(`✨ ${data.inserted} e-mails gerados (sequência rascunho criada)`);
        onDone?.(); close(); return;
      } else {
        // campanha — direciona pro CampaignAIGenerateDialog existente via toast/instrução
        toast.info("Abra a campanha desejada em WhatsApp e use 'Gerar sequência com IA'.");
        close(); return;
      }
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Falha na geração");
    } finally { setLoading(false); }
  };

  const aplicarLancamento = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("lancamento-ai-generate", {
        body: { project_id: projectId, produto, objetivo, prazo_dias: prazoDias, briefing, apply: true },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`✅ Plano aplicado: ${data.cards} cards criados no Kanban`);
      onDone?.(); close();
    } catch (e: any) {
      toast.error(e.message || "Falha ao aplicar");
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-secondary/40 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> {TITULOS[tipo]}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Objetivo</Label>
              <Input value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
                placeholder={tipo === "lancamento" ? "Ex: lançar curso X em 30 dias com R$ 50k" : "Ex: converter leads em compradores em 1 ano"} />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1.5">
                Briefing detalhado (opcional, mas recomendado)
                {autoLoading && <Loader2 className="h-3 w-3 animate-spin text-gold" />}
                {!autoLoading && briefing && <span className="text-[10px] text-gold flex items-center gap-1"><Wand2 className="h-2.5 w-2.5" /> pré-preenchido do projeto</span>}
              </Label>

              <Textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} rows={5}
                placeholder="Tom de voz, dores principais, oferta, bônus, urgência, restrições..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {tipo === "nutricao" && (
                <div>
                  <Label className="text-xs">Qtd. de e-mails</Label>
                  <Input type="number" min={3} max={60} value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 12)} />
                </div>
              )}
              {tipo === "lancamento" && (
                <div>
                  <Label className="text-xs">Prazo (dias)</Label>
                  <Input type="number" min={7} max={120} value={prazoDias}
                    onChange={(e) => setPrazoDias(parseInt(e.target.value) || 30)} />
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-6">
              A IA usa avatar, branding e produto do projeto como contexto automaticamente.
            </p>
          </div>
        )}

        {step === 3 && preview && (
          <div className="space-y-3 text-sm leading-7">
            <p className="text-muted-foreground italic">{preview.resumo}</p>
            {(preview.fases || []).map((f: any, i: number) => (
              <div key={i} className="rounded border border-border/50 p-3 bg-secondary/20">
                <p className="font-medium">{f.nome} <span className="text-xs text-muted-foreground">· dias {f.dias?.join("–") || "?"}</span></p>
                <p className="text-xs text-muted-foreground mt-1">{f.objetivo}</p>
                <ul className="mt-2 space-y-1">
                  {(f.acoes || []).map((a: any, j: number) => (
                    <li key={j} className="text-xs flex gap-2">
                      <span className="text-gold">D{a.dia}</span>
                      <span className="text-muted-foreground">[{a.tipo}]</span>
                      <span>{a.titulo}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button onClick={gerar} disabled={loading}>
                {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Gerando...</> : <><Sparkles className="h-3.5 w-3.5 mr-1" /> Gerar com IA</>}
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={close}>Descartar</Button>
              <Button onClick={aplicarLancamento} disabled={loading}>
                {loading ? <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Aplicando...</> : <><Check className="h-3.5 w-3.5 mr-1" /> Aplicar no Kanban</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
