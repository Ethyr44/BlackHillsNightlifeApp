import { EVENT_EMOJIS } from './VenueCard'

export default function MapVenueOverlay({ venue, distance, isProcessing, onCheckIn, onClose, onViewEntity }) {
    if (!venue) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#090812] border-2 border-blue-500/30 w-full max-w-md rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                {/* Header Image/Banner */}
                <div className="h-32 bg-gradient-to-br from-blue-600/20 to-purple-600/20 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 bg-black/40 text-white w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                    <div className="absolute -bottom-6 left-6 w-20 h-20 bg-[#0B0F19] rounded-2xl border-2 border-blue-500/30 flex items-center justify-center text-4xl shadow-xl">
                        🏠
                    </div>
                </div>

                <div className="p-6 pt-10">
                    <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest">{venue.name}</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">📍 {venue.address}</p>
                    
                    <div className="flex items-center gap-2 mb-6">
                        <span className="bg-blue-900/30 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                            {distance < 5280 ? `${Math.round(distance)} ft away` : `${(distance/5280).toFixed(1)} miles away`}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <button 
                            onClick={() => onViewEntity(venue.name)}
                            className="bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-gray-800 transition-all"
                        >
                            View Profile
                        </button>
                        <button 
                            onClick={onCheckIn}
                            disabled={isProcessing || distance > 100}
                            className={`py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all ${
                                distance <= 100 
                                ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:bg-blue-500' 
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {isProcessing ? 'Linking...' : distance <= 100 ? 'Check In (+22 L$)' : 'Too Far to Link'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}