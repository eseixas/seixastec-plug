import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Wallet, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency, formatDate } from '../../lib/format.js'
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
  StatCard,
} from '../../components/ui/index.js'

function statusVariant(status) {
  if (status === 'RECEBIDO') return 'green'
  if (status === 'CANCELADO') return 'red'
  return 'amber'
}

function statusLabel(status) {
  const map = { PENDENTE: 'Pendente', RECEBIDO: 'Recebido', CANCELADO: 'Cancelado' }
  return map[status] || status
}

const EMPTY_MANUAL_FORM = {
  descricao: '',
  categoriaId: '',
  valorBruto: '',
  dataPrevista: '',
  clienteId: '',
  contaBancariaId: '',
}

export default function Recebiveis() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [status, setStatus] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [adquirenteId, setAdquirenteId] = useState('')
  const [receivingId, setReceivingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL_FORM)
  const [savingManual, setSavingManual] = useState(false)
  const [recebendoItem, setRecebendoItem] = useState(null)
  const [contaEscolhida, setContaEscolhida] = useState('')

  const { data: adquirentes } = useQuery({
    queryKey: ['adquirentes', 'select'],
    queryFn: () => api.get('/adquirentes'),
  })

  const { data: categoriasReceita } = useQuery({
    queryKey: ['financeiro-categorias', 'select', 'RECEITA'],
    queryFn: () => api.get('/financeiro/categorias?tipo=RECEITA'),
  })

  const { data: clientes } = useQuery({
    queryKey: ['clientes', 'select'],
    queryFn: () => api.get('/clientes'),
  })

  const { data: contasBancarias } = useQuery({
    queryKey: ['financeiro-contas-bancarias', 'select'],
    queryFn: () => api.get('/financeiro/contas-bancarias'),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['recebiveis', { status, de, ate, adquirenteId }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      if (adquirenteId) params.set('adquirenteId', adquirenteId)
      const qs = params.toString()
      return api.get(`/recebiveis${qs ? `?${qs}` : ''}`)
    },
  })

  const itens = data?.itens ?? []
  const resumo = data?.resumo ?? []

  function findResumo(st) {
    return resumo.find((r) => r.status === st)
  }

  const totalBruto = resumo.reduce((sum, r) => sum + Number(r._sum?.valorBruto || 0), 0)
  const totalTaxa = resumo.reduce((sum, r) => sum + Number(r._sum?.taxaValor || 0), 0)
  const totalLiquido = resumo.reduce((sum, r) => sum + Number(r._sum?.valorLiquido || 0), 0)
  const pendenteLiquido = Number(findResumo('PENDENTE')?._sum?.valorLiquido || 0)
  const recebidoLiquido = Number(findResumo('RECEBIDO')?._sum?.valorLiquido || 0)

  function handleReceber(item) {
    setRecebendoItem(item)
  }

  function closeReceberModal() {
    setRecebendoItem(null)
    setContaEscolhida('')
  }

  async function confirmarReceber() {
    if (!recebendoItem || !contaEscolhida) return
    setReceivingId(recebendoItem.id)
    try {
      await api.post(`/recebiveis/${recebendoItem.id}/receber`, { contaBancariaId: contaEscolhida })
      toast.success('Recebível marcado como recebido.')
      queryClient.invalidateQueries({ queryKey: ['recebiveis'] })
      closeReceberModal()
    } catch (err) {
      toast.error(err?.message || 'Erro ao marcar recebível como recebido.')
    } finally {
      setReceivingId(null)
    }
  }

  async function handleDelete(item) {
    const confirmado = window.confirm(`Excluir o recebível "${item.descricao || 'manual'}"? Esta ação não pode ser desfeita.`)
    if (!confirmado) return
    setDeletingId(item.id)
    try {
      await api.delete(`/recebiveis/${item.id}`)
      toast.success('Recebível excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['recebiveis'] })
    } catch (err) {
      toast.error(err?.message || 'Erro ao excluir recebível.')
    } finally {
      setDeletingId(null)
    }
  }

  function openManualModal() {
    setManualForm(EMPTY_MANUAL_FORM)
    setModalOpen(true)
  }

  function closeManualModal() {
    setModalOpen(false)
    setManualForm(EMPTY_MANUAL_FORM)
  }

  function handleManualChange(field, value) {
    setManualForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleManualSubmit(e) {
    e.preventDefault()
    if (!manualForm.descricao.trim()) {
      toast.error('A descrição é obrigatória.')
      return
    }
    if (!manualForm.categoriaId) {
      toast.error('A categoria é obrigatória.')
      return
    }
    if (manualForm.valorBruto === '' || Number(manualForm.valorBruto) <= 0) {
      toast.error('O valor deve ser maior que zero.')
      return
    }
    if (!manualForm.dataPrevista) {
      toast.error('A data prevista é obrigatória.')
      return
    }

    const payload = {
      descricao: manualForm.descricao.trim(),
      categoriaId: manualForm.categoriaId,
      valorBruto: Number(manualForm.valorBruto),
      dataPrevista: manualForm.dataPrevista,
      clienteId: manualForm.clienteId || undefined,
      contaBancariaId: manualForm.contaBancariaId || undefined,
    }

    setSavingManual(true)
    try {
      await api.post('/recebiveis', payload)
      toast.success('Recebível criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['recebiveis'] })
      closeManualModal()
    } catch (err) {
      toast.error(err?.message || 'Erro ao criar recebível.')
    } finally {
      setSavingManual(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Recebíveis"
        subtitle="Acompanhe os valores a receber das vendas com cartão. Também é possível lançar recebíveis manuais."
        action={
          <Button icon={Plus} onClick={openManualModal}>
            Novo Recebível
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total bruto" value={formatCurrency(totalBruto)} icon={Wallet} accent="indigo" />
        <StatCard label="Total em taxas" value={formatCurrency(totalTaxa)} icon={Wallet} accent="amber" />
        <StatCard label="Total líquido" value={formatCurrency(totalLiquido)} icon={Wallet} accent="emerald" />
        <StatCard
          label="Pendente / Recebido"
          value={`${formatCurrency(pendenteLiquido)} / ${formatCurrency(recebidoLiquido)}`}
          icon={CheckCircle2}
          accent="sky"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          containerClassName="w-full sm:w-48"
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="RECEBIDO">Recebido</option>
          <option value="CANCELADO">Cancelado</option>
        </Select>
        <Select
          containerClassName="w-full sm:w-56"
          label="Adquirente"
          value={adquirenteId}
          onChange={(e) => setAdquirenteId(e.target.value)}
        >
          <option value="">Todos</option>
          {(adquirentes || []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
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
      ) : itens.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nenhum recebível encontrado"
          description="Ajuste os filtros para ver outros recebíveis."
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Venda</Th>
              <Th>Forma</Th>
              <Th>Adquirente</Th>
              <Th>Parcela</Th>
              <Th>Bruto</Th>
              <Th>Taxa</Th>
              <Th>Líquido</Th>
              <Th>Data prevista</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {itens.map((item) => {
              const isManual = item.vendaId == null
              return (
                <Tr key={item.id}>
                  <Td className="font-medium text-gray-900">
                    {item.venda?.numero ?? item.descricao ?? '-'}
                  </Td>
                  <Td>{item.pagamento?.forma ?? (isManual ? 'Manual' : '-')}</Td>
                  <Td>{item.adquirente?.nome ?? '-'}</Td>
                  <Td>
                    {item.parcelaNumero && item.totalParcelas
                      ? `${item.parcelaNumero}/${item.totalParcelas}`
                      : '-'}
                  </Td>
                  <Td>{formatCurrency(item.valorBruto)}</Td>
                  <Td>{formatCurrency(item.taxaValor)}</Td>
                  <Td className="font-medium text-gray-900">{formatCurrency(item.valorLiquido)}</Td>
                  <Td>{formatDate(item.dataPrevista)}</Td>
                  <Td>
                    <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {item.status === 'PENDENTE' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={CheckCircle2}
                          loading={receivingId === item.id}
                          onClick={() => handleReceber(item)}
                          className="text-emerald-600 hover:bg-emerald-50"
                        >
                          Marcar recebido
                        </Button>
                      )}
                      {isManual && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          loading={deletingId === item.id}
                          onClick={() => handleDelete(item)}
                          aria-label="Excluir recebível"
                          className="text-red-600 hover:bg-red-50"
                        />
                      )}
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}

      <Modal
        open={modalOpen}
        onClose={closeManualModal}
        title="Novo Recebível"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={closeManualModal} disabled={savingManual}>
              Cancelar
            </Button>
            <Button onClick={handleManualSubmit} loading={savingManual}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <Input
            label="Descrição *"
            value={manualForm.descricao}
            onChange={(e) => handleManualChange('descricao', e.target.value)}
            placeholder="Descrição do recebível"
            required
          />

          <Select
            label="Categoria *"
            value={manualForm.categoriaId}
            onChange={(e) => handleManualChange('categoriaId', e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {(categoriasReceita || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Valor bruto (R$) *"
              type="number"
              step="0.01"
              min="0"
              value={manualForm.valorBruto}
              onChange={(e) => handleManualChange('valorBruto', e.target.value)}
              required
            />
            <Input
              label="Data prevista *"
              type="date"
              value={manualForm.dataPrevista}
              onChange={(e) => handleManualChange('dataPrevista', e.target.value)}
              required
            />
          </div>

          <Select
            label="Cliente"
            value={manualForm.clienteId}
            onChange={(e) => handleManualChange('clienteId', e.target.value)}
          >
            <option value="">Sem cliente</option>
            {(clientes || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <Select
            label="Conta bancária"
            value={manualForm.contaBancariaId}
            onChange={(e) => handleManualChange('contaBancariaId', e.target.value)}
          >
            <option value="">Sem conta definida</option>
            {(contasBancarias || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </form>
      </Modal>

      <Modal
        open={!!recebendoItem}
        onClose={closeReceberModal}
        title="Marcar recebível como recebido"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeReceberModal} disabled={receivingId === recebendoItem?.id}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarReceber}
              loading={receivingId === recebendoItem?.id}
              disabled={!contaEscolhida}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Marcar como recebido o recebível da venda Nº {recebendoItem?.venda?.numero} (parcela{' '}
            {recebendoItem?.parcelaNumero}/{recebendoItem?.totalParcelas})?
          </p>

          <Select
            label="Conta bancária *"
            value={contaEscolhida}
            onChange={(e) => setContaEscolhida(e.target.value)}
            required
          >
            <option value="">Selecione...</option>
            {(contasBancarias || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  )
}
