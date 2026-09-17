
interface BlockType {
  id: string;
  label: string;
  icon: string;
  desc: string;
  color: string;
}

const BLOCK_TYPES: BlockType[] = [
  { id: "vsl", label: "VSL", icon: "🎬", desc: "Roteiro de vídeo de vendas", color: "border-rose-500/40 bg-rose-500/5" },
  { id: "email", label: "E-mail", icon: "✉️", desc: "Cópia ou sequência de e-mail", color: "border-sky-500/40 bg-sky-500/5" },
  { id: "ad_copy", label: "Copy de Anúncio", icon: "📣", desc: "Título + primária + descrição", color: "border-amber-500/40 bg-amber-500/5" },
  { id: "landing", label: "Landing Page", icon: "🌐", desc: "Estrutura + copy de LP", color: "border-emerald-500/40 bg-emerald-500/5" },
  { id: "wa_seq", label: "Seq. WhatsApp", icon: "💬", desc: "Sequência de mensagens", color: "border-green-500/40 bg-green-500/5" },
  { id: "reels", label: "Reels/Story", icon: "📱", desc: "Roteiro Instagram", color: "border-pink-500/40 bg-pink-500/5" },
  { id: "qualif", label: "Qualificação", icon: "✅", desc: "Formulário/quiz", color: "border-violet-500/40 bg-violet-500/5" },
];

export { type BlockType, BLOCK_TYPES };
