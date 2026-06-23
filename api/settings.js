import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase não configurado no servidor.')
  return createClient(url, key)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

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
