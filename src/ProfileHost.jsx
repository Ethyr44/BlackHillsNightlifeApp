import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function ProfileHost({ profile, isOwner, onViewEntity }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({ stageName: '', city: '', agency: '' })
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
    const { data } = await supabase.from('events').select('*').eq('host_id', profile.id).eq('status', 'approved').gte('event_date', new Date().toISOString()).order('event_date', { ascending: true })
    if (data) setEvents(data)
    setLoading(false)
  }

  const handleSaveEdits = async () => {
    const updatedDetails = { ...details, ...editData }
    const { error } = await supabase.from('profiles').update({ details: updatedDetails }).eq('id', profile.id)
    if (!error) { setDetails(updatedDetails); setIsEditing(false) }
    else alert('Error saving details: ' + error.message)
  }

  const Field = ({ label, value, editing, editKey }) => (
    <div>
      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1">{label}</p>
      {editing ? (
        <input
          type="text"
          value={editData[editKey]}
          onChange={e => setEditData({ ...editData, [editKey]: e.target.value })}
          className="w-full bg-white/[0.04] border border-[#22d4c8]/30 text-white rounded-xl p-2 text-sm focus:outline-none focus:border-[#22d4c8]/60 transition-colors"
        />
      ) : (
        <p className="text-white text-sm">{value || <span className="text-white/30 italic">Not set</span>}</p>
      )}
    </div>
  )

  return (
    <div className="animate-fade-in space-y-4">
      {/* Host info card */}
      <div className="relative rounded-2xl border border-[#22d4c8]/20 bg-[#22d4c8]/5 p-5 overflow-hidden">
        <div className="h-0.5 w-full absolute top-0 left-0 bg-gradient-to-r from-[#22d4c8] to-[#4f8cff]" />

        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] text-[#22d4c8] font-bold uppercase tracking-widest mb-1">Host Profile</p>
            {isEditing ? (
              <input
                type="text"
                value={editData.stageName}
                onChange={e => setEditData({ ...editData, stageName: e.target.value })}
                className="bg-white/[0.04] border border-[#22d4c8]/30 text-white rounded-xl px-3 py-1.5 text-lg font-bold focus:outline-none focus:border-[#22d4c8]/60 transition-colors w-full"
              />
            ) : (
              <h2 className="text-xl font-bold text-white">{details.stageName || profile.username}</h2>
            )}
          </div>
          {isOwner && (
            <button
              onClick={isEditing ? handleSaveEdits : () => setIsEditing(true)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                isEditing
                  ? 'bg-[#22d4c8]/20 text-[#22d4c8] border border-[#22d4c8]/30 hover:bg-[#22d4c8]/30'
                  : 'bg-white/[0.04] text-white/60 border border-white/[0.08] hover:bg-white/[0.07]'
              }`}
            >
              {isEditing ? 'Save' : 'Edit'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Base City" value={details.city} editing={isEditing} editKey="city" />
          <Field label="Agency" value={details.agency || 'Independent'} editing={isEditing} editKey="agency" />
        </div>

        {details.events && details.events.length > 0 && !isEditing && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {details.events.map(ev => (
                <span key={ev} className="px-3 py-1 rounded-full text-[10px] font-bold bg-[#22d4c8]/10 text-[#22d4c8] border border-[#22d4c8]/20 uppercase tracking-widest">
                  {ev}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Events section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-white">Upcoming Events</h3>
          {isOwner && (
            <div className="flex gap-3">
              <button
                onClick={() => window.location.search = '?tab=KSocial'}
                className="text-[#4f8cff] text-[10px] font-bold uppercase tracking-widest hover:text-[#22d4c8] transition-colors"
              >
                KSocial
              </button>
              <button
                onClick={() => document.getElementById('host-tracker-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[#22d4c8] text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
              >
                Manage
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-5 h-5 border-2 border-[#22d4c8] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/[0.08] p-8 text-center">
            <p className="text-white/30 text-xs font-medium uppercase tracking-widest">No upcoming events</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(ev => (
              <div
                key={ev.id}
                onClick={() => onViewEntity && onViewEntity(ev.title)}
                className="bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.05] p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all"
              >
                <div className="min-w-0">
                  <h4 className="text-white font-semibold text-sm truncate">{ev.title}</h4>
                  <p className="text-[10px] text-[#22d4c8] font-bold uppercase tracking-widest mt-0.5">
                    {new Date(ev.event_date).toLocaleDateString()} · {ev.venue}
                  </p>
                </div>
                <svg className="w-4 h-4 text-white/30 flex-shrink-0 ml-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
