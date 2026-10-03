import { describe, expect, it } from "vitest";
import { ACCESS, ACCESS_BY_KEY, CHANNELS, OPS_TOOLS, accessChecklist, channelsFromPlaybooks, parseChannels } from "@shared/launch-kit";
import { PLAYBOOK_LIBRARY } from "@shared/playbook-library";

describe("kit de operação: catálogo", () => {
  it("todo acesso, dependência e ferramenta citados existem", () => {
    const tools = new Set(OPS_TOOLS.map((t) => t.id));
    for (const a of ACCESS) {
      for (const d of a.depende_de) expect(ACCESS_BY_KEY.has(d), `${a.key} depende de ${d}`).toBe(true);
      if (a.ferramenta) expect(tools.has(a.ferramenta), a.ferramenta).toBe(true);
    }
    for (const c of CHANNELS) {
      for (const k of [...c.acessos, ...c.opcionais]) expect(ACCESS_BY_KEY.has(k), `${c.key}: ${k}`).toBe(true);
      for (const t of c.ferramentas) expect(tools.has(t), `${c.key}: ${t}`).toBe(true);
    }
    expect(new Set(ACCESS.map((a) => a.key)).size).toBe(ACCESS.length);
    expect(new Set(OPS_TOOLS.map((t) => t.id)).size).toBe(OPS_TOOLS.length);
  });

  it("os playbooks dos canais estão na biblioteca (YouTube entra no LAUNCH1.2)", () => {
    const library = new Set(PLAYBOOK_LIBRARY.map((p) => p.id));
    const missing = CHANNELS.flatMap((c) => c.playbooks).filter((p) => !library.has(p));
    expect(missing).toEqual(["youtube-canal"]);
  });
});

describe("kit de operação: canais", () => {
  it("entende o pedido em texto livre", () => {
    expect(parseChannels("YouTube, SEO, tráfego direto, X1")).toEqual({ canais: ["youtube", "seo", "ads_direto", "x1"], invalidos: [] });
    expect(parseChannels("tiktok + reels; podcast")).toEqual({ canais: ["organico_social"], invalidos: ["podcast"] });
  });

  it("deduz os canais pelos playbooks aplicados", () => {
    expect(channelsFromPlaybooks(["esteira-escala-dtc", "x1-conversa", "outro"])).toEqual(["ads_direto", "x1"]);
  });
});

describe("kit de operação: checklist de acessos", () => {
  it("junta os canais sem repetir, inclui dependências e ordena", () => {
    const kit = accessChecklist(["youtube", "seo"], []);
    expect(kit.itens.filter((i) => i.obrigatorio).map((i) => i.key)).toEqual(["google_conta", "youtube_canal", "dominio", "site", "tracker", "search_console"]);
    expect(kit.itens.find((i) => i.key === "google_conta")?.canais).toEqual(["youtube", "seo"]);
    expect(kit.itens.find((i) => i.key === "voz_ia")?.obrigatorio).toBe(false);
    expect(kit.progresso).toBe("0/6");
    // Só o que não espera outro acesso aparece como próximo passo.
    expect(kit.proximos).toEqual(["google_conta", "dominio"]);
    expect(kit.itens.find((i) => i.key === "search_console")?.bloqueado_por).toEqual(["dominio", "google_conta"]);
  });

  it("evidência do banco conta como conectado e corrige declaração atrasada", () => {
    const kit = accessChecklist(["x1"], [{ access_key: "whatsapp", status: "falta" }], { whatsapp: true, vendas: true });
    expect(kit.itens.filter((i) => i.obrigatorio).map((i) => [i.key, i.status, !!i.aviso])).toEqual([["checkout", "conectado", false], ["whatsapp", "conectado", true]]);
    expect(kit.itens.filter((i) => !i.obrigatorio).map((i) => i.key)).toEqual(["meta_bm", "ads_sync"]);
    expect(kit.pronto_para_rodar).toBe(true);
  });

  it("avisa quando dizem conectado mas não há dado, e respeita 'não se aplica'", () => {
    const kit = accessChecklist(["ads_direto"], [
      { access_key: "tracker", status: "conectado" },
      { access_key: "dominio", status: "nao_se_aplica" },
    ], { tracker: false });
    expect(kit.itens.find((i) => i.key === "tracker")?.aviso).toMatch(/não viu dados/);
    // Quem diz que o tracker está ligado diz que o site existe.
    expect(kit.itens.find((i) => i.key === "site")).toMatchObject({ status: "conectado", bloqueado_por: [] });
    expect(kit.progresso).toBe("2/5");
  });

  it("dado no banco prova as dependências e traz as dependências dos opcionais", () => {
    const kit = accessChecklist(["ads_direto"], [], { tracker: true });
    expect(kit.itens.filter((i) => ["dominio", "site", "tracker"].includes(i.key)).map((i) => [i.key, i.status, i.aviso])).toEqual([
      ["dominio", "conectado", "Inferido: Tracker do Império nas páginas já funciona."],
      ["site", "conectado", "Inferido: Tracker do Império nas páginas já funciona."],
      ["tracker", "conectado", null],
    ]);
    expect(kit.itens.find((i) => i.key === "google_conta")).toMatchObject({ obrigatorio: false, status: "falta" });
    expect(kit.itens.find((i) => i.key === "pixel_capi")?.bloqueado_por).toEqual(["meta_bm"]);
  });
});
