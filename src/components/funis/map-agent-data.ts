import { readStepStatus, type AgentStatusReading } from "@shared/project-map";

export interface AgentExecutionData extends AgentStatusReading {
  executor: string;
  skill: string;
  prompt: string;
  output_url: string;
}

interface RegisteredAgentFields {
  executor_type?: string | null;
  linked_skill_id?: string | null;
  step_status?: string | null;
  checklist?: ReadonlyArray<{ done: boolean }>;
}

/** Same explicit precedence as project-mcp: notes tags, then registered node fields; status column before notes. */
export function extractAgentData(notes?: string | null, fields: RegisteredAgentFields = {}): AgentExecutionData {
  const text = notes ?? "";
  const executor = text.match(/\[agent_executor:([^\]]+)\]/)?.[1] || fields.executor_type || "human_general";
  const skill = text.match(/\[agent_skill:([^\]]+)\]/)?.[1] || fields.linked_skill_id || "none";
  const multi = text.match(/\[agent_prompt_start\]([\s\S]*?)\[agent_prompt_end\]/);
  return {
    executor, skill, ...readStepStatus({ step_status: fields.step_status, notes }),
    prompt: (multi?.[1] ?? text.match(/\[agent_prompt:([^\]]+)\]/)?.[1] ?? "").trim(),
    output_url: text.match(/\[agent_output:([^\]]+)\]/)?.[1] || "",
  };
}
