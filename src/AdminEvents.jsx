import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

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
  const [recurringPattern, setRecurringPattern] = useState('none')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: eData, error } = await supabase.from('events').select('*')
    
    if (error) console.error("Admin Events Fetch Error:", error)
    if (eData) {
        // 🟢 FIX: The sorting engine (Pending -> Upcoming Sooner -> Past Later)
        const sorted = eData.sort((a, b) => {
            const now = new Date()
            
            // Force safe date parsing
            const aSafe = a.event_date ? (a.event_date.includes('Z') || a.event_date.includes('+') ? a.event_date : a.event_date + 'Z') : null;
            const bSafe = b.event_date ? (b.event_date.includes('Z') || b.event_date.includes('+') ? b.event_date : b.event_date + 'Z') : null;
            
            const aDate = new Date(aSafe || 0)
            const bDate = new Date(bSafe || 0)
            
            // 1. Pending first
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;

            const aPast = aDate < now;
            const bPast = bDate < now;

            // 2. Upcoming vs Past
            if (!aPast && bPast) return -1;
            if (aPast && !bPast) return 1;

            // 3. Chronological sorting
            if (!aPast && !bPast) return aDate - bDate; // Upcoming: Sooner first
            return bDate - aDate; // Past: Most recent past event first
        })
        setEvents(sorted)
    }
    
    const { data: pData } = await supabase.from('pages').select('id, name, page_type, address') 
    if (pData) setPages(pData)
    setLoading(false)
  }

  const handleVenueSelect = (e) => {
      const selectedVenueName = e.target.value
      setEventVenue(selectedVenueName)
      const matchedPage = pages.find(p => p.name === selectedVenueName)
      if (matchedPage && matchedPage.address) {
          setEventAddress(matchedPage.address)
      }
  }

  const saveEvent = async () => {
    if (!eventTitle || !eventDate || !eventVenue) {
        toast.error("Title, Venue, and Start Date are required")
        return
    }
    setLoading(true)
    const payload = {
      title: eventTitle,
      description: eventDesc,
      venue: eventVenue,
      address: eventAddress,
      entertainer: eventAct,
      event_type: eventType,
      event_date: new Date(eventDate).toISOString(),
      points_awarded: eventPoints,
      recurring_pattern: recurringPattern,
      recurring_weekly: recurringPattern === 'weekly',
      status: 'approved' 
    }

    // 🟢 THE FIX: Check for DB rejections and surface them
    if (editingEventId) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingEventId)
      if (error) { toast.error("DB Error: " + error.message); setLoading(false); return; }
      toast.success("Event updated!")
    } else {
      const { error } = await supabase.from('events').insert([payload])
      if (error) { toast.error("DB Error: " + error.message); setLoading(false); return; }
      toast.success("Event created!")
    }

    resetForm()
    fetchData()
  }

  const editEvent = (e) => {
    setEditingEventId(e.id)
    setEventTitle(e.title || '')
    setEventDesc(e.description || '')
    setEventVenue(e.venue || '')
    setEventAddress(e.address || '')
    setEventAct(e.entertainer || '')
    setEventType(e.event_type || '')
    setRecurringPattern(e.recurring_pattern || (e.recurring_weekly ? 'weekly' : 'none'))
    
    // 🟢 FIX: Handle timezone safely for HTML datetime-local input
    const formatForInput = (dateStr) => {
        if (!dateStr) return ''
        const d = new Date(dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z')
        const offset = d.getTimezoneOffset() * 60000
        return (new Date(d - offset)).toISOString().slice(0, 16)
    }

    setEventDate(formatForInput(e.event_date))
    setEventPoints(e.points_awarded || 500)
    
    // 🟢 FIX: The "Dead Button" is fixed by smooth scrolling to the form!
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleApproval = async (id, currentStatus) => {
      const newStatus = currentStatus === 'pending' ? 'approved' : 'pending'
      const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', id)
      if (error) {
          toast.error(`Update Failed: ${error.message}`)
          return
      }
      toast.success(`Event marked as ${newStatus}`)
      fetchData()
  }

  const deleteEvent = async (id) => {
    if (!window.confirm("Delete this event completely?")) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) {
        toast.error(`Operation Failed: ${error.message}`)
        return
    }
    toast.success("Event deleted successfully")
    fetchData()
  }

  const resetForm = () => {
      setEditingEventId(null); setEventTitle(''); setEventDesc(''); setEventVenue(''); 
      setEventAddress(''); setEventAct(''); setEventType('Karaoke'); setEventDate(''); 
      setEventPoints(500); setRecurringPattern('none')
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl shadow-lg">
        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-4">{editingEventId ? 'Edit Event' : 'Create Event'}</h3>
        
        <div className="space-y-4">
          <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} placeholder="Event Title" className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <select value={eventVenue} onChange={handleVenueSelect} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500">
                  <option value="" disabled>Select Venue/Location</option>
                  {pages.filter(p => p.page_type === 'Venue').map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
              </select>
              <input type="text" value={eventAddress} onChange={e => setEventAddress(e.target.value)} placeholder="Physical Address (Auto-fills)" className="w-full bg-black border border-gray-700 text-gray-400 rounded-lg p-3 outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
              <input type="text" value={eventAct} onChange={e => setEventAct(e.target.value)} placeholder="Entertainer / Host Name" className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
              <input type="text" value={eventType} onChange={e => setEventType(e.target.value)} placeholder="Event Type (Karaoke, Trivia, etc)" className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
          </div>

          <div>
              <select value={recurringPattern} onChange={e => setRecurringPattern(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500">
                  <option value="none">Frequency: One-Time Event</option>
                  <option value="weekly">Frequency: Occurs Every Week</option>
                  <option value="biweekly">Frequency: Occurs Every Other Week</option>
                  <option value="monthly">Frequency: Occurs Once a Month</option>
              </select>
          </div>

          <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 block">Event Date & Start Time</label>
              <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500" />
          </div>

          <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder="Event Description..." className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 outline-none focus:border-blue-500 h-24" />

          <button onClick={saveEvent} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-bold py-4 rounded-xl uppercase tracking-widest text-xs transition-colors shadow-lg">
            {loading ? 'Saving...' : editingEventId ? 'Update Event' : 'Create Event'}
          </button>
          
          {editingEventId && (
              <button onClick={resetForm} className="w-full mt-2 bg-transparent border border-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl uppercase tracking-widest text-xs transition-colors">
                  Cancel Edit
              </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {events.map(e => (
          <div key={e.id} className={`bg-gray-900 border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors ${e.status === 'pending' ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-gray-800'}`}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-white text-lg">{e.title}</h4>
                  {e.status === 'pending' && <span className="bg-yellow-900/30 text-yellow-500 border border-yellow-500/50 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest animate-pulse">Needs Approval</span>}
                  {e.event_date && new Date(e.event_date.includes('Z') ? e.event_date : e.event_date + 'Z') < new Date() && <span className="bg-gray-800 text-gray-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest">Past Event</span>}
              </div>
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                  {e.event_date ? new Date(e.event_date.includes('Z') ? e.event_date : e.event_date + 'Z').toLocaleString() : 'Unknown Date'} • {e.venue}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <button onClick={() => toggleApproval(e.id, e.status)} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${e.status === 'pending' ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'border border-gray-700 text-gray-400 hover:text-white'}`}>
                    {e.status === 'pending' ? 'Approve' : 'Un-Approve'}
                </button>
                <button onClick={() => editEvent(e)} className="flex-1 sm:flex-none text-gray-400 hover:text-white border border-gray-700 hover:border-blue-500 px-3 py-2 rounded-lg text-xs font-bold transition-all">✏️ Edit</button>
                <button onClick={() => deleteEvent(e.id)} className="flex-1 sm:flex-none bg-red-900/20 text-red-500 border border-red-900/50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-red-500 hover:text-white transition-all">✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}