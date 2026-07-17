const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api'
const TOKEN_KEY = 'seixastec_pdv_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request(method, path, body, { auth = true } = {}) {
  // Identifica a origem para o backend aplicar as regras do PDV (ex.:
  // ConfiguracaoCliente.aplicarNoPdv em POST/PUT /clientes).
  const headers = { 'Content-Type': 'application/json', 'x-origem': 'pdv' }
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    setToken(null)
    if (!path.startsWith('/auth')) window.location.href = '/login'
    throw new Error('Não autenticado')
  }
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    throw new Error(data?.error || 'Erro na requisição')
  }
  return data
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b, o) => request('POST', p, b, o),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
}
