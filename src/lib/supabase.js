import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Salva um agente (config + prompt) no Supabase
export async function deployAgent({ config, generatedPrompt }) {
  if (!supabase) throw new Error('Supabase não configurado. Crie o arquivo .env com as credenciais.')

  const record = {
    agent_name:         config.agentName,
    agent_persona:      config.agentPersona,
    domain:             config.domain,
    variables:          config.variables,
    exit_destinations:  config.exitDestinations,
    max_attempts:       config.maxAttempts,
    generated_prompt:   generatedPrompt,
    created_at:         new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('prompt_bc_agents')
    .insert([record])
    .select()
    .single()

  if (error) throw error
  return data
}

// Busca histórico de agentes
export async function fetchAgentHistory() {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('prompt_bc_agents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data || []
}

// Deleta um agente pelo ID
export async function deleteAgent(id) {
  if (!supabase) throw new Error('Supabase não configurado.')

  const { error } = await supabase
    .from('prompt_bc_agents')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// SQL para criar as tabelas (exibido ao usuário para setup inicial)
export const SETUP_SQL = `
-- Execute este SQL no Supabase SQL Editor

-- Tabela principal de agentes
CREATE TABLE IF NOT EXISTS prompt_bc_agents (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_name    TEXT        NOT NULL,
  agent_persona TEXT,
  domain        TEXT,
  variables     JSONB       DEFAULT '[]',
  exit_destinations JSONB   DEFAULT '[]',
  max_attempts  INTEGER     DEFAULT 3,
  generated_prompt TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscas por nome
CREATE INDEX IF NOT EXISTS idx_prompt_bc_agents_name
  ON prompt_bc_agents (agent_name);

-- Índice para ordenação por data
CREATE INDEX IF NOT EXISTS idx_prompt_bc_agents_created
  ON prompt_bc_agents (created_at DESC);

-- Habilitar Row Level Security
ALTER TABLE prompt_bc_agents ENABLE ROW LEVEL SECURITY;

-- Policy: permite todas as operações (ajustar se usar autenticação)
CREATE POLICY "prompt_bc_allow_all" ON prompt_bc_agents
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION prompt_bc_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prompt_bc_agents_updated_at
  BEFORE UPDATE ON prompt_bc_agents
  FOR EACH ROW EXECUTE FUNCTION prompt_bc_set_updated_at();
`.trim()
