import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

const TIPOS = [
  { value: "lp", label: "Landing Page" },
  { value: "vsl", label: "VSL" },
  { value: "checkout", label: "Checkout" },
  { value: "obrigado", label: "Página Obrigado" },
  { value: "captura", label: "Captura" },
  { value: "outro", label: "Outro" },
];

export function AddSiteModal({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [url, setUrl] = useState("");
  const [tipo, setTipo] = useState("lp");
  const [githubUrl, setGithubUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!url.trim()) return toast.error("Cole a URL");
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Faça login");

      toast.info("Extraindo branding e copy…");
      const { data, error } = await supabase.functions.invoke("site-scrape", { body: { url } });
      if (error || !data?.success) throw new Error(error?.message || data?.error || "Falha no scrape");

      let formattedUrl = url.trim();
      if (!formattedUrl.startsWith("http")) formattedUrl = `https://${formattedUrl}`;

      let formattedGithub = githubUrl.trim();
      if (formattedGithub && !formattedGithub.startsWith("http")) formattedGithub = `https://${formattedGithub}`;

      const { error: insErr } = await supabase.from("imphq_sites").insert({
        user_id: userData.user.id,
        titulo: data.title || formattedUrl,
        url: formattedUrl,
        tipo,
        status: "ativo",
        thumbnail_url: data.screenshot || null,
        branding_json: data.branding || null,
        content_md: data.markdown || null,
        summary: data.summary || null,
        github_url: formattedGithub || null,
        last_scraped_at: new Date().toISOString(),
      });
      if (insErr) throw insErr;

      toast.success("Site adicionado");
      setUrl(""); setTipo("lp"); setGithubUrl("");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setLoading(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Adicionar site</DialogTitle>
          <DialogDescription className="leading-7">
            Cole a URL. O Imperius vai extrair print, cores, fontes e copy automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://meuprojeto.com/lp" autoFocus />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>GitHub (opcional)</Label>
            <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/usuario/repo" />
          </div>
        </div>


        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
