import { EVENT_EMOJIS } from './VenueCard'
import { parseEventBlackHillsDate, getEventCategory } from './utils'

export default function MapVenueOverlay({ venue, distance, isProcessing, onCheckIn, onClose, onViewEntity }) {
    if (!venue) return null;

    const eventsToday = venue.eventsToday?.length
        ? venue.eventsToday
        : venue.eventToday
        ? [venue.eventToday]
        : [];
    const hasEventToday = eventsToday.length > 0;

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        >
            <div
                onClick={e => e.stopPropagation()}
                className={`bg-[#090812] border-2 w-full max-w-md rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] ${
                    hasEventToday
                        ? 'border-[#ff2d78]/60 shadow-[0_0_35px_rgba(255,45,120,0.35)]'
                        : 'border-blue-500/30'
                }`}
            >
                {/* Header Image/Banner */}
                <div
                    className={`h-28 relative ${
                        hasEventToday
                            ? 'bg-gradient-to-br from-[#ff2d78]/30 via-purple-600/25 to-blue-600/20'
                            : 'bg-gradient-to-br from-blue-600/20 to-purple-600/20'
                    }`}
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-black/40 hover:bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                    >
                        ✕
                    </button>
                    {hasEventToday && (
                        <div className="absolute top-4 left-4 bg-[#ff2d78] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-[0_0_15px_rgba(255,45,120,0.8)] animate-pulse">
                            🔥 Event Today
                        </div>
                    )}
                    <div
                        className={`absolute -bottom-6 left-6 w-20 h-20 bg-[#0B0F19] rounded-2xl border-2 flex items-center justify-center text-4xl shadow-xl overflow-hidden ${
                            hasEventToday ? 'border-[#ff2d78]/60' : 'border-blue-500/30'
                        }`}
                    >
                        {venue.profile_pic ? (
                            <img src={venue.profile_pic} alt={venue.name} className="w-full h-full object-cover" />
                        ) : (
                            '🏠'
                        )}
                    </div>
                </div>

                <div className="p-6 pt-10 space-y-4">
                    <div>
                        <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest leading-none">
                            {venue.name}
                        </h3>
                        {venue.address && (
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                                📍 {venue.address}
                            </p>
                        )}
                    </div>

                    {distance !== null && distance !== undefined && (
                        <div className="flex items-center gap-2">
                            <span className="bg-blue-900/30 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                {distance < 5280
                                    ? `${Math.round(distance)} ft away`
                                    : `${(distance / 5280).toFixed(1)} miles away`}
                            </span>
                        </div>
                    )}

                    {/* Happening Today Section */}
                    {hasEventToday && (
                        <div className="rounded-2xl bg-[#ff2d78]/10 border border-[#ff2d78]/35 p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-[#ff2d78]">
                                    ✨ Happening Today
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">
                                    {eventsToday.length} {eventsToday.length === 1 ? 'Event' : 'Events'}
                                </span>
                            </div>

                            <div className="space-y-2 max-h-40 overflow-y-auto hide-scrollbar">
                                {eventsToday.map((ev, idx) => {
                                    const cat = ev.category || getEventCategory(ev)
                                    const timeStr = ev.event_date
                                        ? parseEventBlackHillsDate(ev.event_date).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                          })
                                        : null

                                    return (
                                        <div
                                            key={ev.id || idx}
                                            className="bg-black/60 border border-white/10 rounded-xl p-2.5 flex items-start gap-2.5"
                                        >
                                            <span className="text-xl leading-none mt-0.5">
                                                {EVENT_EMOJIS[ev.event_type] || '🗓️'}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="text-xs font-bold text-white truncate">
                                                        {ev.title}
                                                    </h4>
                                                    <span
                                                        className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                                                            cat === 'Recurring'
                                                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                                                : cat === 'Special'
                                                                ? 'bg-pink-500/20 text-pink-300 border-pink-500/30'
                                                                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                                        }`}
                                                    >
                                                        {cat}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-white/60 font-semibold mt-0.5">
                                                    {ev.event_type}
                                                    {timeStr ? ` • ${timeStr}` : ''}
                                                    {ev.entertainer ? ` • 🎤 ${ev.entertainer}` : ''}
                                                </p>
                                                {ev.description && (
                                                    <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                                                        {ev.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                            onClick={() => {
                                onClose()
                                if (onViewEntity) onViewEntity(venue.name)
                            }}
                            className="bg-gray-900 hover:bg-gray-800 text-white py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] border border-gray-800 transition-all"
                        >
                            View Profile
                        </button>
                        <button
                            onClick={onCheckIn}
                            disabled={isProcessing || (distance !== null && distance > 100)}
                            className={`py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all ${
                                distance !== null && distance <= 100
                                    ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:bg-blue-500'
                                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {isProcessing ? 'Linking...' : distance !== null && distance <= 100 ? 'Check In (+22 L$)' : 'Too Far to Link'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
