import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import NotificationsMenu from './NotificationsMenu'
import { useAppConfig } from './useAppConfig'

export default function TopNav({
  currentUser,
  searchQuery, 
  setSearchQuery, 
  executeSearch,
  showNotifications, 
  setShowNotifications,
  setShowVibeCode,
  tabs, 
  activeTab, 
  changeTab, 
  viewingEntity,
  onViewEntity // 🟢 NEW PROP
}) {
  const config = useAppConfig()
  const [unreadCount, setUnreadCount] = useState(0)

  // 🟢 NEW: Real-time Unread Counter
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

      // Subscribe to instant ping updates
      const sub = supabase.channel('notif-ping')
          .on('postgres', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, () => {
              setUnreadCount(prev => prev + 1)
          })
          .on('postgres', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, fetchUnread)
          .subscribe()

      return () => supabase.removeChannel(sub)
  }, [currentUser?.id])

  const displayTabs = currentUser?.account_type === 'Temp_Crawl' 
      ? ['Live'] 
      : tabs;

  return (
    <nav className="bg-gray-900/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-800 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-2xl mx-auto p-4 flex gap-3 items-center justify-between">
        {config.app_title_visible !== false && (
            <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] hidden sm:block">
                {config.app_title || 'BHNL'}
            </h1>
        )}
        
        <div className="flex-1 relative mx-2">
          <input 
            type="text" 
            placeholder="Search users, venues, acts" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} 
            onKeyDown={executeSearch}
            className="w-full bg-black border border-gray-700 text-white rounded-full py-2 px-4 pl-10 focus:outline-none focus:border-blue-500 transition-all text-sm"
          />
          <span className="absolute left-4 top-2.5 text-gray-500">🔍</span>
        </div>

        <div className="relative flex items-center">
           <button onClick={() => setShowVibeCode(true)} className="text-xl hover:scale-110 transition-transform bg-blue-900/30 w-10 h-10 rounded-full flex items-center justify-center border border-blue-500/50 mr-2 text-blue-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                 <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
              </svg>
           </button>

           {/* 🟢 NEW: Bell Wrapper for Dot Position */}
           <div className="relative">
               <button 
                    onClick={() => {
                        setShowNotifications(!showNotifications)
                        if (!showNotifications) setUnreadCount(0)
                    }} 
                    className="text-2xl hover:scale-110 transition-transform bg-gray-800 w-10 h-10 rounded-full flex items-center justify-center border border-gray-700"
                >
                  🔔
               </button>
               {unreadCount > 0 && (
                   <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
               )}
           </div>

           {showNotifications && (
               <NotificationsMenu 
                  userId={currentUser.id} 
                  onClose={() => setShowNotifications(false)} 
                  onRoute={(type, id) => {
                      if (onViewEntity) onViewEntity(id)
                  }}
               />
           )}
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto px-4 flex overflow-x-auto hide-scrollbar border-t border-gray-800">
        <div className="flex gap-1 py-2">
          {displayTabs.map(tab => (
            <button
              key={tab} 
              onClick={() => changeTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
                activeTab === tab && !viewingEntity 
                ? (tab === 'Admin Console' ? 'bg-red-900/20 text-red-500 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]') 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}