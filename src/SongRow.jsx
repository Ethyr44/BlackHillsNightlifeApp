export default function SongRow({ title, artist, indexLabel, actions, isSuggestion = false, suggestedBy = '', onReject = null }) {
  return (
    <div className={`relative rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 overflow-hidden transition-all duration-200 ${
      isSuggestion
        ? 'bg-emerald-500/5 border border-emerald-500/30 hover:border-emerald-400/50 shadow-[0_0_16px_rgba(34,197,94,0.08)]'
        : 'bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.05]'
    }`}>

      {/* Suggestion accent line */}
      {isSuggestion && (
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-t-2xl" />
      )}

      {/* Suggestion badge */}
      {isSuggestion && suggestedBy && (
        <div className="absolute top-2.5 right-3 bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-500/30">
          Suggested by {suggestedBy}
        </div>
      )}

      {/* Song info */}
      <div className={`flex items-center gap-3 w-full sm:w-auto overflow-hidden min-w-0 ${isSuggestion ? 'mt-1 sm:mt-0' : ''}`}>
        {indexLabel && (
          <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-sm font-bold text-[var(--blue)]">
            {indexLabel}
          </div>
        )}
        <div className="truncate min-w-0">
          <h4 className="font-semibold text-white text-sm leading-tight truncate">{title}</h4>
          <p className="text-white/40 text-xs font-medium uppercase tracking-widest truncate mt-0.5">{artist}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto z-10 flex-shrink-0">
        {actions}
        {isSuggestion && onReject && (
          <button
            onClick={onReject}
            className="bg-white/[0.04] text-white/50 hover:bg-red-500/20 hover:text-red-400 border border-white/[0.08] hover:border-red-500/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ml-auto sm:ml-0"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  )
}
