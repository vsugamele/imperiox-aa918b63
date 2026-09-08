import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FlowLivePreview } from "@/components/openflow/FlowLivePreview";
import { readExecutionSteps } from "@/lib/flow-execution-data";

describe("OpenFlow stored formats", () => {
  it("previews the actual template and delay fields used by the editor", () => {
    render(<FlowLivePreview triggerTipo="manual" onClose={() => {}} acoes={[
      { tipo: "whatsapp", template: "Mensagem do roteiro", delay_min: 0 },
      { tipo: "aguardar", template: "", delay_min: 12 },
    ]} />);
    expect(screen.getByText("Mensagem do roteiro")).toBeTruthy();
    expect(screen.getByText(/aguardando 12min/)).toBeTruthy();
  });
  it("keeps malformed log evidence visible instead of treating it as a successful step", () => {
    const result = readExecutionSteps([{ step: 1, status: "sent", provider_extra: "retained" }, { status: { invalid: true } }]);
    expect(result[0].provider_extra).toBe("retained");
    expect(result[1].status).toBe("invalid_log");
    expect(result[1].raw).toEqual({ status: { invalid: true } });
  });
});
