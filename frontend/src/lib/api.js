const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const API_BASE = `${API_URL}/api`

function getToken() {
  return localStorage.getItem('cpv_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('cpv_token', token)
  else localStorage.removeItem('cpv_token')
}

class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const finalHeaders = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (auth) {
    const token = getToken()
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && auth) {
    setToken(null)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new ApiError('Não autorizado', 401, null)
  }

  let data = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null)
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `Erro na requisição (${res.status})`
    throw new ApiError(message, res.status, data)
  }

  return data
}

// POST que retorna um Blob (ex.: PDF). Não passa pela `request` interna, que só
// trata JSON — replica o mesmo baseURL e cabeçalho de auth das outras chamadas.
async function postBlob(path, body) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (res.status === 401) {
    setToken(null)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new ApiError('Não autorizado', 401, null)
  }

  if (!res.ok) {
    let message = `Erro na requisição (${res.status})`
    try {
      const data = await res.json()
      message = data?.message || data?.error || message
    } catch {
      /* corpo não-JSON: mantém a mensagem genérica */
    }
    throw new ApiError(message, res.status, null)
  }

  return res.blob()
}

// GET que retorna um Blob (ex.: XML, ZIP). Mesmo tratamento de 401/erro/blob
// do postBlob, mas sem body.
async function getBlob(path) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers,
  })

  if (res.status === 401) {
    setToken(null)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new ApiError('Não autorizado', 401, null)
  }

  if (!res.ok) {
    let message = `Erro na requisição (${res.status})`
    try {
      const data = await res.json()
      message = data?.message || data?.error || message
    } catch {
      /* corpo não-JSON: mantém a mensagem genérica */
    }
    throw new ApiError(message, res.status, null)
  }

  return res.blob()
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  postBlob,
  getBlob,
}

async function uploadFoto(produtoId, file) {
  const formData = new FormData()
  formData.append('foto', file)

  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}/api/produtos/${produtoId}/foto`, {
    method: 'POST',
    headers,
    body: formData,
  })

  if (res.status === 401) {
    setToken(null)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new ApiError('Não autorizado', 401, null)
  }

  let data = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null)
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `Erro ao enviar foto (${res.status})`
    throw new ApiError(message, res.status, data)
  }

  return data
}

function deleteFoto(produtoId) {
  return api.delete(`/produtos/${produtoId}/foto`)
}

// Upload genérico multipart (não usar api.post, que sempre serializa o body
// como JSON — FormData precisa ir sem Content-Type manual, o browser define
// o boundary correto sozinho).
async function uploadFile(path, fieldName, file) {
  const formData = new FormData()
  formData.append(fieldName, file)

  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData })

  if (res.status === 401) {
    setToken(null)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new ApiError('Não autorizado', 401, null)
  }

  let data = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null)
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `Erro ao enviar arquivo (${res.status})`
    throw new ApiError(message, res.status, data)
  }

  return data
}

function fotoSrc(fotoUrl) {
  if (!fotoUrl) return null
  return `${API_URL}${fotoUrl}`
}

// Upload multipart com campos extras no mesmo FormData (além do arquivo).
// `fields` é um objeto { chave: valor } serializado como campos de texto.
async function uploadWithFields(path, fieldName, file, fields = {}) {
  const formData = new FormData()
  formData.append(fieldName, file)
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) formData.append(key, String(value))
  }

  const token = getToken()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData })

  if (res.status === 401) {
    setToken(null)
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
    throw new ApiError('Não autorizado', 401, null)
  }

  let data = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null)
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `Erro ao enviar arquivo (${res.status})`
    throw new ApiError(message, res.status, data)
  }

  return data
}

// Importa um extrato bancário (OFX/CSV) para conciliação.
function uploadExtrato(contaBancariaId, formato, file) {
  return uploadWithFields('/financeiro/conciliacao/importar', 'arquivo', file, {
    contaBancariaId,
    formato,
  })
}

export {
  ApiError,
  API_URL,
  uploadFoto,
  deleteFoto,
  fotoSrc,
  uploadFile,
  uploadWithFields,
  uploadExtrato,
}
