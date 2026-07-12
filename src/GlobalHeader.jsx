import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import NotificationsMenu from './NotificationsMenu'

export default function GlobalHeader({
  currentUser,
  searchQuery,
  setSearchQuery,
  executeSearch,
  showNotifications,
  setShowNotifications,
  setShowVibeCode,
  onViewEntity,
  onHomeClick
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (!currentUser?.id) return

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }

    fetchUnread()

    const sub = supabase.channel('notif-ping')
      .on('postgres', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, () => {
        setUnreadCount(prev => prev + 1)
      })
      .on('postgres', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, fetchUnread)
      .on('postgres', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, fetchUnread)
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [currentUser?.id])

  return (
    <header
      className={`sticky top-0 z-[100] transition-all duration-300 ${
        isScrolled
          ? 'bg-[#070d1a]/95 backdrop-blur-xl border-b border-white/5 shadow-[0_1px_24px_rgba(0,0,0,0.4)]'
          : 'bg-[#070d1a]/80 backdrop-blur-md border-b border-white/[0.04]'
      }`}
    >
      <div className="max-w-2xl mx-auto px-4 h-[60px] flex items-center gap-3">

        {/* Logo */}
        <button
          onClick={onHomeClick}
          className="flex items-center gap-2 flex-shrink-0 group"
        >
          <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-[#4f8cff] to-[#2463d4] flex items-center justify-center shadow-[0_2px_12px_rgba(79,140,255,0.35)] transition-all duration-200 group-hover:shadow-[0_4px_20px_rgba(79,140,255,0.5)] group-hover:scale-105">
            <span className="text-white text-[13px] font-black tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>B</span>
          </div>
          <span className="hidden sm:block text-[15px] font-bold text-white/90 group-hover:text-white transition-colors" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', letterSpacing: '-0.02em' }}>
            BHNL
          </span>
        </button>

        {/* Search */}
        <form
          onSubmit={executeSearch}
          className="flex-1 min-w-0"
        >
          <div className="relative flex items-center">
            <svg className="absolute left-3 w-[14px] h-[14px] text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx={11} cy={11} r={8} />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search venues, people..."
              className="w-full bg-white/[0.05] border border-white/[0.07] hover:border-white/[0.12] focus:border-[#4f8cff]/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(79,140,255,0.12)] text-white/90 placeholder-white/25 rounded-xl py-2 pl-9 pr-4 text-[13px] font-medium transition-all duration-200 outline-none"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-1 relative">
          {/* VibeCode / QR */}
          <button
            onClick={() => setShowVibeCode(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-150"
            title="VibeCode"
          >
            <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2z"/>
            </svg>
          </button>

          {/* Notifications */}
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-all duration-150 relative"
            title="Notifications"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-[7px] right-[7px] w-[8px] h-[8px] bg-[#4f8cff] rounded-full border-2 border-[#070d1a] shadow-[0_0_8px_rgba(79,140,255,0.8)]" />
            )}
          </button>

          {showNotifications && (
            <NotificationsMenu
              userId={currentUser.id}
              onClose={() => setShowNotifications(false)}
              onRoute={(type, id) => { if (onViewEntity) onViewEntity(id) }}
              onMarkRead={() => setUnreadCount(prev => Math.max(0, prev - 1))}
              onMarkAllRead={() => setUnreadCount(0)}
            />
          )}
        </div>
      </div>
    </header>
  )
}
