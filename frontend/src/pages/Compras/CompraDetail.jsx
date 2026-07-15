import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, Trash2, Printer } from 'lucide-react'
import { api } from '../../lib/api.js'
import { downloadBlob } from '../../lib/download.js'
import { formatCurrency, formatDate } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Card,
  Modal,
  Table,
  Thead,
  Th,
  Tbody,
  Td,
  Tr,
  Badge,
  PageHeader,
  Spinner,
} from '../../components/ui/index.js'

const STATUS_BADGE = {
  ABERTA: { variant: 'gray', label: 'Aberta' },
  PARCIAL: { variant: 'amber', label: 'Parcial' },
  RECEBIDA: { variant: 'green', label: 'Recebida' },
  CANCELADA: { variant: 'red', label: 'Cancelada' },
}

const ITEM_STATUS_BADGE = {
  AGUARDANDO: { variant: 'gray', label: 'Aguardando' },
  ENTREGUE: { variant: 'green', label: 'Entregue' },
  CANCELADO: { variant: 'red', label: 'Cancelado' },
  EXTRAVIADO: { variant: 'amber', label: 'Extraviado' },
}

export default function CompraDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [etiquetasModalAberto, setEtiquetasModalAberto] = useState(false)
  const [gerandoEtiquetas, setGerandoEtiquetas] = useState(false)

  const { data: compra, isLoading } = useQuery({
    queryKey: ['compras', id],
    queryFn: () => api.get(`/compras/${id}`),
  })

  const statusMutation = useMutation({
    mutationFn: ({ itemId, status }) => api.post(`/compras/${id}/itens/${itemId}/status`, { status }),
    onSuccess: () => {
      toast.success('Status do item atualizado.')
      queryClient.invalidateQueries({ queryKey: ['compras', id] })
      queryClient.invalidateQueries({ queryKey: ['compras'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao atualizar status do item.')
    },
  })

  async function handleDelete() {
    if (!compra) return
    const confirmado = window.confirm(`Excluir a compra #${compra.numero}? Esta ação não pode ser desfeita.`)
    if (!confirmado) return
    try {
      await api.delete(`/compras/${id}`)
      toast.success('Compra excluída com sucesso.')
      navigate('/compras')
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir compra.')
    }
  }

  async function gerarEtiquetas(formato) {
    if (!compra) return
    const itens = (compra.itens || [])
      .filter((i) => i.status === 'ENTREGUE')
      .map((i) => ({ variacaoId: i.variacaoId, quantidade: i.quantidade }))
    if (itens.length === 0) {
      toast.error('Nenhum item entregue para gerar etiquetas.')
      return
    }
    setGerandoEtiquetas(true)
    try {
      const blob = await api.postBlob('/etiquetas/pdf', { itens, formato })
      downloadBlob(blob, 'etiquetas.pdf')
      setEtiquetasModalAberto(false)
      toast.success('PDF de etiquetas gerado.')
    } catch (err) {
      toast.error(err?.message || 'Erro ao gerar etiquetas.')
    } finally {
      setGerandoEtiquetas(false)
    }
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Compra" />
        <Spinner />
      </div>
    )
  }

  if (!compra) {
    return (
      <div>
        <PageHeader title="Compra" />
        <p className="text-sm text-gray-500">Compra não encontrada.</p>
      </div>
    )
  }

  const badge = STATUS_BADGE[compra.status] || { variant: 'gray', label: compra.status }
  const temEntregues = (compra.itens || []).some((i) => i.status === 'ENTREGUE')
  const podeExcluir = !temEntregues

  return (
    <div>
      <PageHeader
        title={`Compra #${compra.numero}`}
        subtitle={compra.fornecedor?.nome}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/compras')}>
              Voltar
            </Button>
            {temEntregues && (
              <Button variant="secondary" icon={Printer} onClick={() => setEtiquetasModalAberto(true)}>
                Imprimir etiquetas dos itens entregues
              </Button>
            )}
            {podeExcluir && (
              <Button variant="danger" icon={Trash2} onClick={handleDelete}>
                Excluir compra
              </Button>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        <Card title="Dados da compra">
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Fornecedor" value={compra.fornecedor?.nome || '-'} />
            <Info label="Data da compra" value={formatDate(compra.dataCompra)} />
            <Info
              label="Nota fiscal"
              value={compra.numeroNota ? `${compra.numeroNota}${compra.serie ? ` / série ${compra.serie}` : ''}` : '-'}
            />
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Status</div>
              <div className="mt-1">
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
            </div>
            {compra.anexoUrl && (
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Anexo</div>
                <a
                  href={compra.anexoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline"
                >
                  Abrir anexo <ExternalLink size={14} />
                </a>
              </div>
            )}
            {compra.observacoes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400">Observações</div>
                <p className="mt-1 text-gray-700">{compra.observacoes}</p>
              </div>
            )}
          </div>
        </Card>

        <Card title="Itens">
          <Table>
            <Thead>
              <Tr>
                <Th>Produto / Variação</Th>
                <Th>Loja</Th>
                <Th>Quantidade</Th>
                <Th>Custo Unit.</Th>
                <Th>Valor de Venda</Th>
                <Th>Previsão Chegada</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(compra.itens || []).map((item) => {
                const itemBadge = ITEM_STATUS_BADGE[item.status] || { variant: 'gray', label: item.status }
                const varLabel = [item.variacao?.tamanho, item.variacao?.cor].filter(Boolean).join(' / ')
                return (
                  <Tr key={item.id}>
                    <Td>
                      <div className="font-medium text-gray-900">{item.variacao?.produto?.nome || '-'}</div>
                      {varLabel && <div className="text-xs text-gray-500">{varLabel}</div>}
                    </Td>
                    <Td>{item.loja?.nome || '-'}</Td>
                    <Td>{item.quantidade}</Td>
                    <Td>{formatCurrency(item.custoUnitario)}</Td>
                    <Td>{item.valorVenda != null ? formatCurrency(item.valorVenda) : '-'}</Td>
                    <Td>{item.previsaoChegada ? formatDate(item.previsaoChegada) : '-'}</Td>
                    <Td>
                      <Badge variant={itemBadge.variant}>{itemBadge.label}</Badge>
                    </Td>
                    <Td>
                      {item.status === 'AGUARDANDO' ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={CheckCircle2}
                            loading={statusMutation.isPending && statusMutation.variables?.itemId === item.id}
                            onClick={() => statusMutation.mutate({ itemId: item.id, status: 'ENTREGUE' })}
                            className="text-emerald-600 hover:bg-emerald-50"
                          >
                            Marcar Entregue
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={AlertTriangle}
                            loading={statusMutation.isPending && statusMutation.variables?.itemId === item.id}
                            onClick={() => statusMutation.mutate({ itemId: item.id, status: 'EXTRAVIADO' })}
                            className="text-amber-600 hover:bg-amber-50"
                          >
                            Extraviado
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={XCircle}
                            loading={statusMutation.isPending && statusMutation.variables?.itemId === item.id}
                            onClick={() => statusMutation.mutate({ itemId: item.id, status: 'CANCELADO' })}
                            className="text-red-600 hover:bg-red-50"
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : null}
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </Card>

        <Card title="Parcelas">
          {(compra.contasPagar || []).length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma parcela vinculada a esta compra.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Descrição</Th>
                  <Th>Valor</Th>
                  <Th>Vencimento</Th>
                  <Th>Status</Th>
                </Tr>
              </Thead>
              <Tbody>
                {compra.contasPagar.map((cp) => (
                  <Tr key={cp.id}>
                    <Td>
                      <Link
                        to={`/financeiro/contas-pagar/${cp.id}`}
                        className="font-medium text-indigo-600 hover:underline"
                      >
                        {cp.descricao}
                      </Link>
                    </Td>
                    <Td>{formatCurrency(cp.valor)}</Td>
                    <Td>{formatDate(cp.vencimento)}</Td>
                    <Td>
                      {cp.pago ? <Badge variant="green">Pago</Badge> : <Badge variant="amber">Pendente</Badge>}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      </div>

      <Modal
        open={etiquetasModalAberto}
        onClose={() => setEtiquetasModalAberto(false)}
        title="Imprimir etiquetas"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Serão geradas etiquetas para todos os itens entregues desta compra (uma por unidade).
          Escolha o formato:
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            icon={Printer}
            loading={gerandoEtiquetas}
            onClick={() => gerarEtiquetas('termica')}
            className="justify-center"
          >
            Etiqueta térmica (rolo)
          </Button>
          <Button
            variant="secondary"
            icon={Printer}
            loading={gerandoEtiquetas}
            onClick={() => gerarEtiquetas('a4')}
            className="justify-center"
          >
            Folha A4 (múltiplas etiquetas)
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-gray-800">{value}</div>
    </div>
  )
}
