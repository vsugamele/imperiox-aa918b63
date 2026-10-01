import { render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { MapNodeCard } from "@/components/funis/MapNodeCard";
import type { MapNodeData } from "@/components/funis/map-node-model";

const node = (over: Partial<MapNodeData> = {}): MapNodeData => ({
  id: "n1", map_id: "m1", label: "Checkout H&W", kind: "checkout", color: "#84cc16",
  position: { x: 0, y: 0 }, size: "M", checklist: [], ...over,
});
const renderCard = (data: MapNodeData) => render(<ReactFlowProvider><MapNodeCard data={data} /></ReactFlowProvider>);

describe("MapNodeCard", () => {
  it("shows the step number, what it does, who executes, the print and what is pending", () => {
    renderCard(node({
      stepNumber: 7,
      stage_role: "Receber o pagamento",
      executor_type: "EXTERNAL_TOOL",
      description: "O QUÊ: checkout canônico da oferta H&W. FALTA: primeira venda com origem.",
      image_url: "https://x/print.png",
      checklist: [
        { id: "a", text: "UTM até o checkout", done: true },
        { id: "b", text: "Venda chegando ao Império", done: false },
      ],
    }));
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Receber o pagamento")).toBeInTheDocument();
    expect(screen.getByText("checkout canônico da oferta H&W.")).toBeInTheDocument();
    expect(screen.getByText("Ferramenta externa")).toBeInTheDocument();
    expect(screen.getByAltText("Print de Checkout H&W")).toHaveAttribute("src", "https://x/print.png");
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Venda chegando ao Império")).toBeInTheDocument();
    expect(screen.queryByText("UTM até o checkout")).not.toBeInTheDocument();
  });

  it("only shows a status that was declared, and the skill from the step", () => {
    renderCard(node({ executor_type: "AI_SKILL", linked_skill_id: "angulos-criativos" }));
    expect(screen.getByText("Sem status")).toBeInTheDocument();
    expect(screen.getByText("IA executa")).toBeInTheDocument();
    expect(screen.getByText("angulos-criativos")).toBeInTheDocument();
  });

  it("reads a declared status from the notes", () => {
    renderCard(node({ notes: "[agent_status:ready_review]" }));
    expect(screen.getByText("Revisar")).toBeInTheDocument();
  });
});
