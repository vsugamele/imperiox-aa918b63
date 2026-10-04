// Perfis × canais (Story OPS2.2): a tabela de contas do Centro de Comando dentro do Império.
// Junta os perfis (imphq_profiles), os e-mails cadastrados em Empresa (status de aquecimento) e os aparelhos (imphq_cloud_phones).
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const CHANNELS = ["instagram", "facebook", "tiktok", "youtube"] as const;
const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube" };
const STATUS_LABEL: Record<string, string> = { inventario: "Inventário", aquecendo: "Aquecendo", ativo: "Ativo", pausado: "Pausado", bloqueado: "Bloqueado" };
const STATUS_STYLE: Record<string, string> = {
  ativo: "border-success/40 text-success", aquecendo: "border-warning/40 text-warning", bloqueado: "border-destructive/40 text-destructive",
  pausado: "border-border text-muted-foreground", inventario: "border-border text-muted-foreground",
};
const CHANNEL_STATE: Record<string, string> = { active: "Ativo", setup: "Configurando", restricted: "Restrito", down: "Fora do ar", paused: "Pausado", unknown: "Não verificado" };
/** Meta do Centro: até 5 páginas de Facebook por conta. */
const PAGES_TARGET = 5;

interface Channel { ref: string | null; status: string }
interface Profile {
  id: string; nome: string; project_id: string | null; email: string | null; maquina: string | null; proxy: string | null; status: string;
  canais: Partial<Record<(typeof CHANNELS)[number], Channel>>; paginas_facebook: Array<{ nome: string | null; ref: string | null; status: string }>;
}

const shortRef = (ref: string) => ref.replace(/^https?:\/\/(www\.)?(instagram|facebook|tiktok|youtube)\.com\//i, "").replace(/\/$/, "");

export function ProfilesMatrix() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const [emailWarmup, setEmailWarmup] = useState<Record<string, string>>({});
  const [devices, setDevices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("imphq_profiles").select("id, nome, project_id, email, maquina, proxy, status, canais, paginas_facebook").order("nome"),
      supabase.from("imphq_projects").select("id, name"),
      supabase.from("imphq_empresa").select("nome, extra").eq("tipo", "email"),
      supabase.from("imphq_cloud_phones").select("device_id, nome"),
    ]).then(([p, pr, em, dv]) => {
      setProfiles((p.data ?? []) as unknown as Profile[]);
      setProjects(Object.fromEntries((pr.data ?? []).map((x) => [x.id, x.name])));
      setEmailWarmup(Object.fromEntries((em.data ?? []).map((x) => [String(x.nome).toLowerCase(), String((x.extra as Record<string, unknown> | null)?.status_aquecimento ?? "")])));
      setDevices(Object.fromEntries((dv.data ?? []).filter((x) => x.device_id).map((x) => [String(x.device_id), x.nome || String(x.device_id)])));
      setLoading(false);
    });
  }, []);

  const counts = useMemo(() => ({
    total: profiles.length,
    comMaquina: profiles.filter((p) => p.maquina).length,
    paginas: profiles.reduce((s, p) => s + (p.paginas_facebook?.length ?? 0), 0),
  }), [profiles]);

  if (loading) return <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!profiles.length) return <p className="py-10 text-center text-sm text-muted-foreground">Nenhum perfil cadastrado.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {counts.total} perfil(is) · {counts.comMaquina} com aparelho · {counts.paginas} página(s) de Facebook. Situação cadastrada, não verificada automaticamente.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Perfil / produto</th>
              <th className="px-3 py-2 font-medium">E-mail</th>
              <th className="px-3 py-2 font-medium">Máquina / proxy</th>
              {CHANNELS.map((c) => <th key={c} className="px-3 py-2 font-medium">{CHANNEL_LABEL[c]}</th>)}
              <th className="px-3 py-2 font-medium">Páginas Facebook</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const warm = p.email ? emailWarmup[p.email.toLowerCase()] : "";
              return (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-foreground">{p.nome}</p>
                    <p className="text-[11px] text-muted-foreground">{p.project_id ? projects[p.project_id] ?? p.project_id : "Produto não associado"}</p>
                    <Badge variant="outline" className={cn("mt-1 text-[10px]", STATUS_STYLE[p.status])}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-foreground break-all">{p.email ?? "Pendente"}</p>
                    {warm && <p className="text-[11px] text-muted-foreground">Empresa: {warm}</p>}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-mono text-[12px] text-foreground">{p.maquina ? devices[p.maquina] ?? p.maquina : "—"}</p>
                    <p className="text-[11px] text-muted-foreground">Proxy: {p.proxy || "não informado"}</p>
                  </td>
                  {CHANNELS.map((c) => {
                    const ch = p.canais?.[c];
                    return (
                      <td key={c} className="px-3 py-2.5">
                        <p className="text-foreground break-all">{ch?.ref ? shortRef(ch.ref) : "Sem vínculo"}</p>
                        <p className="text-[11px] text-muted-foreground">{CHANNEL_STATE[ch?.status ?? "unknown"] ?? ch?.status}</p>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5">
                    <p className="text-foreground">{p.paginas_facebook?.length ?? 0} cadastrada(s)</p>
                    <p className="text-[11px] text-muted-foreground">Meta: até {PAGES_TARGET} por conta</p>
                    {(p.paginas_facebook ?? []).map((pg, i) => (
                      <p key={i} className="text-[11px] text-primary">{pg.nome || pg.ref} · {CHANNEL_STATE[pg.status] ?? pg.status}</p>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
