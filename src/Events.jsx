import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Events({ onViewEntity }) {
  const [events, setEvents] = useState([])
  const [venues, setVenues] = useState([]) // 🟢 NEW: Store venues for weekly schedules
  const [loading, setLoading] = useState(true)
  const [eventTypeFilter, setEventTypeFilter] = useState('All')
  
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDayEvents, setSelectedDayEvents] = useState(null)

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      
      // 1. Fetch One-Off Events
      const { data: eventData } = await supabase.from('events').select('*').eq('status', 'approved')
      if (eventData) setEvents(eventData)

      // 2. Fetch Venues (for their recurring weekly schedules)
      const { data: venueData } = await supabase.from('pages').select('*').eq('page_type', 'Venue')
      if (venueData) setVenues(venueData)

      setLoading(false)
    }
    fetchData()
  }, [])

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate()
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay()
  
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  // 🟢 HELPER: Get all events (specific + recurring) for a given JS Date object
  const getEventsForDate = (dateObj) => {
      const dateString = dateObj.toLocaleDateString() // 🟢 Fixed: Uses local timezone string
      const dayName = daysOfWeek[dateObj.getDay()]

      const specificEvents = events.filter(e => {
          if (e.recurring_pattern && e.recurring_pattern !== 'none') return false
          if (e.recurring_weekly) return false
          const safeDateStr = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z'
          const eDate = new Date(safeDateStr)
          
          // 🟢 Fixed: Strict local match prevents midnight UTC bleed-over
          return eDate.toLocaleDateString() === dateString
      })

      const recurringEvents = events.filter(e => {
          const pattern = e.recurring_pattern || (e.recurring_weekly ? 'weekly' : 'none')
          if (pattern === 'none') return false

          const safeDateStr = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z'
          const eDate = new Date(safeDateStr)
          
          if (eDate.getDay() !== dateObj.getDay()) return false
          
          const startDay = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate())
          const currentDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
          if (currentDay < startDay) return false

          if (pattern === 'weekly') return true
          if (pattern === 'biweekly') return Math.round((currentDay - startDay) / (1000 * 60 * 60 * 24 * 7)) % 2 === 0
          if (pattern === 'monthly') return Math.ceil(startDay.getDate() / 7) === Math.ceil(currentDay.getDate() / 7)
          
          return false
      }).map(e => ({ ...e, isRecurring: true }))

      // Combine and filter
      return [...specificEvents, ...recurringEvents].filter(e => eventTypeFilter === 'All' || e.event_type === eventTypeFilter)
  }

  const handleDayClick = (day) => {
      const targetDate = new Date(year, month, day)
      const dayEvents = getEventsForDate(targetDate)
      setSelectedDayEvents({ date: targetDate.toDateString(), events: dayEvents })
  }

  return (
    <div className="max-w-xl mx-auto p-4 mt-4 animate-fade-in pb-32">
      <div className="text-center mb-6">
        <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">EVENT CALENDAR</h2>
      </div>

      <div className="flex gap-2 bg-[#090812] p-1.5 rounded-xl border border-gray-800 shadow-inner mb-6 overflow-x-auto hide-scrollbar">
          {['All', 'Karaoke', 'Live Music', 'Comedy', 'Open Mic', 'Trivia', 'Drinks'].map(type => (
              <button 
                  key={type}
                  onClick={() => setEventTypeFilter(type)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${eventTypeFilter === type ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
              >
                  {type}
              </button>
          ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 p-4 rounded-t-2xl flex justify-between items-center">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="text-gray-400 hover:text-white px-4 py-2 font-bold transition-transform active:scale-95">❮</button>
          <h3 className="text-2xl font-bold text-white tracking-wide">{monthNames[month]} {year}</h3>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="text-gray-400 hover:text-white px-4 py-2 font-bold transition-transform active:scale-95">❯</button>
      </div>

      <div className="bg-black border border-t-0 border-gray-800 p-4 rounded-b-2xl shadow-xl">
          <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center text-[10px] font-bold uppercase text-gray-500">{d}</div>)}
          </div>
          
          <div className="grid grid-cols-7 gap-2">
              {[...Array(firstDay)].map((_, i) => <div key={`empty-${i}`} />)}
              
              {[...Array(daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const targetDate = new Date(year, month, day)
                  const isToday = new Date().toDateString() === targetDate.toDateString()
                  const dayHasEvents = getEventsForDate(targetDate).length > 0 // 🟢 Checks both one-off and recurring

                  return (
                      <button 
                          key={day}
                          onClick={() => handleDayClick(day)}
                          className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all active:scale-95 ${isToday ? 'bg-blue-900/30 border border-blue-500 text-blue-400' : 'bg-gray-900/50 text-gray-300 hover:bg-gray-800 border border-gray-800'}`}
                      >
                          <span className="font-bold text-sm">{day}</span>
                          {dayHasEvents && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.8)]"></span>}
                      </button>
                  )
              })}
          </div>
      </div>

      {selectedDayEvents && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in">
              <div className="bg-[#090812] w-full sm:max-w-md max-h-[80vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-gray-800 p-6 relative pb-12 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] hide-scrollbar">
                  <button onClick={() => setSelectedDayEvents(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white font-bold text-xl transition-colors">✕</button>
                  
                  <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-1">Daily Lineup</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6">{selectedDayEvents.date}</p>

                  <div className="space-y-4">
                      {selectedDayEvents.events.length === 0 ? (
                          <div className="text-center py-10 border border-dashed border-gray-800 rounded-2xl">
                              <span className="text-3xl opacity-50 block mb-2">🗓️</span>
                              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No events scheduled.</p>
                          </div>
                      ) : (
                          selectedDayEvents.events.map(event => (
                              <div key={event.id} className="bg-black border border-gray-800 p-4 rounded-2xl">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <h4 className="font-bold text-white text-lg leading-tight flex items-center gap-2">
                                              {event.title}
                                              {event.isRecurring && <span className="bg-purple-900/30 text-purple-400 text-[8px] px-1.5 py-0.5 rounded border border-purple-500/30">Weekly</span>}
                                          </h4>
                                          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">
                                              {event.isRecurring ? 'Weekly Event' : new Date(event.event_date.includes('Z') ? event.event_date : event.event_date + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {event.event_type}
                                          </p>
                                      </div>
                                  </div>
                                  <p className="text-gray-400 text-xs mb-4">{event.description}</p>
                                  <button onClick={() => { setSelectedDayEvents(null); onViewEntity(event.venue); }} className="w-full bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">
                                      📍 View {event.venue}
                                  </button>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  )
}