import type { GapSeverity, ItemStatus } from "@shared/project-map";

export const STATUS_CLASS: Record<ItemStatus, string> = {
  falta: "bg-destructive/10 text-destructive border-destructive/30",
  desenhado: "bg-warning/10 text-warning border-warning/30",
  construido: "bg-primary/10 text-primary border-primary/30",
  rodando: "bg-success/10 text-success border-success/30",
  pausado: "bg-muted text-muted-foreground border-border",
};

export const STATUS_DOT: Record<ItemStatus, string> = {
  falta: "bg-destructive",
  desenhado: "bg-warning",
  construido: "bg-primary",
  rodando: "bg-success",
  pausado: "bg-muted-foreground",
};

export const SEVERITY_LABEL: Record<GapSeverity, string> = {
  critica: "Crítica",
  importante: "Importante",
  sugestao: "Sugestão",
};

export const SEVERITY_CLASS: Record<GapSeverity, string> = {
  critica: "text-destructive border-destructive/30 bg-destructive/10",
  importante: "text-warning border-warning/30 bg-warning/10",
  sugestao: "text-muted-foreground border-border bg-muted/40",
};

export const FORMAT_LABEL = {
  padrao_novo: "Cadastro no padrão novo",
  legado: "Cadastro legado",
  produto_unico: "Cadastro de produto único",
  vazio: "Cadastro vazio",
} as const;
