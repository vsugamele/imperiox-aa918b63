import { describe, expect, it } from "vitest";
import { hasHardBlock, triageRequest, triageVerdict } from "@shared/knowledge-triage";

const ans = (r: number, p: number) => ({ answers: { reutilizavel: { noul: r }, dado_pessoal: { noul: p } } });

describe("triagem do acervo do bot", () => {
  it("bloqueia dado pessoal e link de acesso sem perguntar ao modelo", () => {
    expect(hasHardBlock({ pergunta: "ameliamaria92@gmail.com", resposta: "Veja se liberou" })).toBe(true);
    expect(hasHardBlock({ pergunta: "meu cpf 020.373.131-01", resposta: "ok, vou ver" })).toBe(true);
    expect(hasHardBlock({ pergunta: "não entra", resposta: "https://x.supabase.co/auth/v1/verify?token=abc" })).toBe(true);
    expect(triageVerdict({ pergunta: "ameliamaria92@gmail.com", resposta: "Veja se liberou!" }, ans(0.99, 0)).decisao).toBe("descartar");
  });

  it("aprova reutilizável, descarta conversa solta e manda o meio para o time", () => {
    const q = { pergunta: "Como faço para acessar o curso?", resposta: "Clique em esqueci minha senha na tela de login e crie uma nova." };
    expect(triageVerdict(q, ans(0.92, 0.05)).decisao).toBe("aprovar");
    expect(triageVerdict({ pergunta: "E vai ser a última chance", resposta: "Muito obrigado irmão" }, ans(0.1, 0.1)).decisao).toBe("descartar");
    expect(triageVerdict(q, ans(0.6, 0.2)).decisao).toBe("revisar");
    expect(triageVerdict({ pergunta: "📷", resposta: "Brasil vai ser 9" }, ans(0.9, 0)).decisao).toBe("descartar");
  });

  it("monta duas perguntas sim/não sobre a mesma conversa", () => {
    const req = triageRequest({ pergunta: "Qual o valor?", resposta: "R$ 47 no link" }, "Código dos Cortes Perfeitos");
    expect(Object.keys(req.questions)).toEqual(["reutilizavel", "dado_pessoal"]);
    expect(req.state.produto).toBe("Código dos Cortes Perfeitos");
  });
});
