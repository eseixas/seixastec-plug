import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
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
  ChevronDown,
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
      { to: '/notas-fiscais', label: 'Notas Fiscais', icon: FileText },
      {
        label: 'Configurações',
        icon: Settings,
        children: [
          { to: '/configuracoes', label: 'Geral', icon: Settings },
          { to: '/fiscal/configuracoes', label: 'Fiscais', icon: Landmark },
          { to: '/etiquetas/modelos', label: 'Modelos de Etiqueta', icon: Tags },
          { to: '/usuarios', label: 'Usuários', icon: UserCog, roles: ['ADMIN'] },
        ],
      },
    ],
  },
]

function canSee(entry, role) {
  return !entry.roles || entry.roles.includes(role)
}

function filterItem(item, role) {
  if (!canSee(item, role)) return null
  if (item.children) {
    const children = item.children.filter((child) => canSee(child, role))
    if (children.length === 0) return null
    return { ...item, children }
  }
  return item
}

const navLinkClasses = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  }`

function isChildActive(item, pathname) {
  return item.children?.some((child) => pathname.startsWith(child.to)) ?? false
}

function SidebarParentItem({ item }) {
  const location = useLocation()
  const childActive = isChildActive(item, location.pathname)
  const [open, setOpen] = useState(childActive)

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  const Icon = item.icon

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          childActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
      >
        <Icon size={18} />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="ml-4 mt-1 space-y-1 border-l border-gray-200 pl-3">
            {item.children.map(({ to, label, icon: ChildIcon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <ChildIcon size={16} />
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { user } = useAuth()

  const visibleSections = sections
    .filter((section) => canSee(section, user?.role))
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) => filterItem(item, user?.role))
        .filter(Boolean),
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
            {section.items.map((item) =>
              item.children ? (
                <SidebarParentItem key={item.label} item={item} />
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={navLinkClasses}
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
              )
            )}
          </div>
        ))}
      </nav>
      <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400">
        SeixasTec — Gestão Total &copy; {new Date().getFullYear()}
      </div>
    </aside>
  )
}
