import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function WhatsApp() {
  const [conversations, setConversations] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("imphq_wa_conversations").select("*").order("updated_at", { ascending: false }).then(({ data }) => setConversations(data || []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">WhatsApp</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {conversations.map((c) => (
          <Card key={c.id} className="bg-card border-border">
            <CardContent className="p-4 flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-success mt-0.5" />
              <div>
                <h3 className="text-sm font-medium">{c.contact_name || c.phone || "Conversa"}</h3>
                <p className="text-xs text-muted-foreground">{c.nicho || "—"}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {conversations.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conversa</p>}
      </div>
    </div>
  );
}
