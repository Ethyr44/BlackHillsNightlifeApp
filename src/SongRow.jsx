export default function SongRow({ title, artist, indexLabel, actions }) {
  return (
    <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-4 shadow-lg hover:border-blue-500/50 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        <div className="flex items-center gap-4 w-full sm:w-auto overflow-hidden">
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
        <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
             {actions}
        </div>

    </div>
  )
}