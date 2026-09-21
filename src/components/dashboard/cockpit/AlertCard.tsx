import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Flame, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

// ─── data fetchers ────────────────────────────────────────────────────────────

async function fetchHotLeads(): Promise<number> {
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('imphq_leads')
    .select('id', { count: 'exact', head: true })
    .gt('score', 70)
    .gte('criado_em', since);

  if (error) throw error;
  return count ?? 0;
}

async function fetchAwaitingConversations(): Promise<number> {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const sixHoursAgo  = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('imphq_wa_conversations')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'closed')
    .lt('last_message_at', thirtyMinAgo)
    .gt('last_message_at', sixHoursAgo)
    .eq('last_message_direction', 'in');

  if (error) throw error;
  return count ?? 0;
}

async function fetchAutomationErrors(): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('imphq_automacao_logs')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'error')
    .gte('created_at', since);

  if (error) throw error;
  return count ?? 0;
}

// ─── pill sub-component ────────────────────────────────────────────────────────

interface PillProps {
  icon: React.ElementType;
  label: string;
  color: string;
  textColor: string;
  to: string;
}

function AlertPill({ icon: Icon, label, color, textColor, to }: PillProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold cursor-pointer hover:opacity-80 transition-opacity"
      style={{ backgroundColor: color, color: textColor }}
    >
      <Icon size={12} strokeWidth={2.5} />
      {label}
    </Link>
  );
}

// ─── main component ────────────────────────────────────────────────────────────

export function AlertCard() {
  const { data: hotLeads, isLoading: loadingLeads } = useQuery({
    queryKey: ['alert-hot-leads'],
    queryFn: fetchHotLeads,
    staleTime: 60_000,
  });

  const { data: awaiting, isLoading: loadingAwaiting } = useQuery({
    queryKey: ['alert-awaiting-convos'],
    queryFn: fetchAwaitingConversations,
    staleTime: 60_000,
  });

  const { data: errors, isLoading: loadingErrors } = useQuery({
    queryKey: ['alert-automation-errors'],
    queryFn: fetchAutomationErrors,
    staleTime: 60_000,
  });

  if (loadingLeads || loadingAwaiting || loadingErrors) {
    return null;
  }

  const hl = hotLeads ?? 0;
  const aw = awaiting  ?? 0;
  const er = errors    ?? 0;

  const allClear = hl === 0 && aw === 0 && er === 0;

  return (
    <div className="flex items-center gap-2 flex-wrap py-2">
      {allClear ? (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold"
          style={{ backgroundColor: '#052e16', color: '#4ADE80' }}
        >
          <CheckCircle2 size={12} strokeWidth={2.5} />
          Operação sem alertas
        </span>
      ) : (
        <>
          {hl > 0 && (
            <AlertPill
              icon={Flame}
              label={`${hl} leads quentes sem contato`}
              color="#D6FF4B"
              textColor="#0A0B0D"
              to="/inbox?tab=fila"
            />
          )}
          {aw > 0 && (
            <AlertPill
              icon={Clock}
              label={`${aw} conversas aguardando`}
              color="#FB923C"
              textColor="#0A0B0D"
              to="/inbox?tab=whatsapp"
            />
          )}
          {er > 0 && (
            <AlertPill
              icon={AlertTriangle}
              label={`${er} falhas em automações`}
              color="#FB7185"
              textColor="#0A0B0D"
              to="/openflow"
            />
          )}
        </>
      )}
    </div>
  );
}
