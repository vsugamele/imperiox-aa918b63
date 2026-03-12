import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileUp, Upload, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ParsedCompetitor {
  name: string;
  url: string;
  ponto_forte: string;
  fraqueza: string;
  nicho: string;
  sub_nicho: string;
  publico_alvo: string;
  mecanismo_unico: string;
  score_escala: number;
  score_max: number;
  headline: string;
  hook: string;
  cta: string;
  oferta_principal: string;
  preco: string;
  garantia: string;
  bonus: string;
  trafego_est: string;
  ads_ativos: boolean;
  insights: string;
  canais_keywords: string[];
  stack_tecnologico: string[];
  paginas_funil: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (competitors: Partial<ParsedCompetitor>[]) => void;
}

function extractSection(text: string, heading: string): string {
  const regex = new RegExp(`##?#?\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() || "";
}

function extractTableValue(text: string, key: string): string {
  const regex = new RegExp(`\\|\\s*(?:${key})\\s*\\|\\s*([^|]+)\\|`, "i");
  const match = text.match(regex);
  return match?.[1]?.trim() || "";
}

function extractBetween(text: string, startPattern: string, endPattern?: string): string {
  const startIdx = text.indexOf(startPattern);
  if (startIdx === -1) return "";
  const afterStart = text.substring(startIdx + startPattern.length);
  if (!endPattern) return afterStart.trim();
  const endIdx = afterStart.indexOf(endPattern);
  return endIdx === -1 ? afterStart.trim() : afterStart.substring(0, endIdx).trim();
}

function parseScore(text: string): { score: number; max: number } {
  const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  return match ? { score: parseFloat(match[1]), max: parseFloat(match[2]) } : { score: 0, max: 10 };
}

function extractPrice(text: string): string {
  const match = text.match(/R\$[\d.,]+(?:\s*(?:\/(?:mês|ano|aula))?)?/i);
  return match ? match[0] : "";
}

function extractBulletPoints(section: string): string[] {
  return section
    .split("\n")
    .filter(l => l.trim().startsWith("-") || l.trim().startsWith("*"))
    .map(l => l.replace(/^[\s\-*]+/, "").trim())
    .filter(Boolean);
}

function parseDossie(content: string): Partial<ParsedCompetitor> {
  const result: Partial<ParsedCompetitor> = {};

  // Name from title
  const titleMatch = content.match(/# DOSSIÊ COMPETITIVO\s*[-—]\s*(.+)/i) || content.match(/^#\s+(.+)/m);
  if (titleMatch) {
    result.name = titleMatch[1].replace(/[\/|].+$/, "").trim();
  }

  // URL
  const urlMatch = content.match(/(?:Site(?:\s*principal)?|URL|site):\s*(https?:\/\/\S+|[\w.-]+\.\w{2,}[\S]*)/i);
  if (urlMatch) result.url = urlMatch[1].startsWith("http") ? urlMatch[1] : `https://${urlMatch[1]}`;

  // Product info
  const produto = extractTableValue(content, "Produto|Formato|Preço");
  result.oferta_principal = extractTableValue(content, "Produto") || extractTableValue(content, "Formato") || "";
  
  const preco = extractTableValue(content, "Preço");
  if (preco) result.preco = preco;
  else {
    const p = extractPrice(content);
    if (p) result.preco = p;
  }

  result.garantia = extractTableValue(content, "Garantia");
  result.bonus = extractTableValue(content, "Bonus|Bônus");

  // Strengths & weaknesses
  const pontosFortes = extractSection(content, "Pontos fortes");
  const pontosFracos = extractSection(content, "Pontos fracos");
  const gap = extractSection(content, "GAP");

  if (pontosFortes) result.ponto_forte = extractBulletPoints(pontosFortes).join(" • ");
  if (pontosFracos) result.fraqueza = extractBulletPoints(pontosFracos).join(" • ");

  // Copy intelligence
  const copySection = extractSection(content, "INTELIGÊNCIA DE COPY|COPY");
  if (copySection) {
    const bullets = extractBulletPoints(copySection);
    result.headline = bullets[0] || "";
    result.hook = bullets.slice(0, 3).join(" | ");
  }

  // Insights
  const insights: string[] = [];
  if (gap) insights.push(`GAP: ${extractBulletPoints(gap).join("; ") || gap.substring(0, 200)}`);
  
  const sinal = extractSection(content, "SINAL DE MERCADO|RELEVÂNCIA");
  if (sinal) insights.push(sinal.substring(0, 300));
  
  result.insights = insights.join("\n\n");

  // Funil
  const funilSection = extractSection(content, "FUNIL");
  if (funilSection) {
    result.paginas_funil = funilSection
      .split("\n")
      .map(l => l.replace(/^[\s→>*\-]+/, "").trim())
      .filter(l => l.length > 3 && !l.startsWith("```") && !l.startsWith("**"));
  }

  // Score
  const scoreMatch = content.match(/Score[:\s]*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/i);
  if (scoreMatch) {
    result.score_escala = parseFloat(scoreMatch[1]);
    result.score_max = parseFloat(scoreMatch[2]);
  }

  // Technical data
  const dadosTec = extractSection(content, "DADOS TÉCNICOS");
  if (dadosTec) {
    const techBullets = extractBulletPoints(dadosTec);
    result.stack_tecnologico = techBullets.map(b => {
      const colonIdx = b.indexOf(":");
      return colonIdx > 0 ? b.substring(0, colonIdx).trim() : b;
    });

    // Ads
    const adsLine = techBullets.find(b => /pixel|ads|anunci/i.test(b));
    if (adsLine && /ativ|sim|true|provável/i.test(adsLine)) result.ads_ativos = true;
  }

  // Keywords from identity section
  const identidade = extractSection(content, "IDENTIDADE");
  if (identidade) {
    const igMatch = identidade.match(/@[\w.]+/);
    if (igMatch) {
      result.canais_keywords = result.canais_keywords || [];
      result.canais_keywords.push(`Instagram: ${igMatch[0]}`);
    }
    const hotmartMatch = identidade.match(/Hotmart[:\s]+(\S+)/i);
    if (hotmartMatch) {
      result.stack_tecnologico = result.stack_tecnologico || [];
      result.stack_tecnologico.push(`Hotmart: ${hotmartMatch[1]}`);
    }
  }

  // Segmento
  const segMatch = content.match(/(?:Segmento|Nicho|Foco)[:\s]+(.+)/i);
  if (segMatch) result.nicho = segMatch[1].trim();

  const posMatch = content.match(/Posicionamento[:\s]+(.+)/i);
  if (posMatch) result.mecanismo_unico = posMatch[1].replace(/^["']|["']$/g, "").trim();

  // Trafego
  const seguidoresMatch = content.match(/(\d[\d.,]*[KMkm]?\+?)\s*(?:seguidores|seg)/i);
  if (seguidoresMatch) result.trafego_est = `${seguidoresMatch[1]} seguidores`;

  // Alunos
  const alunosMatch = content.match(/([\d.]+\+?)\s*(?:alunos|alunas|treinadas|formados)/i);
  if (alunosMatch) {
    result.publico_alvo = `${alunosMatch[1]} alunos formados`;
  }

  return result;
}

function parseOfertasReport(content: string): Partial<ParsedCompetitor>[] {
  const competitors: Partial<ParsedCompetitor>[] = [];
  
  // Split by ### #N — Name pattern
  const sections = content.split(/###\s*#\d+\s*[-—]\s*/);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const nameMatch = section.match(/^(.+?)(?:\n|$)/);
    if (!nameMatch) continue;

    const name = nameMatch[1].replace(/[\/|].+$/, "").trim();
    if (name.includes("JP Freitas") || name.includes("referência")) continue; // Skip self

    const comp: Partial<ParsedCompetitor> = { name };
    
    const { score, max } = parseScore(section);
    comp.score_escala = score;
    comp.score_max = max;
    
    comp.preco = extractTableValue(section, "Preço");
    comp.oferta_principal = extractTableValue(section, "Formato") || extractTableValue(section, "Produto");
    comp.trafego_est = extractTableValue(section, "Seguidores") || extractTableValue(section, "Alunos");
    comp.ads_ativos = /anunciante.*ativ|ads.*ativ/i.test(section);
    
    const foco = extractTableValue(section, "Foco");
    if (foco) comp.nicho = foco;

    // Insight
    const insightMatch = section.match(/\*\*Insight[^*]*\*\*[:\s]*(.*?)(?=\n\n|---|\n###|$)/s);
    if (insightMatch) comp.insights = insightMatch[1].trim();

    // Why is scaled
    const whyMatch = section.match(/\*\*Por que é escalado[^*]*\*\*[:\s]*(.*?)(?=\n\n\*\*|---|\n###|$)/s);
    if (whyMatch) comp.ponto_forte = extractBulletPoints(whyMatch[1]).join(" • ");

    const plat = extractTableValue(section, "Plataforma");
    if (plat) comp.stack_tecnologico = [plat];

    competitors.push(comp);
  }

  return competitors;
}

function parseRelatorioFinal(content: string): Partial<ParsedCompetitor>[] {
  const competitors: Partial<ParsedCompetitor>[] = [];
  
  // Parse tier tables
  const tierRegex = /\*\*Tier \d+[^*]*\*\*\s*\n\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*\n\|[-|\s]+\|\s*\n((?:\|[^\n]+\n)+)/g;
  let match;
  
  while ((match = tierRegex.exec(content)) !== null) {
    const rows = match[1].trim().split("\n");
    for (const row of rows) {
      const cols = row.split("|").map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        competitors.push({
          name: cols[0],
          trafego_est: cols[1],
          preco: cols[2],
          nicho: cols[3],
        });
      }
    }
  }

  // Ranking table
  const rankingSection = extractSection(content, "RANKING FINAL");
  if (rankingSection) {
    const rows = rankingSection.split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Concorrente"));
    for (const row of rows) {
      const cols = row.split("|").map(c => c.trim()).filter(Boolean);
      if (cols.length >= 4) {
        const name = cols[1];
        const existing = competitors.find(c => c.name === name);
        if (existing) {
          existing.insights = `Ameaça: ${cols[2]} — ${cols[3]}`;
        }
      }
    }
  }

  return competitors;
}

function detectAndParse(content: string): { competitors: Partial<ParsedCompetitor>[]; type: string } {
  const lower = content.toLowerCase();

  if (lower.includes("dossiê competitivo") || lower.includes("dossie competitivo")) {
    return { competitors: [parseDossie(content)], type: "dossiê" };
  }

  if (lower.includes("análise de ofertas") || lower.includes("analise de ofertas") || lower.includes("ofertas validadas")) {
    return { competitors: parseOfertasReport(content), type: "ofertas" };
  }

  if (lower.includes("relatório final") || lower.includes("relatorio final") || lower.includes("mapa competitivo")) {
    return { competitors: parseRelatorioFinal(content), type: "relatório" };
  }

  // Try dossiê parse as fallback
  const dossie = parseDossie(content);
  if (dossie.name) {
    return { competitors: [dossie], type: "documento" };
  }

  return { competitors: [], type: "desconhecido" };
}

export function CompetitorImporter({ open, onClose, onImport }: Props) {
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [manualText, setManualText] = useState("");
  const [parsed, setParsed] = useState<Partial<ParsedCompetitor>[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processContent = useCallback((contents: { name: string; content: string }[]) => {
    const allParsed: Partial<ParsedCompetitor>[] = [];
    
    for (const { content } of contents) {
      const { competitors } = detectAndParse(content);
      allParsed.push(...competitors);
    }

    // Deduplicate by name
    const seen = new Set<string>();
    const unique = allParsed.filter(c => {
      if (!c.name) return false;
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setParsed(unique);
    if (unique.length > 0) {
      toast.success(`${unique.length} concorrente(s) identificado(s)`);
    } else {
      toast.error("Nenhum concorrente identificado nos arquivos");
    }
  }, []);

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: { name: string; content: string }[] = [];
    let loaded = 0;
    const total = fileList.length;

    Array.from(fileList).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newFiles.push({ name: file.name, content: e.target?.result as string });
        loaded++;
        if (loaded === total) {
          setFiles(prev => {
            const combined = [...prev, ...newFiles];
            processContent(combined);
            return combined;
          });
        }
      };
      reader.readAsText(file);
    });
  }, [processContent]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleManualParse = useCallback(() => {
    if (!manualText.trim()) return;
    const combined = [...files, { name: "manual", content: manualText }];
    setFiles(combined);
    processContent(combined);
  }, [manualText, files, processContent]);

  const removeFile = (idx: number) => {
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    if (updated.length > 0) processContent(updated);
    else setParsed([]);
  };

  const handleImport = () => {
    if (parsed.length === 0) return;
    onImport(parsed);
    setFiles([]);
    setManualText("");
    setParsed([]);
    onClose();
  };

  const reset = () => {
    setFiles([]);
    setManualText("");
    setParsed([]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>📥 Importar Concorrentes</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Arraste dossiês (.md/.html), relatório de ofertas ou relatório final. Múltiplos arquivos são processados e deduplicados automaticamente.
        </p>

        {/* Dropzone */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Arraste arquivos .md ou .html aqui</p>
          <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar</p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".md,.html,.htm,.txt"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />

        {/* Loaded files */}
        {files.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Arquivos carregados:</p>
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-secondary/50 rounded px-2 py-1">
                <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                <span className="truncate flex-1">{f.name}</span>
                <span className="text-xs text-muted-foreground">{(f.content.length / 1024).toFixed(1)}KB</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Manual paste */}
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            Colar texto manualmente
          </summary>
          <Textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="Cole o conteúdo markdown ou HTML aqui..."
            className="mt-2 min-h-[120px] font-mono text-xs bg-secondary"
          />
          <Button variant="outline" size="sm" className="mt-2" onClick={handleManualParse}>
            Analisar Texto
          </Button>
        </details>

        {/* Parsed preview */}
        {parsed.length > 0 && (
          <div className="space-y-2 border border-border rounded-lg p-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              {parsed.length} concorrente(s) identificado(s)
            </p>
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {parsed.map((comp, i) => (
                <div key={i} className="bg-secondary/50 rounded p-2 text-xs space-y-1">
                  <p className="font-semibold text-sm">{comp.name || "Sem nome"}</p>
                  <div className="flex flex-wrap gap-1">
                    {comp.preco && <Badge variant="outline" className="text-[10px]">💰 {comp.preco}</Badge>}
                    {comp.score_escala ? <Badge variant="outline" className="text-[10px]">⭐ {comp.score_escala}/{comp.score_max}</Badge> : null}
                    {comp.trafego_est && <Badge variant="outline" className="text-[10px]">👥 {comp.trafego_est}</Badge>}
                    {comp.ads_ativos && <Badge variant="outline" className="text-[10px]">📢 Ads ativos</Badge>}
                    {comp.nicho && <Badge variant="outline" className="text-[10px]">🎯 {comp.nicho}</Badge>}
                  </div>
                  {comp.ponto_forte && <p className="text-muted-foreground">✅ {comp.ponto_forte.substring(0, 120)}...</p>}
                  {comp.insights && <p className="text-muted-foreground">💡 {comp.insights.substring(0, 120)}...</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {parsed.length === 0 && files.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Nenhum concorrente identificado. Verifique o formato dos arquivos.
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleImport} disabled={parsed.length === 0} className="gap-1">
            <Upload className="h-4 w-4" />
            Importar {parsed.length} Concorrente(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
