import NotificationsMenu from './NotificationsMenu'

export default function TopNav({
  currentUser,
  searchQuery, 
  setSearchQuery, 
  executeSearch,
  showNotifications, 
  setShowNotifications,
  tabs, 
  activeTab, 
  changeTab, 
  viewingEntity
}) {
  return (
    <nav className="bg-gray-900/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-800 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      <div className="max-w-2xl mx-auto p-4 flex gap-3 items-center justify-between">
        <h1 className="font-['Bebas_Neue'] text-3xl tracking-widest text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)] hidden sm:block">
            BHNL
        </h1>
        
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

        <div className="relative">
           <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="text-2xl hover:scale-110 transition-transform bg-gray-800 w-10 h-10 rounded-full flex items-center justify-center border border-gray-700"
            >
              🔔
           </button>
           {showNotifications && (
               <NotificationsMenu userId={currentUser.id} onClose={() => setShowNotifications(false)} />
           )}
        </div>
      </div>
      
      <div className="max-w-2xl mx-auto px-4 flex overflow-x-auto hide-scrollbar border-t border-gray-800">
        <div className="flex gap-1 py-2">
          {tabs.map(tab => (
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