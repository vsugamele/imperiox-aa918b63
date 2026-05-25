import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Radio, CheckCircle2 } from "lucide-react";

export default function WebinarPublic() {
  const { sessionId } = useParams();
  const [session, setSession] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", email: "", phone: "" });
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("imphq_webinar_sessions").select("id, nome, scheduled_at")
      .eq("id", sessionId).maybeSingle().then(({ data }) => setSession(data));
  }, [sessionId]);

  async function submit() {
    if (!form.nome || !form.phone) return;
    setSubmitting(true);
    const { error } = await supabase.from("imphq_webinar_registrations").insert({
      session_id: sessionId, ...form,
    });
    setSubmitting(false);
    if (!error) setDone(true);
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full bg-secondary/40">
        <CardContent className="py-8 space-y-6">
          <div className="text-center space-y-2">
            <Radio className="h-10 w-10 text-primary mx-auto" />
            <h1 className="text-2xl font-serif">{session.nome}</h1>
            {session.scheduled_at && (
              <p className="text-xs text-muted-foreground">
                {new Date(session.scheduled_at).toLocaleString("pt-BR")}
              </p>
            )}
          </div>

          {done ? (
            <div className="text-center space-y-3 py-6">
              <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
              <p className="text-sm">Inscrição confirmada! Você receberá os detalhes no WhatsApp.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Input placeholder="Nome completo" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
              <Input placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="WhatsApp (com DDD)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <Button className="w-full" onClick={submit} disabled={submitting}>
                {submitting ? "Enviando..." : "Garantir minha vaga"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
