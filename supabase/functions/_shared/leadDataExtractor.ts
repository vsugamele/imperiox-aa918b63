// leadDataExtractor — Extrai dados explícitos do lead a partir de uma mensagem do WhatsApp
// e persiste em imphq_leads sem sobrescrever dados existentes.
//
// Regras:
// - Roda só com mensagens > 15 chars (filtra "oi", "sim", emojis).
// - Só usa dados que o lead disse EXPLICITAMENTE — sem inferência.
// - Nunca sobrescreve email/phone/nome existentes (apenas registra divergência em log).
// - nome falado vira lead_memory.nome_preferido (não troca cadastro).
// - profissao/objetivo/cidade/data_nascimento → preenche lead_memory.informacoes_pessoais se vazio.
// - dor_principal/objecao_atual/ultimo_interesse → atualiza se vier conteúdo novo.
// - Falha silenciosa: se a extração der erro, o fluxo normal segue.

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

export interface ExtractedLeadData {
  email?: string;
  nome?: string;
  telefone_alternativo?: string;
  cidade?: string;
  profissao?: string;
  objetivo?: string;
  dor_principal?: string;
  objecao_atual?: string;
  interesse_produto?: string;
  data_nascimento?: string;
}

export interface ExtractAndPersistResult {
  extracted: ExtractedLeadData;
  detectedEmail: string;     // email captado nesta mensagem (já normalizado)
  effectiveEmail: string;    // detectedEmail || email já cadastrado
  emailDivergent: boolean;   // true se lead digitou email diferente do cadastrado
  changedFields: string[];   // lista de campos que efetivamente mudaram no banco
}

const EMPTY: ExtractAndPersistResult = {
  extracted: {},
  detectedEmail: "",
  effectiveEmail: "",
  emailDivergent: false,
  changedFields: [],
};

function regexEmail(text: string): string {
  try {
    const m = (text || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/i);
    return m ? m[0].trim().toLowerCase() : "";
  } catch {
    return "";
  }
}

async function callExtractor(message: string): Promise<ExtractedLeadData> {
  if (!LOVABLE_API_KEY) return {};
  const systemPrompt = `Você extrai informações que o LEAD acabou de dizer EXPLICITAMENTE em UMA mensagem de WhatsApp.
Responda APENAS com JSON válido (sem markdown). Use null quando o lead NÃO disse aquilo nesta mensagem.
NÃO infira nada — só extraia o que está literal no texto.

{
  "email": "email mencionado ou null",
  "nome": "nome próprio ou apelido que o lead pediu para ser chamado, ou null",
  "telefone_alternativo": "número de telefone digitado ou null",
  "cidade": "cidade/estado mencionado ou null",
  "profissao": "profissão/ocupação mencionada ou null",
  "objetivo": "objetivo/meta que ele quer alcançar ou null",
  "dor_principal": "principal problema/dor que ele mencionou ou null",
  "objecao_atual": "objeção/dúvida/bloqueio que ele acabou de levantar ou null",
  "interesse_produto": "produto/serviço específico que ele perguntou ou null",
  "data_nascimento": "data de nascimento ou null"
}`;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message.slice(0, 2000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return {};
    const j = await resp.json();
    const raw = j?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const out: ExtractedLeadData = {};
    for (const k of Object.keys(parsed)) {
      const v = parsed[k];
      if (v && typeof v === "string" && v.trim() && v.toLowerCase() !== "null") {
        (out as any)[k] = v.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function extractAndPersistLeadData(
  supabase: any,
  lead: { id?: string; email?: string | null; phone?: string | null; nome?: string | null; lead_memory?: any },
  message: string,
): Promise<ExtractAndPersistResult> {
  try {
    if (!lead?.id || !message) return EMPTY;
    const txt = String(message).trim();

    // Sempre detecta email por regex (rápido, sem custo).
    const regexFoundEmail = regexEmail(txt);

    // Só chama IA se a mensagem for substancial.
    const shouldCallAI = txt.length > 15;
    const extracted = shouldCallAI ? await callExtractor(txt) : {};

    // Email: regex tem prioridade se a IA não pegou.
    if (regexFoundEmail && !extracted.email) extracted.email = regexFoundEmail;
    if (extracted.email) extracted.email = extracted.email.toLowerCase().trim();

    const storedEmail = String(lead?.email || "").trim().toLowerCase();
    const detectedEmail = extracted.email || "";
    const emailDivergent = !!(detectedEmail && storedEmail && detectedEmail !== storedEmail);
    const effectiveEmail = detectedEmail || storedEmail;

    // Monta update
    const update: Record<string, any> = {};
    const memory: Record<string, any> = { ...(lead?.lead_memory || {}) };
    const memInfo: Record<string, any> = { ...(memory.informacoes_pessoais || {}) };
    const changedFields: string[] = [];

    // EMAIL — só preenche se vazio (nunca sobrescreve)
    if (detectedEmail && !storedEmail) {
      update.email = detectedEmail;
      changedFields.push("email");
    }

    // NOME — vira nome_preferido em lead_memory (nunca troca cadastro)
    if (extracted.nome && memory.nome_preferido !== extracted.nome) {
      memory.nome_preferido = extracted.nome;
      changedFields.push("lead_memory.nome_preferido");
    }

    // Telefone alternativo
    if (extracted.telefone_alternativo && !memInfo.telefone_alternativo) {
      memInfo.telefone_alternativo = extracted.telefone_alternativo;
      changedFields.push("lead_memory.telefone_alternativo");
    }

    // Cidade / profissão / objetivo / data_nascimento → só se vazio
    for (const k of ["cidade", "profissao", "objetivo", "data_nascimento"] as const) {
      const v = extracted[k];
      if (v && !memInfo[k]) {
        memInfo[k] = v;
        changedFields.push(`lead_memory.${k}`);
      }
    }

    // Dor principal → atualiza coluna nativa só se vazia (evita ficar trocando toda hora)
    if (extracted.dor_principal && !memInfo.dor_principal) {
      memInfo.dor_principal = extracted.dor_principal;
      update.dor_principal = extracted.dor_principal.slice(0, 300);
      changedFields.push("dor_principal");
    }

    // Objeção atual e interesse → sempre atualiza (são voláteis)
    if (extracted.objecao_atual) {
      update.objecao_atual = extracted.objecao_atual.slice(0, 300);
      changedFields.push("objecao_atual");
    }
    if (extracted.interesse_produto) {
      update.ultimo_interesse = extracted.interesse_produto.slice(0, 200);
      changedFields.push("ultimo_interesse");
    }

    if (Object.keys(memInfo).length > 0) memory.informacoes_pessoais = memInfo;

    // Histórico de capturas (últimas 20)
    if (changedFields.length > 0) {
      const history = Array.isArray(memory.capturas) ? memory.capturas : [];
      history.push({ at: new Date().toISOString(), fields: changedFields, divergent_email: emailDivergent ? detectedEmail : undefined });
      memory.capturas = history.slice(-20);
      update.lead_memory = memory;
      update.updated_at = new Date().toISOString();

      try {
        await supabase.from("imphq_leads").update(update).eq("id", lead.id);
        console.log(`[leadDataExtractor] lead=${lead.id} changed=${changedFields.join(",")}${emailDivergent ? " emailDivergent" : ""}`);
      } catch (e: any) {
        console.warn(`[leadDataExtractor] update failed: ${e?.message}`);
      }
    }

    if (emailDivergent) {
      console.log(`[leadDataExtractor] lead=${lead.id} email divergente cadastrado=${storedEmail} novo=${detectedEmail} (não sobrescrito)`);
    }

    return { extracted, detectedEmail, effectiveEmail, emailDivergent, changedFields };
  } catch (e: any) {
    console.warn(`[leadDataExtractor] fatal: ${e?.message}`);
    return EMPTY;
  }
}
