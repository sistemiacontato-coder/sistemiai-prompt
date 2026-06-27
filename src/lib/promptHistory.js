import { fetchSettings, saveSettings } from './supabase'

const SETTINGS_KEY = 'prompt_history'
const MAX_ENTRIES = 30

export async function loadHistory() {
  try {
    const raw = await fetchSettings(SETTINGS_KEY)
    if (!Array.isArray(raw)) return []
    const seen = new Set()
    return raw.filter(e => {
      const key = e.agentKey !== undefined ? e.agentKey : (e.config?.agentName || '').trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } catch {
    return []
  }
}

export async function saveSnapshot({ config, prompt, description }) {
  const history = await loadHistory()
  const agentKey = (config.agentName || '').trim()
  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    agentKey,
    description,
    config: JSON.parse(JSON.stringify(config)),
    prompt,
  }
  const rest = history.filter(e => {
    const key = e.agentKey !== undefined ? e.agentKey : (e.config?.agentName || '').trim()
    return key !== agentKey
  })
  const updated = [entry, ...rest].slice(0, MAX_ENTRIES)
  await saveSettings(SETTINGS_KEY, updated)
  return updated
}

export async function deleteSnapshot(id) {
  const history = await loadHistory()
  const updated = history.filter(e => e.id !== id)
  await saveSettings(SETTINGS_KEY, updated)
  return updated
}

export async function clearHistory(agentKey) {
  const history = await loadHistory()
  const updated = agentKey !== undefined
    ? history.filter(e => e.agentKey !== agentKey)
    : []
  await saveSettings(SETTINGS_KEY, updated)
  return updated
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
