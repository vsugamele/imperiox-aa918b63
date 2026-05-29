import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Eye, EyeOff, HelpCircle } from "lucide-react";
import MetaCloudGuide from "./MetaCloudGuide";
import EvolutionGuide from "./EvolutionGuide";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: any[];
  existingProviders?: any[];
  editingProvider?: any;
  onCreated: () => void;
}

type Provider = "evolution" | "twilio" | "meta_cloud";

export default function ProviderConfigDialog({ open, onOpenChange, projects, existingProviders = [], editingProvider, onCreated }: Props) {
  const [form, setForm] = useState({
    project_id: "",
    provider: "evolution" as Provider,
    instance_name: "",
    display_name: "",
    api_url: "",
    api_key: "",
    twilio_from: "",
    phone_number_id: "",
    waba_id: "",
    access_token: "",
    webhook_verify_token: "",
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [guide, setGuide] = useState<"none" | "meta" | "evolution">("none");

  useEffect(() => {
    if (open && editingProvider) {
      setForm({
        project_id: editingProvider.project_id || "",
        provider: (editingProvider.provider || "evolution") as Provider,
        instance_name: editingProvider.instance_name || "",
        display_name: editingProvider.display_name || "",
        api_url: editingProvider.api_url || "",
        api_key: editingProvider.api_key || "",
        twilio_from: editingProvider.twilio_from || "",
        phone_number_id: editingProvider.phone_number_id || "",
        waba_id: editingProvider.waba_id || "",
        access_token: editingProvider.access_token || "",
        webhook_verify_token: editingProvider.webhook_verify_token || "",
      });
    } else if (open && !editingProvider) {
      setForm({
        project_id: "",
        provider: "evolution" as Provider,
        instance_name: "",
        display_name: "",
        api_url: "",
        api_key: "",
        twilio_from: "",
        phone_number_id: "",
        waba_id: "",
        access_token: "",
        webhook_verify_token: "",
      });
    }
  }, [open, editingProvider]);

  const existingForProject = form.project_id ? existingProviders.filter(p => p.project_id === form.project_id) : [];

  const save = async () => {
    if (!form.project_id || !form.provider) {
      toast.error("Projeto e provider obrigatórios");
      return;
    }
    if (form.provider === "meta_cloud" && (!form.phone_number_id || !form.access_token || !form.webhook_verify_token)) {
      toast.error("Phone Number ID, Access Token e Verify Token são obrigatórios");
      return;
    }

    const payload = {
      project_id: form.project_id,
      provider: form.provider,
      instance_name: form.instance_name || null,
      display_name: form.display_name || null,
      api_url: form.api_url || null,
      api_key: form.api_key || null,
      twilio_from: form.twilio_from || null,
      phone_number_id: form.phone_number_id || null,
      waba_id: form.waba_id || null,
      access_token: form.access_token || null,
      webhook_verify_token: form.webhook_verify_token || null,
    };

    if (editingProvider) {
      const { error } = await supabase
        .from("imphq_wa_providers")
        .update(payload as any)
        .eq("id", editingProvider.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Provider atualizado com sucesso!");
    } else {
      const { error } = await supabase
        .from("imphq_wa_providers")
        .insert(payload as any);
      if (error) { toast.error(error.message); return; }
      toast.success("Provider configurado!");
    }

    onOpenChange(false);
    onCreated();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md bg-secondary/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif text-primary">{editingProvider ? "Editar Provider WhatsApp" : "Configurar Provider WhatsApp"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Projeto</Label>
              <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {existingForProject.length > 0 && (
              <div className="text-[11px] text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded px-2 py-1.5 leading-5">
                ℹ Esse projeto já tem {existingForProject.length} chip(s): <strong>{existingForProject.map(p => p.display_name || p.instance_name || p.provider).join(", ")}</strong>. Você pode adicionar mais um (failover/2º número).
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <Label>Provider</Label>
                {form.provider === "evolution" && (
                  <button type="button" onClick={() => setGuide("evolution")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" /> Como conectar?
                  </button>
                )}
                {form.provider === "meta_cloud" && (
                  <button type="button" onClick={() => setGuide("meta")} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" /> Como conectar?
                  </button>
                )}
              </div>
              <Select value={form.provider} onValueChange={(v: Provider) => setForm({ ...form, provider: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="evolution">Evolution API (QR Code)</SelectItem>
                  <SelectItem value="meta_cloud">Meta Cloud API (oficial)</SelectItem>
                  <SelectItem value="twilio">Twilio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.provider === "evolution" && (
              <>
                <div><Label>URL da API</Label><Input value={form.api_url} onChange={e => setForm({ ...form, api_url: e.target.value })} placeholder="https://evolution.seuserver.com" /></div>
                <div><Label>API Key</Label><div className="relative"><Input value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder="Sua API Key" type={showApiKey ? "text" : "password"} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowApiKey(!showApiKey)}>{showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
                <div><Label>Nome da Instância (técnico)</Label><Input value={form.instance_name} onChange={e => setForm({ ...form, instance_name: e.target.value })} placeholder="minha-instancia" /></div>
                <div><Label>Apelido do chip (opcional)</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Ex: Suporte 1, Vendas, Pós-venda" /></div>
              </>
            )}

            {form.provider === "meta_cloud" && (
              <>
                <div><Label>Phone Number ID</Label><Input value={form.phone_number_id} onChange={e => setForm({ ...form, phone_number_id: e.target.value })} placeholder="ex: 123456789012345" /></div>
                <div><Label>WABA ID (WhatsApp Business Account)</Label><Input value={form.waba_id} onChange={e => setForm({ ...form, waba_id: e.target.value })} placeholder="ex: 987654321098765" /></div>
                <div><Label>Access Token (System User permanente)</Label><div className="relative"><Input value={form.access_token} onChange={e => setForm({ ...form, access_token: e.target.value })} placeholder="EAA..." type={showToken ? "text" : "password"} className="pr-10" /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowToken(!showToken)}>{showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div></div>
                <div><Label>Webhook Verify Token (você inventa)</Label><Input value={form.webhook_verify_token} onChange={e => setForm({ ...form, webhook_verify_token: e.target.value })} placeholder="ex: imperius2026" /></div>
                <div><Label>Apelido do chip (opcional)</Label><Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Ex: Oficial Vendas" /></div>
              </>
            )}

            {form.provider === "twilio" && (
              <div><Label>Número Twilio (com DDI)</Label><Input value={form.twilio_from} onChange={e => setForm({ ...form, twilio_from: e.target.value })} placeholder="+5511999999999" /></div>
            )}
          </div>
          <DialogFooter><Button onClick={save}>Salvar Provider</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <MetaCloudGuide open={guide === "meta"} onOpenChange={v => !v && setGuide("none")} />
      <EvolutionGuide open={guide === "evolution"} onOpenChange={v => !v && setGuide("none")} />
    </>
  );
}
