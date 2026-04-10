import { useEffect, useState } from "react";
import { SectionInfo } from "@/components/SectionInfo";
import { sectionHelpTexts } from "@/data/sectionHelpTexts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Users, UserCheck, Shield, Star, Mail } from "lucide-react";
import { toast } from "sonner";
import MemberDetailPanel from "@/components/equipe/MemberDetailPanel";

const ROLE_COLORS: Record<string, string> = {
  Admin: "bg-primary/20 text-primary",
  Editor: "bg-accent/20 text-accent-foreground",
  Viewer: "bg-muted text-muted-foreground",
};

const AVATAR_COLORS = [
  "bg-primary", "bg-accent", "bg-destructive", "bg-emerald-500",
  "bg-violet-500", "bg-orange-500", "bg-cyan-500", "bg-rose-500",
];

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const ROLES = ["Admin", "Editor", "Viewer"];
const DEPARTMENTS = ["Dev", "Marketing", "Copy", "Tráfego", "Design", "Operação", "Financeiro"];

export default function Equipe() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [deptFilter, setDeptFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [form, setForm] = useState({ name: "", email: "", role: "Editor", department: "Marketing" });
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});

  const fetchMembers = async () => {
    const { data } = await supabase.from("imphq_team_members").select("*").order("created_at");
    const memberList = data || [];
    setMembers(memberList);

    // Load counts in parallel
    if (memberList.length > 0) {
      const ids = memberList.map((m: any) => m.id);
      const [cardsRes, docsRes] = await Promise.all([
        supabase.from("imphq_kanban_cards").select("id, member_id").in("member_id", ids),
        supabase.from("imphq_team_docs").select("id, member_id").in("member_id", ids),
      ]);
      const tc: Record<string, number> = {};
      const dc: Record<string, number> = {};
      (cardsRes.data || []).forEach((c: any) => { tc[c.member_id] = (tc[c.member_id] || 0) + 1; });
      (docsRes.data || []).forEach((d: any) => { dc[d.member_id] = (dc[d.member_id] || 0) + 1; });
      setTaskCounts(tc);
      setDocCounts(dc);
    }
  };

  useEffect(() => { fetchMembers(); }, []);

  const addMember = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.email.trim()) { toast.error("Email é obrigatório"); return; }
    const { error } = await supabase.from("imphq_team_members").insert({
      name: form.name, email: form.email, role: form.role,
      department: form.department, user_id: user?.id, is_active: true,
    } as any);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Membro convidado!");
    setForm({ name: "", email: "", role: "Editor", department: "Marketing" });
    setDialogOpen(false);
    fetchMembers();
  };

  const toggleActive = async (m: any) => {
    await supabase.from("imphq_team_members").update({ is_active: !m.is_active }).eq("id", m.id);
    fetchMembers();
  };

  const activeMembers = members.filter(m => m.is_active);
  const admins = members.filter(m => m.role === "Admin");
  const uniqueDepts = [...new Set(members.map(m => m.department).filter(Boolean))];

  const filtered = members.filter(m => {
    if (deptFilter !== "all" && m.department !== deptFilter) return false;
    if (roleFilter !== "all" && m.role !== roleFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">Equipe <SectionInfo {...sectionHelpTexts.equipe} /></h1>
            <p className="text-xs text-muted-foreground">{members.length} membros · {activeMembers.length} ativos</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1" /> Convidar
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div><p className="text-2xl font-bold">{members.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-emerald-400" />
            <div><p className="text-2xl font-bold">{activeMembers.length}</p><p className="text-xs text-muted-foreground">Ativos</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{admins.length}</p><p className="text-xs text-muted-foreground">Admins</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <Star className="h-5 w-5 text-accent" />
            <div><p className="text-2xl font-bold">{uniqueDepts.length}</p><p className="text-xs text-muted-foreground">Departamentos</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos depts." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos depts.</SelectItem>
            {uniqueDepts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          <Button size="sm" variant={roleFilter === "all" ? "default" : "outline"} className="text-xs h-7" onClick={() => setRoleFilter("all")}>Todos</Button>
          {ROLES.map(r => (
            <Button key={r} size="sm" variant={roleFilter === r ? "default" : "outline"} className="text-xs h-7" onClick={() => setRoleFilter(r)}>{r}</Button>
          ))}
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((m) => (
          <Card
            key={m.id}
            className="bg-card border-border hover:border-primary/30 cursor-pointer transition-all"
            onClick={() => setSelectedMember({ ...m })}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className={`h-10 w-10 ${getAvatarColor(m.name || "")}`}>
                      <AvatarFallback className="text-white text-sm font-bold bg-transparent">
                        {getInitials(m.name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    {m.is_active && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-card" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" /> {m.email || "—"}
                    </p>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge className={`text-[10px] ${ROLE_COLORS[m.role] || ROLE_COLORS.Viewer}`}>
                  {m.role === "Admin" ? "👑" : m.role === "Editor" ? "🖊️" : "👁️"} {m.role || "Viewer"}
                </Badge>
                {m.department && <span className="text-[10px] text-muted-foreground">{m.department}</span>}
              </div>
              {/* Counters */}
              {(taskCounts[m.id] || docCounts[m.id]) && (
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  {taskCounts[m.id] && <span>📋 {taskCounts[m.id]} tarefa(s)</span>}
                  {docCounts[m.id] && <span>📄 {docCounts[m.id]} doc(s)</span>}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">Nenhum membro encontrado</p>
        )}
      </div>

      {/* New Member Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar Membro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email *</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cargo</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Departamento</Label>
                <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={addMember}>Convidar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Detail Panel (Sheet) */}
      <MemberDetailPanel
        member={selectedMember}
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        onUpdated={fetchMembers}
      />
    </div>
  );
}
