import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Tags } from 'lucide-react'
import { api } from '../../lib/api.js'
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

const GRUPOS = [
  { value: 'RECEITA_OPERACIONAL', label: 'Receita Operacional' },
  { value: 'DEDUCAO_RECEITA', label: 'Dedução da Receita' },
  { value: 'CUSTO_OPERACIONAL', label: 'Custo Operacional' },
  { value: 'DESPESA_OPERACIONAL', label: 'Despesa Operacional' },
  { value: 'DESPESA_FINANCEIRA', label: 'Despesa Financeira' },
  { value: 'OUTRAS_RECEITAS', label: 'Outras Receitas' },
  { value: 'OUTRAS_DESPESAS', label: 'Outras Despesas' },
]

const GRUPOS_RECEITA = new Set(['RECEITA_OPERACIONAL', 'OUTRAS_RECEITAS'])

function grupoLabel(grupo) {
  return GRUPOS.find((g) => g.value === grupo)?.label || grupo
}

function grupoVariant(grupo) {
  return GRUPOS_RECEITA.has(grupo) ? 'green' : 'red'
}

const EMPTY_FORM = {
  nome: '',
  grupo: 'DESPESA_OPERACIONAL',
  ativo: true,
}

export default function CategoriasFinanceirasList() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const {
    data: categorias = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['financeiro-categorias', search],
    queryFn: () =>
      api.get(`/financeiro/categorias${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/financeiro/categorias', payload),
    onSuccess: () => {
      toast.success('Categoria criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-categorias'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao criar categoria.'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/financeiro/categorias/${id}`, payload),
    onSuccess: () => {
      toast.success('Categoria atualizada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-categorias'] })
      closeModal()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao atualizar categoria.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/financeiro/categorias/${id}`),
    onSuccess: () => {
      toast.success('Categoria excluída com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-categorias'] })
    },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir categoria.'),
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(categoria) {
    setEditingId(categoria.id)
    setForm({
      nome: categoria.nome || '',
      grupo: categoria.grupo || 'DESPESA_OPERACIONAL',
      ativo: categoria.ativo ?? true,
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingId(null)
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
      grupo: form.grupo,
      ativo: form.ativo,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(categoria) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir a categoria "${categoria.nome}"?`
    )
    if (!confirmed) return
    deleteMutation.mutate(categoria.id)
  }

  const hasCategorias = categorias.length > 0

  return (
    <div>
      <PageHeader
        title="Categorias Financeiras"
        subtitle="Plano de contas usado para classificar receitas e despesas"
      />

      <Card
        title="Categorias"
        action={
          <Button icon={Plus} size="sm" onClick={openCreateModal}>
            Nova categoria
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
              placeholder="Buscar categoria..."
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
            icon={Tags}
            title="Erro ao carregar categorias"
            description="Não foi possível carregar a lista de categorias. Tente novamente."
          />
        ) : !hasCategorias ? (
          <EmptyState
            icon={Tags}
            title="Nenhuma categoria encontrada"
            description={
              search
                ? 'Nenhuma categoria corresponde à sua busca.'
                : 'Cadastre sua primeira categoria financeira para começar.'
            }
            action={
              !search && (
                <Button icon={Plus} onClick={openCreateModal}>
                  Nova categoria
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>Grupo</Th>
                <Th>Tipo</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {categorias.map((categoria) => (
                <Tr key={categoria.id}>
                  <Td className="font-medium text-gray-900">{categoria.nome}</Td>
                  <Td>
                    <Badge variant={grupoVariant(categoria.grupo)}>{grupoLabel(categoria.grupo)}</Badge>
                  </Td>
                  <Td>{categoria.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}</Td>
                  <Td>
                    {categoria.ativo ? (
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
                        onClick={() => openEditModal(categoria)}
                        aria-label="Editar categoria"
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(categoria)}
                        aria-label="Excluir categoria"
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
          title={editingId ? 'Editar categoria' : 'Nova categoria'}
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
              placeholder="Nome da categoria"
              required
            />

            <Select
              label="Grupo"
              value={form.grupo}
              onChange={(e) => handleChange('grupo', e.target.value)}
            >
              {GRUPOS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => handleChange('ativo', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Categoria ativa
            </label>
          </form>
        </Modal>
      </Card>
    </div>
  )
}
