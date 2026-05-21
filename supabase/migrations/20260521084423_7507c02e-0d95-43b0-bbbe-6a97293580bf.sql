-- ============ IG ACCOUNTS ============
CREATE TABLE public.imphq_ig_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  ig_user_id TEXT,
  username TEXT,
  page_id TEXT,
  page_access_token_ref TEXT,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  auth_method TEXT NOT NULL DEFAULT 'manual',
  last_refresh_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, ig_user_id)
);
CREATE INDEX idx_ig_accounts_project ON public.imphq_ig_accounts(project_id);
CREATE INDEX idx_ig_accounts_status ON public.imphq_ig_accounts(status);

ALTER TABLE public.imphq_ig_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_accounts_auth_all" ON public.imphq_ig_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ IG CONVERSATIONS ============
CREATE TABLE public.imphq_ig_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.imphq_ig_accounts(id) ON DELETE CASCADE,
  ig_thread_id TEXT,
  participant_id TEXT NOT NULL,
  participant_username TEXT,
  participant_name TEXT,
  participant_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  lead_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, participant_id)
);
CREATE INDEX idx_ig_conv_account ON public.imphq_ig_conversations(account_id);
CREATE INDEX idx_ig_conv_lastmsg ON public.imphq_ig_conversations(last_message_at DESC);

ALTER TABLE public.imphq_ig_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_conv_auth_all" ON public.imphq_ig_conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ IG MESSAGES ============
CREATE TABLE public.imphq_ig_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.imphq_ig_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  content TEXT,
  media_url TEXT,
  mid TEXT,
  status TEXT DEFAULT 'sent',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ig_msg_conv ON public.imphq_ig_messages(conversation_id, created_at DESC);
CREATE UNIQUE INDEX idx_ig_msg_mid ON public.imphq_ig_messages(mid) WHERE mid IS NOT NULL;

ALTER TABLE public.imphq_ig_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_msg_auth_all" ON public.imphq_ig_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ IG COMMENTS ============
CREATE TABLE public.imphq_ig_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.imphq_ig_accounts(id) ON DELETE CASCADE,
  media_id TEXT,
  comment_id TEXT NOT NULL UNIQUE,
  parent_comment_id TEXT,
  from_user_id TEXT,
  from_username TEXT,
  text TEXT,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  replied BOOLEAN NOT NULL DEFAULT false,
  reply_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ig_comments_account ON public.imphq_ig_comments(account_id, created_at DESC);
CREATE INDEX idx_ig_comments_media ON public.imphq_ig_comments(media_id);

ALTER TABLE public.imphq_ig_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_comments_auth_all" ON public.imphq_ig_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ IG WEBHOOK LOGS ============
CREATE TABLE public.imphq_ig_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  payload JSONB,
  account_id UUID REFERENCES public.imphq_ig_accounts(id) ON DELETE SET NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ig_webhook_logs_created ON public.imphq_ig_webhook_logs(created_at DESC);

ALTER TABLE public.imphq_ig_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ig_webhook_logs_auth_read" ON public.imphq_ig_webhook_logs FOR SELECT TO authenticated USING (true);

-- ============ TRIGGERS updated_at ============
CREATE TRIGGER trg_ig_accounts_updated BEFORE UPDATE ON public.imphq_ig_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_ig_conv_updated BEFORE UPDATE ON public.imphq_ig_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();