import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Eye, GripVertical, Code, FileText, ClipboardList, Megaphone, ShoppingBag, Magnet, Save, CopyPlus } from "lucide-react";

interface FormField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "select" | "textarea" | "number" | "radio" | "checkbox";
  required: boolean;
  options?: string[];
  placeholder?: string;
}

interface CaptureForm {
  id: string;
  project_id: string | null;
  nome: string;
  step: string | null;
  fields: FormField[];
  is_active: boolean | null;
  created_at: string | null;
  settings?: any;
}

interface Props {
  projects: { id: string; name: string; icon?: string }[];
}

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  stage: string;
  fields: FormField[];
}

const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "simple",
    name: "Captura Simples",
    description: "Nome + Email + WhatsApp",
    icon: FileText,
    stage: "lead_capturado",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, placeholder: "Seu nome completo" },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "seu@email.com" },
      { key: "phone", label: "WhatsApp", type: "tel", required: false, placeholder: "(11) 99999-9999" },
    ],
  },
  {
    id: "pre_webinar",
    name: "Pesquisa Pré-Webinar",
    description: "Faturamento, maior dor, nível de consciência",
    icon: ClipboardList,
    stage: "webinar",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, placeholder: "Seu nome" },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "seu@email.com" },
      { key: "faturamento", label: "Faturamento Mensal", type: "select", required: true, options: ["Até R$5k", "R$5k a R$20k", "R$20k a R$50k", "R$50k a R$100k", "Acima de R$100k"] },
      { key: "maior_dor", label: "Qual sua maior dor hoje?", type: "textarea", required: true, placeholder: "Descreva seu maior desafio..." },
      { key: "nivel_consciencia", label: "Nível de Consciência", type: "select", required: false, options: ["Iniciante", "Já tentei mas não deu certo", "Tenho resultados mas quero escalar", "Já faturo alto e quero otimizar"] },
    ],
  },
  {
    id: "aplicacao",
    name: "Aplicação / Mentoria",
    description: "Instagram, faturamento, nicho, objetivo",
    icon: Megaphone,
    stage: "aplicacao",
    fields: [
      { key: "nome", label: "Nome Completo", type: "text", required: true, placeholder: "Seu nome" },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "seu@email.com" },
      { key: "phone", label: "WhatsApp", type: "tel", required: true, placeholder: "(11) 99999-9999" },
      { key: "instagram", label: "Instagram", type: "text", required: false, placeholder: "@seuperfil" },
      { key: "faturamento", label: "Faturamento Atual", type: "select", required: true, options: ["Ainda não faturo", "Até R$5k/mês", "R$5k a R$20k/mês", "R$20k a R$50k/mês", "Acima de R$50k/mês"] },
      { key: "nicho", label: "Qual seu nicho?", type: "text", required: true, placeholder: "Ex: Marketing, Saúde, Finanças..." },
      { key: "objetivo", label: "Qual seu principal objetivo?", type: "textarea", required: true, placeholder: "O que você espera alcançar..." },
    ],
  },
  {
    id: "pos_compra",
    name: "Pesquisa Pós-Compra",
    description: "Como conheceu, nota, depoimento",
    icon: ShoppingBag,
    stage: "pesquisa",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, placeholder: "Seu nome" },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "seu@email.com" },
      { key: "como_conheceu", label: "Como nos conheceu?", type: "select", required: true, options: ["Instagram", "YouTube", "Google", "Indicação de amigo", "Facebook Ads", "Outro"] },
      { key: "nota", label: "De 1 a 10, qual nota você dá?", type: "select", required: true, options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
      { key: "depoimento", label: "Deixe seu depoimento", type: "textarea", required: false, placeholder: "Conte como foi sua experiência..." },
    ],
  },
  {
    id: "lead_magnet",
    name: "Lead Magnet",
    description: "Nome + Email + Profissão",
    icon: Magnet,
    stage: "lead_capturado",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, placeholder: "Seu nome" },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "seu@email.com" },
      { key: "profissao", label: "Profissão", type: "text", required: false, placeholder: "Ex: Designer, Consultor..." },
    ],
  },
];

export function FormBuilder({ projects }: Props) {
  const [forms, setForms] = useState<CaptureForm[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showSnippet, setShowSnippet] = useState<CaptureForm | null>(null);
  const [editForm, setEditForm] = useState<CaptureForm | null>(null);
  const [formName, setFormName] = useState("");
  const [formProject, setFormProject] = useState<string>("none");
  const [formStage, setFormStage] = useState("lead_capturado");
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [formProduct, setFormProduct] = useState("");
  const [formTag, setFormTag] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [projectProducts, setProjectProducts] = useState<string[]>([]);
  const [listFilterProject, setListFilterProject] = useState("all");

  const loadForms = async () => {
    const { data } = await supabase.from("imphq_capture_forms").select("*").order("created_at", { ascending: false });
    setForms((data || []) as any[]);
  };

  useEffect(() => { loadForms(); }, []);

  const filteredForms = listFilterProject === "all" ? forms : forms.filter(f => f.project_id === listFilterProject);

  // Load products when project changes
  useEffect(() => {
    if (formProject === "none") { setProjectProducts([]); setFormProduct(""); return; }
    (async () => {
      const { data } = await supabase.from("imphq_projects").select("data").eq("id", formProject).single();
      const produtos = (data?.data as any)?.produtos;
      if (Array.isArray(produtos)) {
        setProjectProducts(produtos.map((p: any) => typeof p === "string" ? p : p.nome || p.name || ""));
      } else {
        setProjectProducts([]);
      }
    })();
  }, [formProject]);

  const addField = () => {
    setFormFields(prev => [...prev, { key: `campo_${Date.now()}`, label: "", type: "text", required: false }]);
  };

  const removeField = (idx: number) => {
    setFormFields(prev => prev.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, updates: Partial<FormField>) => {
    setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const selectTemplate = (tpl: FormTemplate) => {
    setFormName(tpl.name);
    setFormStage(tpl.stage);
    setFormFields([...tpl.fields]);
    setShowTemplates(false);
    setShowNew(true);
  };

  const startFromScratch = () => {
    setFormName("");
    setFormProject("none");
    setFormStage("lead_capturado");
    setFormFields([
      { key: "nome", label: "Nome", type: "text", required: true, placeholder: "Seu nome completo" },
      { key: "email", label: "Email", type: "email", required: true, placeholder: "seu@email.com" },
    ]);
    setFormProduct("");
    setFormTag("");
    setFormDescription("");
    setShowTemplates(false);
    setShowNew(true);
  };

  const saveForm = async () => {
    if (!formName.trim()) { toast.error("Nome obrigatório"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const settings: Record<string, any> = {};
    if (formProduct) settings.product_name = formProduct;
    if (formTag.trim()) settings.tag = formTag.trim();
    if (formDescription.trim()) settings.description = formDescription.trim();

    const payload = {
      nome: formName,
      project_id: formProject !== "none" ? formProject : null,
      step: formStage,
      fields: formFields as any,
      is_active: true,
      user_id: user.id,
      settings,
    };

    if (editForm) {
      await supabase.from("imphq_capture_forms").update(payload).eq("id", editForm.id);
      toast.success("Formulário atualizado!");
    } else {
      await supabase.from("imphq_capture_forms").insert(payload as any);
      toast.success("Formulário criado!");
    }
    setShowNew(false);
    setEditForm(null);
    loadForms();
  };

  const openEdit = (form: CaptureForm) => {
    setEditForm(form);
    setFormName(form.nome);
    setFormProject(form.project_id || "none");
    setFormStage(form.step || "lead_capturado");
    setFormFields((form.fields as any as FormField[]) || []);
    setFormProduct((form.settings as any)?.product_name || "");
    setFormTag((form.settings as any)?.tag || "");
    setFormDescription((form.settings as any)?.description || "");
    setShowNew(true);
  };

  const deleteForm = async (id: string) => {
    await supabase.from("imphq_capture_forms").delete().eq("id", id);
    toast.success("Formulário removido");
    loadForms();
  };

  const duplicateForm = async (form: CaptureForm) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("imphq_capture_forms").insert({
      nome: `${form.nome} (cópia)`,
      project_id: form.project_id,
      step: form.step,
      fields: form.fields as any,
      is_active: true,
      user_id: user.id,
      settings: form.settings || {},
    } as any);
    if (error) { toast.error("Erro ao duplicar"); return; }
    toast.success("Formulário duplicado!");
    loadForms();
  };

  const saveAsTemplate = async (form: CaptureForm) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const settings = { ...(form.settings || {}), is_template: true, product_name: (form.settings as any)?.product_name };
    const { error } = await supabase.from("imphq_capture_forms").insert({
      nome: `[Template] ${form.nome}`,
      project_id: null,
      step: form.step,
      fields: form.fields as any,
      is_active: false,
      user_id: user.id,
      settings,
    } as any);
    if (error) { toast.error("Erro ao salvar template"); return; }
    toast.success("Template salvo!");
    loadForms();
  };

  const getSnippetHTML = (form: CaptureForm) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const fields = (form.fields || []) as FormField[];
    const inputsHtml = fields.map(f => {
      const req = f.required ? "required" : "";
      if (f.type === "radio" && f.options) {
        return `  <div class="imphq-field">
    <label class="imphq-label">${f.label}${f.required ? ' <span class="imphq-req">*</span>' : ""}</label>
    <div class="imphq-radio-group">
${f.options.map(o => `      <label class="imphq-radio-option"><input type="radio" name="${f.key}" value="${o}" ${req} /><span>${o}</span></label>`).join("\n")}
    </div>
  </div>`;
      }
      if (f.type === "checkbox" && f.options) {
        return `  <div class="imphq-field">
    <label class="imphq-label">${f.label}${f.required ? ' <span class="imphq-req">*</span>' : ""}</label>
    <div class="imphq-checkbox-group">
${f.options.map(o => `      <label class="imphq-checkbox-option"><input type="checkbox" name="${f.key}" value="${o}" /><span>${o}</span></label>`).join("\n")}
    </div>
  </div>`;
      }
      if (f.type === "select" && f.options) {
        return `  <div class="imphq-field">
    <label class="imphq-label">${f.label}${f.required ? ' <span class="imphq-req">*</span>' : ""}</label>
    <select name="${f.key}" class="imphq-input" ${req}>
      <option value="">${f.placeholder || "Selecione..."}</option>
${f.options.map(o => `      <option value="${o}">${o}</option>`).join("\n")}
    </select>
  </div>`;
      }
      if (f.type === "textarea") {
        return `  <div class="imphq-field">
    <label class="imphq-label">${f.label}${f.required ? ' <span class="imphq-req">*</span>' : ""}</label>
    <textarea name="${f.key}" class="imphq-input imphq-textarea" placeholder="${f.placeholder || f.label}" ${req}></textarea>
  </div>`;
      }
      return `  <div class="imphq-field">
    <label class="imphq-label">${f.label}${f.required ? ' <span class="imphq-req">*</span>' : ""}</label>
    <input type="${f.type}" name="${f.key}" class="imphq-input" placeholder="${f.placeholder || f.label}" ${req} />
  </div>`;
    }).join("\n");

    const css = `<style>
.imphq-form{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:28px;background:#1a1a2e;border-radius:16px;border:1px solid rgba(255,255,255,0.08);color:#e2e8f0}
.imphq-field{margin-bottom:16px}
.imphq-label{display:block;font-size:13px;font-weight:600;color:#cbd5e1;margin-bottom:6px}
.imphq-req{color:#f87171}
.imphq-input{width:100%;padding:10px 14px;background:#0f0f23;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e2e8f0;font-size:14px;outline:none;transition:border .2s;box-sizing:border-box}
.imphq-input:focus{border-color:#8b5cf6;box-shadow:0 0 0 3px rgba(139,92,246,0.15)}
.imphq-textarea{min-height:80px;resize:vertical}
.imphq-radio-group,.imphq-checkbox-group{display:flex;flex-wrap:wrap;gap:8px}
.imphq-radio-option,.imphq-checkbox-option{display:flex;align-items:center;gap:8px;padding:8px 14px;background:#0f0f23;border:1px solid rgba(255,255,255,0.1);border-radius:8px;cursor:pointer;font-size:13px;transition:all .2s;color:#cbd5e1}
.imphq-radio-option:hover,.imphq-checkbox-option:hover{border-color:#8b5cf6;background:#16163a}
.imphq-radio-option input,.imphq-checkbox-option input{accent-color:#8b5cf6}
.imphq-btn{width:100%;padding:12px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:transform .15s,box-shadow .15s;margin-top:8px}
.imphq-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(139,92,246,0.35)}
.imphq-btn:disabled{opacity:.6;cursor:not-allowed;transform:none}
.imphq-success{text-align:center;padding:24px;color:#34d399;font-weight:600;font-size:16px}
</style>`;

    return `<!-- Imperio HQ — Formulário: ${form.nome} -->
${css}
<form id="imphq-form-${form.id.slice(0, 8)}" class="imphq-form" onsubmit="return imphqSubmit(event)">
${inputsHtml}
  <button type="submit" class="imphq-btn">Enviar</button>
</form>

<script>
async function imphqSubmit(e) {
  e.preventDefault();
  var btn = e.target.querySelector('.imphq-btn');
  btn.disabled = true; btn.textContent = 'Enviando...';
  var fd = new FormData(e.target);
  var body = { form_id: "${form.id}" };
  fd.forEach(function(v, k) {
    if (body[k]) { body[k] = Array.isArray(body[k]) ? body[k].concat(v) : [body[k], v]; }
    else { body[k] = v; }
  });
  body.page_url = location.href;
    var sp = new URLSearchParams(location.search);
    ["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(u) {
      if (sp.get(u)) body[u] = sp.get(u);
    });
  try {
    var res = await fetch("${supabaseUrl}/functions/v1/capture-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var data = await res.json();
    if (data.success) {
      e.target.innerHTML = '<div class="imphq-success">✅ Cadastro realizado com sucesso!</div>';
    } else { btn.disabled = false; btn.textContent = 'Enviar'; alert(data.error || 'Erro'); }
  } catch (err) { btn.disabled = false; btn.textContent = 'Enviar'; console.error(err); }
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display text-lg font-bold">Formulários de Captura</h3>
          <p className="text-xs text-muted-foreground">Crie formulários dinâmicos e gere snippets para suas landing pages</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={listFilterProject} onValueChange={setListFilterProject}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Projetos</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.icon || "📁"} {p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditForm(null); setShowTemplates(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Formulário
          </Button>
        </div>
      </div>

      {forms.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum formulário criado ainda. Crie o primeiro!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredForms.map(form => (
            <Card key={form.id} className="bg-card border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{form.nome}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px] py-0 bg-primary/10 text-primary border-primary/20">
                        {getProjectName(form.project_id)}
                      </Badge>
                      {(form.settings as any)?.product_name && (
                        <Badge variant="outline" className="text-[10px] py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          📦 {(form.settings as any).product_name}
                        </Badge>
                      )}
                      {(form.settings as any)?.tag && (
                        <Badge variant="outline" className="text-[10px] py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          🏷️ {(form.settings as any).tag}
                        </Badge>
                      )}
                    </div>
                    {(form.settings as any)?.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{(form.settings as any).description}</p>
                    )}
                  </div>
                  <Badge variant={form.is_active ? "default" : "secondary"} className="text-[10px]">
                    {form.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {((form.fields || []) as FormField[]).map((f, i) => (
                    <Badge key={i} variant="outline" className="text-[9px]">{f.label || f.key}</Badge>
                  ))}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openEdit(form)}>
                    <Eye className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowSnippet(form)}>
                    <Code className="h-3 w-3 mr-1" /> Snippet
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => duplicateForm(form)}>
                    <CopyPlus className="h-3 w-3 mr-1" /> Duplicar
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => saveAsTemplate(form)} title="Salvar como template reutilizável">
                    <Save className="h-3 w-3 mr-1" /> Template
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

      {/* Template Selection Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Escolha um Template</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {FORM_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => selectTemplate(tpl)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <tpl.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">{tpl.description}</p>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">{tpl.fields.length} campos</Badge>
              </button>
            ))}
            {/* Saved templates from DB */}
            {forms.filter(f => (f.settings as any)?.is_template).map(tpl => (
              <button
                key={tpl.id}
                onClick={() => {
                  setFormName(tpl.nome.replace(/^\[Template\]\s*/, ""));
                  setFormStage(tpl.step || "lead_capturado");
                  setFormFields([...((tpl.fields as any as FormField[]) || [])]);
                  setFormProduct((tpl.settings as any)?.product_name || "");
                  setShowTemplates(false);
                  setShowNew(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-primary/20 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="p-2 rounded-lg bg-primary/20">
                  <Save className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{tpl.nome}</p>
                  <p className="text-xs text-muted-foreground">Template salvo • {((tpl.fields as any as FormField[]) || []).length} campos</p>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0 bg-primary/10 text-primary border-primary/20">Meu Template</Badge>
              </button>
            ))}
            <button
              onClick={startFromScratch}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-border hover:bg-accent/50 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-muted">
                <Plus className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Começar do Zero</p>
                <p className="text-xs text-muted-foreground">Crie um formulário personalizado</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) { setShowNew(false); setEditForm(null); } }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editForm ? "Editar Formulário" : "Novo Formulário"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome do Formulário</Label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Captura Webinar" className="bg-secondary" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tag (opcional)</Label>
                <Input value={formTag} onChange={e => setFormTag(e.target.value)} placeholder="Ex: webinar-abril, lancamento" className="bg-secondary" />
              </div>
              <div>
                <Label>Descrição curta (opcional)</Label>
                <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Sobre o que é este formulário" className="bg-secondary" />
              </div>
            </div>
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

            {/* Product selector */}
            {formProject !== "none" && (
              <div>
                <Label>Produto (opcional)</Label>
                {projectProducts.length > 0 ? (
                  <Select value={formProduct || "none"} onValueChange={v => setFormProduct(v === "none" ? "" : v)}>
                    <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem produto específico</SelectItem>
                      {projectProducts.map(p => <SelectItem key={p} value={p}>📦 {p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={formProduct} onChange={e => setFormProduct(e.target.value)} placeholder="Nome do produto (manual)" className="bg-secondary" />
                )}
              </div>
            )}

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
                      <SelectItem value="radio">Radio (Sim/Não)</SelectItem>
                      <SelectItem value="checkbox">Checkbox (Múltipla)</SelectItem>
                    </SelectContent>
                  </Select>
                  {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                    <Input
                      value={(field.options || []).join(", ")}
                      onChange={e => updateField(idx, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                      placeholder="Opções (separe por vírgula)"
                      title="Digite as opções separadas por vírgula. Ex: Sim, Não, Talvez"
                      className="bg-background h-8 text-[10px] flex-1 min-w-[160px]"
                    />
                  )}
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
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader><DialogTitle>Snippet — {showSnippet?.nome}</DialogTitle></DialogHeader>
          {showSnippet && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Código HTML</p>
                <pre className="bg-secondary p-3 rounded text-[10px] font-mono overflow-auto max-h-[400px] whitespace-pre-wrap border border-border">
                  {getSnippetHTML(showSnippet)}
                </pre>
                <Button size="sm" onClick={() => { navigator.clipboard.writeText(getSnippetHTML(showSnippet)); toast.success("Snippet copiado!"); }}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar Snippet
                </Button>
              </div>
              {/* Live Preview */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Preview ao vivo</p>
                <div className="rounded-lg border border-border overflow-hidden bg-[#1a1a2e]">
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:16px;background:#1a1a2e">${getSnippetHTML(showSnippet).replace(/<script[\s\S]*?<\/script>/g, "")}</body></html>`}
                    className="w-full border-0"
                    style={{ minHeight: 350 }}
                    sandbox="allow-scripts"
                    title="Form Preview"
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
