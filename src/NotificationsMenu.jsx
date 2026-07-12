import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function NotificationsMenu({ userId, onClose, onRoute, onMarkRead, onMarkAllRead }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifs()
    const sub = supabase.channel('active-menu-notifs')
      .on('postgres', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, fetchNotifs)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [userId])

  const fetchNotifs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(15)
    if (data) setNotifications(data)
    setLoading(false)
  }

  const handleMarkAll = async () => {
    const unread = notifications.filter(n => !n.is_read)
    if (!unread.length) return
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', unread.map(n => n.id))
    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      if (onMarkAllRead) onMarkAllRead()
    }
  }

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
      if (onMarkRead) onMarkRead()
    }
    if (notif.target_id) { onClose(); onRoute(notif.type, notif.target_id) }
  }

  const timeAgo = (dateStr) => {
    const s = Math.floor((Date.now() - new Date(dateStr)) / 1000)
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  }

  return (
    <div
      className="absolute top-12 right-0 w-80 rounded-2xl overflow-hidden animate-scale-in z-[200]"
      style={{
        background: 'rgba(10,18,40,0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider text-white/60"
          style={{ fontFamily: 'Inter, sans-serif' }}
        >
          Notifications
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAll}
            className="text-[10px] font-semibold text-[#4f8cff]/70 hover:text-[#4f8cff] transition-colors uppercase tracking-wider"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Mark all read
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {loading ? (
          <div className="py-10 text-center">
            <div className="w-5 h-5 border-2 border-[#4f8cff]/30 border-t-[#4f8cff] rounded-full animate-spin mx-auto" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <p className="text-xs text-white/30 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              No notifications yet
            </p>
          </div>
        ) : (
          notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="w-full text-left px-4 py-3.5 transition-all duration-150 hover:bg-white/[0.04] relative"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            >
              {/* Unread indicator bar */}
              {!n.is_read && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full"
                  style={{ background: '#4f8cff', boxShadow: '0 0 6px rgba(79,140,255,0.7)' }}
                />
              )}
              <div className="flex items-start gap-3">
                {/* Icon circle */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: n.is_read ? 'rgba(255,255,255,0.04)' : 'rgba(79,140,255,0.12)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <svg className="w-3.5 h-3.5" style={{ color: n.is_read ? 'rgba(255,255,255,0.2)' : '#4f8cff' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-semibold leading-tight mb-0.5 ${n.is_read ? 'text-white/45' : 'text-white/85'}`}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {n.title}
                  </p>
                  <p
                    className={`text-xs leading-relaxed ${n.is_read ? 'text-white/30' : 'text-white/55'}`}
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {n.content}
                  </p>
                  <p className="text-[10px] text-white/20 mt-1 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {timeAgo(n.created_at)}
                  </p>
                </div>

                {!n.is_read && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: '#4f8cff', boxShadow: '0 0 6px rgba(79,140,255,0.8)' }}
                  />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
