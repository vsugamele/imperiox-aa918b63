import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: any) => void;
  projectId?: string;
}

function extractText(el: Element | null): string {
  return el?.textContent?.trim() || "";
}

function parseDesireItems(container: Element | null): any[] {
  if (!container) return [];

  // Primary: .desejo-card format (JP Freitas HTML)
  const desejoCards = container.querySelectorAll(".desejo-card");
  if (desejoCards.length) {
    return Array.from(desejoCards).map((el, i) => {
      const rank = extractText(el.querySelector(".dc-rank")) || String(i + 1);
      const nome = extractText(el.querySelector(".dc-name"));
      const scoreText = extractText(el.querySelector(".dc-score-pill"));
      const score = parseFloat(scoreText) || 0;
      const tags = Array.from(el.querySelectorAll(".dc-tag.hi, .dc-tag")).map(t => extractText(t));
      const justificativa = tags.filter(Boolean).join(" · ");
      return { rank, nome, score, justificativa };
    }).filter(item => item.nome);
  }

  // Fallback: .desire-item format
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

  // ── Filtro de Demanda (stat-bar + score table from M1) ──
  const statCells = doc.querySelectorAll("#mod-avatar .stat-cell, .stat-bar .stat-cell, .stat-cell");
  if (statCells.length) {
    result.filtro_demanda = Array.from(statCells).map(cell => ({
      valor: extractText(cell.querySelector(".stat-n")),
      label: extractText(cell.querySelector(".stat-l")),
    }));
  }

  // ── Score Table (Module 03 - #problemas-tabela .score-table) ──
  const scoreTable = doc.querySelector("#problemas-tabela .score-table, .score-table");
  if (scoreTable) {
    const headers = Array.from(scoreTable.querySelectorAll("thead th")).map(h => extractText(h));
    // Headers: Problema, Dor, Desejo, Piora, Veloc., Pagar, Comun., Freq., TOTAL
    const scoreKeys = headers.slice(1, -1); // [Dor, Desejo, Piora, Veloc., Pagar, Comun., Freq.]

    const rows = Array.from(scoreTable.querySelectorAll("tbody tr")).filter(row => {
      // Skip divider rows (td with colspan attribute)
      const firstTd = row.querySelector("td");
      return firstTd && !firstTd.getAttribute("colspan") && firstTd.textContent?.trim();
    });

    result.problemas = rows.map((row, i) => {
      const cells = row.querySelectorAll("td");
      // cells[0] = Problema cell with embedded <span class="rank-badge">#N</span>
      const rankBadge = cells[0]?.querySelector(".rank-badge");
      const rankText = rankBadge ? extractText(rankBadge).replace("#", "") : String(i + 1);
      const rank = parseInt(rankText) || i + 1;

      // Nome: clone cells[0] and remove rank badge to get clean text
      const nomeEl = cells[0]?.cloneNode(true) as Element;
      nomeEl?.querySelector(".rank-badge")?.remove();
      const nome = nomeEl?.textContent?.trim() || "";

      const scores: Record<string, number> = {};
      scoreKeys.forEach((key, idx) => {
        // scores are in cells[1] through cells[scoreKeys.length]
        const scVal = cells[idx + 1]?.querySelector(".sc-val");
        scores[key.toLowerCase().replace(/[\s.]+/g, "_")] = parseInt(scVal ? extractText(scVal) : extractText(cells[idx + 1])) || 0;
      });

      const total = parseInt(extractText(cells[cells.length - 1])) || 0;
      return { rank, nome, total, scores };
    }).filter(p => p.nome);
  } else {
    // Fallback: .prob-table (used in multiple sections)
    const probTables = doc.querySelectorAll(".prob-table");
    probTables.forEach(table => {
      const rows = table.querySelectorAll("tbody tr");
      if (rows.length && !result.problemas) {
        const headers = Array.from(table.querySelectorAll("thead th")).map(h => extractText(h).toLowerCase());
        result.problemas = Array.from(rows).map((row, i) => {
          const cells = row.querySelectorAll("td");
          const item: any = { rank: i + 1 };
          headers.forEach((h, idx) => {
            const val = extractText(cells[idx]);
            if (h.includes("critério") || h.includes("problema") || h === "#") {
              if (h === "#") item.rank = parseInt(val) || i + 1;
              else item.nome = val;
            } else if (h.includes("score") || h.includes("total")) {
              item.total = parseInt(val.replace(/[^\d]/g, "")) || 0;
            } else if (h.includes("evidência") || h.includes("cena")) {
              item.cena_voyerismo = val;
            } else {
              item[h.replace(/\s+/g, "_")] = val;
            }
          });
          return item;
        });
      }
    });
  }

  // ── Desejos (by section ID or fallback) ──
  const desejosB2 = doc.querySelector("#desejos-b2, [id*='desejos-b2']");
  const desejosB3 = doc.querySelector("#desejos-b3, [id*='desejos-b3']");
  const desejosB4 = doc.querySelector("#desejos-b4, [id*='desejos-b4']");

  const externos = parseDesireItems(desejosB2);
  const internos = parseDesireItems(desejosB3);
  const proibidos = parseDesireItems(desejosB4);

  // Fallback with B1
  if (!externos.length && !internos.length && !proibidos.length) {
    const desejosB1 = doc.querySelector("#desejos-b1, [id*='desejos-b1']");
    const allSections = [desejosB1, desejosB2, desejosB3, desejosB4];
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

  // ── Blocos B5-B7: Vontades, Obsessões, Gostos ──
  for (const [id, key] of [["desejos-b5", "vontades"], ["desejos-b6", "obsessoes"], ["desejos-b7", "gostos"]] as const) {
    const section = doc.querySelector(`#${id}, [id*='${id}']`);
    if (section) {
      const items = Array.from(section.querySelectorAll(".desire-item, .card")).map(el => ({
        nome: extractText(el.querySelector(".desire-name, .card-title, .av-name")) || extractText(el),
        score: parseInt(extractText(el.querySelector(".desire-score")) || "0") || 0,
      })).filter(i => i.nome);
      if (items.length) result[key] = items;
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
        const val = extractText(f.querySelector(".scene-val, .scene-quote, p"));
        if (key.includes("situação") || key.includes("situacao")) data.situacao = val;
        if (key.includes("sintoma")) data.sintoma_fisico = val;
        if (key.includes("pensamento") || key.includes("diz")) data.pensamento = val;
        if (key.includes("comportamento") || key.includes("faz")) data.comportamento = val;
      });
      const quote = extractText(scene.querySelector(".scene-quote"));
      if (quote) data.pensamento = data.pensamento || quote;
      const forbidden = extractText(scene.querySelector(".scene-forbidden"));
      if (forbidden) data.proibido = forbidden;
      return data;
    });
  }

  // ── Camadas da Psique (C1-C4) — from .card or .acc-card ──
  const camadas: any = {};

  // Try .card elements first
  const cards = doc.querySelectorAll("#mod-avatar .card, .card");
  cards.forEach(card => {
    const label = extractText(card.querySelector(".card-label"));
    const content = extractText(card.querySelector(".card-content, .card-body, p"));
    if (label.includes("C1")) camadas.c1_observaveis = content;
    else if (label.includes("C2")) camadas.c2_conscientes = content;
    else if (label.includes("C3")) camadas.c3_subconscientes = content;
    else if (label.includes("C4")) camadas.c4_trauma = content;
  });

  // Also try .acc-card for C1-C4 (accordion format)
  const accCards = doc.querySelectorAll(".acc-card");
  accCards.forEach(card => {
    const id = card.getAttribute("id") || "";
    const num = extractText(card.querySelector(".acc-num"));
    const title = extractText(card.querySelector(".acc-title"));
    const bodyItems = Array.from(card.querySelectorAll(".acc-body .dl li, .acc-body li")).map(li => extractText(li));
    const bodyText = bodyItems.length ? bodyItems.join(" • ") : extractText(card.querySelector(".acc-body"));

    if (num === "C1" || id.includes("-c1")) camadas.c1_observaveis = bodyText || camadas.c1_observaveis;
    else if (num === "C2" || id.includes("-c2")) camadas.c2_conscientes = bodyText || camadas.c2_conscientes;
    else if (num === "C3" || id.includes("-c3")) camadas.c3_subconscientes = bodyText || camadas.c3_subconscientes;
    else if (num === "C4" || id.includes("-c4")) camadas.c4_trauma = bodyText || camadas.c4_trauma;
  });
  if (Object.keys(camadas).length) result.camadas_psique = camadas;

  // ── Dores de C2 (Frustrações verbalizadas) ──
  const c2El = doc.querySelector("#avatar-c2, [id='avatar-c2']");
  if (c2El && !result.dores_superficiais?.length) {
    const allDls = c2El.querySelectorAll(".dl");
    allDls.forEach(dl => {
      const prevLabel = extractText(dl.previousElementSibling).toLowerCase();
      if (prevLabel.includes("frustr")) {
        const items = Array.from(dl.querySelectorAll("li")).map(li => extractText(li)).filter(Boolean);
        if (items.length) result.dores_superficiais = items;
      }
    });
  }

  // ── Dores profundas de C3 (Contradições + Rituais) ──
  const c3El = doc.querySelector("#avatar-c3, [id='avatar-c3']");
  if (c3El && !result.dores_profundas?.length) {
    const redDls = c3El.querySelectorAll(".dl.red");
    if (redDls.length) {
      const items: string[] = [];
      redDls.forEach(dl => {
        Array.from(dl.querySelectorAll("li")).forEach(li => {
          const text = extractText(li);
          if (text) items.push(text);
        });
      });
      if (items.length) result.dores_profundas = items.slice(0, 8);
    }
  }

  // ── Medos de C4 (Vergonhas silenciosas) ──
  const c4El = doc.querySelector("#avatar-c4, [id='avatar-c4']");
  if (c4El && !result.medos?.length) {
    const redDls = c4El.querySelectorAll(".dl.red");
    if (redDls.length) {
      const items: string[] = [];
      redDls.forEach(dl => {
        Array.from(dl.querySelectorAll("li")).forEach(li => {
          const text = extractText(li);
          if (text) items.push(text);
        });
      });
      if (items.length) result.medos = items.slice(0, 5);
    }
  }

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
      etapa: extractText(item.querySelector(".cycle-step, .cycle-num, .cycle-label, strong")),
      descricao: extractText(item.querySelector(".cycle-text, .cycle-desc, .cycle-content, p")),
    }));
  }

  // ── Emotion Flow (.em-step) ──
  const emSteps = doc.querySelectorAll(".em-step");
  if (emSteps.length) {
    result.emocoes_sequencia = Array.from(emSteps).map(step => ({
      numero: extractText(step.querySelector(".em-num")),
      nome: extractText(step.querySelector(".em-name")),
      descricao: extractText(step.querySelector(".em-desc")),
    })).filter(e => e.nome);
  }

  // ── Movimentos ──
  const movements = doc.querySelectorAll(".movement");
  if (movements.length) {
    result.movimentos = Array.from(movements).map(m => ({
      nome: extractText(m.querySelector(".mov-title, .movement-title, h4, strong")),
      descricao: extractText(m.querySelector(".mov-desc, .mov-body, .movement-desc, p")),
    }));
  }

  // ── Perfil Psicológico (#desejos-b1 .perfil-box) ──
  const desejoB1 = doc.querySelector("#desejos-b1");
  if (desejoB1) {
    const perfilBox = desejoB1.querySelector(".perfil-box");
    if (perfilBox) {
      const perfil: Record<string, string> = {};
      // Retrato: one or two .perfil-text paragraphs
      const perfilTexts = Array.from(perfilBox.querySelectorAll(".perfil-text"))
        .map(p => extractText(p)).filter(Boolean);
      if (perfilTexts.length) perfil.retrato = perfilTexts.join("\n\n");
      // pg-item: Arquétipo, Ferida Central, Padrão Comportamental, Contradição Central
      perfilBox.querySelectorAll(".pg-item").forEach(item => {
        const label = extractText(item.querySelector(".pg-label")).toLowerCase();
        const val = extractText(item.querySelector(".pg-val"));
        if (label.includes("arqué") || label.includes("arque")) perfil.arquetipo = val;
        else if (label.includes("ferida")) perfil.ferida_central = val;
        else if (label.includes("padrão") || label.includes("padrao")) perfil.padrao = val;
        else if (label.includes("contradição") || label.includes("contradicao")) perfil.contradicao = val;
      });
      if (Object.keys(perfil).length) result.perfil_psicologico = perfil;
    }
  }

  // ── Handoff (.hi) ──
  const hiItems = doc.querySelectorAll(".hi");
  if (hiItems.length) {
    result.handoff = Array.from(hiItems).map(item => ({
      numero: extractText(item.querySelector(".hi-num")),
      texto: extractText(item.querySelector(".hi-text")),
    }));
  } else {
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

  // ── Headlines (.hl-card) — Copy Arsenal ──
  const hlCards = doc.querySelectorAll(".hl-card");
  if (hlCards.length) {
    result.headlines = Array.from(hlCards).map(card => ({
      categoria: extractText(card.querySelector(".hl-cat")),
      texto: extractText(card.querySelector(".hl-text")),
    }));
  }

  // ── Anúncios (.ad-card) — Copy Arsenal ──
  const adCards = doc.querySelectorAll(".ad-card");
  if (adCards.length) {
    result.anuncios = Array.from(adCards).map(card => {
      const angulo = extractText(card.querySelector(".ad-angle"));
      const avatar = extractText(card.querySelector(".ad-avatar"));
      const sections = card.querySelectorAll(".ad-section");
      const data: any = { angulo, avatar_alvo: avatar };
      sections.forEach(s => {
        const key = extractText(s.querySelector(".ad-key")).toLowerCase();
        const text = extractText(s.querySelector(".ad-text, .ad-hook"));
        if (key.includes("hook")) data.hook = text;
        else if (key.includes("corpo") || key.includes("body")) data.corpo = text;
        else if (key.includes("cta")) data.cta = text;
        else data[key.replace(/\s+/g, "_")] = text;
      });
      const cta = extractText(card.querySelector(".ad-cta"));
      if (cta && !data.cta) data.cta = cta;
      return data;
    });
  }

  // ── VSL Timeline (.vsl-block) ──
  const vslBlocks = doc.querySelectorAll(".vsl-block");
  if (vslBlocks.length) {
    result.vsl_timeline = Array.from(vslBlocks).map(block => ({
      tempo: extractText(block.querySelector(".vsl-time")),
      titulo: extractText(block.querySelector(".vsl-title")),
      corpo: extractText(block.querySelector(".vsl-body")),
    }));
  }

  // ── Página de Vendas (.copy-block) ──
  const copyBlocks = doc.querySelectorAll(".copy-block");
  if (copyBlocks.length) {
    result.pagina_vendas = Array.from(copyBlocks).map(block => ({
      label: extractText(block.querySelector(".cb-label")),
      titulo: extractText(block.querySelector(".cb-title")),
      corpo: extractText(block.querySelector(".cb-body")),
      nota: extractText(block.querySelector(".cb-note")),
    }));
  }

  // ── Objeções (.obj-card) ──
  const objCards = doc.querySelectorAll(".obj-card");
  if (objCards.length) {
    result.objecoes = Array.from(objCards)
      .map(card => extractText(card.querySelector(".obj-q")))
      .filter(Boolean);
  }

  // ── Value Stack (.vs-item) ──
  const vsItems = doc.querySelectorAll(".vs-item");
  if (vsItems.length) {
    result.value_stack = Array.from(vsItems).map(item => ({
      numero: extractText(item.querySelector(".vs-num")),
      titulo: extractText(item.querySelector(".vs-title")),
      valor: extractText(item.querySelector(".vs-value")),
      principal: item.classList.contains("main"),
    }));
  }

  // ── Upsell Steps (.upsell-step) ──
  const upsellSteps = doc.querySelectorAll(".upsell-step");
  if (upsellSteps.length) {
    result.upsell_steps = Array.from(upsellSteps).map(step => ({
      label: extractText(step.querySelector(".us-label")),
      texto: extractText(step.querySelector(".us-text")),
    }));
  }

  // ── Gatilhos Detalhados (.gat-card) — Desejos module ──
  const gatCards = doc.querySelectorAll(".gat-card");
  if (gatCards.length) {
    result.gatilhos_detalhados = Array.from(gatCards).map(card => {
      const titulo = extractText(card.querySelector(".gat-title, .gat-header"));
      const fields = card.querySelectorAll(".gat-field");
      const data: any = { titulo };
      fields.forEach(f => {
        const label = extractText(f.querySelector(".gf-label")).toLowerCase().replace(/\s+/g, "_");
        const text = extractText(f.querySelector(".gf-text, .gf-quote"));
        if (label && text) data[label] = text;
      });
      return data;
    });
  }

  // ── Fases de Ativação (.atv-phase) ──
  const phases = doc.querySelectorAll(".atv-phase");
  if (phases.length) {
    result.fases_ativacao = Array.from(phases).map(phase => ({
      numero: extractText(phase.querySelector(".atv-num")),
      fase: extractText(phase.querySelector(".atv-fase")),
      tecnica: extractText(phase.querySelector(".atv-tec")),
      corpo: extractText(phase.querySelector(".atv-body")),
      copy: extractText(phase.querySelector(".atv-copy")),
      porque: extractText(phase.querySelector(".atv-why")),
    }));
  }

  // ── Content Plan (.content-week) ──
  const contentWeeks = doc.querySelectorAll(".content-week");
  if (contentWeeks.length) {
    result.plano_conteudo = Array.from(contentWeeks).map(week => {
      const weekNum = extractText(week.querySelector(".cw-week"));
      const weekTitle = extractText(week.querySelector(".cw-title"));
      const pieces = Array.from(week.querySelectorAll(".cw-piece")).map(piece => ({
        numero: extractText(piece.querySelector(".cw-n")),
        titulo: extractText(piece.querySelector(".cw-piece-title")),
        hook: extractText(piece.querySelector(".cw-piece-hook")),
        formato: extractText(piece.querySelector(".cw-piece-format")),
      }));
      return { semana: weekNum, titulo: weekTitle, pecas: pieces };
    });
  }

  // ── Word clouds (.word-list .word + .wpill) ──
  // Primary: .wpill elements (classes: .dor, .desejo, .solucao, .validacao)
  const wpillItems = doc.querySelectorAll(".wpill");
  if (wpillItems.length) {
    const palavras_dor: string[] = [];
    const palavras_desejo: string[] = [];
    const palavras_solucao: string[] = [];
    const palavras_valor: string[] = [];
    wpillItems.forEach(w => {
      const text = extractText(w);
      if (!text) return;
      if (w.classList.contains("dor")) palavras_dor.push(text);
      else if (w.classList.contains("desejo")) palavras_desejo.push(text);
      else if (w.classList.contains("solucao")) palavras_solucao.push(text);
      else if (w.classList.contains("validacao")) palavras_valor.push(text);
    });
    if (palavras_dor.length) result.palavras_dor = palavras_dor;
    if (palavras_desejo.length) result.palavras_desejo = palavras_desejo;
    if (palavras_solucao.length) result.palavras_solucao = palavras_solucao;
    if (palavras_valor.length) result.palavras_valor = palavras_valor;
  }

  // Fallback: .word-list .word or .word-cloud .word
  if (!result.palavras_dor && !result.palavras_desejo) {
    const wordItems = doc.querySelectorAll(".word-list .word, .word-cloud .word");
    if (wordItems.length) {
      const palavras_dor: string[] = [];
      const palavras_desejo: string[] = [];
      const palavras_solucao: string[] = [];
      const palavras_valor: string[] = [];
      wordItems.forEach(w => {
        const text = extractText(w);
        if (w.classList.contains("dor")) palavras_dor.push(text);
        else if (w.classList.contains("desejo") || w.classList.contains("des")) palavras_desejo.push(text);
        else if (w.classList.contains("solucao") || w.classList.contains("sol")) palavras_solucao.push(text);
        else if (w.classList.contains("validacao") || w.classList.contains("val")) palavras_valor.push(text);
      });
      if (palavras_dor.length) result.palavras_dor = palavras_dor;
      if (palavras_desejo.length) result.palavras_desejo = palavras_desejo;
      if (palavras_solucao.length) result.palavras_solucao = palavras_solucao;
      if (palavras_valor.length) result.palavras_valor = palavras_valor;
    }
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

  // ── Síntese Final ──
  const sintCards = doc.querySelectorAll(".sint-card");
  if (sintCards.length) {
    result.sintese = Array.from(sintCards).map(card => ({
      titulo: extractText(card.querySelector(".sint-title, .sint-label, h4, strong")),
      conteudo: extractText(card.querySelector(".sint-body, .sint-content, p")),
    }));
  }

  // ── Guarantee ──
  const guarantee = doc.querySelector(".guarantee-box");
  if (guarantee) {
    result.garantia = {
      titulo: extractText(guarantee.querySelector(".gb-title")),
      corpo: extractText(guarantee.querySelector(".gb-body")),
    };
  }

  // ── Sub-avatares completos ──
  const avatarCards = doc.querySelectorAll(".avatar-card");
  const subAvatares: any[] = [];
  avatarCards.forEach(card => {
    const nome = extractText(card.querySelector(".av-name"));
    if (!nome) return;
    const sub: any = { nome };

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
      else if (key.includes("asset") || key.includes("ativo")) sub.asset_primario = val;
      else if (key.includes("objeção") || key.includes("objecao")) sub.objecao = val;
      else if (key.includes("dado") || key.includes("tempo")) sub[key.replace(/\s+/g, "_")] = val;
    });

    if (!sub.descricao) {
      sub.descricao = extractText(card.querySelector(".av-situation")) || "";
    }

    // Extract beliefs from av-belief
    const beliefs = card.querySelectorAll(".av-belief");
    beliefs.forEach(b => {
      if (b.classList.contains("needed")) sub.crenca_necessaria = extractText(b);
      else sub.crenca_bloqueadora = extractText(b);
    });

    // Extract hook
    const hookEl = card.querySelector(".av-hook");
    if (hookEl && !sub.hook) sub.hook = extractText(hookEl);

    if (!sub.urgencia) sub.urgencia = 3;
    if (!sub.dinheiro) sub.dinheiro = 3;

    subAvatares.push(sub);
  });
  if (subAvatares.length) result.sub_avatares = subAvatares;

  if (subAvatares.length && !result.objecoes?.length) {
    const objs = subAvatares.map((s: any) => s.objecao).filter(Boolean);
    if (objs.length) result.objecoes = objs;
  }

  // Derive desejo_externo and desejo_interno from first items of arrays
  if (!result.desejo_externo && result.desejos_externos?.[0]) {
    result.desejo_externo = result.desejos_externos[0].nome;
  }
  if (!result.desejo_interno && result.desejos_internos?.[0]) {
    result.desejo_interno = result.desejos_internos[0].nome;
  }

  // Map gatilhos_detalhados → gatilhos (compatible structure)
  if (result.gatilhos_detalhados?.length && !result.gatilhos?.length) {
    result.gatilhos = result.gatilhos_detalhados.map((g: any) => ({
      nome: g.titulo || "",
      categoria: g.categoria || g.tipo || "",
      intensidade: g.intensidade || g.intensidade_emocional || "",
      situacao: g.situacao || g.contexto || g.fase_atual || "",
      copy_sugerido: g.copy || g.frase_gatilho || g.texto || "",
    }));
  }

  // Try to extract gatilho_nuclear / the_high / the_hell from handoff items
  if (result.handoff?.length) {
    result.handoff.forEach((item: any) => {
      const txt = String(item.texto || item.descricao || "").toLowerCase();
      const full = String(item.texto || item.descricao || "");
      if (!result.gatilho_nuclear && (txt.includes("nuclear") || txt.includes("gatilho"))) result.gatilho_nuclear = full;
      if (!result.the_high && (txt.includes("high") || txt.includes("melhor momento") || txt.includes("sonho"))) result.the_high = full;
      if (!result.the_hell && (txt.includes("hell") || txt.includes("pior cenário") || txt.includes("pesadelo"))) result.the_hell = full;
      if (!result.segredo_final && (txt.includes("segredo") || txt.includes("compra"))) result.segredo_final = full;
    });
  }

  return result;
}

function getImportSummary(data: any): { label: string; count: number; emoji: string }[] {
  const items: { label: string; count: number; emoji: string }[] = [];
  if (data.filtro_demanda?.length) items.push({ label: "Filtro de Demanda", count: data.filtro_demanda.length, emoji: "📊" });
  if (data.desejos_externos?.length) items.push({ label: "Desejos Externos", count: data.desejos_externos.length, emoji: "💎" });
  if (data.desejos_internos?.length) items.push({ label: "Desejos Internos", count: data.desejos_internos.length, emoji: "🔮" });
  if (data.desejos_proibidos?.length) items.push({ label: "Desejos Proibidos", count: data.desejos_proibidos.length, emoji: "🚫" });
  if (data.vontades?.length) items.push({ label: "Vontades (B5)", count: data.vontades.length, emoji: "🔥" });
  if (data.obsessoes?.length) items.push({ label: "Obsessões (B6)", count: data.obsessoes.length, emoji: "💭" });
  if (data.gostos?.length) items.push({ label: "Gostos (B7)", count: data.gostos.length, emoji: "❤️" });
  if (data.problemas?.length) items.push({ label: "Problemas Rankeados", count: data.problemas.length, emoji: "🎯" });
  if (data.categorias_problemas?.length) items.push({ label: "Categorias de Problemas", count: data.categorias_problemas.length, emoji: "📂" });
  if (data.voyerismos?.length) items.push({ label: "Cenas de Voyerismo", count: data.voyerismos.length, emoji: "👁️" });
  if (data.sub_avatares?.length) items.push({ label: "Sub-Avatares", count: data.sub_avatares.length, emoji: "🧠" });
  if (data.camadas_psique) items.push({ label: "Camadas da Psique", count: Object.keys(data.camadas_psique).length, emoji: "🧬" });
  if (data.perfil_psicologico) items.push({ label: "Perfil Psicológico", count: Object.keys(data.perfil_psicologico).length, emoji: "🪞" });
  if (data.emocoes_sequencia?.length) items.push({ label: "Sequência de Emoções", count: data.emocoes_sequencia.length, emoji: "🌊" });
  if (data.ciclo_sabotagem?.length) items.push({ label: "Ciclo de Sabotagem", count: data.ciclo_sabotagem.length, emoji: "🔄" });
  if (data.movimentos?.length) items.push({ label: "Movimentos", count: data.movimentos.length, emoji: "🏃" });
  if (data.handoff?.length) items.push({ label: "Handoff Items", count: data.handoff.length, emoji: "📋" });
  if (data.headlines?.length) items.push({ label: "Headlines (Copy)", count: data.headlines.length, emoji: "📝" });
  if (data.anuncios?.length) items.push({ label: "Anúncios (Copy)", count: data.anuncios.length, emoji: "📢" });
  if (data.vsl_timeline?.length) items.push({ label: "VSL Timeline", count: data.vsl_timeline.length, emoji: "🎬" });
  if (data.pagina_vendas?.length) items.push({ label: "Página de Vendas", count: data.pagina_vendas.length, emoji: "🛒" });
  if (data.value_stack?.length) items.push({ label: "Value Stack", count: data.value_stack.length, emoji: "💰" });
  if (data.upsell_steps?.length) items.push({ label: "Upsell Steps", count: data.upsell_steps.length, emoji: "⬆️" });
  if (data.gatilhos_detalhados?.length) items.push({ label: "Gatilhos Detalhados", count: data.gatilhos_detalhados.length, emoji: "⚡" });
  if (data.fases_ativacao?.length) items.push({ label: "Fases de Ativação", count: data.fases_ativacao.length, emoji: "🚀" });
  if (data.plano_conteudo?.length) items.push({ label: "Plano de Conteúdo", count: data.plano_conteudo.length, emoji: "📅" });
  if (data.sintese?.length) items.push({ label: "Síntese Final", count: data.sintese.length, emoji: "✨" });
  if (data.garantia) items.push({ label: "Garantia", count: 1, emoji: "✅" });
  if (data.palavras_dor?.length) items.push({ label: "Palavras de Dor", count: data.palavras_dor.length, emoji: "🩸" });
  if (data.palavras_desejo?.length) items.push({ label: "Palavras de Desejo", count: data.palavras_desejo.length, emoji: "💫" });
  if (data.palavras_solucao?.length) items.push({ label: "Palavras de Solução", count: data.palavras_solucao.length, emoji: "🔑" });
  if (data.palavras_valor?.length) items.push({ label: "Palavras de Valor", count: data.palavras_valor.length, emoji: "⭐" });
  if (data.dores_superficiais?.length) items.push({ label: "Dores Superficiais", count: data.dores_superficiais.length, emoji: "🩸" });
  if (data.dores_profundas?.length) items.push({ label: "Dores Profundas", count: data.dores_profundas.length, emoji: "🔴" });
  if (data.medos?.length) items.push({ label: "Medos", count: data.medos.length, emoji: "😰" });
  if (data.objecoes?.length) items.push({ label: "Objeções", count: data.objecoes.length, emoji: "🛡️" });
  if (data.frases_gatilho_dor?.length) items.push({ label: "Frases-Gatilho Dor", count: data.frases_gatilho_dor.length, emoji: "🗣️" });
  if (data.frases_gatilho_desejo?.length) items.push({ label: "Frases-Gatilho Desejo", count: data.frases_gatilho_desejo.length, emoji: "🗣️" });
  if (data.frases_gatilho_decisao?.length) items.push({ label: "Frases-Gatilho Decisão", count: data.frases_gatilho_decisao.length, emoji: "🗣️" });
  const singles = ["crenca_bloqueadora", "crenca_necessaria", "epifania_central", "gatilho_nuclear", "the_high", "the_hell"];
  const foundSingles = singles.filter(k => data[k]);
  if (foundSingles.length) items.push({ label: "Crenças & Gatilhos", count: foundSingles.length, emoji: "💡" });
  return items;
}

async function saveAsDoc(projectId: string, title: string, content: string) {
  try {
    await supabase.from("imphq_docs").insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      title,
      content,
    } as any);
  } catch (e) {
    // Silent fail — doc saving is optional
  }
}

export function AvatarImporter({ open, onClose, onImport, projectId }: Props) {
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doParse = useCallback((content: string) => {
    const parsed = parseAvatarHTML(content);
    setPreview(parsed);
    const keys = Object.keys(parsed);
    if (keys.length > 0) {
      toast.success(`${keys.length} seções encontradas`);
    } else {
      toast.error("Nenhum dado reconhecido no HTML");
    }
  }, []);

  const handleParse = () => {
    if (!html.trim()) {
      toast.error("Cole o HTML primeiro");
      return;
    }
    doParse(html);
  };

  const handleFileRead = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setHtml(content);
      setFileName(file.name);
      doParse(content);
      toast.success(`Arquivo "${file.name}" carregado`);
    };
    reader.readAsText(file);
  }, [doParse]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".html") || file.name.endsWith(".htm"))) {
      handleFileRead(file);
    } else {
      toast.error("Envie um arquivo .html");
    }
  }, [handleFileRead]);

  const handleImport = async () => {
    if (!preview) return;
    const dataWithHtml = { ...preview, html_original: html };
    onImport(dataWithHtml);

    // Save as doc if projectId available
    if (projectId && html) {
      const docTitle = fileName ? `Avatar HTML — ${fileName}` : "Avatar HTML Importado";
      await saveAsDoc(projectId, docTitle, html);
    }

    toast.success("Dados importados com sucesso!");
    setHtml("");
    setPreview(null);
    setFileName("");
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
            Arraste um arquivo .html ou cole o código manualmente abaixo.
          </p>

          {/* Dropzone */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleFileInput}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              dragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-secondary/50"
            }`}
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              📁 Arraste um arquivo .html aqui ou <span className="text-primary underline">clique para selecionar</span>
            </span>
          </div>

          <Textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            className="bg-secondary min-h-[150px] font-mono text-xs"
            placeholder="Ou cole o HTML completo aqui..."
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
