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
      const { data, error } = await supabase
        .from('prompt_bc_agents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) return res.status(500).json({ error: 'Erro ao buscar agentes.' })
      return res.status(200).json(data || [])
    }

    if (req.method === 'POST') {
      const body = req.body
      const allowed = ['agent_name', 'agent_persona', 'domain', 'variables', 'exit_destinations', 'max_attempts', 'generated_prompt', 'logs']
      const record = {}
      for (const key of allowed) {
        if (key in body) record[key] = body[key]
      }
      const { data, error } = await supabase
        .from('prompt_bc_agents')
        .insert([record])
        .select()
        .single()
      if (error) return res.status(500).json({ error: 'Erro ao criar agente.' })
      return res.status(201).json(data)
    }

    return res.status(405).json({ error: 'Método não permitido.' })
  } catch (e) {
    return res.status(500).json({ error: 'Erro interno.' })
  }
}
