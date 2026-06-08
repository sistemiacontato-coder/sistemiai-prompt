import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase não configurado no servidor.')
  return createClient(url, key)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const supabase = getClient()

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('prompt_bc_agents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data || [])
    }

    if (req.method === 'POST') {
      const body = req.body
      const { data, error } = await supabase
        .from('prompt_bc_agents')
        .insert([body])
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(201).json(data)
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
