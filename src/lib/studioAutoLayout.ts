import dagre from "dagre";
import type { Edge, Node } from "@xyflow/react";

const NODE_W = 220;
const NODE_H = 160;

export function autoLayout(nodes: Node[], edges: Edge[], direction: "LR" | "TB" = "LR"): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 90, marginx: 40, marginy: 40 });

  nodes.forEach((n) => {
    // product hub fica fixo à esquerda; ainda entra no grafo pra ranking
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    if (n.id === "product-hub") return n; // hub mantém posição fixa
    const p = g.node(n.id);
    if (!p) return n;
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } };
  });
}

// Regras de compatibilidade entre tipos ao conectar handles
// key = tipo do nó SOURCE, value = tipos aceitáveis no TARGET
const CONNECTION_RULES: Record<string, string[]> = {
  product: ["image", "video", "audio", "prompt", "avatar", "publish"],
  prompt: ["image", "video", "audio", "prompt", "avatar", "publish"],
  image: ["video", "avatar", "publish", "image"],
  video: ["publish", "video"],
  audio: ["avatar", "publish", "video"],
  avatar: ["publish"],
  publish: [],
};

export function isValidStudioConnection(sourceTipo: string, targetTipo: string): boolean {
  const allowed = CONNECTION_RULES[sourceTipo];
  if (!allowed) return true; // desconhecido → permite
  return allowed.includes(targetTipo);
}

// Cor semântica por tipo
export const KIND_COLORS: Record<string, string> = {
  image: "#f59e0b",
  video: "#f43f5e",
  audio: "#0ea5e9",
  prompt: "#c9922a",
  avatar: "#8b5cf6",
  publish: "#10b981",
  product: "#c9922a",
};
