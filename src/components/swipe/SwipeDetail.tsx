import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, FlaskConical, Wand2, Copy, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BLOCK_KEYS = [
  { key: "gancho", label: "🎯 Gancho" },
  { key: "participacao_ativa", label: "👋 Participação ativa" },
  { key: "narrativa", label: "📖 Narrativa" },
  { key: "reframe", label: "🔄 Reframe" },
  { key: "cta_engajamento", label: "💬 CTA Engajamento" },
  { key: "cta_venda", label: "💰 CTA Venda" },
];

interface Props {
  swipe: any;
  onClose: () => void;
  onSaved: () => void;
}

export function SwipeDetail({ swipe, onClose, onSaved }: Props) {
  const [data, setData] = useState<any>(swipe);
  const [saving, setSaving] = useState(false);
  const [engineering, setEngineering] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [nVar, setNVar] = useState(5);
  const [briefing, setBriefing] = useState("");

  useEffect(() => setData(swipe), [swipe?.id]);

  const updateBlock = (k: string, v: string) => setData({ ...data, blocks: { ...(data.blocks || {}), [k]: v } });

  const save = async () => {
    setSaving(true);
    try {
      if (data.__new) {
        const { __new, ...payload } = data;
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from("imphq_swipes" as any).insert({ ...payload, user_id: u.user?.id } as any);
        if (error) throw error;
      } else {
        const { id, created_at, updated_at, user_id, ...payload } = data;
        const { error } = await supabase.from("imphq_swipes" as any).update(payload as any).eq("id", id);
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runEngineering = async () => {
    if (data.__new) return toast.error("Salve a swipe primeiro");
    setEngineering(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("swipe-engineer", { body: { swipe_id: data.id } });
      if (error) throw error;
      setData({ ...data, reverse_engineering: res.reverse_engineering });
      toast.success("Engenharia reversa pronta");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setEngineering(false);
    }
  };

  const generateVariations = async () => {
    if (data.__new) return toast.error("Salve a swipe primeiro");
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("swipe-generate", {
        body: { mode: "variations", swipe_id: data.id, n_variations: nVar, briefing },
      });
      if (error) throw error;
      toast.success(`${res.count} variações geradas!`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const extractTemplate = async () => {
    if (data.__new) return toast.error("Salve a swipe primeiro");
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("swipe-generate", {
        body: { mode: "extract_template", swipe_id: data.id },
      });
      if (error) throw error;
      toast.success(`Template "${res.template?.name}" criado`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyAll = () => {
    const txt = BLOCK_KEYS.map((b) => `## ${b.label}\n${data.blocks?.[b.key] || ""}`).join("\n\n");
    navigator.clipboard.writeText(`# ${data.title}\n\n${txt}`);
    toast.success("Copiado");
  };

  const re = data.reverse_engineering || {};

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="bg-background w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary">{data.__new ? "Nova copy" : data.title}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="anatomia" className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="anatomia" className="text-xs">Anatomia</TabsTrigger>
            <TabsTrigger value="reverse" className="text-xs gap-1"><FlaskConical className="h-3 w-3" /> Eng. Reversa</TabsTrigger>
            <TabsTrigger value="motor" className="text-xs gap-1"><Wand2 className="h-3 w-3" /> Motor</TabsTrigger>
          </TabsList>

          <TabsContent value="anatomia" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Título</Label>
                <Input value={data.title || ""} onChange={(e) => setData({ ...data, title: e.target.value })} className="bg-secondary h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px]">Criador</Label>
                <Input value={data.criador || ""} onChange={(e) => setData({ ...data, criador: e.target.value })} className="bg-secondary h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px]">Plataforma</Label>
                <Input value={data.plataforma || ""} onChange={(e) => setData({ ...data, plataforma: e.target.value })} className="bg-secondary h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px]">Formato</Label>
                <Input value={data.formato || ""} onChange={(e) => setData({ ...data, formato: e.target.value })} className="bg-secondary h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px]">Mecanismo</Label>
                <Input value={data.mecanismo || ""} onChange={(e) => setData({ ...data, mecanismo: e.target.value })} className="bg-secondary h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px]">Nicho</Label>
                <Input value={data.nicho || ""} onChange={(e) => setData({ ...data, nicho: e.target.value })} className="bg-secondary h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Tags (separadas por vírgula)</Label>
                <Input
                  value={(data.tags || []).join(", ")}
                  onChange={(e) => setData({ ...data, tags: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                  className="bg-secondary h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-[10px]">Gatilhos (separados por vírgula)</Label>
                <Input
                  value={(data.gatilhos || []).join(", ")}
                  onChange={(e) => setData({ ...data, gatilhos: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
                  className="bg-secondary h-8 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3 mt-2">
              {BLOCK_KEYS.map((b) => (
                <div key={b.key}>
                  <Label className="text-xs">{b.label}</Label>
                  <Textarea
                    value={data.blocks?.[b.key] || ""}
                    onChange={(e) => updateBlock(b.key, e.target.value)}
                    className="bg-secondary text-sm min-h-[80px] leading-7"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={save} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={copyAll}>
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="reverse" className="space-y-3 mt-3">
            <Button onClick={runEngineering} disabled={engineering} className="w-full gap-2">
              {engineering ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              {engineering ? "Analisando…" : (re.formula_nome ? "Re-analisar" : "Rodar engenharia reversa")}
            </Button>

            {re.formula_nome && (
              <div className="space-y-3 text-sm">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-primary">Fórmula</Label>
                  <p className="font-medium">{re.formula_nome}</p>
                </div>
                {re.gatilhos && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-primary">Gatilhos</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {re.gatilhos.map((g: string) => <Badge key={g} variant="outline">{g}</Badge>)}
                    </div>
                  </div>
                )}
                {re.publico_alvo && <div><Label className="text-[10px] uppercase text-primary">Público-alvo</Label><p className="text-xs leading-7">{re.publico_alvo}</p></div>}
                {re.tom_voz && <div><Label className="text-[10px] uppercase text-primary">Tom de voz</Label><p className="text-xs leading-7">{re.tom_voz}</p></div>}
                {re.ritmo && <div><Label className="text-[10px] uppercase text-primary">Ritmo</Label><p className="text-xs leading-7">{re.ritmo}</p></div>}
                {re.observacoes && <div><Label className="text-[10px] uppercase text-primary">Observações</Label><p className="text-xs leading-7">{re.observacoes}</p></div>}
                {re.esqueleto && (
                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-primary">Esqueleto reutilizável</Label>
                    <pre className="text-[11px] bg-secondary/60 rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap leading-6">
{Object.entries(re.esqueleto).map(([k, v]) => `▸ ${k}\n${v}`).join("\n\n")}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="motor" className="space-y-4 mt-3">
            <div className="space-y-2">
              <Label className="text-xs">Briefing extra (opcional)</Label>
              <Textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder="Para qual produto/avatar você quer adaptar? Qual a transformação?"
                className="bg-secondary text-sm min-h-[80px] leading-7"
              />
              <Label className="text-xs">Quantas variações</Label>
              <Input type="number" min={1} max={20} value={nVar} onChange={(e) => setNVar(parseInt(e.target.value) || 5)} className="bg-secondary h-8 text-sm w-24" />
            </div>
            <Button onClick={generateVariations} disabled={generating} className="w-full gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Gerar {nVar} variações
            </Button>
            <Button onClick={extractTemplate} disabled={generating} variant="outline" className="w-full gap-2">
              <FlaskConical className="h-4 w-4" /> Extrair fórmula reutilizável (template)
            </Button>
            <p className="text-[10px] text-muted-foreground leading-6">
              <strong>Variações</strong>: cria N novas copys adaptadas mantendo a estrutura.<br />
              <strong>Extrair fórmula</strong>: salva o esqueleto numa biblioteca de templates.
            </p>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
