import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function HostTracker({ session }) {
    const [hostEvents, setHostEvents] = useState([])
    const [reqTitle, setReqTitle] = useState('')
    const [reqVenue, setReqVenue] = useState('')
    const [reqDate, setReqDate] = useState('')

    useEffect(() => {
        fetchEvents()
    }, [session])

    const fetchEvents = async () => {
        const { data } = await supabase.from('events').select('*').eq('host_id', session.user.id).order('event_date', { ascending: false })
        if (data) setHostEvents(data)
    }

    const submitEventRequest = async () => {
        if (!reqTitle || !reqDate || !reqVenue) return alert("Fill all fields to request an event.")
        const { error } = await supabase.from('events').insert([{
            title: reqTitle, venue: reqVenue, event_date: reqDate, host_id: session.user.id, status: 'pending', event_type: 'Karaoke'
        }])
        if (!error) {
            alert("Event Request Submitted for Admin Approval!")
            setReqTitle(''); setReqVenue(''); setReqDate('');
            fetchEvents()
        }
    }

    return (
        <div className="bg-gray-900 border-2 border-orange-500/30 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 shadow-[0_0_20px_rgba(255,140,66,0.15)] mt-8">
            <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-6 text-orange-400" style={{ textShadow: `0 0 15px rgba(255,140,66,0.5)` }}>
                Event Tracker & Requests
            </h3>
            
            <div className="bg-black/50 p-4 rounded-2xl border border-gray-800 mb-6">
                <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-3">Request New Event</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <input type="text" value={reqTitle} onChange={e => setReqTitle(e.target.value)} placeholder="Event Title" className="bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-orange-500 outline-none" />
                    <input type="text" value={reqVenue} onChange={e => setReqVenue(e.target.value)} placeholder="Venue Name" className="bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-orange-500 outline-none" />
                    <input type="datetime-local" value={reqDate} onChange={e => setReqDate(e.target.value)} className="bg-black border border-gray-700 text-white rounded-lg p-2 text-xs focus:border-orange-500 outline-none" />
                </div>
                <button onClick={submitEventRequest} className="w-full bg-orange-600/20 text-orange-400 border border-orange-500/50 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-orange-600 hover:text-black transition-colors">
                    Submit for Approval
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
                        <span className={`text-[9px] px-2 py-1 rounded font-bold uppercase tracking-widest ${ev.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500 border border-yellow-500/30' : 'bg-green-900/30 text-green-400 border border-green-500/30'}`}>
                            {ev.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}