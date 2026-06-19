import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase não configurado no servidor.')
  return createClient(url, key)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { id } = req.query
  const supabase = getClient()

  if (req.method === 'DELETE') {
    try {
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

  if (req.method === 'PATCH') {
    try {
      const body = req.body
      const allowed = ['agent_name', 'agent_persona', 'domain', 'variables', 'exit_destinations', 'max_attempts', 'generated_prompt']
      const record = {}
      for (const key of allowed) {
        if (key in body) record[key] = body[key]
      }
      if (Object.keys(record).length === 0) return res.status(400).json({ error: 'Nenhum campo para atualizar.' })
      const { data, error } = await supabase
        .from('prompt_bc_agents')
        .update(record)
        .eq('id', id)
        .select()
        .single()
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json(data)
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(405).json({ error: 'Método não permitido.' })
}
