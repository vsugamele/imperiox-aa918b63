import { errorMessage } from "@/lib/error-message";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles, Globe } from "lucide-react";
import { ALL_TIPOS } from "@/pages/Sites";

export function AddSiteModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [tipo, setTipo] = useState("lp");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!url.trim()) return toast.error("Cole a URL do site");
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Faça login para adicionar sites");

      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

      let formattedGithub = githubUrl.trim();
      if (formattedGithub && !formattedGithub.startsWith("http")) formattedGithub = `https://${formattedGithub}`;

      // Screenshot imediato de alta disponibilidade via mshots
      const immediateScreenshot = `https://s0.wp.com/mshots/v1/${encodeURIComponent(formattedUrl)}?w=800`;

      toast.info("Analisando site e gerando preview visual…");

      // Tenta extrair branding e copy via edge function
      let scrapeData: any = null;
      try {
        const { data, error } = await supabase.functions.invoke("site-scrape", { body: { url: formattedUrl } });
        if (!error && data?.success) {
          scrapeData = data;
        }
      } catch (err) {
        console.warn("Aviso: Scrape automático falhou, aplicando fallback visual:", err);
      }

      const finalScreenshot = scrapeData?.screenshot || scrapeData?.branding?.images?.ogImage || immediateScreenshot;

      const { error: insErr } = await supabase.from("imphq_sites").insert({
        user_id: userData.user.id,
        titulo: scrapeData?.title || formattedUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
        url: formattedUrl,
        tipo,
        status: "ativo",
        thumbnail_url: finalScreenshot,
        branding_json: scrapeData?.branding || null,
        content_md: scrapeData?.markdown || null,
        summary: scrapeData?.summary || null,
        github_url: formattedGithub || null,
        last_scraped_at: new Date().toISOString(),
      });

      if (insErr) throw insErr;

      toast.success("Site adicionado com visual gerado!");
      setUrl("");
      setTipo("lp");
      setGithubUrl("");
      onOpenChange(false);
      onCreated();
    } catch (e: unknown) {
      toast.error(errorMessage(e) || "Falha ao adicionar site");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-white/10 text-slate-100 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Adicionar site ao acervo
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs leading-relaxed">
            Cole a URL. O Imperius vai capturar o screenshot, paleta de cores, tipografia e copy automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300">URL da Página</Label>
            <div className="relative">
              <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://meuprojeto.com/lp"
                className="pl-8 bg-slate-900 border-white/10 font-mono text-xs focus:border-primary/50"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300">Tipo de Página</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="bg-slate-900 border-white/10 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-slate-200">
                {ALL_TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300">Repositório GitHub (opcional)</Label>
            <Input
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/usuario/repo"
              className="bg-slate-900 border-white/10 font-mono text-xs focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={loading} className="text-xs font-medium">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            {loading ? "Capturando..." : "Adicionar Site"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
