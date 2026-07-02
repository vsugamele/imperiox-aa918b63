import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Download, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
  prompt?: string;
  label?: string;
  createdAt?: string;
}

export function ImageLightbox({ open, onClose, url, prompt, label, createdAt }: Props) {
  const copy = () => { navigator.clipboard.writeText(url); toast.success("URL copiada"); };
  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = (label || "imagem").replace(/\s+/g, "-") + ".png";
    a.target = "_blank";
    a.click();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl bg-[#0a0608] border-border/60 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40">
          <div className="text-xs">
            <div className="font-semibold text-pink-200">{label || "Imagem gerada"}</div>
            {createdAt && <div className="text-[10px] text-muted-foreground">{new Date(createdAt).toLocaleString("pt-BR")}</div>}
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copy}><Copy className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={download}><Download className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="bg-black flex items-center justify-center max-h-[70vh] overflow-auto">
          <img src={url} alt={label || ""} className="max-h-[70vh] object-contain" />
        </div>
        {prompt && (
          <div className="px-4 py-3 border-t border-border/40 max-h-40 overflow-auto">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Prompt</p>
            <p className="text-xs leading-6 text-foreground/90 whitespace-pre-wrap">{prompt}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
