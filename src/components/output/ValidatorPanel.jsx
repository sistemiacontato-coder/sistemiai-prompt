const TYPE_CONFIG = {
  critical: { color: 'text-error', bg: 'bg-error-container/20', border: 'border-error/30', icon: 'error', label: 'CRITICAL' },
  warning: { color: 'text-tertiary', bg: 'bg-tertiary-container/20', border: 'border-tertiary/30', icon: 'warning', label: 'WARNING' },
  info: { color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20', icon: 'info', label: 'INFO' },
  success: { color: 'text-secondary', bg: 'bg-secondary/5', border: 'border-secondary/20', icon: 'check_circle', label: 'VALID' },
}

export default function ValidatorPanel({ validationResults }) {
  if (!validationResults || validationResults.length === 0) {
    return (
      <div className="space-y-2">
        <p className="label-caps text-[10px] mb-3 opacity-60">VALIDATOR</p>
        <div className="p-3 bg-surface-container rounded border border-outline-variant flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant/40">pending</span>
          <p className="text-[11px] font-mono text-on-surface-variant/40">Aguardando configuração...</p>
        </div>
      </div>
    )
  }

  const criticals = validationResults.filter(r => r.type === 'critical')
  const warnings = validationResults.filter(r => r.type === 'warning')
  const infos = validationResults.filter(r => r.type === 'info')
  const successes = validationResults.filter(r => r.type === 'success')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="label-caps text-[10px] opacity-60">VALIDATOR</p>
        <div className="flex items-center gap-2">
          {criticals.length > 0 && (
            <span className="flex items-center gap-1 text-error text-[9px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
              {criticals.length}
            </span>
          )}
          {warnings.length > 0 && (
            <span className="flex items-center gap-1 text-tertiary text-[9px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
              {warnings.length}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {validationResults.map((result, i) => {
          const cfg = TYPE_CONFIG[result.type] || TYPE_CONFIG.info
          return (
            <div key={i} className={`p-2.5 ${cfg.bg} border ${cfg.border} rounded flex flex-col gap-1`}>
              <div className={`flex items-center gap-1.5 ${cfg.color}`}>
                <span className="material-symbols-outlined text-[14px]">{cfg.icon}</span>
                <span className="text-[9px] font-mono font-bold tracking-widest">{cfg.label}</span>
              </div>
              <p className="text-[11px] font-mono leading-tight" style={{ color: 'var(--tw-color-on-surface, #dae2fd)', opacity: 0.8 }}>
                {result.message}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
