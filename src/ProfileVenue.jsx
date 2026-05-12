import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ProfileVenue({ profile, isOwner, onViewEntity }) {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    
    // Fallback safely if details isn't populated
    const details = profile.details || {}

    useEffect(() => {
        if (details.name) fetchVenueEvents()
    }, [details.name])

    const fetchVenueEvents = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('events')
            .select('*')
            .eq('venue', details.name)
            .eq('status', 'approved')
            .gte('event_date', new Date().toISOString())
            .order('event_date', { ascending: true })
            
        if (data) setEvents(data)
        setLoading(false)
    }

    return (
        <div className="animate-fade-in space-y-6">
            
            {/* VENUE INFO CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#090812] border border-blue-900/30 p-6 rounded-3xl shadow-lg">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mb-4">Location & Contact</h3>
                    <p className="text-white text-sm mb-2">📍 {details.address || 'No address listed'}</p>
                    <p className="text-gray-400 text-sm mb-2">📞 {details.phone || 'No phone listed'}</p>
                    <p className="text-gray-400 text-sm">✉️ {details.email || 'No email listed'}</p>
                    
                    {isOwner && (
                        <button className="mt-4 w-full bg-gray-900 hover:bg-gray-800 text-gray-400 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors">
                            Edit Contact Info
                        </button>
                    )}
                </div>

                <div className="bg-[#090812] border border-blue-900/30 p-6 rounded-3xl shadow-lg">
                    <h3 className="text-blue-400 font-bold uppercase tracking-widest text-[10px] mb-4">Digital Presence</h3>
                    <div className="flex flex-wrap gap-2">
                        {details.web && <a href={details.web} target="_blank" rel="noreferrer" className="bg-blue-900/20 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold transition-colors hover:bg-blue-600 hover:text-white">Website</a>}
                        {details.fb && <a href={details.fb} target="_blank" rel="noreferrer" className="bg-blue-900/20 text-blue-400 px-4 py-2 rounded-xl text-xs font-bold transition-colors hover:bg-blue-600 hover:text-white">Facebook</a>}
                        {details.ig && <a href={details.ig} target="_blank" rel="noreferrer" className="bg-pink-900/20 text-pink-400 px-4 py-2 rounded-xl text-xs font-bold transition-colors hover:bg-pink-600 hover:text-white">Instagram</a>}
                        {details.tiktok && <a href={details.tiktok} target="_blank" rel="noreferrer" className="bg-gray-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors hover:bg-gray-700">TikTok</a>}
                    </div>
                </div>
            </div>

            {/* VENUE STYLES / TAGS */}
            {details.styles && details.styles.length > 0 && (
                <div className="bg-[#090812] border border-gray-800 p-6 rounded-3xl">
                    <h3 className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-4">Venue Vibe</h3>
                    <div className="flex flex-wrap gap-2">
                        {details.styles.map(style => (
                            <span key={style} className="bg-gray-900 border border-gray-700 text-gray-300 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                                {style}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* UPCOMING EVENTS */}
            <div>
                <div className="flex justify-between items-end border-b border-gray-800 pb-2 mb-4">
                    <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest">Upcoming Lineup</h3>
                    {isOwner && (
                        <button className="text-cyan-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
                            + Add Event
                        </button>
                    )}
                </div>

                {loading ? (
                    <p className="text-center text-gray-500 text-xs py-8 animate-pulse">Loading lineup...</p>
                ) : events.length === 0 ? (
                    <div className="bg-black/50 border border-dashed border-gray-800 p-8 rounded-3xl text-center">
                        <p className="text-gray-500 italic text-sm mb-2">No upcoming events scheduled.</p>
                        {isOwner && <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Add an event to appear on the main feed!</p>}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map(ev => (
                            <div key={ev.id} className="bg-[#090812] border border-gray-800 p-4 rounded-xl flex justify-between items-center hover:border-blue-500/50 transition-colors cursor-pointer" onClick={() => onViewEntity && onViewEntity(ev.title)}>
                                <div>
                                    <h4 className="text-white font-bold">{ev.title}</h4>
                                    <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mt-1">
                                        {new Date(ev.event_date).toLocaleDateString()} • {ev.event_type}
                                    </p>
                                </div>
                                <span className="text-gray-500">▶</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}