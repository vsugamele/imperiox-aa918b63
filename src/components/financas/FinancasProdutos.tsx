import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Venda {
  id: string;
  produto_nome: string;
  valor: number;
  data_venda: string;
}

interface Revenue {
  id: string;
  descricao: string;
  valor: number;
  produto_nome?: string | null;
}

interface Cost {
  id: string;
  nome: string;
  valor: number;
  produto_nome?: string | null;
}

interface AdsSpend {
  id: string;
  valor: number;
  campanha?: string | null;
}

interface Props {
  vendas: Venda[];
  briefingProdutos?: any[];
  revenues?: Revenue[];
  costs?: Cost[];
  ads?: AdsSpend[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(280 67% 51%)",
];

export function FinancasProdutos({ vendas, briefingProdutos = [], revenues = [], costs = [] }: Props) {
  // Build unified product map from briefing + vendas + revenues
  const productMap = new Map<string, { qtd: number; receita: number; receitaManual: number; custos: number; preco?: string; tipo?: string }>();

  // Seed from briefing products
  briefingProdutos.forEach(p => {
    if (p.nome) {
      productMap.set(p.nome, { qtd: 0, receita: 0, receitaManual: 0, custos: 0, preco: p.preco, tipo: p.tipo });
    }
  });

  // Add vendas
  vendas.forEach(v => {
    const name = v.produto_nome || "Sem produto";
    const cur = productMap.get(name) || { qtd: 0, receita: 0, receitaManual: 0, custos: 0 };
    cur.qtd += 1;
    cur.receita += v.valor;
    productMap.set(name, cur);
  });

  // Add manual revenues
  revenues.forEach(r => {
    if (r.produto_nome) {
      const cur = productMap.get(r.produto_nome) || { qtd: 0, receita: 0, receitaManual: 0, custos: 0 };
      cur.receitaManual += r.valor;
      productMap.set(r.produto_nome, cur);
    }
  });

  // Add costs
  costs.forEach(c => {
    if (c.produto_nome) {
      const cur = productMap.get(c.produto_nome) || { qtd: 0, receita: 0, receitaManual: 0, custos: 0 };
      cur.custos += c.valor;
      productMap.set(c.produto_nome, cur);
    }
  });

  const products = Array.from(productMap.entries())
    .map(([nome, data]) => ({
      nome,
      qtd: data.qtd,
      receita: data.receita + data.receitaManual,
      receitaVendas: data.receita,
      receitaManual: data.receitaManual,
      custos: data.custos,
      lucro: (data.receita + data.receitaManual) - data.custos,
      ticket: data.qtd > 0 ? data.receita / data.qtd : 0,
      preco: data.preco,
      tipo: data.tipo,
    }))
    .sort((a, b) => b.receita - a.receita);

  const totalReceita = products.reduce((a, p) => a + p.receita, 0);
  const totalVendas = products.reduce((a, p) => a + p.qtd, 0);
  const totalCustos = products.reduce((a, p) => a + p.custos, 0);

  const chartData = products.slice(0, 8).map(p => ({
    name: p.nome.length > 20 ? p.nome.slice(0, 20) + "…" : p.nome,
    Receita: p.receita,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Produtos</p>
            <p className="text-2xl font-mono font-bold text-foreground">{products.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Vendas</p>
            <p className="text-2xl font-mono font-bold text-foreground">{totalVendas}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="text-2xl font-mono font-bold text-emerald-400">R$ {totalReceita.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Lucro (Receita - Custos)</p>
            <p className={`text-2xl font-mono font-bold ${(totalReceita - totalCustos) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              R$ {(totalReceita - totalCustos).toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-border">
          <CardContent className="pt-6">
            <h3 className="text-sm font-semibold text-muted-foreground mb-4">Receita por Produto</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                <Bar dataKey="Receita" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Custos</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead className="text-right">Ticket Médio</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p, i) => (
              <TableRow key={p.nome}>
                <TableCell className="font-mono text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                <TableCell>{p.tipo && <Badge variant="secondary" className="text-[10px]">{p.tipo}</Badge>}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-sm">{p.preco ? `R$ ${p.preco}` : "—"}</TableCell>
                <TableCell className="text-right font-mono">{p.qtd}</TableCell>
                <TableCell className="text-right font-mono text-emerald-400">R$ {p.receita.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-red-400">{p.custos > 0 ? `R$ ${p.custos.toFixed(2)}` : "—"}</TableCell>
                <TableCell className={`text-right font-mono ${p.lucro >= 0 ? "text-emerald-400" : "text-red-400"}`}>R$ {p.lucro.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">R$ {p.ticket.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {totalReceita > 0 ? ((p.receita / totalReceita) * 100).toFixed(1) : 0}%
                </TableCell>
              </TableRow>
            ))}
            {products.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum produto cadastrado ou venda registrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
