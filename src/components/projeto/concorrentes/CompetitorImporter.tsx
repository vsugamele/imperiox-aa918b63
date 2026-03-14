import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FileUp, Upload, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  projectId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a markdown ## section body */
function extractSection(text: string, heading: string): string {
  const regex = new RegExp(`##?#?\\s*${heading}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`, "i");
  return text.match(regex)?.[1]?.trim() || "";
}

/** Extract value from markdown table: | Key | Value | */
function extractTableValue(text: string, key: string): string {
  const regex = new RegExp(`\\|\\s*(?:${key})\\s*\\|\\s*([^|\\n]+)\\|`, "i");
  return text.match(regex)?.[1]?.trim().replace(/\*+/g, "") || "";
}

/** Extract value from bold list item: - **Key:** value */
function extractListValue(text: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`-\\s*\\*{0,2}\\s*${escaped}[^:\\n]*:\\*{0,2}\\s*(.+)`, "i");
  return text.match(regex)?.[1]?.trim().replace(/\*+/g, "") || "";
}

function parseScore(text: string): { score: number; max: number } {
  const match = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  return match ? { score: parseFloat(match[1]), max: parseFloat(match[2]) } : { score: 0, max: 10 };
}

function extractBulletPoints(section: string): string[] {
  return section
    .split("\n")
    .filter(l => /^\s*[-*]/.test(l))
    .map(l => l.replace(/^\s*[-*]+\s*/, "").replace(/\*+/g, "").trim())
    .filter(Boolean);
}

/** Extract first price pattern: R$X,XXX */
function extractFirstPrice(text: string): string {
  return text.match(/R\$\s*[\d.,]+(?:\s*\/(?:mês|ano|aula))?/i)?.[0] || "";
}

/** Extract Instagram handle from a string like "@rodrigovizu (~400K seguidores)" */
function extractIgHandle(raw: string): string {
  return raw.match(/(@[\w.]+)/)?.[1] || "";
}

/** Extract follower count from a string */
function extractFollowers(raw: string): string {
  const m = raw.match(/(\d[\d.,]*[KMkm]?\+?)\s*(?:seguidores|seg\.|alunos|alun)/i);
  return m ? m[0].trim() : "";
}

/** Build a URL string from raw text (picks first URL if multiple) */
function buildUrl(raw: string): string {
  const first = raw.split(/\s*[|,]\s*/)[0].trim();
  if (!first || first.toLowerCase() === "n/d" || first.length < 4) return "";
  return first.startsWith("http") ? first : `https://${first}`;
}

/** Extract all price values from text for mapping purposes */
function extractAllPrices(text: string): string[] {
  return (text.match(/R\$\s*[\d.,]+/gi) || []).map(p => p.trim());
}

// ── Parser: DOSSIÊ COMPETITIVO format ────────────────────────────────────────
function parseDossie(content: string): Partial<ParsedCompetitor> {
  const result: Partial<ParsedCompetitor> = {};

  // Name — keep full "Name / Alias" to preserve context
  const titleMatch = content.match(/# DOSSIÊ COMPETITIVO\s*[-—]\s*(.+)/i) || content.match(/^#\s+(.+)/m);
  if (titleMatch) result.name = titleMatch[1].trim().replace(/\s*\/\s*/g, " / ");

  // ── IDENTIDADE ────────────────────────────────────────────────────────────
  const identidade = extractSection(content, "IDENTIDADE");
  const idScope = identidade || content;

  // Instagram: "- **Instagram:** @rodrigovizu (~400K seguidores)"
  const igRaw = extractListValue(idScope, "Instagram");
  const igHandle = igRaw.match(/(@[\w.]+)/)?.[1] || "";
  if (igHandle) {
    result.canais_keywords = [igHandle];
    // Extract followers from same line
    const igFollowers = igRaw.match(/(\d[\d.,]*[KMkm]?\+?)\s*seguidores/i);
    if (igFollowers) result.trafego_est = igFollowers[0].trim();
  }

  // Site: "- **Site principal:** rodrigovizu.com | metodorv.com"
  const siteRaw = extractListValue(idScope, "Site principal") ||
                  extractListValue(idScope, "Site produto") ||
                  extractListValue(idScope, "Site") ||
                  extractListValue(idScope, "URL");
  if (siteRaw) {
    const firstSite = siteRaw.split(/\s*[|,]\s*/)[0].trim();
    if (firstSite.length > 3 && firstSite !== "N/D") {
      result.url = firstSite.startsWith("http") ? firstSite : `https://${firstSite}`;
    }
  }

  // Posicionamento → mecanismo_unico
  const posicionamento = extractListValue(idScope, "Posicionamento");
  if (posicionamento) result.mecanismo_unico = posicionamento.replace(/^[""']|[""']$/g, "").trim();

  // Hotmart → stack_tecnologico + oferta_principal
  const hotmartLine = extractListValue(idScope, "Hotmart");
  if (hotmartLine) {
    const code = hotmartLine.split(/[\s—\-]/)[0].trim();
    result.stack_tecnologico = [`Hotmart: ${code}`];
    const productName = hotmartLine.replace(/^[\w\d]+\s*[-—]\s*/, "").trim();
    if (productName && productName !== code) result.oferta_principal = productName;
  }

  // ── Produto / oferta ──────────────────────────────────────────────────────
  result.oferta_principal = result.oferta_principal ||
    extractTableValue(content, "Produto") ||
    extractTableValue(content, "Formato") ||
    extractListValue(content, "Produto digital") ||
    extractListValue(content, "Tipo") || "";

  // Preço
  const precoVal = extractTableValue(content, "Preço") || extractListValue(content, "Preço");
  result.preco = precoVal || extractFirstPrice(content);

  // Garantia
  result.garantia = extractTableValue(content, "Garantia") || "";
  result.bonus = extractTableValue(content, "Bonus") || extractTableValue(content, "Bônus") || "";

  // Alunos / Seguidores
  if (!result.trafego_est) {
    const alunosVal = extractTableValue(content, "Alunos") || extractListValue(content, "Alunos");
    const segVal = extractTableValue(content, "Seguidores") || extractListValue(content, "Seguidores");
    result.trafego_est = alunosVal || segVal || "";
    if (!result.trafego_est) {
      const m = content.match(/(\d[\d.]*[KMkm]?\+?\s*(?:alunos?\s*formados?|alunas?\s*treinadas?|cabeleireiras?\s*treinadas?|seguidores?))/i);
      if (m) result.trafego_est = m[0].trim();
    }
  }

  // Anunciante
  const anuncianteVal = extractTableValue(content, "Anunciante") || extractListValue(content, "Status anunciante");
  if (anuncianteVal) result.ads_ativos = /ATIVO|SIM|confirmado/i.test(anuncianteVal);

  // Foco → nicho
  const focoVal = extractTableValue(content, "Foco") || extractListValue(content, "Foco") || extractListValue(content, "Segmento");
  if (focoVal) result.nicho = focoVal;

  // ── Análise Competitiva ───────────────────────────────────────────────────
  const pontosFortes = extractSection(content, "Pontos fortes vs JP|Pontos fortes");
  const pontosFracos = extractSection(content, "Pontos fracos vs JP|Pontos fracos");
  const gap = extractSection(content, "GAP que JP pode explorar|GAP");
  const relevancia = extractSection(content, "Relevância estratégica|SINAL DE MERCADO");

  if (pontosFortes) result.ponto_forte = extractBulletPoints(pontosFortes).slice(0, 4).join(" • ");
  if (pontosFracos) result.fraqueza = extractBulletPoints(pontosFracos).slice(0, 3).join(" • ");

  const insightParts: string[] = [];
  if (gap) {
    const gapBullets = extractBulletPoints(gap);
    insightParts.push(`GAP: ${gapBullets.join("; ") || gap.substring(0, 250)}`);
  }
  if (relevancia) insightParts.push(relevancia.substring(0, 300));
  if (insightParts.length) result.insights = insightParts.join("\n\n");

  // ── Inteligência de Copy ──────────────────────────────────────────────────
  const copySection = extractSection(content, "INTELIGÊNCIA DE COPY|Copy");
  if (copySection) {
    const bullets = extractBulletPoints(copySection);
    if (bullets.length) {
      result.headline = bullets[0];
      result.hook = bullets.slice(0, 4).join(" | ");
    }
  }

  // ── Funil ─────────────────────────────────────────────────────────────────
  const funilSection = extractSection(content, "FUNIL");
  if (funilSection) {
    result.paginas_funil = funilSection
      .split("\n")
      .map(l => l.replace(/^[\s→>*\-`]+/, "").trim())
      .filter(l => l.length > 4 && !l.startsWith("```") && !/^\*\*/.test(l));
  }

  // ── Dados Técnicos ────────────────────────────────────────────────────────
  const dadosTec = extractSection(content, "DADOS TÉCNICOS");
  if (dadosTec) {
    const techBullets = extractBulletPoints(dadosTec);
    const stack = result.stack_tecnologico ? [...result.stack_tecnologico] : [];
    techBullets.forEach(b => {
      if (/plataforma|checkout|hotmart|kiwify|eduzz/i.test(b)) stack.push(b);
      if (/pixel|ads|anunci/i.test(b) && /ativ|sim|true|provável/i.test(b)) result.ads_ativos = true;
    });
    if (stack.length) result.stack_tecnologico = stack;
  }

  // ── Score ─────────────────────────────────────────────────────────────────
  const scoreMatch = content.match(/Score[:\s]*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/i);
  if (scoreMatch) { result.score_escala = parseFloat(scoreMatch[1]); result.score_max = parseFloat(scoreMatch[2]); }

  // ── Fallback Instagram ────────────────────────────────────────────────────
  if (!result.canais_keywords?.length) {
    const igFallback = content.match(/@[\w.]+/);
    if (igFallback) result.canais_keywords = [igFallback[0]];
  }

  return result;
}

// ── Parser: _ofertas.md (Análise de Ofertas Escaladas) ───────────────────────
function parseOfertasReport(content: string): Partial<ParsedCompetitor>[] {
  const competitors: Partial<ParsedCompetitor>[] = [];
  const sections = content.split(/###\s*#\d+\s*[-—]\s*/);

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const nameMatch = section.match(/^(.+?)(?:\n|$)/);
    if (!nameMatch) continue;

    const rawName = nameMatch[1].trim();

    // Skip self-reference (JP Freitas próprio)
    if (/refer[eê]ncia\s*para\s*compara/i.test(section.substring(0, 300))) continue;
    if (/\(produto atual/i.test(section.substring(0, 300))) continue;
    if (/\*produto atual\*/i.test(section.substring(0, 300))) continue;

    const comp: Partial<ParsedCompetitor> = { name: rawName.replace(/\s*\/\s*/g, " / ") };

    const { score, max } = parseScore(section);
    if (score > 0) { comp.score_escala = score; comp.score_max = max; }

    // Table data
    comp.preco = extractTableValue(section, "Preço");
    comp.oferta_principal = extractTableValue(section, "Formato") || extractTableValue(section, "Produto");
    const plat = extractTableValue(section, "Plataforma de venda") || extractTableValue(section, "Plataforma");
    if (plat) comp.stack_tecnologico = [plat];

    // Alunos / Seguidores / Turma
    const alunos = extractTableValue(section, "Alunos");
    const seg = extractTableValue(section, "Seguidores");
    const turma = extractTableValue(section, "Turma");
    comp.trafego_est = alunos || seg || turma || "";

    // Anunciante
    const adsVal = extractTableValue(section, "Anunciante");
    if (adsVal) comp.ads_ativos = /ATIVO|SIM/i.test(adsVal);
    else comp.ads_ativos = /anunciante.*ATIVO/i.test(section);

    // Foco
    const foco = extractTableValue(section, "Foco");
    if (foco) comp.nicho = foco;

    // Instagram
    const igHandle = section.match(/@[\w.]+/)?.[0];
    if (igHandle) comp.canais_keywords = [igHandle];

    // Por que é escalado → ponto_forte
    const whyMatch = section.match(/\*\*Por que (?:é escalado|é relevante)[^*]*\*\*[:\s]*(.*?)(?=\n\n\*\*|---|\n###|$)/s);
    if (whyMatch) comp.ponto_forte = extractBulletPoints(whyMatch[1]).slice(0, 4).join(" • ");

    // Ponto fraco
    const weakMatch = section.match(/\*\*Ponto fraco[^*]*\*\*[:\s]*(.*?)(?=\n\n|---|\n###|$)/s);
    if (weakMatch) comp.fraqueza = weakMatch[1].trim().substring(0, 300);

    // Insight para JP
    const insightMatch = section.match(/\*\*Insight para[^*]*\*\*[:\s]*(.*?)(?=\n\n|---|\n###|$)/s);
    if (insightMatch) comp.insights = insightMatch[1].trim().substring(0, 400);

    competitors.push(comp);
  }

  return competitors;
}

// ── Parser: relatorio-final.md ────────────────────────────────────────────────
function parseRelatorioFinal(content: string): Partial<ParsedCompetitor>[] {
  const competitors: Partial<ParsedCompetitor>[] = [];

  // Parse tier tables: "**Tier N — ...**\n| table |"
  const tierBlocks = content.split(/\*\*Tier\s+\d+[^*]*\*\*/i);
  for (let i = 1; i < tierBlocks.length; i++) {
    const block = tierBlocks[i];
    const rows = block.split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Concorrente") && !l.includes("Escala") && !l.includes("Foco"));
    for (const row of rows) {
      const cols = row.split("|").map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3 && cols[0].length > 1) {
        competitors.push({
          name: cols[0].replace(/\s*\/\s*/g, " / "),
          trafego_est: cols[1] || "",
          preco: cols[2] || "",
          nicho: cols[3] || "",
        });
      }
    }
  }

  // Enrich from RANKING FINAL de AMEAÇA table
  const rankingSection = extractSection(content, "RANKING FINAL DE AMEAÇA|RANKING FINAL");
  if (rankingSection) {
    const rows = rankingSection.split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Concorrente") && !l.includes("#"));
    for (const row of rows) {
      const cols = row.split("|").map(c => c.trim()).filter(Boolean);
      if (cols.length >= 3) {
        const name = cols[1] || cols[0];
        const ameaca = cols[2] || "";
        const motivo = cols[3] || "";
        const existing = competitors.find(c => c.name?.toLowerCase().includes(name.toLowerCase()));
        if (existing) {
          existing.insights = `AMEAÇA: ${ameaca}${motivo ? ` — ${motivo}` : ""}`;
        } else if (name.length > 2) {
          competitors.push({ name, insights: `AMEAÇA: ${ameaca}${motivo ? ` — ${motivo}` : ""}` });
        }
      }
    }
  }

  return competitors.filter(c => c.name && c.name.length > 1);
}

// ── Parser: _concorrentes.md (Tier-based mapa) ───────────────────────────────
function parseMapaConcorrentes(content: string): Partial<ParsedCompetitor>[] {
  const competitors: Partial<ParsedCompetitor>[] = [];
  let currentTier = 1;
  let currentComp: Partial<ParsedCompetitor> | null = null;
  let compLines: string[] = [];

  const flush = () => {
    if (!currentComp) return;
    const block = compLines.join("\n");

    // Instagram: "- **Instagram:** @hemersondoscachos" — exact field first
    const igRaw = extractListValue(block, "Instagram");
    const igHandle = igRaw.match(/(@[\w.]+)/)?.[1] || block.match(/@[\w.]+/)?.[0] || "";
    if (igHandle) {
      currentComp.canais_keywords = [igHandle];
      // Try to get followers from Instagram line
      const igFollowers = igRaw.match(/(\d[\d.,]*[KMkm]?\+?)\s*seguidores/i);
      if (igFollowers && !currentComp.trafego_est) currentComp.trafego_est = igFollowers[0].trim();
    }

    // Seguidores field
    const seguidores = extractListValue(block, "Seguidores");
    if (seguidores && !currentComp.trafego_est) currentComp.trafego_est = seguidores;

    // Alunos
    const alunos = extractListValue(block, "Alunos") || extractListValue(block, "Escala");
    if (alunos && !currentComp.trafego_est) currentComp.trafego_est = alunos;

    // Produto
    const produto = extractListValue(block, "Produto digital") || extractListValue(block, "Produto");
    if (produto) currentComp.oferta_principal = produto;

    // Foco → nicho
    const foco = extractListValue(block, "Foco") || extractListValue(block, "Nicho");
    if (foco) currentComp.nicho = foco;

    // Modelo → mecanismo_unico
    const modelo = extractListValue(block, "Modelo") || extractListValue(block, "Tipo de produto");
    if (modelo) currentComp.mecanismo_unico = modelo;

    // Diferencial → ponto_forte
    const diferencial = extractListValue(block, "Diferencial") || extractListValue(block, "Posicionamento");
    if (diferencial) currentComp.ponto_forte = diferencial;

    // Ads
    const statusAds = extractListValue(block, "Status anunciante") || extractListValue(block, "Anunciante");
    if (statusAds) currentComp.ads_ativos = /ATIVO|SIM|YES/i.test(statusAds);

    // Preço
    const precoVal = extractListValue(block, "Preço") || extractListValue(block, "Ticket");
    const priceMatch = block.match(/R\$\s*[\d.,]+/i);
    if (precoVal) currentComp.preco = precoVal;
    else if (priceMatch) currentComp.preco = priceMatch[0];

    // Site / URL
    const siteVal = extractListValue(block, "Site") || extractListValue(block, "URL");
    if (siteVal) {
      const first = siteVal.split(/\s*[|,]\s*/)[0].trim();
      if (first.length > 3) currentComp.url = first.startsWith("http") ? first : `https://${first}`;
    }

    // Hotmart + plataforma → stack_tecnologico
    const stack: string[] = [];
    const hotmartLine = extractListValue(block, "Hotmart");
    if (hotmartLine) {
      const code = hotmartLine.split(/[\s—\-]/)[0].trim();
      stack.push(`Hotmart: ${code}`);
    }
    const plataforma = extractListValue(block, "Plataforma");
    if (plataforma) stack.push(plataforma);
    if (stack.length) currentComp.stack_tecnologico = stack;

    // Ameaça → insights prefix
    const ameacaRaw = extractListValue(block, "Ameaça ao JP");
    if (ameacaRaw) {
      const nivel = ameacaRaw.split(/[—\-]/)[0].trim().toUpperCase();
      currentComp.insights = `AMEAÇA: ${nivel}`;
    }

    competitors.push(currentComp);
    currentComp = null;
    compLines = [];
  };

  for (const line of content.split("\n")) {
    const tierMatch = line.match(/^##\s*TIER\s*(\d+)/i);
    if (tierMatch) { flush(); currentTier = parseInt(tierMatch[1]); continue; }

    const compMatch = line.match(/^###\s*\d+\.\s*(.+)/);
    if (compMatch) {
      flush();
      const rawName = compMatch[1].trim();
      currentComp = {
        name: rawName.replace(/\s*\/\s*/g, " / "),
        score_escala: currentTier === 1 ? 8.5 : currentTier === 2 ? 6 : 4,
        score_max: 10,
      };
      compLines = [];
      continue;
    }

    if (currentComp) compLines.push(line);
  }
  flush();

  return competitors;
}

function detectAndParse(content: string): { competitors: Partial<ParsedCompetitor>[]; type: string } {
  const lower = content.toLowerCase();

  // Mapa completo de concorrentes (_concorrentes.md format)
  if (
    lower.includes("mapa completo de concorrentes") ||
    lower.includes("mapa competitivo completo") ||
    (lower.includes("## tier 1") && lower.includes("ameaça ao jp"))
  ) {
    return { competitors: parseMapaConcorrentes(content), type: "mapa" };
  }

  if (lower.includes("dossiê competitivo") || lower.includes("dossie competitivo")) {
    return { competitors: [parseDossie(content)], type: "dossiê" };
  }

  // Improved ofertas detection — more flexible patterns
  if (
    lower.includes("análise de ofertas") || lower.includes("analise de ofertas") ||
    lower.includes("ofertas validadas") || lower.includes("ofertas escaladas") ||
    lower.includes("ofertas rankeadas") ||
    (lower.includes("score de validação") && lower.includes("### #1"))
  ) {
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

async function saveFileAsDoc(projectId: string, fileName: string, content: string) {
  try {
    await supabase.from("imphq_docs").insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      title: `Concorrentes — ${fileName}`,
      content,
    } as any);
  } catch (e) {
    // Silent fail
  }
}

export function CompetitorImporter({ open, onClose, onImport, projectId }: Props) {
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

  const handleImport = async () => {
    if (parsed.length === 0) return;
    onImport(parsed);

    // Save files as docs
    if (projectId) {
      for (const f of files) {
        if (f.name !== "manual") {
          await saveFileAsDoc(projectId, f.name, f.content);
        }
      }
    }

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
