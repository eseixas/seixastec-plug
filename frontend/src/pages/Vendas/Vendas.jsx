import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Ban, ShoppingBag } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency, formatDateTime } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Input,
  Select,
  Modal,
  Table,
  Thead,
  Th,
  Tbody,
  Td,
  Tr,
  Badge,
  PageHeader,
  EmptyState,
  Spinner,
} from '../../components/ui/index.js'

function statusVariant(status) {
  return String(status || '').toUpperCase().includes('CANCEL') ? 'red' : 'green'
}

export default function Vendas() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [detailModalOpen, setDetailModalOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['vendas', { status, de, ate }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      const qs = params.toString()
      return api.get(`/vendas${qs ? `?${qs}` : ''}`)
    },
  })

  const { data: venda, isLoading: isLoadingVenda } = useQuery({
    queryKey: ['venda', selectedId],
    queryFn: () => api.get(`/vendas/${selectedId}`),
    enabled: !!selectedId && detailModalOpen,
  })

  const vendas = data ?? []

  function handleVer(id) {
    setSelectedId(id)
    setDetailModalOpen(true)
  }

  function handleCloseModal() {
    setDetailModalOpen(false)
    setSelectedId(null)
  }

  async function handleCancelar(v) {
    const confirmado = window.confirm(
      `Tem certeza que deseja cancelar a venda Nº ${v.numero}? O estoque será devolvido.`
    )
    if (!confirmado) return
    try {
      await api.post(`/vendas/${v.id}/cancelar`)
      toast.success('Venda cancelada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['vendas'] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao cancelar venda.')
    }
  }

  function renderVariacao(item) {
    const tamanho = item.variacao?.tamanho
    const cor = item.variacao?.cor
    if (!tamanho && !cor) return '-'
    return `${tamanho ?? ''}${tamanho && cor ? ' - ' : ''}${cor ?? ''}`
  }

  return (
    <div>
      <PageHeader title="Vendas" subtitle="Histórico de vendas realizadas" />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          containerClassName="w-full sm:w-56"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="CONCLUIDA">Concluída</option>
          <option value="CANCELADA">Cancelada</option>
        </Select>
        <Input
          containerClassName="w-full sm:w-48"
          label="Data inicial"
          type="date"
          value={de}
          onChange={(e) => setDe(e.target.value)}
        />
        <Input
          containerClassName="w-full sm:w-48"
          label="Data final"
          type="date"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : vendas.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma venda encontrada"
          description="Ajuste os filtros para ver outras vendas."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Número</Th>
              <Th>Data</Th>
              <Th>Cliente</Th>
              <Th>Vendedor</Th>
              <Th>Itens</Th>
              <Th>Total</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {vendas.map((v) => (
              <Tr key={v.id}>
                <Td className="font-medium text-gray-900">
                  Nº {v.numero}
                  {v.loja?.nome && <span className="ml-1 font-normal text-gray-500">· {v.loja.nome}</span>}
                </Td>
                <Td>{formatDateTime(v.createdAt)}</Td>
                <Td>{v.cliente?.nome || 'Consumidor final'}</Td>
                <Td>{v.usuario?.nome}</Td>
                <Td>{v._count?.itens ?? '-'}</Td>
                <Td>{formatCurrency(v.total)}</Td>
                <Td>
                  <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Eye}
                      onClick={() => handleVer(v.id)}
                      aria-label="Ver venda"
                    />
                    {!String(v.status || '').toUpperCase().includes('CANCEL') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Ban}
                        onClick={() => handleCancelar(v)}
                        aria-label="Cancelar venda"
                        className="text-red-600 hover:bg-red-50"
                      />
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal open={detailModalOpen} onClose={handleCloseModal} title="Detalhes da venda" size="lg">
        {isLoadingVenda || !venda ? (
          <Spinner />
        ) : (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <p className="font-medium text-gray-900">Nº {venda.numero}</p>
                <p className="text-gray-500">{formatDateTime(venda.createdAt)}</p>
                <p className="text-gray-500">Cliente: {venda.cliente?.nome || 'Consumidor final'}</p>
                <p className="text-gray-500">Vendedor: {venda.usuario?.nome}</p>
              </div>
              <Badge variant={statusVariant(venda.status)}>{venda.status}</Badge>
            </div>

            <Table>
              <Thead>
                <Tr>
                  <Th>Produto</Th>
                  <Th>Variação</Th>
                  <Th>Qtd</Th>
                  <Th>Preço Unit.</Th>
                  <Th>Desconto</Th>
                  <Th>Total</Th>
                </Tr>
              </Thead>
              <Tbody>
                {(venda.itens || []).map((item, idx) => (
                  <Tr key={idx}>
                    <Td>{item.variacao?.produto?.nome || item.variacao?.nome || '-'}</Td>
                    <Td>{renderVariacao(item)}</Td>
                    <Td>{item.quantidade}</Td>
                    <Td>{formatCurrency(item.precoUnit)}</Td>
                    <Td>{formatCurrency(item.desconto)}</Td>
                    <Td>{formatCurrency(item.total)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-gray-900">Pagamentos</p>
              <div className="space-y-1 text-sm text-gray-500">
                {(venda.pagamentos || []).map((p, idx) => (
                  <div key={idx}>
                    {p.forma} - {formatCurrency(p.valor)}
                    {p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 text-right text-base font-bold text-gray-900">
              Total: {formatCurrency(venda.total)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
