// Serverless function — preços dos modelos OpenAI
// Fonte primária: LiteLLM pricing database (tempo real)
// Fallback: preços hardcoded (atualizados em 2025-06)

const FALLBACK_MODELS = [
  { model: 'gpt-4.1-nano',  inputPer1M: 0.1,  outputPer1M: 0.4,  maxInputTokens: 1047576 },
  { model: 'gpt-4.1-mini',  inputPer1M: 0.4,  outputPer1M: 1.6,  maxInputTokens: 1047576 },
  { model: 'gpt-4o-mini',   inputPer1M: 0.15, outputPer1M: 0.6,  maxInputTokens: 128000  },
  { model: 'gpt-4.1',       inputPer1M: 2.0,  outputPer1M: 8.0,  maxInputTokens: 1047576 },
  { model: 'gpt-4o',        inputPer1M: 2.5,  outputPer1M: 10.0, maxInputTokens: 128000  },
]

const GPT_MODELS = FALLBACK_MODELS.map(m => m.model)
const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer))
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')

  try {
    const response = await fetchWithTimeout(
      LITELLM_URL,
      { headers: { Accept: 'application/json', 'User-Agent': 'SistemIA-Prompt/1.0' } },
      5000
    )

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()

    const models = GPT_MODELS.map(name => {
      const entry = data[name] || data[`openai/${name}`] || null
      if (!entry) return null
      const inputPer1M  = entry.input_cost_per_token  != null ? +(entry.input_cost_per_token  * 1_000_000).toFixed(4) : null
      const outputPer1M = entry.output_cost_per_token != null ? +(entry.output_cost_per_token * 1_000_000).toFixed(4) : null
      return { model: name, inputPer1M, outputPer1M, maxInputTokens: entry.max_input_tokens || entry.max_tokens || null }
    }).filter(Boolean)

    if (models.length === 0) throw new Error('Modelos não encontrados na resposta')

    return res.status(200).json({
      models,
      source: 'LiteLLM · OpenAI Pricing (tempo real)',
      fetchedAt: new Date().toISOString(),
    })

  } catch (_) {
    // Fallback com preços hardcoded — confiáveis mesmo sem conexão externa
    return res.status(200).json({
      models: FALLBACK_MODELS,
      source: 'Preços de referência (OpenAI · jun/2025)',
      fetchedAt: new Date().toISOString(),
    })
  }
}
