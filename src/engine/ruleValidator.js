/**
 * Validador de Regras de Comunicação — Especificação Técnica 1.0 § 8
 * Detecta violações nas configurações antes de gerar o prompt.
 */

const FORBIDDEN_AFFECTIONATE = [
  /\bquerido[a]?\b/gi, /\bamigo[a]?\b/gi, /\bparceiro[a]?\b/gi,
  /\bmano\b/gi, /\bchefe\b/gi, /\bseu\s+mestre\b/gi,
  /\bcampeão\b/gi, /\bcampeao\b/gi, /\bflor\b/gi,
]

const FORBIDDEN_SLANG = [
  /\bblz\b/gi, /\bfala\s+aí\b/gi, /\bvlw\b/gi, /\bvaleu\b/gi,
  /\bshow\s+de\s+bola\b/gi, /\bsuave\b/gi, /\btranquilo\b/gi,
  /\bde\s+boas\b/gi, /\bsó\s+isso\b/gi,
]

const EM_DASH_REGEX = /—/g

export function validateConfig(config) {
  const results = []
  const { agentName, agentPersona, domain, variables, exitDestinations } = config

  // Campos obrigatórios
  if (!agentName?.trim()) {
    results.push({ type: 'critical', code: 'MISSING_AGENT_NAME', message: 'Nome do agente é obrigatório.' })
  }
  if (!agentPersona?.trim()) {
    results.push({ type: 'warning', code: 'MISSING_PERSONA', message: 'Persona não definida. O agente terá comportamento genérico.' })
  }
  if (!domain?.trim()) {
    results.push({ type: 'critical', code: 'MISSING_DOMAIN', message: 'Objetivo do agente é obrigatório.' })
  }

  // Verificar travessão
  const allText = [agentName, agentPersona, domain].join(' ')
  if (EM_DASH_REGEX.test(allText)) {
    results.push({ type: 'warning', code: 'EM_DASH_DETECTED', message: 'Travessão (—) detectado. Será substituído por vírgula automaticamente na Regra 8.' })
  }

  // Verificar termos carinhosos
  for (const pattern of FORBIDDEN_AFFECTIONATE) {
    if (pattern.test(allText)) {
      results.push({ type: 'warning', code: 'AFFECTIONATE_TERM', message: `Termo carinhoso detectado no texto. Verifique as Regras de Comunicação (§ 8).` })
      break
    }
  }

  // Verificar gírias
  for (const pattern of FORBIDDEN_SLANG) {
    if (pattern.test(allText)) {
      results.push({ type: 'warning', code: 'SLANG_DETECTED', message: `Gíria detectada no texto. O tom deve ser formal e objetivo (§ 8).` })
      break
    }
  }

  // Variáveis sem nome
  const emptyVars = variables?.filter(v => !v.name?.trim())
  if (emptyVars?.length > 0) {
    results.push({ type: 'warning', code: 'EMPTY_VARIABLE_NAME', message: `${emptyVars.length} variável(is) sem nome definido. Serão ignoradas.` })
  }

  // Verificar duplicatas de variáveis
  const varNames = variables?.filter(v => v.name?.trim()).map(v => v.name.trim().toLowerCase())
  const uniqueVarNames = new Set(varNames)
  if (varNames?.length !== uniqueVarNames.size) {
    results.push({ type: 'warning', code: 'DUPLICATE_VARIABLES', message: 'Variáveis com nomes duplicados detectadas. Apenas a primeira será mantida.' })
  }

  // Destinos de saída — exclui exits de sistema e padrão (success, saida_atendente)
  const exits = exitDestinations?.filter(e => !e.isSystem && !e.isDefault && e.key)
  const customExits = exits

  if (customExits?.length === 0) {
    results.push({ type: 'info', code: 'NO_CUSTOM_EXITS', message: 'Nenhum destino de transferência personalizado configurado. Usando apenas saída padrão.' })
  }

  customExits?.forEach(e => {
    if (!e.key.startsWith('saida_')) {
      results.push({ type: 'warning', code: 'INVALID_EXIT_KEY', message: `Destino "${e.key}" não segue o padrão saida_[destino]. Será corrigido automaticamente.` })
    }
    if (!e.description?.trim()) {
      results.push({ type: 'info', code: 'MISSING_EXIT_DESC', message: `Destino "${e.key}" sem descrição. Recomendado para documentação.` })
    }
  })

  // Tudo OK
  if (results.filter(r => r.type === 'critical' || r.type === 'warning').length === 0) {
    results.push({ type: 'success', code: 'VALIDATION_PASSED', message: 'Configuração validada. Prompt pronto para geração.' })
  }

  return results
}

export function sanitizeText(text) {
  if (!text) return text
  // Substituir travessão por vírgula (Regra 8)
  return text.replace(/—/g, ',')
}

export function hasCriticalErrors(validationResults) {
  return validationResults.some(r => r.type === 'critical')
}
