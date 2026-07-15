import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, CreditCard, Power } from 'lucide-react'
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

const FORMAS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'DEPOSITO', label: 'Depósito' },
  { value: 'LINK', label: 'Link de pagamento' },
]

function formaLabel(forma) {
  return FORMAS.find((f) => f.value === forma)?.label || forma
}

const EMPTY_ADQUIRENTE_FORM = { nome: '' }

const EMPTY_TAXA_FORM = {
  forma: 'PIX',
  parcelas: 1,
  taxaPercentual: '',
  taxaFixa: '',
  prazoRecebimentoDias: '',
  ativo: true,
}

function TaxaModal({ open, onClose, adquirenteId, taxa, onSaved }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_TAXA_FORM)
  const isEdit = Boolean(taxa)

  useEffect(() => {
    if (!open) return
    if (taxa) {
      setForm({
        forma: taxa.forma || 'PIX',
        parcelas: taxa.parcelas ?? 1,
        taxaPercentual: taxa.taxaPercentual ?? '',
        taxaFixa: taxa.taxaFixa ?? '',
        prazoRecebimentoDias: taxa.prazoRecebimentoDias ?? '',
        ativo: taxa.ativo ?? true,
      })
    } else {
      setForm(EMPTY_TAXA_FORM)
    }
  }, [open, taxa])

  const createMutation = useMutation({
    mutationFn: (payload) => api.post(`/adquirentes/${adquirenteId}/taxas`, payload),
    onSuccess: () => {
      toast.success('Taxa criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['adquirentes'] })
      onSaved()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar taxa.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/adquirentes/taxas/${id}`, payload),
    onSuccess: () => {
      toast.success('Taxa atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['adquirentes'] })
      onSaved()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar taxa.'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      forma: form.forma,
      parcelas: form.forma === 'CREDITO' ? Number(form.parcelas) || 1 : 1,
      taxaPercentual: form.taxaPercentual === '' ? 0 : Number(form.taxaPercentual),
      taxaFixa: form.taxaFixa === '' ? undefined : Number(form.taxaFixa),
      prazoRecebimentoDias:
        form.prazoRecebimentoDias === '' ? undefined : Number(form.prazoRecebimentoDias),
      ativo: form.ativo,
    }
    if (isEdit) {
      updateMutation.mutate({ id: taxa.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar taxa' : 'Nova taxa'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={isSaving}>
            Salvar
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Forma de pagamento *"
          value={form.forma}
          onChange={(e) => setForm((p) => ({ ...p, forma: e.target.value }))}
        >
          {FORMAS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>

        {form.forma === 'CREDITO' && (
          <Input
            label="Número de parcelas"
            type="number"
            min="1"
            max="24"
            value={form.parcelas}
            onChange={(e) => setForm((p) => ({ ...p, parcelas: e.target.value }))}
          />
        )}
        {form.forma === 'CREDITO' && (
          <p className="-mt-2 text-xs text-gray-400">
            A taxa do crédito varia conforme o número de parcelas: cadastre uma linha para cada
            quantidade de parcelas.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Taxa (%)"
            type="number"
            step="0.01"
            min="0"
            value={form.taxaPercentual}
            onChange={(e) => setForm((p) => ({ ...p, taxaPercentual: e.target.value }))}
          />
          <Input
            label="Taxa fixa (R$)"
            type="number"
            step="0.01"
            min="0"
            value={form.taxaFixa}
            onChange={(e) => setForm((p) => ({ ...p, taxaFixa: e.target.value }))}
          />
        </div>

        <Input
          label="Prazo de recebimento (dias)"
          type="number"
          min="0"
          value={form.prazoRecebimentoDias}
          onChange={(e) => setForm((p) => ({ ...p, prazoRecebimentoDias: e.target.value }))}
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.ativo}
            onChange={(e) => setForm((p) => ({ ...p, ativo: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Taxa ativa
        </label>
      </form>
    </Modal>
  )
}

function AdquirenteCard({ adquirente, onEdit, onDelete }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [taxaModalOpen, setTaxaModalOpen] = useState(false)
  const [editingTaxa, setEditingTaxa] = useState(null)

  const deleteTaxaMutation = useMutation({
    mutationFn: (taxaId) => api.delete(`/adquirentes/taxas/${taxaId}`),
    onSuccess: () => {
      toast.success('Taxa excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['adquirentes'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir taxa.'),
  })

  function openNewTaxa() {
    setEditingTaxa(null)
    setTaxaModalOpen(true)
  }

  function openEditTaxa(taxa) {
    setEditingTaxa(taxa)
    setTaxaModalOpen(true)
  }

  function handleDeleteTaxa(taxa) {
    const confirmado = window.confirm(
      `Excluir a taxa de ${formaLabel(taxa.forma)}${taxa.forma === 'CREDITO' ? ` (${taxa.parcelas}x)` : ''}?`
    )
    if (!confirmado) return
    deleteTaxaMutation.mutate(taxa.id)
  }

  const taxas = adquirente.taxas || []

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {adquirente.nome}
          {adquirente.ativo ? (
            <Badge variant="green">Ativo</Badge>
          ) : (
            <Badge variant="gray">Inativo</Badge>
          )}
        </span>
      }
      action={
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" icon={Plus} onClick={openNewTaxa}>
            Nova taxa
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={Pencil}
            onClick={() => onEdit(adquirente)}
            aria-label="Editar adquirente"
          />
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            className="text-red-600 hover:bg-red-50"
            onClick={() => onDelete(adquirente)}
            aria-label="Excluir adquirente"
          />
        </div>
      }
    >
      {taxas.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhuma taxa cadastrada. Adicione taxas para cada forma de pagamento.
        </p>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Forma</Th>
              <Th>Parcelas</Th>
              <Th>Taxa %</Th>
              <Th>Taxa fixa</Th>
              <Th>Prazo (dias)</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {taxas.map((taxa) => (
              <Tr key={taxa.id}>
                <Td className="font-medium text-gray-900">{formaLabel(taxa.forma)}</Td>
                <Td>{taxa.forma === 'CREDITO' ? `${taxa.parcelas}x` : '-'}</Td>
                <Td>{Number(taxa.taxaPercentual || 0).toFixed(2)}%</Td>
                <Td>{taxa.taxaFixa ? formatCurrency(taxa.taxaFixa) : '-'}</Td>
                <Td>{taxa.prazoRecebimentoDias ?? '-'}</Td>
                <Td>
                  {taxa.ativo ? (
                    <Badge variant="green">Ativa</Badge>
                  ) : (
                    <Badge variant="gray">Inativa</Badge>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Pencil}
                      onClick={() => openEditTaxa(taxa)}
                      aria-label="Editar taxa"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteTaxa(taxa)}
                      aria-label="Excluir taxa"
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <TaxaModal
        open={taxaModalOpen}
        onClose={() => setTaxaModalOpen(false)}
        adquirenteId={adquirente.id}
        taxa={editingTaxa}
        onSaved={() => setTaxaModalOpen(false)}
      />
    </Card>
  )
}

export default function Adquirentes() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_ADQUIRENTE_FORM)

  const {
    data: adquirentes = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['adquirentes'],
    queryFn: () => api.get('/adquirentes'),
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/adquirentes', payload),
    onSuccess: () => {
      toast.success('Adquirente criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['adquirentes'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar adquirente.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/adquirentes/${id}`, payload),
    onSuccess: () => {
      toast.success('Adquirente atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['adquirentes'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar adquirente.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/adquirentes/${id}`),
    onSuccess: () => {
      toast.success('Adquirente excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['adquirentes'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir adquirente.'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_ADQUIRENTE_FORM)
    setModalOpen(true)
  }

  function openEditModal(adquirente) {
    setEditingId(adquirente.id)
    setForm({ nome: adquirente.nome || '' })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_ADQUIRENTE_FORM)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('O nome é obrigatório.')
      return
    }
    const payload = { nome: form.nome.trim() }
    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(adquirente) {
    const confirmado = window.confirm(
      `Tem certeza que deseja excluir o adquirente "${adquirente.nome}"? Todas as taxas associadas também serão removidas.`
    )
    if (!confirmado) return
    deleteMutation.mutate(adquirente.id)
  }

  const hasAdquirentes = adquirentes.length > 0

  return (
    <div>
      <PageHeader
        title="Adquirentes & Taxas"
        subtitle="Cadastre os adquirentes de pagamento e as taxas cobradas por forma de pagamento e parcelamento"
        action={
          <Button icon={Plus} onClick={openCreateModal}>
            Novo adquirente
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={CreditCard}
          title="Erro ao carregar adquirentes"
          description="Não foi possível carregar a lista de adquirentes. Tente novamente."
        />
      ) : !hasAdquirentes ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum adquirente cadastrado"
          description="Cadastre seu primeiro adquirente para configurar as taxas de pagamento."
          action={
            <Button icon={Plus} onClick={openCreateModal}>
              Novo adquirente
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {adquirentes.map((adquirente) => (
            <AdquirenteCard
              key={adquirente.id}
              adquirente={adquirente}
              onEdit={openEditModal}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar adquirente' : 'Novo adquirente'}
        size="sm"
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
            onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
            placeholder="Ex: Stone, Cielo, PagSeguro..."
            required
          />
        </form>
      </Modal>
    </div>
  )
}
