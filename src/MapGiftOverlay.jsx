export default function MapGiftOverlay({ gift, distance, isProcessing, onClaim, onClose }) {
    if (!gift) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#090812] border-2 border-pink-500/30 w-full max-w-md rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(219,39,119,0.3)]">
                
                {/* Header Image/Banner */}
                <div className="h-32 bg-gradient-to-br from-pink-600/20 to-purple-600/20 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 bg-black/40 text-white w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                    <div className="absolute -bottom-6 left-6 w-20 h-20 bg-[#0B0F19] rounded-2xl border-2 border-pink-500/50 flex items-center justify-center text-4xl shadow-[0_0_20px_rgba(219,39,119,0.4)]">
                        💎
                    </div>
                </div>

                <div className="p-6 pt-10">
                    <h3 className="text-3xl font-['Bebas_Neue'] text-pink-400 tracking-widest mb-1">GeoGift Discovered</h3>
                    <p className="text-white font-bold text-lg mb-4">
                        {gift.gem_qty}x {gift.gem_type}
                    </p>
                    
                    <div className="flex items-center gap-2 mb-6">
                        <span className="bg-pink-900/30 text-pink-400 border border-pink-500/30 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                            {distance < 5280 ? `${Math.round(distance)} ft away` : `${(distance/5280).toFixed(1)} miles away`}
                        </span>
                    </div>

                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6 font-bold">
                        You must be within 150 feet to claim this drop.
                    </p>

                    <button 
                        onClick={onClaim}
                        disabled={isProcessing || distance > 150}
                        className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all ${
                            distance <= 150 
                            ? 'bg-pink-600 text-white shadow-[0_0_20px_rgba(219,39,119,0.4)] hover:bg-pink-500' 
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {isProcessing ? 'Claiming...' : distance <= 150 ? 'Claim GeoGift' : 'Too Far to Claim'}
                    </button>
                </div>
            </div>
        </div>
    )
}