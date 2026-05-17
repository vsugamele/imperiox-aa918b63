export interface HyperFields {
  idade: string;
  genero: string;
  tipoPersonagem: string;
  fenotipo: string;
  tomPele: string;
  expressao: string;
  cabeloEstilo: string;
  cabeloCor: string;
  roupa: string;
  acessorios: string;
  pose: string;
  prop: string;
  cenario: string;
  horario: string;
  luzDirecao: string;
  colorGrade: string;
  camera: string;
  lente: string;
  abertura: string;
  iso: string;
  shutter: string;
  filme: string;
  estiloFinal: string;
}

const j = (parts: (string | undefined | null)[]) =>
  parts.filter((p) => p && p.trim()).join(", ");

export function buildHyperPrompt(f: HyperFields): string {
  const skinPrefix = f.fenotipo ? `${f.fenotipo} ${f.tomPele}` : f.tomPele;

  const lines: string[] = [];

  // Linha 1: RAW photo, idade-year-old tipo gênero
  const personagem = [
    f.idade ? `${f.idade}-year-old` : "",
    f.tipoPersonagem,
    f.genero,
  ].filter(Boolean).join(" ");
  if (personagem) lines.push(`RAW photo, a ${personagem},`);

  // Linha 2: skin + expressao
  const l2 = j([skinPrefix ? `${skinPrefix} skin` : "", f.expressao]);
  if (l2) lines.push(`${l2},`);

  // Linha 3: cabelo
  const cabelo = [f.cabeloCor, f.cabeloEstilo].filter(Boolean).join(" ");
  if (cabelo) lines.push(`${cabelo} hair,`);

  // Linha 4: roupa + acessórios
  const l4 = j([f.roupa, f.acessorios]);
  if (l4) lines.push(`${l4},`);

  // Linha 5: pose + prop
  const l5 = j([f.pose, f.prop]);
  if (l5) lines.push(`${l5},`);

  // Linha 6: cenário
  if (f.cenario) lines.push(`${f.cenario},`);

  // Linha 7: horário/atmosfera
  if (f.horario) lines.push(`${f.horario},`);

  // Linha 8: direção da luz
  if (f.luzDirecao) lines.push(`${f.luzDirecao},`);

  // Linha 9: câmera
  const camParts: string[] = [];
  if (f.camera) camParts.push(`shot on ${f.camera}`);
  if (f.lente) camParts.push(`with ${f.lente} lens`);
  if (f.abertura) camParts.push(`f/${f.abertura} aperture`);
  if (f.iso) camParts.push(`ISO ${f.iso}`);
  if (f.shutter) camParts.push(`1/${f.shutter}s shutter speed`);
  if (camParts.length) {
    camParts.push("shallow depth of field", "creamy bokeh");
    lines.push(`${camParts.join(", ")},`);
  }

  // Linha 10: filme + grade
  const l10 = j([
    f.filme ? `${f.filme} film emulation` : "",
    "subtle film grain",
    f.colorGrade,
  ]);
  if (l10) lines.push(`${l10},`);

  // Linha 11: finalização
  const final = j([
    "hyper-realistic",
    f.estiloFinal,
    "no studio lighting",
    "no filters",
    "8K resolution",
  ]);
  lines.push(final);

  return lines.join("\n");
}

export const emptyHyperFields: HyperFields = {
  idade: "35",
  genero: "woman",
  tipoPersonagem: "fortune teller",
  fenotipo: "",
  tomPele: "porcelain",
  expressao: "calm knowing gaze",
  cabeloEstilo: "long wavy",
  cabeloCor: "dark brown",
  roupa: "deep V-cut black silk corset top with delicate lace trim",
  acessorios: "multiple antique signet rings and a heavy obsidian pendant",
  pose: "leaning forward over a low table with cards spread around",
  prop: "a tarot card lifted near her face",
  cenario: "dimly lit ritual chamber with dark stone walls and candlelight",
  horario: "dramatic low-key candlelight with deep amber tones",
  luzDirecao: "dramatic chiaroscuro with profound velvet-black shadows",
  colorGrade: "rich burgundy and amber palette with deep teal shadows",
  camera: "Hasselblad X2D 100C",
  lente: "85mm f/1.4",
  abertura: "1.8",
  iso: "400",
  shutter: "125",
  filme: "Kodak Portra 400",
  estiloFinal: "dark cinematic, fine-art photography quality",
};
