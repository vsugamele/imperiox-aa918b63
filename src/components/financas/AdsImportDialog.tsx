import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import Papa from "papaparse";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: { id: string; name: string }[];
  onImported: () => void;
}

interface AdsRow {
  campanha: string;
  conjunto_anuncios: string;
  anuncio: string;
  data_ref: string;
  valor: number;
  impressoes: number;
  alcance: number;
  cliques: number;
  leads: number;
  resultados: number;
  custo_por_resultado: number;
  compras: number;
  custo_por_compra: number;
  hook_rate: number;
  hold_rate: number;
  ctr: number;
  frequencia: number;
  nivel_veiculacao: string;
  checkouts_iniciados: number;
  cpm: number;
  stop_rate: number;
  cpck: number;
}

/** Parse BRL currency strings like "1.234,56" or "R$ 1.234,56" to number */
function parseBRL(val: string | undefined | null): number {
  if (!val) return 0;
  const cleaned = val
    .replace(/R\$\s?/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")    // remove thousands separator
    .replace(",", ".");     // decimal comma -> dot
  return parseFloat(cleaned) || 0;
}

/** Parse percentage strings like "12,34%" to number */
function parsePercent(val: string | undefined | null): number {
  if (!val) return 0;
  const cleaned = val.replace(/%/g, "").replace(",", ".").trim();
  return parseFloat(cleaned) || 0;
}

/** Parse integer with thousands separator */
function parseIntBR(val: string | undefined | null): number {
  if (!val) return 0;
  const cleaned = val.replace(/\./g, "").replace(",", ".").trim();
  return parseInt(cleaned) || 0;
}

/** Get value from row with multiple possible keys */
function get(row: any, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return String(row[k]);
  }
  return "";
}

export function AdsImportDialog({ open, onOpenChange, projects, onImported }: Props) {
  const [projectId, setProjectId] = useState("");
  const [plataforma, setPlataforma] = useState("Facebook");
  const [rows, setRows] = useState<AdsRow[]>([]);
  const [importing, setImporting] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: AdsRow[] = result.data.map((r: any) => {
          const impressoes = parseIntBR(get(r, "Impressões", "Impressoes", "impressoes", "impressions", "Impressions"));
          const alcance = parseIntBR(get(r, "Alcance", "alcance", "Reach"));
          const valor = parseBRL(get(r, "Valor usado (BRL)", "valor", "spend", "Amount spent (BRL)", "Spend"));
          const checkouts = parseIntBR(get(r, "Finalizações de compra iniciadas", "Finalizacoes de compra iniciadas", "Checkouts", "Purchases initiated", "checkouts_iniciados"));
          const calculatedCpm = impressoes > 0 ? (valor / impressoes) * 1000 : 0;
          const calculatedStopRate = impressoes > 0 ? (alcance / impressoes) * 100 : 0;
          const calculatedCpck = checkouts > 0 ? valor / checkouts : 0;

          return {
            campanha: get(r, "Nome da campanha", "campanha", "campaign_name", "Campaign name", "Campaign"),
            conjunto_anuncios: get(r, "Nome do conjunto de anúncios", "Nome do conjunto de anuncios", "conjunto_anuncios", "Ad set name"),
            anuncio: get(r, "Anúncios", "Anuncios", "anuncio", "Ad name"),
            data_ref: get(r, "Início dos relatórios", "Inicio dos relatorios", "Início", "Inicio", "data", "date", "data_ref", "Day"),
            valor,
            impressoes,
            alcance,
            cliques: parseIntBR(get(r, "Cliques no link", "cliques", "clicks", "Link clicks", "Clicks")),
            leads: parseIntBR(get(r, "Resultados", "leads", "Leads", "results", "Results")),
            resultados: parseIntBR(get(r, "Resultados", "resultados", "Results")),
            custo_por_resultado: parseBRL(get(r, "Custo por resultado", "custo_por_resultado", "Cost per result")),
            compras: parseIntBR(get(r, "Compras", "compras", "Purchases")),
            custo_por_compra: parseBRL(get(r, "Custo por compra", "custo_por_compra", "Cost per purchase")),
            hook_rate: parsePercent(get(r, "Hook Rate", "hook_rate")),
            hold_rate: parsePercent(get(r, "Hold Rate", "hold_rate")),
            ctr: parsePercent(get(r, "CTR único (taxa de cliques no link)", "CTR", "ctr")),
            frequencia: parsePercent(get(r, "Frequência", "Frequencia", "frequencia", "Frequency")),
            nivel_veiculacao: get(r, "Nível de veiculação", "Nivel de veiculacao", "Level", "nivel_veiculacao") || "ad",
            checkouts_iniciados: checkouts,
            cpm: calculatedCpm,
            stop_rate: calculatedStopRate,
            cpck: calculatedCpck,
          };
        });
        const valid = parsed.filter(r => r.data_ref && r.valor > 0);
        setRows(valid);
        toast.success(`${valid.length} linhas válidas de ${parsed.length} carregadas`);
      },
    });
  };

  const save = async () => {
    if (!projectId) { toast.error("Selecione um projeto"); return; }
    if (rows.length === 0) { toast.error("Nenhum dado para importar"); return; }
    setImporting(true);
    const payload = rows.map(r => ({
      project_id: projectId,
      plataforma,
      campanha: r.campanha,
      conjunto_anuncios: r.conjunto_anuncios,
      anuncio: r.anuncio,
      data_ref: r.data_ref,
      valor: r.valor,
      impressoes: r.impressoes,
      alcance: r.alcance,
      cliques: r.cliques,
      leads: r.leads,
      resultados: r.resultados,
      custo_por_resultado: r.custo_por_resultado,
      compras: r.compras,
      custo_por_compra: r.custo_por_compra,
      hook_rate: r.hook_rate,
      hold_rate: r.hold_rate,
      ctr: r.ctr,
      frequencia: r.frequencia,
    }));
    const { error } = await supabase.from("imphq_ads_spend").insert(payload as any);
    setImporting(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success(`${rows.length} registros importados!`);
    setRows([]);
    onImported();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>📊 Importar Gastos de Ads (CSV)</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Projeto</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plataforma</Label>
              <Select value={plataforma} onValueChange={setPlataforma}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Facebook">Facebook Ads</SelectItem>
                  <SelectItem value="Google">Google Ads</SelectItem>
                  <SelectItem value="TikTok">TikTok Ads</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Arquivo CSV</Label>
            <Input type="file" accept=".csv" onChange={handleFile} />
            <p className="text-xs text-muted-foreground mt-1">Aceita relatórios do Facebook Ads em PT-BR (colunas: Nome da campanha, Valor usado, Impressões, Alcance, CTR, Hook Rate, Compras...)</p>
          </div>
          {rows.length > 0 && (
            <div className="rounded-lg border border-border overflow-hidden max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Impr.</TableHead>
                    <TableHead>Alcance</TableHead>
                    <TableHead>Cliques</TableHead>
                    <TableHead>Compras</TableHead>
                    <TableHead>CTR</TableHead>
                    <TableHead>Hook</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 20).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs max-w-[150px] truncate">{r.campanha || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.data_ref}</TableCell>
                      <TableCell className="text-xs font-mono">R$ {r.valor.toFixed(2)}</TableCell>
                      <TableCell className="text-xs font-mono">{r.impressoes.toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-mono">{r.alcance.toLocaleString()}</TableCell>
                      <TableCell className="text-xs font-mono">{r.cliques}</TableCell>
                      <TableCell className="text-xs font-mono">{r.compras}</TableCell>
                      <TableCell className="text-xs font-mono">{r.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-xs font-mono">{r.hook_rate.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 20 && <p className="text-xs text-muted-foreground p-2 text-center">...e mais {rows.length - 20} linhas</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={importing || rows.length === 0}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
            Importar {rows.length} registros
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
