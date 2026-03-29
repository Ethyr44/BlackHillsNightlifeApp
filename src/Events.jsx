import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Events({ onViewEntity }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('upcoming') // 'upcoming' or 'archived'

  useEffect(() => {
    async function fetchEvents() {
      setLoading(true)
      const now = new Date().toISOString()
      
      // THE FIX: Appended .eq('status', 'approved') to strictly filter out pending requests!
      let query = supabase.from('events').select('*').eq('status', 'approved')
      
      // Filter based on the toggle
      if (viewMode === 'upcoming') {
        query = query.gte('event_date', now).order('event_date', { ascending: true })
      } else {
        query = query.lt('event_date', now).order('event_date', { ascending: false }) // Newest past events first
      }
      
      const { data, error } = await query
      if (!error && data) setEvents(data)
      setLoading(false)
    }
    fetchEvents()
  }, [viewMode])

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 animate-fade-in pb-12">
      
      <div className="text-center mb-6">
        <h2 className="text-5xl font-['Bebas_Neue'] text-blue-400 tracking-wider drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]">
            {viewMode === 'upcoming' ? 'The Circuit' : 'The Archive'}
        </h2>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-xs mt-2">
            {viewMode === 'upcoming' ? 'Upcoming Black Hills Events' : 'Past Events & Memories'}
        </p>
      </div>

      {/* --- Archive Toggle Buttons --- */}
      <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-8">
        <button 
          onClick={() => setViewMode('upcoming')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'upcoming' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Upcoming
        </button>
        <button 
          onClick={() => setViewMode('archived')}
          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${viewMode === 'archived' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30' : 'text-gray-500 hover:text-gray-300'}`}
        >
          Archived
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8 mt-10">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {events.length === 0 ? (
            <div className="text-center p-8 bg-gray-900 border border-gray-800 rounded-xl">
              <p className="text-gray-500 font-bold tracking-widest uppercase text-sm">
                  {viewMode === 'upcoming' ? 'No upcoming events on the radar.' : 'No archived events found.'}
              </p>
            </div>
          ) : (
            events.map(event => {
              const dateObj = new Date(event.event_date)
              const month = dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
              const day = dateObj.getDate()
              const time = dateObj.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

              return (
                <div key={event.id} className={`bg-gray-900 border rounded-xl overflow-hidden shadow-lg transition-colors group ${viewMode === 'archived' ? 'border-gray-800 opacity-80 grayscale-[30%]' : 'border-gray-800 hover:border-blue-500/50'}`}>
                  <div className="bg-black p-4 flex gap-4 items-center border-b border-gray-800">
                    <div className="bg-gray-800 rounded-lg p-2 text-center min-w-[60px] border border-gray-700">
                      <span className="block text-blue-400 text-[10px] font-bold uppercase tracking-widest">{month}</span>
                      <span className="block text-white font-['Bebas_Neue'] text-2xl leading-none mt-1">{day}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white leading-tight">{event.title}</h3>
                      <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                        {time} • {event.event_type}
                      </p>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-gray-300 text-sm mb-4 leading-relaxed">{event.description}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button onClick={() => onViewEntity(event.venue)} className="bg-blue-900/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-colors">
                        📍 {event.venue}
                      </button>
                      {event.entertainer && (
                        <button onClick={() => onViewEntity(event.entertainer)} className="bg-purple-900/20 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-widest hover:bg-purple-600 hover:text-white transition-colors">
                          🎤 {event.entertainer}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}