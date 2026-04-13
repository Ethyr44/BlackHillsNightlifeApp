import { useState } from 'react'
import MainFeed from './MainFeed'
import EventsFeed from './EventsFeed'
import JournalFeed from './JournalFeed'

export default function FYP({ currentUser, onViewEntity }) {
  const [activeMiniPage, setActiveMiniPage] = useState('Feed') 

  return (
    <div className="max-w-2xl mx-auto animate-fade-in pb-32">
      
      {/* HUB HEADER & SUB-NAVIGATION */}
      <div className="p-4 pt-6 sticky top-[68px] sm:top-[76px] bg-[#030712]/95 backdrop-blur-xl z-40 border-b border-gray-800 shadow-xl">
         <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            {activeMiniPage === 'Feed' && 'THE FEED'}
            {activeMiniPage === 'Events' && 'THE LINEUP'}
            {activeMiniPage === 'Journal' && 'THE JOURNAL'}
         </h2>
         
         <div className="flex gap-2 mt-4 bg-gray-900 p-1.5 rounded-xl border border-gray-800 shadow-inner">
            {['Feed', 'Events', 'Journal'].map(tab => (
               <button 
                 key={tab} 
                 onClick={() => setActiveMiniPage(tab)}
                 className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    activeMiniPage === tab 
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' 
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                 }`}
               >
                 {tab}
               </button>
            ))}
         </div>
      </div>

      {/* MINI-PAGE RENDERING */}
      <div className="p-4 mt-2">
         {activeMiniPage === 'Feed' && <MainFeed currentUser={currentUser} onViewEntity={onViewEntity} />}
         {activeMiniPage === 'Events' && <EventsFeed currentUser={currentUser} onViewEntity={onViewEntity} />}
         {activeMiniPage === 'Journal' && <JournalFeed currentUser={currentUser} />}
      </div>

    </div>
  )
}