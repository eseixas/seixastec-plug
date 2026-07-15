import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.js'
import { toInputDate } from '../../lib/format.js'
import { useToast } from '../../context/ToastContext.jsx'
import { Button, Input, Select, Card, Spinner, PageHeader } from '../../components/ui/index.js'

const EMPTY_FORM = {
  descricao: '',
  categoriaId: '',
  fornecedorId: '',
  contaBancariaId: '',
  valor: '',
  desconto: '0',
  juros: '0',
  vencimento: '',
  observacoes: '',
  anexoUrl: '',
}

export default function ContaPagarForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const { data: categorias } = useQuery({
    queryKey: ['financeiro-categorias', 'select', 'DESPESA'],
    queryFn: () => api.get('/financeiro/categorias?tipo=DESPESA'),
  })

  const { data: fornecedores } = useQuery({
    queryKey: ['fornecedores', 'select'],
    queryFn: () => api.get('/fornecedores'),
  })

  const { data: contasBancarias } = useQuery({
    queryKey: ['financeiro-contas-bancarias', 'select'],
    queryFn: () => api.get('/financeiro/contas-bancarias'),
  })

  const { data: contaPagar, isLoading: isLoadingContaPagar } = useQuery({
    queryKey: ['financeiro-contas-pagar', id],
    queryFn: () => api.get(`/financeiro/contas-pagar/${id}`),
    enabled: isEdit,
  })

  useEffect(() => {
    if (contaPagar) {
      setForm({
        descricao: contaPagar.descricao || '',
        categoriaId: contaPagar.categoriaId || '',
        fornecedorId: contaPagar.fornecedorId || '',
        contaBancariaId: contaPagar.contaBancariaId || '',
        valor: contaPagar.valor ?? '',
        desconto: contaPagar.desconto ?? '0',
        juros: contaPagar.juros ?? '0',
        vencimento: toInputDate(contaPagar.vencimento),
        observacoes: contaPagar.observacoes || '',
        anexoUrl: contaPagar.anexoUrl || '',
      })
    }
  }, [contaPagar])

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.descricao.trim()) {
      toast.error('A descrição é obrigatória.')
      return
    }
    if (!form.categoriaId) {
      toast.error('A categoria é obrigatória.')
      return
    }
    if (form.valor === '' || Number(form.valor) <= 0) {
      toast.error('O valor deve ser maior que zero.')
      return
    }
    if (!form.vencimento) {
      toast.error('O vencimento é obrigatório.')
      return
    }

    const payload = {
      descricao: form.descricao.trim(),
      categoriaId: form.categoriaId,
      fornecedorId: form.fornecedorId || undefined,
      contaBancariaId: form.contaBancariaId || undefined,
      valor: Number(form.valor),
      desconto: form.desconto === '' ? 0 : Number(form.desconto),
      juros: form.juros === '' ? 0 : Number(form.juros),
      vencimento: form.vencimento,
      observacoes: form.observacoes.trim() || undefined,
      anexoUrl: form.anexoUrl.trim() || undefined,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api.put(`/financeiro/contas-pagar/${id}`, payload)
      } else {
        await api.post('/financeiro/contas-pagar', payload)
      }

      toast.success(isEdit ? 'Conta a pagar atualizada com sucesso.' : 'Conta a pagar criada com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['financeiro-contas-pagar'] })
      navigate('/financeiro/contas-pagar')
    } catch (err) {
      toast.error(err?.message || 'Erro ao salvar conta a pagar.')
    } finally {
      setSaving(false)
    }
  }

  if (isEdit && isLoadingContaPagar) {
    return <Spinner />
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Editar conta a pagar' : 'Nova conta a pagar'}
        subtitle={isEdit ? 'Atualize as informações da conta a pagar.' : 'Preencha os dados para cadastrar uma nova conta a pagar.'}
        action={
          <Button variant="secondary" onClick={() => navigate('/financeiro/contas-pagar')}>
            Cancelar
          </Button>
        }
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Descrição *"
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              required
              containerClassName="sm:col-span-2"
            />

            <Select
              label="Categoria *"
              value={form.categoriaId}
              onChange={(e) => handleChange('categoriaId', e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {(categorias || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>

            <Select
              label="Fornecedor"
              value={form.fornecedorId}
              onChange={(e) => handleChange('fornecedorId', e.target.value)}
            >
              <option value="">Sem fornecedor</option>
              {(fornecedores || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </Select>

            <Select
              label="Conta bancária"
              value={form.contaBancariaId}
              onChange={(e) => handleChange('contaBancariaId', e.target.value)}
            >
              <option value="">Sem conta definida</option>
              {(contasBancarias || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>

            <Input
              label="Vencimento *"
              type="date"
              value={form.vencimento}
              onChange={(e) => handleChange('vencimento', e.target.value)}
              required
            />

            <Input
              label="Valor (R$) *"
              type="number"
              step="0.01"
              min="0"
              value={form.valor}
              onChange={(e) => handleChange('valor', e.target.value)}
              required
            />

            <Input
              label="Desconto (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.desconto}
              onChange={(e) => handleChange('desconto', e.target.value)}
            />

            <Input
              label="Juros (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.juros}
              onChange={(e) => handleChange('juros', e.target.value)}
            />

            <Input
              label="Link do anexo (opcional)"
              value={form.anexoUrl}
              onChange={(e) => handleChange('anexoUrl', e.target.value)}
              placeholder="https://..."
              containerClassName="sm:col-span-2"
            />

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => handleChange('observacoes', e.target.value)}
                rows={3}
                placeholder="Opcional"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </Card>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/financeiro/contas-pagar')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? 'Salvar alterações' : 'Criar conta a pagar'}
          </Button>
        </div>
      </form>
    </div>
  )
}
