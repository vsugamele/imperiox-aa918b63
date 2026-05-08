import JSZip from "jszip";

export interface ExportableSkill {
  id: string;
  nome: string;
  descricao: string;
  categoria?: string;
  versao?: string;
  gatilho?: string;
  system_prompt?: string | null;
}

export function toClaudeSkillSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "skill";
}

function escapeYaml(s: string): string {
  // Single-line YAML scalar — wrap in double quotes and escape "
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

export function buildSkillMarkdown(skill: ExportableSkill): string {
  const slug = toClaudeSkillSlug(skill.nome);
  const description = truncate(
    (skill.descricao || skill.nome).replace(/\s+/g, " ").trim(),
    1024
  );
  const body =
    (skill.system_prompt && skill.system_prompt.trim()) ||
    `# ${skill.nome}\n\n${skill.descricao || ""}\n\n> Esta skill ainda não tem um system prompt detalhado. Use a descrição acima como guia.`;

  const meta: string[] = [];
  if (skill.categoria) meta.push(`Categoria: ${skill.categoria}`);
  if (skill.versao) meta.push(`Versão: ${skill.versao}`);
  if (skill.gatilho) meta.push(`Gatilho: ${skill.gatilho}`);
  const metaBlock = meta.length ? `\n\n---\n_${meta.join(" · ")}_\n` : "";

  return `---
name: ${slug}
description: ${escapeYaml(description)}
---

${body}${metaBlock}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadSkillZip(skill: ExportableSkill): Promise<void> {
  const slug = toClaudeSkillSlug(skill.nome);
  const zip = new JSZip();
  const folder = zip.folder(slug)!;
  folder.file("SKILL.md", buildSkillMarkdown(skill));
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `${slug}.zip`);
}

export async function downloadAllSkillsZip(skills: ExportableSkill[]): Promise<void> {
  const zip = new JSZip();
  const usedSlugs = new Set<string>();
  const index: string[] = [
    "# Império HQ — Skills para Claude Desktop",
    "",
    `Total: ${skills.length} skills.`,
    "",
    "## Como instalar",
    "",
    "1. Descompacte este arquivo.",
    "2. Cada subpasta é uma skill independente. Compacte a pasta desejada (ou use os `.zip` individuais exportados pelo painel).",
    "3. No Claude Desktop: **Settings → Capabilities → Skills → Upload skill** e selecione o `.zip` da skill.",
    "4. A skill ficará disponível automaticamente quando o Claude detectar uma tarefa que combine com a descrição.",
    "",
    "## Skills incluídas",
    "",
  ];

  for (const skill of skills) {
    let slug = toClaudeSkillSlug(skill.nome);
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      slug = `${toClaudeSkillSlug(skill.nome)}-${suffix++}`;
    }
    usedSlugs.add(slug);
    zip.folder(slug)!.file("SKILL.md", buildSkillMarkdown(skill));
    index.push(`- **${slug}** — ${skill.nome}`);
  }

  zip.file("README.md", index.join("\n"));
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, "imperio-skills.zip");
}
