import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function WaBriefingCard() {
  const [enabled, setEnabled] = useState(false);
  const [phone, setPhone] = useState("");
  const [hour, setHour] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase
        .from("imphq_notification_preferences")
        .select("wa_briefing_enabled, wa_briefing_phone, wa_briefing_hour")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setEnabled(!!data.wa_briefing_enabled);
        setPhone(data.wa_briefing_phone || "");
        setHour(Number(data.wa_briefing_hour ?? 8));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("imphq_notification_preferences")
        .upsert({
          user_id: userId,
          wa_briefing_enabled: enabled,
          wa_briefing_phone: phone || null,
          wa_briefing_hour: hour,
        }, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Briefing WhatsApp salvo");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    if (!userId) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("daily-briefing-wa", {
        body: {},
        // pass via query string
      });
      // call again forcing
      const { data: resp, error: err2 } = await supabase.functions.invoke(`daily-briefing-wa?force=true&user_id=${userId}`, { body: {} });
      if (err2 || error) throw (err2 || error);
      toast.success("Briefing enviado para o seu WhatsApp");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  return (
    <Card className="bg-secondary/40">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="font-semibold leading-7">Briefing diário no WhatsApp</p>
              <p className="text-xs text-muted-foreground leading-6">Imperius envia resumo executivo todo dia na hora escolhida</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone destino</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="11999998888 (+55 auto)"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Hora (BRT)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={save} disabled={saving} size="sm">
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
          {enabled && phone && (
            <Button onClick={sendNow} disabled={sending} size="sm" variant="outline">
              {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Enviar agora (teste)
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
