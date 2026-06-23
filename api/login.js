import crypto from 'crypto'

const DEFAULT_SECRET = 'sistemia-xK9mP2vQnL8rT5wJ3hY7bN1cD4eA6fG0iU-2025'

function getSecret() {
  return process.env.AUTH_SECRET || DEFAULT_SECRET
}

function makeToken(username, secret) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })
  ).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

// Rate limiting simples em memória (por IP, resetado a cada deploy)
const attempts = new Map()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

function isRateLimited(ip) {
  const now = Date.now()
  const entry = attempts.get(ip) || { count: 0, start: now }
  if (now - entry.start > WINDOW_MS) { attempts.set(ip, { count: 1, start: now }); return false }
  if (entry.count >= MAX_ATTEMPTS) return true
  attempts.set(ip, { count: entry.count + 1, start: entry.start })
  return false
}

export default function handler(req, res) {
  // Sem CORS wildcard — apenas same-origin
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' })
  }

  const { username, password } = req.body || {}

  const expectedUser = process.env.AUTH_USERNAME || 'master'
  const expectedPass = process.env.AUTH_PASSWORD || 'SistemIA@Prompt#2025'

  // Comparação em tempo constante para evitar timing attacks
  const userOk = username && crypto.timingSafeEqual(
    Buffer.from(username.padEnd(64, '\0'), 'utf8').slice(0, 64),
    Buffer.from(expectedUser.padEnd(64, '\0'), 'utf8').slice(0, 64)
  ) && username.length === expectedUser.length

  const passOk = password && crypto.timingSafeEqual(
    Buffer.from(password.padEnd(64, '\0'), 'utf8').slice(0, 64),
    Buffer.from(expectedPass.padEnd(64, '\0'), 'utf8').slice(0, 64)
  ) && password.length === expectedPass.length

  if (!userOk || !passOk) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' })
  }

  let secret
  try { secret = getSecret() } catch {
    return res.status(500).json({ error: 'Servidor não configurado.' })
  }

  const token = makeToken(username, secret)

  // Token em cookie HttpOnly — não acessível via JavaScript/F12
  res.setHeader('Set-Cookie', [
    `pm-auth=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
  ])

  res.status(200).json({ ok: true })
}
