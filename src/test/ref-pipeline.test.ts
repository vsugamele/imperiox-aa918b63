import { describe, expect, it } from "vitest";
import { libraryHealth, nextStep, parseLeitura, parseProject, projectNicho, projectRequest, type RefRow } from "@shared/ref-pipeline";

const S = "https://tkbivipqiewkfnhktmqq.supabase.co/storage/v1/object/";
const ref = (p: Partial<RefRow>): RefRow => ({ id: "r", tipo: "criativo", url: null, image_url: null, project_id: null, transcricao: null, transcribe_status: "idle", ...p });

describe("pipeline de referências", () => {
  it("decide o próximo passo e desiste depois de 3 tentativas", () => {
    expect(nextStep(ref({ image_url: `${S}sign/site-thumbs/x.jpg?token=abc` }))).toBe("guardar_midia");
    expect(nextStep(ref({ image_url: `${S}public/project-media/x.jpg` }))).toBe("ler_imagem");
    expect(nextStep(ref({ tipo: "video", url: `${S}public/project-media/x.mp4` }))).toBe("transcrever_video");
    expect(nextStep(ref({ tipo: "video", url: "https://www.instagram.com/reel/abc" }))).toBeNull(); // só link: precisa do arquivo
    expect(nextStep(ref({ transcricao: "texto", image_url: `${S}public/a.jpg` }))).toBe("projeto");
    expect(nextStep(ref({ transcricao: "texto", project_id: "slimsoda" }))).toBeNull();
    expect(nextStep(ref({ image_url: `${S}public/a.jpg`, pipeline: { ler_imagem: { tentativas: 3 } } }))).toBeNull();
    expect(nextStep(ref({ transcricao: "t", pipeline: { projeto: { feito: true } } }))).toBeNull();
  });

  it("lê o JSON do modelo e monta o texto que o Jev vai ler", () => {
    const img = parseLeitura('```json\n{"texto_na_imagem":"PARE de tomar café assim","descricao_visual":"Mulher segurando caneca","formato":"estatico","nicho":"emagrecimento"}\n```', "imagem");
    expect(img).toMatchObject({ formato: "estatico", nicho: "emagrecimento" });
    expect(img?.texto).toBe("PARE de tomar café assim\n\n[visual] Mulher segurando caneca");
    const vid = parseLeitura('{"transcricao":"","texto_na_tela":"3 sinais","descricao_visual":"Slides","formato":"inventado","gancho":"3 sinais"}', "video");
    expect(vid).toMatchObject({ formato: "outro", gancho: "3 sinais" });
    expect(vid?.texto).toContain("[na tela] 3 sinais");
    expect(parseLeitura("não sei", "imagem")).toBeNull();
    expect(parseLeitura('{"texto_na_imagem":""}', "imagem")).toBeNull();
  });

  it("pergunta o projeto ao Jev e só aceita com confiança alta", () => {
    const req = projectRequest("Rub lemon on your belly", [{ id: "slimsoda", name: "SlimSoda", nicho: "emagrecimento mulheres 40+" }]);
    expect(Object.keys(req.questions.projeto.criteria)).toEqual(["slimsoda", "nenhum"]);
    expect(parseProject({ answers: { projeto: { choice: "slimsoda", confidence: 0.82 } } })).toEqual({ project_id: "slimsoda", confianca: 0.82 });
    expect(parseProject({ answers: { projeto: { choice: "slimsoda", confidence: 0.5 } } }).project_id).toBeNull();
    expect(parseProject({ answers: { projeto: { choice: "nenhum", confidence: 0.9 } } }).project_id).toBeNull();
    expect(projectNicho({ publico_alvo: "Mulheres 40-70 com pernas inchadas" }, "x")).toBe("Mulheres 40-70 com pernas inchadas");
  });

  it("conta a saúde da biblioteca", () => {
    const h = libraryHealth([
      { ...ref({ tipo: "video", url: `${S}public/a.mp4`, transcricao: "x", project_id: "jp" }), copy_lib_status: "firme" },
      ref({ tipo: "video", url: "https://instagram.com/reel/1" }),
      ref({ image_url: `${S}public/b.jpg` }),
    ]);
    expect(h).toMatchObject({ total: 3, videos: 2, videos_com_texto: 1, imagens: 1, imagens_lidas: 0, com_projeto: 1, com_angulo: 1, so_link: 1 });
  });
});
