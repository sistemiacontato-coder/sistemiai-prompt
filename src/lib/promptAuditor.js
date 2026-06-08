import { callAI, loadAIConfig } from './claude'

function buildAuditPrompt(generatedPrompt, config) {
  const exitKeys = config.exitDestinations
    .filter(e => !e.isSystem)
    .map(e => e.key)

  const variableNames = config.variables.map(v => v.name)

  return `Você é um auditor especialista em prompts para chatbots WhatsApp no formato BotConversa.

Analise o prompt abaixo e identifique problemas reais. Seja preciso e direto — não invente problemas onde não existem.

CONFIGURAÇÃO DO AGENTE:
- Nome: ${config.agentName || '(não definido)'}
- Saídas configuradas: ${exitKeys.join(', ') || '(nenhuma)'}
- Variáveis configuradas: ${variableNames.join(', ') || '(nenhuma)'}

PROMPT GERADO:
---
${generatedPrompt}
---

Verifique especificamente:

1. CONSISTÊNCIA DE SAÍDAS: As chaves no MAPA DE STATUS correspondem exatamente às saídas em CONDIÇÕES DE SAÍDA? Alguma saída aparece em um lugar mas não no outro?

2. FORMATO JSON: Os valores de "status" nos blocos JSON cobrem todos os cenários (in_process, success, e todas as saídas)? Os exemplos JSON têm campos ausentes ou incorretos?

3. CONTRADIÇÕES: Alguma instrução contradiz outra no mesmo prompt? Tom, regras de atendimento, condições de saída conflitantes?

4. VARIÁVEIS: As variáveis {{variavel}} são usadas corretamente? Alguma referenciada mas não declarada?

5. AMBIGUIDADE: Alguma condição de saída tem critério vago que pode confundir a IA? Duas saídas com condições sobrepostas?

6. COMPLETUDE: Falta tratamento para clientes fora do escopo? Falta saída para humano?

Retorne APENAS o JSON abaixo, sem texto adicional:

{
  "issues": [
    {
      "severity": "critical",
      "category": "saídas",
      "title": "Título curto do problema",
      "description": "Explicação clara do problema encontrado",
      "fix": "Instrução exata para corrigir via revisor"
    }
  ],
  "overallScore": 85,
  "summary": "Resumo geral em uma frase"
}

REGRAS:
- severity: "critical" (quebra o bot), "warning" (comportamento inesperado), "suggestion" (melhoria)
- Só inclua issues reais que você encontrou — não invente problemas
- fix: escreva como se fosse uma instrução para o revisor corrigir, ex: "Adicionar condição de saída para clientes que pedem reembolso"
- overallScore: 0-100, onde 100 é perfeito
- Se não encontrar nenhum problema, retorne "issues": [] e overallScore alto
- Máximo 8 issues`
}

function extractJson(text) {
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('A IA não retornou um JSON válido.')
  return JSON.parse(match[0])
}

export async function auditPrompt(generatedPrompt, config, aiConfig) {
  const cfg = aiConfig || loadAIConfig()
  if (!cfg?.apiKey) throw new Error('Nenhuma chave de IA configurada. Vá em Config IA.')
  if (!generatedPrompt?.trim()) throw new Error('Gere o prompt antes de auditar.')

  const prompt = buildAuditPrompt(generatedPrompt, config)
  const text = await callAI(prompt, cfg)
  const parsed = extractJson(text)

  return {
    issues:       Array.isArray(parsed.issues) ? parsed.issues : [],
    overallScore: typeof parsed.overallScore === 'number' ? Math.max(0, Math.min(100, parsed.overallScore)) : null,
    summary:      parsed.summary || '',
  }
}
