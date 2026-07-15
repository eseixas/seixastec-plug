import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Scale } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency } from '../../lib/format.js'
import {
  Card,
  StatCard,
  Table,
  Thead,
  Th,
  Tbody,
  Td,
  Tr,
  PageHeader,
  EmptyState,
  Spinner,
} from '../../components/ui/index.js'

const GRUPO_LABELS = {
  RECEITA_OPERACIONAL: 'Receita Operacional',
  DEDUCAO_RECEITA: 'Dedução da Receita',
  CUSTO_OPERACIONAL: 'Custo Operacional',
  DESPESA_OPERACIONAL: 'Despesa Operacional',
  DESPESA_FINANCEIRA: 'Despesa Financeira',
  OUTRAS_RECEITAS: 'Outras Receitas',
  OUTRAS_DESPESAS: 'Outras Despesas',
}

const GRUPOS_ORDEM = Object.keys(GRUPO_LABELS)

function mesLabel(mes) {
  const [ano, mesNum] = mes.split('-')
  const meses = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ]
  const idx = Number(mesNum) - 1
  return `${meses[idx] ?? mesNum}/${ano}`
}

export default function Resultados() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['financeiro-resultados', { de, ate }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      const qs = params.toString()
      return api.get(`/financeiro/resultados${qs ? `?${qs}` : ''}`)
    },
  })

  const meses = data?.meses ?? []
  const grupos = data?.grupos ?? {}
  const totais = data?.totais ?? {}
  const gruposPresentes = GRUPOS_ORDEM.filter((g) => grupos[g])
  const ultimoMes = meses[meses.length - 1]
  const totalUltimoMes = ultimoMes ? totais[ultimoMes] : null

  return (
    <div>
      <PageHeader title="Resultados (DRE)" subtitle="Demonstrativo de resultados por período" />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">De</label>
          <input
            type="date"
            value={de}
            onChange={(e) => setDe(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Até</label>
          <input
            type="date"
            value={ate}
            onChange={(e) => setAte(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : meses.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="Nenhum resultado encontrado"
          description="Ajuste o período para ver os resultados."
        />
      ) : (
        <>
          {totalUltimoMes && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label={`Receitas (${mesLabel(ultimoMes)})`}
                value={formatCurrency(totalUltimoMes.receitas)}
                icon={TrendingUp}
                accent="emerald"
              />
              <StatCard
                label={`Despesas (${mesLabel(ultimoMes)})`}
                value={formatCurrency(totalUltimoMes.despesas)}
                icon={TrendingDown}
                accent="red"
              />
              <StatCard
                label={`Resultado (${mesLabel(ultimoMes)})`}
                value={formatCurrency(totalUltimoMes.resultado)}
                icon={Scale}
                accent={totalUltimoMes.resultado >= 0 ? 'emerald' : 'red'}
              />
            </div>
          )}

          <Card title="Demonstrativo de resultados">
            <Table>
              <Thead>
                <Tr>
                  <Th>Categoria</Th>
                  {meses.map((mes) => (
                    <Th key={mes} className="text-right">
                      {mesLabel(mes)}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {gruposPresentes.map((grupo) => (
                  <Tr key={grupo}>
                    <Td className="font-medium text-gray-900">{GRUPO_LABELS[grupo]}</Td>
                    {meses.map((mes) => (
                      <Td key={mes} className="text-right">
                        {formatCurrency(grupos[grupo]?.[mes] ?? 0)}
                      </Td>
                    ))}
                  </Tr>
                ))}
                <Tr>
                  <Td className="font-semibold text-gray-900">Resultado</Td>
                  {meses.map((mes) => (
                    <Td
                      key={mes}
                      className={`text-right font-semibold ${
                        (totais[mes]?.resultado ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(totais[mes]?.resultado ?? 0)}
                    </Td>
                  ))}
                </Tr>
              </Tbody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}
