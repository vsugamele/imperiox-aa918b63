import { describe, expect, it } from "vitest";
import { capabilitiesForSkill, pickCapabilities, pickStepCapabilities, tasksForKind, type Capability } from "@shared/capabilities";
import { MAP_ELEMENTS } from "@shared/map-elements";

const cap = (id: string, serve_para: string[], prioridade: Capability["prioridade"], ativo = true, skills: string[] = []): Capability => ({
  id, nome: id, url: null, categoria: "x", descricao: null, quando_usar: null, serve_para, prioridade, licenca_nota: null, skills, ativo,
});

describe("capabilities", () => {
  it("maps map step kinds to production tasks", () => {
    expect(tasksForKind("meta_ads")).toEqual(expect.arrayContaining(["criativo_imagem", "criativo_video"]));
    expect(tasksForKind("vsl")).toEqual(expect.arrayContaining(["criativo_video", "pagina"]));
    expect(tasksForKind("advertorial")).toEqual(["pagina"]);
    expect(tasksForKind("pixel_meta")).toEqual(["dashboard"]);
    expect(tasksForKind("whatsapp")).toEqual([]);
    expect(tasksForKind(null)).toEqual([]);
  });

  it("covers every ad and page element of the map catalog", () => {
    const missing = MAP_ELEMENTS
      .filter((e) => e.family === "paginas" || ["anuncio", "meta_ads", "google_ads", "tiktok_ads", "youtube_ads", "reels"].includes(e.key))
      .filter((e) => tasksForKind(e.key).length === 0)
      .map((e) => e.key);
    expect(missing).toEqual([]);
  });

  it("picks active tools for the task, high priority first", () => {
    const caps = [cap("d3", ["dashboard"], "baixa"), cap("satori", ["criativo_imagem"], "alta"), cap("p5", ["criativo_imagem"], "baixa"),
      cap("old", ["criativo_imagem"], "alta", false), cap("sharp", ["criativo_imagem", "automacao"], "alta")];
    expect(pickCapabilities(caps, ["criativo_imagem"]).map((c) => c.id)).toEqual(["satori", "sharp", "p5"]);
    expect(pickCapabilities(caps, ["criativo_imagem"], 1).map((c) => c.id)).toEqual(["satori"]);
    expect(pickCapabilities(caps, [])).toEqual([]);
  });

  it("lists the active tools linked to a skill, high priority first", () => {
    const caps = [cap("ffmpeg", ["audio"], "baixa", true, ["vsl-filemon"]), cap("remotion", ["criativo_video"], "alta", true, ["vsl-filemon"]),
      cap("old", ["criativo_video"], "alta", false, ["vsl-filemon"]), cap("satori", ["criativo_imagem"], "alta", true, ["angulos-criativos"])];
    expect(capabilitiesForSkill(caps, "vsl-filemon").map((c) => c.id)).toEqual(["remotion", "ffmpeg"]);
    expect(capabilitiesForSkill(caps, "none")).toEqual([]);
    expect(capabilitiesForSkill(caps, null)).toEqual([]);
  });

  it("suggests the skill's tools before the ones for the step kind, without repeats", () => {
    const caps = [cap("satori", ["criativo_imagem"], "alta"), cap("sharp", ["criativo_imagem"], "alta", true, ["angulos-criativos"]),
      cap("tonejs", ["audio"], "baixa", true, ["angulos-criativos"]), cap("p5", ["criativo_imagem"], "baixa")];
    expect(pickStepCapabilities(caps, "imagem", "angulos-criativos").map((c) => c.id)).toEqual(["sharp", "tonejs", "satori", "p5"]);
    expect(pickStepCapabilities(caps, "imagem", "angulos-criativos", 2).map((c) => c.id)).toEqual(["sharp", "tonejs"]);
    expect(pickStepCapabilities(caps, "imagem", "none").map((c) => c.id)).toEqual(["satori", "sharp", "p5"]);
    expect(pickStepCapabilities(caps, "whatsapp", null)).toEqual([]);
  });
});
