import crypto from 'crypto'

export default function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body || {}

  const expectedUser = process.env.AUTH_USERNAME || 'master'
  const expectedPass = process.env.AUTH_PASSWORD || '123123'
  const secret = process.env.AUTH_SECRET || 'sistemia-auth-secret-2025'

  if (!username || !password || username !== expectedUser || password !== expectedPass) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' })
  }

  const payload = Buffer.from(
    JSON.stringify({ u: username, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })
  ).toString('base64url')

  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const token = `${payload}.${sig}`

  res.status(200).json({ token })
}
