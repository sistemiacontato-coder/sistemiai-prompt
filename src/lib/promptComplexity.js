/**
 * Classifica a complexidade do prompt gerado e retorna recomendações de modelo e temperatura.
 * Lógica determinística — sem chamada de IA.
 */

const LEVELS = {
  simples:        { label: 'Simples',        color: 'secondary' },
  moderado:       { label: 'Moderado',       color: 'primary'   },
  complexo:       { label: 'Complexo',       color: 'tertiary'  },
  muito_complexo: { label: 'Muito Complexo', color: 'error'     },
}

export function classifyPromptComplexity(prompt, config) {
  const charCount  = (prompt || '').length
  const varCount   = (config.variables || []).length
  const exitCount  = (config.exitDestinations || []).filter(e => !e.isSystem).length
  const enumCount  = (config.variables || []).filter(v => v.type === 'enum').length

  // Nível baseado nos fatores mais restritivos
  let level
  if (charCount > 5000 || varCount >= 8 || exitCount >= 8 || enumCount >= 4) {
    level = 'muito_complexo'
  } else if (charCount > 3000 || varCount >= 5 || exitCount >= 6 || enumCount >= 2) {
    level = 'complexo'
  } else if (charCount > 1500 || varCount >= 3 || exitCount >= 4) {
    level = 'moderado'
  } else {
    level = 'simples'
  }

  const recommendations = {
    simples: {
      model:       'gpt-4.1-mini',
      temperature: 0.3,
      modelNote:   'Fluxo direto e previsível. gpt-4.1-mini é rápido, econômico e suficiente para prompts simples.',
      tempNote:    'Temperatura levemente mais alta permite respostas mais naturais sem risco de imprecisão em fluxos simples.',
    },
    moderado: {
      model:       'gpt-4.1-mini',
      temperature: 0.2,
      modelNote:   'Algumas variáveis e saídas. gpt-4.1-mini cobre bem com boa relação custo-precisão.',
      tempNote:    'Equilíbrio entre naturalidade e consistência no seguimento das condições de saída.',
    },
    complexo: {
      model:       'gpt-4.1',
      temperature: 0.1,
      modelNote:   'Várias saídas condicionais e variáveis. gpt-4.1 tem capacidade superior de seguir instruções complexas.',
      tempNote:    'Temperatura baixa para evitar que o modelo ignore condições de saída ou improvise respostas incorretas.',
    },
    muito_complexo: {
      model:       'gpt-4.1',
      temperature: 0.05,
      modelNote:   'Prompt extenso com muitas variáveis e condições. gpt-4.1 é o mais indicado para máxima precisão instrucional.',
      tempNote:    'Temperatura mínima — sem margem para desvios. O modelo deve seguir o fluxo com precisão absoluta.',
    },
  }

  return {
    level,
    ...LEVELS[level],
    ...recommendations[level],
    stats: { charCount, varCount, exitCount, enumCount },
  }
}
