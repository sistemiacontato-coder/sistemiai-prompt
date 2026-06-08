const STORAGE_KEY = 'sistemia_prompt_history'
const MAX_ENTRIES = 30

export function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function saveSnapshot({ config, prompt, description }) {
  const history = loadHistory()
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    description,
    config: JSON.parse(JSON.stringify(config)),
    prompt,
  }
  const updated = [entry, ...history].slice(0, MAX_ENTRIES)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function deleteSnapshot(id) {
  const history = loadHistory()
  const updated = history.filter(e => e.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function clearHistory() {
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
