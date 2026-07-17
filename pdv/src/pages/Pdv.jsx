import { useEffect, useRef, useState } from 'react'
import {
  Search, Trash2, Plus, Minus, LogOut, ArrowDownCircle, ArrowUpCircle,
  Lock, ShoppingCart, X, User, Package, Image as ImageIcon, Receipt, UserPlus, Ban,
} from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { formatCurrency, labelForma, fotoSrc } from '../lib/format.js'
import {
  toCents, fromCents, calcSubtotal, calcTotal, somaPagamentos, estimarTaxa,
} from './pdvMath.js'
import AprovacaoGerente from './AprovacaoGerente.jsx'

export default function Pdv() {
  const [caixa, setCaixa] = useState(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    api.get('/caixa/atual').then(setCaixa).finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return <div className="flex h-screen items-center justify-center text-gray-500">Carregando…</div>
  }
  if (!caixa) return <AbrirCaixa onAberto={setCaixa} />
  return <FrenteCaixa caixa={caixa} onFechado={() => setCaixa(null)} />
}

// ---------------------------------------------------------------------------
function AbrirCaixa({ onAberto }) {
  const { logout, user } = useAuth()
  const toast = useToast()
  const [lojas, setLojas] = useState([])
  const [lojaId, setLojaId] = useState('')
  const [terminalId, setTerminalId] = useState('')
  const [valor, setValor] = useState('0')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api.get('/lojas').then((ls) => {
      setLojas(ls)
      const matriz = ls.find((l) => l.matriz) || ls[0]
      if (matriz) {
        setLojaId(matriz.id)
        if (matriz.terminais?.[0]) setTerminalId(matriz.terminais[0].id)
      }
    }).catch(() => {})
  }, [])

  const terminais = lojas.find((l) => l.id === lojaId)?.terminais || []

  async function abrir(e) {
    e.preventDefault()
    setSalvando(true)
    try {
      const c = await api.post('/caixa/abrir', {
        valorAbertura: Number(valor) || 0,
        lojaId: lojaId || null,
        pdvTerminalId: terminalId || null,
      })
      onAberto(c)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <form onSubmit={abrir} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Abrir Caixa</h1>
            <p className="text-sm text-gray-500">{user?.nome}</p>
          </div>
          <button type="button" onClick={logout} className="text-gray-400 hover:text-gray-600" title="Sair">
            <LogOut size={20} />
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">Loja</label>
        <select value={lojaId} onChange={(e) => { setLojaId(e.target.value); setTerminalId('') }}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2">
          {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
        </select>

        <label className="mb-1 block text-sm font-medium text-gray-700">Terminal de PDV</label>
        <select value={terminalId} onChange={(e) => setTerminalId(e.target.value)}
          className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2">
          <option value="">— (sem terminal) —</option>
          {terminais.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>

        <label className="mb-1 block text-sm font-medium text-gray-700">Valor de abertura (troco)</label>
        <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)}
          className="mb-6 w-full rounded-lg border border-gray-300 px-3 py-2" />

        <button type="submit" disabled={salvando}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {salvando ? 'Abrindo…' : 'Abrir Caixa'}
        </button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
function FrenteCaixa({ caixa, onFechado }) {
  const { logout, user } = useAuth()
  const toast = useToast()

  const [termo, setTermo] = useState('')
  const [resultados, setResultados] = useState([])
  const [itens, setItens] = useState([])
  const [desconto, setDesconto] = useState(0)
  const [acrescimo, setAcrescimo] = useState(0)
  const [cliente, setCliente] = useState(null)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesEnc, setClientesEnc] = useState([])
  const [vendedor, setVendedor] = useState(null)
  const [vendedores, setVendedores] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [adquirentes, setAdquirentes] = useState([])
  const [finalizando, setFinalizando] = useState(false)
  const [comprovante, setComprovante] = useState(null)
  const [modalCaixa, setModalCaixa] = useState(null) // 'SANGRIA' | 'SUPRIMENTO' | 'FECHAR'
  const [versaoVitrine, setVersaoVitrine] = useState(0) // recarrega a vitrine após vendas
  const [pickerBusca, setPickerBusca] = useState(null) // produto da busca aguardando escolha de tamanho/cor
  const [cfgPdv, setCfgPdv] = useState(null)
  const [aprovadorDesconto, setAprovadorDesconto] = useState(null) // { id, nome }
  const [pedirAprovacaoDesconto, setPedirAprovacaoDesconto] = useState(false)
  const [mostrarVendas, setMostrarVendas] = useState(false)
  const [mostrarCadastroCliente, setMostrarCadastroCliente] = useState(false)
  const [cfgCliente, setCfgCliente] = useState(null)

  useEffect(() => { api.get('/adquirentes').then(setAdquirentes).catch(() => {}) }, [])
  useEffect(() => { api.get('/vendas/vendedores').then(setVendedores).catch(() => {}) }, [])
  useEffect(() => { api.get('/config/pdv').then(setCfgPdv).catch(() => {}) }, [])
  useEffect(() => { api.get('/config/cliente').then(setCfgCliente).catch(() => {}) }, [])

  const descontoHabilitado = cfgPdv?.descontoHabilitado !== false
  const descontoMaxPercentual = cfgPdv?.descontoMaximoPercentual != null ? Number(cfgPdv.descontoMaximoPercentual) : null

  // Sempre que o desconto (venda ou item) deixa de ser zero, exige nova
  // aprovação — evita reaproveitar a aprovação de uma venda anterior.
  useEffect(() => {
    if (Number(desconto) <= 0) setAprovadorDesconto(null)
  }, [desconto])

  // Busca de produtos (debounce simples)
  useEffect(() => {
    if (!termo.trim()) { setResultados([]); return }
    const t = setTimeout(() => {
      api.get(`/produtos/busca?q=${encodeURIComponent(termo)}`).then(setResultados).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [termo])

  useEffect(() => {
    if (!buscaCliente.trim()) { setClientesEnc([]); return }
    const t = setTimeout(() => {
      api.get(`/clientes?q=${encodeURIComponent(buscaCliente)}`).then(setClientesEnc).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [buscaCliente])

  const subtotal = calcSubtotal(itens)
  const totalCents = calcTotal(itens, desconto, acrescimo)
  const pagoCents = somaPagamentos(pagamentos)
  const restanteCents = totalCents - pagoCents

  function precoVariacao(v) {
    return Number(v.precoVenda ?? v.produto?.precoVenda ?? 0)
  }

  function adicionar(v) {
    setItens((prev) => {
      const ix = prev.findIndex((i) => i.variacaoId === v.id)
      if (ix >= 0) {
        if (cfgPdv?.bloquearVendaSemEstoque && prev[ix].quantidade + 1 > (v.estoqueAtual ?? prev[ix].estoque)) {
          toast.error('Estoque insuficiente para adicionar mais unidades deste item')
          return prev
        }
        const cp = [...prev]
        cp[ix] = { ...cp[ix], quantidade: cp[ix].quantidade + 1 }
        return cp
      }
      if (cfgPdv?.bloquearVendaSemEstoque && (v.estoqueAtual ?? 0) < 1) {
        toast.error('Item sem estoque disponível')
        return prev
      }
      return [...prev, {
        variacaoId: v.id,
        nome: v.produto?.nome || 'Produto',
        detalhe: `${v.tamanho} · ${v.cor}`,
        sku: v.sku,
        estoque: v.estoqueAtual,
        fotoUrl: v.produto?.fotoUrl || null,
        precoUnit: precoVariacao(v),
        desconto: 0,
        quantidade: 1,
      }]
    })
    setTermo('')
    setResultados([])
  }

  // Resultado da busca é sempre o produto principal; se tiver mais de uma
  // variação em estoque, abre o seletor de tamanho/cor antes de adicionar.
  function escolherResultado(prod) {
    const vs = prod.variacoes || []
    if (vs.length === 1) {
      adicionar({ ...vs[0], produto: { nome: prod.nome, precoVenda: prod.precoVenda, fotoUrl: prod.fotoUrl } })
    } else {
      setPickerBusca(prod)
    }
  }

  function escolherVariacaoBusca(v) {
    adicionar({ ...v, produto: { nome: pickerBusca.nome, precoVenda: pickerBusca.precoVenda, fotoUrl: pickerBusca.fotoUrl } })
    setPickerBusca(null)
  }

  function mudarQtd(ix, delta) {
    setItens((prev) => {
      const cp = [...prev]
      const nova = cp[ix].quantidade + delta
      if (nova <= 0) return cp.filter((_, i) => i !== ix)
      if (delta > 0 && cfgPdv?.bloquearVendaSemEstoque && nova > cp[ix].estoque) {
        toast.error('Estoque insuficiente para adicionar mais unidades deste item')
        return prev
      }
      cp[ix] = { ...cp[ix], quantidade: nova }
      return cp
    })
  }

  function removerItem(ix) {
    setItens((prev) => prev.filter((_, i) => i !== ix))
  }

  function addPagamento(forma) {
    const restante = Math.max(fromCents(restanteCents), 0)
    setPagamentos((prev) => [...prev, {
      forma,
      valor: restante ? restante.toFixed(2) : '0',
      adquirenteId: forma === 'DINHEIRO' ? null : '',
      parcelas: 1,
    }])
  }

  function mudarPagamento(ix, patch) {
    setPagamentos((prev) => prev.map((p, i) => (i === ix ? { ...p, ...patch } : p)))
  }

  function removerPagamento(ix) {
    setPagamentos((prev) => prev.filter((_, i) => i !== ix))
  }

  async function finalizar(aprovadorOverride) {
    if (!itens.length) return toast.error('Adicione ao menos um item')
    if (Math.abs(restanteCents) > 0) return toast.error('Os pagamentos não fecham com o total')
    if (pagamentos.some((p) => p.forma !== 'DINHEIRO' && !p.adquirenteId)) {
      return toast.error('Selecione a adquirente dos pagamentos com cartão/pix/link')
    }
    const descontoNum = Number(desconto) || 0
    const aprovador = aprovadorOverride ?? aprovadorDesconto
    if (descontoNum > 0) {
      if (!descontoHabilitado) return toast.error('Desconto está desabilitado nas configurações do PDV')
      if (descontoMaxPercentual != null && subtotal > 0) {
        const pct = (descontoNum / fromCents(subtotal)) * 100
        if (pct > descontoMaxPercentual) {
          return toast.error(`Desconto acima do limite permitido (${descontoMaxPercentual}%)`)
        }
      }
      if (cfgPdv?.exigirGerenteDesconto && !aprovador) {
        setPedirAprovacaoDesconto(true)
        return
      }
    }
    setFinalizando(true)
    try {
      const venda = await api.post('/vendas', {
        caixaId: caixa.id,
        lojaId: caixa.lojaId || null,
        pdvTerminalId: caixa.pdvTerminalId || null,
        clienteId: cliente?.id || null,
        vendedorId: vendedor?.id || null,
        desconto: descontoNum,
        acrescimo: Number(acrescimo) || 0,
        aprovadorId: aprovador?.id || null,
        itens: itens.map((i) => ({
          variacaoId: i.variacaoId,
          quantidade: i.quantidade,
          precoUnit: Number(i.precoUnit),
          desconto: Number(i.desconto) || 0,
        })),
        pagamentos: pagamentos.map((p) => ({
          forma: p.forma,
          valor: Number(p.valor),
          parcelas: p.forma === 'CREDITO' ? Number(p.parcelas) || 1 : 1,
          adquirenteId: p.adquirenteId || null,
        })),
      })
      setComprovante(venda)
      setItens([]); setPagamentos([]); setDesconto(0); setAcrescimo(0); setCliente(null)
      setVendedor(null)
      setAprovadorDesconto(null)
      setVersaoVitrine((n) => n + 1)
      toast.success(`Venda #${venda.numero} finalizada`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setFinalizando(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      {/* Topo */}
      <header className="flex items-center justify-between bg-brand-700 px-4 py-2 text-white">
        <div className="flex items-center gap-2">
          <ShoppingCart size={20} />
          <span className="font-bold">SeixasTec — PDV</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setMostrarVendas(true)} className="flex items-center gap-1 rounded bg-white/10 px-3 py-1.5 hover:bg-white/20">
            <Receipt size={16} /> Vendas
          </button>
          <button onClick={() => setModalCaixa('SUPRIMENTO')} className="flex items-center gap-1 rounded bg-white/10 px-3 py-1.5 hover:bg-white/20">
            <ArrowUpCircle size={16} /> Suprimento
          </button>
          <button onClick={() => setModalCaixa('SANGRIA')} className="flex items-center gap-1 rounded bg-white/10 px-3 py-1.5 hover:bg-white/20">
            <ArrowDownCircle size={16} /> Sangria
          </button>
          <button onClick={() => setModalCaixa('FECHAR')} className="flex items-center gap-1 rounded bg-white/10 px-3 py-1.5 hover:bg-white/20">
            <Lock size={16} /> Fechar Caixa
          </button>
          <span className="mx-2 opacity-80">{user?.nome}</span>
          <button onClick={logout} title="Sair" className="rounded p-1.5 hover:bg-white/20"><LogOut size={16} /></button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-5">
        {/* Coluna esquerda: busca + itens */}
        <section className="flex flex-col overflow-hidden rounded-xl bg-white shadow lg:col-span-3">
          <div className="relative border-b p-3">
            <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por nome, SKU ou código de barras…"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 focus:border-brand-500 focus:outline-none"
            />
            {resultados.length > 0 && (
              <div className="absolute left-3 right-3 z-10 mt-1 max-h-72 overflow-auto rounded-lg border bg-white shadow-lg">
                {resultados.map((p) => {
                  const estoqueTotal = (p.variacoes || []).reduce((s, v) => s + (v.estoqueAtual || 0), 0)
                  return (
                    <button key={p.id} onClick={() => escolherResultado(p)}
                      className="flex w-full items-center gap-3 border-b px-3 py-2 text-left last:border-0 hover:bg-brand-50">
                      <Thumb src={fotoSrc(p.fotoUrl)} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.nome}</div>
                        <div className="text-xs text-gray-500">Estoque: {estoqueTotal}</div>
                      </div>
                      <span className="text-sm font-semibold text-brand-700">{formatCurrency(p.precoVenda)}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {pickerBusca && (
              <PickerVariacao prod={pickerBusca} onEscolher={escolherVariacaoBusca} onClose={() => setPickerBusca(null)} />
            )}
          </div>

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="max-h-[45%] flex-none overflow-auto border-b">
            {itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <ShoppingCart size={32} />
                <p className="mt-2 text-sm">Nenhum item na venda</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-center">Qtd</th>
                    <th className="px-3 py-2 text-right">Preço</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i, ix) => (
                    <tr key={ix} className="border-b">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Thumb src={fotoSrc(i.fotoUrl)} size={36} />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{i.nome}</div>
                            <div className="text-xs text-gray-500">{i.detalhe} · {i.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => mudarQtd(ix, -1)} className="rounded bg-gray-100 p-1 hover:bg-gray-200"><Minus size={14} /></button>
                          <span className="w-6 text-center">{i.quantidade}</span>
                          <button onClick={() => mudarQtd(ix, 1)} className="rounded bg-gray-100 p-1 hover:bg-gray-200"><Plus size={14} /></button>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(i.precoUnit)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(i.precoUnit * i.quantidade)}</td>
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => removerItem(ix)} className="text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
            <Vitrine versao={versaoVitrine} onEscolher={adicionar} />
          </div>
        </section>

        {/* Coluna direita: resumo + pagamento */}
        <aside className="flex flex-col overflow-hidden rounded-xl bg-white shadow lg:col-span-2">
          <div className="flex-1 overflow-auto p-4">
            {/* Cliente */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Cliente</label>
              {cliente ? (
                <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2"><User size={14} /> {cliente.nome}</span>
                  <button onClick={() => setCliente(null)} className="text-gray-400 hover:text-red-600"><X size={16} /></button>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="relative flex-1">
                    <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)}
                      placeholder="Buscar cliente (opcional)…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                    {clientesEnc.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border bg-white shadow">
                        {clientesEnc.map((c) => (
                          <button key={c.id} onClick={() => { setCliente(c); setBuscaCliente(''); setClientesEnc([]) }}
                            className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-brand-50">
                            {c.nome}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setMostrarCadastroCliente(true)}
                    className="flex items-center gap-1 whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">
                    <UserPlus size={14} /> Novo
                  </button>
                </div>
              )}
            </div>

            {/* Vendedor */}
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Vendedor</label>
              <select
                value={vendedor?.id || ''}
                onChange={(e) => {
                  const v = vendedores.find((x) => x.id === e.target.value)
                  setVendedor(v ? { id: v.id, nome: v.nome } : null)
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">— Sem vendedor —</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>{v.nome}</option>
                ))}
              </select>
            </div>

            {/* Totais */}
            <div className="mb-3 space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
              <Linha label="Subtotal" valor={formatCurrency(fromCents(subtotal))} />
              {descontoHabilitado && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">
                    Desconto{descontoMaxPercentual != null ? ` (máx. ${descontoMaxPercentual}%)` : ''}
                  </span>
                  <input type="number" step="0.01" min="0" value={desconto} onChange={(e) => setDesconto(e.target.value)}
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-right" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Acréscimo</span>
                <input type="number" step="0.01" min="0" value={acrescimo} onChange={(e) => setAcrescimo(e.target.value)}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-right" />
              </div>
              <div className="mt-1 flex items-center justify-between border-t pt-2 text-lg font-bold">
                <span>Total</span>
                <span className="text-brand-700">{formatCurrency(fromCents(totalCents))}</span>
              </div>
            </div>

            {/* Pagamentos */}
            <div className="mb-2">
              <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Pagamentos</label>
              <div className="mb-2 grid grid-cols-3 gap-1">
                {Object.keys(labelForma).map((f) => (
                  <button key={f} onClick={() => addPagamento(f)}
                    className="rounded border border-gray-200 px-2 py-1.5 text-xs hover:bg-brand-50 hover:text-brand-700">
                    {labelForma[f]}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {pagamentos.map((p, ix) => (
                  <PagamentoLinha key={ix} p={p} ix={ix} adquirentes={adquirentes}
                    onChange={mudarPagamento} onRemove={removerPagamento} />
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <Linha label="Pago" valor={formatCurrency(fromCents(pagoCents))} />
              <Linha
                label={restanteCents > 0 ? 'Falta' : restanteCents < 0 ? 'Troco' : 'Restante'}
                valor={formatCurrency(Math.abs(fromCents(restanteCents)))}
                destaque={restanteCents !== 0}
              />
            </div>
          </div>

          <div className="border-t p-3">
            <button onClick={finalizar} disabled={finalizando || !itens.length || restanteCents !== 0}
              className="w-full rounded-lg bg-emerald-600 py-3 text-lg font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">
              {finalizando ? 'Finalizando…' : 'Finalizar Venda'}
            </button>
          </div>
        </aside>
      </div>

      {modalCaixa && (
        <ModalCaixa tipo={modalCaixa} caixa={caixa} cfgPdv={cfgPdv} onClose={() => setModalCaixa(null)} onFechado={onFechado} />
      )}
      {comprovante && (
        <Comprovante
          venda={comprovante}
          cfgPdv={cfgPdv}
          onClose={() => setComprovante(null)}
          onCancelado={() => { setComprovante(null); setVersaoVitrine((n) => n + 1) }}
        />
      )}
      {pedirAprovacaoDesconto && (
        <AprovacaoGerente
          titulo="Aprovação de desconto"
          onClose={() => setPedirAprovacaoDesconto(false)}
          onConfirm={(id, nome) => {
            setAprovadorDesconto({ id, nome })
            setPedirAprovacaoDesconto(false)
            // finaliza automaticamente após a aprovação
            finalizar({ id, nome })
          }}
        />
      )}
      {mostrarVendas && (
        <UltimasVendas
          caixaId={caixa.id}
          cfgPdv={cfgPdv}
          onClose={() => setMostrarVendas(false)}
          onVendaCancelada={() => setVersaoVitrine((n) => n + 1)}
        />
      )}
      {mostrarCadastroCliente && (
        <CadastroRapidoCliente
          cfgCliente={cfgCliente}
          onClose={() => setMostrarCadastroCliente(false)}
          onCriado={(c) => { setCliente(c); setMostrarCadastroCliente(false) }}
        />
      )}
    </div>
  )
}

function Linha({ label, valor, destaque }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={destaque ? 'font-bold text-amber-600' : 'font-medium'}>{valor}</span>
    </div>
  )
}

function PagamentoLinha({ p, ix, adquirentes, onChange, onRemove }) {
  const precisaAdquirente = p.forma !== 'DINHEIRO'
  const { taxaValor, liquido } = estimarTaxa(
    { ...p, valor: Number(p.valor), parcelas: Number(p.parcelas) }, adquirentes
  )
  return (
    <div className="rounded-lg border p-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{labelForma[p.forma]}</span>
        <button onClick={() => onRemove(ix)} className="text-gray-400 hover:text-red-600"><X size={16} /></button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input type="number" step="0.01" min="0" value={p.valor}
          onChange={(e) => onChange(ix, { valor: e.target.value })}
          className="w-24 rounded border border-gray-300 px-2 py-1 text-right text-sm" />
        {precisaAdquirente && (
          <select value={p.adquirenteId || ''} onChange={(e) => onChange(ix, { adquirenteId: e.target.value })}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm">
            <option value="">Adquirente…</option>
            {adquirentes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        )}
        {p.forma === 'CREDITO' && (
          <select value={p.parcelas} onChange={(e) => onChange(ix, { parcelas: Number(e.target.value) })}
            className="rounded border border-gray-300 px-2 py-1 text-sm">
            {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => <option key={n} value={n}>{n}x</option>)}
          </select>
        )}
      </div>
      {precisaAdquirente && p.adquirenteId && (
        <div className="mt-1 text-xs text-gray-500">
          Taxa: {formatCurrency(fromCents(taxaValor))} · Líquido: {formatCurrency(fromCents(liquido))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
function ModalCaixa({ tipo, caixa, cfgPdv, onClose, onFechado }) {
  const toast = useToast()
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [resumo, setResumo] = useState(null)
  const [pedirAprovacao, setPedirAprovacao] = useState(false)
  const [aprovadorId, setAprovadorId] = useState(null)

  async function confirmar(aprovadorIdOverride) {
    const idAprovador = aprovadorIdOverride ?? aprovadorId
    if (tipo === 'FECHAR' && cfgPdv?.exigirAprovacaoFechamento && !idAprovador) {
      setPedirAprovacao(true)
      return
    }
    setSalvando(true)
    try {
      if (tipo === 'FECHAR') {
        const r = await api.post(`/caixa/${caixa.id}/fechar`, {
          valorFechamento: Number(valor) || 0,
          observacao: motivo || null,
          aprovadorId: idAprovador,
        })
        setResumo(r.resumo)
      } else {
        await api.post(`/caixa/${caixa.id}/movimento`, {
          tipo,
          valor: Number(valor),
          motivo: motivo || null,
        })
        toast.success(tipo === 'SANGRIA' ? 'Sangria registrada' : 'Suprimento registrado')
        onClose()
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  const titulo = tipo === 'FECHAR' ? 'Fechar Caixa' : tipo === 'SANGRIA' ? 'Sangria' : 'Suprimento'

  if (pedirAprovacao) {
    return (
      <AprovacaoGerente
        titulo="Aprovação de fechamento de caixa"
        onClose={() => setPedirAprovacao(false)}
        onConfirm={(id) => {
          setAprovadorId(id)
          setPedirAprovacao(false)
          confirmar(id)
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold">{titulo}</h2>

        {resumo ? (
          <div className="space-y-2 text-sm">
            <Linha label="Abertura" valor={formatCurrency(resumo.valorAbertura)} />
            <Linha label="Vendas em dinheiro" valor={formatCurrency(resumo.dinheiroVendas)} />
            <Linha label="Suprimentos" valor={formatCurrency(resumo.suprimentos)} />
            <Linha label="Sangrias" valor={formatCurrency(resumo.sangrias)} />
            <Linha label="Esperado em caixa" valor={formatCurrency(resumo.esperadoDinheiro)} />
            <Linha label="Informado" valor={formatCurrency(resumo.informado)} />
            <div className="border-t pt-2">
              <Linha label="Diferença" valor={formatCurrency(resumo.diferenca)} destaque={Math.abs(resumo.diferenca) > 0.001} />
            </div>
            <button onClick={onFechado} className="mt-4 w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700">
              Concluir
            </button>
          </div>
        ) : (
          <>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {tipo === 'FECHAR' ? 'Valor contado em dinheiro' : 'Valor'}
            </label>
            <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
              className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2" />
            <label className="mb-1 block text-sm font-medium text-gray-700">Observação</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)}
              className="mb-6 w-full rounded-lg border border-gray-300 px-3 py-2" />
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg border py-2.5 font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmar} disabled={salvando}
                className="flex-1 rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                Confirmar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
function Comprovante({ venda, cfgPdv, onClose, onCancelado }) {
  const toast = useToast()
  const [cancelando, setCancelando] = useState(false)
  const [pedirAprovacao, setPedirAprovacao] = useState(false)

  async function cancelar(aprovadorId) {
    if (!window.confirm(`Cancelar a venda #${venda.numero}? O estoque será devolvido.`)) return
    if (cfgPdv?.exigirGerenteCancelamento && !aprovadorId) {
      setPedirAprovacao(true)
      return
    }
    setCancelando(true)
    try {
      await api.post(`/vendas/${venda.id}/cancelar`, { aprovadorId: aprovadorId || null })
      toast.success(`Venda #${venda.numero} cancelada`)
      onCancelado()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCancelando(false)
    }
  }

  if (pedirAprovacao) {
    return (
      <AprovacaoGerente
        titulo="Cancelamento de venda"
        onClose={() => setPedirAprovacao(false)}
        onConfirm={(id) => { setPedirAprovacao(false); cancelar(id) }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <ShoppingCart size={24} />
          </div>
          <h2 className="text-lg font-bold">Venda #{venda.numero}</h2>
          <p className="text-sm text-gray-500">Finalizada com sucesso</p>
        </div>
        <div className="max-h-52 overflow-auto border-y py-2 text-sm">
          {venda.itens?.map((i) => (
            <div key={i.id} className="flex justify-between py-1">
              <span>{i.quantidade}x {i.variacao?.produto?.nome}</span>
              <span>{formatCurrency(i.total)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between py-2 text-lg font-bold">
          <span>Total</span>
          <span className="text-brand-700">{formatCurrency(venda.total)}</span>
        </div>
        <button onClick={onClose} className="mt-2 w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700">
          Nova Venda
        </button>
        <button onClick={() => cancelar(null)} disabled={cancelando}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
          <Ban size={14} /> {cancelando ? 'Cancelando…' : 'Cancelar venda'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Painel "Últimas vendas" do caixa atual, com cancelamento (estorna estoque
// e recebíveis no backend). Reusa AprovacaoGerente quando exigido pela config.
function UltimasVendas({ caixaId, cfgPdv, onClose, onVendaCancelada }) {
  const toast = useToast()
  const [vendas, setVendas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [cancelandoId, setCancelandoId] = useState(null)
  const [pedirAprovacaoPara, setPedirAprovacaoPara] = useState(null) // venda aguardando aprovação

  function carregar() {
    setCarregando(true)
    api.get(`/vendas?caixaId=${caixaId}`).then(setVendas).catch((err) => toast.error(err.message)).finally(() => setCarregando(false))
  }

  useEffect(() => { carregar() /* eslint-disable-next-line */ }, [caixaId])

  async function cancelar(venda, aprovadorId) {
    setCancelandoId(venda.id)
    try {
      await api.post(`/vendas/${venda.id}/cancelar`, { aprovadorId: aprovadorId || null })
      toast.success(`Venda #${venda.numero} cancelada`)
      onVendaCancelada()
      carregar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCancelandoId(null)
    }
  }

  function pedirCancelamento(venda) {
    if (!window.confirm(`Cancelar a venda #${venda.numero}? O estoque será devolvido.`)) return
    if (cfgPdv?.exigirGerenteCancelamento) {
      setPedirAprovacaoPara(venda)
      return
    }
    cancelar(venda, null)
  }

  if (pedirAprovacaoPara) {
    return (
      <AprovacaoGerente
        titulo="Cancelamento de venda"
        onClose={() => setPedirAprovacaoPara(null)}
        onConfirm={(id) => { const v = pedirAprovacaoPara; setPedirAprovacaoPara(null); cancelar(v, id) }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Receipt size={20} /> Vendas do caixa</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-auto">
          {carregando ? (
            <p className="py-6 text-center text-sm text-gray-400">Carregando…</p>
          ) : vendas.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhuma venda neste caixa</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Hora</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => {
                  const cancelada = v.status === 'CANCELADA'
                  return (
                    <tr key={v.id} className="border-b">
                      <td className="px-3 py-2 font-medium">{v.numero}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {new Date(v.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2">{v.cliente?.nome || '—'}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(v.total)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          cancelada ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {cancelada ? 'CANCELADA' : v.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!cancelada && (
                          <button onClick={() => pedirCancelamento(v)} disabled={cancelandoId === v.id}
                            className="flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60">
                            <Ban size={12} /> {cancelandoId === v.id ? 'Cancelando…' : 'Cancelar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cadastro rápido de cliente direto do PDV. Espelha a validação do backend
// (POST /clientes) para dar feedback imediato antes do submit.
function CadastroRapidoCliente({ cfgCliente, onClose, onCriado }) {
  const toast = useToast()
  const [form, setForm] = useState({
    nome: '', cpfCnpj: '', email: '', telefone: '',
    cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  })
  const [salvando, setSalvando] = useState(false)

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  const digitos = (form.cpfCnpj || '').replace(/\D/g, '')
  const ehPJ = digitos.length === 14
  const aplicavel = cfgCliente?.aplicarNoPdv !== false
  const listaObrigatorios = aplicavel
    ? (ehPJ ? (cfgCliente?.camposObrigatoriosPJ || []) : (cfgCliente?.camposObrigatoriosPF || []))
    : []
  const obrigatorio = (campo) => listaObrigatorios.includes(campo)

  function validar() {
    const faltando = []
    if (!form.nome.trim()) faltando.push('nome')
    for (const campo of listaObrigatorios) {
      if (campo === 'endereco') {
        const completo = form.cep && form.logradouro && form.numero && form.cidade && form.uf
        if (!completo) faltando.push('endereco')
      } else if (!form[campo]) {
        faltando.push(campo)
      }
    }
    return faltando
  }

  async function salvar(e) {
    e.preventDefault()
    const faltando = validar()
    if (faltando.length) {
      toast.error(`Campos obrigatórios não preenchidos: ${faltando.join(', ')}`)
      return
    }
    setSalvando(true)
    try {
      const payload = {
        ...form,
        email: form.email || null,
        cpfCnpj: form.cpfCnpj || null,
      }
      const cliente = await api.post('/clientes', payload)
      toast.success('Cliente cadastrado')
      onCriado(cliente)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><UserPlus size={20} /> Novo cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form onSubmit={salvar} className="flex-1 overflow-auto pr-1">
          <Campo label="Nome" obrigatorio value={form.nome} onChange={(v) => set('nome', v)} autoFocus />
          <Campo label="CPF/CNPJ" obrigatorio={obrigatorio('cpfCnpj')} value={form.cpfCnpj} onChange={(v) => set('cpfCnpj', v)} />
          <Campo label="E-mail" obrigatorio={obrigatorio('email')} type="email" value={form.email} onChange={(v) => set('email', v)} />
          <Campo label="Telefone" obrigatorio={obrigatorio('telefone')} value={form.telefone} onChange={(v) => set('telefone', v)} />

          <div className="mb-1 mt-3 text-xs font-semibold uppercase text-gray-500">
            Endereço{obrigatorio('endereco') ? ' *' : ''}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Campo label="CEP" value={form.cep} onChange={(v) => set('cep', v)} compact />
            <div className="col-span-2">
              <Campo label="Logradouro" value={form.logradouro} onChange={(v) => set('logradouro', v)} compact />
            </div>
            <Campo label="Número" value={form.numero} onChange={(v) => set('numero', v)} compact />
            <Campo label="Complemento" value={form.complemento} onChange={(v) => set('complemento', v)} compact />
            <Campo label="Bairro" value={form.bairro} onChange={(v) => set('bairro', v)} compact />
            <div className="col-span-2">
              <Campo label="Cidade" value={form.cidade} onChange={(v) => set('cidade', v)} compact />
            </div>
            <Campo label="UF" value={form.uf} onChange={(v) => set('uf', v.toUpperCase().slice(0, 2))} compact />
          </div>

          <div className="mt-6 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border py-2.5 font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={salvando}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {salvando ? 'Salvando…' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Campo({ label, obrigatorio, value, onChange, type = 'text', compact, autoFocus }) {
  return (
    <div className={compact ? 'mb-2' : 'mb-3'}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}{obrigatorio ? ' *' : ''}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Miniatura de imagem com placeholder.
function Thumb({ src, size = 40, fill = false }) {
  const [erro, setErro] = useState(false)
  const ok = src && !erro
  if (fill) {
    return ok
      ? <img src={src} alt="" onError={() => setErro(true)} className="h-full w-full object-cover" />
      : <div className="flex h-full w-full items-center justify-center text-gray-300"><Package size={28} /></div>
  }
  const s = { width: size, height: size }
  return ok
    ? <img src={src} alt="" style={s} onError={() => setErro(true)} className="shrink-0 rounded object-cover" />
    : <div style={s} className="flex shrink-0 items-center justify-center rounded bg-gray-100 text-gray-300"><ImageIcon size={Math.round(size * 0.45)} /></div>
}

// Vitrine inferior: produtos com estoque, ordenados pelos últimos vendidos,
// com scroll infinito. Clique adiciona (ou abre seletor de tamanho/cor).
function Vitrine({ versao, onEscolher }) {
  const [itens, setItens] = useState([])
  const [next, setNext] = useState(0)
  const [carregando, setCarregando] = useState(false)
  const [picker, setPicker] = useState(null)
  const carregandoRef = useRef(false)

  async function carregar(off, reset = false) {
    if (carregandoRef.current) return
    carregandoRef.current = true
    setCarregando(true)
    try {
      const r = await api.get(`/produtos/vitrine?offset=${off}&limit=24`)
      setItens((prev) => (reset ? r.data : [...prev, ...r.data]))
      setNext(r.nextOffset)
    } catch { /* silencioso */ } finally {
      carregandoRef.current = false
      setCarregando(false)
    }
  }

  useEffect(() => { carregar(0, true) /* recarrega quando `versao` muda */ // eslint-disable-next-line
  }, [versao])

  function onScroll(e) {
    const el = e.currentTarget
    if (next != null && !carregandoRef.current && el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
      carregar(next)
    }
  }

  function escolher(prod) {
    const vs = prod.variacoes || []
    if (vs.length === 1) adicionar(prod, vs[0])
    else setPicker(prod)
  }

  function adicionar(prod, v) {
    onEscolher({
      id: v.id, tamanho: v.tamanho, cor: v.cor, sku: v.sku,
      precoVenda: v.precoVenda, estoqueAtual: v.estoqueAtual,
      produto: { nome: prod.nome, precoVenda: prod.precoVenda, fotoUrl: prod.fotoUrl },
    })
    setPicker(null)
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase text-gray-500">
        <Package size={14} /> Em estoque · últimos vendidos
      </div>
      <div onScroll={onScroll} className="grid flex-1 grid-cols-2 gap-2 overflow-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
        {itens.map((p) => (
          <button key={p.id} onClick={() => escolher(p)}
            className="flex flex-col overflow-hidden rounded-lg border bg-white text-left transition hover:border-brand-400 hover:shadow">
            <div className="aspect-square w-full bg-gray-50">
              <Thumb src={fotoSrc(p.fotoUrl)} fill />
            </div>
            <div className="p-2">
              <div className="truncate text-xs font-medium">{p.nome}</div>
              <div className="mt-0.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-brand-700">{formatCurrency(p.precoVenda)}</span>
                <span className="text-[10px] text-gray-400">Est: {p.estoqueTotal}</span>
              </div>
            </div>
          </button>
        ))}
        {carregando && <div className="col-span-full py-3 text-center text-xs text-gray-400">Carregando…</div>}
        {!carregando && itens.length === 0 && (
          <div className="col-span-full py-6 text-center text-sm text-gray-400">Nenhum produto em estoque</div>
        )}
      </div>
      {picker && <PickerVariacao prod={picker} onEscolher={(v) => adicionar(picker, v)} onClose={() => setPicker(null)} />}
    </div>
  )
}

function PickerVariacao({ prod, onEscolher, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <Thumb src={fotoSrc(prod.fotoUrl)} size={48} />
          <div>
            <div className="font-semibold">{prod.nome}</div>
            <div className="text-sm text-gray-500">Escolha tamanho / cor</div>
          </div>
        </div>
        <div className="grid max-h-72 gap-1 overflow-auto">
          {prod.variacoes.map((v) => (
            <button key={v.id} onClick={() => onEscolher(v)}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-brand-50">
              <span>{v.tamanho} · {v.cor}</span>
              <span className="text-xs text-gray-400">Est: {v.estoqueAtual}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
