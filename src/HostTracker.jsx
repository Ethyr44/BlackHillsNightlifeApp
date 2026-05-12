import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function HostTracker({ session }) {
    const [hostEvents, setHostEvents] = useState([])
    const [venues, setVenues] = useState([])
    const [reqTitle, setReqTitle] = useState('')
    const [reqVenue, setReqVenue] = useState('')
    const [reqDate, setReqDate] = useState('')
    
    // 🟢 NEW: Feedback state for the Submit button
    const [statusMsg, setStatusMsg] = useState({ text: '', type: '' })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchEvents()
        fetchVenues()
    }, [session])

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*').eq('host_id', session.user.id).order('event_date', { ascending: false })
        if (data) setHostEvents(data)
    }

    // 🟢 NEW: Fetch official venues to populate the dropdown
    const fetchVenues = async () => {
        const { data } = await supabase.from('pages').select('name').eq('page_type', 'Venue').order('name', { ascending: true })
        if (data) setVenues(data)
    }

    const submitEventRequest = async () => {
        if (!reqTitle || !reqDate || !reqVenue) {
            setStatusMsg({ text: 'Please fill out all fields.', type: 'error' })
            return
        }
        
        setLoading(true)
        
        // 🟢 FIX: Properly format the date for PostgreSQL
        const formattedDate = new Date(reqDate).toISOString()

        const { error } = await supabase.from('events').insert([{
            title: reqTitle, 
            venue: reqVenue, 
            event_date: formattedDate, 
            host_id: session.user.id, 
            created_by: session.user.id, // 🟢 THE FIX
            status: 'pending', 
            event_type: 'Karaoke'
        }])
        
        if (!error) {
            setStatusMsg({ text: '✅ Event Submitted for Admin Approval!', type: 'success' })
            setReqTitle(''); setReqVenue(''); setReqDate('');
            fetchEvents()
            
            // Clear message after 4 seconds
            setTimeout(() => setStatusMsg({ text: '', type: '' }), 4000)
        } else {
            // 🟢 FIX: Spit out the EXACT error from Supabase so we know what failed
            setStatusMsg({ text: `Error: ${error.message}`, type: 'error' })
            console.error("Event Insert Error:", error)
        }
        setLoading(false)
    }

    return (
        <div id="host-tracker-section" className="bg-gray-900 border-2 border-orange-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-amber-500"></div>
            
            <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-4">Event Creator</h3>
            
            <div className="bg-black/40 p-4 rounded-2xl border border-orange-900/30 mb-6 space-y-3">
                <input 
                    type="text" 
                    placeholder="Event Title (e.g. Friday Night Karaoke)" 
                    value={reqTitle} 
                    onChange={e => setReqTitle(e.target.value)} 
                    className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none" 
                />
                
                {/* 🟢 NEW: Dropdown bound to the database pages */}
                <select 
                    value={reqVenue} 
                    onChange={e => setReqVenue(e.target.value)} 
                    className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none"
                >
                    <option value="" disabled>Select Official Venue</option>
                    {venues.map(v => (
                        <option key={v.name} value={v.name}>{v.name}</option>
                    ))}
                </select>

                <input 
                    type="datetime-local" 
                    value={reqDate} 
                    onChange={e => setReqDate(e.target.value)} 
                    className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none" 
                />
                
                <button 
                    onClick={submitEventRequest} 
                    disabled={loading}
                    className="w-full bg-orange-600/20 text-orange-400 border border-orange-500/50 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-600 hover:text-black transition-colors"
                >
                    {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
                
                {/* 🟢 NEW: Status Message Display */}
                {statusMsg.text && (
                    <p className={`text-center text-[10px] font-bold uppercase tracking-widest mt-2 ${statusMsg.type === 'success' ? 'text-green-400' : 'text-red-500'}`}>
                        {statusMsg.text}
                    </p>
                )}
            </div>

            <div className="space-y-3">
                <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">My Events</h4>
                {hostEvents.length === 0 && <p className="text-xs text-gray-500 italic">No events found.</p>}
                {hostEvents.map(ev => (
                    <div key={ev.id} className="bg-black/60 border border-gray-800 p-3 rounded-xl flex justify-between items-center">
                        <div>
                            <p className="text-white font-bold text-sm">{ev.title}</p>
                            <p className="text-gray-400 text-xs uppercase tracking-widest mt-0.5">{new Date(ev.event_date).toLocaleDateString()} @ {ev.venue}</p>
                        </div>
                        <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest ${ev.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500 border border-yellow-500/30' : 'bg-green-900/30 text-green-500 border border-green-500/30'}`}>
                            {ev.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}