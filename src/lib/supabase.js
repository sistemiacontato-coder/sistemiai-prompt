import { createClient } from '@supabase/supabase-js'

// Em produção (Vercel), VITE_ vars não estão definidas — o proxy de servidor é usado.
// Em desenvolvimento local, usa o Supabase diretamente se as vars estiverem no .env.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const IS_PROD = import.meta.env.PROD

const supabaseDirect = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null

// Em produção o proxy sempre está disponível; em dev depende das vars
export const isSupabaseConfigured = IS_PROD || Boolean(SUPABASE_URL && SUPABASE_KEY)

// ── Salva um agente ──────────────────────────────────────────────────────────
export async function deployAgent({ config, generatedPrompt }) {
  const record = {
    agent_name:        config.agentName,
    agent_persona:     config.agentPersona,
    domain:            config.domain,
    variables:         config.variables,
    exit_destinations: config.exitDestinations,
    max_attempts:      config.maxAttempts,
    generated_prompt:  generatedPrompt,
    created_at:        new Date().toISOString(),
  }

  if (IS_PROD) {
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Erro ao salvar agente.')
    }
    return res.json()
  }

  if (!supabaseDirect) throw new Error('Supabase não configurado. Crie o arquivo .env com as credenciais.')
  const { data, error } = await supabaseDirect
    .from('prompt_bc_agents')
    .insert([record])
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Busca histórico ──────────────────────────────────────────────────────────
export async function fetchAgentHistory() {
  if (IS_PROD) {
    const res = await fetch('/api/agents')
    if (!res.ok) throw new Error('Erro ao carregar histórico.')
    return res.json()
  }

  if (!supabaseDirect) return []
  const { data, error } = await supabaseDirect
    .from('prompt_bc_agents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data || []
}

// ── Deleta um agente ─────────────────────────────────────────────────────────
export async function deleteAgent(id) {
  if (IS_PROD) {
    const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Erro ao excluir agente.')
    return
  }

  if (!supabaseDirect) throw new Error('Supabase não configurado.')
  const { error } = await supabaseDirect
    .from('prompt_bc_agents')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// SQL para setup inicial (exibido ao usuário se necessário)
export const SETUP_SQL = `
CREATE TABLE IF NOT EXISTS prompt_bc_agents (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name        TEXT        NOT NULL,
  agent_persona     TEXT,
  domain            TEXT,
  variables         JSONB       DEFAULT '[]',
  exit_destinations JSONB       DEFAULT '[]',
  max_attempts      INTEGER     DEFAULT 3,
  generated_prompt  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prompt_bc_agents_name    ON prompt_bc_agents (agent_name);
CREATE INDEX IF NOT EXISTS idx_prompt_bc_agents_created ON prompt_bc_agents (created_at DESC);
ALTER TABLE prompt_bc_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prompt_bc_allow_all" ON prompt_bc_agents FOR ALL USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION prompt_bc_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER prompt_bc_agents_updated_at
  BEFORE UPDATE ON prompt_bc_agents
  FOR EACH ROW EXECUTE FUNCTION prompt_bc_set_updated_at();
`.trim()
