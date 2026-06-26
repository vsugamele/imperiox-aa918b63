// DSL Conversacional executável → FlowBlueprint compatível com FlowBlueprintCanvas
// Comandos: WAIT:, SEND:, QUESTION:, INPUT:, AUDIO:, VIDEO:, IF:, GOTO:

import type { FlowBlock, FlowNode, FlowEdge } from "./typebot-parser";

const CMD_RE = /^\s*(WAIT|SEND|QUESTION|INPUT|AUDIO|VIDEO|IF|GOTO)\s*:\s*(.+)$/i;

export interface FlowBlueprintLite {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables: any[];
  meta: { source: "dsl"; objetivo?: string };
}

export function isDslOutput(text?: string | null): boolean {
  if (!text) return false;
  const lines = text.split(/\r?\n/);
  let hits = 0;
  for (const ln of lines) {
    if (CMD_RE.test(ln)) {
      hits++;
      if (hits >= 2) return true;
    }
  }
  return false;
}

function parseWaitSeconds(v: string): number {
  const m = v.match(/(\d+)\s*(s|seg|sec|m|min|h|hr)?/i);
  if (!m) return 30;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "s").toLowerCase();
  if (unit.startsWith("m") && !unit.startsWith("min")) return n * 60; // m
  if (unit.startsWith("min")) return n * 60;
  if (unit.startsWith("h")) return n * 3600;
  return n;
}

export function dslToBlueprint(text: string, title = "Fluxo DSL"): FlowBlueprintLite {
  const rawLines = text.split(/\r?\n/);
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  let curBlocks: FlowBlock[] = [];
  let curTitle = "Início";
  let nodeIdx = 0;

  const flushNode = () => {
    if (curBlocks.length === 0) return;
    const id = `n${nodeIdx}`;
    nodes.push({
      id,
      title: curTitle,
      x: 80 + (nodeIdx % 4) * 320,
      y: 80 + Math.floor(nodeIdx / 4) * 260,
      blocks: curBlocks,
    });
    if (nodeIdx > 0) {
      edges.push({ id: `e${nodeIdx}`, from: `n${nodeIdx - 1}`, to: id });
    }
    nodeIdx++;
    curBlocks = [];
    curTitle = `Passo ${nodeIdx + 1}`;
  };

  for (const line of rawLines) {
    if (!line.trim()) continue;
    const m = line.match(CMD_RE);
    if (!m) {
      // texto solto → anexa como texto ao bloco corrente
      if (curBlocks.length === 0) {
        curBlocks.push({ id: crypto.randomUUID(), type: "text", text: line.trim() });
      } else {
        const last = curBlocks[curBlocks.length - 1];
        if (last.type === "text") last.text = `${last.text || ""}\n${line.trim()}`;
        else curBlocks.push({ id: crypto.randomUUID(), type: "text", text: line.trim() });
      }
      continue;
    }
    const cmd = m[1].toUpperCase();
    const val = m[2].trim();
    const blockId = crypto.randomUUID();
    switch (cmd) {
      case "WAIT":
        // WAIT quebra o nó (delay entre passos)
        flushNode();
        curBlocks.push({ id: blockId, type: "wait", seconds: parseWaitSeconds(val) });
        flushNode();
        break;
      case "SEND":
        curBlocks.push({ id: blockId, type: "text", text: val });
        break;
      case "AUDIO":
        curBlocks.push({ id: blockId, type: "video", video_url: val, text: `🎙️ Áudio: ${val}` });
        break;
      case "VIDEO":
        curBlocks.push({ id: blockId, type: "video", video_url: val });
        break;
      case "QUESTION":
        curBlocks.push({ id: blockId, type: "input_text", text: val });
        flushNode();
        break;
      case "INPUT": {
        // INPUT: tipo | label  (ex: INPUT: email | Qual seu e-mail?)
        const [t, ...rest] = val.split("|").map(s => s.trim());
        const label = rest.join(" | ");
        const map: Record<string, FlowBlock["type"]> = {
          email: "input_email",
          phone: "input_phone",
          telefone: "input_phone",
          number: "input_number",
          numero: "input_number",
          choice: "input_choice",
          escolha: "input_choice",
        };
        const type = map[t.toLowerCase()] || "input_text";
        curBlocks.push({ id: blockId, type, text: label || t, variable: t });
        flushNode();
        break;
      }
      case "IF":
        curBlocks.push({ id: blockId, type: "condition", text: val, condition: { value: val } });
        flushNode();
        break;
      case "GOTO":
        // simples marcação textual
        curBlocks.push({ id: blockId, type: "text", text: `↪ ir para: ${val}` });
        break;
    }
  }
  flushNode();

  return {
    title,
    nodes,
    edges,
    variables: [],
    meta: { source: "dsl" },
  };
}
