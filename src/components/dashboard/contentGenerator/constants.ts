import { Mail, MessageCircle, Video, Megaphone, FileText, ShoppingCart, Film } from "lucide-react";

export const CONTENT_TYPES = [
  { id: "recovery_email", label: "Email de Recuperação", icon: Mail, desc: "Carrinho abandonado, PIX pendente, boleto", color: "text-blue-400" },
  { id: "ad_copy", label: "Copy de Anúncio", icon: Megaphone, desc: "Facebook/Instagram Ads com variações A/B", color: "text-orange-400" },
  { id: "video_script", label: "Roteiro de Vídeo", icon: Video, desc: "Reels, TikTok, Stories, YouTube Shorts", color: "text-pink-400" },
  { id: "reels_viral", label: "Roteiro Viral Reels", icon: Film, desc: "60+ estruturas testadas (Dica, React, Antes/Depois...)", color: "text-rose-400" },
  { id: "whatsapp_sequence", label: "Sequência WhatsApp", icon: MessageCircle, desc: "Follow-up, recuperação, nurturing", color: "text-green-400" },
  { id: "email_sequence", label: "Sequência de Emails", icon: FileText, desc: "Onboarding, lançamento, nutrição", color: "text-purple-400" },
  { id: "sales_page_blocks", label: "Blocos de Página", icon: ShoppingCart, desc: "Headlines, CTAs, bullet points, provas", color: "text-yellow-400" },
] as const;

export const TRIGGERS = [
  { id: "carrinho_abandonado", label: "Carrinho Abandonado" },
  { id: "pix_pendente", label: "PIX Pendente" },
  { id: "boleto_pendente", label: "Boleto Pendente" },
  { id: "lead_novo", label: "Lead Novo" },
  { id: "compra_aprovada", label: "Pós-Compra" },
  { id: "reengajamento", label: "Reengajamento" },
  { id: "lancamento", label: "Lançamento" },
];

export const FUNNEL_STAGES = [
  { id: "topo", label: "🎯 Topo do Funil", desc: "Awareness — atrair e educar" },
  { id: "meio", label: "🔥 Meio do Funil", desc: "Consideração — nutrir e qualificar" },
  { id: "fundo", label: "💰 Fundo do Funil", desc: "Decisão — converter e fechar" },
];

export const STATUS_CONFIG = {
  rascunho: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  revisao: { label: "Em Revisão", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  aprovado: { label: "Aprovado", color: "bg-green-500/20 text-green-400 border-green-500/30" },
} as const;

export type StatusKey = keyof typeof STATUS_CONFIG;

export interface GeneratedItem {
  id?: string;
  type: string;
  content: string;
  timestamp: number;
  project_name?: string;
  status?: StatusKey;
  funnel_stage?: string | null;
  variation_group?: string | null;
  cluster_id?: string | null;
  cluster_role?: string | null;
  source_idea?: string | null;
}
