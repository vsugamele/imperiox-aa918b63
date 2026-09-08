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
  raw?: unknown; // preserva original
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> { return isRecord(value) ? value : {}; }
function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`Typebot: ${label} inválido`);
  return value;
}
function text(value: unknown): string | undefined { return typeof value === "string" ? value : undefined; }
function requiredId(value: unknown, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`Typebot: ${label} sem identificador`);
  return value;
}
function array(value: unknown, label: string): unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`Typebot: ${label} deve ser lista`);
  return value;
}

function richTextToString(rt: unknown): string {
  if (!rt) return "";
  if (typeof rt === "string") return rt;
  if (Array.isArray(rt)) {
    return rt.map(richTextToString).join("\n").trim();
  }
  if (!isRecord(rt)) return "";
  if (rt.children) return richTextToString(rt.children);
  if (typeof rt.text === "string") return rt.text;
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

function parseBlock(value: unknown): FlowBlock {
  const b = requireRecord(value, "bloco");
  const content = record(b.content);
  const options = record(b.options);
  const type = mapBlockType(text(b.type) || "");
  const block: FlowBlock = { id: text(b.id) || crypto.randomUUID(), type, raw: b };
  switch (type) {
    case "text":
      block.text = richTextToString(content.richText) || text(content.plainText) || "";
      break;
    case "image":
      block.image_url = text(content.url);
      break;
    case "video":
      block.video_url = text(content.url);
      break;
    case "set_variable":
      block.variable = text(options.variableId);
      block.expression = text(options.expressionToEvaluate);
      break;
    case "code":
      block.code = text(options.content);
      break;
    case "wait":
      block.seconds = Number(options.secondsToWaitFor || 0);
      break;
    case "redirect":
      block.url = text(options.url);
      break;
    case "webhook":
      block.url = text(record(options.webhook).url);
      break;
    case "input_choice":
      block.options = array(b.items, "items").map(item => { const it = record(item); return text(it.content) || text(it.label) || ""; }).filter(Boolean);
      break;
    default:
      // outros inputs: tenta extrair placeholder
      block.text = text(record(options.labels).placeholder) || "";
  }
  return block;
}

export function typebotToBlueprint(value: unknown): FlowBlueprint {
  const json = requireRecord(value, "export");
  const groups = array(json.groups, "groups").map(g => requireRecord(g, "grupo"));
  const edges = array(json.edges, "edges").map(e => requireRecord(e, "edge"));
  const events = array(json.events, "events").map(e => requireRecord(e, "evento"));
  const variables = array(json.variables, "variables").map(value => {
    const v = requireRecord(value, "variável");
    return { id: requiredId(v.id, "variável"), name: requiredId(v.name, "nome da variável"), default: text(v.defaultValue) };
  });
  const startEvent = events.find(e => e.type === "start");
  const nodes: FlowNode[] = groups.map(g => {
    const coordinates = record(g.graphCoordinates);
    return {
      id: requiredId(g.id, "grupo"), title: text(g.title) || "Sem título",
      x: Math.round((typeof coordinates.x === "number" ? coordinates.x : 0) + 1500),
      y: Math.round((typeof coordinates.y === "number" ? coordinates.y : 0) + 800),
      blocks: array(g.blocks, "blocks").map(parseBlock),
    };
  });
  const parsedEdges: FlowEdge[] = edges.flatMap(e => {
    const from = record(e.from);
    const to = record(e.to);
    const fromBlock = text(from.blockId);
    let fromId = fromBlock || text(from.eventId) || text(from.groupId);
    const toId = text(to.groupId);
    if (fromBlock) {
      const group = nodes.find(g => g.blocks.some(b => b.id === fromBlock));
      if (group) fromId = group.id;
    }
    return fromId && toId ? [{ id: text(e.id) || crypto.randomUUID(), from: fromId, to: toId, from_block: fromBlock }] : [];
  });
  const startEdge = startEvent?.outgoingEdgeId ? edges.find(e => e.id === startEvent.outgoingEdgeId) : undefined;
  return {
    title: text(json.name) || "Fluxo importado", nodes, edges: parsedEdges, variables,
    start_node_id: text(record(startEdge?.to).groupId),
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
  const orphanLvl = Math.max(0, ...Array.from(levels.values())) + 1;
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
