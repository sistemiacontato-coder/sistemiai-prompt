const STORAGE_KEY = 'pm-ai-config'

// Endpoints OpenAI-compatíveis populares
export const COMPAT_ENDPOINTS = [
  { id: 'openai',     label: 'OpenAI',     url: 'https://api.openai.com/v1',           model: 'gpt-4o-mini',            hint: 'platform.openai.com' },
  { id: 'openrouter', label: 'OpenRouter', url: 'https://openrouter.ai/api/v1',         model: 'openai/gpt-4o-mini',     hint: 'openrouter.ai · 200+ modelos, free tier' },
  { id: 'groq',       label: 'Groq',       url: 'https://api.groq.com/openai/v1',       model: 'llama-3.3-70b-versatile',hint: 'console.groq.com · gratuito, ultra-rápido' },
  { id: 'mistral',    label: 'Mistral',    url: 'https://api.mistral.ai/v1',            model: 'mistral-small-latest',   hint: 'console.mistral.ai' },
  { id: 'together',   label: 'Together',   url: 'https://api.together.xyz/v1',          model: 'meta-llama/Llama-3-8b-chat-hf', hint: 'api.together.ai' },
]

// Detecta o provedor pela estrutura da chave
export function detectProviderFromKey(key) {
  const k = (key || '').trim()
  if (!k) return null
  if (k.startsWith('sk-ant-'))            return { provider: 'claude',  name: 'Anthropic Claude', icon: 'psychology', color: 'primary' }
  if (k.startsWith('AIza') || k.startsWith('AQ.')) return { provider: 'gemini', name: 'Google Gemini',  icon: 'stars',      color: 'secondary' }
  if (k.startsWith('gsk_'))               return { provider: 'compat',  name: 'Groq',             icon: 'bolt',       color: 'tertiary', endpoint: COMPAT_ENDPOINTS[2].url, model: COMPAT_ENDPOINTS[2].model }
  if (k.startsWith('sk-or-'))             return { provider: 'compat',  name: 'OpenRouter',       icon: 'hub',        color: 'secondary', endpoint: COMPAT_ENDPOINTS[1].url, model: COMPAT_ENDPOINTS[1].model }
  if (k.startsWith('sk-'))               return { provider: 'compat',  name: 'OpenAI',           icon: 'smart_toy',  color: 'on-surface-variant', endpoint: COMPAT_ENDPOINTS[0].url, model: COMPAT_ENDPOINTS[0].model }
  return                                         { provider: 'compat',  name: 'API Compatível',   icon: 'key',        color: 'on-surface-variant' }
}

// Detecta o provedor com base no nome do modelo de IA
export function detectProviderFromModel(modelName) {
  const m = (modelName || '').toLowerCase()
  if (m.startsWith('gpt-') || m.startsWith('o1-') || m.startsWith('o3-')) {
    return { provider: 'compat', name: 'OpenAI', icon: 'smart_toy', color: 'on-surface-variant' }
  }
  if (m.startsWith('claude-')) {
    return { provider: 'claude', name: 'Anthropic Claude', icon: 'psychology', color: 'primary' }
  }
  if (m.startsWith('gemini-')) {
    return { provider: 'gemini', name: 'Google Gemini', icon: 'stars', color: 'secondary' }
  }
  if (m.includes('llama') || m.includes('mixtral') || m.includes('deepseek')) {
    return { provider: 'compat', name: 'Compatível / OpenRouter', icon: 'hub', color: 'tertiary' }
  }
  return { provider: 'compat', name: 'OpenAI', icon: 'smart_toy', color: 'on-surface-variant' }
}

function getEnvDefault() {
  const g = import.meta.env.VITE_GEMINI_API_KEY
  const c = import.meta.env.VITE_CLAUDE_API_KEY
  if (g) return { provider: 'gemini', apiKey: g }
  if (c) return { provider: 'claude', apiKey: c }
  return null
}

export function loadAIConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {}
  return getEnvDefault()
}

export function saveAIConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export async function fetchOpenAIModels(apiKey, endpoint) {
  if (!apiKey) throw new Error('Chave API não informada.')
  const base = (endpoint || 'https://api.openai.com/v1').replace(/\/$/, '')
  const url = `${base}/models`

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Erro ao buscar modelos: ${res.status}`)
  }

  const data = await res.json()
  return (data.data || [])
    .map(m => m.id)
    .sort()
}

function buildAnalysisPrompt(agentName, domain) {
  return `Você é um arquiteto de agentes conversacionais para WhatsApp/chatbot.

Analise o objetivo do agente abaixo e identifique automaticamente:
1. Quais informações precisam ser coletadas do cliente (variáveis/campos)
2. Para onde o agente pode encaminhar o cliente (saídas condicionais)

NOME DO AGENTE: ${agentName || 'Assistente Virtual'}
OBJETIVO DO AGENTE: ${domain}

Retorne APENAS o JSON abaixo, sem texto adicional, sem markdown, sem bloco de código:

{
  "variables": [
    {
      "name": "nome_campo_max14chars",
      "type": "text",
      "description": "Salvar aqui [o que a IA deve registrar exatamente]",
      "options": ""
    }
  ],
  "exits": [
    {
      "key": "saida_nome_max20chars",
      "label": "Nome Legível para humanos",
      "description": "Interrompa a IA quando o cliente [condição exata]"
    }
  ]
}

REGRAS OBRIGATÓRIAS:
- variables[].name: minúsculo, underline, sem acento, MÁXIMO 14 caracteres
- variables[].type: "text" para texto livre; "enum" para categorias fixas
- variables[].options: se enum, opções separadas por \\n; se text, deixe ""
- variables[].description: SEMPRE começar com "Salvar aqui " seguido do que a IA deve registrar
- SEMPRE inclua "nome_cliente" como PRIMEIRA variável (type="text")
- exits[].key: sempre começa com "saida_", MÁXIMO 20 caracteres total
- exits[].description: SEMPRE começar com "Interrompa a IA quando o cliente"
- SEMPRE inclua "saida_atendente" (label "Atendente Humano") como saída obrigatória
- Crie uma saída para CADA setor, destino ou encaminhamento citado no objetivo
- Identifique encaminhamentos mesmo que implícitos`
}

function extractJson(text) {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('A IA não retornou um JSON válido. Tente novamente.')
  return JSON.parse(match[0])
}

async function callGemini(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || `Gemini API error ${res.status}`
    throw new Error(msg)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Tempo limite atingido (${ms / 1000}s) — ${label}`)), ms)
    promise.then(v => { clearTimeout(timer); resolve(v) }, e => { clearTimeout(timer); reject(e) })
  })
}

async function callClaude(apiKey, prompt, maxTokens = 2048) {
  const fetchPromise = fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const res = await withTimeout(fetchPromise, 90000, 'Claude API').catch(e => {
    if (e.message.includes('Tempo limite')) throw e
    throw new Error(`Falha de conexão com Claude API: ${e.message}`)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Claude API error ${res.status}`)
  }
  const data = await res.json()
  return data.content?.[0]?.text || ''
}

async function callOpenAICompat(apiKey, prompt, endpoint, model, maxTokens = 2048, temperature = 0.2) {
  const base = (endpoint || 'https://api.openai.com/v1').replace(/\/$/, '')
  const url = `${base}/chat/completions`
  // Apenas modelos da série "o" (reasoning) usam max_completion_tokens sem temperature
  const isNewModel = model && /^(o1|o3|o4|o-)/i.test(model.trim())

  const body = {
    model: model || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  }

  if (isNewModel) {
    body.max_completion_tokens = maxTokens
  } else {
    body.max_tokens = maxTokens
    body.temperature = temperature
  }

  const fetchPromise = fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })
  const res = await withTimeout(fetchPromise, 90000, `${model || 'API'} em ${base}`).catch(e => {
    if (e.message.includes('Tempo limite')) throw e
    throw new Error(`Falha de conexão com a API (${base}): ${e.message}`)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `API error ${res.status}`)
  }
  const data = await res.json()
  const choice = data.choices?.[0]
  const text = choice?.message?.content
  if (!text) {
    const refusal = choice?.message?.refusal
    const raw = JSON.stringify(data).slice(0, 200).replace(/\n/g, ' ')
    throw new Error(refusal || `Modelo "${model || '?'}" retornou resposta vazia. Troque o modelo para "gpt-4o-mini" em Config IA. Resposta bruta: ${raw}`)
  }
  return text
}

export async function callAI(prompt, config) {
  const cfg = config || loadAIConfig()
  if (!cfg?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Config IA.')

  // Sempre derivar endpoint/provedor da chave — ignora config salva desatualizada
  const detected = detectProviderFromKey(cfg.apiKey)
  const provider  = detected?.provider || cfg.provider || 'compat'
  const endpoint  = detected?.endpoint || cfg.endpoint || 'https://api.openai.com/v1'
  const maxTokens = cfg.maxTokens || 2048

  if (provider === 'claude')  return callClaude(cfg.apiKey, prompt, maxTokens)
  if (provider === 'gemini')  return callGemini(cfg.apiKey, prompt)

  // Corrige modelo salvo no formato OpenRouter (openai/modelo) para OpenAI direto
  let model = cfg.model || detected?.model || 'gpt-4o-mini'
  if (detected?.name === 'OpenAI' && model.startsWith('openai/')) model = model.slice(7)

  const temperature = typeof cfg.temperature === 'number' ? cfg.temperature : 0.2
  return callOpenAICompat(cfg.apiKey, prompt, endpoint, model, maxTokens, temperature)
}

export async function analyzeAgentObjective({ agentName, domain, aiConfig: cfg }) {
  const config = cfg || loadAIConfig()
  if (!config?.apiKey) throw new Error('Nenhuma chave de IA configurada. Clique em "Config IA" na barra lateral.')

  const prompt = buildAnalysisPrompt(agentName, domain)
  let text = await callAI(prompt, config)

  const parsed = extractJson(text)
  if (!Array.isArray(parsed.variables) || !Array.isArray(parsed.exits)) {
    throw new Error('Formato de resposta inesperado. Tente novamente.')
  }
  return parsed
}

export async function generateExitMessage({ exit, agentName, agentPersona, domain, aiConfig }) {
  const cfg = aiConfig || loadAIConfig()
  if (!cfg?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Config IA.')

  const prompt = `Você é especialista em UX de chatbots para WhatsApp.

Crie a mensagem de encerramento que o assistente "${agentName || 'Assistente'}" envia ao cliente ANTES de acionar a saída "${exit.label || exit.key}".

CONTEXTO:
- Objetivo do agente: ${domain || 'Atendimento geral'}
${agentPersona ? `- Persona: ${agentPersona}` : ''}
- Saída acionada: ${exit.label || exit.key}${exit.description ? ` — ${exit.description}` : ''}

REGRAS:
- É a ÚLTIMA mensagem da conversa com a IA — não é uma saudação
- Diga ao cliente o que vai acontecer agora (ex: "Vou te transferir para...", "Vou encaminhar seu atendimento para...", "Em instantes você receberá...")
- Máximo 2 frases curtas e naturais
- Tom compatível com a persona do agente
- Retorne APENAS o texto da mensagem, sem aspas, sem explicações, sem markdown`

  const text = await callAI(prompt, cfg)
  return text.trim().replace(/^["']|["']$/g, '')
}

export async function testAIConnection(config) {
  try {
    const text = await callAI('Responda apenas: {"ok":true}', config)
    return { success: !!text }
  } catch (e) {
    return { success: false, error: e.message }
  }
}
