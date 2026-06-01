import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FlaskConical, Sparkles, Loader2, Copy, FileDown, 
  Target, ShieldAlert, Award, AlignLeft, HelpCircle, 
  HelpCircle as QuestionIcon, RefreshCw, PenTool, CheckCircle, Zap
} from "lucide-react";

interface VslTool {
  id: string;
  title: string;
  icon: any;
  desc: string;
  promptNum: number;
}

const VSL_TOOLS: VslTool[] = [
  { id: "raio_x", title: "Raio-X do Público", icon: Target, desc: "Análise visceral em 7 camadas da psicologia de compra do seu público.", promptNum: 1 },
  { id: "mechanism_lab", title: "Mechanism Lab", icon: FlaskConical, desc: "Criação do mecanismo único, apelidos curiosos e o seu One Belief.", promptNum: 2 },
  { id: "logic_points", title: "Logic Points Builder", icon: AlignLeft, desc: "Construção da Escada de Pontos Lógicos e a conclusão inevitável da tese.", promptNum: 3 },
  { id: "story_architect", title: "Story Architect", icon: PenTool, desc: "Desenho da origin story da VSL estruturada em 7 beats de identificação.", promptNum: 4 },
  { id: "lead_creator", title: "Lead Architect (E3)", icon: Sparkles, desc: "Ganchos e leads magnéticos baseados nos 3 esqueletos campeões e 9 elementos.", promptNum: 5 },
  { id: "offer_builder", title: "Offer Builder", icon: Award, desc: "Montagem da Oferta VSL e bloco de construção com a escada de ancoragem.", promptNum: 6 },
];

export default function VslLab() {
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTool, setActiveTool] = useState<string>("raio_x");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>("");
  
  // Fields for Tool 1: Raio X
  const [raioXForm, setRaioXForm] = useState({
    produto: "",
    nicho: "",
    promessa: ""
  });

  // Fields for Tool 2: Mechanism Lab
  const [mechanismForm, setMechanismForm] = useState({
    produto: "",
    publico: "",
    diferente: "",
    engenharia: ""
  });

  // Fields for Tool 3: Logic Points
  const [logicPointsForm, setLogicPointsForm] = useState({
    mechanismLabOutput: "",
    solucoesFalhas: "",
    provas: ""
  });

  // Fields for Tool 4: Story Architect
  const [storyForm, setStoryForm] = useState({
    protagonista: "expert", // expert | cliente
    fatosBase: "",
    mechanismOutput: "",
    logicPoints: "",
    raioX: ""
  });

  // Fields for Tool 5: Lead Creator
  const [leadForm, setLeadForm] = useState({
    angulo: "mecanismo", // mecanismo | problema_solucao | segredo
    oferta: "",
    publico: "",
    mecanismo: "",
    tese: "",
    historia: ""
  });

  // Fields for Tool 6: Offer Builder
  const [offerForm, setOfferForm] = useState({
    nome: "",
    promessa: "",
    mecanismo: "",
    preco: "",
    ultimoPonto: "",
    expertAplicacao: "",
    expertResultado: "",
    depoimentos: "",
    decisaoProduto: "",
    modulos: "",
    bonus: "",
    garantia: "7 dias",
    urgencia: "",
    doresHoje: "",
    desejosFuturo: ""
  });

  useEffect(() => {
    // Load projects to auto-fill details
    supabase.from("imphq_projects").select("id, name, icon, data, avatar").then(({ data }) => {
      if (data) {
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
          fillFromProject(data[0]);
        }
      }
    });
  }, []);

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId);
    const proj = projects.find(p => p.id === projId);
    if (proj) {
      fillFromProject(proj);
    }
  };

  const fillFromProject = (project: any) => {
    const pData = typeof project.data === "string" ? JSON.parse(project.data) : (project.data || {});
    const avatar = project.avatar || {};
    const briefing = pData.briefing || {};
    const expert = pData.expert || {};
    const produtos = pData.produtos || [];
    const firstProduct = produtos[0] || {};
    const copyArsenal = firstProduct.copy_arsenal || {};

    const doresStr = (avatar.dores || []).slice(0, 3).map((d: any) => d.descricao || d.text || "").join(", ");
    const desejosStr = (avatar.desejos || []).slice(0, 3).map((d: any) => d.descricao || d.text || "").join(", ");

    // Pre-fill Raio X
    setRaioXForm({
      produto: firstProduct.nome || briefing.nicho || project.name,
      nicho: briefing.nicho || briefing.sub_nicho || "Marketing Digital",
      promessa: copyArsenal.promessa?.[0] || briefing.transformacao || ""
    });

    // Pre-fill Mechanism Lab
    setMechanismForm({
      produto: `${firstProduct.nome || project.name} - ${copyArsenal.promessa?.[0] || briefing.transformacao || ""}`,
      publico: `${briefing.nicho || "Empreendedores"} - Dor principal: ${doresStr || "Falta de vendas"}`,
      diferente: firstProduct.mecanismo_unico || copyArsenal.metodo_simplificado?.[0] || briefing.fator_diferencial || "",
      engenharia: firstProduct.contexto || expert.metodo || briefing.metodologia || ""
    });

    // Pre-fill Story Architect fatos
    setStoryForm(prev => ({
      ...prev,
      fatosBase: `Expert: ${expert.bio || ""}. Método criado: ${expert.metodo || ""}. Resultados do expert: ${briefing.transformacao || ""}.`,
      mechanismOutput: `Mecanismo Único: ${firstProduct.mecanismo_unico || ""}. One Belief estimado: [Abordagem] é a chave para [Resultado] e só é possível através de [Mecanismo].`
    }));

    // Pre-fill Lead Creator
    setLeadForm({
      angulo: "mecanismo",
      oferta: firstProduct.nome || project.name,
      publico: briefing.nicho || "Empreendedores",
      mecanismo: firstProduct.mecanismo_unico || "",
      tese: copyArsenal.promessa?.[0] || briefing.transformacao || "",
      historia: expert.bio || ""
    });

    // Pre-fill Offer Builder
    setOfferForm({
      nome: firstProduct.nome || project.name,
      promessa: copyArsenal.promessa?.[0] || briefing.transformacao || "",
      mecanismo: firstProduct.mecanismo_unico || "",
      preco: "297",
      ultimoPonto: copyArsenal.metodo_simplificado?.[0] || "Portanto, automatizar seus processos é a chave definitiva.",
      expertAplicacao: "Apliquei o sistema E3 de funis automatizados no meu próprio negócio.",
      expertResultado: "Faturei R$ 100 mil líquidos em apenas 21 dias sem investir em anúncios complexos.",
      depoimentos: "João aumentou vendas em 45%, Maria economizou 15h por semana na operação.",
      decisaoProduto: "Decidi empacotar esse método porque cansei de ver pequenos empresários quebrando por falta de fluxo.",
      modulos: "Módulo 1: Alinhamento e Fundações do Mecanismo\nMódulo 2: Engenharia do Escorregador Lógico\nMódulo 3: Implementação da Automação",
      bonus: "Super Bônus 1: Script de VSL Copiável (Valor: R$ 497)\nBônus 2: Templates de WhatsApp de Alta Conversão (Valor: R$ 297)",
      garantia: "7 dias incondicional",
      urgencia: "O desconto especial de lançamento e os bônus exclusivos expiram nesta sexta-feira às 23:59.",
      doresHoje: doresStr || "Sentir que trabalha demais e não tem lucro, Ficar preso em tarefas operacionais",
      desejosFuturo: desejosStr || "Ter liberdade de tempo e financeira, Ver a empresa rodando no piloto automático"
    });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setResult("");
    try {
      let systemPrompt = "";
      let userPrompt = "";

      if (activeTool === "raio_x") {
        systemPrompt = `Você é um copywriter de elite especialista em comportamento do consumidor e psicologia de compra.
Sua missão é realizar um Raio-X detalhado do público em 7 camadas a partir dos dados do produto fornecidos.
Seja específico, visceral e realista. Use linguagem simples, não técnica. Sem introdução, sem conclusão.

Retorne EXATAMENTE nesta estrutura em Markdown:
# RAIO-X DO PÚBLICO - 7 CAMADAS

### 1. QUEM É ESSA PESSOA (3 linhas)
[Perfil detalhado, faixa de idade, faixa de renda, momento de vida, relação emocional com o problema]

### 2. AS 3 MAIORES DORES (em ordem de intensidade)
Para cada dor:
* **[Nome curto da dor]**: Como ela aparece no dia a dia (situação concreta da vida real).

### 3. OS DRIVES EMOCIONAIS POR TRÁS DESSAS DORES
3 motivações profundas que ela não admite em voz alta. Para cada uma:
* **[Nome do drive]**: Uma frase marcante entre aspas que captura esse sentimento.

### 4. O QUE ELA JÁ TENTOU E NÃO FUNCIONOU
3 soluções concretas com nomes reais citados do mercado. Apenas cite a solução em formato de lista, sem explicações adicionais.

### 5. O QUE ELA ACREDITA SER O PROBLEMA HOJE
Uma frase direta começando com "Eu não consigo porque..." que traduz a ilusão dela sobre o fracasso.

### 6. O QUE ELA SECRETAMENTE TEME
Um medo visceral e assustador que ela não fala em voz alta sobre o futuro dela se nada mudar.

### 7. O QUE ELA SONHA ALCANÇAR
3 desejos topo, em ordem de profundidade emocional. Para cada um:
* O desejo concreto.
* Uma cena específica e visual da vida real quando esse sonho se materializar.`;

        userPrompt = `DADOS DO PRODUTO:
- Produto/Serviço: ${raioXForm.produto}
- Nicho de Atuação: ${raioXForm.nicho}
- Promessa Principal: ${raioXForm.promessa}`;
      } 
      else if (activeTool === "mechanism_lab") {
        systemPrompt = `Você é um copywriter de elite especialista em VSLs sofisticadas e mecanismos únicos.
Foi treinado no Método E3 de VSL do Tiago Filemon (Neolife), com base em Eugene Schwartz (Gradualização), Clayton Makepeace (Processo A-B-C), Evaldo Albuquerque (One Belief) e nos critérios de Max Peters (NUUPPECC).
Sua missão é definir o mecanismo único do produto do usuário e entregar apelidos curiosos que colem na cabeça do prospect como chiclete.

O DOCUMENTO QUE VOCÊ DEVE ENTREGAR DEVE SEGUIR EXATAMENTE ESTE FORMATO MARKDOWN:
# MECANISMO ÚNICO E ONE BELIEF

## POR QUE FUNCIONA
[1-2 frases explicando o princípio científico ou mecânico. Se houver causa raiz biológica/sistêmica/financeira, ela aparece aqui de forma natural.]

## 4 APELIDOS CURIOSOS
Apresente 4 apelidos curiosos explorando ângulos diferentes (ex: ingrediente, técnica, acrônimo, metáfora, contraintuitivo, superestrutura).
Para cada apelido:
* **[Nome do Apelido]** (Ângulo: [Tipo])
  * *Por que cola:* [1 frase explicando os critérios do checklist NUUPPECC que ele atende]
  * [Se for acrônimo, explique o que cada letra significa]

## APELIDO RECOMENDADO
Recomendo o apelido **[X]** porque [razão concreta baseada no público ou na diferenciação].

## SEU ONE BELIEF (Fórmula Evaldo Albuquerque)
"**[NOVA OPORTUNIDADE]** é a chave para **[DESEJO EMOCIONAL]** e só é possível através do **[APELIDO RECOMENDADO]**."

*ATENÇÃO CRÍTICA NA MONTAGEM DO ONE BELIEF:*
- A **NOVA OPORTUNIDADE** deve descrever uma AÇÃO ou ABORDAGEM prática diferente de tudo. Quase sempre começa com VERBO NO INFINITIVO (ex: "Evitar o efeito platô", "Automatizar criativos usando IA", "Ativar a fase profunda do sono").
- O **DESEJO** deve ser emocional e profundo (ex: "recuperar a autoestima perdida", "voltar a se sentir atraente", "alcançar liberdade financeira sem depender de clientes chatos").
- O **APELIDO RECOMENDADO** entra estritamente no final como o instrumento físico.
- NUNCA repita o nome do apelido na posição de Nova Oportunidade. Nova Oportunidade (ação) e Mecanismo (instrumento) devem ser coisas inteiramente distintas!`;

        userPrompt = `RESPOSTAS DO USUÁRIO:
1. Produto e Promessa: ${mechanismForm.produto}
2. Público e Desejo Principal: ${mechanismForm.publico}
3. Diferencial e Fator Único: ${mechanismForm.diferente}
4. Como funciona o Método (Partes/Pilares/Ingredientes): ${mechanismForm.engenharia}`;
      }
      else if (activeTool === "logic_points") {
        systemPrompt = `Você é o Logic Points Builder — um copywriter de elite especialista em construir a Escada de Pontos Lógicos da Tese de uma VSL.
Foi treinado no Método E3 do Tiago Filemon (Neolife), com base em Eugene Schwartz (Gradualização), Clayton Makepeace (Processo A-B-C), Todd Brown (CPB Chunks) e Evaldo Albuquerque (One Belief).
Sua missão é construir os Pontos Lógicos da Tese de forma que o leitor aceite o One Belief ao final.
Você opera no esqueleto expandido, adicionando Claim (Afirmação) + Proof (Prova lógica/metáfora) + Benefit (Sabor adequado) + Conexão escorregadeira para cada ponto.

O DOCUMENTO QUE VOCÊ DEVE ENTREGAR DEVE SEGUIR EXATAMENTE ESTE FORMATO MARKDOWN:
# ESCADA DE PONTOS LÓGICOS DA TESE

## CONCLUSÃO INEVITÁVEL
[Frase lógica de encerramento que serve de gancho perfeito para o One Belief]

## A ESCADA DE PERSUASÃO (PONTOS LÓGICOS)

### Ponto 1 — [Nome curto do ponto]
* **Afirmação:** [1 frase clara que o prospect já aceita no início]
* **Proof:** [1 frase com razão técnica, estudo ou metáfora lógica]
* **Benefit:** [1 frase no sabor correto - consequência/decepção/benefício]
* **Conexão:** [1 frase curta com gatilho de escorregador que abre a incógnita para o Ponto 2]

---

### Ponto 2 — [Nome curto]
* **Afirmação:** [Próximo passo lógico que decorre do Ponto 1]
* **Proof:** [...]
* **Benefit:** [...]
* **Conexão:** [Abre incógnita para o Ponto 3]

---

[Construa entre 4 a 6 pontos bem articulados, garantindo que pelo menos um ponto invalide as soluções tradicionais falhas do mercado.]`;

        userPrompt = `DADOS DA TESE:
- Mecanismo e One Belief (Mechanism Lab): ${logicPointsForm.mechanismLabOutput}
- Soluções Falhas do Público: ${logicPointsForm.solucoesFalhas}
- Provas/Estudos/Metáforas Disponíveis: ${logicPointsForm.provas}`;
      }
      else if (activeTool === "story_architect") {
        systemPrompt = `Você é o Agente da História do Método, treinado no Método E3 de VSL do Tiago Filemon.
Sua função é escrever a História da VSL — a jornada do protagonista que gera identificação e prepara a tese.
A história tem 7 beats rígidos. Ela gera identificação, planta o mecanismo sutilmente em cena (sem dar o nome dele) e estende as crenças do leitor.
Seja dramático, use frases curtas, parágrafos de 1 a 3 sentenças. Ritmo de copy de alta retenção.

O DOCUMENTO QUE VOCÊ DEVE ENTREGAR DEVE SEGUIR EXATAMENTE ESTE FORMATO MARKDOWN:
# JORNADA NARRATIVA - 7 BEATS

### Beat 1 — O Expert (Autoridade)
[Quem conta e suas credenciais. Se for história de cliente, mostre o expert como guia]

### Beat 2 — O "Era Como Você" (Identificação)
[O protagonista vivendo a mesma dor diária e frustrações do prospect]

### Beat 3 — As Tentativas Frustradas (Invalidação)
[Tudo o que o protagonista tentou do mercado comum e como tudo falhou miseravelmente]

### Beat 4 — O Fundo do Poço (Momento da Virada)
[O evento dramático e emocional que o forçou a mudar de vez]

### Beat 5 — A Busca pela Verdade (Investigação)
[O protagonista começa a pesquisar fora da caixa, procurando a causa real oculta]

### Beat 6 — O Encontro (Revelação Externa)
[O evento, livro, pessoa ou fagulha contraintuitiva que apontou o novo caminho]

### Beat 7 — A Descoberta do Método (Mecanismo em Cena)
[A cena exata em que o método fez sentido. Descreva a ação prática do Por Que Funciona do mecanismo sem citar o apelido comercial ainda.]

*REGRAS DE OURO:*
- Nunca invente nomes, números de lucros fictícios ou datas.
- Use tom coloquial, emocional e visceral em português brasileiro.
- Termine a última frase com uma transição suave e curiosa que chame o leitor para ouvir a explicação científica (tese).`;

        userPrompt = `DADOS DO PRODUTO E HISTÓRIA:
- Tipo de Protagonista: ${storyForm.protagonista.toUpperCase()}
- Fatos Reais da Jornada: ${storyForm.fatosBase}
- Mecanismo e One Belief (Mechanism Lab): ${storyForm.mechanismOutput}
- Pontos Lógicos da Tese (se houver): ${storyForm.logicPoints}
- Raio-X do Público (se houver): ${storyForm.raioX}`;
      }
      else if (activeTool === "lead_creator") {
        systemPrompt = `Você é um copywriter brasileiro de elite especialista em Direct Response, engenharia de VSLs e criador do "Lead Architect" da metodologia E3 do Tiago Filemon.
Sua missão é escrever a LEAD (bloco inicial magnético de 2 a 3 minutos da VSL) modelando de forma estrita e rígida o esqueleto do ângulo escolhido pelo usuário.

Você opera sob a LEI 4 DE EUGENE SCHWARTZ: "Desejo não pode ser criado, apenas canalizado."
Portanto, não tente 'criar' desejos novos na lead. Identifique a dor/desejo visceral pré-existente do público-alvo e canalize-os diretamente para o seu Mecanismo Único.

Você DEVE estruturar o texto gerado de forma a conter e destacar todos os 9 Elementos de uma Lead de Sucesso:
1. Mencione um problema visceral e cotidiano (Dor aguda).
2. Prometa uma solução que economize tempo e dinheiro.
3. Spoiler da história (antecipação instigante da jornada do expert/protagonista).
4. Spoiler do Mecanismo/Tese (cite o Apelido do Mecanismo para atiçar curiosidade, mas não explique a ciência).
5. Bullets de curiosidade (três bullets magnéticos e misteriosos usando ganchos de antecipação profunda).
6. Reconheça a descrença de forma empática ("Eu sei que isso soa bom demais para ser verdade...").
7. Qualificadores ("Esta apresentação é apenas para quem [X], e NÃO serve para quem [Y]").
8. Depoimentos baseados na eficácia do método/mecanismo (nunca sobre o produto em si).
9. Elementos de credibilidade e autoridade.

ÂNGULOS E ESQUELETOS PERMITIDOS:
1. MECANISMO:
  - Frase de descoberta nomeando o Apelido + promessa imediata.
  - Mecanismo contraintuitivo teasado (o "como" sem explicar a ciência).
  - Enquadra concorrentes como desnecessários ("torna X obsoleto").
  - Simplicidade do ritual + stack de objeções (idade, tempo).
  - Future-pacing visual curto.
  - Reconhece a descrença ("eu também não acreditaria se não visse").
  - Abre loop para a História.

2. PROBLEMA-SOLUÇÃO:
  - "Olá, meu nome é X" + qualificador ("se você tem Y, esse é o vídeo mais importante...").
  - Declara guerra aos vigaristas e mercado corporativo que sugaram seu dinheiro.
  - Promessa de mostrar a verdadeira razão física por trás disso.
  - A culpa NÃO é sua.
  - Reframe da causa nomeando o Apelido + o que ele faz silenciosamente 24h.
  - Nova descoberta científica + promessa de tempo rápido.
  - Stack de objeção + future-pacing + reconhece descrença.
  - Abre loop para a História ("antes de mostrar o método, deixa eu te contar...").

3. SEGREDO:
  - Tease de tempo + o segredo ("em 90s vou revelar algo que você é secretamente obcecado").
  - Escala o segredo ("mais que A, mais que B, até mais que C") + raridade extrema.
  - Autoridade do expert + o que destrava na vida do leitor.
  - Mecanismo teasado sem nomear + como ele age silenciosamente.
  - Stack "mesmo se / não importa se".
  - Nomeia o Apelido como Clímax da lead.
  - Abre loop para a História.

*REGRAS DRÁSTICAS DE PERSUASÃO E RITMO:*
- O Apelido é ISCA. Nomeie para atiçar a curiosidade, mas NÃO explique como funciona de forma lógica na lead.
- NUNCA parecer que vai vender algo. Sem preço, sem 'curso', sem especificações de produto. Trate como uma descoberta de utilidade pública.
- Use placeholders [[ ... ]] para dados não informados (como depoimentos ou números de clientes).
- Escreva com ritmo cinematográfico: parágrafos curtos (1-2 frases no máximo), espaçamento para respiração e linguagem puramente de conversação humana falada.`;

        userPrompt = `DADOS DA LEAD:
- ÂNGULO DE Persuasão: ${leadForm.angulo.toUpperCase()}
- Produto/Oferta: ${leadForm.oferta}
- Público-Alvo: ${leadForm.publico}
- Apelido do Mecanismo: ${leadForm.mecanismo}
- Tese/Promessa: ${leadForm.tese}
- História de Gancho: ${leadForm.historia}`;
      }
      else if (activeTool === "offer_builder") {
        systemPrompt = `Você é o Offer Builder do Sistema E3 de VSL do Tiago Filemon.
Sua missão é escrever dois blocos essenciais para fechar a VSL: a CONSTRUÇÃO DO PRODUTO (bloco de transição) e a OFERTA (bloco de conversão).
Siga rigidamente as instruções e use os dados do formulário sem inventar.

O DOCUMENTO QUE VOCÊ DEVE ENTREGAR DEVE SEGUIR EXATAMENTE ESTE FORMATO MARKDOWN:

# BLOCO 4 — CONSTRUÇÃO DO PRODUTO (~400-500 palavras)
Escreva em prosa fluida de VSL. Use a Opção 2 de estrutura:
- Transicione a partir do Último Ponto Lógico do usuário.
- Como o expert aplicou o método pela primeira vez.
- O resultado dramático e rápido que o expert teve.
- A cascata: como outras pessoas usaram o método e também tiveram resultados.
- A decisão de transformar isso em um método organizado + Revelação do Nome do Produto.

---

# BLOCO 5 — OFERTA (~1500-2000 palavras)
Escreva toda a copy em prosa detalhada de VSL com respiração e parágrafos curtos.
Siga os 17 beats de oferta:
1. Apresentação Direta do Produto (abre com "O [Nome] é..." — sem rodeios ou introdução).
2. Lista de benefícios em bullets.
3. Promessa conectada ao Mecanismo (o Apelido deve reaparecer aqui).
4. Para quem é (use as dores e desejos informados para qualificar quem deve entrar).
5. Explicação profunda do que recebe (descreva módulos e a transformação de cada um).
6. Depoimentos - coloque o placeholder [[ VÍDEOS DE DEPOIMENTOS AQUI ]] e cite depoimentos escritos se informados.
7. O que a pessoa recebe (detalhamento dos bônus com valor âncora individual).
8. Future pacing visual de transformação.
9. Ancoragem de Preço: comece com pergunta de valor de vida ("quanto vale...?") e ancore o valor em 5x o preço real.
10. Degrau da escada de desconto: baixe de 5x para 3x, apresente a justificativa do preço baixo (missão/custos) e revele o Preço Real à vista.
11. CTA #1 claro de compra.
12. Processo de compra prático e seguro (clicar no botão, preencher dados, liberação imediata).
13. Garantia Incondicional + CTA #2.
14. Escassez / Urgência real.
15. Stack Price: recap completo da soma dos itens (Produto + Bônus) pelo preço de âncora, comparado ao preço real final.
16. Encruzilhada: contraste dramático entre o futuro temido (continuar com as dores) e o futuro desejado (garantir a transformação).
17. Último CTA emocional.`;

        userPrompt = `FORMULÁRIO DE OFERTA PREENCHIDO:
- Nome do Produto: ${offerForm.nome}
- Promessa Principal: ${offerForm.promessa}
- Apelido do Mecanismo: ${offerForm.mecanismo}
- Preço Real à Vista: R$ ${offerForm.preco}
- Último Ponto Lógico: ${offerForm.ultimoPonto}
- Expert Aplicação Inicial: ${offerForm.expertAplicacao}
- Expert Resultado: ${offerForm.expertResultado}
- Cascata/Outros Casos: ${offerForm.depoimentos}
- Razão da Criação do Produto: ${offerForm.decisaoProduto}
- Módulos Internos: ${offerForm.modulos}
- Bônus e Âncoras: ${offerForm.bonus}
- Garantia: ${offerForm.garantia}
- Urgência Real: ${offerForm.urgencia}
- Dores Hoje: ${offerForm.doresHoje}
- Desejos Futuro: ${offerForm.desejosFuturo}`;
      }

      // Invoke openflow-ai Edge Function
      const { data, error } = await supabase.functions.invoke("openflow-ai", {
        body: {
          project_id: selectedProjectId || "manual",
          action: "generate_content",
          prompt: systemPrompt + "\n\n" + userPrompt,
          model: "google/gemini-3-flash-preview",
        },
      });

      if (error) throw error;
      const text = data?.result || data?.text || JSON.stringify(data);
      setResult(text);
      toast.success("Roteiro de VSL gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar roteiro.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    toast.success("Copiado para a área de transferência!");
  };

  const handleSaveToDocs = async () => {
    if (!result || !selectedProjectId) {
      toast.error("Gere um resultado e selecione um projeto primeiro.");
      return;
    }
    const toolTitle = VSL_TOOLS.find(t => t.id === activeTool)?.title || "Roteiro VSL";
    const { error } = await supabase.from("imphq_docs").insert({
      id: crypto.randomUUID(),
      project_id: selectedProjectId,
      title: `[VSL Lab] ${toolTitle} — ${new Date().toLocaleDateString("pt-BR")}`,
      content: result,
      body: result,
      cat: "vsl-roteiro",
      tags: [activeTool, "vsl-lab", "imersao-filemon"],
    });

    if (error) {
      toast.error("Erro ao salvar documento: " + error.message);
    } else {
      toast.success("Roteiro salvo com sucesso nos Documentos do Projeto!");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-amber-400">
            · Inteligência · Copiar & Persuadir
          </span>
          <div className="flex-1 h-px bg-gradient-to-r from-amber-500/40 via-amber-500/15 to-transparent" />
        </div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display italic text-3xl font-bold leading-none text-slate-100">
              VSL Copy <span className="text-amber-400">Lab</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 italic">
              Laboratório Avançado de VSL e Engenharia de Copywriting · Método E3 de Tiago Filemon
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-400 font-medium">Projeto Ativo:</Label>
            <Select value={selectedProjectId} onValueChange={handleProjectChange}>
              <SelectTrigger className="w-[200px] h-8 bg-slate-900 border-slate-800 text-slate-100 text-xs">
                <SelectValue placeholder="Selecione um projeto..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.icon || "📁"} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-xl">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <CardTitle className="text-base text-slate-100 font-bold flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-amber-400" />
                Módulos do Método E3
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Selecione um dos scripts estruturados para construir sua VSL por partes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {VSL_TOOLS.map(t => {
                  const Icon = t.icon;
                  const active = activeTool === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTool(t.id);
                        setResult("");
                      }}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-all ${
                        active 
                          ? "bg-amber-500/10 border border-amber-500/30 text-amber-400" 
                          : "border border-transparent text-slate-300 hover:bg-slate-800/40 hover:text-slate-100"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${active ? "text-amber-400" : "text-slate-400"}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{t.title}</p>
                        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-slate-800/80 bg-slate-900/40 backdrop-blur p-4 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <ShieldAlert className="h-4 w-4" />
              <span>Diretriz do Método E3</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              O VSL Lab opera sob os conceitos estruturais de Eugene Schwartz (Gradualização), Clayton Makepeace (Processo A-B-C), Evaldo Albuquerque (One Belief) e Max Peters (check-list NUUPPECC).
            </p>
            <p className="text-[10px] text-slate-500 italic">
              *Nota: A IA autocompleta e ajusta as variáveis do briefing do projeto selecionado para manter a comunicação 100% contextualizada.
            </p>
          </Card>
        </div>

        {/* Input & Output Panels */}
        <div className="lg:col-span-8 space-y-4">
          <Card className="border-slate-800 bg-slate-900/60 backdrop-blur shadow-xl">
            <CardHeader className="pb-3 border-b border-slate-800/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-slate-100 font-bold">
                  {VSL_TOOLS.find(t => t.id === activeTool)?.title}
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Insira as matérias-primas para a inteligência formular seu script.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5 font-mono text-[9px]">
                PROMPT #{VSL_TOOLS.find(t => t.id === activeTool)?.promptNum}
              </Badge>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              
              {/* Tool 1 Form */}
              {activeTool === "raio_x" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-300">Produto/Serviço *</Label>
                    <Input 
                      value={raioXForm.produto} 
                      onChange={e => setRaioXForm({ ...raioXForm, produto: e.target.value })}
                      placeholder="Nome do produto ou serviço"
                      className="bg-slate-950 border-slate-800 text-xs text-slate-100 focus:border-amber-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Nicho de Mercado</Label>
                      <Input 
                        value={raioXForm.nicho} 
                        onChange={e => setRaioXForm({ ...raioXForm, nicho: e.target.value })}
                        placeholder="Ex: Emagrecimento, Finanças"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Promessa Principal</Label>
                      <Input 
                        value={raioXForm.promessa} 
                        onChange={e => setRaioXForm({ ...raioXForm, promessa: e.target.value })}
                        placeholder="Ex: Eliminar 8kg em 21 dias"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tool 2 Form */}
              {activeTool === "mechanism_lab" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">1. Produto e Promessa Principal</Label>
                      <Textarea 
                        value={mechanismForm.produto} 
                        onChange={e => setMechanismForm({ ...mechanismForm, produto: e.target.value })}
                        placeholder="Qual o nome do produto e a promessa concreta que ele entrega?"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">2. Público e Desejo Emocional</Label>
                      <Textarea 
                        value={mechanismForm.publico} 
                        onChange={e => setMechanismForm({ ...mechanismForm, publico: e.target.value })}
                        placeholder="Quem é o público e qual o desejo emocional que eles não admitem em voz alta?"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">3. Diferenciação (Por Que Funciona?)</Label>
                      <Textarea 
                        value={mechanismForm.diferente} 
                        onChange={e => setMechanismForm({ ...mechanismForm, diferente: e.target.value })}
                        placeholder="Como o método é diferente de tudo o que existe no mercado? Por que ele funciona onde os outros falharam?"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">4. Engenharia do Método (Pilares/Etapas)</Label>
                      <Textarea 
                        value={mechanismForm.engenharia} 
                        onChange={e => setMechanismForm({ ...mechanismForm, engenharia: e.target.value })}
                        placeholder="Pilares, partes, passos, ingredientes ou a tecnologia por trás do seu método."
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tool 3 Form */}
              {activeTool === "logic_points" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-300">Mecanismo e One Belief (Mechanism Lab Output) *</Label>
                    <Textarea 
                      value={logicPointsForm.mechanismLabOutput} 
                      onChange={e => setLogicPointsForm({ ...logicPointsForm, mechanismLabOutput: e.target.value })}
                      placeholder="Cole o output entregue pelo Mechanism Lab ou defina: [Abordagem] é a chave para [Desejo] e só é possível através do [Mecanismo]."
                      className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[80px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Soluções Falhas enquadradas no mercado</Label>
                      <Textarea 
                        value={logicPointsForm.solucoesFalhas} 
                        onChange={e => setLogicPointsForm({ ...logicPointsForm, solucoesFalhas: e.target.value })}
                        placeholder="O que o público já tentou que falhou? (Ex: Dieta restritiva, cardio excessivo, remédios nocivos)"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[80px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Provas, Estudos ou Metáforas Disponíveis</Label>
                      <Textarea 
                        value={logicPointsForm.provas} 
                        onChange={e => setLogicPointsForm({ ...logicPointsForm, provas: e.target.value })}
                        placeholder="Estudos científicos, metáforas de fácil entendimento ou dados reais que provam sua tese."
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[80px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tool 4 Form */}
              {activeTool === "story_architect" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Tipo de Protagonista *</Label>
                      <Select 
                        value={storyForm.protagonista} 
                        onValueChange={v => setStoryForm({ ...storyForm, protagonista: v })}
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="expert">Expert da VSL (Story própria)</SelectItem>
                          <SelectItem value="cliente">Cliente / Aluno (Jornada externa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">One Belief (Do Mechanism Lab) *</Label>
                      <Input 
                        value={storyForm.mechanismOutput} 
                        onChange={e => setStoryForm({ ...storyForm, mechanismOutput: e.target.value })}
                        placeholder="Ex: Comer mais gordura boa é a chave para queimar gordura visceral..."
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-300">Fatos Reais da Jornada (Beats 2, 3 e 4) *</Label>
                    <Textarea 
                      value={storyForm.fatosBase} 
                      onChange={e => setStoryForm({ ...storyForm, fatosBase: e.target.value })}
                      placeholder="Relate os fatos reais: o sofrimento no início, o que tentou, qual foi o fundo do poço emocional e a virada."
                      className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[90px]"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Escada de Pontos Lógicos (Opcional)</Label>
                      <Input 
                        value={storyForm.logicPoints} 
                        onChange={e => setStoryForm({ ...storyForm, logicPoints: e.target.value })}
                        placeholder="Cole os pontos lógicos se já gerados"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Raio-X do Público (Opcional)</Label>
                      <Input 
                        value={storyForm.raioX} 
                        onChange={e => setStoryForm({ ...storyForm, raioX: e.target.value })}
                        placeholder="Cole o perfil do público se já gerado"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tool 5 Form */}
              {activeTool === "lead_creator" && (
                <div className="space-y-4">
                  {/* Premium E3 Lead Architect Visual Helper Card */}
                  <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3.5 space-y-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <Sparkles className="h-4 w-4 text-amber-400" />
                      <span>Lead Architect E3 — Método Tiago Filemon</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Este agente processará sua oferta utilizando a <strong className="text-amber-300">Lei 4 de Eugene Schwartz</strong> (<em>Desejo não pode ser criado, apenas canalizado</em>), estruturando os ganchos do seu público-alvo sob a tese do seu Mecanismo Único.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-slate-400 border-t border-slate-800/80 pt-2.5">
                      <div className="space-y-1">
                        <span className="font-bold text-amber-500/80 uppercase tracking-wider block">Checklist dos 9 Elementos da Lead:</span>
                        <ul className="list-decimal pl-4 space-y-0.5">
                          <li>Mencionar o problema agudo</li>
                          <li>Prometer solução rápida (tempo/dinheiro)</li>
                          <li>Spoiler instigante da história</li>
                          <li>Spoiler semântico do mecanismo/tese</li>
                          <li>Bullets magnéticos de curiosidade</li>
                        </ul>
                      </div>
                      <div className="space-y-1">
                        <span className="opacity-0 block">&nbsp;</span>
                        <ul className="list-decimal pl-4 space-y-0.5" start={6}>
                          <li>Tratamento da descrença do leitor</li>
                          <li>Qualificadores definidos (para quem é/não é)</li>
                          <li>Depoimentos focados no método/mecanismo</li>
                          <li>Elementos elegantes de credibilidade</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Ângulo do Esqueleto *</Label>
                      <Select 
                        value={leadForm.angulo} 
                        onValueChange={v => setLeadForm({ ...leadForm, angulo: v })}
                      >
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-100 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-100">
                          <SelectItem value="mecanismo">Mecanismo (Frase de descoberta + Tease contraintuitivo)</SelectItem>
                          <SelectItem value="problema_solucao">Problema-Solução (Guerra ao vilão + A culpa não é sua)</SelectItem>
                          <SelectItem value="segredo">Segredo (Obsessão secreta + Tease em 90s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Produto & Oferta *</Label>
                      <Input 
                        value={leadForm.oferta} 
                        onChange={e => setLeadForm({ ...leadForm, oferta: e.target.value })}
                        placeholder="Nome do produto"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Mecanismo (Apelido Recomendado) *</Label>
                      <Input 
                        value={leadForm.mecanismo} 
                        onChange={e => setLeadForm({ ...leadForm, mecanismo: e.target.value })}
                        placeholder="Apelido curto do mecanismo"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Tese / Promessa Principal *</Label>
                      <Input 
                        value={leadForm.tese} 
                        onChange={e => setLeadForm({ ...leadForm, tese: e.target.value })}
                        placeholder="Promessa final conectada ao One Belief"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Público-Alvo *</Label>
                      <Input 
                        value={leadForm.publico} 
                        onChange={e => setLeadForm({ ...leadForm, publico: e.target.value })}
                        placeholder="Ex: Mulheres de 40+ querendo emagrecer"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Gancho da História (Expert/Protagonista)</Label>
                      <Input 
                        value={leadForm.historia} 
                        onChange={e => setLeadForm({ ...leadForm, historia: e.target.value })}
                        placeholder="Breve resumo de como o expert resolveu a dor dele"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tool 6 Form */}
              {activeTool === "offer_builder" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Nome do Produto *</Label>
                      <Input 
                        value={offerForm.nome} 
                        onChange={e => setOfferForm({ ...offerForm, nome: e.target.value })}
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Apelido do Mecanismo *</Label>
                      <Input 
                        value={offerForm.mecanismo} 
                        onChange={e => setOfferForm({ ...offerForm, mecanismo: e.target.value })}
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Preço Real à Vista (R$) *</Label>
                      <Input 
                        value={offerForm.preco} 
                        onChange={e => setOfferForm({ ...offerForm, preco: e.target.value })}
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Promessa Principal *</Label>
                      <Input 
                        value={offerForm.promessa} 
                        onChange={e => setOfferForm({ ...offerForm, promessa: e.target.value })}
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Último Ponto Lógico da Tese *</Label>
                      <Input 
                        value={offerForm.ultimoPonto} 
                        onChange={e => setOfferForm({ ...offerForm, ultimoPonto: e.target.value })}
                        placeholder="Cole o último argumento antes do bloco de Construção começar"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Expert: Primeira Aplicação do Método</Label>
                      <Textarea 
                        value={offerForm.expertAplicacao} 
                        onChange={e => setOfferForm({ ...offerForm, expertAplicacao: e.target.value })}
                        placeholder="Como o expert aplicou o método pela primeira vez, em uma frase"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Expert: Resultados da Primeira Aplicação</Label>
                      <Textarea 
                        value={offerForm.expertResultado} 
                        onChange={e => setOfferForm({ ...offerForm, expertResultado: e.target.value })}
                        placeholder="Quais foram os resultados? O que mudou e em quanto tempo (números reais)?"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Cascata: Depoimentos/Resultados de Alunos</Label>
                      <Textarea 
                        value={offerForm.depoimentos} 
                        onChange={e => setOfferForm({ ...offerForm, depoimentos: e.target.value })}
                        placeholder="Liste 2 a 4 pessoas: nome + resultado em uma linha"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Por que o Expert decidiu criar o produto?</Label>
                      <Textarea 
                        value={offerForm.decisaoProduto} 
                        onChange={e => setOfferForm({ ...offerForm, decisaoProduto: e.target.value })}
                        placeholder="Por que decidiu transformar isso em produto em uma frase?"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Módulos Internos do Curso</Label>
                      <Textarea 
                        value={offerForm.modulos} 
                        onChange={e => setOfferForm({ ...offerForm, modulos: e.target.value })}
                        placeholder="Módulo 1: Nome + o que ensina em uma linha"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[70px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Super Bônus e Valores Âncoras</Label>
                      <Textarea 
                        value={offerForm.bonus} 
                        onChange={e => setOfferForm({ ...offerForm, bonus: e.target.value })}
                        placeholder="Bônus 1: Nome + o que entrega + valor âncora em reais"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[70px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Prazo de Garantia</Label>
                      <Input 
                        value={offerForm.garantia} 
                        onChange={e => setOfferForm({ ...offerForm, garantia: e.target.value })}
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs font-semibold text-slate-300">Urgência Real / Escassez</Label>
                      <Input 
                        value={offerForm.urgencia} 
                        onChange={e => setOfferForm({ ...offerForm, urgencia: e.target.value })}
                        placeholder="Motivo concreto para o leitor comprar hoje"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Cenários de Dor do Público (Hoje)</Label>
                      <Textarea 
                        value={offerForm.doresHoje} 
                        onChange={e => setOfferForm({ ...offerForm, doresHoje: e.target.value })}
                        placeholder="Liste 2 ou 3 situações de dor do dia a dia do público"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-300">Futuro Desejado pelo Público</Label>
                      <Textarea 
                        value={offerForm.desejosFuturo} 
                        onChange={e => setOfferForm({ ...offerForm, desejosFuturo: e.target.value })}
                        placeholder="Liste 2 ou 3 situações do futuro sonhado do público"
                        className="bg-slate-950 border-slate-800 text-xs text-slate-100 min-h-[60px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2 mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                {generating ? <Loader2 className="h-4 w-4 animate-spin text-slate-950" /> : <Sparkles className="h-4 w-4 text-slate-950" />}
                {generating ? "Processando Engenharia de Copy..." : "🚀 Gerar Roteiro Persuasivo com IA"}
              </Button>
            </CardContent>
          </Card>

          {/* Output Card */}
          {result && (
            <Card className="border-slate-800 bg-slate-900/40 backdrop-blur shadow-xl animate-fade-in">
              <CardHeader className="pb-2 border-b border-slate-800/60 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm text-slate-100 font-bold flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    Roteiro VSL Estruturado
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyToClipboard}
                    className="h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSaveToDocs}
                    className="h-8 text-xs border-slate-800 bg-slate-950 text-slate-300 hover:text-slate-100 gap-1.5"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Salvar em Docs
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[450px] rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-all">
                    {result}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
