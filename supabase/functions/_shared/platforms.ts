// Plataformas (Story OPS2.1): o que o Império pode usar, como opera cada uma e o que falta — no padrão da tela
// /plataformas do Centro de Comando, mas com o estado calculado pelos sinais reais da sala de máquinas.
// Fonte da verdade das capacidades: este registro versionado. Estado: `imphq_machine_room()`. Segredos nunca aparecem aqui.
import { adsSyncHealth } from "./live-panel.ts";
import type { MachineRoom } from "./machine-room.ts";

export type PlatformAction = "ler" | "criar" | "editar" | "executar" | "publicar" | "enviar" | "publicar_sistema";
export type Autonomy = "api" | "cli" | "agente" | "webhook" | "navegador" | "humano";
export type PlatformCategory = "midia_paga" | "conversas" | "inteligencia" | "producao" | "distribuicao" | "receita" | "metricas" | "infraestrutura" | "pesquisa";
export type PlatformState = "operacional" | "atencao" | "erro" | "pendente" | "sem_sinal";

export type Signal =
  | { kind: "anuncios" } | { kind: "whatsapp" } | { kind: "instagram" } | { kind: "rotinas" } | { kind: "tracker" }
  | { kind: "provedor"; provedor: string } | { kind: "webhook"; plataforma: string } | { kind: "nenhum" };

export interface Platform {
  id: string;
  nome: string;
  categoria: PlatformCategory;
  objetivo: string;
  acoes: PlatformAction[];
  autonomia: Autonomy;
  acesso: string;
  quem: string;
  sinal: Signal;
  proximo: string;
  /** Chave da ferramenta em imphq_capabilities, quando existe. */
  capability?: string;
}

export const CATEGORY_LABEL: Record<PlatformCategory, string> = {
  midia_paga: "Mídia paga", conversas: "CRM e conversas", inteligencia: "Inteligência (IA)", producao: "Produção",
  distribuicao: "Distribuição", receita: "Receita", metricas: "Métricas e comportamento", infraestrutura: "Infraestrutura", pesquisa: "Pesquisa",
};
export const ACTION_LABEL: Record<PlatformAction, string> = { ler: "Ler", criar: "Criar", editar: "Editar", executar: "Executar", publicar: "Publicar", enviar: "Enviar mensagem", publicar_sistema: "Publicar sistema" };
export const AUTONOMY_LABEL: Record<Autonomy, string> = { api: "API (automático)", cli: "CLI (automático)", agente: "Ferramenta do agente", webhook: "Recebe por webhook", navegador: "Navegador (assistido)", humano: "Humano" };
export const STATE_LABEL: Record<PlatformState, string> = { operacional: "Operacional", atencao: "Atenção", erro: "Erro", pendente: "Pendente", sem_sinal: "Sem sinal automático" };

export const PLATFORMS: Platform[] = [
  { id: "meta-ads", nome: "Meta Ads", categoria: "midia_paga", objetivo: "Campanhas, gasto e conversões; sync de gasto a cada 30 min e ligar/desligar anúncio.", acoes: ["ler", "criar", "editar"], autonomia: "api", acesso: "Token do Business Manager por projeto", quem: "IA + gestor de tráfego", sinal: { kind: "anuncios" }, proximo: "Token de usuário do sistema (não expira) com ads_read", capability: "meta-ads" },
  { id: "evolution-api", nome: "WhatsApp (Evolution)", categoria: "conversas", objetivo: "X1 com a IA de atendimento, recuperação de pagamento e avisos no grupo.", acoes: ["ler", "enviar"], autonomia: "api", acesso: "Instância conectada em imphq_wa_providers", quem: "IA de atendimento + humano", sinal: { kind: "whatsapp" }, proximo: "Manter o chip conectado; anti-loop de 3 falhas", capability: "evolution-api" },
  { id: "zernio", nome: "Instagram Direct (Zernio)", categoria: "conversas", objetivo: "Receber e responder DMs e comentários do Instagram (X1 do Direct).", acoes: ["ler", "enviar"], autonomia: "api", acesso: "Chave do Zernio por projeto", quem: "IA de atendimento", sinal: { kind: "instagram" }, proximo: "Conectar contas dos outros projetos", capability: "zernio" },
  { id: "openrouter", nome: "OpenRouter", categoria: "inteligencia", objetivo: "Modelos de IA (Claude, GPT, Gemini) para atendimento, copy e análise.", acoes: ["executar"], autonomia: "api", acesso: "OPENROUTER_API_KEY (secret)", quem: "Automações do Império", sinal: { kind: "provedor", provedor: "openrouter" }, proximo: "Registrar custo por chamada em todas as automações" },
  { id: "lovable-ai", nome: "Gateway de IA do Lovable", categoria: "inteligencia", objetivo: "Modelos de IA usados por parte das automações antigas.", acoes: ["executar"], autonomia: "api", acesso: "LOVABLE_API_KEY (secret)", quem: "Automações do Império", sinal: { kind: "nenhum" }, proximo: "Sem API de consumo: decidir se migra para OpenRouter" },
  { id: "elevenlabs", nome: "ElevenLabs", categoria: "producao", objetivo: "Voz da IA no WhatsApp e narração de vídeos.", acoes: ["criar"], autonomia: "api", acesso: "ELEVENLABS_API_KEY (secret)", quem: "IA de atendimento + fábrica de vídeo", sinal: { kind: "provedor", provedor: "elevenlabs" }, proximo: "Acompanhar o ciclo de caracteres", capability: "elevenlabs" },
  { id: "kie", nome: "Kie", categoria: "producao", objetivo: "Geração de imagem e vídeo (modelos de mercado) no Estúdio.", acoes: ["criar"], autonomia: "api", acesso: "KIE_API_KEY (secret)", quem: "Estúdio / fábrica de criativos", sinal: { kind: "provedor", provedor: "kie" }, proximo: "Recarregar quando o saldo cair" },
  { id: "higgsfield", nome: "Higgsfield", categoria: "producao", objetivo: "Cenas e b-roll em vídeo com IA para anúncios.", acoes: ["criar"], autonomia: "agente", acesso: "Sessão do agente", quem: "Agente (Claude)", sinal: { kind: "nenhum" }, proximo: "Registrar gerações e custo no Império", capability: "higgsfield" },
  { id: "geelark", nome: "GeeLark", categoria: "distribuicao", objetivo: "Aparelhos na nuvem: postar no TikTok, Reels, Facebook e Shorts e aquecer contas.", acoes: ["publicar", "executar"], autonomia: "api", acesso: "GEELARK_API_TOKEN (secret)", quem: "Esteira de conteúdo (geelark-publisher)", sinal: { kind: "nenhum" }, proximo: "Token válido + 1º teste real (1 conta, 1 vídeo)", capability: "geelark" },
  { id: "youtube", nome: "YouTube Studio", categoria: "distribuicao", objetivo: "Subir vídeo, título, descrição e capítulos; ler o desempenho.", acoes: ["publicar", "ler"], autonomia: "navegador", acesso: "Conta Google do canal", quem: "Humano", sinal: { kind: "nenhum" }, proximo: "API de envio e YouTube Analytics", capability: "youtube-studio" },
  { id: "vercel", nome: "Vercel", categoria: "infraestrutura", objetivo: "Publicar o app do Império e as páginas dos projetos.", acoes: ["publicar_sistema"], autonomia: "cli", acesso: "Projeto ligado ao GitHub", quem: "Push no main", sinal: { kind: "nenhum" }, proximo: "—", capability: "vercel" },
  { id: "supabase", nome: "Supabase", categoria: "infraestrutura", objetivo: "Banco, functions, rotinas agendadas e arquivos.", acoes: ["ler", "executar", "publicar_sistema"], autonomia: "cli", acesso: "CLI logada no projeto", quem: "Claude / dev", sinal: { kind: "rotinas" }, proximo: "Segurança geral (repo público, chaves expostas)" },
  { id: "ticto", nome: "Ticto", categoria: "receita", objetivo: "Checkout do JP: vendas, Pix, boleto e abandono chegam por webhook.", acoes: ["ler"], autonomia: "webhook", acesso: "Webhook para webhook-pagamento", quem: "Automático", sinal: { kind: "webhook", plataforma: "Ticto" }, proximo: "—" },
  { id: "hw", nome: "H&W", categoria: "receita", objetivo: "Checkout das ofertas DTC: pedidos por postback.", acoes: ["ler"], autonomia: "webhook", acesso: "Postback para webhook-pagamento", quem: "Automático", sinal: { kind: "webhook", plataforma: "H&W" }, proximo: "Conferir postback no painel da H&W" },
  { id: "hotmart", nome: "Hotmart", categoria: "receita", objetivo: "Checkout do projeto tatuagem.", acoes: ["ler"], autonomia: "webhook", acesso: "Webhook para webhook-pagamento", quem: "Automático", sinal: { kind: "webhook", plataforma: "Hotmart" }, proximo: "—" },
  { id: "tracker", nome: "Tracker do Império", categoria: "metricas", objetivo: "Visitas, cliques e checkout das páginas, com projeto pelo domínio.", acoes: ["ler"], autonomia: "api", acesso: "Script do tracker nas páginas", quem: "Automático", sinal: { kind: "tracker" }, proximo: "Instalar nas páginas sem eventos" },
  { id: "ga4", nome: "Google Analytics 4", categoria: "metricas", objetivo: "Tráfego e conversão do site fora do tracker.", acoes: ["ler"], autonomia: "navegador", acesso: "Conta Google", quem: "Humano", sinal: { kind: "nenhum" }, proximo: "Ligar via API se for usado", capability: "ga4" },
  { id: "meta-ad-library", nome: "Biblioteca de Anúncios da Meta", categoria: "pesquisa", objetivo: "Ver anúncios ativos de concorrentes e há quanto tempo rodam.", acoes: ["ler"], autonomia: "navegador", acesso: "Pública", quem: "Humano / agente", sinal: { kind: "nenhum" }, proximo: "Coleta automática de concorrentes", capability: "meta-ad-library" },
  { id: "apify", nome: "Apify", categoria: "pesquisa", objetivo: "Coleta pública (perfis, posts, anúncios) para métricas de conteúdo e mineração.", acoes: ["ler", "executar"], autonomia: "agente", acesso: "Conector do agente", quem: "Agente (Claude)", sinal: { kind: "nenhum" }, proximo: "Usar na coleta de métricas por post" },
];

const DAY = 86_400_000;
const age = (iso: string | null | undefined, now: number) => (iso ? now - Date.parse(iso) : Infinity);
const dm = (iso: string) => iso.slice(0, 10).split("-").reverse().slice(0, 2).join("/");

export interface PlatformStatus { estado: PlatformState; evidencia: string; custo?: string | null; bloqueio?: string | null }

/** Estado de uma plataforma pelos sinais da sala de máquinas. Sem sinal automático = não verificado, nunca "ok". */
export function platformStatus(p: Platform, room: MachineRoom, now: number = Date.now()): PlatformStatus {
  const s = p.sinal;
  switch (s.kind) {
    case "anuncios": {
      const rows = room.anuncios.filter((r) => r.meta_configurado);
      if (!rows.length) return { estado: "pendente", evidencia: "Nenhuma conta de anúncio ligada ao sync" };
      const health = rows.map((r) => adsSyncHealth(r, now));
      const bad = health.filter((h) => h.estado === "erro").length;
      if (bad) return { estado: "erro", evidencia: `${bad} de ${rows.length} conta(s) com sync em erro`, bloqueio: health.find((h) => h.estado === "erro")?.problemas[0] ?? null };
      if (health.some((h) => h.estado === "parado")) return { estado: "atencao", evidencia: "Sync parado há mais de 36 h" };
      return { estado: "operacional", evidencia: `${rows.length} conta(s) sincronizando` };
    }
    case "whatsapp": {
      const active = room.whatsapp.filter((w) => w.ativo);
      if (!active.length) return { estado: "pendente", evidencia: "Nenhum chip ativo" };
      const silent = active.filter((w) => age(w.visto, now) > 3_600_000);
      return silent.length ? { estado: "erro", evidencia: `${silent.length} chip(s) sem sinal há mais de 1 h` } : { estado: "operacional", evidencia: `${active.length} chip(s) conectado(s)` };
    }
    case "instagram": {
      if (!room.instagram.length) return { estado: "pendente", evidencia: "Nenhuma conta conectada" };
      if (room.instagram.some((i) => i.saude_ok === "false")) return { estado: "erro", evidencia: "Conta com erro no Zernio" };
      const fresh = room.instagram.filter((i) => age(i.ultimo_webhook, now) <= DAY).length;
      return fresh ? { estado: "operacional", evidencia: `${fresh} de ${room.instagram.length} conta(s) com webhook nas últimas 24 h` } : { estado: "atencao", evidencia: "Sem webhook do Zernio há mais de 24 h" };
    }
    case "rotinas": {
      const failing = room.rotinas.filter((r) => r.ultimo_status === "failed").length;
      return failing ? { estado: "atencao", evidencia: `${room.rotinas.length} rotinas ativas; ${failing} com a última execução em falha` } : { estado: "operacional", evidencia: `${room.rotinas.length} rotinas ativas sem falha na última execução` };
    }
    case "tracker": {
      const withEvents = room.fontes.filter((f) => age(f.ultimo_evento, now) <= 7 * DAY).length;
      return withEvents ? { estado: "operacional", evidencia: `${withEvents} de ${room.fontes.length} projeto(s) com eventos em 7 dias` } : { estado: "atencao", evidencia: "Nenhum projeto com eventos em 7 dias" };
    }
    case "provedor": {
      const u = room.provedores?.find((x) => x.provedor === s.provedor);
      if (!u) return { estado: "sem_sinal", evidencia: "Consumo ainda não lido" };
      // A semana informada pelo próprio provedor vale mais que a soma das leituras gravadas (pode haver poucos dias).
      const semana = typeof u.detalhes?.usage_weekly === "number" ? u.detalhes.usage_weekly as number : null;
      const custo = semana !== null ? `US$ ${semana.toFixed(2)} na semana`
        : u.gasto_7d_usd !== null && u.gasto_7d_usd !== undefined ? `US$ ${u.gasto_7d_usd.toFixed(2)} em 7 dias`
        : u.saldo !== null ? `saldo ${u.saldo.toLocaleString("pt-BR")} ${u.unidade === "creditos" ? "créditos" : u.unidade === "caracteres_no_ciclo" ? "caracteres" : ""}`.trim() : null;
      const stale = age(u.lido_em, now) > 3 * 3_600_000;
      return { estado: stale ? "atencao" : "operacional", evidencia: stale ? "Leitura de consumo atrasada" : `Consumo lido em ${dm(u.lido_em)}`, custo };
    }
    case "webhook": {
      const w = room.webhooks.find((x) => x.plataforma === s.plataforma);
      if (!w?.ultimo_recebido) return { estado: "pendente", evidencia: "Nenhum aviso recebido" };
      const quiet = age(w.ultimo_recebido, now);
      if (w.erros_24h) return { estado: "erro", evidencia: `${w.erros_24h} erro(s) em 24 h` };
      if (quiet <= 14 * DAY) return { estado: "operacional", evidencia: `Último aviso em ${dm(w.ultimo_recebido)}` };
      return { estado: quiet <= 45 * DAY ? "atencao" : "pendente", evidencia: `Sem aviso desde ${dm(w.ultimo_recebido)} (${Math.floor(quiet / DAY)} dias)` };
    }
    case "nenhum":
      return { estado: "sem_sinal", evidencia: "Sem verificação automática ainda" };
  }
}

const AUTOMATIC: Autonomy[] = ["api", "cli", "agente", "webhook"];

/** Contagens do topo: utilizáveis, automatizáveis, assistidas e pendentes. */
export function platformSummary(rows: ReadonlyArray<{ p: Platform; s: PlatformStatus }>) {
  const usable = rows.filter((r) => r.s.estado === "operacional" || r.s.estado === "atencao");
  return {
    total: rows.length,
    utilizaveis: usable.length,
    automatizaveis: usable.filter((r) => AUTOMATIC.includes(r.p.autonomia)).length,
    assistidas: rows.filter((r) => r.p.autonomia === "navegador" || r.p.autonomia === "humano").length,
    pendentes: rows.filter((r) => r.s.estado === "erro" || r.s.estado === "pendente").length,
  };
}
