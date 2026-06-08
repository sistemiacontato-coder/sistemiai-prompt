import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase não configurado no servidor.')
  return createClient(url, key)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  try {
    const { id } = req.query
    const supabase = getClient()
    const { error } = await supabase
      .from('prompt_bc_agents')
      .delete()
      .eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
