import crypto from 'crypto'

function parseCookies(cookieHeader) {
  const cookies = {}
  ;(cookieHeader || '').split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=')
    if (k) cookies[k.trim()] = v.join('=').trim()
  })
  return cookies
}

export function verifyToken(cookieHeader) {
  const { 'pm-auth': token } = parseCookies(cookieHeader)
  if (!token) return null

  const secret = process.env.AUTH_SECRET || 'sistemia-xK9mP2vQnL8rT5wJ3hY7bN1cD4eA6fG0iU-2025'

  try {
    const [payload, sig] = token.split('.')
    if (!payload || !sig) return null

    const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
    const sigOk = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    if (!sigOk) return null

    const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (data.exp < Date.now()) return null
    return data
  } catch {
    return null
  }
}

export default function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  const user = verifyToken(req.headers.cookie)
  if (!user) return res.status(401).json({ error: 'Não autenticado.' })
  res.status(200).json({ username: user.u })
}
