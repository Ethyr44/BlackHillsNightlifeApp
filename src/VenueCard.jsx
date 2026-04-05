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

export default function VenueCard({ venue, currentUser, onOpenVenue, onOpenEvent, onAdminEdit }) {
  return (
    <div className="flex flex-col w-full h-[220px] rounded-[30px] overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.6)] flex-shrink-0 transition-transform hover:scale-[1.02] border border-blue-900/30 group">
      
      {/* Info Section */}
      <div className="relative flex-1 flex bg-[#0B0F19] overflow-hidden p-6">
        
        {/* Background Ambient Glows */}
        <div className="absolute top-[-50%] right-[-10%] w-[350px] h-[350px] bg-purple-600/20 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-500/30 transition-colors duration-700"></div>
        <div className="absolute bottom-[-30%] right-[20%] w-[200px] h-[200px] bg-blue-600/20 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/30 transition-colors duration-700"></div>
        <div className="absolute top-[20%] right-[50%] w-[100px] h-[100px] bg-cyan-500/10 rounded-full blur-xl pointer-events-none"></div>

        {/* Left Side (Status & Users) */}
        <div className="relative z-10 flex flex-col justify-between w-[35%] border-r border-white/5 pr-4">
          <div className="flex items-center gap-2 text-white text-xs font-bold uppercase tracking-widest">
            {venue.isLive ? (
               <><span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse"></span> <span className="text-cyan-100 drop-shadow-[0_0_5px_#22d3ee]">LIVE</span></>
            ) : (
               <><span className="w-2.5 h-2.5 rounded-full bg-gray-600"></span> <span className="text-gray-500">OFFLINE</span></>
            )}
          </div>
          <div>
            <div className="text-6xl font-bold text-white mb-[-8px] font-['Bebas_Neue'] tracking-widest drop-shadow-lg">{venue.userCount}</div>
            <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">BHNL Visits</div>
          </div>
        </div>

        {/* Right Side (7-Days Schedule) */}
        <div className="relative z-10 flex justify-between items-center w-[65%] pl-4 pr-1 gap-1">
          {venue.schedule.map((slot, i) => (
            <button 
                key={i} 
                onClick={() => onOpenEvent(slot, venue)}
                className="flex flex-col items-center justify-center gap-2 hover:bg-white/10 py-2 px-1 rounded-xl transition-all flex-1"
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
      <div className="h-[50px] bg-[#05070A] border-t border-blue-900/40 text-white flex items-center justify-between px-6 text-sm font-bold uppercase tracking-widest">
        <button onClick={() => onOpenVenue(venue)} className="hover:text-cyan-400 truncate flex-1 text-left transition-colors">
            {venue.name}
        </button>
        
        <div className="flex items-center gap-4">
            <span className="text-gray-500 text-xs">{venue.currentTime}</span>
            {currentUser?.account_type === 'Admin' && (
                <button onClick={() => onAdminEdit(venue)} className="text-gray-500 hover:text-white text-xl leading-none pb-1 transition-colors">⋮</button>
            )}
        </div>
      </div>

    </div>
  )
}