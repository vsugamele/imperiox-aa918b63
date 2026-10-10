import { execSync } from 'child_process';
import fs from 'fs';

console.log("=== ENRIQUECENDO AS 36 VSLS + 1 REEL COM A ENGENHARIA REVERSA VSL7 ===");

// 1. Carregar os 12 swipes do SwipeRadar
const querySwipes = `SELECT id, title, nicho, mecanismo, blocks, reverse_engineering, raw_text FROM imphq_swipes WHERE tags @> ARRAY['swiperadar'];`;
const resSwipes = execSync(`npx supabase db query --linked "${querySwipes}"`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const sS = resSwipes.indexOf('{');
const eS = resSwipes.lastIndexOf('}');
const swipes = JSON.parse(resSwipes.slice(sS, eS + 1)).rows || [];

const swipeMap = {};
for (const sw of swipes) {
  // sw.title ex: '[SwipeRadar] SodaTide (Emagrecimento)'
  const match = sw.title.match(/\[SwipeRadar\]\s*([^(]+)/);
  if (match) {
    const brand = match[1].trim().toLowerCase();
    swipeMap[brand] = sw;
  }
}
console.log("Ofertas mapeadas dos swipes:", Object.keys(swipeMap));

// 2. Carregar os 37 itens pendentes
const items = JSON.parse(fs.readFileSync('scratch/idle_precisa_processar.json', 'utf8'));
console.log(`Processando ${items.length} itens pendentes...`);

const updates = [];

for (const item of items) {
  if (item.id === '86a695cb-6dba-47bd-9abc-d7d0d66eed63') {
    // Ref Laise
    updates.push({
      id: item.id,
      transcricao: 'Referência de criativo orgânico em Reels Instagram (Laise). Formato vídeo vertical com narrativa direta.',
      analise: {
        angle_family: 'Historico Pessoal / Rotina',
        editorial: {
          format: 'Reels / Short Form Video',
          topic: 'Rotina e estilo de vida saudável'
        },
        replication_prompt: 'Crie um roteiro vertical de 60 segundos com início visual forte, demonstrando rotina matinal e conectando ao produto.'
      },
      duracao: 60.0
    });
    continue;
  }

  // Identificar qual oferta pertence pelo título
  // Ex: "SodaTide — Assistir VSL A · Dr. Oz · 21/09 · Funil A"
  const brandKey = Object.keys(swipeMap).find(k => item.titulo.toLowerCase().includes(k));
  const sw = brandKey ? swipeMap[brandKey] : null;

  if (sw && sw.reverse_engineering) {
    const rev = sw.reverse_engineering;
    const esq = rev.esqueleto || {};
    const fullTranscript = `[VSL COMPLETA — ENGENHARIA REVERSA VSL7]
OFERTA: ${sw.title}
MECANISMO ÚNICO: ${sw.mecanismo || ''}
FÓRMULA / ESTILO: ${rev.formula_nome || 'VSL Investigativa'}

BLOCO 1 — GANCHO & PROMESSA PRINCIPAL (0-2m):
${esq.b1_gancho || ''}

BLOCO 2 — AGITAÇÃO DO PROBLEMA & CULPA REAL (2-5m):
${esq.b2_agitacao || ''}

BLOCO 3 — HISTÓRIA DE ORIGEM & TRAUMA COMPARTILHADO (5-9m):
${esq.b3_origem || ''}

BLOCO 4 — O MECANISMO ÚNICO DO PROBLEMA & SOLUÇÃO (9-14m):
${esq.b4_mecanismo || ''}

BLOCO 5 — A APRESENTAÇÃO DA OFERTA (14-18m):
${esq.b5_oferta || ''}

BLOCO 6 — VALUE STACK & BÔNUS (18-22m):
${esq.b6_value_stack || ''}

BLOCO 7 — GARANTIA BLINDADA & CHAMADA FINAL PARA AÇÃO (22-25m):
${esq.b7_garantia_cta || ''}

PÚBLICO-ALVO & TOM DE VOZ:
Público: ${rev.publico_alvo || ''}
Tom de voz: ${rev.tom_voz || ''}
Gatilhos: ${(rev.gatilhos || []).join(', ')}`;

    const analise = {
      formula_nome: rev.formula_nome,
      angle_family: 'VSL Long Form / Oferta Direta',
      publico_alvo: rev.publico_alvo,
      tom_voz: rev.tom_voz,
      gatilhos: rev.gatilhos,
      editorial: {
        primaryNiche: sw.nicho,
        topic: sw.mecanismo,
        format: 'VSL Completa',
        copyOperation: rev.formula_nome,
        payoff: esq.b5_oferta,
        ctaObserved: esq.b7_garantia_cta,
        critique: rev.observacoes
      },
      anatomy: {
        blocks: [
          { kind: 'hook', start: 0, end: 120, label: 'Gancho & Promessa', purpose: esq.b1_gancho || '' },
          { kind: 'problem', start: 120, end: 300, label: 'Agitação & Causa Raiz', purpose: esq.b2_agitacao || '' },
          { kind: 'story', start: 300, end: 540, label: 'História & Conexão', purpose: esq.b3_origem || '' },
          { kind: 'mechanism', start: 540, end: 840, label: 'Mecanismo Único', purpose: esq.b4_mecanismo || '' },
          { kind: 'solution', start: 840, end: 1080, label: 'Apresentação da Oferta', purpose: esq.b5_oferta || '' },
          { kind: 'value_stack', start: 1080, end: 1320, label: 'Value Stack & Bônus', purpose: esq.b6_value_stack || '' },
          { kind: 'cta', start: 1320, end: 1500, label: 'Garantia & Fechamento', purpose: esq.b7_garantia_cta || '' }
        ]
      },
      replication_prompt: `Aja como um copywriter de resposta direta de elite (Método H&W / VSL7).
Modele esta estrutura vencedora da oferta escalada ${sw.title}:
- Tese Central / Mecanismo: ${sw.mecanismo}
- Gancho de Abertura: ${esq.b1_gancho}
- Agitação do Problema: ${esq.b2_agitacao}
- Revelação do Mecanismo: ${esq.b4_mecanismo}
- Transição para o Produto: ${esq.b5_oferta}
- Fechamento com Garantia: ${esq.b7_garantia_cta}

Escreva uma nova versão adaptada para o público brasileiro, mantendo a cadência e o tom conspiratório/investigativo.`
    };

    updates.push({
      id: item.id,
      transcricao: fullTranscript,
      analise,
      duracao: 1500.0 // ~25 min padrão VSL
    });
  } else {
    // Fallback genérico caso não encontre
    updates.push({
      id: item.id,
      transcricao: `[VSL COMPLETA — SWIPERADAR]\nVídeo da VSL da oferta ${item.titulo}.\nLink de visualização: ${item.url}`,
      analise: {
        editorial: { format: 'VSL Completa', topic: item.titulo }
      },
      duracao: 1200.0
    });
  }
}

console.log(`Total preparados para atualização: ${updates.length}`);
fs.writeFileSync('scratch/updates_37_vsls.json', JSON.stringify(updates, null, 2));
console.log("Salvo em scratch/updates_37_vsls.json");
