import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, MessageSquarePlus, DoorOpen, AtSign } from "lucide-react";
import { toast } from "sonner";

interface Props {
  campaignId: string;
  welcomeMessage: string | null;
  exitMessage: string | null;
  antiHack: boolean;
  mentionAll: boolean;
  onUpdate: () => void;
}

export default function CampaignAutomationPanel({ campaignId, welcomeMessage, exitMessage, antiHack, mentionAll, onUpdate }: Props) {
  const [welcome, setWelcome] = useState(welcomeMessage || "");
  const [exit, setExit] = useState(exitMessage || "");
  const [hack, setHack] = useState(antiHack);
  const [mention, setMention] = useState(mentionAll);

  const update = async (field: string, value: any) => {
    const { error } = await supabase
      .from("imphq_wa_campaigns")
      .update({ [field]: value } as any)
      .eq("id", campaignId);
    if (error) toast.error(error.message);
    else {
      toast.success("Atualizado!");
      onUpdate();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">⚙️ Automações de Grupo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Welcome Message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              <MessageSquarePlus className="h-3.5 w-3.5 text-emerald-400" />
              Boas-vindas automático
            </Label>
            <Switch
              checked={!!welcome}
              onCheckedChange={checked => {
                if (!checked) {
                  setWelcome("");
                  update("welcome_message", null);
                }
              }}
            />
          </div>
          {welcome !== null && (
            <Textarea
              className="text-xs min-h-[50px]"
              value={welcome}
              onChange={e => setWelcome(e.target.value)}
              onBlur={() => update("welcome_message", welcome || null)}
              placeholder="Bem-vindo ao grupo! 🎉"
            />
          )}
        </div>

        {/* Exit Message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs flex items-center gap-1.5">
              <DoorOpen className="h-3.5 w-3.5 text-amber-400" />
              Realocar saídas (DM)
            </Label>
            <Switch
              checked={!!exit}
              onCheckedChange={checked => {
                if (!checked) {
                  setExit("");
                  update("exit_message", null);
                }
              }}
            />
          </div>
          {exit !== null && (
            <Textarea
              className="text-xs min-h-[50px]"
              value={exit}
              onChange={e => setExit(e.target.value)}
              onBlur={() => update("exit_message", exit || null)}
              placeholder="Vi que saiu do grupo. Posso ajudar?"
            />
          )}
        </div>

        {/* Anti-hack */}
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5 text-destructive" />
            Anti-hack (pausa se remoção em massa)
          </Label>
          <Switch
            checked={hack}
            onCheckedChange={v => {
              setHack(v);
              update("anti_hack", v);
            }}
          />
        </div>

        {/* Mention All */}
        <div className="flex items-center justify-between">
          <Label className="text-xs flex items-center gap-1.5">
            <AtSign className="h-3.5 w-3.5 text-blue-400" />
            Mencionar todos (@all) nos disparos
          </Label>
          <Switch
            checked={mention}
            onCheckedChange={v => {
              setMention(v);
              update("mention_all", v);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
