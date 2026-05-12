import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ProfileHost({ profile, isOwner, onViewEntity }) {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)

    // 🟢 NEW: Edit Mode State
    const [isEditing, setIsEditing] = useState(false)
    const [editData, setEditData] = useState({ stageName: '', city: '', agency: '' })
    
    // Parse the details payload
    const [details, setDetails] = useState(profile.details || {})

    useEffect(() => {
        if (profile.id) fetchHostEvents()
        setEditData({
            stageName: details.stageName || profile.username,
            city: details.city || '',
            agency: details.agency || ''
        })
    }, [profile.id, details])

    const fetchHostEvents = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('events')
            .select('*')
            .eq('host_id', profile.id)
            .eq('status', 'approved')
            .gte('event_date', new Date().toISOString())
            .order('event_date', { ascending: true })

        if (data) setEvents(data)
        setLoading(false)
    }

    // 🟢 NEW: Save Edits to the Database
    const handleSaveEdits = async () => {
        const updatedDetails = { ...details, ...editData }
        const { error } = await supabase.from('profiles').update({ details: updatedDetails }).eq('id', profile.id)
        if (!error) {
            setDetails(updatedDetails)
            setIsEditing(false)
        } else {
            alert("Error saving details: " + error.message)
        }
    }

    return (
        <div className="animate-fade-in space-y-6">
            
            {/* HOST INFO */}
            <div className="bg-[#090812] border border-[#00f5ff]/30 p-6 rounded-3xl shadow-[0_0_15px_rgba(0,245,255,0.1)] transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-[#00f5ff] font-bold uppercase tracking-widest text-[10px] mb-1">Host Profile</h3>
                        {isEditing ? (
                            <input 
                                type="text" 
                                value={editData.stageName} 
                                onChange={e => setEditData({...editData, stageName: e.target.value})}
                                className="bg-black border border-[#00f5ff]/50 text-white rounded p-1 text-2xl font-bold w-full outline-none"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-white leading-tight">{details.stageName || profile.username}</h2>
                        )}
                    </div>
                    
                    {/* 🟢 NEW: Edit/Save Toggle */}
                    {isOwner && (
                        <button 
                            onClick={isEditing ? handleSaveEdits : () => setIsEditing(true)} 
                            className={`${isEditing ? 'bg-[#00f5ff] text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'} px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors`}
                        >
                            {isEditing ? 'Save' : 'Edit'}
                        </button>
                    )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-800">
                    <div>
                        <span className="text-gray-500 text-[9px] uppercase tracking-widest font-bold block mb-1">Base City</span>
                        {isEditing ? (
                            <input type="text" value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} className="bg-black border border-[#00f5ff]/50 text-white rounded p-1 text-sm w-full outline-none" />
                        ) : (
                            <span className="text-gray-300 text-sm">{details.city || 'Unknown'}</span>
                        )}
                    </div>
                    <div>
                        <span className="text-gray-500 text-[9px] uppercase tracking-widest font-bold block mb-1">Agency</span>
                        {isEditing ? (
                            <input type="text" value={editData.agency} onChange={e => setEditData({...editData, agency: e.target.value})} className="bg-black border border-[#00f5ff]/50 text-white rounded p-1 text-sm w-full outline-none" />
                        ) : (
                            <span className="text-gray-300 text-sm">{details.agency || 'Independent'}</span>
                        )}
                    </div>
                </div>

                {details.events && details.events.length > 0 && !isEditing && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                        <span className="text-gray-500 text-[9px] uppercase tracking-widest font-bold block mb-2">Specialties</span>
                        <div className="flex flex-wrap gap-2">
                            {details.events.map(ev => (
                                <span key={ev} className="bg-[#00f5ff]/10 border border-[#00f5ff]/30 text-[#00f5ff] px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest">
                                    {ev}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* HOST'S UPCOMING EVENTS */}
            <div>
                <div className="flex justify-between items-end border-b border-gray-800 pb-2 mb-4">
                    <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest">Events</h3>
                    {isOwner && (
                        <div className="flex gap-3">
                            {/* 🟢 NEW: Links to the Live/KSocial tab */}
                            <button onClick={() => window.location.search = '?tab=Live'} className="text-purple-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
                                KSocial Sessions
                            </button>
                            {/* 🟢 NEW: Smooth scrolls down to the HostTracker module */}
                            <button onClick={() => document.getElementById('host-tracker-section')?.scrollIntoView({ behavior: 'smooth' })} className="text-cyan-400 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
                                Manage
                            </button>
                        </div>
                    )}
                </div>

                {loading ? (
                    <p className="text-center text-gray-500 text-xs py-8 animate-pulse">Loading stages...</p>
                ) : events.length === 0 ? (
                    <div className="bg-black/50 border border-dashed border-gray-800 p-8 rounded-3xl text-center">
                        <p className="text-gray-500 italic text-sm mb-2">No Upcoming Events.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {events.map(ev => (
                            <div key={ev.id} className="bg-black border border-gray-800 p-4 rounded-xl flex justify-between items-center hover:border-[#00f5ff]/50 transition-colors cursor-pointer" onClick={() => onViewEntity && onViewEntity(ev.title)}>
                                <div>
                                    <h4 className="text-white font-bold">{ev.title}</h4>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">
                                        {new Date(ev.event_date).toLocaleDateString()} @ <span className="text-cyan-400">{ev.venue}</span>
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