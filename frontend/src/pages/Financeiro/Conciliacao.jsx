import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileCheck2, Link2, Ban, CheckCircle2, RotateCcw } from 'lucide-react'
import { api, uploadExtrato } from '../../lib/api.js'
import { formatCurrency, formatDate } from '../../lib/format.js'
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

const STATUS_BADGE = {
  PENDENTE: { variant: 'amber', label: 'Pendente' },
  CONCILIADO: { variant: 'green', label: 'Conciliado' },
  IGNORADO: { variant: 'gray', label: 'Ignorado' },
}

export default function Conciliacao() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [contaBancariaId, setContaBancariaId] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const [importOpen, setImportOpen] = useState(false)
  const [importConta, setImportConta] = useState('')
  const [importFormato, setImportFormato] = useState('OFX')
  const [importFile, setImportFile] = useState(null)
  const [resumo, setResumo] = useState(null)

  const [importacaoId, setImportacaoId] = useState(null)

  // Modal de pareamento manual de um lançamento do extrato.
  const [casarLanc, setCasarLanc] = useState(null) // { id, valor }

  const { data: contas = [] } = useQuery({
    queryKey: ['financeiro-contas-bancarias', 'select'],
    queryFn: () => api.get('/financeiro/contas-bancarias'),
  })

  // Pendentes de conciliação (Recebiveis recebidos + Contas pagas não conciliados).
  const pendentesQuery = useQuery({
    enabled: !!contaBancariaId,
    queryKey: ['conciliacao-pendentes', { contaBancariaId, de, ate }],
    queryFn: () => {
      const params = new URLSearchParams({ contaBancariaId })
      if (de) params.set('de', de)
      if (ate) params.set('ate', ate)
      return api.get(`/financeiro/conciliacao/pendentes?${params.toString()}`)
    },
  })
  const pendentes = pendentesQuery.data ?? []

  // Detalhe da última importação selecionada.
  const importacaoQuery = useQuery({
    enabled: !!importacaoId,
    queryKey: ['conciliacao-importacao', importacaoId],
    queryFn: () => api.get(`/financeiro/conciliacao/importacoes/${importacaoId}`),
  })
  const importacao = importacaoQuery.data

  // ---- Upload de extrato --------------------------------------------------
  const importMutation = useMutation({
    mutationFn: () => uploadExtrato(importConta, importFormato, importFile),
    onSuccess: (data) => {
      setResumo(data)
      setImportacaoId(data.importacaoId)
      if (!contaBancariaId) setContaBancariaId(importConta)
      toast.success(
        `Extrato importado: ${data.conciliadosAuto} conciliado(s), ${data.pendentesRevisao} pendente(s).`
      )
      invalidateTudo()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao importar extrato.'),
  })

  function invalidateTudo() {
    queryClient.invalidateQueries({ queryKey: ['conciliacao-pendentes'] })
    queryClient.invalidateQueries({ queryKey: ['conciliacao-importacao'] })
  }

  function openImport() {
    setImportConta(contaBancariaId || '')
    setImportFormato('OFX')
    setImportFile(null)
    setResumo(null)
    setImportOpen(true)
  }

  function handleImportSubmit(e) {
    e.preventDefault()
    if (!importConta) return toast.error('Selecione a conta bancária.')
    if (!importFile) return toast.error('Selecione o arquivo do extrato.')
    importMutation.mutate()
  }

  // ---- Conciliação manual de um pendente do sistema -----------------------
  const manualMutation = useMutation({
    mutationFn: ({ tipo, id }) => api.post('/financeiro/conciliacao/manual', { tipo, id }),
    onSuccess: () => {
      toast.success('Item conciliado manualmente.')
      invalidateTudo()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao conciliar.'),
  })

  // ---- Casar um lançamento do extrato com um pendente ---------------------
  const casarMutation = useMutation({
    mutationFn: ({ lancamentoId, tipo, id }) =>
      api.post(
        `/financeiro/conciliacao/importacoes/${importacaoId}/lancamentos/${lancamentoId}/casar`,
        { tipo, id }
      ),
    onSuccess: () => {
      toast.success('Lançamento pareado com sucesso.')
      setCasarLanc(null)
      invalidateTudo()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao parear lançamento.'),
  })

  const ignorarMutation = useMutation({
    mutationFn: (lancamentoId) =>
      api.post(
        `/financeiro/conciliacao/importacoes/${importacaoId}/lancamentos/${lancamentoId}/ignorar`,
        {}
      ),
    onSuccess: () => {
      toast.success('Lançamento ignorado.')
      invalidateTudo()
    },
    onError: (err) => toast.error(err?.message || 'Erro ao ignorar lançamento.'),
  })

  // Ao casar, só mostramos pendentes compatíveis com o sinal do lançamento:
  // valor > 0 => recebíveis (entrada); valor < 0 => contas a pagar (saída).
  const casarOpcoes = casarLanc
    ? pendentes.filter((p) =>
        Number(casarLanc.valor) >= 0 ? p.tipo === 'RECEBIVEL' : p.tipo === 'CONTA_PAGAR'
      )
    : []

  return (
    <div>
      <PageHeader
        title="Conciliação Bancária"
        subtitle="Importe extratos e concilie recebimentos e pagamentos"
        action={
          <Button icon={Upload} onClick={openImport}>
            Importar extrato
          </Button>
        }
      />

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Select
          containerClassName="w-full sm:w-64"
          label="Conta bancária"
          value={contaBancariaId}
          onChange={(e) => setContaBancariaId(e.target.value)}
        >
          <option value="">Selecione uma conta…</option>
          {contas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
        <Input
          containerClassName="w-full sm:w-44"
          label="De"
          type="date"
          value={de}
          onChange={(e) => setDe(e.target.value)}
        />
        <Input
          containerClassName="w-full sm:w-44"
          label="Até"
          type="date"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
        />
      </div>

      {/* Resumo da importação recente */}
      {resumo && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs uppercase text-gray-400">Total de linhas</p>
              <p className="text-lg font-semibold text-gray-900">{resumo.total}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Conciliados automaticamente</p>
              <p className="text-lg font-semibold text-emerald-600">{resumo.conciliadosAuto}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-400">Pendentes de revisão</p>
              <p className="text-lg font-semibold text-amber-600">{resumo.pendentesRevisao}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Pendentes de conciliação */}
      <Card title="Pendentes de conciliação" className="mb-4">
        {!contaBancariaId ? (
          <EmptyState
            icon={FileCheck2}
            title="Selecione uma conta bancária"
            description="Escolha uma conta para listar os recebimentos e pagamentos ainda não conciliados."
          />
        ) : pendentesQuery.isLoading ? (
          <Spinner />
        ) : pendentes.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nada pendente"
            description="Não há recebimentos ou pagamentos pendentes de conciliação para os filtros atuais."
          />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th>Descrição</Th>
                <Th className="text-right">Valor</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {pendentes.map((p) => (
                <Tr key={`${p.tipo}-${p.id}`}>
                  <Td>{formatDate(p.data)}</Td>
                  <Td>
                    <Badge variant={p.tipo === 'RECEBIVEL' ? 'green' : 'amber'}>
                      {p.tipo === 'RECEBIVEL' ? 'Recebível' : 'Conta a pagar'}
                    </Badge>
                  </Td>
                  <Td>{p.descricao}</Td>
                  <Td className={`text-right font-medium ${p.valor < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatCurrency(p.valor)}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={CheckCircle2}
                        className="text-emerald-600 hover:bg-emerald-50"
                        loading={manualMutation.isPending && manualMutation.variables?.id === p.id}
                        onClick={() => manualMutation.mutate({ tipo: p.tipo, id: p.id })}
                      >
                        Conciliar manualmente
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      {/* Lançamentos da importação selecionada */}
      {importacaoId && (
        <Card
          title={
            importacao
              ? `Lançamentos do extrato — ${importacao.nomeArquivo}`
              : 'Lançamentos do extrato'
          }
        >
          {importacaoQuery.isLoading ? (
            <Spinner />
          ) : !importacao || importacao.lancamentos.length === 0 ? (
            <EmptyState
              icon={FileCheck2}
              title="Sem lançamentos"
              description="Esta importação não gerou lançamentos."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {importacao.lancamentos.map((l) => {
                  const badge = STATUS_BADGE[l.status] || STATUS_BADGE.PENDENTE
                  const valor = Number(l.valor)
                  return (
                    <Tr key={l.id}>
                      <Td>{formatDate(l.data)}</Td>
                      <Td>{l.descricao || '-'}</Td>
                      <Td className={`text-right font-medium ${valor < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {formatCurrency(valor)}
                      </Td>
                      <Td>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {l.status === 'PENDENTE' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Link2}
                                onClick={() => setCasarLanc({ id: l.id, valor })}
                              >
                                Casar com…
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Ban}
                                className="text-gray-500 hover:bg-gray-100"
                                loading={ignorarMutation.isPending && ignorarMutation.variables === l.id}
                                onClick={() => ignorarMutation.mutate(l.id)}
                              >
                                Ignorar
                              </Button>
                            </>
                          )}
                          {l.status === 'CONCILIADO' && (
                            <span className="text-xs text-gray-400">
                              {l.recebivel?.descricao || l.contaPagar?.descricao || 'Vinculado'}
                            </span>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Modal: importar extrato */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar extrato bancário"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)} disabled={importMutation.isPending}>
              Fechar
            </Button>
            <Button onClick={handleImportSubmit} loading={importMutation.isPending}>
              Importar
            </Button>
          </>
        }
      >
        <form onSubmit={handleImportSubmit} className="space-y-4">
          <Select
            label="Conta bancária *"
            value={importConta}
            onChange={(e) => setImportConta(e.target.value)}
          >
            <option value="">Selecione…</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>

          <Select label="Formato *" value={importFormato} onChange={(e) => setImportFormato(e.target.value)}>
            <option value="OFX">OFX (.ofx)</option>
            <option value="CSV">CSV (.csv)</option>
          </Select>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Arquivo *</label>
            <input
              type="file"
              accept={importFormato === 'OFX' ? '.ofx,text/*' : '.csv,text/csv,text/*'}
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {importFormato === 'CSV' && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Formato CSV esperado: <code className="font-mono">data,valor,descricao</code> — uma transação por
              linha. Data em <code>DD/MM/AAAA</code> ou <code>AAAA-MM-DD</code>; valor positivo para entradas e
              negativo para saídas. A linha de cabeçalho é opcional.
            </p>
          )}

          {resumo && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Importado: {resumo.total} linha(s) · {resumo.conciliadosAuto} conciliada(s) automaticamente ·{' '}
              {resumo.pendentesRevisao} pendente(s) de revisão.
            </div>
          )}
        </form>
      </Modal>

      {/* Modal: casar lançamento com pendente */}
      <Modal
        open={!!casarLanc}
        onClose={() => setCasarLanc(null)}
        title="Casar lançamento com pendente"
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setCasarLanc(null)}>
            Cancelar
          </Button>
        }
      >
        {casarLanc && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Selecione o {Number(casarLanc.valor) >= 0 ? 'recebível' : 'pagamento'} correspondente a este
              lançamento (<strong>{formatCurrency(casarLanc.valor)}</strong>):
            </p>
            {casarOpcoes.length === 0 ? (
              <EmptyState
                icon={RotateCcw}
                title="Nenhum pendente compatível"
                description="Não há itens pendentes com o mesmo sinal para parear. Ajuste os filtros de conta/período acima."
              />
            ) : (
              <Table>
                <Thead>
                  <Tr>
                    <Th>Data</Th>
                    <Th>Descrição</Th>
                    <Th className="text-right">Valor</Th>
                    <Th className="text-right">Ação</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {casarOpcoes.map((p) => (
                    <Tr key={`${p.tipo}-${p.id}`}>
                      <Td>{formatDate(p.data)}</Td>
                      <Td>{p.descricao}</Td>
                      <Td className="text-right font-medium">{formatCurrency(p.valor)}</Td>
                      <Td>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            icon={Link2}
                            loading={casarMutation.isPending && casarMutation.variables?.id === p.id}
                            onClick={() =>
                              casarMutation.mutate({ lancamentoId: casarLanc.id, tipo: p.tipo, id: p.id })
                            }
                          >
                            Casar
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
