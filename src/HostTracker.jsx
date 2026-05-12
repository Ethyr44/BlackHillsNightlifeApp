import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

export default function HostTracker({ session }) {
    const [hostEvents, setHostEvents] = useState([])
    const [venues, setVenues] = useState([])
    const [eventTypes, setEventTypes] = useState([]) // 🟢 NEW: Fetches official types
    
    const [reqTitle, setReqTitle] = useState('')
    const [reqVenue, setReqVenue] = useState('')
    const [reqEventType, setReqEventType] = useState('')
    const [reqDate, setReqDate] = useState('')
    const [reqEndDate, setReqEndDate] = useState('')
    
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchEvents()
        fetchVenues()
        fetchEventTypes()
    }, [session])

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*').eq('host_id', session.user.id).order('event_date', { ascending: false })
        if (data) setHostEvents(data)
    }

    const fetchVenues = async () => {
        const { data } = await supabase.from('pages').select('name').eq('page_type', 'Venue').order('name', { ascending: true })
        if (data) setVenues(data)
    }

    const fetchEventTypes = async () => {
        const { data } = await supabase.from('system_categories').select('name').eq('category_type', 'event')
        if (data) setEventTypes(data)
    }

    const submitEventRequest = async () => {
        if (!reqTitle || !reqDate || !reqEndDate || !reqVenue || !reqEventType) {
            toast.error('Please fill out all required fields.')
            return
        }
        
        if (new Date(reqEndDate) <= new Date(reqDate)) {
            toast.error('End Time must be after Start Time.')
            return
        }
        
        setLoading(true)
        
        const { error } = await supabase.from('events').insert([{
            title: reqTitle, 
            venue: reqVenue, 
            event_type: reqEventType,
            event_date: new Date(reqDate).toISOString(), 
            end_date: new Date(reqEndDate).toISOString(),
            host_id: session.user.id, 
            created_by: session.user.id,
            status: 'pending'
        }])
        
        if (!error) {
            toast.success('Event Submitted for Admin Approval!')
            setReqTitle(''); setReqVenue(''); setReqDate(''); setReqEndDate(''); setReqEventType('');
            fetchEvents()
        } else {
            toast.error(`Error: ${error.message}`)
            console.error("Event Insert Error:", error)
        }
        setLoading(false)
    }

    return (
        <div id="host-tracker-section" className="bg-gray-900 border-2 border-orange-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-amber-500"></div>
            
            <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-4">Event Creator</h3>
            
            <div className="bg-black/40 p-4 rounded-2xl border border-orange-900/30 mb-6 space-y-3">
                <input type="text" placeholder="Event Title (e.g. Friday Night Karaoke)" value={reqTitle} onChange={e => setReqTitle(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none" />
                
                <select value={reqVenue} onChange={e => setReqVenue(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none">
                    <option value="" disabled>Select Official Venue *</option>
                    {venues.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>

                <select value={reqEventType} onChange={e => setReqEventType(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none">
                    <option value="" disabled>Select Event Type *</option>
                    {eventTypes.map(type => <option key={type.name} value={type.name}>{type.name}</option>)}
                </select>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">Start Time *</label>
                        <input type="datetime-local" value={reqDate} onChange={e => setReqDate(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1">End Time *</label>
                        <input type="datetime-local" value={reqEndDate} onChange={e => setReqEndDate(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-orange-500 outline-none" />
                    </div>
                </div>
                
                <button onClick={submitEventRequest} disabled={loading} className="w-full bg-orange-600/20 text-orange-400 border border-orange-500/50 py-3 mt-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-600 hover:text-black transition-colors">
                    {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
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