import type { Json } from "@/integrations/supabase/types";
import { parseAvatarHTML, getImportSummary, type ParsedAvatar } from "@/components/projeto/avatar/avatar-html-parser";
import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: Json) => void;
  projectId?: string;
}

async function saveAsDoc(projectId: string, title: string, content: string) {
  try {
    await supabase.from("imphq_docs").insert({
      id: crypto.randomUUID(),
      project_id: projectId,
      title,
      content,
    });
  } catch (e) {
    // Silent fail — doc saving is optional
  }
}

export function AvatarImporter({ open, onClose, onImport, projectId }: Props) {
  const [html, setHtml] = useState("");
  const [preview, setPreview] = useState<ParsedAvatar | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const doParse = useCallback((content: string) => {
    const parsed = parseAvatarHTML(content);
    setPreview(parsed);
    const keys = Object.keys(parsed);
    if (keys.length > 0) {
      toast.success(`${keys.length} seções encontradas`);
    } else {
      toast.error("Nenhum dado reconhecido no HTML");
    }
  }, []);

  const handleParse = () => {
    if (!html.trim()) {
      toast.error("Cole o HTML primeiro");
      return;
    }
    doParse(html);
  };

  const handleFileRead = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setHtml(content);
      setFileName(file.name);
      doParse(content);
      toast.success(`Arquivo "${file.name}" carregado`);
    };
    reader.readAsText(file);
  }, [doParse]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileRead(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".html") || file.name.endsWith(".htm"))) {
      handleFileRead(file);
    } else {
      toast.error("Envie um arquivo .html");
    }
  }, [handleFileRead]);

  const handleImport = async () => {
    if (!preview) return;
    const dataWithHtml = { ...preview, html_original: html };
    onImport(dataWithHtml);

    // Save as doc if projectId available
    if (projectId && html) {
      const docTitle = fileName ? `Avatar HTML — ${fileName}` : "Avatar HTML Importado";
      await saveAsDoc(projectId, docTitle, html);
    }

    toast.success("Dados importados com sucesso!");
    setHtml("");
    setPreview(null);
    setFileName("");
    onClose();
  };

  const summary = preview ? getImportSummary(preview) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar HTML de Avatar</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Arraste um arquivo .html ou cole o código manualmente abaixo.
          </p>

          {/* Dropzone */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleFileInput}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              dragging
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 hover:bg-secondary/50"
            }`}
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              📁 Arraste um arquivo .html aqui ou <span className="text-primary underline">clique para selecionar</span>
            </span>
          </div>

          <Textarea
            value={html}
            onChange={e => setHtml(e.target.value)}
            className="bg-secondary min-h-[150px] font-mono text-xs"
            placeholder="Ou cole o HTML completo aqui..."
          />
          {preview && summary.length > 0 && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-2">
              <p className="text-xs font-semibold text-primary">📊 Dados encontrados:</p>
              <div className="grid grid-cols-2 gap-1.5">
                {summary.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{item.emoji}</span>
                    <span>{item.label}</span>
                    <span className="ml-auto font-mono text-primary">{item.count}</span>
                  </div>
                ))}
              </div>
              <details className="mt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver JSON completo</summary>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-[200px] mt-2 p-2 bg-background rounded">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </details>
            </div>
          )}
          {preview && summary.length === 0 && (
            <div className="p-3 rounded bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              Nenhum dado reconhecido no HTML. Verifique se o formato está correto.
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleParse}>🔍 Analisar HTML</Button>
          <Button onClick={handleImport} disabled={!preview || summary.length === 0}>
            <Upload className="h-3 w-3 mr-1" /> Importar Dados
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
