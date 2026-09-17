import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import { BookOpen, Copy, Download, FileText, Package, Check } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// Importa todos os .md da pasta claude-skills/ embutidos no bundle
const rawFiles = import.meta.glob("/claude-skills/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

type Doc = {
  filename: string;
  title: string;
  content: string;
};

const PRETTY: Record<string, string> = {
  "00-persona-imperius.md": "00 · Persona Imperius",
  "01-vsl-7-blocos.md": "01 · VSL — 7 Blocos",
  "02-copy-frameworks.md": "02 · Copy Frameworks",
  "03-avatar-4-camadas.md": "03 · Avatar — 4 Camadas",
  "04-skills-arsenal.md": "04 · Skills Arsenal",
  "05-roteiros-virais-reels.md": "05 · Roteiros Virais Reels",
  "06-prompt-base-copy.md": "06 · Prompt Base (Copy)",
  "README.md": "README — Instalação",
};

const docs: Doc[] = Object.entries(rawFiles)
  .map(([path, content]) => {
    const filename = path.split("/").pop()!;
    return { filename, title: PRETTY[filename] || filename, content };
  })
  .sort((a, b) => a.filename.localeCompare(b.filename));

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

export default function ClaudeSkillsGuide() {
  const [selected, setSelected] = useState(docs[0]?.filename ?? "");
  const [copied, setCopied] = useState<string | null>(null);

  const current = useMemo(
    () => docs.find((d) => d.filename === selected) ?? docs[0],
    [selected]
  );

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success("Copiado para a área de transferência");
    setTimeout(() => setCopied(null), 1500);
  };

  const downloadOne = (doc: Doc) => {
    triggerDownload(new Blob([doc.content], { type: "text/markdown" }), doc.filename);
  };

  const downloadAll = async () => {
    const zip = new JSZip();
    docs.forEach((d) => zip.file(d.filename, d.content));
    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, "claude-skills-imperius.zip");
    toast.success("ZIP gerado");
  };

  const promptBase = docs.find((d) => d.filename === "06-prompt-base-copy.md");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={BookOpen}
        title="Guia Claude — Inteligência de Copy"
        subtitle="8 documentos prontos para virar Knowledge + System Prompt no Claude Projects."
        primaryAction={
          <div className="flex gap-2">
            {promptBase && (
              <Button
                variant="outline"
                onClick={() => copy(promptBase.content, "prompt-base")}
              >
                {copied === "prompt-base" ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                Copiar Prompt Base
              </Button>
            )}
            <Button onClick={downloadAll}>
              <Package className="h-4 w-4 mr-2" />
              Baixar tudo (.zip)
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Lista lateral */}
        <Card className="p-2 bg-secondary/40 h-fit md:sticky md:top-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground/70 px-2 py-1.5">
            Arquivos
          </div>
          <nav className="flex flex-col">
            {docs.map((d) => {
              const active = d.filename === selected;
              return (
                <button
                  key={d.filename}
                  onClick={() => setSelected(d.filename)}
                  className={`flex items-center gap-2 text-left text-sm px-2 py-2 rounded-md transition-colors ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-muted/50 text-foreground/80"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{d.title}</span>
                </button>
              );
            })}
          </nav>
        </Card>

        {/* Viewer */}
        <Card className="bg-secondary/40 flex flex-col min-h-[60vh]">
          {current && (
            <>
              <div className="flex items-center justify-between border-b border-border/50 px-5 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-primary truncate">
                    {current.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    claude-skills/{current.filename}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(current.content, current.filename)}
                  >
                    {copied === current.filename ? (
                      <Check className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadOne(current)}>
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Baixar .md
                  </Button>
                </div>
              </div>

              <div className="overflow-auto p-6 leading-7">
                <article className="prose prose-invert prose-sm max-w-none prose-headings:font-display prose-headings:text-primary prose-a:text-primary prose-code:text-primary prose-strong:text-foreground prose-pre:bg-background/80 prose-pre:border prose-pre:border-border/50">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {current.content}
                  </ReactMarkdown>
                </article>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
