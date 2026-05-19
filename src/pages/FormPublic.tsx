import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Field {
  key: string; label: string; type: string; required?: boolean;
  options?: string[]; placeholder?: string;
}

export default function FormPublic() {
  const { formId } = useParams<{ formId: string }>();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!formId) return;
      const { data } = await supabase.from("imphq_capture_forms")
        .select("id,nome,fields,settings,is_active").eq("id", formId).maybeSingle();
      if (!data || !data.is_active) setError("Formulário não disponível");
      else setForm(data);
      setLoading(false);
    })();
  }, [formId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = new URL(window.location.href);
      const utms: any = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(u => {
        const v = url.searchParams.get(u);
        if (v) utms[u] = v;
      });
      const { data, error } = await supabase.functions.invoke("capture-lead", {
        body: { form_id: formId, ...values, ...utms, page_url: window.location.href },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Carregando…</div>;
  if (error && !form) return <div className="min-h-screen flex items-center justify-center bg-background text-destructive">{error}</div>;

  const fields = (form?.fields || []) as Field[];
  const settings = (form?.settings || {}) as any;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-secondary/40 border border-border rounded-2xl p-6 md:p-8">
        <h1 className="font-display text-2xl text-primary mb-2">{form.nome}</h1>
        {settings.description && <p className="text-sm text-muted-foreground leading-7 mb-6">{settings.description}</p>}

        {done ? (
          <div className="text-center py-8">
            <p className="text-emerald-400 text-lg font-medium mb-2">✓ Recebemos sua resposta</p>
            <p className="text-sm text-muted-foreground">Obrigado!</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea
                    name={f.key} required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm min-h-[80px]"
                  />
                ) : f.type === "select" && f.options ? (
                  <select
                    name={f.key} required={f.required}
                    value={values[f.key] || ""}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">{f.placeholder || "Selecione..."}</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    name={f.key} required={f.required} type={f.type}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
            {error && <p className="text-destructive text-xs">{error}</p>}
            <button
              type="submit" disabled={submitting}
              className="w-full bg-primary text-primary-foreground font-medium py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50"
            >
              {submitting ? "Enviando…" : "Enviar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
