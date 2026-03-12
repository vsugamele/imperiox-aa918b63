import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: any) => void;
}

function parseAvatarHTML(html: string): any {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const result: any = {};

  // Extract desires
  const desireItems = doc.querySelectorAll(".desire-item");
  const desejos_externos: any[] = [];
  const desejos_internos: any[] = [];
  const desejos_proibidos: any[] = [];

  desireItems.forEach(el => {
    const rank = el.querySelector(".desire-rank")?.textContent?.trim() || "";
    const nome = el.querySelector(".desire-name")?.textContent?.trim() || "";
    const scoreText = el.querySelector(".desire-score")?.textContent?.trim() || "";
    const score = parseInt(scoreText) || 0;
    const pills = Array.from(el.querySelectorAll(".pill")).map(p => p.textContent?.trim() || "");
    const justificativa = pills.join(" · ");

    const item = { rank, nome, score, justificativa };

    if (rank.startsWith("P")) {
      desejos_proibidos.push(item);
    } else if (pills.some(p => p.toLowerCase().includes("interno"))) {
      desejos_internos.push(item);
    } else {
      desejos_externos.push(item);
    }
  });

  if (desejos_externos.length) result.desejos_externos = desejos_externos;
  if (desejos_internos.length) result.desejos_internos = desejos_internos;
  if (desejos_proibidos.length) result.desejos_proibidos = desejos_proibidos;

  // Extract problems from table
  const probRows = doc.querySelectorAll(".prob-table tbody tr");
  if (probRows.length) {
    result.problemas = Array.from(probRows).map((row, i) => {
      const cells = row.querySelectorAll("td");
      return {
        rank: i + 1,
        nome: cells[1]?.textContent?.trim() || "",
        total: parseInt(cells[2]?.textContent?.trim() || "0") || 0,
        cena_voyerismo: cells[3]?.textContent?.trim() || "",
        scores: {},
      };
    });
  }

  // Extract voyeurism scenes
  const scenes = doc.querySelectorAll(".scene");
  if (scenes.length) {
    result.voyerismos = Array.from(scenes).map(scene => {
      const nome = scene.querySelector(".scene-title")?.textContent?.trim() || "";
      const intensidade = scene.querySelector(".scene-intensity")?.textContent?.trim() || "";
      const fields = scene.querySelectorAll(".scene-field");
      const data: any = { nome, intensidade };
      fields.forEach(f => {
        const key = f.querySelector(".scene-key")?.textContent?.trim().toLowerCase() || "";
        const val = f.querySelector(".scene-val")?.textContent?.trim() || "";
        if (key.includes("situação") || key.includes("situacao")) data.situacao = val;
        if (key.includes("sintoma")) data.sintoma_fisico = val;
        if (key.includes("pensamento")) data.pensamento = val;
        if (key.includes("comportamento")) data.comportamento = val;
      });
      const quote = scene.querySelector(".scene-quote")?.textContent?.trim();
      if (quote) data.pensamento = data.pensamento || quote;
      return data;
    });
  }

  // Extract beliefs
  const beliefBoxes = doc.querySelectorAll(".belief-box");
  beliefBoxes.forEach(box => {
    const type = box.querySelector(".belief-type");
    const content = box.querySelector(".belief-content")?.textContent?.trim() || "";
    const typeText = type?.textContent?.trim().toLowerCase() || "";
    if (typeText.includes("bloqueadora")) result.crenca_bloqueadora = content;
    else if (typeText.includes("necessária") || typeText.includes("necessaria")) result.crenca_necessaria = content;
    else if (typeText.includes("epifania")) result.epifania_central = content;
  });

  // Extract word clouds
  const wordClouds = doc.querySelectorAll(".word-cloud");
  wordClouds.forEach(cloud => {
    const pills = Array.from(cloud.querySelectorAll(".wpill")).map(p => p.textContent?.trim() || "");
    const prev = cloud.previousElementSibling;
    const label = prev?.textContent?.trim().toLowerCase() || "";
    if (label.includes("dor")) result.palavras_dor = pills;
    else if (label.includes("desejo")) result.palavras_desejo = pills;
    else if (label.includes("solução") || label.includes("solucao")) result.palavras_solucao = pills;
  });

  // Extract handoff items
  const handoffItems = doc.querySelectorAll(".handoff-item");
  handoffItems.forEach(item => {
    const key = item.querySelector(".handoff-key")?.textContent?.trim().toLowerCase() || "";
    const val = item.querySelector(".handoff-val")?.textContent?.trim() || "";
    if (key.includes("nuclear")) result.gatilho_nuclear = val;
    else if (key.includes("high")) result.the_high = val;
    else if (key.includes("hell")) result.the_hell = val;
    else if (key.includes("segredo")) result.segredo_final = val;
    else if (key.includes("diferenciação") || key.includes("diferenciacao")) result.angulo_diferenciacao = val;
  });

  // Extract sub-avatars from accordion cards
  const accCards = doc.querySelectorAll(".avatar-card, .acc-card");
  const subAvatares: any[] = [];
  accCards.forEach(card => {
    const nome = card.querySelector(".av-name, .acc-title")?.textContent?.trim();
    if (!nome) return;
    const descricao = card.querySelector(".av-situation")?.textContent?.trim() || "";
    subAvatares.push({ nome, descricao, urgencia: 3, dinheiro: 3 });
  });
  if (subAvatares.length) result.sub_avatares = subAvatares;

  return result;
}

export function AvatarImporter({ open, onClose, onImport }: Props) {
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState<any>(null);

  const handleParse = () => {
    if (!html.trim()) {
      toast.error("Cole o HTML primeiro");
      return;
    }
    const parsed = parseAvatarHTML(html);
    setPreview(parsed);
    const keys = Object.keys(parsed);
    toast.success(`${keys.length} seções encontradas: ${keys.join(", ")}`);
  };

  const handleImport = () => {
    if (!preview) return;
    onImport(preview);
    toast.success("Dados importados com sucesso!");
    setHtml("");
    setPreview(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar HTML de Avatar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cole o HTML do "Sistema de Inteligência de Avatar" aqui. O parser vai extrair automaticamente: desejos, problemas, cenas de voyerismo, crenças, palavras-gatilho e sub-avatares.
          </p>
          <Textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            className="bg-secondary min-h-[200px] font-mono text-xs"
            placeholder="Cole o HTML completo aqui..."
          />
          {preview && (
            <div className="p-3 rounded bg-secondary/50 border border-border">
              <p className="text-xs font-mono text-primary mb-2">Preview dos dados extraídos:</p>
              <pre className="text-xs text-muted-foreground overflow-auto max-h-[200px]">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleParse}>🔍 Analisar HTML</Button>
          <Button onClick={handleImport} disabled={!preview}>
            <Upload className="h-3 w-3 mr-1" /> Importar Dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
