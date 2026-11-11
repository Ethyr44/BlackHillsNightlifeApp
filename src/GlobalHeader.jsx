import { useState, useEffect, useRef } from 'react'
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
  onNotifRoute, // 🟢 Added to props
  onHomeClick
}) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchContainerRef = useRef(null)
  const notifContainerRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close suggestions & notifications dropdown when clicking/tapping outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
      if (notifContainerRef.current && !notifContainerRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [setShowNotifications])

  // Fetch Top 3 Search Suggestions (Venues/Pages + Users)
  useEffect(() => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      const q = `%${trimmed}%`
      const [pagesRes, profilesRes] = await Promise.all([
        supabase
          .from('pages')
          .select('id, name, page_type, profile_pic, address')
          .or(`name.ilike.${q},page_type.ilike.${q}`)
          .limit(3),
        supabase
          .from('profiles')
          .select('id, username, account_type, profile_pic')
          .ilike('username', q)
          .limit(3)
      ])

      const lowerQ = trimmed.toLowerCase()
      const pageItems = (pagesRes.data || []).map(p => ({
        id: `page-${p.id}`,
        label: p.name,
        sublabel: p.address || p.page_type,
        badge: p.page_type || 'Venue',
        isPage: true,
        avatar: p.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${p.name}`,
        starts: (p.name || '').toLowerCase().startsWith(lowerQ) ? 0 : 1
      }))

      const userItems = (profilesRes.data || []).map(u => ({
        id: `user-${u.id}`,
        label: u.username,
        sublabel: u.account_type || 'Member',
        badge: 'User',
        isPage: false,
        avatar: u.profile_pic || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`,
        starts: (u.username || '').toLowerCase().startsWith(lowerQ) ? 0 : 1
      }))

      const combined = [...pageItems, ...userItems]
        .sort((a, b) => a.starts - b.starts || a.label.localeCompare(b.label))
        .slice(0, 3)

      setSuggestions(combined)
    }, 180)

    return () => clearTimeout(timer)
  }, [searchQuery])

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
          ref={searchContainerRef}
          onSubmit={(e) => {
            setShowSuggestions(false)
            executeSearch(e)
          }}
          className="flex-1 min-w-0 relative"
        >
          <div className="relative flex items-center">
            <svg className="absolute left-3 w-[14px] h-[14px] text-white/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx={11} cy={11} r={8} />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setShowSuggestions(true)}
              onChange={e => {
                setSearchQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') setShowSuggestions(false)
              }}
              placeholder="Search venues, people..."
              className="w-full bg-white/[0.05] border border-white/[0.07] hover:border-white/[0.12] focus:border-[#4f8cff]/60 focus:bg-white/[0.07] focus:shadow-[0_0_0_3px_rgba(79,140,255,0.12)] text-white/90 placeholder-white/25 rounded-xl py-2 pl-9 pr-4 text-[13px] font-medium transition-all duration-200 outline-none"
              style={{ fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          {/* Top 3 Search Suggestions Dropdown */}
          {showSuggestions && searchQuery.trim().length > 0 && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-[#0b1324]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.75)] overflow-hidden z-[150] animate-fade-in">
              <div className="px-3 py-1.5 border-b border-white/[0.06] flex justify-between items-center">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Top Suggestions</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#4f8cff]/70">Tap to Open</span>
              </div>
              <div className="divide-y divide-white/[0.05]">
                {suggestions.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setShowSuggestions(false)
                      setSearchQuery('')
                      if (onViewEntity) onViewEntity(item.label)
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={item.avatar}
                        alt={item.label}
                        className="w-8 h-8 rounded-full object-cover border border-white/10 bg-[#070d1a] flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item.label}</p>
                        {item.sublabel && (
                          <p className="text-[10px] text-white/40 truncate">{item.sublabel}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex-shrink-0 border ${
                        item.isPage
                          ? 'bg-[#4f8cff]/15 text-[#4f8cff] border-[#4f8cff]/30'
                          : 'bg-[#22d4c8]/15 text-[#22d4c8] border-[#22d4c8]/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Actions */}
        <div ref={notifContainerRef} className="flex items-center gap-1 relative">
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
              onRoute={(notif) => { 
                  // 🟢 UPDATED: Uses our new routing logic if available
                  if (onNotifRoute) onNotifRoute(notif);
                  else if (onViewEntity && notif?.target_id) onViewEntity(notif.target_id); 
              }}
              onMarkRead={() => setUnreadCount(prev => Math.max(0, prev - 1))}
              onMarkAllRead={() => setUnreadCount(0)}
            />
          )}
        </div>
      </div>
    </header>
  )
}
