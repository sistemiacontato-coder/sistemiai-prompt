const TONE_RULES = [
  {
    key: 'formal',
    label: 'Formal e objetivo',
    detail: 'Tom formal, objetivo e prestativo em todas as respostas.',
    defaultVal: true,
  },
  {
    key: 'noSlang',
    label: 'Sem gírias',
    detail: 'Sem gírias ou termos carinhosos (querido, amigo, parceiro, mano...).',
    defaultVal: true,
  },
  {
    key: 'noGreetings',
    label: 'Sem felicitações',
    detail: 'Sem comentários subjetivos ou felicitações fora do escopo.',
    defaultVal: true,
  },
  {
    key: 'neutralLanguage',
    label: 'Linguagem neutra',
    detail: 'Sem duplas de gênero (o/a, Senhor/a). Linguagem inclusiva.',
    defaultVal: true,
  },
  {
    key: 'noDash',
    label: 'Sem travessão (—)',
    detail: 'Substituir travessão por vírgula ou reescrever a frase.',
    defaultVal: true,
  },
  {
    key: 'noRepeat',
    label: 'Não repetir respostas',
    detail: 'Não ecoar o que o cliente acabou de dizer.',
    defaultVal: true,
  },
]

const SAFETY_RULES = [
  {
    key: 'noHallucination',
    label: 'Nunca inventar respostas',
    detail: 'Se não souber a resposta ou a pergunta estiver fora do objetivo, transfere imediatamente para atendente. Dúvida = transferência. Nunca tentativa.',
    defaultVal: true,
    isSafety: true,
  },
]

function Toggle({ on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
        on ? 'bg-primary' : 'bg-outline-variant'
      }`}>
      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
        on ? 'translate-x-3.5' : 'translate-x-0.5'
      }`} />
    </button>
  )
}

export default function ToneRulesPanel({ config, setConfig }) {
  const tr = config.toneRules || {}
  const get = (key, def = true) => tr[key] !== undefined ? !!tr[key] : def
  const set = (key, val) => setConfig(prev => ({
    ...prev,
    toneRules: { ...prev.toneRules, [key]: val },
  }))

  const neverDenyAI = get('neverDenyAI', true)

  const toneRulesList = [
    ...TONE_RULES,
    {
      key: 'neverDenyAI',
      label: 'Admitir ser IA',
      detail: neverDenyAI
        ? 'Se questionado, confirma ser um assistente virtual. Nunca afirma ser humano.'
        : 'Se questionado sobre sua natureza, apresenta-se como consultor humano.',
      defaultVal: true,
      isIdentity: true,
    },
  ]

  const renderRule = (rule) => {
    const on = get(rule.key, rule.defaultVal)
    const isOff = (rule.isIdentity || rule.isSafety) && !on
    return (
      <div key={rule.key}
        className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
          isOff ? 'border-error/30' : 'border-outline-variant/50'
        }`}
        style={{
          background: isOff
            ? 'color-mix(in srgb, var(--color-error) 5%, var(--color-surface-container-high))'
            : on
              ? 'color-mix(in srgb, var(--color-primary) 4%, var(--color-surface-container-high))'
              : 'var(--color-surface-container-high)',
        }}
        onClick={() => set(rule.key, !on)}>
        <Toggle on={on} onChange={v => set(rule.key, v)} />
        <div className="flex-1 min-w-0">
          <p className={`text-[12px] font-mono font-semibold leading-none ${isOff ? 'text-error/80' : on ? 'text-on-surface' : 'text-on-surface-variant/40'}`}>
            {rule.label}
          </p>
          <p className={`text-[10px] font-mono mt-0.5 leading-relaxed ${isOff ? 'text-error/55' : on ? 'text-on-surface-variant/55' : 'text-on-surface-variant/25'}`}>
            {rule.detail}
          </p>
        </div>
      </div>
    )
  }

  return (
    <section className="rounded-lg border border-outline-variant overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
      <div className="h-0.5 bg-gradient-to-r from-secondary/60 via-secondary/20 to-transparent" />

      <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3"
           style={{ background: 'var(--color-surface-container-high)' }}>
        <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
             style={{ background: 'color-mix(in srgb, var(--color-secondary) 12%, transparent)' }}>
          <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>tune</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-on-surface leading-none">Tom e Comunicação</h3>
          <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">Regras de linguagem e transparência do agente</p>
        </div>
        <span className="ml-auto label-caps text-[9px] text-on-surface-variant/40 border border-outline-variant px-2 py-0.5 rounded">
          SEÇÃO 8
        </span>
      </div>

      <div className="p-5 space-y-4">

        {/* Regra de segurança — destaque especial */}
        <div>
          <p className="text-[9px] font-mono font-bold text-error/60 uppercase tracking-wider mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>shield</span>
            Segurança
          </p>
          <div className="space-y-2">
            {SAFETY_RULES.map(renderRule)}
          </div>
        </div>

        {/* Separador */}
        <div className="border-t border-outline-variant/40" />

        {/* Tom e linguagem */}
        <div>
          <p className="text-[9px] font-mono font-bold text-on-surface-variant/40 uppercase tracking-wider mb-2">
            Tom e linguagem
          </p>
          <div className="space-y-2">
            {toneRulesList.map(renderRule)}
          </div>
        </div>

      </div>
    </section>
  )
}
