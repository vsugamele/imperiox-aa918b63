// Engenharia reversa: Typebot export -> FlowBlueprint interno
// Suporta: text, image, video, Set variable, Code, choice/text/email/phone/number input, condition, Wait, Redirect, Webhook

export type BlockType =
  | "text"
  | "image"
  | "video"
  | "input_text"
  | "input_email"
  | "input_phone"
  | "input_number"
  | "input_choice"
  | "condition"
  | "set_variable"
  | "wait"
  | "redirect"
  | "webhook"
  | "code"
  | "ai_prompt"
  | "unknown";

export interface FlowBlock {
  id: string;
  type: BlockType;
  // Conteúdo livre por tipo
  text?: string;
  image_url?: string;
  image_prompt?: string;
  video_url?: string;
  variable?: string;
  expression?: string;
  options?: string[]; // para choice
  condition?: { variable?: string; operator?: string; value?: string };
  url?: string;
  seconds?: number;
  code?: string;
  folder_id?: string;
  folder_title?: string;
  raw?: any; // preserva original
}

export interface FlowNode {
  id: string;
  title: string;
  x: number;
  y: number;
  blocks: FlowBlock[];
}

export interface FlowEdge {
  id: string;
  from: string; // node_id
  to: string;   // node_id
  from_block?: string;
  label?: string;
}

export interface FlowVariable {
  id: string;
  name: string;
  default?: string;
}

export interface FlowBlueprint {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: FlowVariable[];
  start_node_id?: string;
}

function richTextToString(rt: any): string {
  if (!rt) return "";
  if (typeof rt === "string") return rt;
  if (Array.isArray(rt)) {
    return rt.map(richTextToString).join("\n").trim();
  }
  if (rt.children) return richTextToString(rt.children);
  if (rt.text) return rt.text;
  return "";
}

function mapBlockType(t: string): BlockType {
  const k = (t || "").toLowerCase();
  if (k === "text") return "text";
  if (k === "image") return "image";
  if (k === "video") return "video";
  if (k === "code") return "code";
  if (k === "set variable" || k === "set_variable") return "set_variable";
  if (k === "wait") return "wait";
  if (k === "redirect") return "redirect";
  if (k === "webhook") return "webhook";
  if (k === "condition") return "condition";
  if (k === "text input" || k === "text_input") return "input_text";
  if (k === "email input" || k === "email_input") return "input_email";
  if (k === "phone input" || k === "number_phone" || k === "phone_input") return "input_phone";
  if (k === "number input" || k === "number_input") return "input_number";
  if (k === "choice input" || k === "choice_input" || k === "buttons input") return "input_choice";
  return "unknown";
}

function parseBlock(b: any): FlowBlock {
  const type = mapBlockType(b.type);
  const block: FlowBlock = { id: b.id || crypto.randomUUID(), type, raw: b };
  switch (type) {
    case "text":
      block.text = richTextToString(b.content?.richText) || b.content?.plainText || "";
      break;
    case "image":
      block.image_url = b.content?.url;
      break;
    case "video":
      block.video_url = b.content?.url;
      break;
    case "set_variable":
      block.variable = b.options?.variableId;
      block.expression = b.options?.expressionToEvaluate;
      break;
    case "code":
      block.code = b.options?.content;
      break;
    case "wait":
      block.seconds = Number(b.options?.secondsToWaitFor || 0);
      break;
    case "redirect":
      block.url = b.options?.url;
      break;
    case "webhook":
      block.url = b.options?.webhook?.url;
      break;
    case "input_choice":
      block.options = (b.items || []).map((it: any) => it.content || it.label || "").filter(Boolean);
      break;
    default:
      // outros inputs: tenta extrair placeholder
      block.text = b.options?.labels?.placeholder || "";
  }
  return block;
}

export function typebotToBlueprint(json: any): FlowBlueprint {
  const groups = json.groups || [];
  const edges = json.edges || [];
  const events = json.events || [];
  const variables = (json.variables || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    default: v.defaultValue,
  }));

  const startEvent = events.find((e: any) => e.type === "start");

  const nodes: FlowNode[] = groups.map((g: any) => ({
    id: g.id,
    title: g.title || "Sem título",
    x: Math.round((g.graphCoordinates?.x ?? 0) + 1500),
    y: Math.round((g.graphCoordinates?.y ?? 0) + 800),
    blocks: (g.blocks || []).map(parseBlock),
  }));

  // Edges: cada edge do typebot tem from.{eventId|blockId|itemId} e to.{groupId}
  const parsedEdges: FlowEdge[] = edges.map((e: any) => {
    const fromId = e.from?.blockId || e.from?.eventId || e.from?.groupId;
    const toId = e.to?.groupId;
    // mapear blockId -> groupId que contém esse block
    let fromGroupId = fromId;
    if (e.from?.blockId) {
      const g = groups.find((g: any) => g.blocks?.some((b: any) => b.id === e.from.blockId));
      if (g) fromGroupId = g.id;
    }
    return {
      id: e.id || crypto.randomUUID(),
      from: fromGroupId,
      to: toId,
      from_block: e.from?.blockId,
    };
  }).filter((e: FlowEdge) => e.from && e.to);

  // start: edge a partir do evento start
  let startNodeId: string | undefined;
  if (startEvent?.outgoingEdgeId) {
    const startEdge = edges.find((e: any) => e.id === startEvent.outgoingEdgeId);
    startNodeId = startEdge?.to?.groupId;
  }

  return {
    title: json.name || "Fluxo importado",
    nodes,
    edges: parsedEdges,
    variables,
    start_node_id: startNodeId,
  };
}

// Auto-layout simples (BFS) quando blueprint vem da IA sem coords
export function autoLayout(blueprint: FlowBlueprint): FlowBlueprint {
  const COL_W = 380;
  const ROW_H = 240;
  const startX = 200;
  const startY = 200;
  if (!blueprint.nodes.length) return blueprint;

  const levels = new Map<string, number>();
  const queue: Array<{ id: string; lvl: number }> = [];
  const startId = blueprint.start_node_id || blueprint.nodes[0].id;
  queue.push({ id: startId, lvl: 0 });
  levels.set(startId, 0);

  while (queue.length) {
    const { id, lvl } = queue.shift()!;
    const outs = blueprint.edges.filter(e => e.from === id);
    outs.forEach(e => {
      if (!levels.has(e.to)) {
        levels.set(e.to, lvl + 1);
        queue.push({ id: e.to, lvl: lvl + 1 });
      }
    });
  }

  // nodes não alcançados: empilha no final
  let orphanLvl = Math.max(0, ...Array.from(levels.values())) + 1;
  blueprint.nodes.forEach(n => {
    if (!levels.has(n.id)) levels.set(n.id, orphanLvl);
  });

  const byLevel = new Map<number, string[]>();
  levels.forEach((lvl, id) => {
    if (!byLevel.has(lvl)) byLevel.set(lvl, []);
    byLevel.get(lvl)!.push(id);
  });

  const newNodes = blueprint.nodes.map(n => {
    const lvl = levels.get(n.id) ?? 0;
    const siblings = byLevel.get(lvl) || [];
    const idx = siblings.indexOf(n.id);
    return { ...n, x: startX + lvl * COL_W, y: startY + idx * ROW_H };
  });

  return { ...blueprint, nodes: newNodes };
}
