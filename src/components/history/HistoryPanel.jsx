import { useState, useRef, useEffect } from 'react'

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function AgentCard({ agent, onLoad, onDelete, onRename }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(agent.agent_name || '')
  const [isSavingName, setIsSavingName] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [renaming])

  const handleCopy = () => {
    const text = agent.generated_prompt || ''
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const startRename = () => {
    setRenameValue(agent.agent_name || '')
    setRenaming(true)
  }

  const cancelRename = () => {
    setRenaming(false)
    setRenameValue(agent.agent_name || '')
  }

  const confirmRename = async () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === agent.agent_name) { cancelRename(); return }
    setIsSavingName(true)
    await onRename(agent.id, trimmed)
    setIsSavingName(false)
    setRenaming(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') confirmRename()
    if (e.key === 'Escape') cancelRename()
  }

  return (
    <div className="bg-surface-container border border-outline-variant rounded hover:border-primary/40 transition-colors group">
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 bg-primary/10 border border-primary/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-primary text-[18px]">smart_toy</span>
          </div>
          <div className="flex-1 min-w-0">
            {renaming ? (
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSavingName}
                  className="flex-1 min-w-0 text-sm font-semibold bg-surface border border-primary/50 rounded px-2 py-0.5 text-on-surface focus:outline-none focus:border-primary"
                />
                <button
                  onClick={confirmRename}
                  disabled={isSavingName}
                  className="p-1 rounded text-secondary hover:bg-secondary/10 transition-colors flex-shrink-0"
                  title="Confirmar">
                  <span className="material-symbols-outlined text-[16px]">
                    {isSavingName ? 'progress_activity' : 'check'}
                  </span>
                </button>
                <button
                  onClick={cancelRename}
                  disabled={isSavingName}
                  className="p-1 rounded text-on-surface-variant/60 hover:text-on-surface-variant transition-colors flex-shrink-0"
                  title="Cancelar">
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/name">
                <p className="font-semibold text-sm text-on-surface truncate">{agent.agent_name}</p>
                <button
                  onClick={startRename}
                  className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded text-on-surface-variant/40 hover:text-primary transition-all"
                  title="Renomear">
                  <span className="material-symbols-outlined text-[13px]">edit</span>
                </button>
              </div>
            )}
            <p className="text-[11px] font-mono text-on-surface-variant/60 mt-0.5 truncate">
              {agent.domain?.slice(0, 80) || 'Sem domínio definido'}...
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="label-caps text-[9px] text-on-surface-variant/40">{formatDate(agent.created_at)}</span>
              {agent.variables?.length > 0 && (
                <span className="label-caps text-[9px] text-primary/60">{agent.variables.length} VARS</span>
              )}
              {agent.exit_destinations?.length > 0 && (
                <span className="label-caps text-[9px] text-secondary/60">
                  {agent.exit_destinations.filter(e => !e.isSystem).length} SAÍDAS
                </span>
              )}
            </div>
          </div>
        </div>

        {!renaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 text-on-surface-variant hover:text-primary transition-colors"
              title="Visualizar prompt"
            >
              <span className="material-symbols-outlined text-[18px]">{expanded ? 'expand_less' : 'expand_more'}</span>
            </button>
            {agent.generated_prompt && (
              <button
                onClick={handleCopy}
                className="p-1.5 transition-colors"
                style={{ color: copied ? 'rgb(var(--color-secondary))' : undefined }}
                title={copied ? 'Copiado!' : 'Copiar prompt'}
              >
                <span className={`material-symbols-outlined text-[18px] ${copied ? '' : 'text-on-surface-variant hover:text-secondary'}`}>
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            )}
            <button
              onClick={() => onLoad(agent, 'editor')}
              className="px-2 py-1 rounded text-[10px] font-mono font-bold text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
              title="Abrir no Editor"
            >
              E1
            </button>
            <button
              onClick={() => onLoad(agent, 'editor-v2')}
              className="px-2 py-1 rounded text-[10px] font-mono font-bold text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-all"
              title="Abrir no Editor V2"
            >
              E2
            </button>
            <button
              onClick={() => onDelete(agent.id)}
              className="p-1.5 text-on-surface-variant hover:text-error transition-colors"
              title="Excluir"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        )}
      </div>

      {expanded && agent.generated_prompt && (
        <div className="border-t border-outline-variant bg-surface-container-low">
          <pre className="p-4 text-[11px] font-mono text-on-surface/60 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
            {agent.generated_prompt}
          </pre>
        </div>
      )}
    </div>
  )
}

export default function HistoryPanel({ agents, isLoading, onLoad, onDelete, onRename, onRefresh }) {
  const [search, setSearch] = useState('')

  const filtered = agents.filter(a =>
    a.agent_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.domain?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">Histórico</h2>
          <p className="text-[12px] font-mono text-on-surface-variant/50 mt-0.5">
            {agents.length} agente{agents.length !== 1 ? 's' : ''} salvos no Supabase
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="btn-ghost"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          ATUALIZAR
        </button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2 bg-surface-container border border-outline-variant rounded px-3 py-2 mb-4">
        <span className="material-symbols-outlined text-on-surface-variant text-[18px]">search</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou domínio..."
          className="flex-1 bg-transparent text-[13px] font-mono text-on-surface focus:outline-none placeholder:text-on-surface-variant/30"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-on-surface-variant/30">
            <div className="text-center">
              <span className="material-symbols-outlined text-[32px] animate-spin">sync</span>
              <p className="label-caps mt-2">CARREGANDO...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-on-surface-variant/30">
            <div className="text-center">
              <span className="material-symbols-outlined text-[48px]">inventory_2</span>
              <p className="label-caps mt-2">
                {agents.length === 0 ? 'NENHUM AGENTE SALVO' : 'NENHUM RESULTADO'}
              </p>
              {agents.length === 0 && (
                <p className="text-[11px] font-mono mt-1 max-w-xs">
                  Configure e faça o deploy de um agente para vê-lo aqui.
                </p>
              )}
            </div>
          </div>
        ) : (
          filtered.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onLoad={onLoad}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))
        )}
      </div>
    </div>
  )
}
