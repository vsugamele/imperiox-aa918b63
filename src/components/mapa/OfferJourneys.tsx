import { useState } from "react";
import { readStageContract, readOfferReviewTasks, type OfferJourney, type OfferJourneyReading, type OfferJourneyStep } from "@shared/project-map";
import { KIND_PRESETS } from "@/components/funis/map-element-presets";
import { ImageLightbox } from "@/components/shared/ImageLightbox";

const LABEL = { registered: "Link cadastrado · conferir função", not_located: "Não localizado neste cadastro", to_verify: "Vínculo / configuração a conferir" };

const REVIEW_GROUPS = [
  { key: "conversion", label: "Venda e pagamento", explanation: "Conferir páginas, checkout e compra vinculados a esta oferta e campanha." },
  { key: "delivery", label: "Pós-compra e entrega", explanation: "Conferir o que se aplica ao produto. Obrigado, e-mail e acesso podem ocorrer em paralelo; grupo não é condição para entrega." },
  { key: "relationship", label: "Relacionamento e ascensão", explanation: "Decidir aplicabilidade e estratégia; não é requisito universal nem autorização de contato." },
  { key: "unclassified", label: "Etapas de conferência", explanation: "Leitura anterior sem agrupamento; etapas preservadas, sem inferir novos vínculos." },
] as const;

function OfferReview({ offer }: { offer: OfferJourney }) {
  const tasks = offer.reviewTasks ?? readOfferReviewTasks(offer);
  return <details className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-2" aria-label={`${offer.name}: Pendências de revisão`}>
    <summary className="cursor-pointer font-semibold">Revisão proposta · {tasks.length} etapas a conferir · abrir próximas ações</summary>
    <p className="text-muted-foreground">Motivo observado, próxima ação e fonte por etapa. Ordem de revisão; não é prioridade comercial, bloqueio confirmado ou autorização para executar.</p>
    {offer.paused && <p className="text-amber-300">Oferta pausada no cadastro. Esta revisão não retoma a operação.</p>}
    <ol className="grid sm:grid-cols-2 gap-2">{tasks.map(task => <li key={task.stageKey} className="rounded border bg-card p-2 space-y-1" aria-label={`Revisão de ${task.stageLabel}`}>
      <div className="flex flex-wrap items-center gap-2"><strong>{task.stageLabel}</strong><span className="text-[10px] text-amber-300">{task.category === "locate_link" ? "Vínculo a localizar" : "Conferência pendente"}</span></div>
      <p className="text-muted-foreground">{task.reason}</p>
      {task.applicability === "to_confirm" && <p className="text-muted-foreground">Confirmar aplicabilidade à oferta antes de propor construção ou rotina.</p>}
      <p><span className="font-semibold">Próxima ação: </span>{task.nextAction}</p>
      <p className="text-[10px] text-muted-foreground break-all">Fontes: {task.sources.join(" · ")}</p>
    </li>)}</ol>
  </details>;
}

function ProposedContract({ step }: { step: OfferJourneyStep }) {
  if (!step.guidance) return null;
  const contract = readStageContract({ id: step.key, label: step.label, description: step.guidance.description, notes: step.guidance.notes });
  return <details className="rounded border p-2" aria-label={`Contrato proposto de ${step.label}`}>
    <summary className="cursor-pointer text-primary">Contrato proposto · a conferir</summary>
    <p className="my-2 text-muted-foreground">Roteiro de revisão para humano e IA. Não é contrato cadastrado, atribuição de agente ou prova de execução.</p>
    <dl className="space-y-2">{contract.fields.map(field => <div key={field.key}><dt className="font-semibold">{field.label}</dt><dd className="text-muted-foreground whitespace-pre-wrap">{field.value ?? (field.key === "executor" || field.key === "skill" ? "Não vinculado nesta leitura; conferir o cadastro existente." : "A definir")}</dd></div>)}</dl>
  </details>;
}

function PageCapture({ imageUrl, label, onOpen }: { imageUrl?: string; label: string; onOpen: (url: string, label: string) => void }) {
  const image = imageUrl;
  const [failed, setFailed] = useState(false);
  return image && !failed ? <div className="space-y-1"><button type="button" className="block w-full" aria-label={`Ampliar print de ${label}`} onClick={() => onOpen(image, label)}><img src={image} alt={`Imagem de referência de ${label}`} className="h-36 w-full object-cover object-top rounded border" onError={() => setFailed(true)} /></button><p className="text-[10px] text-muted-foreground">Imagem cadastrada no mapa; data e autenticidade da captura a conferir · não comprova estado atual</p></div> : <p className="text-[11px] text-muted-foreground">Print real não disponível neste recorte.</p>;
}

export function OfferJourneys({ reading, compact = false }: { reading: OfferJourneyReading; compact?: boolean }) {
  const [capture, setCapture] = useState<{ url: string; label: string } | null>(null);
  return <section className="space-y-3 text-xs" aria-label="Jornadas das ofertas">
    <h3 className="text-base font-semibold">Revisão por oferta · percurso, entrega e operação</h3>
    <p className="text-muted-foreground">{reading.interpretation}</p>
    {!reading.offers.length && <p className="text-amber-300">Nenhuma oferta localizada no cadastro lido. Conferir a fonte antes de desenhar uma nova oferta.</p>}
    {reading.offers.map(offer => <details key={offer.key} className="rounded-xl border bg-card p-3">
      <summary className="cursor-pointer space-y-1"><strong>{offer.name}</strong><span className="ml-2 text-muted-foreground">{offer.price ? `Preço informado: ${offer.price} · moeda/condição a conferir` : "Preço não informado"}{offer.paused ? " · Pausada no cadastro" : ""}</span><span className="block text-[11px] text-amber-300">{offer.steps.length} etapas a conferir · vínculos, aplicabilidade e funcionamento · abrir revisão</span></summary>
      <p className="my-3 text-[10px] text-muted-foreground break-all">Fonte: {offer.source}. Referência à posição nesta leitura; não é ID permanente da oferta.</p>
      <OfferReview offer={offer} />
      {REVIEW_GROUPS.map(group => {
        const steps = offer.steps.filter(step => (step.guidance?.reviewGroup ?? "unclassified") === group.key);
        return steps.length ? <section key={group.key} className="mt-4 space-y-2" aria-label={`${offer.name}: ${group.label}`}><h4 className="text-sm font-semibold">{group.label} · grupo de conferência</h4><p className="text-muted-foreground">{group.explanation}</p><ol className={compact ? "grid sm:grid-cols-2 gap-3" : "grid sm:grid-cols-2 lg:grid-cols-3 gap-3"}>
        {steps.map(step => { const preset = KIND_PRESETS[step.kind], Icon = preset.icon;
          return <li key={step.key} className="rounded-lg border bg-secondary/20 p-3 space-y-2" aria-label={`${offer.name}: ${step.label}`}>
            <div className="flex items-center gap-2"><Icon size={19} style={{ color: preset.color }} /><strong>{step.label}</strong></div>
            <p className={step.registration === "registered" ? "text-cyan-300" : "text-amber-300"}>{LABEL[step.registration]}</p>
            {step.assets.map((asset, assetIndex) => <div key={`${asset.source}:${assetIndex}`} className="rounded border p-2 space-y-2"><a href={asset.url} target="_blank" rel="noopener noreferrer" className="block text-cyan-300 underline break-all">{asset.label || asset.url} ↗</a><p className="text-[10px] text-muted-foreground break-all">Fonte: {asset.source ?? offer.source}{asset.imageSource ? ` · Imagem: ${asset.imageSource}` : ""}</p><PageCapture key={asset.url} imageUrl={asset.imageUrl} label={`${offer.name} · ${step.label} · ${assetIndex + 1}`} onOpen={(url, label) => setCapture({ url, label })} /></div>)}
            {step.configuration === "not_checked" && <p className="text-muted-foreground">Configuração: não conferida neste recorte.</p>}
            <p className="text-muted-foreground">Funcionamento / resultado: não conferido neste recorte.</p>
            <details><summary className="cursor-pointer text-primary">Pendência e critério de comprovação</summary><p className="mt-2">{step.verification}</p></details>
            <ProposedContract step={step} />
          </li>;
        })}
      </ol></section> : null;
      })}
    </details>)}
    {!!reading.projectAssets.length && <details className="rounded-lg border p-3"><summary className="cursor-pointer font-semibold">Elementos do projeto · vínculo com cada oferta a confirmar ({reading.projectAssets.length})</summary><ul className="space-y-2 mt-3">{reading.projectAssets.map((asset, index) => <li key={index}>{asset.label || asset.kind} · {asset.url ? <a href={asset.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline break-all">{asset.url} ↗</a> : "URL não cadastrada"}</li>)}</ul><p className="mt-2 text-muted-foreground">Fonte: elementos vinculados ao projeto. Um elemento de obrigado ou membros aqui não resolve automaticamente a pendência de cada oferta.</p></details>}
    <ImageLightbox open={!!capture} url={capture?.url ?? ""} label={capture?.label} onClose={() => setCapture(null)} />
  </section>;
}
