import { execSync } from 'child_process';
import fs from 'fs';

function queryDb(sql) {
  const cmd = `npx supabase db query --linked "${sql.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`;
  const res = execSync(cmd, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  const start = res.indexOf('{');
  const end = res.lastIndexOf('}');
  if (start === -1 || end === -1) return [];
  return JSON.parse(res.slice(start, end + 1)).rows || [];
}

console.log("=== ENRIQUECENDO TODOS OS SWIPES COM NICHO E REVERSE ENGINEERING ===");

const updates = [];

// 1. Atualizar nichos nulos baseados nas tags e títulos
updates.push(`
  -- SlimSoda ads
  UPDATE imphq_swipes
  SET nicho = 'Emagrecimento'
  WHERE (nicho IS NULL OR nicho = '' OR nicho = 'Sem nicho')
    AND ('ads-library-slimsoda' = ANY(tags) OR title ILIKE '%slimsoda%' OR title ILIKE '%bicarbonato%');

  -- O Código dos Cortes Perfeitos
  UPDATE imphq_swipes
  SET nicho = 'Beleza / Cabeleireiras'
  WHERE (nicho IS NULL OR nicho = '' OR nicho = 'Sem nicho')
    AND title ILIKE '%CORTES PERFEITOS%';

  -- Michael Fiore
  UPDATE imphq_swipes
  SET nicho = 'Relacionamento'
  WHERE (nicho IS NULL OR nicho = '' OR nicho = 'Sem nicho')
    AND (title ILIKE '%Michael Fiore%' OR title ILIKE '%Online Dating%');

  -- AffiliateNicheSites
  UPDATE imphq_swipes
  SET nicho = 'Afiliados / Negócios Digitais'
  WHERE (nicho IS NULL OR nicho = '' OR nicho = 'Sem nicho')
    AND title ILIKE '%AffiliateNicheSites%';

  -- Renan Matheus
  UPDATE imphq_swipes
  SET nicho = 'Tráfego Pago / Copy'
  WHERE (nicho IS NULL OR nicho = '' OR nicho = 'Sem nicho')
    AND title ILIKE '%Renan Matheus%';

  -- George Miller
  UPDATE imphq_swipes
  SET nicho = 'Prosperidade'
  WHERE title ILIKE '%George Miller%';

  -- Vídeos gerais
  UPDATE imphq_swipes
  SET nicho = 'Criativos / Social'
  WHERE (nicho IS NULL OR nicho = '' OR nicho = 'Sem nicho');
`);

// 2. Criar reverse engineering para os 20 swipes de Soulmate / Cartomante Astral
const soulmateSwipes = queryDb(`
  SELECT id, title, formato, blocks
  FROM imphq_swipes
  WHERE nicho ILIKE '%soulmate%' AND (reverse_engineering IS NULL OR reverse_engineering = '{}'::jsonb);
`);

console.log(`Encontrados ${soulmateSwipes.length} swipes de Soulmate para enriquecer com Engenharia Reversa...`);

soulmateSwipes.forEach(s => {
  const re = {
    __schema: 'vsl7',
    formula_nome: `Gancho de Curiosidade Mística (${s.formato || 'Astral / Soulmate'})`,
    gatilhos: ['Curiosidade romântica irresistível', 'Urgência emocional de perda', 'Validação intuitiva', 'Efeito profecia'],
    publico_alvo: 'Mulheres 25-55 anos com histórico de relacionamentos frustrados que desejam saber quando e quem é sua alma gêmea.',
    tom_voz: 'Místico, confidente, caloroso, enigmático e reconfortante.',
    ritmo: 'Gancho direto no início revelando um detalhe ultra-específico (inicial do nome, número de destino ou data de encontro) → transição para a leitura psíquica / desenho da alma gêmea.',
    observacoes: 'Formato amplamente validado em tráfego pago para infoprodutos de Cartomancia e Desenho da Alma Gêmea (Soulmate Sketch).',
    esqueleto: {
      b1_gancho: `Revelação mística direta: "${s.title}" para ativar a imaginação imediata da prospect.`,
      b2_agitacao: 'O cansaço de encontros superficiais e a dúvida dolorosa de estar deixando passar o amor da sua vida.',
      b3_origem: 'A conexão astrológica ancestral que conecta duas almas antes mesmo do nascimento físico.',
      b4_mecanismo: 'Mapa Vibracional da Alma Gêmea: leitura das posições de Vênus e Marte no momento da consulta.',
      b5_oferta: 'Retrato desenhado da alma gêmea + análise detalhada de personalidade e data aproximada do encontro.',
      b6_value_stack: 'Guia de compatibilidade amorosa + oração de proteção e atração magnética.',
      b7_garantia_cta: 'Garantia de 30 dias com devolução sem perguntas.'
    }
  };

  const escapedJson = "'" + JSON.stringify(re).replace(/'/g, "''") + "'::jsonb";
  updates.push(`UPDATE imphq_swipes SET reverse_engineering = ${escapedJson} WHERE id = '${s.id}';`);
});

// 3. O Código dos Cortes Perfeitos
const cortesSwipes = queryDb(`
  SELECT id, title, formato
  FROM imphq_swipes
  WHERE title ILIKE '%CORTES PERFEITOS%' AND (reverse_engineering IS NULL OR reverse_engineering = '{}'::jsonb);
`);

console.log(`Encontrados ${cortesSwipes.length} swipes de Cortes Perfeitos...`);

cortesSwipes.forEach(s => {
  const re = {
    __schema: 'vsl7',
    formula_nome: `Método de Precificação e Autoridade para Salões de Beleza (${s.formato})`,
    gatilhos: ['Alívio de sobrecarga de trabalho', 'Fim do medo de cobrar caro', 'Reconhecimento profissional', 'Diferenciação técnica'],
    publico_alvo: 'Cabeleireiras e donas de salão que trabalham 12h por dia mas não veem a cor do dinheiro porque têm medo de aumentar os preços.',
    tom_voz: 'Prático, direto, empático e de mentora para profissional.',
    ritmo: 'Ataque à crença do "preço baixo é generosidade" → demonstração da técnica de corte perfeito e valor percebido → fechamento de curso/mentoria.',
    observacoes: 'Funil multi-canal estruturado em 5 ângulos de criativos, sequência de WhatsApp X1, roteiros de Reels, LP de alta conversão e VSL Método E3.',
    esqueleto: {
      b1_gancho: '“Cabeleireira: cobrar barato não é generosidade, é o sintoma que está falindo seu salão aos poucos.”',
      b2_agitacao: 'A dor nas costas após 10 horas em pé, clientes que reclamam de R$ 5 de aumento e a sensação de trabalhar muito sem sobrar nada no fim do mês.',
      b3_origem: 'A virada de chave de uma profissional que triplicou o faturamento atendendo metade das clientes ao dominar cortes de assinatura.',
      b4_mecanismo: 'Método dos Cortes Perfeitos: arquitetura de corte que valoriza a simetria facial da cliente e justifica cobrar 3x mais.',
      b5_oferta: 'Curso completo O Código dos Cortes Perfeitos + certificado de especialista.',
      b6_value_stack: 'Tabela de precificação blindada + scripts prontos de WhatsApp para comunicar reajuste sem perder clientes.',
      b7_garantia_cta: 'Garantia de 7 dias com devolução integral do valor investido.'
    }
  };

  const escapedJson = "'" + JSON.stringify(re).replace(/'/g, "''") + "'::jsonb";
  updates.push(`UPDATE imphq_swipes SET reverse_engineering = ${escapedJson} WHERE id = '${s.id}';`);
});

// 4. George Miller
const georgeMiller = queryDb(`
  SELECT id, title
  FROM imphq_swipes
  WHERE title ILIKE '%George Miller%' AND (reverse_engineering IS NULL OR reverse_engineering = '{}'::jsonb);
`);

georgeMiller.forEach(s => {
  const re = {
    __schema: 'vsl7',
    formula_nome: 'VSL de Conspiração Maçônica / Segredos de Prosperidade Ocultos',
    gatilhos: ['Sociedade secreta / Conspiração', 'Riqueza esquecida', 'Autoridade de membro dissidente', 'Fórmula de ativação diária'],
    publico_alvo: 'Homens e mulheres interessados em leis ocultas de riqueza, sociedades secretas e atalhos de prosperidade.',
    tom_voz: 'Misterioso, confidencial, documental e revelador.',
    ritmo: 'Revelação do código maçônico secreto nos primeiros 2 minutos → história do membro dissidente → explicação do ritual mental → oferta.',
    observacoes: 'Usa a mística maçônica para transferir autoridade inquestionável para a mensagem de prosperidade.',
    esqueleto: {
      b1_gancho: '“A mensagem confidencial de George Miller que expõe o código maçônico de riqueza guardado sob juramento de sangue por 300 anos.”',
      b2_agitacao: 'A frustração de trabalhar uma vida inteira sem nunca acumular patrimônio real, enquanto uma elite parece atrair fortunas sem suor.',
      b3_origem: 'A descoberta dos diários confidenciais de um mestre de loja que decidiu quebrar o silêncio para ajudar pessoas comuns.',
      b4_mecanismo: 'Frequência de Ressonância Maçônica: alinhamento diário do pensamento com a geometria sagrada da abundância.',
      b5_oferta: 'O Código de George Miller: manual digital com o ritual de prosperidade maçônica.',
      b6_value_stack: 'Áudios de meditação guiada em frequência maçônica + garantia incondicional de 60 dias.',
      b7_garantia_cta: 'Garantia de 60 dias: comprove o fluxo de prosperidade ou receba 100% de volta.'
    }
  };
  const escapedJson = "'" + JSON.stringify(re).replace(/'/g, "''") + "'::jsonb";
  updates.push(`UPDATE imphq_swipes SET reverse_engineering = ${escapedJson} WHERE id = '${s.id}';`);
});

// 5. Vídeos soltos / restantes
const videosRestantes = queryDb(`
  SELECT id, title
  FROM imphq_swipes
  WHERE (reverse_engineering IS NULL OR reverse_engineering = '{}'::jsonb);
`);

videosRestantes.forEach(s => {
  const re = {
    __schema: 'vsl7',
    formula_nome: 'Criativo Curto em Vídeo / Social UGC',
    gatilhos: ['Retenção inicial (0-3s)', 'Entretenimento + curiosidade', 'Storytelling rápido', 'Chamada para ação'],
    publico_alvo: 'Usuários de redes sociais (Reels, TikTok, Shorts).',
    tom_voz: 'Dinâmico, autêntico e envolvente.',
    ritmo: 'Gancho imediato nos primeiros segundos seguido de rápida demonstração e chamada final.',
    observacoes: 'Criativo em formato vertical otimizado para plataformas móveis.',
    esqueleto: {
      b1_gancho: 'Gancho de alto impacto visual ou pergunta provocativa.',
      b2_agitacao: 'Apresentação do dilema ou problema comum em poucos segundos.',
      b3_origem: 'Demonstração rápida da experiência pessoal ou descoberta.',
      b4_mecanismo: 'O elemento diferenciador apresentado de forma simples.',
      b5_oferta: 'Apresentação da solução ou produto recomendado.',
      b6_value_stack: 'Benefício imediato percebido.',
      b7_garantia_cta: 'Chamada para clicar no link ou comentar.'
    }
  };
  const escapedJson = "'" + JSON.stringify(re).replace(/'/g, "''") + "'::jsonb";
  updates.push(`UPDATE imphq_swipes SET reverse_engineering = ${escapedJson} WHERE id = '${s.id}';`);
});

const sqlFile = 'scripts/enrich_all_swipes.sql';
fs.writeFileSync(sqlFile, updates.join('\n\n'), 'utf8');
console.log(`SQL gerado com ${updates.length} instruções de enriquecimento.`);

console.log("Executando no Supabase...");
execSync(`npx supabase db query --linked -f ${sqlFile}`, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
fs.unlinkSync(sqlFile);

console.log("🎉 TODOS OS SWIPES FORAM ENRIQUECIDOS COM SUCESSO!");
