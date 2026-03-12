import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold text-primary">Configurações</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" /> Preferências do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            As API keys e webhooks são gerenciados via Supabase Edge Functions e secrets.
          </p>
          <div>
            <Label>Cotação USD → BRL</Label>
            <Input defaultValue="5.20" className="bg-secondary max-w-xs" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
