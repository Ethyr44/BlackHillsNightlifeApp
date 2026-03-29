import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function AdminEvents() {
  const [events, setEvents] = useState([])
  const [pages, setPages] = useState([]) 
  const [loading, setLoading] = useState(false)

  // Form State
  const [eventTitle, setEventTitle] = useState('')
  const [eventDesc, setEventDesc] = useState('')
  const [eventVenue, setEventVenue] = useState('')
  const [eventAddress, setEventAddress] = useState('') 
  const [eventAct, setEventAct] = useState('')
  const [eventType, setEventType] = useState('Karaoke')
  const [eventDate, setEventDate] = useState('')
  const [eventPoints, setEventPoints] = useState(500)
  const [editingEventId, setEditingEventId] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const { data: eData } = await supabase.from('events').select('*, profiles:host_id(username)').order('event_date', { ascending: true })
    if (eData) setEvents(eData)
    const { data: pData } = await supabase.from('pages').select('id, name, page_type, address') 
    if (pData) setPages(pData)
  }

  // Auto-fill address if they select an existing Venue!
  const handleVenueChange = (e) => {
      const selectedVenue = e.target.value
      setEventVenue(selectedVenue)
      const foundPage = pages.find(p => p.name === selectedVenue)
      if (foundPage && foundPage.address) {
          setEventAddress(foundPage.address)
      }
  }

  const saveEvent = async () => {
    if (!eventTitle || !eventDate) return alert('Title and Date are required')
    setLoading(true)
    
    // THE FIX: Grab the current logged-in user's ID
    const { data: { user } } = await supabase.auth.getUser()
    
    const payload = { 
        title: eventTitle, 
        description: eventDesc, 
        venue: eventVenue, 
        address: eventAddress, 
        entertainer: eventAct, 
        event_type: eventType, 
        event_date: eventDate, 
        points_awarded: parseInt(eventPoints) || 0, 
        status: 'approved',
        created_by: user.id, // Satisfies the database NOT NULL constraint
        host_id: user.id     // Attaches the Admin as the host so the UI displays it properly
    }
    
    let resultError;

    if (editingEventId) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEventId)
        resultError = error
    } else {
        const { error } = await supabase.from('events').insert([payload])
        resultError = error
    }
    
    if (resultError) {
        console.error("Database Rejection:", resultError)
        alert(`Failed to save event: ${resultError.message}`)
    } else {
        setEventTitle(''); setEventDesc(''); setEventVenue(''); setEventAddress(''); 
        setEventAct(''); setEventDate(''); setEventPoints(500); setEditingEventId(null); 
        fetchData(); 
    }
    
    setLoading(false);
  }

  const editEvent = (e) => {
    setEditingEventId(e.id); setEventTitle(e.title); setEventDesc(e.description); 
    setEventVenue(e.venue || ''); setEventAddress(e.address || ''); 
    setEventAct(e.entertainer || ''); setEventType(e.event_type); 
    setEventDate(e.event_date ? e.event_date.slice(0, 16) : ''); setEventPoints(e.points_awarded);
  }

  const toggleApproval = async (id, currentStatus) => {
      const newStatus = currentStatus === 'approved' ? 'pending' : 'approved'
      await supabase.from('events').update({ status: newStatus }).eq('id', id)
      fetchData()
  }

  const deleteEvent = async (id) => {
      if(window.confirm("Permanently delete this event?")) {
          await supabase.from('events').delete().eq('id', id)
          fetchData()
      }
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 mb-4 tracking-wider">{editingEventId ? 'Edit Event' : 'Create New Event'}</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <input type="text" placeholder="Event Title (e.g. Neon Nights Karaoke)" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <select value={eventType} onChange={e => setEventType(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
            <option value="Karaoke">Karaoke</option><option value="Live Music">Live Music</option><option value="Trivia">Trivia</option>
          </select>
          
          <select value={eventVenue} onChange={handleVenueChange} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
            <option value="">Select Existing Venue (Optional)...</option>
            {pages.filter(p => p.page_type === 'Venue').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          
          <input type="text" placeholder="Event Address / Location" value={eventAddress} onChange={e => setEventAddress(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          
          <select value={eventAct} onChange={e => setEventAct(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full">
            <option value="">Select Entertainer / Act (Optional)...</option>
            {pages.filter(p => p.page_type === 'Act').map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
          </select>
          <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
          <input type="number" placeholder="Points Awarded" value={eventPoints} onChange={e => setEventPoints(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full" />
        </div>
        
        <textarea placeholder="Event Description..." value={eventDesc} onChange={e => setEventDesc(e.target.value)} className="bg-black border border-gray-700 text-white rounded p-3 text-sm focus:border-blue-500 outline-none w-full mb-4 h-24"></textarea>

        {/* GOOGLE MAP PREVIEW */}
        {eventAddress && (
            <div className="mb-6">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Google Maps Preview</h4>
                <div className="relative w-full h-48 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
                    <iframe 
                        width="100%" height="100%" style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }} loading="lazy" allowFullScreen referrerPolicy="no-referrer-when-downgrade"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(eventAddress)}&t=m&z=15&output=embed&iwloc=near`}
                    ></iframe>
                </div>
            </div>
        )}
        
        <div className="flex gap-2">
          <button onClick={saveEvent} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded uppercase tracking-widest text-xs transition-colors shadow-lg">{editingEventId ? 'Update Event' : 'Save New Event'}</button>
          {editingEventId && <button onClick={() => {setEditingEventId(null); setEventTitle(''); setEventAddress('');}} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded uppercase tracking-widest text-xs transition-colors">Cancel</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <h3 className="text-xl font-['Bebas_Neue'] text-white tracking-wider border-b border-gray-800 pb-2">All Events & Requests</h3>
        {events.map(e => (
          <div key={e.id} className={`bg-gray-900 border p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-4 transition-colors ${e.status === 'pending' ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(250,204,21,0.1)]' : 'border-gray-800'}`}>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white text-lg">{e.title}</h4>
                {e.status === 'pending' && <span className="bg-yellow-900/30 text-yellow-500 border border-yellow-500/50 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest animate-pulse">Needs Approval</span>}
              </div>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">{new Date(e.event_date).toLocaleString()} • {e.address || e.venue || 'No Location'}</span>
            </div>
            <div className="flex gap-2">
                <button onClick={() => toggleApproval(e)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${e.status === 'pending' ? 'bg-green-600 hover:bg-green-500 text-white' : 'border border-gray-700 text-gray-400 hover:text-white'}`}>
                    {e.status === 'pending' ? 'Approve' : 'Un-Approve'}
                </button>
                <button onClick={() => editEvent(e)} className="text-gray-400 hover:text-white border border-gray-700 hover:border-blue-500 px-3 py-2 rounded-lg text-xs font-bold transition-all">✏️</button>
                <button onClick={() => deleteEvent(e.id)} className="text-gray-400 hover:text-white border border-gray-700 hover:border-red-500 hover:bg-red-900/20 px-3 py-2 rounded-lg text-xs font-bold transition-all">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}