import { describe, expect, it } from "vitest";
import {
  buildRecoveryBuckets,
  computeTouch,
  extractPixCode,
  extractPaymentLink,
  interpolateRecoveryTemplate,
  getTouchCadenceMessage,
  type RecoveryItem,
} from "@/lib/recoveryBuckets";

describe("Automação de Recuperação de Pix & Carrinho", () => {
  describe("Trava Anti-Duplicação", () => {
    it("remove do radar leads que já possuem compra aprovada no sistema", () => {
      const now = new Date();
      const past30m = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

      const vendas = [
        // Pix pendente gerado há 30 min
        {
          id: "venda_pix_1",
          project_id: "proj_1",
          lead_id: "lead_123",
          produto_nome: "Formação LinfaFlow",
          status: "aguardando_pagamento",
          valor: 97,
          created_at: past30m,
          data_venda: past30m,
          data: {
            pix_code: "00020126580014br.gov.bcb.pix0136linfaflow97",
            link_pagamento: "https://pay.linfaflow.com/pix123",
            email: "aluna@teste.com",
            phone: "5511999998888",
          },
        },
        // Venda aprovada posterior do mesmo lead (ex: pagou no cartão)
        {
          id: "venda_aprovada_1",
          project_id: "proj_1",
          lead_id: "lead_123",
          produto_nome: "Formação LinfaFlow",
          status: "aprovado",
          valor: 97,
          created_at: now.toISOString(),
          data_venda: now.toISOString(),
          data: {
            email: "aluna@teste.com",
            phone: "5511999998888",
          },
        },
      ];

      const leads = [
        {
          id: "lead_123",
          project_id: "proj_1",
          nome: "Manoelle Silva",
          email: "aluna@teste.com",
          phone: "5511999998888",
          status: "cliente",
          criado_em: past30m,
          updated_at: now.toISOString(),
          data: {},
        },
      ];

      const buckets = buildRecoveryBuckets({ vendas, leads, logs: [] });
      const pixUrgent = buckets.find((b) => b.id === "pix_urgent");
      const pixCooling = buckets.find((b) => b.id === "pix_cooling");
      const cart = buckets.find((b) => b.id === "abandoned_cart");

      // Deve ser 0 porque a cliente já comprou (trava anti-duplicação)
      expect(pixUrgent?.items).toHaveLength(0);
      expect(pixCooling?.items).toHaveLength(0);
      expect(cart?.items).toHaveLength(0);
    });

    it("bloqueia mesmo se o lead_id for diferente mas o telefone ou e-mail coincidir com compra aprovada", () => {
      const now = new Date();
      const past20m = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

      const vendas = [
        // Pix pendente com lead_id_A
        {
          id: "venda_pix_anon",
          project_id: "proj_1",
          lead_id: "lead_anon",
          produto_nome: "Curso Slim Soda",
          status: "aguardando_pagamento",
          valor: 47,
          created_at: past20m,
          data_venda: past20m,
          data: {
            email: "compradora@gmail.com",
            phone: "11988887777",
          },
        },
        // Venda aprovada com lead_id_B mas mesmo e-mail
        {
          id: "venda_paga",
          project_id: "proj_1",
          lead_id: "lead_pago",
          produto_nome: "Curso Slim Soda",
          status: "pago",
          valor: 47,
          created_at: now.toISOString(),
          data_venda: now.toISOString(),
          data: {
            email: "compradora@gmail.com",
            phone: "11988887777",
          },
        },
      ];

      const buckets = buildRecoveryBuckets({ vendas, leads: [], logs: [] });
      const pixUrgent = buckets.find((b) => b.id === "pix_urgent");
      expect(pixUrgent?.items).toHaveLength(0);
    });

    it("permite lead sem compra aprovada permanecer na fila de recuperação", () => {
      const now = new Date();
      const past40m = new Date(now.getTime() - 40 * 60 * 1000).toISOString();

      const vendas = [
        {
          id: "venda_pix_real",
          project_id: "proj_1",
          lead_id: "lead_pendente",
          produto_nome: "Formação LinfaFlow",
          status: "aguardando_pagamento",
          valor: 397,
          created_at: past40m,
          data_venda: past40m,
          data: {
            pix_copia_cola: "00020126580014br.gov.bcb.pix0136linfaflow397",
            checkout_url: "https://checkout.linfaflow.com/pay",
          },
        },
      ];

      const leads = [
        {
          id: "lead_pendente",
          project_id: "proj_1",
          nome: "Juliana Santos",
          email: "juliana@teste.com",
          phone: "11977776666",
          status: "lead",
          criado_em: past40m,
          updated_at: past40m,
          data: {},
        },
      ];

      const buckets = buildRecoveryBuckets({ vendas, leads, logs: [] });
      const pixUrgent = buckets.find((b) => b.id === "pix_urgent");

      expect(pixUrgent?.items).toHaveLength(1);
      const item = pixUrgent?.items[0];
      expect(item?.leadName).toBe("Juliana Santos");
      expect(item?.value).toBe(397);
      expect(item?.pixCode).toBe("00020126580014br.gov.bcb.pix0136linfaflow397");
      expect(item?.paymentLink).toBe("https://checkout.linfaflow.com/pay");
    });
  });

  describe("Régua de 3 Toques", () => {
    it("calcula Toque 1 para menos de 2 horas (15 min - Pix & Suporte)", () => {
      const touch = computeTouch(0.5); // 30 min
      expect(touch.touchLevel).toBe(1);
      expect(touch.touchLabel).toContain("Toque 1");
    });

    it("calcula Toque 2 para entre 2h e 24h (2h - Reserva & Vaga)", () => {
      const touch = computeTouch(4); // 4 horas
      expect(touch.touchLevel).toBe(2);
      expect(touch.touchLabel).toContain("Toque 2");
    });

    it("calcula Toque 3 para mais de 24h (Urgente - Cancelamento)", () => {
      const touch = computeTouch(30); // 30 horas
      expect(touch.touchLevel).toBe(3);
      expect(touch.touchLabel).toContain("Toque 3");
    });

    it("gera mensagens persuasivas distintas para cada toque", () => {
      const baseItem: RecoveryItem = {
        id: "item_1",
        bucket: "pix_urgent",
        templateType: "pix_2h",
        projectId: "proj_1",
        leadId: "lead_1",
        vendaId: "venda_1",
        leadName: "Camila",
        email: "camila@teste.com",
        phone: "5511999998888",
        product: "LinfaFlow",
        value: 97,
        createdAt: new Date().toISOString(),
        ageLabel: "há 15 minutos",
        lastContact: null,
        lastContactAt: null,
        paymentLink: "https://pay.linfaflow.com/123",
        pixCode: "00020126580014br.gov.bcb.pix0136teste",
        touchLevel: 1,
        touchLabel: "Toque 1 (15m)",
      };

      // Toque 1: deve conter Pix Copia e Cola
      const msgT1 = getTouchCadenceMessage({ ...baseItem, touchLevel: 1 }, "fallback");
      expect(msgT1).toContain("{pix_code}");
      expect(msgT1).toContain("Oi, {nome}!");

      // Toque 2: deve focar em reserva de vaga e liberação imediata
      const msgT2 = getTouchCadenceMessage({ ...baseItem, touchLevel: 2 }, "fallback");
      expect(msgT2).toContain("reserva");
      expect(msgT2).toContain("liberação é na hora");

      // Toque 3: deve focar em urgência e cancelamento
      const msgT3 = getTouchCadenceMessage({ ...baseItem, touchLevel: 3 }, "fallback");
      expect(msgT3).toContain("Último aviso");
      expect(msgT3).toContain("cancelar o seu Pix");
    });
  });

  describe("Extração de Pix e Interpolação", () => {
    it("extrai código Pix direto e aninhado no payload", () => {
      expect(extractPixCode({ pix_code: "00020126580014br.gov.bcb.pix" })).toBe("00020126580014br.gov.bcb.pix");
      expect(extractPixCode({ pix_copia_cola: "00020126580014br.gov.bcb.pix" })).toBe("00020126580014br.gov.bcb.pix");
      expect(extractPixCode({ payment: { pix: { qrcode: "00020126580014br.gov.bcb.pix" } } })).toBe("00020126580014br.gov.bcb.pix");
    });

    it("extrai link de pagamento em diversos formatos", () => {
      expect(extractPaymentLink({ checkout_url: "https://kiwify.com.br/pay" })).toBe("https://kiwify.com.br/pay");
      expect(extractPaymentLink({ payment: { invoice_url: "https://hotmart.com/pay" } })).toBe("https://hotmart.com/pay");
    });

    it("interpola {pix_code}, {link_pagamento}, {nome}, {produto} e {valor}", () => {
      const item: RecoveryItem = {
        id: "item_test",
        bucket: "pix_urgent",
        templateType: "pix_2h",
        projectId: "proj_1",
        leadId: "lead_1",
        vendaId: "venda_1",
        leadName: "Fernanda",
        email: "fernanda@teste.com",
        phone: "5511999998888",
        product: "LinfaFlow Gotas",
        value: 197,
        createdAt: new Date().toISOString(),
        ageLabel: "há 10 min",
        lastContact: null,
        lastContactAt: null,
        paymentLink: "https://pay.linfaflow.com/chk",
        pixCode: "00020126580014br.gov.bcb.pix0136linfaflow197",
        touchLevel: 1,
      };

      const template = "Oi {nome}, o Pix de {produto} no valor de {valor} está aqui: {pix_code} ou no link {link_pagamento}";
      const interpolated = interpolateRecoveryTemplate(template, item);

      expect(interpolated).toContain("Fernanda");
      expect(interpolated).toContain("LinfaFlow Gotas");
      expect(interpolated).toContain("00020126580014br.gov.bcb.pix0136linfaflow197");
      expect(interpolated).toContain("https://pay.linfaflow.com/chk");
      expect(interpolated).toContain("R$");
    });
  });
});
