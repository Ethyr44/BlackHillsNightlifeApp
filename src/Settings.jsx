import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function Toggle({ id, checked, onChange, label, description }) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 rounded-xl transition-all duration-150"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white/80" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</p>
        <p className="text-[11px] text-white/30 mt-0.5 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>{description}</p>
      </div>
      <button
        id={id}
        onClick={onChange}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-200"
        style={{
          background: checked ? 'linear-gradient(135deg, #4f8cff, #2463d4)' : 'rgba(255,255,255,0.1)',
          boxShadow: checked ? '0 2px 8px rgba(79,140,255,0.35)' : 'none',
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
        />
      </button>
    </div>
  )
}

function Section({ title, accent, children }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="px-5 py-3.5 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: accent }} />
        <h3
          className="text-xs font-bold uppercase tracking-wider"
          style={{ fontFamily: 'Inter, sans-serif', color: accent }}
        >
          {title}
        </h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

export default function Settings({ currentUser, setCurrentUser }) {
  const [editName, setEditName] = useState(currentUser?.username || '')
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'success' | 'error'
  const [locationEnabled, setLocationEnabled] = useState(() => localStorage.getItem('bhnl_location_enabled') === 'true')
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('bhnl_notifications_enabled') === 'true')

  const handleSaveName = async () => {
    setSaveStatus('saving')
    const { error } = await supabase.from('profiles').update({ username: editName }).eq('id', currentUser.id)
    if (!error) {
      setCurrentUser({ ...currentUser, username: editName })
      setSaveStatus('success')
      setTimeout(() => setSaveStatus(null), 2500)
    } else {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus(null), 2500)
    }
  }

  const handleSignOut = async () => {
    if (!window.confirm('Sign out of BHNL?')) return
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('Permanently delete your account? This cannot be undone.')) return
    if (!window.confirm('FINAL WARNING — all your data will be erased. Continue?')) return
    try {
      const { error } = await supabase.rpc('delete_user')
      if (error) throw error
      localStorage.removeItem('bhnl_location_enabled')
      localStorage.removeItem('bhnl_notifications_enabled')
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (err) {
      alert('Error: ' + err.message)
    }
  }

  const handleLocationToggle = () => {
    if (!locationEnabled) {
      if (!navigator.geolocation) return alert('Location services not supported.')
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const { latitude, longitude } = pos.coords
          const { error } = await supabase.from('profiles').update({ current_lat: latitude, current_lng: longitude, last_active: new Date().toISOString() }).eq('id', currentUser.id)
          if (error) { alert('Error: ' + error.message); return }
          setLocationEnabled(true)
          localStorage.setItem('bhnl_location_enabled', 'true')
        },
        err => alert('Location denied: ' + err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      )
    } else {
      supabase.from('profiles').update({ current_lat: null, current_lng: null }).eq('id', currentUser.id).then(({ error }) => {
        if (error) { alert('Error: ' + error.message); return }
        setLocationEnabled(false)
        localStorage.setItem('bhnl_location_enabled', 'false')
      })
    }
  }

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      if (!('Notification' in window)) return alert('Push notifications not supported.')
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        setNotificationsEnabled(true)
        localStorage.setItem('bhnl_notifications_enabled', 'true')
      } else {
        alert('Permission denied. Enable notifications in your browser settings.')
      }
    } else {
      setNotificationsEnabled(false)
      localStorage.setItem('bhnl_notifications_enabled', 'false')
    }
  }

  const StatusPill = () => {
    if (!saveStatus) return null
    const cfg = {
      saving: { bg: 'rgba(79,140,255,0.12)', border: 'rgba(79,140,255,0.3)', text: '#4f8cff', label: 'Saving…' },
      success: { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)', text: '#34d399', label: '✓ Saved' },
      error: { bg: 'rgba(245,85,122,0.12)', border: 'rgba(245,85,122,0.3)', text: '#f5557a', label: 'Error saving' },
    }[saveStatus]
    return (
      <span
        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text, fontFamily: 'Inter, sans-serif' }}
      >
        {cfg.label}
      </span>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32 animate-fade-in-up space-y-4">

      {/* Page title */}
      <div className="mb-2">
        <h1
          className="text-2xl font-extrabold text-white/90"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-0.02em' }}
        >
          Settings
        </h1>
        <p className="text-xs text-white/30 mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
          Manage your account, permissions, and preferences
        </p>
      </div>

      {/* Profile */}
      <Section title="Profile" accent="#4f8cff">
        <div className="flex items-center gap-3 mb-1">
          <img
            src={currentUser?.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.username}`}
            className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
            style={{ border: '2px solid rgba(79,140,255,0.3)' }}
            alt=""
          />
          <div>
            <p className="text-sm font-semibold text-white/80" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{currentUser?.username}</p>
            <p className="text-[11px] text-white/30" style={{ fontFamily: 'Inter, sans-serif' }}>{currentUser?.email}</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30 block mb-1.5" style={{ fontFamily: 'Inter, sans-serif' }}>
            Username
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSaveName()}
              className="flex-1 px-3 py-2.5 text-sm text-white/80 rounded-xl outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(79,140,255,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button
              onClick={handleSaveName}
              disabled={saveStatus === 'saving' || !editName.trim()}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #4f8cff, #2463d4)',
                color: '#fff',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 2px 8px rgba(79,140,255,0.25)',
              }}
            >
              Save
            </button>
          </div>
          <div className="mt-2 h-5 flex items-center">
            <StatusPill />
          </div>
        </div>
      </Section>

      {/* Permissions */}
      <Section title="Permissions" accent="#22d4c8">
        <Toggle
          id="location"
          checked={locationEnabled}
          onChange={handleLocationToggle}
          label="Location Services"
          description="Show your position on the map and enable nearby venue discovery."
        />
        <Toggle
          id="notifications"
          checked={notificationsEnabled}
          onChange={handleNotificationToggle}
          label="Push Notifications"
          description="Get alerted when your turn is up on stage or you receive a message."
        />
      </Section>

      {/* Account */}
      <Section title="Account" accent="#f5c542">
        <div className="px-1 py-0.5">
          <p className="text-[11px] text-white/30" style={{ fontFamily: 'Inter, sans-serif' }}>
            Signed in as <span className="text-white/60 font-medium">{currentUser?.email}</span>
          </p>
          <p className="text-[11px] text-white/30 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
            Role: <span className="text-white/60 font-medium">{currentUser?.account_type}</span>
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{
            background: 'rgba(245,197,66,0.08)',
            border: '1px solid rgba(245,197,66,0.2)',
            color: 'rgba(245,197,66,0.85)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Sign Out
        </button>
      </Section>

      {/* Danger zone */}
      <Section title="Danger Zone" accent="#f5557a">
        <p className="text-[11px] text-white/30 leading-relaxed px-1" style={{ fontFamily: 'Inter, sans-serif' }}>
          Permanently deletes your profile, all points, and vault contents. This cannot be reversed.
        </p>
        <button
          onClick={handleDeleteAccount}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{
            background: 'rgba(245,85,122,0.08)',
            border: '1px solid rgba(245,85,122,0.2)',
            color: 'rgba(245,85,122,0.8)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Permanently Delete Account
        </button>
      </Section>
    </div>
  )
}
