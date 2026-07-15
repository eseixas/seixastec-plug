import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Pencil, Trash2, Truck } from 'lucide-react'
import { api } from '../../lib/api.js'
import {
  Button,
  Input,
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
import { useToast } from '../../context/ToastContext.jsx'

const EMPTY_FORM = {
  nome: '',
  cpfCnpj: '',
  email: '',
  telefone: '',
  cidade: '',
  uf: '',
  observacao: '',
  ativo: true,
}

export default function FornecedoresList() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const {
    data: fornecedores = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['fornecedores', search],
    queryFn: () =>
      api.get(`/fornecedores${search ? `?q=${encodeURIComponent(search)}` : ''}`),
    keepPreviousData: true,
  })

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/fornecedores', payload),
    onSuccess: () => {
      toast.success('Fornecedor criado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao criar fornecedor.')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/fornecedores/${id}`, payload),
    onSuccess: () => {
      toast.success('Fornecedor atualizado com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
      closeModal()
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao atualizar fornecedor.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/fornecedores/${id}`),
    onSuccess: () => {
      toast.success('Fornecedor excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['fornecedores'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao excluir fornecedor.')
    },
  })

  const isSaving = createMutation.isPending || updateMutation.isPending

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(fornecedor) {
    setEditingId(fornecedor.id)
    setForm({
      nome: fornecedor.nome || '',
      cpfCnpj: fornecedor.cpfCnpj || '',
      email: fornecedor.email || '',
      telefone: fornecedor.telefone || '',
      cidade: fornecedor.cidade || '',
      uf: fornecedor.uf || '',
      observacao: fornecedor.observacao || '',
      ativo: fornecedor.ativo ?? true,
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
      cpfCnpj: form.cpfCnpj.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      cidade: form.cidade.trim(),
      uf: form.uf.trim().toUpperCase(),
      observacao: form.observacao.trim(),
      ativo: form.ativo,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function handleDelete(fornecedor) {
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o fornecedor "${fornecedor.nome}"?`
    )
    if (!confirmed) return
    deleteMutation.mutate(fornecedor.id)
  }

  const hasFornecedores = fornecedores.length > 0

  const cidadeUf = useMemo(
    () => (fornecedor) =>
      [fornecedor.cidade, fornecedor.uf].filter(Boolean).join(' / ') || '-',
    []
  )

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle="Gerencie seus fornecedores"
        action={
          <Button icon={Plus} onClick={openCreateModal}>
            Novo fornecedor
          </Button>
        }
      />

      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Buscar por nome, CNPJ, cidade..."
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
          icon={Truck}
          title="Erro ao carregar fornecedores"
          description="Não foi possível carregar a lista de fornecedores. Tente novamente."
        />
      ) : !hasFornecedores ? (
        <EmptyState
          icon={Truck}
          title="Nenhum fornecedor encontrado"
          description={
            search
              ? 'Nenhum fornecedor corresponde à sua busca.'
              : 'Cadastre seu primeiro fornecedor para começar.'
          }
          action={
            !search && (
              <Button icon={Plus} onClick={openCreateModal}>
                Novo fornecedor
              </Button>
            )
          }
        />
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>CPF/CNPJ</Th>
              <Th>Telefone</Th>
              <Th>Cidade/UF</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {fornecedores.map((fornecedor) => (
              <Tr key={fornecedor.id}>
                <Td className="font-medium text-gray-900">{fornecedor.nome}</Td>
                <Td>{fornecedor.cpfCnpj || '-'}</Td>
                <Td>{fornecedor.telefone || '-'}</Td>
                <Td>{cidadeUf(fornecedor)}</Td>
                <Td>
                  {fornecedor.ativo ? (
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
                      onClick={() => openEditModal(fornecedor)}
                      aria-label="Editar fornecedor"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(fornecedor)}
                      aria-label="Excluir fornecedor"
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
        title={editingId ? 'Editar fornecedor' : 'Novo fornecedor'}
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
            placeholder="Nome do fornecedor"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="CPF/CNPJ"
              value={form.cpfCnpj}
              onChange={(e) => handleChange('cpfCnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => handleChange('telefone', e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="contato@fornecedor.com"
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Cidade"
              value={form.cidade}
              onChange={(e) => handleChange('cidade', e.target.value)}
              placeholder="Cidade"
              containerClassName="col-span-2"
            />
            <Input
              label="UF"
              value={form.uf}
              onChange={(e) => handleChange('uf', e.target.value.toUpperCase())}
              placeholder="UF"
              maxLength={2}
              className="uppercase"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Observação
            </label>
            <textarea
              value={form.observacao}
              onChange={(e) => handleChange('observacao', e.target.value)}
              rows={3}
              placeholder="Observações sobre o fornecedor"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Fornecedor ativo
          </label>
        </form>
      </Modal>
    </div>
  )
}
