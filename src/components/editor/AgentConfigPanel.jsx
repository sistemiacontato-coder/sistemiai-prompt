import React from 'react'

function FieldLabel({ children, required, hint }) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <label className="label-caps flex items-center gap-1">
        {children}
        {required && <span className="text-error text-[10px]">*</span>}
      </label>
      {hint && <span className="text-[10px] font-mono text-on-surface-variant/40">{hint}</span>}
    </div>
  )
}

function ExpandModal({ label, value, onChange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-xl border border-outline-variant shadow-2xl flex flex-col overflow-hidden" style={{ background: 'var(--color-surface)', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-outline-variant" style={{ background: 'var(--color-surface-container-high)' }}>
          <span className="text-xs font-mono font-bold text-on-surface uppercase tracking-wider">{label}</span>
          <button onClick={onClose} className="text-on-surface-variant/50 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 w-full p-5 font-mono text-sm leading-relaxed bg-transparent text-on-surface outline-none"
          style={{ resize: 'none', minHeight: 320 }}
          autoFocus
        />
        <div className="px-5 py-3 border-t border-outline-variant flex justify-end" style={{ background: 'var(--color-surface-container)' }}>
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-primary text-on-primary text-xs font-mono font-bold">Fechar</button>
        </div>
      </div>
    </div>
  )
}

export default function AgentConfigPanel({ config, setConfig }) {
  const [expandedField, setExpandedField] = React.useState(null)
  const update = (field, value) => setConfig(prev => ({ ...prev, [field]: value }))

  const handleAgentNameChange = (value) => {
    update('agentName', value)
    if (!config.agentId) {
      const auto = value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toLowerCase()
      if (auto) update('agentId', auto)
    }
  }

  const handleAgentIdChange = (value) => {
    const clean = value.replace(/[^a-zA-Z]/g, '').slice(0, 3).toLowerCase()
    update('agentId', clean)
  }

  const prefix = config.agentId ? `${config.agentId}_` : null

  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>

      {/* Header com accent line */}
      <div className="h-0.5 bg-gradient-to-r from-primary via-primary/50 to-transparent" />
      <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3" style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
             style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 16 }}>smart_toy</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-on-surface leading-none">Identidade do Agente</h3>
          <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">Spec. Técnica § 1–2</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {prefix && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30"
                 style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-glow" />
              <code className="font-mono text-[11px] font-bold text-primary">{prefix}</code>
            </div>
          )}
          <span className="label-caps text-[9px] text-on-surface-variant/40 border border-outline-variant px-2 py-0.5 rounded">
            SEÇÃO 1-2
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Row 1: ID + Name */}
        <div className="grid grid-cols-[auto_1fr] gap-4 items-start">

          {/* Agent ID */}
          <div>
            <FieldLabel>AGENT_ID</FieldLabel>
            <div className="relative group">
              <div className="flex items-center gap-0 border border-outline-variant rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all"
                   style={{ background: 'var(--color-surface-container-highest)' }}>
                <div className="px-3 py-3 border-r border-outline-variant"
                     style={{ background: 'var(--color-surface-container)' }}>
                  <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 14 }}>tag</span>
                </div>
                <input
                  type="text"
                  value={config.agentId || ''}
                  onChange={e => handleAgentIdChange(e.target.value)}
                  maxLength={3}
                  placeholder="CAR"
                  className="w-14 bg-transparent px-2 py-3 text-sm font-mono font-bold text-primary lowercase tracking-[0.2em] focus:outline-none placeholder:text-on-surface-variant/25 placeholder:font-normal placeholder:tracking-normal"
                />
                <span className="pr-2 font-mono font-bold text-on-surface-variant/30 select-none text-sm">_</span>
              </div>
              <p className="text-[9px] font-mono text-on-surface-variant/35 mt-1.5 text-center">3 letras</p>
            </div>
          </div>

          {/* Agent Name */}
          <div>
            <FieldLabel required hint={config.agentName.length > 0 ? `${config.agentName.length} chars` : null}>
              NOME DO AGENTE
            </FieldLabel>
            <input
              type="text"
              value={config.agentName}
              onChange={e => handleAgentNameChange(e.target.value)}
              placeholder="Ex: Assistente Cartório Central"
              className="input-field rounded-lg"
            />
          </div>
        </div>

        {/* Max Attempts stepper */}
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-outline-variant"
             style={{ background: 'var(--color-surface-container-high)' }}>
          <div className="flex-1">
            <p className="label-caps mb-0.5">MAX_ATTEMPTS</p>
            <p className="text-[10px] font-mono text-on-surface-variant/50">
              Tentativas antes de escalar para <code className="text-tertiary">saida_atendente</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => update('maxAttempts', Math.max(1, config.maxAttempts - 1))}
              className="w-7 h-7 rounded border border-outline-variant flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all active:scale-95"
              style={{ background: 'var(--color-surface-container)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove</span>
            </button>
            <div className="w-10 h-7 flex items-center justify-center rounded border border-primary/40 font-mono font-bold text-primary text-sm"
                 style={{ background: 'color-mix(in srgb, var(--color-primary) 8%, transparent)' }}>
              {config.maxAttempts}
            </div>
            <button
              onClick={() => update('maxAttempts', Math.min(5, config.maxAttempts + 1))}
              className="w-7 h-7 rounded border border-outline-variant flex items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-all active:scale-95"
              style={{ background: 'var(--color-surface-container)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            </button>
          </div>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <div key={n} className={`w-1.5 h-1.5 rounded-full transition-all ${n <= config.maxAttempts ? 'bg-primary' : 'bg-outline-variant'}`} />
            ))}
          </div>
        </div>

        {/* Persona + Objetivo agrupados */}
        <div className="space-y-4">

        <div>
          <FieldLabel hint={config.agentPersona.length > 0 ? `${config.agentPersona.length} chars` : null}>
            PERSONA DO AGENTE
          </FieldLabel>
          <div className="relative">
            <textarea
              rows={3}
              value={config.agentPersona}
              onChange={e => update('agentPersona', e.target.value)}
              placeholder="Como este agente se comporta? Ex: especializado em atendimento de cartório, formal e objetivo, com domínio em certidões e registros civis..."
              className="textarea-field rounded-lg text-sm leading-relaxed"
              style={{ resize: 'vertical' }}
            />
            <button onClick={() => setExpandedField('agentPersona')} className="absolute top-2 right-2 opacity-30 hover:opacity-70 transition-opacity" title="Expandir">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>open_in_full</span>
            </button>
          </div>
        </div>

        {/* Objetivo do Assistente */}
        <div>
          <FieldLabel required hint={config.domain.length > 0 ? `${config.domain.length} chars` : null}>
            OBJETIVO DO ASSISTENTE
          </FieldLabel>
          <div className="relative">
            <textarea
              rows={5}
              value={config.domain}
              onChange={e => update('domain', e.target.value)}
              placeholder="Descreva o que este agente faz e para onde ele encaminha. Ex: Este assistente tira dúvidas sobre cursos, encaminha para o setor de matrículas quando o cliente quer se matricular, para o setor de agendamento quando quer agendar uma aula, e para o setor de dúvidas para informações gerais."
              className="textarea-field rounded-lg text-sm leading-relaxed"
              style={{ resize: 'vertical' }}
            />
            <button onClick={() => setExpandedField('domain')} className="absolute top-2 right-2 opacity-30 hover:opacity-70 transition-opacity" title="Expandir">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>open_in_full</span>
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-error/60" style={{ fontSize: 12 }}>info</span>
            <p className="text-[10px] font-mono text-on-surface-variant/40">
              Qualquer solicitação fora deste objetivo ativa{' '}
              <code className="text-error/70">saida_atendente</code>
            </p>
          </div>
        </div>

        </div>{/* fim grupo Persona+Objetivo */}

      </div>

      {expandedField && (
        <ExpandModal
          label={expandedField === 'domain' ? 'OBJETIVO DO ASSISTENTE' : 'PERSONA DO AGENTE'}
          value={config[expandedField]}
          onChange={v => update(expandedField, v)}
          onClose={() => setExpandedField(null)}
        />
      )}
    </section>
  )
}
