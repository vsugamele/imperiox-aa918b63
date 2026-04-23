import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Copy, Check, RefreshCw, Save, FileText, CheckCircle2, Clock, Edit3, Layers, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CONTENT_TYPES, STATUS_CONFIG, type GeneratedItem, type StatusKey } from "./constants";

interface Props {
  item: GeneratedItem;
  idx: number;
  copiedIdx: number | null;
  onCopy: (text: string, idx: number) => void;
  onRegen: (type: string) => void;
  onSaveDocs: (content: string, type: string) => void;
  onSaveCopyArsenal: (content: string) => void;
  onChangeStatus: (id: string, status: StatusKey) => void;
  onExpandCluster?: (item: GeneratedItem) => void;
  expandingClusterId?: string | null;
}

export function ResultCard({ item, idx, copiedIdx, onCopy, onRegen, onSaveDocs, onSaveCopyArsenal, onChangeStatus, onExpandCluster, expandingClusterId }: Props) {
  const typeInfo = CONTENT_TYPES.find(t => t.id === item.type);
  const Icon = typeInfo?.icon || FileText;
  const status = (item.status || "rascunho") as StatusKey;
  const statusCfg = STATUS_CONFIG[status];

  return (
    <Card className="border-border/30 bg-secondary/20">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className={`h-3.5 w-3.5 ${typeInfo?.color || ""}`} />
            <span className="text-xs font-medium">{typeInfo?.label}</span>
            <Badge variant="outline" className={`text-[9px] ${statusCfg.color}`}>
              {statusCfg.label}
            </Badge>
            {item.funnel_stage && (
              <Badge variant="outline" className="text-[9px]">
                {item.funnel_stage}
              </Badge>
            )}
            {item.variation_group && (
              <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary">
                A/B
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {new Date(item.timestamp).toLocaleTimeString("pt-BR")}
            </span>
          </div>
          <div className="flex gap-1">
            {item.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-6 w-6" title="Status">
                    {status === "aprovado" ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : status === "revisao" ? <Clock className="h-3 w-3 text-yellow-400" /> : <Edit3 className="h-3 w-3" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-xs">Pipeline</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onChangeStatus(item.id!, "rascunho")} className="text-xs">📝 Rascunho</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeStatus(item.id!, "revisao")} className="text-xs">⏳ Em Revisão</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangeStatus(item.id!, "aprovado")} className="text-xs">✅ Aprovado</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6" title="Salvar em…">
                  <Save className="h-3 w-3 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs">Salvar conteúdo em…</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSaveDocs(item.content, item.type)} className="text-xs">📄 Docs do Projeto</DropdownMenuItem>
                {(item.type === "ad_copy" || item.type === "sales_page_blocks") && (
                  <DropdownMenuItem onClick={() => onSaveCopyArsenal(item.content)} className="text-xs">🗡️ Copy Arsenal (1º produto)</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onCopy(item.content, idx)}>
              {copiedIdx === idx ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onRegen(item.type)}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed">
          <ReactMarkdown>{item.content}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
