import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Eye, MousePointerClick, Pause, SkipForward, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props { leadId: string; }

export function LeadNurtureTimeline({ leadId }: Props) {
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: enr } = await supabase
      .from("imphq_lead_sequence_enrollments")
      .select("*, imphq_nurture_sequences(nome, produto)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setEnrollments(enr || []);

    const enrollmentIds = (enr || []).map((e: any) => e.id);
    if (enrollmentIds.length > 0) {
      const { data: em } = await supabase
        .from("imphq_nurture_emails")
        .select("*")
        .in("enrollment_id", enrollmentIds)
        .order("created_at", { ascending: false })
        .limit(50);
      setEmails(em || []);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const pauseEnrollment = async (id: string) => {
    await supabase.from("imphq_lead_sequence_enrollments").update({ status: "pausado" } as any).eq("id", id);
    toast.success("Sequência pausada");
    load();
  };

  const resumeEnrollment = async (id: string) => {
    await supabase.from("imphq_lead_sequence_enrollments").update({ status: "ativo" } as any).eq("id", id);
    toast.success("Sequência reativada");
    load();
  };

  const skipNext = async (id: string, dia: number) => {
    await supabase.from("imphq_lead_sequence_enrollments").update({
      dia_atual: dia + 1,
      proximo_envio_em: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    } as any).eq("id", id);
    toast.success("Próximo e-mail pulado");
    load();
  };

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</div>;

  if (enrollments.length === 0) {
    return <p className="text-sm text-muted-foreground p-4 text-center">Lead não está em nenhuma sequência de nutrição.</p>;
  }

  return (
    <div className="space-y-3">
      {enrollments.map((enr: any) => {
        const enrEmails = emails.filter(e => e.enrollment_id === enr.id);
        return (
          <Card key={enr.id} className="border-primary/20">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{enr.imphq_nurture_sequences?.nome || "Sequência"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Dia {enr.dia_atual} • Status: <Badge variant={enr.status === "ativo" ? "default" : "secondary"} className="text-[9px] h-4 px-1">{enr.status}</Badge>
                  </p>
                </div>
                <div className="flex gap-1">
                  {enr.status === "ativo" && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => skipNext(enr.id, enr.dia_atual)} title="Pular próximo">
                        <SkipForward className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => pauseEnrollment(enr.id)} title="Pausar">
                        <Pause className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                  {enr.status === "pausado" && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => resumeEnrollment(enr.id)}>Reativar</Button>
                  )}
                </div>
              </div>

              {enrEmails.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">Nenhum e-mail enviado ainda.</p>
              ) : (
                <div className="space-y-1">
                  {enrEmails.map(em => (
                    <div key={em.id} className="flex items-center justify-between text-[11px] bg-muted/50 rounded px-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{em.assunto || "(sem assunto)"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {em.aberto_em && <Eye className="h-3 w-3 text-emerald-400" aria-label="Aberto" />}
                        {em.clicado_em && <MousePointerClick className="h-3 w-3 text-blue-400" aria-label="Clicou" />}
                        <span className="text-muted-foreground">{em.enviado_em ? format(new Date(em.enviado_em), "dd/MM HH:mm") : "agendado"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
