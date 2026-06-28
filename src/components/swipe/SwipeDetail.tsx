import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, FlaskConical, Wand2, Copy, Sparkles, Image as ImageIcon, ExternalLink, FileText, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function getEmbedUrl(url: string): { type: "yt" | "vimeo" | "mp4" | "other"; src: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // YouTube
    const ytId = u.hostname.includes("youtu.be")
      ? u.pathname.slice(1)
      : u.searchParams.get("v");
    if ((u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) && ytId) {
      return { type: "yt", src: `https://www.youtube.com/embed/${ytId}` };
    }
    // Vimeo
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return { type: "vimeo", src: `https://player.vimeo.com/video/${id}` };
    }
    if (/\.(mp4|webm|mov)$/i.test(u.pathname)) {
      return { type: "mp4", src: url };
    }
    return { type: "other", src: url };
  } catch {
    return null;
  }
}

const SHORT_BLOCKS = [
  { key: "gancho", label: "🎯 Gancho" },
  { key: "participacao_ativa", label: "👋 Participação ativa" },
  { key: "narrativa", label: "📖 Narrativa" },
  { key: "reframe", label: "🔄 Reframe" },
  { key: "cta_engajamento", label: "💬 CTA Engajamento" },
  { key: "cta_venda", label: "💰 CTA Venda" },
];

const VSL7_BLOCKS = [
  { key: "b1_gancho", label: "1. 🎯 Gancho & Interrupção", hint: "0:00–1:30 · promessa chocante, qualifica avatar" },
  { key: "b2_agitacao", label: "2. 🔥 Agitação do Problema", hint: "1:30–4:00 · sintoma → causa raiz → custo de não resolver" },
  { key: "b3_origem", label: "3. 📖 História de Origem & Epifania", hint: "4:00–8:30 · antes / crise / busca / descoberta / transformação" },
  { key: "b4_mecanismo", label: "4. 🧬 Mecanismo Único", hint: "8:30–11:00 · nome + analogia + pilares + por que concorrência falha" },
  { key: "b5_oferta", label: "5. 💎 Revelação da Oferta", hint: "11:00–14:00 · escada de ancoragem (valor / custo / mercado / preço)" },
  { key: "b6_value_stack", label: "6. 🎁 Value Stack & Bônus", hint: "14:00–17:00 · cada bônus mata uma objeção" },
  { key: "b7_garantia_cta", label: "7. 🛡️ Garantia & CTA Final", hint: "17:00–19:30 · risco invertido + urgência" },
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
  const [transcribing, setTranscribing] = useState(false);
  const [nVar, setNVar] = useState(5);
  const [briefing, setBriefing] = useState("");
  const [linkedBatches, setLinkedBatches] = useState<any[]>([]);

  useEffect(() => setData(swipe), [swipe?.id]);

  const isVsl = data?.formato === "vsl" || data?.formato === "VSL" || data?.blocks?.__schema === "vsl7";
  const BLOCK_KEYS = isVsl ? VSL7_BLOCKS : SHORT_BLOCKS;
  const videoUrl = data?.media_urls?.[0];

  const embed = useMemo(() => (videoUrl ? getEmbedUrl(videoUrl) : null), [videoUrl]);

  // Carrega criativos atrelados (batches cujo source_swipe_ids contém este swipe)
  useEffect(() => {
    if (!data?.id || data?.__new) return;
    supabase
      .from("imphq_creative_batches")
      .select("id, nome, status, total_gerado, created_at")
      .contains("source_swipe_ids", [data.id])
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => setLinkedBatches(rows || []));
  }, [data?.id]);

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
    const txt = BLOCK_KEYS.map((b: any) => `## ${b.label}\n${data.blocks?.[b.key] || ""}`).join("\n\n");
    navigator.clipboard.writeText(`# ${data.title}\n\n${txt}`);
    toast.success("Copiado");
  };

  const generateVslFromMotor = async () => {
    if (data.__new) return toast.error("Salve a swipe primeiro");
    setGenerating(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("swipe-generate", {
        body: { mode: "vsl_from_swipe", swipe_id: data.id, target_project_id: data.project_id, target_produto_id: data.produto_id, briefing },
      });
      if (error) throw error;
      toast.success(`VSL gerada: "${res.swipe?.title}"`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };


  const re = data.reverse_engineering || {};

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent className="bg-background w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-primary flex items-center gap-2">
            {isVsl && <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400">VSL</Badge>}
            {data.__new ? "Nova copy" : data.title}
          </SheetTitle>
        </SheetHeader>

        {/* Player VSL */}
        {isVsl && embed && (
          <div className="mt-3 rounded-lg overflow-hidden bg-black/60 border border-border/40">
            {embed.type === "mp4" ? (
              <video src={embed.src} controls className="w-full aspect-video" />
            ) : embed.type === "yt" || embed.type === "vimeo" ? (
              <iframe
                src={embed.src}
                className="w-full aspect-video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <a href={embed.src} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-xs text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> Abrir vídeo: {embed.src}
              </a>
            )}
          </div>
        )}

        <Tabs defaultValue="anatomia" className="mt-4">
          <TabsList className={`grid w-full ${isVsl ? "grid-cols-4" : "grid-cols-3"}`}>
            <TabsTrigger value="anatomia" className="text-xs">Anatomia</TabsTrigger>
            <TabsTrigger value="reverse" className="text-xs gap-1"><FlaskConical className="h-3 w-3" /> Eng. Reversa</TabsTrigger>
            <TabsTrigger value="motor" className="text-xs gap-1"><Wand2 className="h-3 w-3" /> Motor</TabsTrigger>
            {isVsl && <TabsTrigger value="criativos" className="text-xs gap-1"><ImageIcon className="h-3 w-3" /> Criativos</TabsTrigger>}
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
              {isVsl && (
                <p className="text-[10px] uppercase tracking-wider text-amber-400/80">
                  Estrutura VSL em 7 blocos · 19m30s
                </p>
              )}
              {BLOCK_KEYS.map((b: any) => (
                <div key={b.key}>
                  <Label className="text-xs">{b.label}</Label>
                  {b.hint && <p className="text-[10px] text-muted-foreground mb-1">{b.hint}</p>}
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
            {isVsl && (
              <>
                <div className="border-t border-border/40 pt-3 mt-3" />
                <Button onClick={generateVslFromMotor} disabled={generating} className="w-full gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  ⚡ Gerar nova VSL com este motor (7 blocos)
                </Button>
                <p className="text-[10px] text-muted-foreground leading-6">
                  Usa esta VSL como esqueleto + produto/avatar do projeto atual para escrever uma VSL nova adaptada.
                </p>
              </>
            )}

            <p className="text-[10px] text-muted-foreground leading-6">
              <strong>Variações</strong>: cria N novas copys adaptadas mantendo a estrutura.<br />
              <strong>Extrair fórmula</strong>: salva o esqueleto numa biblioteca de templates.
            </p>
          </TabsContent>

          {isVsl && (
            <TabsContent value="criativos" className="space-y-3 mt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {linkedBatches.length} lote(s) de criativos inspirados nesta VSL
                </p>
                <Button asChild size="sm" className="gap-1">
                  <Link to={`/criativos/novo?source_swipe=${data.id}`}>
                    <Sparkles className="h-3 w-3" /> Gerar criativos desta VSL
                  </Link>
                </Button>
              </div>
              {linkedBatches.length === 0 ? (
                <p className="text-xs italic text-muted-foreground py-6 text-center">
                  Nenhum criativo atrelado ainda. Clique acima para gerar o primeiro lote.
                </p>
              ) : (
                <div className="space-y-2">
                  {linkedBatches.map((b) => (
                    <Link key={b.id} to={`/criativos/${b.id}`} className="block p-2 rounded border border-border/40 hover:bg-secondary/40 transition">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{b.nome}</span>
                        <Badge variant="outline" className="text-[9px]">{b.status}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {b.total_gerado} criativos · {new Date(b.created_at).toLocaleDateString()}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
