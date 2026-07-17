import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import ProdutosList from './pages/Produtos/ProdutosList.jsx'
import ProdutoForm from './pages/Produtos/ProdutoForm.jsx'
import ClientesList from './pages/Clientes/ClientesList.jsx'
import FornecedoresList from './pages/Fornecedores/FornecedoresList.jsx'
import Estoque from './pages/Estoque/Estoque.jsx'
import Vendas from './pages/Vendas/Vendas.jsx'
import Adquirentes from './pages/Adquirentes/Adquirentes.jsx'
import Recebiveis from './pages/Recebiveis/Recebiveis.jsx'
import Lojas from './pages/Lojas/Lojas.jsx'
import NotasFiscais from './pages/Fiscal/NotasFiscais.jsx'
import ConfiguracoesFiscais from './pages/Fiscal/ConfiguracoesFiscais.jsx'
import Configuracoes from './pages/Configuracoes/Configuracoes.jsx'
import ContasBancariasList from './pages/Financeiro/ContasBancariasList.jsx'
import CategoriasFinanceirasList from './pages/Financeiro/CategoriasFinanceirasList.jsx'
import ContasPagarList from './pages/Financeiro/ContasPagarList.jsx'
import ContaPagarForm from './pages/Financeiro/ContaPagarForm.jsx'
import Extrato from './pages/Financeiro/Extrato.jsx'
import Conciliacao from './pages/Financeiro/Conciliacao.jsx'
import Resultados from './pages/Financeiro/Resultados.jsx'
import Usuarios from './pages/Usuarios/Usuarios.jsx'
import ComprasList from './pages/Compras/ComprasList.jsx'
import CompraForm from './pages/Compras/CompraForm.jsx'
import CompraDetail from './pages/Compras/CompraDetail.jsx'
import Etiquetas from './pages/Etiquetas/Etiquetas.jsx'
import ModeloEtiquetaForm from './pages/Etiquetas/ModeloEtiquetaForm.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/produtos" element={<ProdutosList />} />
        <Route path="/produtos/novo" element={<ProdutoForm />} />
        <Route path="/produtos/:id" element={<ProdutoForm />} />
        <Route path="/clientes" element={<ClientesList />} />
        <Route path="/fornecedores" element={<FornecedoresList />} />
        <Route path="/estoque" element={<Estoque />} />
        <Route path="/compras" element={<ComprasList />} />
        <Route path="/compras/nova" element={<CompraForm />} />
        <Route path="/compras/:id" element={<CompraDetail />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/adquirentes" element={<Adquirentes />} />
        <Route path="/recebiveis" element={<Recebiveis />} />
        <Route
          element={
            <ProtectedRoute roles={['ADMIN', 'FINANCEIRO']}>
              <Outlet />
            </ProtectedRoute>
          }
        >
          <Route path="/financeiro/contas-bancarias" element={<ContasBancariasList />} />
          <Route path="/financeiro/categorias" element={<CategoriasFinanceirasList />} />
          <Route path="/financeiro/contas-pagar" element={<ContasPagarList />} />
          <Route path="/financeiro/contas-pagar/novo" element={<ContaPagarForm />} />
          <Route path="/financeiro/contas-pagar/:id" element={<ContaPagarForm />} />
          <Route path="/financeiro/extrato" element={<Extrato />} />
          <Route path="/financeiro/conciliacao" element={<Conciliacao />} />
          <Route path="/financeiro/resultados" element={<Resultados />} />
        </Route>
        <Route path="/lojas" element={<Lojas />} />
        <Route path="/etiquetas" element={<Etiquetas />} />
        <Route path="/etiquetas/modelos" element={<Navigate to="/etiquetas?aba=modelos" replace />} />
        <Route path="/etiquetas/modelos/novo" element={<ModeloEtiquetaForm />} />
        <Route path="/etiquetas/modelos/:id" element={<ModeloEtiquetaForm />} />
        <Route path="/notas-fiscais" element={<NotasFiscais />} />
        <Route path="/fiscal/configuracoes" element={<ConfiguracoesFiscais />} />
        <Route
          path="/usuarios"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <Usuarios />
            </ProtectedRoute>
          }
        />
        <Route path="/configuracoes" element={<Configuracoes />} />
      </Route>
    </Routes>
  )
}
