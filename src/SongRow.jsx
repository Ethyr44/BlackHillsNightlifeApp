export default function SongRow({ title, artist, indexLabel, actions, isSuggestion = false, suggestedBy = '', onReject = null }) {
  return (
    <div className={`border-2 rounded-3xl p-4 shadow-lg transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden ${
        isSuggestion 
            ? 'bg-green-900/20 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:border-green-400' 
            : 'bg-[#090812] border-gray-800 hover:border-blue-500/50'
    }`}>
        
        {/* The Badge */}
        {isSuggestion && suggestedBy && (
            <div className="absolute top-0 right-0 bg-green-500 text-black text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                Suggested by {suggestedBy}
            </div>
        )}

        <div className={`flex items-center gap-4 w-full sm:w-auto overflow-hidden ${isSuggestion ? 'mt-2 sm:mt-0' : ''}`}>
            {/* Optional Number/Icon for Setlists */}
            {indexLabel && (
                <span className="font-['Bebas_Neue'] text-3xl text-blue-500 w-6 flex-shrink-0">
                    {indexLabel}
                </span>
            )}
            
            <div className="truncate">
                <h4 className="font-bold text-white text-lg leading-tight truncate">{title}</h4>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest truncate">{artist}</p>
            </div>
        </div>

        {/* Buttons injected from the parent file */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto z-10">
             {actions}
             {/* THE REJECT BUTTON */}
             {isSuggestion && onReject && (
                 <button 
                     onClick={onReject}
                     className="bg-white/10 text-white hover:bg-red-600 hover:text-white border border-white/20 px-3 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-colors ml-auto sm:ml-0"
                 >
                     Reject
                 </button>
             )}
        </div>

    </div>
  )
}