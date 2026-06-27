import { createClient } from '@supabase/supabase-js'
import { verifyToken } from './me.js'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase não configurado no servidor.')
  return createClient(url, key)
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (!verifyToken(req.headers.cookie)) {
    return res.status(401).json({ error: 'Não autenticado.' })
  }

  try {
    const supabase = getClient()

    if (req.method === 'GET') {
      const { key } = req.query
      if (!key) return res.status(400).json({ error: 'key é obrigatório' })
      const { data, error } = await supabase
        .from('prompt_bc_settings')
        .select('value')
        .eq('key', key)
        .maybeSingle()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data?.value ?? null)
    }

    if (req.method === 'PUT') {
      const { key, value } = req.body || {}
      if (!key) return res.status(400).json({ error: 'key é obrigatório' })
      const { error } = await supabase
        .from('prompt_bc_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true })
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
