import { Shield, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link to="/login">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Política de Privacidade</h1>
        </div>

        <p className="text-muted-foreground mb-8">
          Última atualização: {new Date().toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">1. Introdução</h2>
            <p>
              A <strong className="text-foreground">Imperio HQ</strong> ("nós", "nosso") opera a plataforma de gestão de marketing digital
              disponível em <strong className="text-foreground">imperiox.lovable.app</strong>. Esta política descreve como coletamos,
              usamos e protegemos suas informações pessoais, incluindo dados obtidos por meio de integrações com plataformas de terceiros
              como Meta (Facebook/Instagram).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">2. Dados que Coletamos</h2>
            <p className="mb-2">Coletamos os seguintes tipos de informações:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong className="text-foreground">Dados de conta:</strong> nome, email e credenciais de autenticação.</li>
              <li><strong className="text-foreground">Dados de anúncios (Meta Marketing API):</strong> métricas de campanhas (impressões, cliques, gastos, CTR, CPC, CPM), informações de criativos (imagens, textos de anúncios) e dados de contas de anúncios.</li>
              <li><strong className="text-foreground">Dados de conversão (Conversions API):</strong> eventos de conversão do lado do servidor como compras, leads e registros.</li>
              <li><strong className="text-foreground">Dados de leads:</strong> nome, email, telefone e origem de captação.</li>
              <li><strong className="text-foreground">Dados de uso:</strong> páginas visitadas e funcionalidades utilizadas dentro da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">3. Como Usamos os Dados</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Sincronizar métricas de campanhas publicitárias para dashboards internos.</li>
              <li>Gerar relatórios de performance e ROI de marketing.</li>
              <li>Otimizar campanhas com base em dados de conversão.</li>
              <li>Gerenciar leads e pipeline de vendas.</li>
              <li>Melhorar a experiência do usuário na plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">4. Compartilhamento de Dados</h2>
            <p>
              <strong className="text-foreground">Não vendemos, alugamos ou compartilhamos</strong> seus dados pessoais ou dados de
              anúncios com terceiros para fins de marketing. Os dados são utilizados exclusivamente dentro da plataforma Imperio HQ para
              os fins descritos acima. Podemos compartilhar dados apenas quando exigido por lei ou ordem judicial.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">5. Armazenamento e Segurança</h2>
            <p>
              Os dados são armazenados em servidores seguros fornecidos pela Supabase, com criptografia em trânsito (TLS) e em repouso.
              Tokens de acesso a APIs são armazenados de forma criptografada e nunca expostos publicamente. Implementamos controles de
              acesso baseados em autenticação para proteger seus dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">6. Retenção de Dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Dados de métricas de anúncios são retidos por até 24 meses para fins
              de análise histórica. Você pode solicitar a exclusão de seus dados a qualquer momento entrando em contato conosco.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">7. Seus Direitos</h2>
            <p className="mb-2">Em conformidade com a LGPD (Lei Geral de Proteção de Dados), você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Acessar seus dados pessoais armazenados.</li>
              <li>Solicitar a correção de dados incorretos.</li>
              <li>Solicitar a exclusão de seus dados.</li>
              <li>Revogar o consentimento de uso dos dados a qualquer momento.</li>
              <li>Solicitar a portabilidade dos seus dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">8. Exclusão de Dados</h2>
            <p>
              Para solicitar a exclusão de todos os seus dados, incluindo dados obtidos via integrações com o Facebook/Meta, entre em
              contato pelo email abaixo. Processaremos sua solicitação em até 30 dias úteis. Após a exclusão, os dados não poderão ser
              recuperados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">9. Integrações com Terceiros</h2>
            <p>
              Nossa plataforma integra-se com a <strong className="text-foreground">Meta Platform (Facebook/Instagram)</strong> por meio
              da Marketing API e Conversions API. Ao autorizar essas integrações, você concede acesso limitado aos dados de suas contas
              de anúncios conforme as permissões solicitadas (ads_read, ads_management). Você pode revogar esse acesso a qualquer momento
              nas configurações do Facebook em{" "}
              <a href="https://www.facebook.com/settings?tab=business_tools" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Configurações &gt; Apps e Sites
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">10. Alterações nesta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas por meio da plataforma ou por
              email. O uso continuado da plataforma após as alterações constitui aceitação da política atualizada.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">11. Contato</h2>
            <p>
              Para questões sobre privacidade, exclusão de dados ou exercício dos seus direitos, entre em contato:
            </p>
            <div className="mt-3 p-4 rounded-lg bg-muted/50 border border-border">
              <p><strong className="text-foreground">Imperio HQ</strong></p>
              <p>Email: <a href="mailto:contato@imperiohq.com" className="text-primary underline">contato@imperiohq.com</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Imperio HQ. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
};

export default Privacy;
