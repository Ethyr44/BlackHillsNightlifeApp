import React from 'react'

export default function About() {
  return (
    <div className="animate-fade-in space-y-6 pb-24">
        <div className="bg-[#090812] border-2 border-gray-800 p-8 rounded-[32px] text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            <img src="/pwa-192x192.png" alt="BHNL Logo" className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-xl" />
            <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-widest mb-1">Black Hills Nightlife</h2>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Version 1.0.0</p>
        </div>

        <div className="bg-black/50 border border-gray-800 rounded-3xl p-6">
            <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-4 border-b border-gray-800 pb-2">FAQ & Help</h3>
            <div className="space-y-4">
                <div>
                    <h4 className="text-blue-400 font-bold text-xs uppercase tracking-widest">How do I earn L$ (Life Points)?</h4>
                    <p className="text-gray-400 text-sm mt-1">Check into venues on the map, find GeoGifts, post vibes on the feed, and participate in KSocial events!</p>
                </div>
                <div>
                    <h4 className="text-blue-400 font-bold text-xs uppercase tracking-widest">How do I get my venue listed?</h4>
                    <p className="text-gray-400 text-sm mt-1">Create an account, set your role to "Venue", and submit your details for admin approval.</p>
                </div>
            </div>
        </div>

        <div className="bg-blue-900/10 border border-blue-500/30 rounded-3xl p-6 text-center">
            <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Need Support?</h3>
            <p className="text-gray-400 text-sm mb-4">Found a bug or have a suggestion? Let us know!</p>
            <a href="mailto:support@blackhillsnightlife.com" className="inline-block bg-blue-600 hover:bg-blue-500 text-white py-3 px-8 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-[0_0_15px_rgba(59,130,246,0.4)]">
                Contact Us
            </a>
        </div>
    </div>
  )
}