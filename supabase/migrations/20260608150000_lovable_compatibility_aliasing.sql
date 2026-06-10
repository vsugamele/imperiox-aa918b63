-- Lovable compatibility schema aliasing
-- Adds compatibility columns to prevent 400 Bad Request errors on browser-side Lovable sync scripts

-- 1. imphq_wa_messages: Add read column
ALTER TABLE public.imphq_wa_messages ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- 2. imphq_leads: Add created_at column and sync trigger
ALTER TABLE public.imphq_leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE;

-- Sync existing data
UPDATE public.imphq_leads SET created_at = criado_em WHERE created_at IS NULL AND criado_em IS NOT NULL;

-- Trigger to keep criado_em and created_at in sync
CREATE OR REPLACE FUNCTION sync_imphq_leads_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at IS NULL AND NEW.criado_em IS NOT NULL THEN
    NEW.created_at := NEW.criado_em;
  ELSIF NEW.criado_em IS NULL AND NEW.created_at IS NOT NULL THEN
    NEW.criado_em := NEW.created_at;
  ELSIF NEW.created_at IS NOT NULL AND NEW.criado_em IS NOT NULL THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.created_at <> OLD.created_at AND NEW.criado_em = OLD.criado_em THEN
        NEW.criado_em := NEW.created_at;
      ELSIF NEW.criado_em <> OLD.criado_em AND NEW.created_at = OLD.created_at THEN
        NEW.created_at := NEW.criado_em;
      END IF;
    ELSE
      -- On INSERT, if both are set but different, default to created_at
      IF NEW.created_at <> NEW.criado_em THEN
        NEW.criado_em := NEW.created_at;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_imphq_leads_timestamps ON public.imphq_leads;
CREATE TRIGGER trg_sync_imphq_leads_timestamps
  BEFORE INSERT OR UPDATE ON public.imphq_leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_imphq_leads_timestamps();


-- 3. imphq_ads_spend: Add compatibility columns and sync trigger
ALTER TABLE public.imphq_ads_spend ADD COLUMN IF NOT EXISTS data DATE;
ALTER TABLE public.imphq_ads_spend ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.imphq_ads_spend ADD COLUMN IF NOT EXISTS spend NUMERIC;
ALTER TABLE public.imphq_ads_spend ADD COLUMN IF NOT EXISTS purchases INTEGER;

-- Sync existing data
UPDATE public.imphq_ads_spend SET
  data = data_ref,
  date = data_ref,
  spend = valor,
  purchases = compras
WHERE (data IS NULL AND data_ref IS NOT NULL)
   OR (date IS NULL AND data_ref IS NOT NULL)
   OR (spend IS NULL AND valor IS NOT NULL)
   OR (purchases IS NULL AND compras IS NOT NULL);

-- Trigger to keep ads spend fields in sync
CREATE OR REPLACE FUNCTION sync_imphq_ads_spend_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Date fields
  IF TG_OP = 'UPDATE' THEN
    IF NEW.data_ref <> OLD.data_ref THEN
      NEW.data := NEW.data_ref;
      NEW.date := NEW.data_ref;
    ELSIF NEW.data <> OLD.data THEN
      NEW.data_ref := NEW.data;
      NEW.date := NEW.data;
    ELSIF NEW.date <> OLD.date THEN
      NEW.data_ref := NEW.date;
      NEW.data := NEW.date;
    END IF;
  ELSE
    -- On INSERT, prioritize data_ref, then data, then date
    IF NEW.data_ref IS NOT NULL THEN
      NEW.data := NEW.data_ref;
      NEW.date := NEW.data_ref;
    ELSIF NEW.data IS NOT NULL THEN
      NEW.data_ref := NEW.data;
      NEW.date := NEW.data;
    ELSIF NEW.date IS NOT NULL THEN
      NEW.data_ref := NEW.date;
      NEW.data := NEW.date;
    END IF;
  END IF;

  -- Spend fields
  IF TG_OP = 'UPDATE' THEN
    IF NEW.valor <> OLD.valor THEN
      NEW.spend := NEW.valor;
    ELSIF NEW.spend <> OLD.spend THEN
      NEW.valor := NEW.spend;
    END IF;
  ELSE
    IF NEW.valor IS NOT NULL THEN
      NEW.spend := NEW.valor;
    ELSIF NEW.spend IS NOT NULL THEN
      NEW.valor := NEW.spend;
    END IF;
  END IF;

  -- Purchases fields
  IF TG_OP = 'UPDATE' THEN
    IF NEW.compras <> OLD.compras THEN
      NEW.purchases := NEW.compras;
    ELSIF NEW.purchases <> OLD.purchases THEN
      NEW.compras := NEW.purchases;
    END IF;
  ELSE
    IF NEW.compras IS NOT NULL THEN
      NEW.purchases := NEW.compras;
    ELSIF NEW.purchases IS NOT NULL THEN
      NEW.compras := NEW.purchases;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_imphq_ads_spend_fields ON public.imphq_ads_spend;
CREATE TRIGGER trg_sync_imphq_ads_spend_fields
  BEFORE INSERT OR UPDATE ON public.imphq_ads_spend
  FOR EACH ROW
  EXECUTE FUNCTION sync_imphq_ads_spend_fields();
