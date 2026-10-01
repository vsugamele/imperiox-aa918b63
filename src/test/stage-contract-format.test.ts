import { describe, expect, it } from "vitest";
import { readStageContract } from "@shared/project-map";

// Formato usado nos contratos das etapas de SlimSoda e JP (MAP2.2): uma seção por linha.
const description = [
  "O QUÊ: Receber o pagamento no checkout H&W, preservando a origem do clique.",
  "ENTRADA: Link com hid/affid/package e UTM, fbclid e ad_id.",
  "SAÍDA: Pedido na H&W e aviso no webhook-pagamento do Império.",
  "PRONTO QUANDO: Primeira venda aprovada chegando ao Império com a origem preenchida.",
  "MÉTRICAS: Vendas aprovadas; % de vendas com UTM.",
  "DEPENDE DE: Webhook H&W apontando para o Império.",
  "FREQUÊNCIA: Contínua.",
  "SE FALHAR: Se a venda não chegar ao Império em 1 h, conferir o painel da H&W.",
].join("\n");

describe("stage contract format", () => {
  it("is read field by field by the shared contract reader", () => {
    const { fields } = readStageContract({ id: "n1", label: "Checkout H&W", description });
    // O leitor usa ". " como separador de seção, então o ponto final de cada seção some (exceto na última).
    const value = (key: string) => fields.find((f) => f.key === key)?.value?.replace(/\.$/, "");
    expect(value("objective")).toBe("Receber o pagamento no checkout H&W, preservando a origem do clique");
    expect(value("inputs")).toBe("Link com hid/affid/package e UTM, fbclid e ad_id");
    expect(value("output")).toBe("Pedido na H&W e aviso no webhook-pagamento do Império");
    expect(value("ready")).toBe("Primeira venda aprovada chegando ao Império com a origem preenchida");
    expect(value("metrics")).toBe("Vendas aprovadas; % de vendas com UTM");
    expect(value("dependencies")).toBe("Webhook H&W apontando para o Império");
    expect(value("frequency")).toBe("Contínua");
    expect(value("failure")).toBe("Se a venda não chegar ao Império em 1 h, conferir o painel da H&W");
    expect(fields.find((f) => f.key === "objective")?.source).toBe("Descrição / playbook");
  });
});
