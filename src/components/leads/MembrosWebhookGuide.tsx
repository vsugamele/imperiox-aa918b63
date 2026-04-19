import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Webhook, Code2, FileCode, Tags, Activity, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_URL = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/membros-webhook";
const CAPTURE_URL = "https://tkbivipqiewkfnhktmqq.supabase.co/functions/v1/capture-lead";

interface Props {
  projectId?: string;
}

const EVENTOS = [
  { tipo: "membro_cadastrado", pontos: 15, status: "membro", descricao: "Cadastro gratuito na área de membros" },
  { tipo: "webinar_inscrito", pontos: 10, status: "webinar_inscrito", descricao: "Inscrição em webinar/aula ao vivo" },
  { tipo: "webinar_assistido", pontos: 25, status: "webinar_assistido", descricao: "Assistiu webinar (parcial ou total)" },
  { tipo: "prova_enviada", pontos: 20, status: "engajado", descricao: "Submeteu prova social, depoimento, foto" },
  { tipo: "pesquisa_respondida", pontos: 15, status: "qualificado", descricao: "Respondeu formulário de pesquisa" },
  { tipo: "aula_concluida", pontos: 5, status: "—", descricao: "Concluiu uma aula do curso" },
  { tipo: "login_membros", pontos: 2, status: "—", descricao: "Login na área de membros" },
  { tipo: "custom", pontos: 1, status: "—", descricao: "Evento customizado livre" },
];

function CopyBlock({ code, language = "json" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copiado!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-secondary/40 border border-border rounded-md p-4 text-[11px] leading-6 overflow-x-auto text-foreground/90 font-mono">
        <code>{code}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleCopy}
        className="absolute top-2 right-2 h-7 w-7 p-0 opacity-60 hover:opacity-100"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function MembrosWebhookGuide({ projectId = "SEU_PROJECT_ID" }: Props) {
  const payloadCadastro = `{
  "project_id": "${projectId}",
  "event_type": "membro_cadastrado",
  "email": "lead@email.com",
  "nome": "Nome Completo",
  "phone": "5511999998888",
  "origem": "area-membros",
  "tags": ["aluno-novo"],
  "utm_source": "instagram",
  "utm_campaign": "lancamento-out"
}`;

  const payloadWebinar = `{
  "project_id": "${projectId}",
  "event_type": "webinar_assistido",
  "email": "lead@email.com",
  "nome": "Nome Completo",
  "origem": "webinar-lancamento-X",
  "tags": ["webinar-out", "assistiu-100pct"],
  "metadata": {
    "tempo_assistido_min": 87,
    "assistiu_pitch": true,
    "webinar_id": "wb-2025-10"
  }
}`;

  const payloadPesquisa = `{
  "project_id": "${projectId}",
  "event_type": "pesquisa_respondida",
  "email": "lead@email.com",
  "nome": "Nome Completo",
  "form_id": "pesquisa-perfil-2025",
  "form_name": "Pesquisa de Perfil",
  "respostas": {
    "qual_seu_maior_desafio": "Não consigo escalar",
    "quanto_fatura_por_mes": "R$ 5k - R$ 10k",
    "ja_investiu_em_curso": "Sim"
  },
  "tags": ["pesquisa-respondeu"]
}`;

  const snippetJS = `// Cole no seu sistema (área de membros, webinar, etc)
async function enviarParaImperio(eventType, dadosLead, extras = {}) {
  try {
    await fetch("${WEBHOOK_URL}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: "${projectId}",
        event_type: eventType,
        email: dadosLead.email,
        nome: dadosLead.nome,
        phone: dadosLead.phone,
        origem: extras.origem || "area-membros",
        tags: extras.tags || [],
        metadata: extras.metadata || {},
        respostas: extras.respostas,
        utm_source: new URLSearchParams(location.search).get("utm_source"),
        utm_medium: new URLSearchParams(location.search).get("utm_medium"),
        utm_campaign: new URLSearchParams(location.search).get("utm_campaign"),
        page_url: location.href,
      }),
    });
  } catch (e) { console.error("Imperio HQ:", e); }
}

// Exemplo: ao cadastrar membro
enviarParaImperio("membro_cadastrado", {
  email: "lead@email.com",
  nome: "João Silva",
  phone: "5511999998888"
}, { tags: ["aluno-novo"] });

// Exemplo: ao assistir webinar
enviarParaImperio("webinar_assistido", { email, nome }, {
  origem: "webinar-lancamento-out",
  metadata: { tempo_assistido_min: 87 }
});`;

  const snippetHTML = `<!-- Cole antes de </body> nas suas páginas -->
<script>
(function() {
  window.ImperioHQ = {
    projectId: "${projectId}",
    track: function(eventType, dados, extras) {
      extras = extras || {};
      var qs = new URLSearchParams(location.search);
      fetch("${WEBHOOK_URL}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: this.projectId,
          event_type: eventType,
          email: dados.email,
          nome: dados.nome,
          phone: dados.phone,
          origem: extras.origem || "area-membros",
          tags: extras.tags || [],
          metadata: extras.metadata || {},
          respostas: extras.respostas,
          utm_source: qs.get("utm_source"),
          utm_medium: qs.get("utm_medium"),
          utm_campaign: qs.get("utm_campaign"),
          page_url: location.href,
        }),
      }).catch(function(e){ console.error("ImperioHQ:", e); });
    }
  };

  // Auto-captura: qualquer form com data-imperio-event
  document.addEventListener("submit", function(e) {
    var form = e.target;
    var evt = form.getAttribute("data-imperio-event");
    if (!evt) return;
    var fd = new FormData(form);
    var email = fd.get("email"), nome = fd.get("nome") || fd.get("name");
    if (!email) return;
    var respostas = {};
    fd.forEach(function(v,k){ respostas[k] = v; });
    window.ImperioHQ.track(evt, { email: email, nome: nome, phone: fd.get("phone") }, {
      origem: form.getAttribute("data-imperio-origem") || "form",
      tags: (form.getAttribute("data-imperio-tags") || "").split(",").filter(Boolean),
      respostas: respostas
    });
  });
})();
</script>

<!-- Exemplo de form auto-rastreado -->
<form data-imperio-event="pesquisa_respondida" data-imperio-origem="pesquisa-perfil" data-imperio-tags="pesquisa-out">
  <input name="nome" required />
  <input name="email" required />
  <input name="qual_seu_maior_desafio" />
  <button type="submit">Enviar</button>
</form>`;

  const exemploTags = `// Segregue origem com tags + UTMs:
{
  "tags": ["webinar-outubro", "ladder-1", "vip"],
  "origem": "webinar-lancamento-X",       // identificador único da fonte
  "utm_source": "instagram",
  "utm_medium": "stories",
  "utm_campaign": "lancamento-out-2025"
}

// O que vira no Imperio HQ:
// - Lead recebe tags: ["webinar-outubro", "ladder-1", "vip", "area-membros"]
// - data.ultima_origem = "webinar-lancamento-X"
// - imphq_events recebe registro com utm_source/medium/campaign
// - Aparece na Jornada do Cliente com a origem correta`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Webhook className="h-5 w-5 text-primary" />
          Integrações Externas — Receba tudo no Imperio HQ
        </CardTitle>
        <p className="text-sm text-muted-foreground leading-7">
          Conecte sua área de membros, sistema de webinar, landing externa ou qualquer ferramenta para enviar leads,
          eventos, respostas de pesquisa e tags direto pro CRM. Tudo dedup por e-mail, com pontuação automática.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="webhook" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="webhook" className="text-[11px]"><Webhook className="h-3 w-3 mr-1" />Webhook</TabsTrigger>
            <TabsTrigger value="js" className="text-[11px]"><Code2 className="h-3 w-3 mr-1" />API JS</TabsTrigger>
            <TabsTrigger value="snippet" className="text-[11px]"><FileCode className="h-3 w-3 mr-1" />Snippet</TabsTrigger>
            <TabsTrigger value="tags" className="text-[11px]"><Tags className="h-3 w-3 mr-1" />Tags & UTMs</TabsTrigger>
            <TabsTrigger value="eventos" className="text-[11px]"><Activity className="h-3 w-3 mr-1" />Eventos</TabsTrigger>
          </TabsList>

          <TabsContent value="webhook" className="space-y-4 mt-4">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Endpoint POST</p>
              <CopyBlock code={WEBHOOK_URL} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">📌 Cadastro de Membro</p>
              <CopyBlock code={payloadCadastro} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">🎥 Webinar Assistido</p>
              <CopyBlock code={payloadWebinar} />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">📋 Pesquisa Respondida</p>
              <CopyBlock code={payloadPesquisa} />
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-xs leading-6 text-foreground/80">
              <strong className="text-primary">⚡ Dedup automática:</strong> o sistema identifica o lead pelo e-mail.
              Se já existe, atualiza tags/dados e adiciona à timeline. Se é novo, cria o registro.
            </div>
          </TabsContent>

          <TabsContent value="js" className="space-y-4 mt-4">
            <p className="text-sm text-foreground/80 leading-7">
              Função pronta pra colar no seu backend (Node, área de membros custom, plugin WordPress, etc):
            </p>
            <CopyBlock code={snippetJS} language="javascript" />
          </TabsContent>

          <TabsContent value="snippet" className="space-y-4 mt-4">
            <p className="text-sm text-foreground/80 leading-7">
              Plug-and-play: cole antes do <code className="text-primary">{"</body>"}</code> e qualquer form com
              <code className="text-primary"> data-imperio-event</code> é capturado automaticamente.
            </p>
            <CopyBlock code={snippetHTML} language="html" />
          </TabsContent>

          <TabsContent value="tags" className="space-y-4 mt-4">
            <p className="text-sm text-foreground/80 leading-7">
              Use <strong>tags</strong> para segmentar e <strong>UTMs</strong> para rastrear a fonte. Tudo aparece
              na Jornada do Cliente e nos filtros de leads.
            </p>
            <CopyBlock code={exemploTags} />
            <div className="bg-secondary/30 border border-border rounded-md p-3 text-xs leading-7 text-foreground/80">
              <strong className="text-primary">💡 Boas práticas:</strong>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>origem</strong>: identificador único da fonte (ex: <code>webinar-out-2025</code>)</li>
                <li><strong>tags</strong>: características reaproveitáveis (ex: <code>aluno-vip</code>, <code>respondeu-pesquisa</code>)</li>
                <li><strong>UTMs</strong>: sempre que vier de campanha paga, repasse os UTMs da URL</li>
                <li><strong>metadata</strong>: dados livres específicos do evento (tempo assistido, score do quiz, etc)</li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="eventos" className="space-y-3 mt-4">
            <p className="text-sm text-foreground/80 leading-7">
              Cada evento recebe pontuação automática (Lead Scoring) e atualiza o status do lead:
            </p>
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-secondary/40">
                  <tr>
                    <th className="text-left p-2 font-bold text-muted-foreground">event_type</th>
                    <th className="text-left p-2 font-bold text-muted-foreground">+Pontos</th>
                    <th className="text-left p-2 font-bold text-muted-foreground">Novo Status</th>
                    <th className="text-left p-2 font-bold text-muted-foreground">Quando usar</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTOS.map((e) => (
                    <tr key={e.tipo} className="border-t border-border hover:bg-secondary/20">
                      <td className="p-2 font-mono text-primary">{e.tipo}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">+{e.pontos}</Badge></td>
                      <td className="p-2 text-foreground/80">{e.status}</td>
                      <td className="p-2 text-muted-foreground leading-6">{e.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-3 text-xs leading-6 text-foreground/80">
              <strong className="text-amber-400">⚠️ Captura simples (sem evento):</strong> Para landing pages básicas
              de captura, use o endpoint <code className="text-primary">capture-lead</code>:
              <code className="block mt-2 text-[10px] text-primary break-all">{CAPTURE_URL}</code>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
