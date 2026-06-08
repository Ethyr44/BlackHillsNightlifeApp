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
  onHomeClick // 🟢 We will use this to navigate to the Main Menu soon!
}) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
      if (!currentUser?.id) return

      const fetchUnread = async () => {
          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          const { count } = await supabase
              .from('notifications')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', currentUser.id)
              .eq('is_read', false)
              .gte('created_at', yesterday)
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
    <div className="sticky top-0 z-[100] bg-[#030712]/90 backdrop-blur-xl border-b border-gray-800 shadow-2xl">
      <div className="max-w-2xl mx-auto px-4 h-16 flex justify-between items-center gap-4">
         
         {/* LOGO / HOME BUTTON */}
         <button onClick={onHomeClick} className="flex items-center flex-shrink-0 transition-transform hover:scale-105">
             <h1 className="text-3xl font-['Bebas_Neue'] tracking-widest bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                BHNL
             </h1>
         </button>
         
         {/* SLEEK, SCALED-DOWN SEARCH BAR */}
         <form onSubmit={executeSearch} className="flex-1 max-w-[200px] sm:max-w-xs relative">
            <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-500 text-sm">🔍</span>
                <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="Search scene..." 
                    className="w-full bg-[#0B0F19] border border-gray-700 hover:border-gray-500 text-white rounded-full py-1.5 pl-9 pr-4 text-[11px] font-bold tracking-widest focus:outline-none focus:border-blue-500 transition-colors shadow-inner" 
                />
            </div>
         </form>
         
         {/* ACTION ICONS */}
         <div className="flex items-center gap-1 sm:gap-2 relative">
             <button onClick={() => setShowVibeCode(true)} className="text-gray-400 hover:text-white p-2 transition-colors">
                {/* 🟢 NEW: QR Code SVG Icon */}
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2z"/>
                </svg>
             </button>
             
             <button onClick={() => setShowNotifications(!showNotifications)} className="text-gray-400 hover:text-white p-2 transition-colors relative">
                <span className="text-xl leading-none">🔔</span>
                {unreadCount > 0 && (
                   <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#030712] animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
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
    </div>
  )
}