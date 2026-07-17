import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { formatCurrency } from '../../lib/format.js'
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
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  limiteCredito: '',
  observacao: '',
  ativo: true,
}

function clienteToForm(cliente) {
  return {
    nome: cliente.nome ?? '',
    cpfCnpj: cliente.cpfCnpj ?? '',
    email: cliente.email ?? '',
    telefone: cliente.telefone ?? '',
    cep: cliente.cep ?? '',
    logradouro: cliente.logradouro ?? '',
    numero: cliente.numero ?? '',
    complemento: cliente.complemento ?? '',
    bairro: cliente.bairro ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
    limiteCredito: cliente.limiteCredito ?? '',
    observacao: cliente.observacao ?? '',
    ativo: cliente.ativo ?? true,
  }
}

export default function ClientesList() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', search],
    queryFn: () => api.get(`/clientes?q=${encodeURIComponent(search)}`),
  })

  const { data: cfgCliente } = useQuery({
    queryKey: ['config-cliente'],
    queryFn: () => api.get('/config/cliente'),
  })

  const digitos = (form.cpfCnpj || '').replace(/\D/g, '')
  const ehPJ = digitos.length === 14
  const camposObrigatorios = ehPJ
    ? cfgCliente?.camposObrigatoriosPJ || []
    : cfgCliente?.camposObrigatoriosPF || []
  const obrigatorio = (campo) => camposObrigatorios.includes(campo)

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      const body = {
        ...payload,
        limiteCredito: payload.limiteCredito === '' ? 0 : Number(payload.limiteCredito),
      }
      return editingId ? api.put(`/clientes/${editingId}`, body) : api.post('/clientes', body)
    },
    onSuccess: () => {
      toast.success(editingId ? 'Cliente atualizado com sucesso.' : 'Cliente criado com sucesso.')
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Não foi possível salvar o cliente.')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/clientes/${id}`),
    onSuccess: () => {
      toast.success('Cliente excluído com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Não foi possível excluir o cliente.')
    },
  })

  const hasClientes = useMemo(() => clientes.length > 0, [clientes])

  function openCreateModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEditModal(cliente) {
    setEditingId(cliente.id)
    setForm(clienteToForm(cliente))
    setModalOpen(true)
  }

  function closeModal() {
    if (saveMutation.isPending) return
    setModalOpen(false)
  }

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) {
      toast.error('O nome do cliente é obrigatório.')
      return
    }
    if (obrigatorio('cpfCnpj') && !form.cpfCnpj.trim()) {
      toast.error('CPF/CNPJ é obrigatório.')
      return
    }
    if (obrigatorio('email') && !form.email.trim()) {
      toast.error('E-mail é obrigatório.')
      return
    }
    if (obrigatorio('telefone') && !form.telefone.trim()) {
      toast.error('Telefone é obrigatório.')
      return
    }
    if (
      obrigatorio('endereco') &&
      (!form.cep.trim() || !form.logradouro.trim() || !form.numero.trim() || !form.cidade.trim() || !form.uf.trim())
    ) {
      toast.error('Endereço completo (CEP, logradouro, número, cidade e UF) é obrigatório.')
      return
    }
    saveMutation.mutate(form)
  }

  function handleDelete(cliente) {
    const confirmed = window.confirm(`Tem certeza que deseja excluir o cliente "${cliente.nome}"?`)
    if (!confirmed) return
    deleteMutation.mutate(cliente.id)
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Gerencie sua base de clientes"
        action={
          <Button icon={UserPlus} onClick={openCreateModal}>
            Novo cliente
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Buscar por nome, CPF/CNPJ, e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : !hasClientes ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Cadastre um novo cliente ou ajuste sua busca."
          action={
            <Button icon={UserPlus} onClick={openCreateModal}>
              Novo cliente
            </Button>
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
              <Th>Limite de Crédito</Th>
              <Th>Status</Th>
              <Th className="text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {clientes.map((cliente) => (
              <Tr key={cliente.id}>
                <Td className="font-medium text-gray-900">{cliente.nome}</Td>
                <Td>{cliente.cpfCnpj || '-'}</Td>
                <Td>{cliente.telefone || '-'}</Td>
                <Td>{cliente.cidade && cliente.uf ? `${cliente.cidade} - ${cliente.uf}` : '-'}</Td>
                <Td>{formatCurrency(cliente.limiteCredito)}</Td>
                <Td>
                  <Badge variant={cliente.ativo ? 'green' : 'gray'}>
                    {cliente.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Pencil}
                      onClick={() => openEditModal(cliente)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(cliente)}
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
        title={editingId ? 'Editar cliente' : 'Novo cliente'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saveMutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} loading={saveMutation.isPending}>
              Salvar
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Dados</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Nome"
                required
                value={form.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                containerClassName="col-span-2"
              />
              <Input
                label={obrigatorio('cpfCnpj') ? 'CPF/CNPJ *' : 'CPF/CNPJ'}
                value={form.cpfCnpj}
                onChange={(e) => handleChange('cpfCnpj', e.target.value)}
              />
              <Input
                label={obrigatorio('email') ? 'E-mail *' : 'E-mail'}
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
              <Input
                label={obrigatorio('telefone') ? 'Telefone *' : 'Telefone'}
                value={form.telefone}
                onChange={(e) => handleChange('telefone', e.target.value)}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Endereço</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={obrigatorio('endereco') ? 'CEP *' : 'CEP'}
                value={form.cep}
                onChange={(e) => handleChange('cep', e.target.value)}
              />
              <Input
                label={obrigatorio('endereco') ? 'UF *' : 'UF'}
                maxLength={2}
                value={form.uf}
                onChange={(e) => handleChange('uf', e.target.value.toUpperCase())}
              />
              <Input
                label={obrigatorio('endereco') ? 'Logradouro *' : 'Logradouro'}
                value={form.logradouro}
                onChange={(e) => handleChange('logradouro', e.target.value)}
                containerClassName="col-span-2"
              />
              <Input
                label={obrigatorio('endereco') ? 'Número *' : 'Número'}
                value={form.numero}
                onChange={(e) => handleChange('numero', e.target.value)}
              />
              <Input
                label="Complemento"
                value={form.complemento}
                onChange={(e) => handleChange('complemento', e.target.value)}
              />
              <Input
                label="Bairro"
                value={form.bairro}
                onChange={(e) => handleChange('bairro', e.target.value)}
              />
              <Input
                label={obrigatorio('endereco') ? 'Cidade *' : 'Cidade'}
                value={form.cidade}
                onChange={(e) => handleChange('cidade', e.target.value)}
              />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Financeiro</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Limite de Crédito"
                type="number"
                step="0.01"
                value={form.limiteCredito}
                onChange={(e) => handleChange('limiteCredito', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              value={form.observacao}
              onChange={(e) => handleChange('observacao', e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={form.ativo}
              onChange={(e) => handleChange('ativo', e.target.checked)}
            />
            Cliente ativo
          </label>
        </form>
      </Modal>
    </div>
  )
}
