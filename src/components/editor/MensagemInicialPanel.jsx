import { useState } from 'react'
import { callAI } from '../../lib/claude'

const BC_VARS = [
  { tag: '{primeiro-nome}', label: 'Primeiro nome' },
  { tag: '{nome-completo}', label: 'Nome completo' },
  { tag: '{email}', label: 'E-mail' },
  { tag: '{telefone}', label: 'Telefone' },
  { tag: '{Resumo}', label: 'Resumo da conversa' },
]

function autoInstrucoesFromVars(variables) {
  const commonMap = {
    nome_cliente: '{primeiro-nome}',
    nome: '{primeiro-nome}',
    email: '{email}',
    telefone: '{telefone}',
    plano: '{plano}',
    data_pagamento: '{data-pagamento}',
  }
  return variables
    .filter(v => v.name?.trim())
    .map(v => {
      const key = v.name.toLowerCase()
      const bcVar = commonMap[key] || `{${key.replace(/_/g, '-')}}`
      const label = v.description?.replace(/^salvar aqui\s*/i, '') || v.name.replace(/_/g, ' ')
      return `${label}: ${bcVar}`
    })
    .join('\n')
}

async function gerarPreInstrucao(config, instrucoesIndividuais, aiConfig) {
  const temInstrucoes = instrucoesIndividuais.trim().length > 0
  const prompt = `Você é especialista em BotConversa. Gere a "Mensagem Inicial para a I.A." para o agente abaixo.
Esta é uma pré-instrução interna (invisível ao usuário) enviada antes do prompt principal começar.

AGENTE: ${config.agentName || 'Assistente Virtual'}
OBJETIVO: ${config.domain || '(não informado)'}
${temInstrucoes ? `\nINSTRUÇÕES INDIVIDUAIS (dados do CRM já disponíveis):\n${instrucoesIndividuais}` : ''}

Estrutura obrigatória da pré-instrução:
1. Se for a PRIMEIRA interação (campo {Resumo} vazio ou inexistente): o que o agente deve fazer — saudação${temInstrucoes ? ', use os dados disponíveis para personalizar' : ', pergunte o nome'}, como marcar o status (in_process)
2. Se NÃO for a primeira interação: como reconhecer o contexto salvo em {Resumo} e continuar naturalmente
3. Instrução para focar 100% no objetivo acima

Retorne APENAS o texto da pré-instrução, sem explicações, sem markdown, sem aspas. Máximo 6 frases.`

  return callAI(prompt, aiConfig)
}

export default function MensagemInicialPanel({ config, mensagemInicial, setMensagemInicial, aiConfig }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const { tipo, textoFixo, instrucoesIndividuais, preInstrucaoIA } = mensagemInicial
  const set = (key, val) => setMensagemInicial(prev => ({ ...prev, [key]: val }))

  const handleAutoInstrucoes = () => {
    const sugestao = autoInstrucoesFromVars(config.variables || [])
    set('instrucoesIndividuais', sugestao || '')
  }

  const handleGerarPreInstrucao = async () => {
    if (!aiConfig?.apiKey) { setGenError('Configure a chave de IA em Config IA.'); return }
    setIsGenerating(true)
    setGenError('')
    try {
      const texto = await gerarPreInstrucao(config, instrucoesIndividuais, aiConfig)
      set('preInstrucaoIA', texto.trim())
    } catch (e) {
      setGenError(e.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const insertTag = (tag) => {
    set('instrucoesIndividuais', (instrucoesIndividuais ? instrucoesIndividuais + '\n' : '') + `${tag.replace(/{|}/g, m => m)}: `)
  }

  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden"
             style={{ background: 'var(--color-surface-container)' }}>
      {/* Accent */}
      <div className="h-0.5 bg-gradient-to-r from-primary/70 via-secondary/40 to-transparent" />

      {/* Header */}
      <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
             style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>forum</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-on-surface leading-none">Mensagem Inicial</h3>
          <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">
            Configure como o bot inicia a conversa com o contato
          </p>
        </div>
        <span className="label-caps text-[9px] text-on-surface-variant/40 border border-outline-variant px-2 py-0.5 rounded">
          V2
        </span>
      </div>

      <div className="p-6 space-y-5">
        {/* Toggle tipo */}
        <div>
          <p className="label-caps text-[10px] opacity-60 mb-2">TIPO DE MENSAGEM INICIAL</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'fixa', icon: 'chat', label: 'Mensagem Fixa', sub: 'Para o contato — texto estático' },
              { id: 'ia',   icon: 'smart_toy', label: 'Gerada pela I.A.', sub: 'Dinâmica com contexto do CRM' },
            ].map(opt => {
              const active = tipo === opt.id
              return (
                <button key={opt.id} type="button" onClick={() => set('tipo', opt.id)}
                  className="flex items-start gap-3 px-4 py-3 rounded-lg border text-left transition-all"
                  style={{
                    borderColor: active ? 'color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'var(--color-outline-variant)',
                    background: active ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'var(--color-surface)',
                  }}>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${active ? 'border-primary' : 'border-outline-variant'}`}>
                    {active && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`material-symbols-outlined ${active ? 'text-primary' : 'text-on-surface-variant/50'}`} style={{ fontSize: 14 }}>{opt.icon}</span>
                      <p className={`text-[11px] font-mono font-semibold leading-none ${active ? 'text-primary' : 'text-on-surface-variant/60'}`}>{opt.label}</p>
                    </div>
                    <p className="text-[10px] font-mono text-on-surface-variant/40 mt-1 leading-relaxed">{opt.sub}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* FIXA */}
        {tipo === 'fixa' && (
          <div>
            <p className="label-caps text-[10px] opacity-60 mb-1.5">MENSAGEM PARA O CONTATO</p>
            <textarea
              value={textoFixo}
              onChange={e => set('textoFixo', e.target.value)}
              placeholder="Ex: Olá! Seja bem-vindo à Academia CorpoSuada. Como posso te ajudar hoje?"
              rows={4}
              className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary resize-none"
              style={{ background: 'var(--color-surface)' }}
            />
            <p className="text-[9px] font-mono text-on-surface-variant/35 mt-1">
              Esta mensagem é enviada diretamente ao contato. Não precisa de pré-instrução para a I.A.
            </p>
          </div>
        )}

        {/* I.A. */}
        {tipo === 'ia' && (
          <>
            {/* Instruções Individuais */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="label-caps text-[10px] opacity-60">INSTRUÇÕES INDIVIDUAIS</p>
                <button
                  type="button"
                  onClick={handleAutoInstrucoes}
                  disabled={!(config.variables?.length > 0)}
                  className="flex items-center gap-1 text-[10px] font-mono text-primary hover:opacity-75 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span>
                  Auto-preencher com variáveis
                </button>
              </div>
              <textarea
                value={instrucoesIndividuais}
                onChange={e => set('instrucoesIndividuais', e.target.value)}
                placeholder={'Nome do cliente: {primeiro-nome}\nPlano atual: {plano}\nÚltimo pagamento: {data-pagamento}'}
                rows={4}
                className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary resize-none"
                style={{ background: 'var(--color-surface)' }}
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {BC_VARS.map(v => (
                  <button key={v.tag} type="button" onClick={() => insertTag(v.tag)}
                    className="text-[9px] font-mono px-2 py-0.5 rounded border border-outline-variant/60 text-on-surface-variant/60 hover:text-primary hover:border-primary/50 transition-all">
                    {v.tag}
                  </button>
                ))}
              </div>
              <p className="text-[9px] font-mono text-on-surface-variant/35 mt-1">
                Dados do CRM que o BotConversa injeta automaticamente antes de cada interação.
              </p>
            </div>

            {/* Mensagem Inicial para a I.A. */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="label-caps text-[10px] opacity-60">MENSAGEM INICIAL PARA A I.A.</p>
                <button
                  type="button"
                  onClick={handleGerarPreInstrucao}
                  disabled={isGenerating || !aiConfig?.apiKey}
                  className="flex items-center gap-1 text-[10px] font-mono text-secondary hover:opacity-75 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">
                  {isGenerating
                    ? <><span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span> Gerando...</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: 13 }}>auto_awesome</span> Gerar com I.A.</>}
                </button>
              </div>
              <textarea
                value={preInstrucaoIA}
                onChange={e => set('preInstrucaoIA', e.target.value)}
                placeholder="Cole ou gere aqui a pré-instrução para a I.A. — texto interno, não visível ao usuário..."
                rows={6}
                className="w-full rounded-lg border border-outline-variant px-3 py-2.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary resize-none"
                style={{ background: 'var(--color-surface)' }}
              />
              {genError && (
                <p className="text-[9px] font-mono text-error mt-1">{genError}</p>
              )}
              <p className="text-[9px] font-mono text-on-surface-variant/35 mt-1">
                Instrução interna enviada à I.A. antes do prompt principal. Recomendo referenciar <code className="bg-surface-container px-1 rounded">{'{Resumo}'}</code> para detectar se é primeira ou demais interações.
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
