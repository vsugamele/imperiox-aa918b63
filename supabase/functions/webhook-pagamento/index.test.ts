// Testes unitários para webhook-pagamento.
// Cobre: detecção de plataforma, extração financeira, UTMs e event_id determinístico (CAPI dedup).
import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  parseWebhookBody,
  extractFinanceiro,
  decodeXcod,
  extractUtms,
  parseTictoDate,
  buildCapiEventId,
} from "./index.ts";

// ─────────────────────────── Ticto v2 ───────────────────────────
Deno.test("Ticto v2: detecta plataforma e mapeia status authorized -> compra_aprovada", () => {
  const body = {
    version: "2.0",
    token: "tok",
    status: "authorized",
    customer: { email: "joao@test.com", name: "João Silva", phone: { ddd: "11", number: "999998888" } },
    order: { paid_amount: 19700, approved_at: "2026-06-15T10:00:00Z" },
    item: { product_name: "Curso X", price: 19700 },
  };
  const r = parseWebhookBody(body, null);
  assertEquals(r.plataforma, "Ticto");
  assertEquals(r.evento, "compra_aprovada");
  assertEquals(r.email, "joao@test.com");
  assertEquals(r.valor, 197);
  assertEquals(r.phone, "11999998888");
  assertEquals(r.tipo_venda, "principal");
});

Deno.test("Ticto v2: order bump marca tipo_venda=orderbump", () => {
  const body = {
    version: "2.0", token: "t", status: "authorized",
    customer: { email: "a@b.com", name: "A", phone: { ddd: "11", number: "9" } },
    order: { paid_amount: 9700 },
    item: { product_name: "Bump", price: 9700, is_bump: true },
  };
  assertEquals(parseWebhookBody(body, null).tipo_venda, "orderbump");
});

// ─────────────────────────── Hotmart ───────────────────────────
Deno.test("Hotmart: PURCHASE_APPROVED com BRL", () => {
  const body = {
    event: "PURCHASE_APPROVED",
    data: {
      buyer: { email: "x@y.com", name: "Maria", checkout_phone: "+5511988887777" },
      product: { name: "Mentoria" },
      purchase: {
        price: { value: 497, currency_value: "BRL" },
        approved_date: 1734567890000,
        transaction: "HM-TX-123",
      },
    },
  };
  const r = parseWebhookBody(body, "hotmart-token");
  assertEquals(r.plataforma, "Hotmart");
  assertEquals(r.evento, "compra_aprovada");
  assertEquals(r.valor, 497);
  assertEquals(r.externalTxId, "HM-TX-123");
});

// ─────────────────────────── Kiwify ───────────────────────────
Deno.test("Kiwify: order_status=paid -> compra_aprovada", () => {
  const body = {
    order_status: "paid",
    Customer: { email: "k@k.com", full_name: "Kelly", mobile: "11977776666" },
    sale_amount: "297.00",
    product_name: "E-book",
    order_id: "KW-001",
  };
  const r = parseWebhookBody(body, null);
  assertEquals(r.plataforma, "Kiwify");
  assertEquals(r.evento, "compra_aprovada");
  assertEquals(r.valor, 297);
  assertEquals(r.externalTxId, "KW-001");
});

// ─────────────────────────── Perfect Pay ───────────────────────────
Deno.test("PerfectPay: sale_status_enum=2 -> compra_aprovada", () => {
  const body = {
    code: "PP-CODE-9",
    sale_status_enum: 2,
    sale_status_detail: "approved",
    customer: { email: "p@p.com", full_name: "Pedro", phone: "11966665555" },
    product: { name: "Curso PP" },
    sale_amount: "397.50",
    payment_method_enum: 1,
  };
  const r = parseWebhookBody(body, null);
  assertEquals(r.plataforma, "PerfectPay");
  assertEquals(r.evento, "compra_aprovada");
  assertEquals(r.valor, 397.5);
  assertEquals(r.externalTxId, "PP-CODE-9");
  assertEquals(r.financeiro?.metodo_pagamento, "credit_card");
});

Deno.test("PerfectPay: pix pendente desambigua para pix_gerado", () => {
  const body = {
    code: "PP-PIX-1",
    sale_status_enum: 1,
    customer: { email: "p@p.com" },
    payment_method_enum: 3,
    sale_amount: "100",
    product: { name: "X" },
  };
  assertEquals(parseWebhookBody(body, null).evento, "pix_gerado");
});

// ─────────────────────────── extractFinanceiro ───────────────────────────
Deno.test("extractFinanceiro: Ticto converte centavos e separa comissões", () => {
  const body = {
    order: { paid_amount: 19700, net_amount: 18000, platform_fee: 1500, transaction_fee: 200, code: "T-1", payment_method: "pix", installments: 1 },
    commissions: [{ role: "producer", value: 17000 }, { role: "affiliate", value: 1000 }],
  };
  const f = extractFinanceiro(body, "Ticto")!;
  assertEquals(f.valor_bruto, 197);
  assertEquals(f.valor_liquido, 180);
  assertEquals(f.comissao_produtor, 170);
  assertEquals(f.comissao_afiliado, 10);
  assertEquals(f.metodo_pagamento, "pix");
});

// ─────────────────────────── UTMs ───────────────────────────
Deno.test("decodeXcod: formato pipe campaign|adset|ad", () => {
  const r = decodeXcod("camp1%7Cadset1%7Cad1");
  assertEquals(r.utm_campaign, "camp1");
  assertEquals(r.utm_content, "adset1");
  assertEquals(r.utm_term, "ad1");
});

Deno.test("extractUtms: pega utm_campaign direto e via xcod", () => {
  const r1 = extractUtms({ utm_campaign: "black" })!;
  assertEquals(r1.utm_campaign, "black");
  const r2 = extractUtms({ xcod: "lancamento%7Caudienca-fria%7Ccriativo-A" })!;
  assertEquals(r2.utm_campaign, "lancamento");
  assertEquals(r2.utm_content, "audienca-fria");
});

// ─────────────────────────── parseTictoDate ───────────────────────────
Deno.test("parseTictoDate: DD/MM/YYYY BR converte para ISO UTC", () => {
  const iso = parseTictoDate("13/06/2026 10:00:00");
  assertEquals(iso.startsWith("2026-06-13T13:00:00"), true); // BRT +3 -> UTC
});

Deno.test("parseTictoDate: data futura >1d cai no fallback (now)", () => {
  const future = parseTictoDate("01/01/2099 10:00:00");
  const year = new Date(future).getUTCFullYear();
  // Deve ser ano atual, não 2099
  assertEquals(year < 2099, true);
});

// ─────────────────────────── CAPI event_id dedup ───────────────────────────
Deno.test("buildCapiEventId: determinístico para mesma tx + evento", async () => {
  const a = await buildCapiEventId("TX-123", "Purchase", "fallback");
  const b = await buildCapiEventId("TX-123", "Purchase", "fallback");
  assertEquals(a, b);
  assertEquals(a.length, 64); // SHA-256 hex
});

Deno.test("buildCapiEventId: muda quando evento muda", async () => {
  const a = await buildCapiEventId("TX-123", "Purchase", "fb");
  const b = await buildCapiEventId("TX-123", "Lead", "fb");
  assertNotEquals(a, b);
});

Deno.test("buildCapiEventId: usa fallback quando externalTxId vazio", async () => {
  const a = await buildCapiEventId(null, "Purchase", "email:100");
  const b = await buildCapiEventId("", "Purchase", "email:100");
  assertEquals(a, b);
  assertExists(a);
});
