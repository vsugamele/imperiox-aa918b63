import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

if (existsSync(".env")) {
  const envContent = readFileSync(".env", "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://tkbivipqiewkfnhktmqq.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase credentials missing in env!");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BOOKS = [
  {
    shareId: "f_d785svxr",
    id: "100m-leads",
    title: "$100M Leads",
    author: "Alex Hormozi",
    subtitle: "Como Conseguir Desconhecidos Para Quererem Comprar Suas Coisas",
    category: "Tráfego & Aquisição",
    color: "#0ea5e9",
    tags: ["leads", "trafego", "aquisicao", "anuncios", "hooks", "cac", "ltv", "alex hormozi"],
    summary: "O manual definitivo de canais de aquisição de leads: contatos quentes, postagens orgânicas, anúncios pagos e afiliados/parceiros, com métricas de corte e frameworks práticos."
  },
  {
    shareId: "f_ltzc2sno",
    id: "dotcom-secrets",
    title: "DotCom Secrets",
    author: "Russell Brunson",
    subtitle: "Os Segredos e Roteiros dos Funis de Vendas na Internet",
    category: "Funis & Conversão",
    color: "#8b5cf6",
    tags: ["funis", "conversao", "escada de valor", "scripts", "webinario", "oto", "russell brunson"],
    summary: "A ciência dos funis de vendas na internet: escada de valor, personagem atraente, sequências de e-mail e os 23 scripts canônicos de copy e conversão."
  }
];

function cleanHtmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function extractTags(text, path) {
  const combined = (text + " " + path).toLowerCase();
  const tags = new Set();
  const keywords = [
    "tráfego", "anúncio", "gancho", "hook", "lead", "cac", "ltv", "funil",
    "webinário", "oferta", "isca", "e-mail", "whatsapp", "conversão",
    "upsell", "downsell", "copy", "headline", "script", "história",
    "métricas", "orçamento", "regras", "framework", "escada de valor"
  ];
  keywords.forEach(k => {
    if (combined.includes(k.replace("á", "a").replace("í", "i"))) {
      tags.add(k);
    }
  });
  return Array.from(tags);
}

function detectFormula(text) {
  if (!text) return null;
  const match = text.match(/(LTGP\s*[><=]\s*CAC|LTGP\s*\/\s*CAC\s*[><=]\s*\d+|CAC\s*=\s*[^.\n]+|LTV\s*[><=]\s*[^.\n]+|ROI\s*[><=]\s*[^.\n]+)/i);
  return match ? match[0].trim() : null;
}

async function processBook(bookDef) {
  console.log(`\n📚 Buscando bookmap "${bookDef.title}" (${bookDef.shareId})...`);
  const res = await fetch(`https://app.makesystems.pro/api/shared/${bookDef.shareId}`);
  if (!res.ok) {
    throw new Error(`Falha ao buscar bookmap ${bookDef.shareId}: HTTP ${res.status}`);
  }
  const data = await res.json();
  const rawNodes = data.nodes || [];
  const rawEdges = data.edges || [];

  console.log(`Carregados ${rawNodes.length} nós e ${rawEdges.length} conexões.`);

  // 1. Mapeamento de parentesco a partir dos edges
  const parentMap = new Map(); // targetId -> sourceId
  const childrenMap = new Map(); // sourceId -> [targetIds]

  rawEdges.forEach(edge => {
    parentMap.set(edge.target, edge.source);
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source).push(edge.target);
  });

  // 2. Encontrar o nó raiz
  let rootNode = rawNodes.find(n => n.data?.root === true);
  if (!rootNode) {
    rootNode = rawNodes.find(n => !parentMap.has(n.id)) || rawNodes[0];
  }

  const nodesById = new Map(rawNodes.map(n => [n.id, n]));

  // 3. Montar hierarquia, caminhos semânticos e nós normalizados
  const processedNodes = [];

  function walk(nodeId, parentId, level, currentPath) {
    const raw = nodesById.get(nodeId);
    if (!raw) return null;

    const rawHtml = raw.data?.html || "";
    const cleanText = cleanHtmlToText(rawHtml);
    const hasHighlight = rawHtml.includes("<mark") || rawHtml.includes("background: rgb(254, 249, 195)") || rawHtml.includes("<b");
    const isRoot = raw.data?.root === true || level === 0;

    // Título curto para o nó
    let title = cleanText;
    if (title.length > 80) {
      const firstLine = title.split("\n")[0].trim();
      title = firstLine.length <= 80 ? firstLine : title.slice(0, 77) + "...";
    }
    if (!title && raw.data?.img) {
      title = "Ilustração do Framework";
    }

    const nextPath = isRoot ? bookDef.title : `${currentPath} > ${title}`;
    const formula = detectFormula(cleanText);

    let nodeType = "rule";
    if (isRoot) nodeType = "root";
    else if (level === 1) nodeType = "section";
    else if (level === 2) nodeType = "chapter";
    else if (raw.data?.img) nodeType = "framework";
    else if (formula) nodeType = "formula";
    else if (hasHighlight) nodeType = "rule";
    else nodeType = "concept";

    const nodeRecord = {
      id: `${bookDef.id}:${raw.id}`,
      bookmap_id: bookDef.id,
      parent_id: parentId ? `${bookDef.id}:${parentId}` : null,
      title: title || `Nó ${raw.id}`,
      path: nextPath,
      level,
      node_type: nodeType,
      content: cleanText || (raw.data?.img ? "Diagrama conceitual do livro" : ""),
      highlight: hasHighlight,
      image_url: raw.data?.img || null,
      formula: formula,
      tags: extractTags(cleanText, nextPath),
      operational_rules: {
        raw_html: rawHtml,
        color: raw.data?.color || null,
        has_image: !!raw.data?.img
      },
      position: processedNodes.length
    };

    processedNodes.push(nodeRecord);

    const childIds = childrenMap.get(nodeId) || [];
    const childrenTree = [];

    for (const childId of childIds) {
      const childSubtree = walk(childId, nodeId, level + 1, nextPath);
      if (childSubtree) {
        childrenTree.push(childSubtree);
      }
    }

    return {
      ...nodeRecord,
      children: childrenTree
    };
  }

  const treeRoot = walk(rootNode.id, null, 0, "");

  console.log(`Processados ${processedNodes.length} nós com caminhos e taxonomia.`);

  // 4. Inserir Bookmap Header
  const bookRecord = {
    id: bookDef.id,
    title: bookDef.title,
    author: bookDef.author,
    subtitle: bookDef.subtitle,
    cover_url: data.cover || rawNodes[0]?.data?.img || null,
    category: bookDef.category,
    color: bookDef.color,
    tags: bookDef.tags,
    summary: bookDef.summary,
    total_nodes: processedNodes.length,
    tree_data: treeRoot,
    updated_at: new Date().toISOString()
  };

  const { error: bookErr } = await supabase
    .from("imphq_bookmaps")
    .upsert(bookRecord, { onConflict: "id" });

  if (bookErr) {
    throw new Error(`Erro ao salvar bookmap ${bookDef.id}: ${bookErr.message}`);
  }
  console.log(`✅ Bookmap "${bookDef.title}" salvo com sucesso!`);

  // 5. Inserir Nós em lotes de 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < processedNodes.length; i += BATCH_SIZE) {
    const batch = processedNodes.slice(i, i + BATCH_SIZE);
    const { error: nodeErr } = await supabase
      .from("imphq_bookmap_nodes")
      .upsert(batch, { onConflict: "id" });

    if (nodeErr) {
      throw new Error(`Erro ao salvar lote de nós [${i}-${i + batch.length}]: ${nodeErr.message}`);
    }
    console.log(`  Gravados nós ${i + 1} a ${i + batch.length}...`);
  }

  console.log(`⭐ Todos os ${processedNodes.length} nós de "${bookDef.title}" gravados no banco!`);
}

async function main() {
  console.log("🚀 Iniciando ingestão dos Bookmaps para o Acervo/RAG do Império...");
  for (const book of BOOKS) {
    await processBook(book);
  }
  console.log("\n🎉 Ingestão de todos os Bookmaps concluída com sucesso!");
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
