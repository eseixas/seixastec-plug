import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  ShoppingBag,
  TrendingUp,
  Users,
  Package,
  AlertTriangle,
  BarChart3,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../../lib/api.js'
import { formatCurrency, formatNumber } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  PageHeader,
  StatCard,
  Card,
  Table,
  Thead,
  Th,
  Tbody,
  Td,
  Tr,
  Spinner,
  EmptyState,
} from '../../components/ui/index.js'

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="font-medium text-gray-700">{label}</div>
      <div className="text-indigo-600">{formatCurrency(payload[0].value)}</div>
    </div>
  )
}

export default function Dashboard() {
  const toast = useToast()

  const resumoQuery = useQuery({
    queryKey: ['dashboard', 'resumo'],
    queryFn: () => api.get('/dashboard/resumo'),
  })

  const topProdutosQuery = useQuery({
    queryKey: ['dashboard', 'top-produtos'],
    queryFn: () => api.get('/dashboard/top-produtos'),
  })

  useEffect(() => {
    if (resumoQuery.error) {
      toast.error(resumoQuery.error.message || 'Erro ao carregar o resumo do dashboard')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumoQuery.error])

  useEffect(() => {
    if (topProdutosQuery.error) {
      toast.error(topProdutosQuery.error.message || 'Erro ao carregar os produtos mais vendidos')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topProdutosQuery.error])

  const resumo = resumoQuery.data
  const serie = resumo?.serie || []
  const topProdutos = topProdutosQuery.data || []

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral da loja" />

      {resumoQuery.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Faturamento Hoje"
            value={formatCurrency(resumo?.faturamentoHoje)}
            icon={DollarSign}
            accent="indigo"
          />
          <StatCard
            label="Faturamento Mês"
            value={formatCurrency(resumo?.faturamentoMes)}
            icon={TrendingUp}
            accent="emerald"
          />
          <StatCard
            label="Vendas Hoje"
            value={formatNumber(resumo?.vendasHoje)}
            icon={ShoppingBag}
            accent="sky"
          />
          <StatCard
            label="Vendas Mês"
            value={formatNumber(resumo?.vendasMes)}
            icon={ShoppingBag}
            accent="sky"
          />
          <StatCard
            label="Ticket Médio"
            value={formatCurrency(resumo?.ticketMedioMes)}
            icon={DollarSign}
            accent="indigo"
          />
          <StatCard
            label="Clientes"
            value={formatNumber(resumo?.totalClientes)}
            icon={Users}
            accent="amber"
          />
          <StatCard
            label="Produtos"
            value={formatNumber(resumo?.totalProdutos)}
            icon={Package}
            accent="amber"
          />
          <StatCard
            label="Estoque Baixo"
            value={formatNumber(resumo?.estoqueBaixo)}
            icon={AlertTriangle}
            accent="red"
          />
        </div>
      )}

      <div className="mt-6">
        <Card title="Faturamento — últimos 14 dias">
          {resumoQuery.isLoading ? (
            <Spinner />
          ) : serie.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Sem dados de faturamento"
              description="Ainda não há vendas registradas nos últimos 14 dias."
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={serie} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="corFaturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(v)}
                  width={90}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fill="url(#corFaturamento)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card title="Top produtos do mês">
          {topProdutosQuery.isLoading ? (
            <Spinner />
          ) : topProdutos.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sem produtos vendidos"
              description="Nenhum produto vendido neste mês até o momento."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Produto</Th>
                  <Th>Quantidade</Th>
                  <Th>Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {topProdutos.map((p, i) => (
                  <Tr key={`${p.nome}-${i}`}>
                    <Td>{p.nome}</Td>
                    <Td>{formatNumber(p.qtd)}</Td>
                    <Td>{formatCurrency(p.total)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  )
}
