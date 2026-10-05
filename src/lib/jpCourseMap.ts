// Catálogo de Cursos & Mapeamento de Rotas Diretas — JP Hair Education
// Utilizado para suporte, resolução de 'Acesso Negado' e geração de Magic Links com redirect correto.

export interface JPCourseInfo {
  programId: string | null;
  title: string;
  shortName: string;
  directPath: string;
  directUrl: string;
  priceTypicalBrl?: number;
  grantsAllPremium?: boolean;
}

export const JP_MEMBER_BASE_URL = "https://www.jphaireducation.com.br";

export const JP_KNOWN_COURSES: Record<string, JPCourseInfo> = {
  "codigo-cortes": {
    programId: "3c368b42-5b73-4d86-a1cd-35c3022b142d",
    title: "O Código dos Cortes Perfeitos - A Mentoria do Zero a Autoridade",
    shortName: "Código dos Cortes Perfeitos",
    directPath: "/programs/3c368b42-5b73-4d86-a1cd-35c3022b142d",
    directUrl: `${JP_MEMBER_BASE_URL}/programs/3c368b42-5b73-4d86-a1cd-35c3022b142d`,
    priceTypicalBrl: 47,
  },
  "cortes-descomplicados": {
    programId: "3c5551b0-7379-4ade-b306-194d9814f601",
    title: "Cortes Descomplicados",
    shortName: "Cortes Descomplicados",
    directPath: "/programs/3c5551b0-7379-4ade-b306-194d9814f601",
    directUrl: `${JP_MEMBER_BASE_URL}/programs/3c5551b0-7379-4ade-b306-194d9814f601`,
    priceTypicalBrl: 97,
  },
  "segredo-corte": {
    programId: "164d66e6-8186-4d1a-8303-e2b88bf95f7f",
    title: "O Segredo do Corte",
    shortName: "O Segredo do Corte",
    directPath: "/programs/164d66e6-8186-4d1a-8303-e2b88bf95f7f",
    directUrl: `${JP_MEMBER_BASE_URL}/programs/164d66e6-8186-4d1a-8303-e2b88bf95f7f`,
    priceTypicalBrl: 67,
  },
  "arte-finalizacao": {
    programId: "8e0ae165-8982-4361-85c9-fa857cf77cd5",
    title: "A Arte da Finalização",
    shortName: "Arte da Finalização",
    directPath: "/programs/8e0ae165-8982-4361-85c9-fa857cf77cd5",
    directUrl: `${JP_MEMBER_BASE_URL}/programs/8e0ae165-8982-4361-85c9-fa857cf77cd5`,
    priceTypicalBrl: 47,
  },
  "finalizacao-express": {
    programId: "d2760367-8fd7-4538-8765-10ac0810fb72",
    title: "Finalização Express",
    shortName: "Finalização Express",
    directPath: "/programs/d2760367-8fd7-4538-8765-10ac0810fb72",
    directUrl: `${JP_MEMBER_BASE_URL}/programs/d2760367-8fd7-4538-8765-10ac0810fb72`,
    priceTypicalBrl: 37,
  },
  "poder-tratamento": {
    programId: "c060d807-ee9e-407e-a7ff-f73e8dd13b52",
    title: "O Poder do Tratamento",
    shortName: "O Poder do Tratamento",
    directPath: "/programs/c060d807-ee9e-407e-a7ff-f73e8dd13b52",
    directUrl: `${JP_MEMBER_BASE_URL}/programs/c060d807-ee9e-407e-a7ff-f73e8dd13b52`,
    priceTypicalBrl: 67,
  },
  "corte-express": {
    programId: "f93166f9-e72c-4b66-a4d0-bc4ef7f860b1",
    title: "Corte Express",
    shortName: "Corte Express",
    directPath: "/programs/f93166f9-e72c-4b66-a4d0-bc4ef7f860b1",
    directUrl: `${JP_MEMBER_BASE_URL}/programs/f93166f9-e72c-4b66-a4d0-bc4ef7f860b1`,
    priceTypicalBrl: 47,
  },
  "formacao-completa": {
    programId: null,
    title: "Formação JP Hair Education (Acesso a Todos os Cursos)",
    shortName: "Formação JP Hair Education",
    directPath: "/home",
    directUrl: `${JP_MEMBER_BASE_URL}/home`,
    priceTypicalBrl: 797,
    grantsAllPremium: true,
  },
};

/**
 * Normaliza e busca o curso correspondente pelo nome do produto, tag ou texto da venda.
 */
export function resolveJPCourse(searchStr?: string | null): JPCourseInfo {
  if (!searchStr) return JP_KNOWN_COURSES["codigo-cortes"];
  const s = searchStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  if (s.includes("descomplicad")) {
    return JP_KNOWN_COURSES["cortes-descomplicados"];
  }
  if (s.includes("segredo") && s.includes("corte")) {
    return JP_KNOWN_COURSES["segredo-corte"];
  }
  if (s.includes("arte") && s.includes("finaliza")) {
    return JP_KNOWN_COURSES["arte-finalizacao"];
  }
  if (s.includes("finaliza") && s.includes("express")) {
    return JP_KNOWN_COURSES["finalizacao-express"];
  }
  if (s.includes("tratamento") || s.includes("poder do tratamento")) {
    return JP_KNOWN_COURSES["poder-tratamento"];
  }
  if (s.includes("express") || s.includes("xpress")) {
    return JP_KNOWN_COURSES["corte-express"];
  }
  if (s.includes("formacao") || s.includes("vitalicio") || s.includes("todos os cursos")) {
    return JP_KNOWN_COURSES["formacao-completa"];
  }
  // Padrão de maior volume / carro-chefe de entrada: Código dos Cortes
  return JP_KNOWN_COURSES["codigo-cortes"];
}

/**
 * Gera a mensagem humanizada e cordial de suporte pós-venda para WhatsApp.
 */
export function buildJPSupportMessage(params: {
  leadName?: string | null;
  courseTitle: string;
  directUrl: string;
  isMagicLink?: boolean;
}): string {
  const primeName = (params.leadName || "").trim().split(/\s+/)[0] || "";
  const saudacao = primeName ? `Oi ${primeName}!` : "Oi!";
  const linkLabel = params.isMagicLink
    ? "link exclusivo sem senha:"
    : "link de acesso direto às aulas:";

  return `${saudacao} Tudo bem? Aqui é do suporte do JP Hair Education. ✨

Vi aqui no sistema que seu acesso ao curso *${params.courseTitle}* está 100% liberado e ativo!

Para assistir às aulas agora mesmo, basta clicar neste ${linkLabel}
${params.directUrl}

💡 *Dica importante:* Se você entrar pela página inicial genérica e clicar no banner da Formação de R$ 797, a plataforma avisa "Acesso negado" porque são produtos diferentes. Usando o link acima você cai direto dentro das suas aulas sem bloqueio nenhum.

Qualquer dúvida ou se precisar de ajuda com login, estou à disposição por aqui. Bons estudos e arrase nos cortes! ✂️🚀`;
}
