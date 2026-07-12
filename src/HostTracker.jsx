import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

export default function HostTracker({ session }) {
  const [hostEvents, setHostEvents] = useState([])
  const [venues, setVenues] = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [reqTitle, setReqTitle] = useState('')
  const [reqVenue, setReqVenue] = useState('')
  const [reqEventType, setReqEventType] = useState('')
  const [reqDate, setReqDate] = useState('')
  const [reqEndDate, setReqEndDate] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchEvents(); fetchVenues(); fetchEventTypes()
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
      title: reqTitle, venue: reqVenue, event_type: reqEventType,
      event_date: new Date(reqDate).toISOString(), end_date: new Date(reqEndDate).toISOString(),
      host_id: session.user.id, created_by: session.user.id, status: 'pending'
    }])
    if (!error) {
      toast.success('Event submitted for admin approval!')
      setReqTitle(''); setReqVenue(''); setReqDate(''); setReqEndDate(''); setReqEventType('')
      fetchEvents()
    } else {
      toast.error(`Error: ${error.message}`)
    }
    setLoading(false)
  }

  const STATUS_STYLES = {
    approved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  }

  return (
    <div id="host-tracker-section" className="rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.03]">
      {/* Accent top bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500" />

      <div className="p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
            📅
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Event Creator</h3>
            <p className="text-white/40 text-xs">Submit events for admin approval</p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-3 mb-5">
          <input
            type="text"
            placeholder="Event title (e.g. Friday Night Karaoke)"
            value={reqTitle}
            onChange={e => setReqTitle(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#4f8cff]/50 text-white rounded-xl p-3 text-sm focus:outline-none transition-colors placeholder:text-white/30"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={reqVenue}
              onChange={e => setReqVenue(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] focus:border-[#4f8cff]/50 text-white rounded-xl p-3 text-sm focus:outline-none transition-colors"
            >
              <option value="" disabled className="bg-[#070d1a]">Select venue *</option>
              {venues.map(v => <option key={v.name} value={v.name} className="bg-[#070d1a]">{v.name}</option>)}
            </select>

            <select
              value={reqEventType}
              onChange={e => setReqEventType(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] focus:border-[#4f8cff]/50 text-white rounded-xl p-3 text-sm focus:outline-none transition-colors"
            >
              <option value="" disabled className="bg-[#070d1a]">Event type *</option>
              {eventTypes.map(t => <option key={t.name} value={t.name} className="bg-[#070d1a]">{t.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-1.5">Start *</label>
              <input
                type="datetime-local"
                value={reqDate}
                onChange={e => setReqDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#4f8cff]/50 text-white rounded-xl p-3 text-sm focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-white/40 font-bold uppercase tracking-widest block mb-1.5">End *</label>
              <input
                type="datetime-local"
                value={reqEndDate}
                onChange={e => setReqEndDate(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-[#4f8cff]/50 text-white rounded-xl p-3 text-sm focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            onClick={submitEventRequest}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {loading ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </div>

        {/* My Events */}
        <div className="border-t border-white/[0.06] pt-4">
          <h4 className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-3">My Events</h4>
          {hostEvents.length === 0 ? (
            <p className="text-white/30 text-xs italic">No events submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {hostEvents.map(ev => (
                <div key={ev.id} className="flex items-center justify-between bg-white/[0.03] border border-white/[0.06] p-3 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{ev.title}</p>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">
                      {new Date(ev.event_date).toLocaleDateString()} · {ev.venue}
                    </p>
                  </div>
                  <span className={`text-[9px] px-2 py-1 rounded-full font-bold uppercase tracking-widest ml-3 flex-shrink-0 ${STATUS_STYLES[ev.status] || STATUS_STYLES.pending}`}>
                    {ev.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
