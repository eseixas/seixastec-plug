import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div className="ml-60 flex min-h-screen flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
