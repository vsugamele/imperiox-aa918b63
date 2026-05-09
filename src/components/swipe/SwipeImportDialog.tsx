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

  const cleanJson = (raw: string) => {
    // Remove markdown fences (```json ... ```)
    return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  };

  const tryRecover = (raw: string): { data: any; recovered: number } | null => {
    // Tenta recuperar JSON truncado: fecha no último roteiro completo dentro de "roteiros":[...]
    try {
      const m = raw.match(/"roteiros"\s*:\s*\[/i) || raw.match(/"copies"\s*:\s*\[/i) || raw.match(/"swipes"\s*:\s*\[/i);
      if (!m) return null;
      const startIdx = raw.indexOf("[", m.index!);
      let depth = 0, lastGood = -1, inStr = false, esc = false;
      for (let i = startIdx; i < raw.length; i++) {
        const c = raw[i];
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (c === "{" || c === "[") depth++;
        else if (c === "}" || c === "]") {
          depth--;
          if (depth === 1 && c === "}") lastGood = i; // fim de um item dentro do array
          if (depth === 0) break;
        }
      }
      if (lastGood < 0) return null;
      const fixed = raw.slice(0, lastGood + 1) + "]}";
      const data = JSON.parse(fixed);
      return { data, recovered: (data.roteiros || data.copies || data.swipes || []).length };
    } catch {
      return null;
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      let payload: any;
      if (tab === "json") {
        const raw = cleanJson(json);
        if (!raw) throw new Error("Cole um JSON");
        try {
          payload = JSON.parse(raw);
        } catch (parseErr: any) {
          // tenta recuperar truncamento
          const recovered = tryRecover(raw);
          if (recovered) {
            payload = recovered.data;
            toast.warning(`JSON estava truncado — recuperei ${recovered.recovered} roteiro(s) válido(s).`);
          } else {
            const pos = (parseErr?.message || "").match(/position (\d+)/);
            const hint = pos ? ` (posição ${pos[1]} — provável paste truncado)` : "";
            throw new Error(`JSON inválido${hint}. Detalhe: ${parseErr?.message || "erro desconhecido"}`);
          }
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
