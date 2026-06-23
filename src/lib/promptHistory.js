const STORAGE_KEY = 'sistemia_prompt_history'
const MAX_ENTRIES = 30

export function loadHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    // Deduplica: mantém só a entrada mais recente por agentKey
    const seen = new Set()
    const deduped = raw.filter(e => {
      const key = e.agentKey !== undefined ? e.agentKey : (e.config?.agentName || '').trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    // Persiste a versão limpa se houve duplicatas
    if (deduped.length !== raw.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deduped))
    }
    return deduped
  } catch {
    return []
  }
}

export function saveSnapshot({ config, prompt, description }) {
  const history = loadHistory()
  const agentKey = (config.agentName || '').trim()
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    agentKey,
    description,
    config: JSON.parse(JSON.stringify(config)),
    prompt,
  }
  // Upsert: remove entradas anteriores do mesmo agente e mantém só a mais recente
  const rest = history.filter(e => {
    const key = e.agentKey !== undefined ? e.agentKey : (e.config?.agentName || '').trim()
    return key !== agentKey
  })
  const updated = [entry, ...rest].slice(0, MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function deleteSnapshot(id) {
  const history = loadHistory()
  const updated = history.filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function clearHistory(agentKey) {
  const history = loadHistory()
  if (agentKey !== undefined) {
    const updated = history.filter(e => e.agentKey !== agentKey)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  }
  localStorage.removeItem(STORAGE_KEY)
  return []
}

export function formatTimestamp(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min atrás`
  if (diffH < 24) return `${diffH}h atrás`
  if (diffD < 7) return `${diffD}d atrás`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
