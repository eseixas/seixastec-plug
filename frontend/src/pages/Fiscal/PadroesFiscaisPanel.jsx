import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark } from 'lucide-react'
import { api } from '../../lib/api.js'
import { useToast } from '../../context/ToastContext.jsx'
import {
  Button,
  Input,
  Select,
  Card,
  EmptyState,
  Spinner,
} from '../../components/ui/index.js'

const ORIGENS_MERCADORIA = [
  { value: '0', label: '0 — Nacional (exceto 3 a 5)' },
  { value: '1', label: '1 — Estrangeira - Importação direta' },
  { value: '2', label: '2 — Estrangeira - Adquirida no mercado interno' },
  {
    value: '3',
    label: '3 — Nacional - Mercadoria ou bem com Conteúdo de Importação superior a 40%',
  },
  {
    value: '4',
    label: '4 — Nacional - Produção em conformidade com processos produtivos básicos',
  },
  {
    value: '5',
    label: '5 — Nacional - Mercadoria ou bem com Conteúdo de Importação inferior ou igual a 40%',
  },
  { value: '6', label: '6 — Estrangeira - Importação direta, sem similar nacional' },
  { value: '7', label: '7 — Estrangeira - Adquirida no mercado interno, sem similar nacional' },
  {
    value: '8',
    label: '8 — Nacional - Mercadoria ou bem com Conteúdo de Importação superior a 70%',
  },
]

const OPCOES_CSOSN = [
  { value: '101', label: '101 — Tributada com permissão de crédito' },
  { value: '102', label: '102 — Tributada sem permissão de crédito' },
  { value: '103', label: '103 — Isenção do ICMS para faixa de receita bruta' },
  { value: '300', label: '300 — Imune' },
  { value: '400', label: '400 — Não tributada' },
  { value: '500', label: '500 — ICMS cobrado anteriormente por substituição tributária' },
  { value: '900', label: '900 — Outros' },
]

const EMPTY_FISCAL_FORM = {
  origemMercadoria: '0',
  csosn: '101',
  cfop: '',
  ncmPadrao: '',
  cest: '',
  ambiente: 'homologacao',
  serieNfce: '1',
  serieNfe: '1',
}

export default function PadroesFiscaisPanel() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState(EMPTY_FISCAL_FORM)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['config-fiscal'],
    queryFn: () => api.get('/config/fiscal'),
  })

  useEffect(() => {
    if (data) {
      setForm({
        origemMercadoria: data.origemMercadoria ?? '0',
        csosn: data.csosn ?? '101',
        cfop: data.cfop ?? '',
        ncmPadrao: data.ncmPadrao ?? '',
        cest: data.cest ?? '',
        ambiente: data.ambiente ?? 'homologacao',
        serieNfce: String(data.serieNfce ?? 1),
        serieNfe: String(data.serieNfe ?? 1),
      })
    }
  }, [data])

  const updateMutation = useMutation({
    mutationFn: (payload) => api.put('/config/fiscal', payload),
    onSuccess: () => {
      toast.success('Configurações fiscais atualizadas com sucesso.')
      queryClient.invalidateQueries({ queryKey: ['config-fiscal'] })
    },
    onError: (err) => {
      toast.error(err?.message || 'Erro ao salvar configurações fiscais.')
    },
  })

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      origemMercadoria: form.origemMercadoria,
      csosn: form.csosn,
      cfop: form.cfop.trim(),
      ncmPadrao: form.ncmPadrao.trim(),
      cest: form.cest.trim(),
      ambiente: form.ambiente,
      serieNfce: Number(form.serieNfce) || 1,
      serieNfe: Number(form.serieNfe) || 1,
    }
    updateMutation.mutate(payload)
  }

  return (
    <Card
      title="Padrões Fiscais"
      action={
        <Button onClick={handleSubmit} loading={updateMutation.isPending}>
          Salvar
        </Button>
      }
    >
      <p className="mb-4 text-xs text-gray-500">
        Esses valores são usados para pré-preencher os campos fiscais ao cadastrar um novo
        produto, e para configurar a emissão de NFC-e/NF-e.
      </p>

      {form.ambiente === 'homologacao' && !isLoading && !isError && (
        <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          Ambiente de <strong>homologação</strong> — as notas emitidas são só de teste, sem
          valor fiscal. Troque para produção somente depois de validar a emissão.
        </div>
      )}

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <EmptyState
          icon={Landmark}
          title="Erro ao carregar configurações fiscais"
          description="Não foi possível carregar as configurações fiscais. Tente novamente."
        />
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Origem da mercadoria"
            value={form.origemMercadoria}
            onChange={(e) => handleChange('origemMercadoria', e.target.value)}
          >
            {ORIGENS_MERCADORIA.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Select
            label="CSOSN"
            value={form.csosn}
            onChange={(e) => handleChange('csosn', e.target.value)}
          >
            {OPCOES_CSOSN.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>

          <Input
            label="CFOP padrão"
            value={form.cfop}
            onChange={(e) => handleChange('cfop', e.target.value)}
            placeholder="Ex: 5102"
          />

          <Input
            label="NCM padrão"
            value={form.ncmPadrao}
            onChange={(e) => handleChange('ncmPadrao', e.target.value)}
            placeholder="Ex: 6109.10.00"
          />

          <Input
            label="CEST"
            value={form.cest}
            onChange={(e) => handleChange('cest', e.target.value)}
            placeholder="Opcional"
          />

          <Select
            label="Ambiente de emissão (NFC-e/NF-e)"
            value={form.ambiente}
            onChange={(e) => handleChange('ambiente', e.target.value)}
          >
            <option value="homologacao">Homologação (testes)</option>
            <option value="producao">Produção</option>
          </Select>

          <div />

          <Input
            label="Série NFC-e"
            type="number"
            min="1"
            value={form.serieNfce}
            onChange={(e) => handleChange('serieNfce', e.target.value)}
          />

          <Input
            label="Série NF-e"
            type="number"
            min="1"
            value={form.serieNfe}
            onChange={(e) => handleChange('serieNfe', e.target.value)}
          />
        </form>
      )}
    </Card>
  )
}
