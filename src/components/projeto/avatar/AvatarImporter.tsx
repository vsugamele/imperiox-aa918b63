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

function extractText(el: Element | null): string {
  return el?.textContent?.trim() || "";
}

function parseDesireItems(container: Element | null): any[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll(".desire-item")).map(el => {
    const rank = extractText(el.querySelector(".desire-rank"));
    const nome = extractText(el.querySelector(".desire-name"));
    const scoreText = extractText(el.querySelector(".desire-score"));
    const score = parseInt(scoreText) || 0;
    const pills = Array.from(el.querySelectorAll(".pill")).map(p => extractText(p));
    const justificativa = pills.join(" · ");
    return { rank, nome, score, justificativa };
  });
}

function parseAvatarHTML(html: string): any {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const result: any = {};

  // ── Desejos (by section ID or fallback) ──
  const desejosB1 = doc.querySelector("#desejos-b1, [id*='desejos-b1']");
  const desejosB2 = doc.querySelector("#desejos-b2, [id*='desejos-b2']");
  const desejosB3 = doc.querySelector("#desejos-b3, [id*='desejos-b3']");

  const externos = parseDesireItems(desejosB1);
  const internos = parseDesireItems(desejosB2);
  const proibidos = parseDesireItems(desejosB3);

  // Fallback: if no section IDs, parse all desire-items and classify
  if (!externos.length && !internos.length && !proibidos.length) {
    const allDesires = doc.querySelectorAll(".desire-item");
    allDesires.forEach(el => {
      const rank = extractText(el.querySelector(".desire-rank"));
      const nome = extractText(el.querySelector(".desire-name"));
      const scoreText = extractText(el.querySelector(".desire-score"));
      const score = parseInt(scoreText) || 0;
      const pills = Array.from(el.querySelectorAll(".pill")).map(p => extractText(p));
      const justificativa = pills.join(" · ");
      const item = { rank, nome, score, justificativa };
      if (rank.startsWith("P")) proibidos.push(item);
      else if (pills.some(p => p.toLowerCase().includes("interno"))) internos.push(item);
      else externos.push(item);
    });
  }

  if (externos.length) result.desejos_externos = externos;
  if (internos.length) result.desejos_internos = internos;
  if (proibidos.length) result.desejos_proibidos = proibidos;

  // ── Score Table (problemas com 7 scores) ──
  const scoreRows = doc.querySelectorAll(".score-table tbody tr");
  if (scoreRows.length) {
    result.problemas = Array.from(scoreRows).map((row, i) => {
      const cells = row.querySelectorAll("td");
      const headers = doc.querySelectorAll(".score-table thead th");
      const scoreKeys = Array.from(headers).slice(2, -1).map(h => extractText(h).toLowerCase().replace(/\s+/g, "_"));
      const scores: any = {};
      scoreKeys.forEach((key, idx) => {
        scores[key] = parseInt(extractText(cells[idx + 2])) || 0;
      });
      return {
        rank: parseInt(extractText(cells[0])) || i + 1,
        nome: extractText(cells[1]),
        total: parseInt(extractText(cells[cells.length - 1])) || 0,
        scores,
      };
    });
  } else {
    // Fallback: .prob-table
    const probRows = doc.querySelectorAll(".prob-table tbody tr");
    if (probRows.length) {
      result.problemas = Array.from(probRows).map((row, i) => {
        const cells = row.querySelectorAll("td");
        return {
          rank: i + 1,
          nome: extractText(cells[1]),
          total: parseInt(extractText(cells[2])) || 0,
          cena_voyerismo: extractText(cells[3]),
          scores: {},
        };
      });
    }
  }

  // ── Categorias de Problemas (.cat-block) ──
  const catBlocks = doc.querySelectorAll(".cat-block");
  if (catBlocks.length) {
    result.categorias_problemas = Array.from(catBlocks).map(block => {
      const nome = extractText(block.querySelector(".cat-title, .cat-name, h3, h4"));
      const items = Array.from(block.querySelectorAll(".plist li, .prob-list li, ul li")).map(li => extractText(li));
      return { nome, problemas: items };
    });
  }

  // ── Voyeurism scenes ──
  const scenes = doc.querySelectorAll(".scene");
  if (scenes.length) {
    result.voyerismos = Array.from(scenes).map(scene => {
      const nome = extractText(scene.querySelector(".scene-title"));
      const intensidade = extractText(scene.querySelector(".scene-intensity"));
      const fields = scene.querySelectorAll(".scene-field");
      const data: any = { nome, intensidade };
      fields.forEach(f => {
        const key = extractText(f.querySelector(".scene-key")).toLowerCase();
        const val = extractText(f.querySelector(".scene-val"));
        if (key.includes("situação") || key.includes("situacao")) data.situacao = val;
        if (key.includes("sintoma")) data.sintoma_fisico = val;
        if (key.includes("pensamento")) data.pensamento = val;
        if (key.includes("comportamento")) data.comportamento = val;
      });
      const quote = extractText(scene.querySelector(".scene-quote"));
      if (quote) data.pensamento = data.pensamento || quote;
      return data;
    });
  }

  // ── Camadas da Psique (C1-C4) ──
  const cards = doc.querySelectorAll(".card");
  const camadas: any = {};
  cards.forEach(card => {
    const label = extractText(card.querySelector(".card-label"));
    const content = extractText(card.querySelector(".card-content, .card-body, p"));
    if (label.includes("C1")) camadas.c1_superficie = content;
    else if (label.includes("C2")) camadas.c2_emocional = content;
    else if (label.includes("C3")) camadas.c3_identidade = content;
    else if (label.includes("C4")) camadas.c4_existencial = content;
  });
  if (Object.keys(camadas).length) result.camadas_psique = camadas;

  // ── Beliefs ──
  const beliefBoxes = doc.querySelectorAll(".belief-box");
  beliefBoxes.forEach(box => {
    const typeText = extractText(box.querySelector(".belief-type")).toLowerCase();
    const content = extractText(box.querySelector(".belief-content"));
    if (typeText.includes("bloqueadora")) result.crenca_bloqueadora = content;
    else if (typeText.includes("necessária") || typeText.includes("necessaria")) result.crenca_necessaria = content;
    else if (typeText.includes("epifania")) result.epifania_central = content;
  });

  // ── Ciclo de Sabotagem ──
  const cycleItems = doc.querySelectorAll(".cycle-item");
  if (cycleItems.length) {
    result.ciclo_sabotagem = Array.from(cycleItems).map(item => ({
      etapa: extractText(item.querySelector(".cycle-step, .cycle-num, strong")),
      descricao: extractText(item.querySelector(".cycle-text, .cycle-desc, p")),
    }));
  }

  // ── Movimentos ──
  const movements = doc.querySelectorAll(".movement");
  if (movements.length) {
    result.movimentos = Array.from(movements).map(m => ({
      nome: extractText(m.querySelector(".mov-title, .movement-title, h4, strong")),
      descricao: extractText(m.querySelector(".mov-desc, .movement-desc, p")),
    }));
  }

  // ── Handoff (.hi) ──
  const hiItems = doc.querySelectorAll(".hi");
  if (hiItems.length) {
    result.handoff = Array.from(hiItems).map(item => ({
      numero: extractText(item.querySelector(".hi-num")),
      texto: extractText(item.querySelector(".hi-text")),
    }));
  } else {
    // Fallback: .handoff-item
    const handoffItems = doc.querySelectorAll(".handoff-item");
    handoffItems.forEach(item => {
      const key = extractText(item.querySelector(".handoff-key")).toLowerCase();
      const val = extractText(item.querySelector(".handoff-val"));
      if (key.includes("nuclear")) result.gatilho_nuclear = val;
      else if (key.includes("high")) result.the_high = val;
      else if (key.includes("hell")) result.the_hell = val;
      else if (key.includes("segredo")) result.segredo_final = val;
      else if (key.includes("diferenciação") || key.includes("diferenciacao")) result.angulo_diferenciacao = val;
    });
  }

  // ── Word clouds (.word with .dor/.des/.sol/.val) ──
  const wordItems = doc.querySelectorAll(".word-list .word, .word-cloud .word");
  if (wordItems.length) {
    const palavras_dor: string[] = [];
    const palavras_desejo: string[] = [];
    const palavras_solucao: string[] = [];
    const palavras_valor: string[] = [];
    wordItems.forEach(w => {
      const text = extractText(w);
      if (w.classList.contains("dor")) palavras_dor.push(text);
      else if (w.classList.contains("des")) palavras_desejo.push(text);
      else if (w.classList.contains("sol")) palavras_solucao.push(text);
      else if (w.classList.contains("val")) palavras_valor.push(text);
    });
    if (palavras_dor.length) result.palavras_dor = palavras_dor;
    if (palavras_desejo.length) result.palavras_desejo = palavras_desejo;
    if (palavras_solucao.length) result.palavras_solucao = palavras_solucao;
    if (palavras_valor.length) result.palavras_valor = palavras_valor;
  } else {
    // Fallback: .wpill
    const wordClouds = doc.querySelectorAll(".word-cloud");
    wordClouds.forEach(cloud => {
      const pills = Array.from(cloud.querySelectorAll(".wpill")).map(p => extractText(p));
      const prev = cloud.previousElementSibling;
      const label = extractText(prev).toLowerCase();
      if (label.includes("dor")) result.palavras_dor = pills;
      else if (label.includes("desejo")) result.palavras_desejo = pills;
      else if (label.includes("solução") || label.includes("solucao")) result.palavras_solucao = pills;
    });
  }

  // ── Frases-gatilho ──
  const frasesGatilho = doc.querySelectorAll(".frase-gatilho");
  if (frasesGatilho.length) {
    const frases_dor: string[] = [];
    const frases_desejo: string[] = [];
    const frases_decisao: string[] = [];
    frasesGatilho.forEach(f => {
      const text = extractText(f);
      if (f.classList.contains("dor")) frases_dor.push(text);
      else if (f.classList.contains("des")) frases_desejo.push(text);
      else if (f.classList.contains("dec")) frases_decisao.push(text);
    });
    if (frases_dor.length) result.frases_gatilho_dor = frases_dor;
    if (frases_desejo.length) result.frases_gatilho_desejo = frases_desejo;
    if (frases_decisao.length) result.frases_gatilho_decisao = frases_decisao;
  }

  // ── Fases de Ativação ──
  const phases = doc.querySelectorAll(".atv-phase");
  if (phases.length) {
    result.fases_ativacao = Array.from(phases).map(phase => ({
      nome: extractText(phase.querySelector(".atv-title, .phase-title, h4, strong")),
      descricao: extractText(phase.querySelector(".atv-desc, .phase-desc, p")),
    }));
  }

  // ── Síntese Final ──
  const sintCards = doc.querySelectorAll(".sint-card");
  if (sintCards.length) {
    result.sintese = Array.from(sintCards).map(card => ({
      titulo: extractText(card.querySelector(".sint-title, h4, strong")),
      conteudo: extractText(card.querySelector(".sint-content, .sint-body, p")),
    }));
  }

  // ── Sub-avatares completos ──
  const accCards = doc.querySelectorAll(".avatar-card, .acc-card");
  const subAvatares: any[] = [];
  accCards.forEach(card => {
    const nome = extractText(card.querySelector(".av-name, .acc-title"));
    if (!nome) return;
    const sub: any = { nome };

    // Extract all key-value rows
    const rows = card.querySelectorAll(".av-row");
    rows.forEach(row => {
      const key = extractText(row.querySelector(".av-key")).toLowerCase();
      const val = extractText(row.querySelector(".av-val"));
      if (key.includes("situação") || key.includes("situacao")) sub.descricao = val;
      else if (key.includes("hook")) sub.hook = val;
      else if (key.includes("crença") || key.includes("crenca")) sub.crenca = val;
      else if (key.includes("urgência") || key.includes("urgencia")) sub.urgencia = parseInt(val) || 3;
      else if (key.includes("dinheiro")) sub.dinheiro = parseInt(val) || 3;
      else if (key.includes("score")) sub.score = parseInt(val) || 0;
      else if (key.includes("dor")) sub.dor_principal = val;
      else if (key.includes("desejo")) sub.desejo_principal = val;
    });

    // Fallback for situation text
    if (!sub.descricao) {
      sub.descricao = extractText(card.querySelector(".av-situation")) || "";
    }
    if (!sub.urgencia) sub.urgencia = 3;
    if (!sub.dinheiro) sub.dinheiro = 3;

    subAvatares.push(sub);
  });
  if (subAvatares.length) result.sub_avatares = subAvatares;

  return result;
}

function getImportSummary(data: any): { label: string; count: number; emoji: string }[] {
  const items: { label: string; count: number; emoji: string }[] = [];
  if (data.desejos_externos?.length) items.push({ label: "Desejos Externos", count: data.desejos_externos.length, emoji: "💎" });
  if (data.desejos_internos?.length) items.push({ label: "Desejos Internos", count: data.desejos_internos.length, emoji: "🔮" });
  if (data.desejos_proibidos?.length) items.push({ label: "Desejos Proibidos", count: data.desejos_proibidos.length, emoji: "🚫" });
  if (data.problemas?.length) items.push({ label: "Problemas Rankeados", count: data.problemas.length, emoji: "🎯" });
  if (data.categorias_problemas?.length) items.push({ label: "Categorias de Problemas", count: data.categorias_problemas.length, emoji: "📂" });
  if (data.voyerismos?.length) items.push({ label: "Cenas de Voyerismo", count: data.voyerismos.length, emoji: "👁️" });
  if (data.sub_avatares?.length) items.push({ label: "Sub-Avatares", count: data.sub_avatares.length, emoji: "🧠" });
  if (data.camadas_psique) items.push({ label: "Camadas da Psique", count: Object.keys(data.camadas_psique).length, emoji: "🧬" });
  if (data.ciclo_sabotagem?.length) items.push({ label: "Ciclo de Sabotagem", count: data.ciclo_sabotagem.length, emoji: "🔄" });
  if (data.movimentos?.length) items.push({ label: "Movimentos", count: data.movimentos.length, emoji: "🏃" });
  if (data.handoff?.length) items.push({ label: "Handoff Items", count: data.handoff.length, emoji: "📋" });
  if (data.fases_ativacao?.length) items.push({ label: "Fases de Ativação", count: data.fases_ativacao.length, emoji: "⚡" });
  if (data.sintese?.length) items.push({ label: "Síntese Final", count: data.sintese.length, emoji: "✨" });
  if (data.palavras_dor?.length) items.push({ label: "Palavras de Dor", count: data.palavras_dor.length, emoji: "🩸" });
  if (data.palavras_desejo?.length) items.push({ label: "Palavras de Desejo", count: data.palavras_desejo.length, emoji: "💫" });
  if (data.frases_gatilho_dor?.length) items.push({ label: "Frases-Gatilho Dor", count: data.frases_gatilho_dor.length, emoji: "🗣️" });
  if (data.frases_gatilho_desejo?.length) items.push({ label: "Frases-Gatilho Desejo", count: data.frases_gatilho_desejo.length, emoji: "🗣️" });
  const singles = ["crenca_bloqueadora", "crenca_necessaria", "epifania_central", "gatilho_nuclear", "the_high", "the_hell"];
  const foundSingles = singles.filter(k => data[k]);
  if (foundSingles.length) items.push({ label: "Crenças & Gatilhos", count: foundSingles.length, emoji: "💡" });
  return items;
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
    toast.success(`${keys.length} seções encontradas`);
  };

  const handleImport = () => {
    if (!preview) return;
    // Attach raw HTML so it can be viewed later
    const dataWithHtml = { ...preview, html_original: html };
    onImport(dataWithHtml);
    toast.success("Dados importados com sucesso!");
    setHtml("");
    setPreview(null);
    onClose();
  };

  const summary = preview ? getImportSummary(preview) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar HTML de Avatar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cole o HTML do "Sistema de Inteligência de Avatar" aqui. O parser extrai automaticamente: desejos, problemas, cenas de voyerismo, crenças, palavras-gatilho, sub-avatares, fases de ativação e síntese.
          </p>
          <Textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            className="bg-secondary min-h-[200px] font-mono text-xs"
            placeholder="Cole o HTML completo aqui..."
          />
          {preview && summary.length > 0 && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-2">
              <p className="text-xs font-semibold text-primary">📊 Dados encontrados:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {summary.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                    <span className="ml-auto font-mono text-primary">{item.count}</span>
                  </div>
                ))}
              </div>
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver JSON completo</summary>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-[200px] mt-2 p-2 bg-background rounded">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </details>
            </div>
          )}
          {preview && summary.length === 0 && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              Nenhum dado reconhecido no HTML. Verifique se o formato está correto.
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleParse}>🔍 Analisar HTML</Button>
          <Button onClick={handleImport} disabled={!preview || summary.length === 0}>
            <Upload className="h-3 w-3 mr-1" /> Importar Dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
