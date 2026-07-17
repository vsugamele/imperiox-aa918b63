import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check, Save, Sparkles, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { ROTEIRO_TEMPLATES, type RoteiroTemplate } from "@/data/studio/roteiroTemplates";
import { useProjectList } from "@/hooks/useProjectList";
import { useCreativeContext } from "@/hooks/useCreativeContext";
import { supabase } from "@/integrations/supabase/client";

const CATEGORIA_COLORS: Record<string, string> = {
  VSL: "text-rose-300 border-rose-700/40",
  Reels: "text-pink-300 border-pink-700/40",
  UGC: "text-emerald-300 border-emerald-700/40",
  Ads: "text-amber-300 border-amber-700/40",
  Story: "text-sky-300 border-sky-700/40",
};

export function RoteirosTab() {
  const [templateId, setTemplateId] = useState<string>(ROTEIRO_TEMPLATES[0].id);
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [productName, setProductName] = useState<string>("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refined, setRefined] = useState<string>("");

  const { data: projects = [] } = useProjectList();
  const ctx = useCreativeContext(projectId);

  const template = useMemo<RoteiroTemplate>(
    () => ROTEIRO_TEMPLATES.find((t) => t.id === templateId) || ROTEIRO_TEMPLATES[0],
    [templateId],
  );

  const prompt = useMemo(
    () => template.build(values, { avatar: ctx.avatar, branding: ctx.branding, produto: productName }),
    [template, values, ctx.avatar, ctx.branding, productName],
  );

  const output = refined || prompt;

  const setVal = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    setValues({});
    setRefined("");
  };

  const copy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Prompt copiado — cole no ChatGPT/Claude/Cofre");
    setTimeout(() => setCopied(false), 1500);
  };

  const refinar = async () => {
    if (refining) return;
    setRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke("prompt-refiner", {
        body: { prompt, mode: "editorial" },
      });
      if (error) throw error;
      const r = (data as any)?.refined || (data as any)?.prompt;
      if (!r) throw new Error("Refinador não retornou texto");
      setRefined(r);
      toast.success("Refinado pela IA");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao refinar");
    } finally {
      setRefining(false);
    }
  };

  const salvarCofre = async () => {
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const nome = `${template.emoji} ${template.nome}${productName ? ` — ${productName}` : ""}`;
      const { error } = await supabase.from("imphq_prompts_salvos").insert({
        user_id: u.user?.id,
        nome,
        plataforma: "roteiro",
        prompt_text: output,
        campos: { __type: "roteiro", templateId, values, projectId, productName } as any,
        tags: ["roteiro", template.categoria.toLowerCase()],
      } as any);
      if (error) throw error;
      toast.success("Salvo no Cofre");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Sidebar templates */}
      <Card className="lg:col-span-3 p-4 bg-secondary/20 border-border/60 h-fit">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Templates
          </span>
        </div>
        <div className="space-y-1.5">
          {ROTEIRO_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => pickTemplate(t.id)}
              className={`w-full text-left rounded-md border px-3 py-2 transition ${
                t.id === templateId
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/40 bg-background/40 hover:border-border hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  <span className="mr-1.5">{t.emoji}</span>{t.nome}
                </span>
                <Badge variant="outline" className={`text-[9px] uppercase tracking-wider ${CATEGORIA_COLORS[t.categoria]}`}>
                  {t.categoria}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-4">{t.descricao}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Formulário */}
      <Card className="lg:col-span-5 p-5 bg-card/60 border-border/60 space-y-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/80 mb-1">
            · Contexto do Projeto
          </div>
          <h3 className="font-display text-xl leading-tight">
            {template.emoji} {template.nome}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{template.descricao}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Projeto</Label>
            <Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? undefined : v)}>
              <SelectTrigger className="h-9 text-[13px] bg-secondary/40 border-border/60">
                <SelectValue placeholder="Sem projeto" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="__none__">— Sem projeto —</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.icon} {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Produto</Label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="ex.: Arte da Cobertura"
              className="h-9 text-[13px] bg-secondary/40 border-border/60"
            />
          </div>
        </div>

        {projectId && (
          <div className="rounded-md border border-emerald-700/30 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-300 flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            {ctx.loading
              ? "Carregando avatar + branding…"
              : `Contexto injetado: ${ctx.avatar ? "avatar ✓" : "avatar —"} · ${ctx.branding ? "branding ✓" : "branding —"}`}
          </div>
        )}

        <div className="h-px bg-border/40" />

        <div className="space-y-3">
          {template.fields.map((f) => (
            <div key={f.key}>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {f.label} {f.required && <span className="text-amber-400">*</span>}
              </Label>
              {f.type === "textarea" ? (
                <Textarea
                  value={values[f.key] || ""}
                  onChange={(e) => setVal(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={3}
                  className="bg-secondary/40 border-border/60 text-[13px]"
                />
              ) : (
                <Input
                  value={values[f.key] || ""}
                  onChange={(e) => setVal(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="h-9 bg-secondary/40 border-border/60 text-[13px]"
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Output */}
      <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-4 self-start">
        <Card className="p-4 bg-card/60 border-border/60">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {refined ? "Prompt Refinado" : "Prompt Pronto"}
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">{output.length} chars</span>
          </div>
          <pre className="text-[11.5px] font-mono leading-5 text-foreground/90 whitespace-pre-wrap max-h-[520px] overflow-auto">
            {output}
          </pre>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button onClick={copy} variant="outline" className="w-full">
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            Copiar
          </Button>
          <Button onClick={refinar} disabled={refining} variant="outline" className="w-full">
            {refining ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            Refinar IA
          </Button>
        </div>
        <Button onClick={salvarCofre} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar no Cofre
        </Button>
        {refined && (
          <Button onClick={() => setRefined("")} variant="ghost" size="sm" className="w-full text-[11px]">
            Descartar refinamento
          </Button>
        )}
      </div>
    </div>
  );
}
