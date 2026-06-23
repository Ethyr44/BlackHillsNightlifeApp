import React from 'react'

export default function About() {
  return (
    <div className="animate-fade-in space-y-6 pb-24 px-4 max-w-2xl mx-auto mt-4">
        
        {/* Header / Version Card */}
        <div className="bg-[#090812] border-2 border-gray-800 p-8 rounded-[32px] text-center relative overflow-hidden shadow-xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            <img src="/pwa-192x192.png" alt="BHNL Logo" className="w-24 h-24 mx-auto mb-4 rounded-3xl shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-black object-cover" />
            <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-widest mb-1">Black Hills Nightlife</h2>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Version 1.0.0 • Phygital Ecosystem</p>
        </div>

        {/* The FAQ Section */}
        <div className="bg-black/60 border border-gray-800 rounded-3xl p-6 shadow-lg">
            <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-6 border-b border-gray-800 pb-4">FAQ & Guide</h3>
            
            <div className="space-y-6">
                <div>
                    <h4 className="text-blue-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><span className="text-lg">💰</span> How do I earn L$ (Lifestyle Points)?</h4>
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                        L$ is the currency of the night. You earn it automatically by logging in daily, checking into venues on the Map (must be within 100 feet!), making friends via VibeCodes, and performing on stage during KSocial Live events!
                    </p>
                </div>
                
                <div>
                    <h4 className="text-purple-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><span className="text-lg">📸</span> What is a VibeCode?</h4>
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                        Your VibeCode is your digital passport. If you meet someone at a bar, open your Profile and tap the QR icon at the top. Have them scan it with their phone's native camera to instantly connect on BHNL and earn bonus points.
                    </p>
                </div>

                <div>
                    <h4 className="text-pink-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><span className="text-lg">🎤</span> How does KSocial work?</h4>
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                        If you are at a participating karaoke venue, navigate to the LIVE tab and tap KSocial. You can submit songs directly to the DJ's queue from your phone. When someone hits the stage, you can rate their performance and tip them points!
                    </p>
                </div>

                <div>
                    <h4 className="text-cyan-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2"><span className="text-lg">📍</span> How do I get my venue listed?</h4>
                    <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                        Create an account, go to Settings, and ensure your account type is set to "Venue". Once an Admin approves your request, you can link your account to a specific location on the map to manage its hours, events, and specials.
                    </p>
                </div>
            </div>
        </div>

        {/* Support Section */}
        <div className="bg-gradient-to-br from-blue-900/20 to-black border border-blue-500/30 rounded-3xl p-8 text-center shadow-[0_0_30px_rgba(59,130,246,0.1)]">
            <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Need Support?</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">Found a bug, have a suggestion, or want to partner with us for an event? Let us know!</p>
            <a href="mailto:support@blackhillsnightlife.com" className="inline-block bg-blue-600 hover:bg-blue-500 text-white py-4 px-10 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:scale-105 active:scale-95">
                Contact Admin
            </a>
        </div>
    </div>
  )
}