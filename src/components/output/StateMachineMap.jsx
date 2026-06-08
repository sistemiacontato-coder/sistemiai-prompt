// Cores via variáveis CSS — funcionam em modo claro e escuro
const STATE_CONFIG = {
  in_process:      { colorVar: 'primary',   icon: 'loop',          label: 'in_process' },
  success:         { colorVar: 'secondary', icon: 'check_circle',  label: 'success' },
  saida_atendente: { colorVar: 'tertiary',  icon: 'support_agent', label: 'saida_atendente' },
  custom:          { colorVar: 'outline',   icon: 'arrow_forward', label: 'saida_custom' },
}

function nodeStyle(cfg) {
  const c = `rgb(var(--color-${cfg.colorVar}))`
  return {
    color:       c,
    background:  `rgb(var(--color-${cfg.colorVar}) / 0.10)`,
    borderColor: `rgb(var(--color-${cfg.colorVar}) / 0.35)`,
  }
}

function StateNode({ config, size = 'md' }) {
  const cfg = STATE_CONFIG[config.key] || STATE_CONFIG.custom
  const s = nodeStyle(cfg)
  return (
    <div
      className={`${size === 'sm' ? 'p-2' : 'p-3'} rounded border flex items-center gap-2 min-w-0`}
      style={{ background: s.background, borderColor: s.borderColor }}
    >
      <span className="material-symbols-outlined text-[14px] flex-shrink-0" style={{ color: s.color }}>
        {cfg.icon}
      </span>
      <span className="font-mono text-[10px] font-semibold truncate" style={{ color: s.color }}>
        {config.key}
      </span>
    </div>
  )
}

function Arrow({ label }) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      <div className="w-4 h-px bg-outline-variant" />
      <span className="text-[9px] font-mono text-on-surface-variant/60">{label}</span>
      <div className="flex items-center">
        <div className="w-6 h-px bg-outline-variant" />
        <span className="text-on-surface-variant/60 text-[10px] -ml-1">▶</span>
      </div>
    </div>
  )
}

export default function StateMachineMap({ exitDestinations = [] }) {
  const customExits = exitDestinations.filter(e => !e.isSystem && e.key !== 'saida_atendente')
  const hasAtendente = exitDestinations.some(e => e.key === 'saida_atendente')

  return (
    <div className="space-y-3">
      <p className="label-caps text-[10px] mb-3 opacity-70">FLUXO DE ESTADOS</p>

      {/* Entrada */}
      <div className="flex items-center gap-2">
        <div className="bg-surface-container-high border border-outline-variant rounded px-3 py-1.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary pulse-glow" />
          <span className="font-mono text-[10px] font-semibold text-secondary">INÍCIO</span>
        </div>
        <div className="flex items-center text-on-surface-variant/50">
          <div className="w-4 h-px bg-outline-variant" />
          <span className="text-[10px]">▶</span>
        </div>
        <StateNode config={{ key: 'in_process' }} />
      </div>

      {/* Loop */}
      <div className="ml-8 border-l border-outline-variant/60 pl-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-on-surface-variant/60 flex-shrink-0">repetição</span>
          <div className="flex items-center text-on-surface-variant/40">
            <div className="w-3 h-px bg-outline-variant/60" />
            <span className="text-[9px]">↺</span>
          </div>
          <StateNode config={{ key: 'in_process' }} size="sm" />
        </div>

        <p className="text-[9px] font-mono text-on-surface-variant/60">coleta informações → aguarda resposta</p>

        {/* Saídas terminais */}
        <div className="space-y-1.5 pt-1">
          <StateNode config={{ key: 'success' }} size="sm" />

          {customExits.map(e => (
            <StateNode key={e.id} config={e} size="sm" />
          ))}

          {hasAtendente && (
            <div>
              <StateNode config={{ key: 'saida_atendente' }} size="sm" />
              <p className="text-[9px] font-mono text-tertiary/70 ml-6 mt-0.5">
                ↳ tentativas = {exitDestinations.find(e => e.key === 'saida_atendente')?.maxAttempts || 3} OU pedido humano
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="pt-3 border-t border-outline-variant/50 space-y-1">
        <p className="label-caps text-[9px] opacity-60 mb-2">LEGENDA</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {[
            { colorVar: 'primary',   label: 'Continuidade' },
            { colorVar: 'secondary', label: 'Terminal' },
            { colorVar: 'tertiary',  label: 'Humano' },
            { colorVar: 'error',     label: 'Fora escopo' },
            { colorVar: 'outline',   label: 'Transferência' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{
                background: `rgb(var(--color-${item.colorVar}) / 0.25)`,
                border: `1px solid rgb(var(--color-${item.colorVar}) / 0.50)`,
              }} />
              <span className="text-[9px] font-mono text-on-surface-variant/70">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
