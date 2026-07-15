import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Landmark } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Input,
  Select,
  Modal,
  Card,
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

const TIPOS_CONTA = [
  { value: 'DINHEIRO', label: 'Dinheiro/Caixa' },
  { value: 'CONTA_CORRENTE', label: 'Conta Corrente' },
  { value: 'CONTA_POUPANCA', label: 'Conta Poupança' },
  { value: 'CARTEIRA_DIGITAL', label: 'Carteira Digital' },
]

function tipoLabel(tipo) {
  return TIPOS_CONTA.find((t) => t.value === tipo)?.label || tipo
}

const EMPTY_FORM = {
  nome: '',
  tipo: 'CONTA_CORRENTE',
  banco: '',
  agencia: '',
  numeroConta: '',
  saldoInicial: '',
  ativo: true,
  principal: false,
}

export default function ContasBancariasList() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingSaldo, setEditingSaldo] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const {
    data: contas = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['financeiro-contas-bancarias', search],
    queryFn: () =>
      api.get(`/financeiro/contas-bancarias${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/financeiro/contas-bancarias', payload),
    onSuccess: () => {
      toast.success('Conta bancária criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-bancarias'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar conta bancária.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/financeiro/contas-bancarias/${id}`, payload),
    onSuccess: () => {
      toast.success('Conta bancária atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-bancarias'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar conta bancária.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/financeiro/contas-bancarias/${id}`),
    onSuccess: () => {
      toast.success('Conta bancária excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-bancarias'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir conta bancária.'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setEditingSaldo(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(conta) {
    setEditingId(conta.id)
    setEditingSaldo(conta.saldo)
    setForm({
      nome: conta.nome || '',
      tipo: conta.tipo || 'CONTA_CORRENTE',
      banco: conta.banco || '',
      agencia: conta.agencia || '',
      numeroConta: conta.numeroConta || '',
      saldoInicial: '',
      ativo: conta.ativo ?? true,
      principal: conta.principal ?? false,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setEditingSaldo(null)
    setForm(EMPTY_FORM)
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }

    const payload = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      banco: form.banco.trim() || undefined,
      agencia: form.agencia.trim() || undefined,
      numeroConta: form.numeroConta.trim() || undefined,
      ativo: form.ativo,
      principal: form.principal,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      payload.saldoInicial = form.saldoInicial === '' ? 0 : Number(form.saldoInicial)
      createMutation.mutate(payload)
    }
  }

  function handleDelete(conta) {
    const confirmed = window.confirm(`Tem certeza que deseja excluir a conta "${conta.nome}"?`)
    if (!confirmed) return
    deleteMutation.mutate(conta.id)
  }

  const hasContas = contas.length > 0

  return (
    <div>
      <PageHeader title="Contas Bancárias" subtitle="Gerencie as contas usadas para pagamentos e recebimentos" />

      <Card
        title="Contas"
        action={
          <Button icon={Plus} size="sm" onClick={openCreateModal}>
            Nova conta
          </Button>
        }
      >
        <div className="mb-4">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              placeholder="Buscar conta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <EmptyState
            icon={Landmark}
            title="Erro ao carregar contas bancárias"
            description="Não foi possível carregar a lista de contas. Tente novamente."
          />
        ) : !hasContas ? (
          <EmptyState
            icon={Landmark}
            title="Nenhuma conta encontrada"
            description={
              search
                ? 'Nenhuma conta corresponde à sua busca.'
                : 'Cadastre sua primeira conta bancária para começar.'
            }
            action={
              !search && (
                <Button icon={Plus} onClick={openCreateModal}>
                  Nova conta
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>Tipo</Th>
                <Th>Banco</Th>
                <Th>Saldo</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {contas.map((conta) => (
                <Tr key={conta.id}>
                  <Td className="font-medium text-gray-900">{conta.nome}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <Badge variant="indigo">{tipoLabel(conta.tipo)}</Badge>
                      {conta.principal && <Badge variant="indigo">Principal</Badge>}
                    </div>
                  </Td>
                  <Td>{conta.banco || '-'}</Td>
                  <Td className="font-semibold text-gray-900">{formatCurrency(conta.saldo)}</Td>
                  <Td>
                    {conta.ativo ? (
                      <Badge variant="green">Ativo</Badge>
                    ) : (
                      <Badge variant="gray">Inativo</Badge>
                    )}
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => openEditModal(conta)}
                        aria-label="Editar conta"
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(conta)}
                        aria-label="Excluir conta"
                      >
                        Excluir
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Modal
          open={modalOpen}
          onClose={closeModal}
          title={editingId ? 'Editar conta bancária' : 'Nova conta bancária'}
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={closeModal} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} loading={isSaving}>
                Salvar
              </Button>
            </>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome *"
              value={form.nome}
              onChange={(e) => handleChange('nome', e.target.value)}
              placeholder="Nome da conta"
              required
            />

            <Select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => handleChange('tipo', e.target.value)}
            >
              {TIPOS_CONTA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input
                label="Banco"
                value={form.banco}
                onChange={(e) => handleChange('banco', e.target.value)}
                placeholder="Opcional"
              />
              <Input
                label="Agência"
                value={form.agencia}
                onChange={(e) => handleChange('agencia', e.target.value)}
                placeholder="Opcional"
              />
              <Input
                label="Número da conta"
                value={form.numeroConta}
                onChange={(e) => handleChange('numeroConta', e.target.value)}
                placeholder="Opcional"
              />
            </div>

            {editingId ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Saldo atual</label>
                <p className="rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500">
                  {formatCurrency(editingSaldo)} — o saldo é atualizado automaticamente pelas movimentações.
                </p>
              </div>
            ) : (
              <Input
                label="Saldo inicial (R$)"
                type="number"
                step="0.01"
                value={form.saldoInicial}
                onChange={(e) => handleChange('saldoInicial', e.target.value)}
                placeholder="0,00"
              />
            )}

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => handleChange('ativo', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Conta ativa
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.principal}
                onChange={(e) => handleChange('principal', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Usar para creditar vendas em dinheiro automaticamente (só uma conta pode ser a principal)
            </label>
          </form>
        </Modal>
      </Card>
    </div>
  )
}
