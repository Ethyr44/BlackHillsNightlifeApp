import React from 'react'

export const EVENT_EMOJIS = {
  'Karaoke': '🎤',
  'Live Music': '🎵',
  'Trivia': '❓',
  'Open Mic': '🎸',
  'Comedy': '😂',
  'Drinks': '🍻',
  'Poker': '♠️',
  'Specials': '💲',
  'Featured': '⭐',
  'Community': '👥',
  'Ticketed': '🎫',
  'General': '❗'
}

export default function VenueCard({ venue, schedule, currentUser, onOpenVenue, onOpenEvent, onAdminEdit }) {
  return (
    <div className="flex flex-col w-full h-[220px] rounded-[30px] overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.6)] flex-shrink-0 transition-transform hover:scale-[1.02] border border-blue-900/30 group">
      
      {/* Info Section */}
      <div className="relative flex-1 flex bg-[#0B0F19] overflow-hidden p-4 sm:p-6">
        
        {/* Background Ambient Glows (Forced blur value for perfect rendering) */}
        <div className="absolute top-[-50%] right-[-10%] w-[350px] h-[350px] bg-purple-600/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-purple-500/30 transition-colors"></div>
        <div className="absolute bottom-[-50%] left-[-10%] w-[250px] h-[250px] bg-cyan-600/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-cyan-500/30 transition-colors"></div>

        <div className="flex flex-col justify-center flex-1 relative z-10 w-1/3 min-w-[120px]">
          
          {/* Live Visitor Counter */}
          <div className="flex items-center gap-2 mb-2">
             <span className="bg-red-900/30 border border-red-500/50 text-red-400 px-2 py-0.5 rounded flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                {venue.visitor_count || 0} Live
             </span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-['Bebas_Neue'] text-white tracking-widest leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            {venue.name}
          </h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2 hidden sm:block">
            {venue.address || 'Rapid City, SD'}
          </p>
        </div>

        {/* Right Side (7-Days Schedule) */}
        <div className="relative z-10 flex items-center w-[65%] pl-4 pr-1 gap-2 overflow-x-auto hide-scrollbar flex-nowrap" style={{ WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}>
          {/* Safe Fallback Mapping */}
          {(schedule || []).map((slot, i) => (
            <button 
                key={i} 
                onClick={() => onOpenEvent(slot)}
                className="flex flex-col items-center justify-center gap-2 hover:bg-white/10 py-2 px-1 rounded-xl transition-all min-w-[40px] sm:min-w-[48px] flex-shrink-0"
            >
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{slot.day}</div>
              <div className="text-2xl sm:text-3xl flex items-center justify-center hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                {slot.event ? EVENT_EMOJIS[slot.event.event_type] || EVENT_EMOJIS['General'] : <span className="text-gray-700 text-xl opacity-50">➖</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="h-[50px] bg-[#05070A] border-t border-blue-900/40 text-white flex items-center justify-between px-4 sm:px-6 text-xs sm:text-sm font-bold uppercase tracking-widest">
        <button onClick={() => onOpenVenue(venue.name)} className="hover:text-cyan-400 truncate flex-1 text-left transition-colors">
            {venue.name}
        </button>
        
        <div className="flex items-center gap-4">
            {/* Distance rendering */}
            {venue.distance && (
                <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,245,255,0.5)]">
                    {venue.distance < 5280 ? `${Math.round(venue.distance)} ft` : `${(venue.distance/5280).toFixed(1)} m`}
                </span>
            )}
            
            {currentUser?.account_type === 'Admin' && (
                <button onClick={() => onAdminEdit((schedule || [])[0] || { date: new Date() })} className="text-gray-500 hover:text-white transition-colors">
                    ⚙️ Edit
                </button>
            )}
        </div>
      </div>
    </div>
  )
}