import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Link2, Search, Sparkles } from "lucide-react";

type Template = "novo_mecanismo" | "clonar" | "extrair";

const TEMPLATES: { value: Template; label: string; desc: string }[] = [
  { value: "novo_mecanismo", label: "Criar novo mecanismo", desc: "Engenharia reversa + Breakthrough (Schwartz)" },
  { value: "clonar", label: "Clonar produto", desc: "Importa a oferta como está, sem reescrever" },
  { value: "extrair", label: "Apenas extrair (branding/copy)", desc: "Salva como referência, não cria produto" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  onImported: (produto: any) => Promise<void> | void;
}

export function ImportProductDialog({ open, onOpenChange, projectId, onImported }: Props) {
  const [url, setUrl] = useState("");
  const [template, setTemplate] = useState<Template>("novo_mecanismo");
  const [preview, setPreview] = useState<any>(null);
  const [produto, setProduto] = useState<any>(null);
  const [loading, setLoading] = useState<"analyze" | "generate" | null>(null);

  function reset() {
    setUrl(""); setPreview(null); setProduto(null); setTemplate("novo_mecanismo");
  }

  async function analyze() {
    if (!url.trim()) return toast.error("Cole a URL");
    setLoading("analyze"); setPreview(null); setProduto(null);
    try {
      const { data, error } = await supabase.functions.invoke("site-scrape", { body: { url } });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Falha");
      setPreview({ title: data.title, screenshot: data.screenshot, branding: data.branding, summary: data.summary });
      toast.success("Página analisada");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao analisar");
    } finally {
      setLoading(null);
    }
  }

  async function generate() {
    if (!url.trim()) return toast.error("Cole a URL");
    if (!projectId) return toast.error("Selecione um projeto");
    setLoading("generate");
    try {
      const { data, error } = await supabase.functions.invoke("funnel-import-product", {
        body: { url, template, project_id: projectId },
      });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Falha");
      setProduto(data.produto);
      if (!preview && data.scrape) setPreview(data.scrape);

      if (template !== "extrair") {
        await onImported(data.produto);
        toast.success(`Produto "${data.produto?.nome || "importado"}" criado`);
        reset();
        onOpenChange(false);
      } else {
        toast.success("Branding/copy extraídos.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Falha ao gerar");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-secondary/40 max-w-2xl">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <span className="text-[10px] uppercase tracking-wider px-3 py-1 rounded-full bg-muted/60 text-muted-foreground">
              Criação de produto
            </span>
          </div>
          <DialogTitle className="text-center text-2xl font-serif">Importar produto</DialogTitle>
          <DialogDescription className="text-center leading-7">
            Cole a URL da página do produto que deseja importar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Template de importação</Label>
            <Select value={template} onValueChange={(v) => setTemplate(v as Template)}>
              <SelectTrigger className="border-primary/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex flex-col">
                      <span>{t.label}</span>
                      <span className="text-[10px] text-muted-foreground">{t.desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>URL da página do produto <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemplo.com/produto"
                className="pl-9"
                autoFocus
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={analyze}
              disabled={loading !== null || !url.trim()}
              className="gap-2"
            >
              {loading === "analyze" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Analisar Página
            </Button>
          </div>

          {preview && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="flex gap-3">
                {preview.screenshot && (
                  <img src={preview.screenshot} alt="" className="w-24 h-24 object-cover rounded-md border border-border/40" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-semibold truncate">{preview.title}</p>
                  {preview.summary && <p className="text-xs text-muted-foreground line-clamp-3 leading-6">{preview.summary}</p>}
                  {preview.branding?.colors && (
                    <div className="flex gap-1 mt-2">
                      {Object.values(preview.branding.colors).slice(0, 5).map((c: any, i) => (
                        <span key={i} className="w-4 h-4 rounded-full border border-border/40" style={{ background: String(c) }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {produto && template === "extrair" && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
              <p className="text-xs text-emerald-300 font-semibold mb-1">{produto.nome}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-6">{produto.promessa}</p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 pt-2 border-t border-border/40">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading !== null}>
            ← Voltar
          </Button>
          <Button onClick={generate} disabled={loading !== null || !url.trim()} className="gap-2">
            {loading === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Gerar Produto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
