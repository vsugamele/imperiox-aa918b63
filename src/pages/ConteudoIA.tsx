import { ContentGenerator } from "@/components/dashboard/ContentGenerator";

export default function ConteudoIA() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">⚡ Gerador de Conteúdo IA</h1>
        <p className="text-sm text-muted-foreground mt-1">Gere copies, roteiros, sequências e mais com IA contextualizada</p>
      </div>
      <ContentGenerator />
    </div>
  );
}
