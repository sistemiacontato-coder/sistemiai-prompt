const STATE_CONFIG = {
  in_process: { color: '#adc6ff', bg: '#adc6ff15', border: '#adc6ff40', label: 'in_process', icon: 'loop' },
  success: { color: '#4edea3', bg: '#4edea315', border: '#4edea340', label: 'success', icon: 'check_circle' },
  saida_atendente: { color: '#ffb786', bg: '#ffb78615', border: '#ffb78640', label: 'saida_atendente', icon: 'support_agent' },
  custom: { color: '#c2c6d6', bg: '#c2c6d610', border: '#c2c6d630', label: 'saida_custom', icon: 'arrow_forward' },
}

function StateNode({ config, size = 'md' }) {
  const cfg = STATE_CONFIG[config.key] || STATE_CONFIG.custom
  const sizeClass = size === 'sm' ? 'p-2' : 'p-3'
  return (
    <div
      className={`${sizeClass} rounded border flex items-center gap-2 min-w-0`}
      style={{ background: cfg.bg, borderColor: cfg.border }}
    >
      <span className="material-symbols-outlined text-[14px] flex-shrink-0" style={{ color: cfg.color }}>
        {cfg.icon}
      </span>
      <span className="font-mono text-[10px] font-semibold truncate" style={{ color: cfg.color }}>
        {config.key}
      </span>
    </div>
  )
}

function Arrow({ label }) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      <div className="w-4 h-px bg-outline-variant" />
      <span className="text-[9px] font-mono text-on-surface-variant/40">{label}</span>
      <div className="flex items-center">
        <div className="w-6 h-px bg-outline-variant" />
        <span className="text-on-surface-variant/40 text-[10px] -ml-1">▶</span>
      </div>
    </div>
  )
}

export default function StateMachineMap({ exitDestinations = [] }) {
  const customExits = exitDestinations.filter(e => !e.isSystem && e.key !== 'saida_atendente')
  const hasAtendente = exitDestinations.some(e => e.key === 'saida_atendente')

  return (
    <div className="space-y-3">
      <p className="label-caps text-[10px] mb-3 opacity-60">FLUXO DE ESTADOS</p>

      {/* Entrada */}
      <div className="flex items-center gap-2">
        <div className="bg-surface-container-high border border-outline-variant rounded px-3 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary pulse-glow" />
          <span className="font-mono text-[10px] text-secondary">INÍCIO</span>
        </div>
        <div className="flex items-center text-on-surface-variant/30">
          <div className="w-4 h-px bg-outline-variant" />
          <span className="text-[10px]">▶</span>
        </div>
        <StateNode config={{ key: 'in_process' }} />
      </div>

      {/* Loop */}
      <div className="ml-8 border-l border-outline-variant/40 pl-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-on-surface-variant/30 flex-shrink-0">repetição</span>
          <div className="flex items-center text-on-surface-variant/20">
            <div className="w-3 h-px bg-outline-variant/40" />
            <span className="text-[9px]">↺</span>
          </div>
          <StateNode config={{ key: 'in_process' }} size="sm" />
        </div>

        <p className="text-[9px] font-mono text-on-surface-variant/30">coleta informações → aguarda resposta</p>

        {/* Saídas terminais */}
        <div className="space-y-1.5 pt-1">
          <StateNode config={{ key: 'success' }} size="sm" />

          {customExits.map(e => (
            <StateNode key={e.id} config={e} size="sm" />
          ))}

          {hasAtendente && (
            <div>
              <StateNode config={{ key: 'saida_atendente' }} size="sm" />
              <p className="text-[9px] font-mono text-tertiary/50 ml-6 mt-0.5">
                ↳ tentativas = {exitDestinations.find(e=>e.key==='saida_atendente')?.maxAttempts || 3} OU pedido humano
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="pt-3 border-t border-outline-variant/30 space-y-1">
        <p className="label-caps text-[9px] opacity-40 mb-2">LEGENDA</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {[
            { color: '#adc6ff', label: 'Continuidade' },
            { color: '#4edea3', label: 'Terminal' },
            { color: '#ffb786', label: 'Humano' },
            { color: '#ffb4ab', label: 'Fora escopo' },
            { color: '#c2c6d6', label: 'Transferência' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: item.color + '40', border: `1px solid ${item.color}60` }} />
              <span className="text-[9px] font-mono text-on-surface-variant/50">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
