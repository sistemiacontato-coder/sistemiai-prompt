// Serverless function — busca preços reais dos modelos OpenAI
// Fonte: LiteLLM pricing database (rastreia atualizações da OpenAI em tempo real)
// Cache de 1 hora no CDN do Vercel

const GPT_MODELS = [
  'gpt-4.1-nano',
  'gpt-4.1-mini',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4o',
]

const LITELLM_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json'

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')

  try {
    const response = await fetch(LITELLM_URL, {
      headers: { Accept: 'application/json', 'User-Agent': 'SistemIA-Prompt/1.0' },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()

    const models = GPT_MODELS.map(name => {
      // LiteLLM usa a chave sem prefixo para modelos OpenAI
      const entry = data[name] || data[`openai/${name}`] || null
      if (!entry) return null

      const inputPer1M  = entry.input_cost_per_token  != null ? +(entry.input_cost_per_token  * 1_000_000).toFixed(4) : null
      const outputPer1M = entry.output_cost_per_token != null ? +(entry.output_cost_per_token * 1_000_000).toFixed(4) : null

      return {
        model:        name,
        inputPer1M,
        outputPer1M,
        maxInputTokens: entry.max_input_tokens || entry.max_tokens || null,
      }
    }).filter(Boolean)

    return res.status(200).json({
      models,
      source: 'LiteLLM · OpenAI Pricing',
      fetchedAt: new Date().toISOString(),
    })

  } catch (err) {
    return res.status(200).json({
      models: [],
      error: `Não foi possível consultar os preços em tempo real: ${err.message}`,
      fetchedAt: null,
    })
  }
}
