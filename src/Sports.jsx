import React, { useState } from 'react'

export default function Sports() {
  const [activeTab, setActiveTab] = useState('Pick-Up')

  return (
    <div className="max-w-2xl mx-auto p-4 animate-fade-in pb-32 mt-4">
        
        <div className="text-center mb-6">
            <h2 className="text-5xl font-['Bebas_Neue'] text-[#ff4500] tracking-wider drop-shadow-[0_0_15px_rgba(255,69,0,0.4)]">
                BHNL SPORTS
            </h2>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mt-1">
                Leagues • Pick-Up Games • Watch Parties
            </p>
        </div>

        {/* Sports Navigation */}
        <div className="flex bg-[#090812] border border-gray-800 rounded-xl p-1 mb-6 overflow-x-auto hide-scrollbar">
            {['Pick-Up', 'Bar Leagues', 'Watch Parties', 'Referees'].map(tab => (
                <button 
                    key={tab} 
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 min-w-[90px] py-3 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                        activeTab === tab 
                        ? 'bg-[#ff4500]/20 text-[#ff4500] border border-[#ff4500]/30 shadow-[0_0_10px_rgba(255,69,0,0.2)]' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                >
                    {tab}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-8 text-center shadow-xl relative overflow-hidden">
            {activeTab === 'Pick-Up' && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>}
            {activeTab === 'Bar Leagues' && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>}
            {activeTab === 'Watch Parties' && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>}
            {activeTab === 'Referees' && <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>}

            <span className="text-6xl mb-4 block opacity-80">
                {activeTab === 'Pick-Up' ? '🏀' : activeTab === 'Bar Leagues' ? '🏆' : activeTab === 'Watch Parties' ? '🍻' : '🦓'}
            </span>
            <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-2">{activeTab} Hub</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                {activeTab === 'Pick-Up' && "Find local courts, schedule pick-up games, and ping nearby players to fill your roster."}
                {activeTab === 'Bar Leagues' && "Track local darts, pool, cornhole, and volleyball bar leagues happening across the Black Hills."}
                {activeTab === 'Watch Parties' && "Discover which venues have the game on with the volume up. Find drink specials and fan meetups."}
                {activeTab === 'Referees' && "Need a neutral party? Hire a BHNL Verified Referee for your tournament or high-stakes pick-up game."}
            </p>
            
            <button disabled className="w-full bg-gray-900 border border-gray-700 text-gray-500 py-4 rounded-xl font-bold uppercase tracking-widest text-xs cursor-not-allowed">
                Under Construction (v1.1)
            </button>
        </div>
    </div>
  )
}