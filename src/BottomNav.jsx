export default function BottomNav({ displayTabs, activeTab, changeTab, viewingEntity }) {
    // Hide the nav if we are viewing a specific profile/entity so it doesn't crowd the screen
    if (viewingEntity) return null;

    return (
      <div className="fixed bottom-0 left-0 w-full z-[90] bg-[#090812]/95 backdrop-blur-2xl border-t border-gray-800 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-2xl mx-auto px-2 flex overflow-x-auto hide-scrollbar items-center">
          <div className="flex gap-2 py-3 w-full justify-start sm:justify-center">
            {displayTabs.map(tab => (
              <button
                key={tab} 
                onClick={() => changeTab(tab)}
                className={`px-4 py-2.5 rounded-xl text-[11px] font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
                  activeTab === tab 
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
    )
}