import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  products: any[];
  currentProductNome?: string;
  assetLabel: string;
  roleHint?: string; // e.g. "order bump", "upsell"
  onPick: (produtoNome: string | null) => void;
}

export function LinkProductDialog({ open, onClose, products, currentProductNome, assetLabel, roleHint, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-secondary/40 border-border/60 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-400" />
            Vincular produto
          </DialogTitle>
          <DialogDescription className="leading-7">
            Qual produto este <span className="text-primary font-semibold">{assetLabel}</span>
            {roleHint ? <> vai oferecer como <span className="text-amber-300">{roleHint}</span></> : null}?
            A IA vai usar esse produto ao gerar copy, preço e link.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto">
          {products.map((p, i) => {
            const nome = p?.nome || p?.name || `Produto ${i + 1}`;
            const preco = p?.preco_por || p?.preco || p?.price;
            const isAtual = nome === currentProductNome;
            return (
              <button
                key={i}
                onClick={() => { onPick(nome); onClose(); }}
                className="text-left rounded-lg border border-border/40 bg-[#0a0608]/60 hover:bg-emerald-500/10 hover:border-emerald-500/40 px-3 py-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground/90 truncate">
                    {nome}
                    {isAtual && <span className="ml-2 text-[10px] text-emerald-400 uppercase tracking-wider">atual</span>}
                  </p>
                  {preco && <span className="text-xs text-emerald-400 font-semibold shrink-0">R$ {preco}</span>}
                </div>
                {p?.descricao && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{p.descricao}</p>}
              </button>
            );
          })}
          {products.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhum produto no briefing deste projeto. Adicione produtos no Briefing primeiro.
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2 border-t border-border/40">
          <Button variant="ghost" className="flex-1 h-9 text-xs" onClick={() => { onPick(null); onClose(); }}>
            Pular (sem vínculo)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
