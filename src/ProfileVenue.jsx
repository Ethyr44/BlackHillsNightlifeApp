import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import VenueCard from './VenueCard'
import { toast } from './GlobalToast'

export default function ProfileVenue({ profile, isOwner, onViewEntity }) {
  const [events, setEvents] = useState([])
  const [weeklySchedule, setWeeklySchedule] = useState([])
  const [loading, setLoading] = useState(true)

  const venueData = {
    name: profile.name, address: profile.address, phone: profile.phone, email: profile.email,
    hours: profile.hours_of_operation, happyHour: profile.happy_hour_schedule,
    menu: profile.menu_url, website: profile.website, facebook: profile.facebook,
    ig: profile.ig, tiktok: profile.tiktok, styles: profile.tags || []
  }

  useEffect(() => {
    const fetchVenueEvents = async () => {
      setLoading(true)
      const { data } = await supabase.from('events').select('*').eq('venue', venueData.name).eq('status', 'approved')
      if (data) setEvents(data)
      setLoading(false)
    }
    if (venueData.name) fetchVenueEvents()
  }, [venueData.name])

  useEffect(() => {
    const today = new Date()
    const schedule = []
    const legacySchedule = profile.details?.schedule || []
    for (let i = 0; i < 7; i++) {
      const slotDate = new Date(today)
      slotDate.setDate(today.getDate() + i)
      const dayName = slotDate.toLocaleDateString('en-US', { weekday: 'short' })
      let matchedEvent = events.find(e => {
        if (e.recurring_weekly) return false
        const safe = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z'
        const eDate = new Date(safe)
        return eDate.getFullYear() === slotDate.getFullYear() && eDate.getMonth() === slotDate.getMonth() && eDate.getDate() === slotDate.getDate()
      })
      if (!matchedEvent) {
        matchedEvent = events.find(e => {
          if (!e.recurring_weekly) return false
          const safe = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z'
          return new Date(safe).getDay() === slotDate.getDay()
        })
      }
      if (!matchedEvent) {
        const leg = legacySchedule.find(s => s.day === dayName || s.day === slotDate.toLocaleDateString('en-US', { weekday: 'long' }))
        if (leg && leg.event) matchedEvent = leg.event
      }
      schedule.push({ day: dayName, date: slotDate, event: matchedEvent || null })
    }
    setWeeklySchedule(schedule)
  }, [events, profile])

  const upcomingEventsList = events.filter(e => {
    const safe = e.event_date.includes('Z') || e.event_date.includes('+') ? e.event_date : e.event_date + 'Z'
    const eDate = new Date(safe)
    const today = new Date(); today.setHours(0,0,0,0)
    return e.recurring_weekly || eDate >= today
  }).sort((a, b) => new Date(a.event_date) - new Date(b.event_date))

  const InfoRow = ({ icon, label, value, href }) => {
    if (!value) return null
    return (
      <div className="flex items-start gap-3 py-2 border-b border-white/[0.05] last:border-0">
        <span className="text-base mt-0.5 flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-0.5">{label}</p>
          {href
            ? <a href={href} target="_blank" rel="noreferrer" className="text-[#4f8cff] text-sm hover:text-[#22d4c8] transition-colors truncate block">{value}</a>
            : <p className="text-white text-sm truncate">{value}</p>
          }
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in space-y-4">
      {/* VenueCard */}
      <VenueCard
        venue={{ ...profile, schedule: weeklySchedule }}
        currentUser={null}
        onOpenVenue={onViewEntity}
        onOpenEvent={(slot) => { if (slot.event) toast.success(`${slot.event.title} — ${slot.event.event_type}`) }}
        onAdminEdit={() => {}}
      />

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Contact card */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <h3 className="text-xs font-bold text-[#4f8cff] uppercase tracking-widest mb-3">Contact</h3>
          <InfoRow icon="📍" label="Address" value={venueData.address} />
          <InfoRow icon="📞" label="Phone" value={venueData.phone} />
          <InfoRow icon="✉️" label="Email" value={venueData.email} />

          {/* Hours */}
          {venueData.hours && Object.keys(venueData.hours).length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2">Hours</p>
              <div className="space-y-1">
                {Object.entries(venueData.hours).map(([day, time]) => (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="text-white/50">{day}</span>
                    <span className="text-white/80">{time.isOpen === false ? 'Closed' : `${time.open || ''} – ${time.close || ''}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Happy Hour */}
          {venueData.happyHour && Object.keys(venueData.happyHour).length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/[0.05]">
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mb-2">Happy Hour</p>
              <div className="space-y-1">
                {Object.entries(venueData.happyHour).map(([day, time]) => (
                  <div key={day} className="flex justify-between text-xs">
                    <span className="text-white/50">{day}</span>
                    <span className="text-emerald-400/80">{time.isOpen === false ? 'None' : `${time.open || ''} – ${time.close || ''}`}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Links + tags */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <h3 className="text-xs font-bold text-[#4f8cff] uppercase tracking-widest mb-3">Online</h3>
            <div className="flex flex-wrap gap-2">
              {venueData.website && <a href={venueData.website} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20 hover:bg-[#4f8cff]/20 transition-all">Website</a>}
              {venueData.facebook && <a href={venueData.facebook} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20 hover:bg-[#4f8cff]/20 transition-all">Facebook</a>}
              {venueData.ig && <a href={venueData.ig} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20 transition-all">Instagram</a>}
              {venueData.tiktok && <a href={venueData.tiktok} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/[0.04] text-white/60 border border-white/[0.08] hover:bg-white/[0.07] transition-all">TikTok</a>}
              {!venueData.website && !venueData.facebook && !venueData.ig && !venueData.tiktok && (
                <span className="text-white/30 text-xs italic">No links provided</span>
              )}
            </div>
          </div>

          {venueData.styles && venueData.styles.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
              <h3 className="text-xs font-bold text-[#4f8cff] uppercase tracking-widest mb-3">Vibe</h3>
              <div className="flex flex-wrap gap-2">
                {venueData.styles.map(s => (
                  <span key={s} className="px-3 py-1 rounded-full text-[10px] font-bold bg-white/[0.04] text-white/60 border border-white/[0.07] uppercase tracking-widest">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming events */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-white">Upcoming Lineup</h3>
          {isOwner && <button className="text-[#4f8cff] text-[10px] font-bold uppercase tracking-widest hover:text-[#22d4c8] transition-colors">+ Add Event</button>}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-5 h-5 border-2 border-[#4f8cff] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : upcomingEventsList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
            <p className="text-white/30 text-xs font-medium uppercase tracking-widest">No upcoming events scheduled</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingEventsList.map(ev => (
              <div
                key={ev.id}
                onClick={() => onViewEntity && onViewEntity(ev.title)}
                className="bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.05] p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all"
              >
                <div>
                  <h4 className="text-white font-semibold text-sm">{ev.title}</h4>
                  <p className="text-[#4f8cff] text-[10px] font-bold uppercase tracking-widest mt-0.5">
                    {new Date(ev.event_date).toLocaleDateString()} · {ev.event_type}
                  </p>
                </div>
                <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
