import { createClient } from '@supabase/supabase-js'

let _client = null

async function getClient() {
  if (_client) return _client

  let url = import.meta.env.VITE_SUPABASE_URL
  let key = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Em produção, busca as credenciais via API (anon key é pública por design)
  if (!url || !key) {
    try {
      const res = await fetch('/api/public-config')
      const cfg = await res.json()
      url = cfg.supabaseUrl
      key = cfg.supabaseAnonKey
    } catch {}
  }

  if (!url || !key) throw new Error('Supabase não configurado.')
  _client = createClient(url, key)
  return _client
}

export async function signIn(email, password) {
  const sb = await getClient()
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data.session
}

export async function signUp(email, password) {
  const sb = await getClient()
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  const sb = await getClient()
  await sb.auth.signOut()
}

export async function getSession() {
  try {
    const sb = await getClient()
    const { data } = await sb.auth.getSession()
    return data?.session ?? null
  } catch {
    return null
  }
}

export async function onAuthStateChange(callback) {
  const sb = await getClient()
  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
  return data.subscription
}
