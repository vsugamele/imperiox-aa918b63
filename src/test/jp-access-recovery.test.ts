import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jpPrepareAccessReply } from "@shared/crmBridgeJP";

const email = "fixture@example.test";
const active = { exists: true, entitlements: [{ is_active: true, scope: "program", program_id: "fixture-course" }] };
const link = "https://www.jphaireducation.com.br/auth/verify?token=" + "a".repeat(64);
describe("JP operational recovery contract", () => {
  beforeEach(() => {
    vi.stubGlobal("Deno", { env: { get: () => "test-only-secret" } });
    vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("asks for the purchase email before any operation", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const result = await jpPrepareAccessReply("Pronto!", "", "Não consigo acessar as aulas");
    expect(result.text).toContain("email"); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not invent recovery after a failed HTTP operation even when the body says ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ok:true,...active}), {status:401})));
    const result = await jpPrepareAccessReply("Entrou sem senha!",email,"Não consigo acessar");
    expect(result.needsHandoff).toBe(true); expect(result.text).not.toContain("sem senha");
  });
  it("does not equate an account with paid access", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({exists:true,entitlements:[]}))); vi.stubGlobal("fetch", fetch);
    expect((await jpPrepareAccessReply("Liberado!",email,"Quero acessar as aulas")).needsHandoff).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("announces recovery only after verified entitlements and a token link", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(active))).mockResolvedValueOnce(new Response(JSON.stringify({magic_link:link})));
    vi.stubGlobal("fetch",fetch);
    const result = await jpPrepareAccessReply("Pronto!",email,"Quero acessar as aulas");
    expect(result.needsHandoff).toBe(false); expect(result.text).toContain(link);
    const body = JSON.parse(fetch.mock.calls[1][1].body);
    expect(body).toMatchObject({action:"issue_magic_link",create_if_missing:false});
    expect(body.redirect_path).toBe("/programs/fixture-course");
  });
  it("rejects a root-domain fallback after a successful lookup", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(active))).mockResolvedValueOnce(new Response(JSON.stringify({magic_link:"https://jphaireducation.com.br"}))));
    const result = await jpPrepareAccessReply("Entre sem senha!",email,"Não consigo acessar");
    expect(result.needsHandoff).toBe(true); expect(result.text).not.toContain("https://");
  });
  it("does not mint another token in response to thanks after support", async () => {
    const fetch = vi.fn();vi.stubGlobal("fetch",fetch);
    expect((await jpPrepareAccessReply("Disponha!",email,"Obrigada\nQuero acessar as aulas","Obrigada")).text).toBe("Disponha!");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("hands off a failed sent link without spending another recovery request", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const result = await jpPrepareAccessReply("Vou mandar de novo", email, "Não consigo acessar", "Ainda não consegui entrar", true);
    expect(result.needsHandoff).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("guides login when the screenshot shows the account already exists instead of handing off", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const fromVision = await jpPrepareAccessReply("Pelo print, aparece 'User already registered': você já tem conta.", email, "Não consigo acessar", "📷 Não consegui entrar, apareceu essa mensagem", true);
    expect(fromVision.needsHandoff).toBe(false);
    expect(fromVision.text).toContain("Esqueci minha senha");
    expect((await jpPrepareAccessReply("Ok", email, "", "diz que já tem conta com meu email")).needsHandoff).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses a model-generated courtesy instead of granting all courses", async () => {
    const fetch = vi.fn();vi.stubGlobal("fetch",fetch);
    expect((await jpPrepareAccessReply(`[JP_GRANT:${email}] Acesso liberado!`,email,"Meu pagamento não apareceu")).needsHandoff).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("JP Course Mapping & Anti-Hallucination Support Messages", () => {
  it("resolves Código dos Cortes Perfeitos to its direct program UUID", async () => {
    const { resolveJPCourse } = await import("../lib/jpCourseMap");
    const course = resolveJPCourse("Código dos Cortes Perfeitos");
    expect(course.programId).toBe("3c368b42-5b73-4d86-a1cd-35c3022b142d");
    expect(course.directUrl).toContain("3c368b42-5b73-4d86-a1cd-35c3022b142d");
  });

  it("resolves other satellite courses like Cortes Descomplicados and Segredo do Corte", async () => {
    const { resolveJPCourse } = await import("../lib/jpCourseMap");
    expect(resolveJPCourse("Cortes Descomplicados").programId).toBe("3c5551b0-7379-4ade-b306-194d9814f601");
    expect(resolveJPCourse("O Segredo do Corte").programId).toBe("164d66e6-8186-4d1a-8303-e2b88bf95f7f");
  });

  it("builds a friendly support message explaining why Home shows Acesso Negado", async () => {
    const { buildJPSupportMessage } = await import("../lib/jpCourseMap");
    const msg = buildJPSupportMessage({
      leadName: "Manoelle Cabral",
      courseTitle: "Código dos Cortes Perfeitos",
      directUrl: "https://www.jphaireducation.com.br/programs/3c368b42-5b73-4d86-a1cd-35c3022b142d",
    });
    expect(msg).toContain("Oi Manoelle!");
    expect(msg).toContain("3c368b42-5b73-4d86-a1cd-35c3022b142d");
    expect(msg).toContain("Acesso negado");
    expect(msg).toContain("797");
  });
});
