
-- Backfill: leads que têm venda aprovada mas status != cliente/vip ficam como 'cliente'
UPDATE public.imphq_leads l
SET status = 'cliente', updated_at = now()
WHERE status IN ('lead','membro')
  AND EXISTS (
    SELECT 1 FROM public.imphq_vendas v
    WHERE v.lead_id = l.id
      AND v.status IN ('aprovado','approved','paid','APROVADO','APPROVED','PAID')
  );

-- Trigger de proteção: ao atualizar status de lead, nunca rebaixar quem já é cliente/vip
-- (exceto quando o novo status for explicitamente cancelado/chargeback/reembolso).
CREATE OR REPLACE FUNCTION public.lead_status_precedence_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  rank_old int;
  rank_new int;
  rank_map jsonb := '{"lead":1,"membro":2,"cliente":3,"vip":4}'::jsonb;
  protected text[] := ARRAY['cancelado','chargeback','reembolso','refund','refunded'];
BEGIN
  IF NEW.status IS NULL OR OLD.status IS NULL OR NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  -- permite explicitamente os status protegidos (rebaixamentos válidos)
  IF NEW.status = ANY(protected) THEN
    RETURN NEW;
  END IF;
  rank_old := COALESCE((rank_map ->> OLD.status)::int, 0);
  rank_new := COALESCE((rank_map ->> NEW.status)::int, 0);
  IF rank_new < rank_old THEN
    NEW.status := OLD.status; -- bloqueia rebaixamento
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lead_status_precedence ON public.imphq_leads;
CREATE TRIGGER trg_lead_status_precedence
BEFORE UPDATE OF status ON public.imphq_leads
FOR EACH ROW EXECUTE FUNCTION public.lead_status_precedence_guard();
