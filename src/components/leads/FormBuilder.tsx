import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Eye, GripVertical, Code } from "lucide-react";

interface FormField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "select" | "textarea" | "number";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface CaptureForm {
  id: string;
  project_id: string | null;
  name: string;
  funnel_stage: string | null;
  fields: FormField[];
  active: boolean;
  created_at: string;
}

interface Props {
  projects: { id: string; name: string; icon?: string }[];
}

const DEFAULT_FIELDS: FormField[] = [
  { key: "nome", label: "Nome", type: "text", required: true, placeholder: "Seu nome completo" },
  { key: "email", label: "Email", type: "email", required: true, placeholder: "seu@email.com" },
  { key: "phone", label: "WhatsApp", type: "tel", required: false, placeholder: "(11) 99999-9999" },
];

export function FormBuilder({ projects }: Props) {
  const [forms, setForms] = useState<CaptureForm[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showSnippet, setShowSnippet] = useState<CaptureForm | null>(null);
  const [editForm, setEditForm] = useState<CaptureForm | null>(null);
  const [formName, setFormName] = useState("");
  const [formProject, setFormProject] = useState<string>("none");
  const [formStage, setFormStage] = useState("lead_capturado");
  const [formFields, setFormFields] = useState<FormField[]>([...DEFAULT_FIELDS]);

  const loadForms = async () => {
    const { data } = await supabase.from("imphq_capture_forms").select("*").order("created_at", { ascending: false });
    setForms((data || []) as any[]);
  };

  useEffect(() => { loadForms(); }, []);

  const addField = () => {
    setFormFields(prev => [...prev, { key: `campo_${Date.now()}`, label: "", type: "text", required: false }]);
  };

  const removeField = (idx: number) => {
    setFormFields(prev => prev.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, updates: Partial<FormField>) => {
    setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const saveForm = async () => {
    if (!formName.trim()) { toast.error("Nome obrigatório"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      name: formName,
      project_id: formProject !== "none" ? formProject : null,
      funnel_stage: formStage,
      fields: formFields as any,
      active: true,
      user_id: user.id,
    };

    if (editForm) {
      await supabase.from("imphq_capture_forms").update(payload).eq("id", editForm.id);
      toast.success("Formulário atualizado!");
    } else {
      await supabase.from("imphq_capture_forms").insert(payload);
      toast.success("Formulário criado!");
    }
    setShowNew(false);
    setEditForm(null);
    resetForm();
    loadForms();
  };

  const resetForm = () => {
    setFormName("");
    setFormProject("none");
    setFormStage("lead_capturado");
    setFormFields([...DEFAULT_FIELDS]);
  };

  const openEdit = (form: CaptureForm) => {
    setEditForm(form);
    setFormName(form.name);
    setFormProject(form.project_id || "none");
    setFormStage(form.funnel_stage || "lead_capturado");
    setFormFields(form.fields || [...DEFAULT_FIELDS]);
    setShowNew(true);
  };

  const deleteForm = async (id: string) => {
    await supabase.from("imphq_capture_forms").delete().eq("id", id);
    toast.success("Formulário removido");
    loadForms();
  };

  const getSnippetHTML = (form: CaptureForm) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const fields = (form.fields || []) as FormField[];
    const inputsHtml = fields.map(f => {
      if (f.type === "select" && f.options) {
        return `  <select name="${f.key}" ${f.required ? "required" : ""}>\n    <option value="">${f.placeholder || f.label}</option>\n${f.options.map(o => `    <option value="${o}">${o}</option>`).join("\n")}\n  </select>`;
      }
      if (f.type === "textarea") {
        return `  <textarea name="${f.key}" placeholder="${f.placeholder || f.label}" ${f.required ? "required" : ""}></textarea>`;
      }
      return `  <input type="${f.type}" name="${f.key}" placeholder="${f.placeholder || f.label}" ${f.required ? "required" : ""} />`;
    }).join("\n");

    return `<!-- Imperio HQ — Formulário: ${form.name} -->
<form id="imphq-form-${form.id.slice(0, 8)}" onsubmit="return imphqSubmit(event)">
${inputsHtml}
  <button type="submit">Enviar</button>
</form>

<script>
async function imphqSubmit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = { form_id: "${form.id}" };
  fd.forEach((v, k) => body[k] = v);
  // UTMs
  const sp = new URLSearchParams(location.search);
  ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(u => {
    if (sp.get(u)) body[u] = sp.get(u);
  });
  try {
    const res = await fetch("${supabaseUrl}/functions/v1/capture-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      e.target.reset();
      // Redirecionar ou mostrar mensagem:
      alert("Cadastro realizado!");
    }
  } catch (err) { console.error(err); }
}
</script>`;
  };

  const getProjectName = (pid: string | null) => {
    if (!pid) return "Sem projeto";
    const p = projects.find(pr => pr.id === pid);
    return p ? `${p.icon || "📁"} ${p.name}` : pid.slice(0, 8);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold">Formulários de Captura</h3>
          <p className="text-xs text-muted-foreground">Crie formulários dinâmicos e gere snippets para suas landing pages</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setEditForm(null); setShowNew(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo Formulário
        </Button>
      </div>

      {forms.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum formulário criado ainda. Crie o primeiro!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map(form => (
            <Card key={form.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{form.name}</p>
                    <p className="text-[10px] text-muted-foreground">{getProjectName(form.project_id)}</p>
                  </div>
                  <Badge variant={form.active ? "default" : "secondary"} className="text-[10px]">
                    {form.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {((form.fields || []) as FormField[]).map((f, i) => (
                    <Badge key={i} variant="outline" className="text-[9px]">{f.label || f.key}</Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openEdit(form)}>
                    <Eye className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSnippet(form)}>
                    <Code className="h-3 w-3 mr-1" /> Snippet
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive" onClick={() => deleteForm(form.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) { setShowNew(false); setEditForm(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editForm ? "Editar Formulário" : "Novo Formulário"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do Formulário</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Captura Webinar" className="bg-secondary" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Projeto</Label>
                <Select value={formProject} onValueChange={setFormProject}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem projeto</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Etapa do Funil</Label>
                <Select value={formStage} onValueChange={setFormStage}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead_capturado">Lead Capturado</SelectItem>
                    <SelectItem value="pre_lancamento">Pré-Lançamento</SelectItem>
                    <SelectItem value="webinar">Webinar / Aula</SelectItem>
                    <SelectItem value="aplicacao">Aplicação</SelectItem>
                    <SelectItem value="pesquisa">Pesquisa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Campos do Formulário</Label>
              {formFields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-secondary/50 rounded border border-border">
                  <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Input value={field.label} onChange={e => updateField(idx, { label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })} placeholder="Nome do campo" className="bg-background h-8 text-xs flex-1" />
                  <Select value={field.type} onValueChange={v => updateField(idx, { type: v as any })}>
                    <SelectTrigger className="w-24 h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="tel">Telefone</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="textarea">Textarea</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <input type="checkbox" checked={field.required} onChange={e => updateField(idx, { required: e.target.checked })} />
                    Obrig.
                  </label>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive shrink-0" onClick={() => removeField(idx)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={addField} className="text-xs">
                <Plus className="h-3 w-3 mr-1" /> Adicionar Campo
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveForm}>{editForm ? "Salvar" : "Criar Formulário"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Snippet Dialog */}
      <Dialog open={!!showSnippet} onOpenChange={() => setShowSnippet(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Snippet — {showSnippet?.name}</DialogTitle></DialogHeader>
          {showSnippet && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Cole este código na sua landing page para capturar leads diretamente no Imperio HQ:</p>
              <pre className="bg-secondary p-4 rounded text-[11px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap border border-border">
                {getSnippetHTML(showSnippet)}
              </pre>
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(getSnippetHTML(showSnippet)); toast.success("Snippet copiado!"); }}>
                <Copy className="h-3 w-3 mr-1" /> Copiar Snippet
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
