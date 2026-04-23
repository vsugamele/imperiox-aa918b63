import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RecoveryTemplateDraft } from "@/lib/recoveryBuckets";

interface TemplateEditorProps {
  projectName?: string;
  templates: RecoveryTemplateDraft[];
  savingKey?: string | null;
  onChange: (template: RecoveryTemplateDraft, patch: Partial<RecoveryTemplateDraft>) => void;
  onSave: (template: RecoveryTemplateDraft) => void;
}

export function TemplateEditor({ projectName, templates, savingKey, onChange, onSave }: TemplateEditorProps) {
  if (!projectName) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        Selecione um projeto para editar os templates de recuperação.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Templates de recuperação</h2>
        <p className="text-sm text-muted-foreground">Projeto ativo: {projectName}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {templates.map((template) => (
          <Card key={template.key} className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-sm capitalize">{template.tipo.replace("_", " ")}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{template.canal}</Badge>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={template.key} className="text-xs text-muted-foreground">Ativo</Label>
                    <Switch
                      id={template.key}
                      checked={template.ativo}
                      onCheckedChange={(checked) => onChange(template, { ativo: checked })}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {template.canal === "email" && (
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input value={template.assunto} onChange={(e) => onChange(template, { assunto: e.target.value })} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Mensagem</Label>
                <Textarea
                  value={template.corpo}
                  onChange={(e) => onChange(template, { corpo: e.target.value })}
                  className="min-h-[160px]"
                />
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span>Variáveis:</span>
                <Badge variant="secondary">{"{nome}"}</Badge>
                <Badge variant="secondary">{"{produto}"}</Badge>
                <Badge variant="secondary">{"{valor}"}</Badge>
                <Badge variant="secondary">{"{link_pagamento}"}</Badge>
              </div>

              <Button onClick={() => onSave(template)} disabled={savingKey === template.key}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {savingKey === template.key ? "Salvando..." : "Salvar template"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
