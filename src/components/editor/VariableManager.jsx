import { useState } from 'react'

let nextId = 10
const MAX_CHARS = 20

function TypeToggle({ value, onChange }) {
  return (
    <div>
      <label className="label-caps block mb-1.5">TIPO DO CAMPO</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: 'text', icon: 'text_fields', label: 'Texto Livre', desc: 'Qualquer valor coletado', color: 'primary' },
          { key: 'enum', icon: 'list', label: 'Enumeração', desc: 'Lista de opções fixas', color: 'secondary' },
        ].map(opt => (
          <button key={opt.key} type="button" onClick={() => onChange(opt.key)}
            className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg border text-left transition-all ${
              value === opt.key
                ? opt.key === 'enum'
                  ? 'border-secondary text-secondary'
                  : 'border-primary text-primary'
                : 'border-outline-variant text-on-surface-variant hover:border-outline'
            }`}
            style={{
              background: value === opt.key
                ? `color-mix(in srgb, var(--color-${opt.color}) 10%, transparent)`
                : 'var(--color-surface)'
            }}>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{opt.icon}</span>
              <span className="text-[11px] font-mono font-semibold">{opt.label}</span>
              {value === opt.key && (
                <span className="ml-auto material-symbols-outlined text-[12px]">check_circle</span>
              )}
            </div>
            <span className="text-[10px] font-mono opacity-60">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function VariableModal({ variable, agentId, onSave, onCancel }) {
  const prefix = agentId ? `${agentId.toLowerCase()}_` : ''
  const [name, setName] = useState(variable?.name || '')
  const [description, setDescription] = useState(variable?.description || '')
  const [type, setType] = useState(variable?.type || 'text')
  const [options, setOptions] = useState(variable?.options || '')

  const fullKey = `${prefix}${name}`
  const charCount = fullKey.length
  const isOver = charCount > MAX_CHARS
  const isValid = name.trim().length > 0 && !isOver

  const handleNameChange = (val) => {
    const clean = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if ((prefix + clean).length <= MAX_CHARS) setName(clean)
  }

  const handleSave = () => {
    if (!isValid) return
    onSave({ name: name.trim(), description: description.trim(), type, options: options.trim() })
  }

  const optionLines = options.trim().split('\n').filter(l => l.trim())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="rounded-xl border border-outline-variant w-full max-w-md shadow-2xl overflow-hidden"
           style={{ background: 'var(--color-surface-container)' }}>

        {/* Accent */}
        <div className={`h-0.5 bg-gradient-to-r ${type === 'enum' ? 'from-secondary via-secondary/50' : 'from-primary via-primary/50'} to-transparent`} />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant"
             style={{ background: 'var(--color-surface-container-high)' }}>
          <div className="w-7 h-7 rounded flex items-center justify-center"
               style={{ background: type === 'enum'
                 ? 'color-mix(in srgb, var(--color-secondary) 12%, transparent)'
                 : 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}>
            <span className={`material-symbols-outlined ${type === 'enum' ? 'text-secondary' : 'text-primary'}`} style={{ fontSize: 16 }}>
              {type === 'enum' ? 'list' : 'data_object'}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface leading-none">
              {type === 'enum' ? 'Campo de Classificação' : 'Campo Personalizado'}
            </h3>
            <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">
              {type === 'enum' ? 'Classifica intenção em opções fixas' : 'Variável coletada durante a conversa'}
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto text-on-surface-variant/40 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Tipo */}
          <TypeToggle value={type} onChange={setType} />

          {/* Nome */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label-caps">NOME DO CAMPO</label>
              <span className={`font-mono text-[10px] tabular-nums ${isOver ? 'text-error font-bold' : 'text-on-surface-variant/40'}`}>
                {charCount} / {MAX_CHARS}
              </span>
            </div>
            <div className={`flex items-center rounded-lg border overflow-hidden transition-all
              ${isOver ? 'border-error ring-1 ring-error/30' : 'border-outline-variant focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/50'}`}
              style={{ background: 'var(--color-surface)' }}>
              {prefix && (
                <div className="flex items-center gap-1 pl-3 pr-1 border-r border-outline-variant py-3 flex-shrink-0"
                     style={{ background: 'var(--color-surface-container-high)' }}>
                  <code className="font-mono text-[12px] font-bold text-primary/70">{prefix}</code>
                </div>
              )}
              <input
                type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="nome_campo"
                autoFocus
                className="flex-1 bg-transparent px-3 py-3 text-sm font-mono text-on-surface focus:outline-none placeholder:text-on-surface-variant/30"
              />
            </div>
            {fullKey && !isOver && (
              <p className="text-[10px] font-mono text-on-surface-variant/40 mt-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined" style={{ fontSize: 11 }}>arrow_right_alt</span>
                Chave no prompt: <code className="text-primary ml-1">{fullKey}</code>
              </p>
            )}
          </div>

          {/* Opções (só para enum) */}
          {type === 'enum' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label-caps">OPÇÕES VÁLIDAS</label>
                {optionLines.length > 0 && (
                  <span className="text-[10px] font-mono text-secondary/60">{optionLines.length} opção{optionLines.length !== 1 ? 'ões' : ''}</span>
                )}
              </div>
              <textarea
                rows={5}
                value={options}
                onChange={e => setOptions(e.target.value)}
                placeholder={"Uma opção por linha:\nCertidão de Nascimento\nCertidão de Casamento\nCertidão de Óbito\nCorreção de Registro"}
                className="w-full rounded-lg border border-outline-variant p-3 text-sm font-mono text-on-surface leading-relaxed resize-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 focus:outline-none transition-all"
                style={{ background: 'var(--color-surface)' }}
              />
              <p className="text-[10px] font-mono text-on-surface-variant/35 mt-1.5">
                Uma opção por linha. A IA classificará a intenção nestes valores exatos.
              </p>
            </div>
          )}

          {/* Orientação */}
          <div>
            <label className="label-caps block mb-1.5">ORIENTAÇÃO PARA A IA</label>
            <textarea
              rows={type === 'enum' ? 3 : 5}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={type === 'enum'
                ? 'Salvar aqui a classificação da intenção do usuário conforme uma das opções acima.'
                : 'Salvar aqui o valor exato informado pelo usuário. Ex: Salvar aqui o nome completo informado pelo cliente durante a conversa.'}
              className="w-full rounded-lg border border-outline-variant p-3 text-sm font-mono text-on-surface leading-relaxed resize-none focus:border-primary focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all"
              style={{ background: 'var(--color-surface)' }}
            />
            <p className="text-[10px] font-mono text-on-surface-variant/35 mt-1.5">
              Instrui a IA sobre o que salvar e como interpretar este campo.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-outline-variant"
             style={{ background: 'var(--color-surface-container-high)' }}>
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-outline-variant text-sm font-mono text-on-surface-variant hover:border-primary hover:text-primary transition-all">
            Cancelar
          </button>
          <button onClick={handleSave}
            disabled={!isValid}
            className={`px-5 py-2 rounded-lg text-sm font-mono font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              type === 'enum'
                ? 'bg-secondary text-on-secondary hover:opacity-90'
                : 'bg-primary text-on-primary hover:opacity-90'
            }`}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VariableManager({ config, setConfig, pendingChanges }) {
  const [modalState, setModalState] = useState(null)

  const prefix = config.agentId ? `${config.agentId.toLowerCase()}_` : ''

  const openAdd = () => setModalState({ mode: 'add' })
  const openEdit = (v) => setModalState({ mode: 'edit', variable: v })
  const closeModal = () => setModalState(null)

  const handleSave = ({ name, description, type, options }) => {
    if (modalState.mode === 'add') {
      setConfig(prev => ({ ...prev, variables: [...prev.variables, { id: nextId++, name, description, type, options }] }))
    } else {
      setConfig(prev => ({
        ...prev,
        variables: prev.variables.map(v => v.id === modalState.variable.id ? { ...v, name, description, type, options } : v),
      }))
    }
    closeModal()
  }

  const removeVariable = (id) => setConfig(prev => ({ ...prev, variables: prev.variables.filter(v => v.id !== id) }))

  return (
    <>
      {modalState && (
        <VariableModal variable={modalState.variable} agentId={config.agentId} onSave={handleSave} onCancel={closeModal} />
      )}

      <section className="rounded-lg border border-outline-variant overflow-hidden" style={{ background: 'var(--color-surface-container)' }}>
        <div className="h-0.5 bg-gradient-to-r from-secondary/60 via-secondary/20 to-transparent" />

        <div className="px-6 py-4 border-b border-outline-variant flex items-center gap-3"
             style={{ background: 'var(--color-surface-container-high)' }}>
          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
               style={{ background: 'color-mix(in srgb, var(--color-secondary) 12%, transparent)' }}>
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>data_object</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface leading-none">Campos Personalizados</h3>
            <p className="text-[10px] font-mono text-on-surface-variant/50 mt-0.5">Dados coletados durante a conversa</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-[10px] text-on-surface-variant/50">
              {config.variables.length} campo{config.variables.length !== 1 ? 's' : ''}
            </span>
            <button onClick={openAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-all text-[11px] font-mono font-semibold">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              ADICIONAR
            </button>
          </div>
        </div>

        <div className="p-5">
          {config.variables.length === 0 && !pendingChanges?.add_variables?.length ? (
            <button onClick={openAdd}
              className="w-full py-8 border-2 border-dashed border-outline-variant/50 rounded-lg flex flex-col items-center gap-2 text-on-surface-variant/40 hover:border-primary/40 hover:text-primary/60 transition-all">
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>add_circle</span>
              <span className="label-caps text-[10px]">Nenhum campo — clique para adicionar</span>
            </button>
          ) : (
            <div className="space-y-2">
              {config.variables.map(v => {
                const fullKey = `${prefix}${v.name}`
                const charCount = fullKey.length
                const isOver = charCount > MAX_CHARS
                const isEnum = v.type === 'enum'
                const optionLines = isEnum ? (v.options || '').split('\n').filter(l => l.trim()) : []
                const isPendingRemoval = pendingChanges?.remove_variables?.includes(v.name)
                return (
                  <div key={v.id}
                    className={`group rounded-lg border overflow-hidden transition-all cursor-pointer ${
                      isPendingRemoval
                        ? 'border-dashed border-error/50 opacity-60'
                        : 'border-outline-variant hover:border-primary/40'
                    }`}
                    onClick={() => !isPendingRemoval && openEdit(v)}
                    style={{
                      background: isPendingRemoval
                        ? 'color-mix(in srgb, var(--color-error) 5%, var(--color-surface-container-high))'
                        : 'var(--color-surface-container-high)',
                    }}>

                    <div className="flex items-center px-4 py-2.5 gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPendingRemoval ? 'bg-error/60' : isEnum ? 'bg-secondary/60' : 'bg-primary/40'}`} />
                      <code className={`flex-1 font-mono text-sm font-semibold ${isOver ? 'text-error' : isPendingRemoval ? 'text-error/70 line-through' : 'text-on-surface'}`}>
                        {fullKey}
                      </code>
                      {isPendingRemoval && (
                        <span className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'color-mix(in srgb, var(--color-error) 15%, transparent)', color: 'var(--color-error)' }}>
                          REMOVER
                        </span>
                      )}
                      {isEnum && !isPendingRemoval && (
                        <span className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                          style={{ background: 'color-mix(in srgb, var(--color-secondary) 15%, transparent)', color: 'var(--color-secondary)' }}>
                          ENUM
                        </span>
                      )}
                      {!isPendingRemoval && (
                        <span className={`font-mono text-[10px] tabular-nums flex-shrink-0 ${isOver ? 'text-error' : 'text-on-surface-variant/35'}`}>
                          {charCount} / {MAX_CHARS}
                        </span>
                      )}
                      {!isPendingRemoval && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                          <button onClick={e => { e.stopPropagation(); openEdit(v) }}
                            className="p-1 text-on-surface-variant/60 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>edit</span>
                          </button>
                          <button onClick={e => { e.stopPropagation(); removeVariable(v.id) }}
                            className="p-1 text-on-surface-variant/60 hover:text-error transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isEnum && optionLines.length > 0 && !isPendingRemoval && (
                      <div className="px-4 pb-2.5 border-t border-outline-variant/30">
                        <div className="flex flex-wrap gap-1 mt-2">
                          {optionLines.slice(0, 4).map((opt, i) => (
                            <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)', color: 'var(--color-secondary)' }}>
                              {opt}
                            </span>
                          ))}
                          {optionLines.length > 4 && (
                            <span className="text-[10px] font-mono text-on-surface-variant/40 px-1.5 py-0.5">
                              +{optionLines.length - 4} mais
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {!isEnum && v.description && !isPendingRemoval && (
                      <div className="px-4 pb-2.5 border-t border-outline-variant/30">
                        <p className="text-[11px] font-mono text-on-surface-variant/50 leading-relaxed mt-2 line-clamp-2">
                          {v.description}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Variáveis propostas pela IA */}
              {pendingChanges?.add_variables?.length > 0 && (
                <>
                  <p className="label-caps text-[9px] text-secondary/60 pt-1">PROPOSTO PELA IA</p>
                  {pendingChanges.add_variables.map((v, i) => {
                    const fullKey = `${prefix}${v.name}`
                    const isEnum = v.type === 'enum'
                    const optionLines = isEnum ? (v.options || '').split('\n').filter(l => l.trim()) : []
                    return (
                      <div key={`proposed-${i}`}
                        className="rounded-lg border-2 border-dashed overflow-hidden"
                        style={{
                          borderColor: 'color-mix(in srgb, var(--color-secondary) 50%, transparent)',
                          background: 'color-mix(in srgb, var(--color-secondary) 5%, var(--color-surface-container-high))',
                        }}>
                        <div className="flex items-center px-4 py-2.5 gap-3">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-secondary/60" />
                          <code className="flex-1 font-mono text-sm font-semibold text-secondary">{fullKey}</code>
                          {isEnum && (
                            <span className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                              style={{ background: 'color-mix(in srgb, var(--color-secondary) 15%, transparent)', color: 'var(--color-secondary)' }}>
                              ENUM
                            </span>
                          )}
                          <span className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--color-secondary) 20%, transparent)', color: 'var(--color-secondary)' }}>
                            + NOVO
                          </span>
                        </div>
                        {isEnum && optionLines.length > 0 && (
                          <div className="px-4 pb-2.5 border-t border-outline-variant/30">
                            <div className="flex flex-wrap gap-1 mt-2">
                              {optionLines.slice(0, 4).map((opt, j) => (
                                <span key={j} className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                  style={{ background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)', color: 'var(--color-secondary)' }}>
                                  {opt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {!isEnum && v.description && (
                          <div className="px-4 pb-2.5 border-t border-outline-variant/30">
                            <p className="text-[11px] font-mono text-secondary/60 leading-relaxed mt-2 line-clamp-2">
                              {v.description}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}

              {!pendingChanges && (
                <button onClick={openAdd}
                  className="w-full mt-1 py-2.5 border border-dashed border-outline-variant/50 rounded-lg flex items-center justify-center gap-2 text-on-surface-variant/40 hover:border-primary/50 hover:text-primary/60 transition-all text-[11px] font-mono">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                  ADICIONAR CAMPO
                </button>
              )}
            </div>
          )}

          {prefix && (
            <p className="text-[10px] font-mono text-on-surface-variant/30 mt-3">
              Prefixo ativo: <code className="text-primary/60">{prefix}</code> — máx. {MAX_CHARS} chars por campo.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
