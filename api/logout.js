export default function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  // Apaga o cookie de auth
  res.setHeader('Set-Cookie', 'pm-auth=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')
  res.status(200).json({ ok: true })
}
