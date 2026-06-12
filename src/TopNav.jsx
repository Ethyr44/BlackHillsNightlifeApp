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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (executeSearch) executeSearch({ key: 'Enter' });
  };

  return (
    <>
      {/* 🟢 TOP HEADER (Sticky) */}
      <div className="sticky top-0 z-50 bg-[#030712]/90 backdrop-blur-xl border-b border-gray-800 shadow-2xl">
        <div className="max-w-2xl mx-auto p-4 flex justify-between items-center">
           <div className="flex items-center gap-4 flex-1">
               <button onClick={() => changeTab('Profile')} className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-800 hover:border-blue-500 transition-colors flex-shrink-0 bg-gray-900">
                  <img src={currentUser.profile_pic || `https://api.dicebear.com/7.x/shapes/svg?seed=${currentUser.username}`} alt="Profile" decoding="async" className="w-full h-full object-cover" />
               </button>
               
               <h1 className="text-3xl font-['Bebas_Neue'] tracking-widest bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text drop-shadow-[0_0_10px_rgba(59,130,246,0.3)] hidden sm:block">
                  BHNL
               </h1>
               
               <form onSubmit={handleSearchSubmit} className="flex-1 max-w-xs relative">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full bg-black/50 border border-gray-700 text-white rounded-full py-1.5 px-4 text-xs focus:outline-none focus:border-blue-500 transition-colors" />
               </form>
           </div>
           
           <div className="flex items-center gap-3 relative z-[60]">
               <button onClick={() => setShowVibeCode(true)} className="text-gray-400 hover:text-white p-2 transition-colors">
                  <span className="text-xl leading-none">📱</span>
               </button>
               
               <button onClick={() => setShowNotifications(!showNotifications)} className="text-gray-400 hover:text-white p-2 transition-colors relative">
                  <span className="text-xl leading-none">🔔</span>
                  {unreadCount > 0 && (
                     <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                  )}
               </button>

               {showNotifications && (
                   <NotificationsMenu userId={currentUser.id} onClose={() => setShowNotifications(false)} onRoute={(type, id) => { if (onViewEntity) onViewEntity(id) }} />
               )}
           </div>
        </div>
      </div>
      
      {/* 🟢 FLOATING BOTTOM NAV DOCK */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[95%] sm:w-full max-w-2xl z-50 bg-[#090812]/95 backdrop-blur-2xl border border-gray-700/50 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.8)] pb-safe overflow-hidden">
        <div className="px-2 flex overflow-x-auto hide-scrollbar items-center">
          <div className="flex gap-2 py-3 w-full justify-start sm:justify-center">
            {displayTabs.map(tab => (
              <button
                key={tab} 
                onClick={() => changeTab(tab)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
                  activeTab === tab && !viewingEntity 
                  ? (tab === 'Admin Console' ? 'bg-red-900/20 text-red-500 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]')
                  : 'text-gray-500 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}