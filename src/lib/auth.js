// Auth via cookie HttpOnly — token nunca fica exposto no localStorage ou JavaScript

export async function login(username, password) {
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Erro ao fazer login.')
  // Cookie HttpOnly é setado pelo servidor — não acessível via JS
}

export async function logout() {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
}

export async function checkSession() {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' })
    return res.ok
  } catch {
    return false
  }
}
