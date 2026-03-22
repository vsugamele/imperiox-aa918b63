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
  data_ref: string;
  valor: number;
  impressoes: number;
  cliques: number;
  leads: number;
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
        const parsed: AdsRow[] = result.data.map((r: any) => ({
          campanha: r.campanha || r.campaign_name || r["Campaign name"] || r.Campaign || "",
          data_ref: r.data || r.date || r.data_ref || r.Day || "",
          valor: parseFloat(r.valor || r.spend || r["Amount spent (BRL)"] || r.Spend || "0") || 0,
          impressoes: parseInt(r.impressoes || r.impressions || r.Impressions || "0") || 0,
          cliques: parseInt(r.cliques || r.clicks || r["Link clicks"] || r.Clicks || "0") || 0,
          leads: parseInt(r.leads || r.Leads || r.results || r.Results || "0") || 0,
        }));
        setRows(parsed.filter(r => r.data_ref && r.valor > 0));
        toast.success(`${parsed.length} linhas carregadas`);
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
      data_ref: r.data_ref,
      valor: r.valor,
      impressoes: r.impressoes,
      cliques: r.cliques,
      leads: r.leads,
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
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
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
            <p className="text-xs text-muted-foreground mt-1">Colunas aceitas: campanha, data, valor, impressoes, cliques, leads</p>
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
                    <TableHead>Cliques</TableHead>
                    <TableHead>Leads</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 20).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.campanha || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.data_ref}</TableCell>
                      <TableCell className="text-xs font-mono">R$ {r.valor.toFixed(2)}</TableCell>
                      <TableCell className="text-xs font-mono">{r.impressoes}</TableCell>
                      <TableCell className="text-xs font-mono">{r.cliques}</TableCell>
                      <TableCell className="text-xs font-mono">{r.leads}</TableCell>
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
