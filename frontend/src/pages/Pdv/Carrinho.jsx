import { X, ShoppingCart, Minus, Plus } from 'lucide-react'
import { formatCurrency } from '../../lib/format.js'
import { Table, Thead, Th, Tbody, Td, Tr, EmptyState } from '../../components/ui/index.js'
import { lineTotalCents, toReais } from './pdvMath.js'

function variacaoLabel(item) {
  const partes = [item?.tamanho, item?.cor].filter(Boolean)
  return partes.join(' / ')
}

export default function Carrinho({ itens, onUpdate, onRemove }) {
  if (!itens || itens.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Carrinho vazio"
        description="Busque um produto para começar a venda."
      />
    )
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Produto</Th>
          <Th className="w-32 text-center">Qtd.</Th>
          <Th className="w-28">Preço unit.</Th>
          <Th className="w-28">Desconto</Th>
          <Th className="w-28 text-right">Total</Th>
          <Th className="w-10" />
        </Tr>
      </Thead>
      <Tbody>
        {itens.map((item) => {
          const varLabel = variacaoLabel(item)
          const qtd = Math.max(1, Math.trunc(Number(item.quantidade) || 1))
          return (
            <Tr key={item.variacaoId}>
              <Td>
                <div className="text-sm font-medium text-gray-900">{item.nome}</div>
                {varLabel && <div className="text-xs text-gray-500">{varLabel}</div>}
              </Td>
              <Td>
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdate(item.variacaoId, 'quantidade', qtd - 1)}
                    disabled={qtd <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantidade}
                    onChange={(e) => onUpdate(item.variacaoId, 'quantidade', e.target.value)}
                    className="w-12 rounded-md border border-gray-300 px-1 py-1 text-center text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdate(item.variacaoId, 'quantidade', qtd + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </Td>
              <Td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={item.precoUnit}
                  onChange={(e) => onUpdate(item.variacaoId, 'precoUnit', e.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Td>
              <Td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={item.desconto}
                  onChange={(e) => onUpdate(item.variacaoId, 'desconto', e.target.value)}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </Td>
              <Td className="text-right font-medium text-gray-900">
                {formatCurrency(toReais(lineTotalCents(item)))}
              </Td>
              <Td>
                <button
                  type="button"
                  onClick={() => onRemove(item.variacaoId)}
                  className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remover item"
                >
                  <X size={16} />
                </button>
              </Td>
            </Tr>
          )
        })}
      </Tbody>
    </Table>
  )
}
