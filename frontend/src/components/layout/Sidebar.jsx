import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Shirt,
  Users,
  Truck,
  Boxes,
  Receipt,
  Settings,
  Store,
  CreditCard,
  Wallet,
  Building2,
  FileText,
  Landmark,
  Tags,
  BarChart3,
  UserCog,
  ShoppingCart,
  Barcode,
  FileCheck2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'

const sections = [
  {
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    title: 'Catálogo',
    items: [
      { to: '/produtos', label: 'Produtos', icon: Shirt },
      { to: '/estoque', label: 'Estoque', icon: Boxes },
      { to: '/compras', label: 'Compras', icon: ShoppingCart },
    ],
  },
  {
    title: 'Vendas',
    items: [
      { to: '/vendas', label: 'Vendas', icon: Receipt },
      { to: '/clientes', label: 'Clientes', icon: Users },
      { to: '/fornecedores', label: 'Fornecedores', icon: Truck },
      { to: '/adquirentes', label: 'Adquirentes & Taxas', icon: CreditCard },
    ],
  },
  {
    title: 'Financeiro',
    roles: ['ADMIN', 'FINANCEIRO'],
    items: [
      { to: '/financeiro/contas-bancarias', label: 'Contas Bancárias', icon: Landmark },
      { to: '/financeiro/categorias', label: 'Categorias', icon: Tags },
      { to: '/financeiro/extrato', label: 'Extrato', icon: Wallet },
      { to: '/financeiro/conciliacao', label: 'Conciliação', icon: FileCheck2 },
      { to: '/financeiro/resultados', label: 'Resultados', icon: BarChart3 },
    ],
  },
  {
    title: 'Administração',
    items: [
      { to: '/lojas', label: 'Lojas & PDVs', icon: Building2 },
      { to: '/etiquetas', label: 'Etiquetas', icon: Barcode, end: true },
      { to: '/etiquetas/modelos', label: 'Modelos de Etiqueta', icon: Tags },
      { to: '/notas-fiscais', label: 'Notas Fiscais', icon: FileText },
      { to: '/fiscal/configuracoes', label: 'Configurações Fiscais', icon: Landmark },
      { to: '/usuarios', label: 'Usuários', icon: UserCog, roles: ['ADMIN'] },
      { to: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
]

function canSee(entry, role) {
  return !entry.roles || entry.roles.includes(role)
}

export default function Sidebar() {
  const { user } = useAuth()

  const visibleSections = sections
    .filter((section) => canSee(section, user?.role))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canSee(item, user?.role)),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <Store size={18} />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-gray-900">SeixasTec</p>
          <p className="text-xs text-gray-400">Gestão Total</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {visibleSections.map((section, idx) => (
          <div key={section.title || `section-${idx}`} className="space-y-1">
            {section.title && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {section.title}
              </p>
            )}
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
        SeixasTec — Gestão Total &copy; {new Date().getFullYear()}
      </div>
    </aside>
  )
}
