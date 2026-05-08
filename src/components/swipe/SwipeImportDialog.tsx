import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, FileJson, Type, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

export function SwipeImportDialog({ open, onOpenChange, onImported }: Props) {
  const [tab, setTab] = useState("json");
  const [json, setJson] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [nicho, setNicho] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    setLoading(true);
    try {
      let payload: any;
      if (tab === "json") {
        if (!json.trim()) throw new Error("Cole um JSON");
        try {
          payload = JSON.parse(json);
        } catch {
          throw new Error("JSON inválido");
        }
      } else if (tab === "text") {
        if (!text.trim()) throw new Error("Cole o texto");
        payload = text;
      } else {
        if (!url.trim()) throw new Error("Informe a URL");
        payload = url;
      }
      const { data, error } = await supabase.functions.invoke("swipe-import", {
        body: { mode: tab, payload, nicho: nicho || null },
      });
      if (error) throw error;
      toast.success(`${data.count} swipe(s) importadas!`);
      onImported();
      onOpenChange(false);
      setJson("");
      setText("");
      setUrl("");
      setNicho("");
    } catch (e: any) {
      toast.error(e.message || "Falha ao importar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-secondary/40 max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Importar para o Swipe File
          </DialogTitle>
          <DialogDescription className="text-xs leading-7">
            Três modos de importar copys: JSON estruturado, texto bruto (a IA quebra) ou URL.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Nicho (opcional, aplicado a todas)</Label>
            <Input
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              placeholder="ex: cartomante, emagrecimento, finanças"
              className="bg-background h-8 text-sm mt-1"
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="json" className="text-xs gap-1"><FileJson className="h-3 w-3" /> JSON</TabsTrigger>
              <TabsTrigger value="text" className="text-xs gap-1"><Type className="h-3 w-3" /> Texto bruto</TabsTrigger>
              <TabsTrigger value="url" className="text-xs gap-1"><LinkIcon className="h-3 w-3" /> URL</TabsTrigger>
            </TabsList>

            <TabsContent value="json" className="space-y-2">
              <Label className="text-xs">Cole o JSON</Label>
              <Textarea
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder={`{\n  "produto": "Soulmate Test",\n  "criador": "@gstalves",\n  "plataforma": "Instagram",\n  "roteiros": [\n    {\n      "id": "A",\n      "titulo": "Segredo Duplo",\n      "formato": "Reel",\n      "mecanismo": "segredo + escassez",\n      "gancho": "...",\n      "narrativa": "...",\n      "reframe": "...",\n      "cta_engajamento": "...",\n      "cta_venda": "..."\n    }\n  ]\n}`}
                className="bg-background font-mono text-xs min-h-[280px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Aceita o formato exato do exemplo (campos: titulo, formato, mecanismo, gancho, participacao_ativa, narrativa, reframe, cta_engajamento, cta_venda).
              </p>
            </TabsContent>

            <TabsContent value="text" className="space-y-2">
              <Label className="text-xs">Cole o texto bruto da copy</Label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cole aqui qualquer copy: legenda de Reel, roteiro de VSL, e-mail, post… A IA vai quebrar em gancho/narrativa/reframe/CTA automaticamente."
                className="bg-background text-sm min-h-[280px] leading-7"
              />
            </TabsContent>

            <TabsContent value="url" className="space-y-2">
              <Label className="text-xs">URL da página</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Funciona melhor com Landing Pages, páginas de venda e posts públicos. Para Reels/TikTok, o conteúdo extraído é a legenda + comentários.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {loading ? "Importando…" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
