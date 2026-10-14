import { supabase } from "@/integrations/supabase/client";
import { createVirtualSiteFromUrl, normalizeProjectIcon, type SiteThumbnailItem } from "@/components/sites/SiteThumbnail";

export interface ProjectDocSummary {
  id: string;
  title: string;
  category: string;
  excerpt: string;
  tags: string[];
  isProjectSpecific: boolean;
}

export interface ProjectSkillSummary {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  promptExcerpt: string;
}

export interface SynthesizedProjectHook {
  id: string;
  angle: string;
  framework: string;
  skillApplied: string;
  docReference: string;
  avatarPainTarget: string;
  text: string;
  visualDirection: string;
  source: "avatar_nativo" | "doc_sintese" | "skill_mecanismo";
}

export interface ProjectIntelligenceBundle {
  projectId: string;
  projectName: string;
  projectIcon: string;
  projectCategory: string;
  projectDescription: string;
  // Avatar fields
  avatarName: string;
  avatarAgeRange: string;
  avatarProfile: string;
  deepPains: string[];
  externalDesire: string;
  internalDesire: string;
  forbiddenDesires: string[];
  enemy: string;
  nuclearTrigger: string;
  objections: Array<{ objecao: string; resposta?: string }>;
  avatarNativeHooks: string[];
  avatarHeadlines: string[];
  // Offer & Mechanism fields
  mechanismName: string;
  mechanismProblem: string;
  mechanismSolution: string;
  bigIdea: string;
  promise: string;
  offerSummary: string;
  products: Array<{ name: string; price?: string; role?: string }>;
  // Connected Assets
  docs: ProjectDocSummary[];
  skills: ProjectSkillSummary[];
  sites: SiteThumbnailItem[];
  // Synthesized hooks grounded in Project + Avatar + Docs + Skills
  synthesizedHooks: SynthesizedProjectHook[];
}

const PRIORITY_SKILL_SLUGS = [
  "hook-arsenal",
  "angulos-criativos",
  "mecanismo-unico",
  "dossie-problemas",
  "mapeamento-desejos",
  "vinicius_sugamele",
  "weaponized-credibility",
  "avatar-architect",
];

function stripMarkdown(md: string, maxLen = 220): string {
  const clean = (md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen).trim()}...` : clean;
}

function asStringArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return String(obj.texto || obj.text || obj.hook || obj.dor || obj.headline || obj.nome || "").trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof val === "string") {
    return val
      .split(/\n|;/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export async function loadProjectIntelligence(projectId?: string | null): Promise<ProjectIntelligenceBundle | null> {
  try {
    // 1. Fetch project (either requested ID or first available active project)
    let projectRow: Record<string, any> | null = null;

    if (projectId && projectId !== "__none__") {
      const { data } = await supabase
        .from("imphq_projects")
        .select("id, name, icon, category, description, data, avatar, brand_kit")
        .eq("id", projectId)
        .maybeSingle();
      projectRow = data;
    }

    if (!projectRow) {
      const { data: firstRows } = await supabase
        .from("imphq_projects")
        .select("id, name, icon, category, description, data, avatar, brand_kit")
        .order("name", { ascending: true })
        .limit(1);
      projectRow = firstRows?.[0] ?? null;
    }

    if (!projectRow) return null;

    const resolvedId = String(projectRow.id);

    // 2. Fetch Docs, Skills, and Project Sites in parallel
    const [docsRes, skillsRes, linksRes] = await Promise.all([
      supabase
        .from("imphq_docs")
        .select("id, title, category, content, body, tags, project_id")
        .or(`project_id.eq.${resolvedId},project_id.is.null`)
        .limit(30),
      supabase
        .from("imphq_skills")
        .select("id, name, slug, category, description, system_prompt")
        .eq("is_active", true)
        .limit(30),
      supabase
        .from("imphq_project_sites")
        .select("project_id, role, is_primary, site:imphq_sites(id, name, url, thumbnail_url, category, page_type, funnel_stage, status, project_slug)")
        .eq("project_id", resolvedId),
    ]);

    const rawData = (projectRow.data && typeof projectRow.data === "object" ? projectRow.data : {}) as Record<string, any>;
    const topAvatar = (projectRow.avatar && typeof projectRow.avatar === "object" ? projectRow.avatar : {}) as Record<string, any>;
    const nestedAvatar = (rawData.avatar && typeof rawData.avatar === "object" ? rawData.avatar : {}) as Record<string, any>;
    const avatar = { ...nestedAvatar, ...topAvatar };

    const avatarName = String(
      avatar.nome || avatar.name || rawData.avatar_nome || `Avatar de ${projectRow.name}`
    );
    const avatarAgeRange = String(avatar.idade || avatar.faixa_etaria || "35-64 anos");
    const avatarProfile = String(
      avatar.perfil || avatar.resumo || avatar.contexto || projectRow.description || ""
    );

    const deepPains = [
      ...asStringArray(avatar.dores_profundas),
      ...asStringArray(avatar.dores),
      ...asStringArray(rawData.dores),
    ].slice(0, 8);

    const externalDesire = String(
      avatar.desejo_externo || avatar.desejo_principal || rawData.promessa || "Resolver o problema de forma definitiva sem efeito rebote"
    );
    const internalDesire = String(
      avatar.desejo_interno || "Recuperar a autonomia, dignidade e controle sobre o próprio corpo/rotina"
    );
    const forbiddenDesires = asStringArray(avatar.desejos_proibidos);

    const enemy = String(
      avatar.inimigo ||
        avatar.inimigo_comum ||
        rawData.inimigo_comum ||
        rawData.vilao ||
        "Soluções paliativas tradicionais que só mascaram o sintoma e culpam o paciente"
    );

    const nuclearTrigger = String(
      avatar.gatilho_nuclear ||
        avatar.gatilho_emocional ||
        rawData.gatilho_nuclear ||
        (deepPains[0] ? `O medo silencioso de que "${deepPains[0]}" piore irreversivelmente` : "Medo de perder o controle e depender dos outros")
    );

    const rawObjections = Array.isArray(avatar.objecoes) ? avatar.objecoes : [];
    const objections = rawObjections
      .map((o: any) => {
        if (typeof o === "string") return { objecao: o };
        if (o && typeof o === "object") {
          return {
            objecao: String(o.objecao || o.pergunta || o.mito || ""),
            resposta: o.resposta || o.quebra ? String(o.resposta || o.quebra) : undefined,
          };
        }
        return null;
      })
      .filter((o): o is { objecao: string; resposta?: string } => Boolean(o && o.objecao));

    const avatarNativeHooks = [
      ...asStringArray(avatar.ganchos),
      ...asStringArray(rawData.ganchos),
      ...asStringArray(rawData.hooks),
    ];

    const avatarHeadlines = [
      ...asStringArray(avatar.headlines),
      ...asStringArray(rawData.headlines),
    ];

    // Mechanism & Offer extraction
    const mecObj =
      rawData.mecanismo_unico && typeof rawData.mecanismo_unico === "object"
        ? (rawData.mecanismo_unico as Record<string, any>)
        : {};

    const mechanismName = String(
      typeof rawData.mecanismo_unico === "string"
        ? rawData.mecanismo_unico
        : mecObj.nome ||
            mecObj.mecanismo_solucao ||
            rawData.mecanismo ||
            rawData.metodo ||
            `Protocolo ${projectRow.name}`
    );

    const mechanismProblem = String(
      mecObj.mecanismo_problema ||
        mecObj.causa_raiz ||
        rawData.mecanismo_problema ||
        enemy
    );

    const mechanismSolution = String(
      mecObj.mecanismo_solucao ||
        mecObj.como_funciona ||
        rawData.mecanismo_solucao ||
        mechanismName
    );

    const bigIdea = String(
      rawData.big_idea ||
        rawData.tese_central ||
        avatarHeadlines[0] ||
        `Por que ${enemy.toLowerCase()} falha — e como ${mechanismName} atua na verdadeira causa-raiz.`
    );

    const promise = String(
      rawData.promessa ||
        rawData.promessa_central ||
        externalDesire
    );

    // Extract products
    const rawProds = Array.isArray(rawData.produtos)
      ? rawData.produtos
      : Array.isArray(rawData.esteira)
      ? rawData.esteira
      : [];
    const products = rawProds
      .map((p: any) => ({
        name: String(p?.nome || p?.name || p?.titulo || projectRow.name),
        price: p?.preco || p?.price || p?.ticket ? String(p.preco || p.price || p.ticket) : undefined,
        role: p?.tipo || p?.role || p?.etapa ? String(p.tipo || p.role || p.etapa) : undefined,
      }))
      .slice(0, 6);

    const offerSummary =
      products.length > 0
        ? products.map((p) => `${p.name}${p.price ? ` (${p.price})` : ""}`).join(" · ")
        : String(rawData.oferta || `${projectRow.name} — Oferta Direta`);

    // Filter & rank docs (project-specific first, then copywriting/avatar/hooks docs)
    const allDocs = (docsRes.data || []) as Array<Record<string, any>>;
    const projectNameLower = String(projectRow.name || "").toLowerCase();
    const projectIdLower = resolvedId.toLowerCase();

    const scoredDocs = allDocs
      .map((d) => {
        const isProjectSpecific =
          d.project_id === resolvedId ||
          String(d.title || "").toLowerCase().includes(projectNameLower) ||
          String(d.title || "").toLowerCase().includes(projectIdLower);
        const cat = String(d.category || "geral");
        const isCopyDoc = /copy|hook|gancho|avatar|vsl|anuncio|criativo|oferta|estrategia/i.test(
          `${d.title} ${cat} ${JSON.stringify(d.tags || [])}`
        );
        const score = (isProjectSpecific ? 100 : 0) + (isCopyDoc ? 30 : 0);
        return {
          doc: d,
          isProjectSpecific,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const docs: ProjectDocSummary[] = scoredDocs.map(({ doc, isProjectSpecific }) => ({
      id: String(doc.id),
      title: String(doc.title || "Documento"),
      category: String(doc.category || "Estratégia"),
      excerpt: stripMarkdown(String(doc.content || doc.body || ""), 200),
      tags: Array.isArray(doc.tags) ? doc.tags.map(String) : [],
      isProjectSpecific,
    }));

    // Rank skills (prioritize copy/hook/avatar/mechanism skills)
    const allSkills = (skillsRes.data || []) as Array<Record<string, any>>;
    const sortedSkills = [...allSkills]
      .sort((a, b) => {
        const idxA = PRIORITY_SKILL_SLUGS.indexOf(String(a.slug));
        const idxB = PRIORITY_SKILL_SLUGS.indexOf(String(b.slug));
        const scoreA = idxA >= 0 ? 100 - idxA : /copy|hook|avatar|mecanismo/i.test(String(a.category || a.slug)) ? 20 : 0;
        const scoreB = idxB >= 0 ? 100 - idxB : /copy|hook|avatar|mecanismo/i.test(String(b.category || b.slug)) ? 20 : 0;
        return scoreB - scoreA;
      })
      .slice(0, 8);

    const skills: ProjectSkillSummary[] = sortedSkills.map((s) => ({
      id: String(s.id),
      name: String(s.name),
      slug: String(s.slug),
      category: String(s.category || "copywriting"),
      description: String(s.description || ""),
      promptExcerpt: stripMarkdown(String(s.system_prompt || ""), 220),
    }));

    // Sites & Visual Thumbnails
    const linkedSites: SiteThumbnailItem[] = [];
    for (const row of (linksRes.data || []) as any[]) {
      if (row.site && row.site.url) {
        linkedSites.push({
          ...row.site,
          role: row.role,
        });
      }
    }

    // Fallback virtual sites from project.data if needed
    const vslUrl =
      (typeof rawData.vsl_url === "string" && rawData.vsl_url) ||
      (rawData.links && typeof rawData.links === "object" && (rawData.links.vsl || rawData.links.pagina_vendas || rawData.links.landing_page));
    const checkoutUrl =
      (typeof rawData.checkout_url === "string" && rawData.checkout_url) ||
      (rawData.links && typeof rawData.links === "object" && rawData.links.checkout);

    if (typeof vslUrl === "string" && vslUrl.startsWith("http") && !linkedSites.some((s) => s.url === vslUrl)) {
      linkedSites.push(createVirtualSiteFromUrl(vslUrl, `${projectRow.name} — VSL / LP`, "vsl"));
    }
    if (typeof checkoutUrl === "string" && checkoutUrl.startsWith("http") && !linkedSites.some((s) => s.url === checkoutUrl)) {
      linkedSites.push(createVirtualSiteFromUrl(checkoutUrl, `${projectRow.name} — Checkout`, "checkout"));
    }

    // Synthesize project-grounded hooks combining:
    // 1. Native hooks from `imphq_projects.avatar.ganchos`
    // 2. Deep Pains + Mechanism + Enemy + Docs + Skills
    const primaryDocTitle = docs[0]?.title || `Dossiê Estratégico — ${projectRow.name}`;
    const secondaryDocTitle = docs[1]?.title || primaryDocTitle;
    const primaryPain = deepPains[0] || `sofrer com o problema todos os dias sem resposta real`;
    const secondaryPain = deepPains[1] || primaryPain;
    const thirdPain = deepPains[2] || primaryPain;

    const synthesizedHooks: SynthesizedProjectHook[] = [];

    // Add native avatar hooks first
    avatarNativeHooks.slice(0, 4).forEach((hookText, idx) => {
      const angles = [
        "Contrarian / Inimigo Comum",
        "Mecanismo Oculto / Causa-Raiz",
        "Confissão / Dor Silenciosa",
        "Curiosidade / Ruptura de Padrão",
      ];
      const skillNames = [
        "Hook Arsenal (50 Frameworks)",
        "Mecanismo Único V2",
        "Dossiê de Problemas",
        "Ângulos Criativos",
      ];
      synthesizedHooks.push({
        id: `native-${resolvedId}-${idx}`,
        angle: angles[idx % angles.length],
        framework: `Gancho Nativo do Avatar (${avatarName})`,
        skillApplied: skills[idx % Math.max(skills.length, 1)]?.name || skillNames[idx % skillNames.length],
        docReference: primaryDocTitle,
        avatarPainTarget: deepPains[idx % Math.max(deepPains.length, 1)] || primaryPain,
        text: hookText,
        visualDirection:
          idx % 2 === 0
            ? `Close no rosto de ${avatarName} (expressão de choque/alívio) + legenda amarela destacando a frase-chave nos primeiros 2s`
            : `Split-screen: à esquerda o erro comum (${enemy.slice(0, 45)}...), à direita o mecanismo ${mechanismName}`,
        source: "avatar_nativo",
      });
    });

    // Add synthesized hooks combining Mechanism + Deep Pains + Docs + Skills
    synthesizedHooks.push(
      {
        id: `synth-mec-${resolvedId}-1`,
        angle: "Inimigo Comum + Mecanismo",
        framework: "Diagnostic Inversion (Hook Arsenal + Mecanismo Único)",
        skillApplied: skills.find((s) => s.slug.includes("mecanismo"))?.name || "Mecanismo Único",
        docReference: primaryDocTitle,
        avatarPainTarget: primaryPain,
        text: `Se disseram para você que a culpa é sua por "${primaryPain}", mentiram. O verdadeiro bloqueio está em ${mechanismProblem.toLowerCase()} — e é por isso que ${mechanismName} destrava o que nada mais resolveu.`,
        visualDirection: `B-roll tátil mostrando a rotina de ${avatarName} interrompida por um alerta visual vermelho + transição para explicação de ${mechanismName}.`,
        source: "skill_mecanismo",
      },
      {
        id: `synth-pain-${resolvedId}-2`,
        angle: "Gatilho Nuclear & Identidade",
        framework: "Unspoken Secret (Mapeamento de Desejos + Dossiê de Problemas)",
        skillApplied: skills.find((s) => s.slug.includes("desejo") || s.slug.includes("problema"))?.name || "Mapeamento de Desejos",
        docReference: secondaryDocTitle,
        avatarPainTarget: secondaryPain,
        text: `Ninguém fala sobre o que acontece às 3h da manhã quando ${avatarName.split(",")[0]} pensa em "${secondaryPain}". Mas foi exatamente esse detalhe que levou à descoberta de ${mechanismName}.`,
        visualDirection: `UGC intimista em ambiente real (iluminação natural baixa), tom confessional sem parecer anúncio comercial (Escrita Vinicius Sugamele).`,
        source: "doc_sintese",
      },
      {
        id: `synth-proof-${resolvedId}-3`,
        angle: "Quebra de Objeção + Prova",
        framework: "Skeptic Disarm (Weaponized Credibility + Ângulos Criativos)",
        skillApplied: skills.find((s) => s.slug.includes("angulo") || s.slug.includes("hook"))?.name || "Ângulos Criativos",
        docReference: primaryDocTitle,
        avatarPainTarget: objections[0]?.objecao || thirdPain,
        text:
          avatarHeadlines[0] ||
          `Você já tentou de tudo contra "${thirdPain}" e sentiu que jogou dinheiro fora? Veja por que ${enemy.slice(0, 60)} trava o seu resultado nos primeiros 7 dias — e como inverter isso hoje.`,
        visualDirection: `Gráfico simples desenhado à mão ou no iPad comparando a curva de falha tradicional vs. ativação via ${mechanismName}.`,
        source: "skill_mecanismo",
      }
    );

    return {
      projectId: resolvedId,
      projectName: String(projectRow.name || resolvedId),
      projectIcon: normalizeProjectIcon(projectRow.icon),
      projectCategory: String(projectRow.category || "Funil Direto"),
      projectDescription: String(projectRow.description || ""),
      avatarName,
      avatarAgeRange,
      avatarProfile,
      deepPains,
      externalDesire,
      internalDesire,
      forbiddenDesires,
      enemy,
      nuclearTrigger,
      objections,
      avatarNativeHooks,
      avatarHeadlines,
      mechanismName,
      mechanismProblem,
      mechanismSolution,
      bigIdea,
      promise,
      offerSummary,
      products,
      docs,
      skills,
      sites: linkedSites,
      synthesizedHooks,
    };
  } catch (err) {
    console.error("[loadProjectIntelligence] Error:", err);
    return null;
  }
}
