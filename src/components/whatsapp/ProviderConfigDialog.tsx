import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: any[];
  onCreated: () => void;
}

export default function ProviderConfigDialog({ open, onOpenChange, projects, onCreated }: Props) {
  const [form, setForm] = useState({
    project_id: "",
    provider: "evolution" as "evolution" | "twilio",
    instance_name: "",
    api_url: "",
    api_key: "",
    twilio_from: "",
  });

  const save = async () => {
    if (!form.project_id || !form.provider) {
      toast.error("Projeto e provider obrigatórios");
      return;
    }
    const { error } = await supabase.from("imphq_wa_providers").insert({
      project_id: form.project_id,
      provider: form.provider,
      instance_name: form.instance_name || null,
      api_url: form.api_url || null,
      api_key: form.api_key || null,
      twilio_from: form.twilio_from || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Provider configurado!");
    onOpenChange(false);
    setForm({ project_id: "", provider: "evolution", instance_name: "", api_url: "", api_key: "", twilio_from: "" });
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Configurar Provider WhatsApp</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Projeto</Label>
            <Select value={form.project_id} onValueChange={v => setForm({ ...form, project_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Provider</Label>
            <Select value={form.provider} onValueChange={(v: "evolution" | "twilio") => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="evolution">Evolution API</SelectItem>
                <SelectItem value="twilio">Twilio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.provider === "evolution" && (
            <>
              <div><Label>URL da API</Label><Input value={form.api_url} onChange={e => setForm({ ...form, api_url: e.target.value })} placeholder="https://evolution.seuserver.com" /></div>
              <div><Label>API Key</Label><Input value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} placeholder="Sua API Key" type="password" /></div>
              <div><Label>Nome da Instância</Label><Input value={form.instance_name} onChange={e => setForm({ ...form, instance_name: e.target.value })} placeholder="minha-instancia" /></div>
            </>
          )}
          {form.provider === "twilio" && (
            <div><Label>Número Twilio (com DDI)</Label><Input value={form.twilio_from} onChange={e => setForm({ ...form, twilio_from: e.target.value })} placeholder="+5511999999999" /></div>
          )}
        </div>
        <DialogFooter><Button onClick={save}>Salvar Provider</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
