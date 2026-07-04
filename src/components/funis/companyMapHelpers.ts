import { supabase } from "@/integrations/supabase/client";
import dagre from "dagre";
import { toPng } from "html-to-image";
import type { Node, Edge } from "@xyflow/react";
import { MAP_TEMPLATES, type MapTemplate } from "./mapTemplates";

const KIND_COLORS: Record<string, string> = {
  vertical: "#c9922a", area: "#3b82f6", oferta: "#10b981",
  canal: "#f59e0b", processo: "#8b5cf6", meta: "#ef4444", doc: "#64748b",
  vsl: "#ec4899", pagina_vendas: "#f97316", captura: "#06b6d4",
  checkout: "#84cc16", orderbump: "#fbbf24", upsell: "#22c55e",
  downsell: "#f43f5e", email: "#818cf8", anuncio: "#eab308",
  whatsapp: "#25d366", area_membros: "#a855f7", app: "#0ea5e9",
};

export async function applyTemplate(mapId: string, tpl: MapTemplate) {
  // limpa nós existentes
  await supabase.from("imphq_company_map_edges").delete().eq("map_id", mapId);
  await supabase.from("imphq_company_map_nodes").delete().eq("map_id", mapId);

  // insere nós e guarda mapping key -> uuid
  const keyToId: Record<string, string> = {};
  for (const n of tpl.nodes) {
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: n.kind, color: KIND_COLORS[n.kind] || "#c9922a",
      label: n.label, description: n.description || null,
      position: n.position,
      checklist: (n.checklist || []).map(c => ({ id: crypto.randomUUID(), text: c.text, done: false })) as any,
    }).select("id").single();
    if (data) keyToId[n.key] = data.id;
  }
  for (const e of tpl.edges) {
    const src = keyToId[e.from]; const tgt = keyToId[e.to];
    if (!src || !tgt) continue;
    await supabase.from("imphq_company_map_edges").insert({
      map_id: mapId, source_id: src, target_id: tgt,
      style: e.style || "solid", label: e.label || null,
    });
  }
}

export async function autopopulateFromBusiness(mapId: string) {
  await supabase.from("imphq_company_map_edges").delete().eq("map_id", mapId);
  await supabase.from("imphq_company_map_nodes").delete().eq("map_id", mapId);

  const [projectsR, flowsR, providersR] = await Promise.all([
    supabase.from("imphq_projects").select("id,name").limit(20),
    supabase.from("imphq_flows").select("id,nome").limit(20),
    supabase.from("imphq_wa_providers").select("id,display_name,instance_name").limit(10),
  ]);
  const projects = (projectsR.data || []) as any[];
  const flows = (flowsR.data || []) as any[];
  const providers = (providersR.data || []) as any[];

  // raiz: "Império"
  const { data: root } = await supabase.from("imphq_company_map_nodes").insert({
    map_id: mapId, kind: "vertical", color: KIND_COLORS.vertical,
    label: "Império", description: "Centro de comando", position: { x: 500, y: 30 },
  }).select("id").single();

  let x = 50;
  for (const p of projects) {
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: "oferta", color: KIND_COLORS.oferta,
      label: p.name || "Projeto", linked_project_id: p.id,
      show_live_kpis: true,
      position: { x, y: 220 },
    }).select("id").single();
    if (data && root) await supabase.from("imphq_company_map_edges").insert({ map_id: mapId, source_id: root.id, target_id: data.id });
    x += 220;
  }

  x = 50;
  for (const f of flows) {
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: "processo", color: KIND_COLORS.processo,
      label: f.nome || "Fluxo", linked_flow_id: f.id, position: { x, y: 420 },
    }).select("id").single();
    if (data && root) await supabase.from("imphq_company_map_edges").insert({
      map_id: mapId, source_id: root.id, target_id: data.id, style: "dashed",
    });
    x += 200;
  }

  x = 50;
  for (const w of providers) {
    await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: "canal", color: KIND_COLORS.canal,
      label: `WA: ${w.display_name || w.instance_name || "Chip"}`, position: { x, y: 620 },
    });
    x += 200;
  }
}

export async function autopopulateFromProject(mapId: string, projectId: string) {
  await supabase.from("imphq_company_map_edges").delete().eq("map_id", mapId);
  await supabase.from("imphq_company_map_nodes").delete().eq("map_id", mapId);

  const [projR, flowsR, providersR, funisR] = await Promise.all([
    supabase.from("imphq_projects").select("id,name,data").eq("id", projectId).maybeSingle(),
    supabase.from("imphq_flows").select("id,nome,project_id").eq("project_id", projectId).limit(30),
    supabase.from("imphq_wa_providers").select("id,display_name,instance_name,project_id").eq("project_id", projectId).limit(20),
    supabase.from("imphq_funis" as any).select("id,nome,project_id").eq("project_id", projectId).limit(20),
  ]);

  const proj = projR.data as any;
  if (!proj) throw new Error("Projeto não encontrado");
  const flows = (flowsR.data || []) as any[];
  const providers = (providersR.data || []) as any[];
  const funis = ((funisR as any).data || []) as any[];
  const produtos: any[] = Array.isArray(proj.data?.produtos) ? proj.data.produtos : [];

  const { data: root } = await supabase.from("imphq_company_map_nodes").insert({
    map_id: mapId, kind: "vertical", color: KIND_COLORS.vertical,
    label: proj.name || "Projeto", description: "Centro do projeto",
    linked_project_id: proj.id, show_live_kpis: true,
    position: { x: 500, y: 30 },
  }).select("id").single();

  const rowY = (y: number, items: any[], insertFn: (item: any, x: number) => Promise<string | null>) => {
    const spacing = 220;
    const startX = 500 - ((items.length - 1) * spacing) / 2;
    return Promise.all(items.map(async (it, i) => {
      const id = await insertFn(it, startX + i * spacing);
      if (id && root) await supabase.from("imphq_company_map_edges").insert({ map_id: mapId, source_id: root.id, target_id: id });
    }));
  };

  // Produtos (do briefing) — mapeia tipo → kind estratégico
  const tipoToKind = (t?: string): string => {
    const s = (t || "").toLowerCase();
    if (s.includes("upsell")) return "upsell";
    if (s.includes("downsell")) return "downsell";
    if (s.includes("orderbump") || s.includes("bump")) return "orderbump";
    if (s.includes("vsl")) return "vsl";
    return "oferta";
  };
  await rowY(220, produtos.length ? produtos : [{ nome: "Produto principal" }], async (p, x) => {
    const kind = tipoToKind(p.tipo);
    const preset = (KIND_COLORS as any)[kind] || KIND_COLORS.oferta;
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind, color: preset,
      label: p.nome || p.name || "Produto",
      description: p.tipo || p.descricao || null,
      linked_project_id: proj.id, show_live_kpis: kind === "oferta",
      position: { x, y: 220 },
    }).select("id").single();
    return data?.id || null;
  });

  // Funis
  if (funis.length) await rowY(400, funis, async (f, x) => {
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: "processo", color: KIND_COLORS.processo,
      label: `Funil: ${f.nome}`, linked_funnel_id: f.id,
      position: { x, y: 400 },
    }).select("id").single();
    return data?.id || null;
  });

  // Fluxos OpenFlow
  if (flows.length) await rowY(580, flows, async (f, x) => {
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: "processo", color: KIND_COLORS.processo,
      label: `Fluxo: ${f.nome}`, linked_flow_id: f.id,
      position: { x, y: 580 },
    }).select("id").single();
    return data?.id || null;
  });

  // Canais WhatsApp
  if (providers.length) await rowY(760, providers, async (w, x) => {
    const { data } = await supabase.from("imphq_company_map_nodes").insert({
      map_id: mapId, kind: "canal", color: KIND_COLORS.canal,
      label: `WA: ${w.display_name || w.instance_name || "Chip"}`,
      position: { x, y: 760 },
    }).select("id").single();
    return data?.id || null;
  });
}

export function autoLayout(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach(n => g.setNode(n.id, { width: 220, height: 90 }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - 110, y: p.y - 45 } };
  });
}

export async function exportMapPng(selector = ".react-flow") {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error("Canvas não encontrado");
  const dataUrl = await toPng(el, { backgroundColor: "#0a0809", pixelRatio: 2,
    filter: (node) => !(node as HTMLElement).classList?.contains("react-flow__minimap")
      && !(node as HTMLElement).classList?.contains("react-flow__controls"),
  });
  const a = document.createElement("a");
  a.href = dataUrl; a.download = `mapa-empresa-${Date.now()}.png`; a.click();
}
