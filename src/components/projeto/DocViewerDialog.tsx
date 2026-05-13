import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  kind: "file" | "text";
  url?: string;
  mime?: string;
  content?: string;
}

export function DocViewerDialog({ open, onOpenChange, title, kind, url, mime, content }: Props) {
  const isPdf = mime?.includes("pdf");
  const isImage = mime?.startsWith("image/");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col bg-secondary/40">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto rounded-md bg-background">
          {kind === "file" && url && isPdf && (
            <iframe src={url} className="w-full h-full" title={title} />
          )}
          {kind === "file" && url && isImage && (
            <div className="flex items-center justify-center h-full p-4">
              <img src={url} alt={title} className="max-w-full max-h-full object-contain" />
            </div>
          )}
          {kind === "file" && url && !isPdf && !isImage && (
            <div className="p-6 text-sm">
              Pré-visualização indisponível para este formato.{" "}
              <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
                Abrir em nova aba
              </a>
            </div>
          )}
          {kind === "text" && (
            <pre className="p-6 text-sm whitespace-pre-wrap font-mono leading-7">{content || ""}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
