const TOKEN_KEY = 'pm-auth'

export async function login(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao fazer login.')
  localStorage.setItem(TOKEN_KEY, data.token)
  return data.token
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated() {
  const token = localStorage.getItem(TOKEN_KEY)
  if (!token) return false
  try {
    const [payload] = token.split('.')
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return exp > Date.now()
  } catch {
    return false
  }
}
