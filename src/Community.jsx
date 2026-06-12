import React from 'react'

export default function Community() {
  return (
    <div className="animate-fade-in space-y-6 p-4 sm:p-8 flex flex-col items-center justify-center min-h-[70vh] text-center">
        <div className="bg-[#090812] border-2 border-cyan-500/30 p-10 rounded-[32px] shadow-[0_0_50px_rgba(6,182,212,0.15)] max-w-md w-full">
            <span className="text-6xl mb-4 block drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">📰</span>
            <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Community Board</h2>
            <p className="text-cyan-400 font-bold uppercase tracking-widest text-[10px] mb-6 border-b border-cyan-900/50 pb-4">
                Coming in Version 1.1
            </p>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Soon, you'll be able to view Admin Announcements, Challenges, Specials, Updates, Release Notes, and more all in one place!
            </p>
            <button disabled className="w-full bg-gray-800 text-gray-500 py-3 rounded-xl font-bold uppercase tracking-widest text-xs cursor-not-allowed">
                Under Construction
            </button>
        </div>
    </div>
  )
}