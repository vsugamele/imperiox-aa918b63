import { describe, expect, it } from "vitest";
import { decideMemoflowX1 } from "../../supabase/functions/_shared/memoflow-x1-engine";

describe("MemoFlow X1 engine", () => {
  it("routes anti-scam concern to proof without checkout", () => {
    const decision = decideMemoflowX1({
      message: "Isso e golpe? Vi muito anuncio fake com celebridade.",
      ad_angle: "anti_scam",
    });

    expect(decision.action).toBe("continue");
    expect(decision.state.entry_angle).toBe("anti_scam");
    expect(decision.state.objection).toBe("scam");
    expect(decision.state.stage).toBe("proof");
    expect(decision.reply.toLowerCase()).toContain("desconfiaria");
  });

  it("sends checkout for hot lead and schedules recovery", () => {
    const decision = decideMemoflowX1({
      message: "Faz sentido, me manda o link para comprar",
      state: {
        stage: "offer",
        pain: "word_recall",
        buyer: "self",
        entry_angle: "lithium",
      },
      checkout_url: "https://checkout.example/memoflow",
    });

    expect(decision.action).toBe("checkout");
    expect(decision.state.checkout_sent).toBe(true);
    expect(decision.reply).toContain("https://checkout.example/memoflow");
    expect(decision.followup?.delay_minutes).toBe(15);
    expect(decision.events.some((e) => e.name === "CheckoutSent")).toBe(true);
  });

  it("safe pauses when medication or diagnosis appears", () => {
    const decision = decideMemoflowX1({
      message: "Minha mae tem diagnostico e toma remedio, posso comprar?",
      state: { stage: "offer", buyer: "parent", pain: "caregiver_worry" },
    });

    expect(decision.action).toBe("safe_pause");
    expect(decision.compliance.safe).toBe(false);
    expect(decision.state.stage).toBe("safe_pause");
    expect(decision.reply.toLowerCase()).toContain("medico");
    expect(decision.events.some((e) => e.name === "SafetyFlagged")).toBe(true);
  });

  it("captures CRM fields with consent", () => {
    const decision = decideMemoflowX1({
      message: "Sou Ana, pode mandar no meu email ana@example.com",
      state: { stage: "crm", pain: "repeating", buyer: "parent" },
    });

    expect(decision.crm_patch.first_name).toBe("Ana");
    expect(decision.crm_patch.email).toBe("ana@example.com");
    expect(decision.state.crm.consent).toBe("explicit_email");
    expect(decision.events.some((e) => e.name === "CRMContactCaptured")).toBe(true);
  });
});
