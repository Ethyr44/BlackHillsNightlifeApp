import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import QRCode from 'react-qr-code'

export default function Projector() {
    const [session, setSession] = useState(null)
    const [singers, setSingers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    const [cycleView, setCycleView] = useState('scoreboard')

    const fetchAll = async (sessionId) => {
        const { data: sessData } = await supabase.from('active_sessions').select('*').eq('id', sessionId).single()
        if (sessData) setSession(sessData)

        const { data: singerData } = await supabase.from('session_singers').select('*').eq('session_id', sessionId)
        if (singerData) setSingers(singerData)

        setIsLoading(false)
    }

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const sessionId = params.get('session')

        if (!sessionId) {
            setError("No session ID provided in the URL.")
            setIsLoading(false)
            return
        }

        fetchAll(sessionId)

        // 🟢 THE SMOOTH SYNC FIX (No page reloading)
        const queueSub = supabase.channel(`projector-channel-${sessionId}`)
            .on('postgres', { event: '*', schema: 'public', table: 'session_singers', filter: `session_id=eq.${sessionId}` }, () => fetchAll(sessionId))
            .on('broadcast', { event: 'force-reload' }, () => fetchAll(sessionId))
            .subscribe()
            
        return () => supabase.removeChannel(queueSub)
    }, [])

    useEffect(() => {
        const views = ['scoreboard', 'stage', 'qr']
        let i = 0
        const interval = setInterval(() => {
            i = (i + 1) % views.length
            setCycleView(views[i])
        }, 10000) 
        return () => clearInterval(interval)
    }, [])

    if (error) return <div className="min-h-screen bg-black text-red-500 flex items-center justify-center text-2xl font-bold uppercase tracking-widest">{error}</div>
    if (isLoading) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center text-4xl font-['Bebas_Neue'] tracking-widest animate-pulse">Initializing Display...</div>

    const activeSinger = singers.find(s => s.status === 'singing' || s.status === 'voting' || s.status === 'results')
    const currentView = activeSinger ? 'stage' : cycleView
    const sortedSingers = singers.filter(s => s.status !== 'pending').sort((a,b)=>((b.total_points || b.score_performance || 0))-((a.total_points || a.score_performance || 0)))

    const getMedal = (index) => {
        if (index === 0) return '🥇'
        if (index === 1) return '🥈'
        if (index === 2) return '🥉'
        return index + 1
    }

    const getMedalStyle = (index) => {
        if (index === 0) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]'
        if (index === 1) return 'bg-gray-400/20 text-gray-300 border-gray-400/50'
        if (index === 2) return 'bg-amber-700/20 text-amber-500 border-amber-600/50'
        return 'bg-white/5 text-gray-500 border-gray-700'
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-blue-500/30 flex flex-col">
            
            {/* 🟢 STYLED FROM projector.js */}
            <div className="px-12 py-6 border-b border-gray-800 bg-gradient-to-b from-blue-900/20 to-black flex justify-between items-center shadow-2xl relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#00f5ff] to-[#ff2d78]"></div>
                <div>
                    <h1 className="text-5xl font-['Bebas_Neue'] tracking-[0.05em] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-[#ff2d78] drop-shadow-[0_0_15px_rgba(0,245,255,0.4)]">
                        {session?.title || 'KSocial LIVE!'}
                    </h1>
                    <span className="text-gray-400 uppercase tracking-widest font-bold text-sm ml-1">{session?.venue_name || session?.business_name || 'Black Hills Nightlife'}</span>
                </div>
                <div className="text-right">
                    <span className="block text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Room Code</span>
                    <span className="font-['Bebas_Neue'] text-5xl tracking-[0.2em] text-white">{session?.session_code}</span>
                </div>
            </div>

            <div className="flex-1 p-12 flex flex-col justify-center relative">
                
                {currentView === 'scoreboard' && (
                    <div className="animate-fade-in max-w-5xl mx-auto w-full">
                        <h2 className="text-center font-['Bebas_Neue'] text-6xl text-yellow-500 tracking-widest mb-12 drop-shadow-[0_0_20px_rgba(234,179,8,0.3)]">🏆 LEADERBOARD</h2>
                        
                        {sortedSingers.length === 0 ? (
                            <div className="text-center text-gray-600 text-3xl font-bold uppercase tracking-widest py-20">Waiting for Contenders...</div>
                        ) : (
                            <div className="space-y-4">
                                {sortedSingers.slice(0, 5).map((singer, index) => (
                                    <div key={singer.id} className="bg-gray-900/50 border border-gray-800 rounded-3xl p-6 flex items-center justify-between shadow-lg">
                                        <div className="flex items-center gap-6">
                                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-['Bebas_Neue'] text-4xl border-2 ${getMedalStyle(index)}`}>
                                                {getMedal(index)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-white text-4xl tracking-wide truncate">{singer.singer_name}</h4>
                                                <p className="text-gray-500 uppercase tracking-widest font-bold text-sm mt-1">{singer.song_title}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block font-['Bebas_Neue'] text-6xl text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                                                {singer.total_points || singer.score_performance || 0}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentView === 'stage' && (
                    <div className="animate-fade-in text-center w-full max-w-6xl mx-auto">
                        {activeSinger ? (
                            <div className="bg-gradient-to-b from-gray-900/80 to-black border border-gray-800 p-16 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
                                {activeSinger.status === 'voting' && <div className="absolute inset-0 bg-blue-600/10 animate-pulse"></div>}
                                {activeSinger.status === 'singing' && <div className="absolute inset-0 bg-[#ff2d78]/5 animate-pulse"></div>}
                                
                                <div className="relative z-10">
                                    <span className={`inline-block px-8 py-2 rounded-full text-2xl font-bold uppercase tracking-widest mb-12 border-2 ${
                                        activeSinger.status === 'voting' ? 'bg-blue-900/30 text-blue-400 border-blue-500/50 animate-pulse' : 
                                        activeSinger.status === 'results' ? 'bg-gray-800 text-gray-400 border-gray-600' :
                                        'bg-[#ff2d78]/20 text-[#ff2d78] border-[#ff2d78]/50'
                                    }`}>
                                        {activeSinger.status === 'voting' ? 'Voting Open!' : activeSinger.status === 'results' ? 'Performance Over' : 'On Stage Now'}
                                    </span>
                                    
                                    <h3 className="text-8xl md:text-[140px] font-['Bebas_Neue'] text-white tracking-widest mb-6 leading-none drop-shadow-2xl">{activeSinger.singer_name}</h3>
                                    
                                    {activeSinger.status === 'results' ? (
                                        <div className="mt-12 bg-black/60 inline-block px-16 py-8 rounded-3xl border border-blue-500/30">
                                            <p className="text-blue-400 text-8xl font-['Bebas_Neue'] tracking-widest">{activeSinger.total_points || activeSinger.score_performance || 0}</p>
                                            <p className="text-gray-500 text-xl font-bold uppercase tracking-widest mt-2">Points Earned</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-4xl font-bold text-gray-300 uppercase tracking-widest mb-2">{activeSinger.song_title}</p>
                                            <p className="text-2xl text-gray-500 uppercase tracking-widest">by {activeSinger.song_artist}</p>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="py-32">
                                <span className="text-8xl opacity-30 mb-8 block">🎤</span>
                                <p className="text-gray-600 font-bold uppercase tracking-widest text-4xl">Stage is Empty</p>
                            </div>
                        )}
                    </div>
                )}

                {currentView === 'qr' && (
                    <div className="animate-fade-in max-w-3xl mx-auto w-full text-center">
                        <h2 className="text-6xl font-['Bebas_Neue'] text-[#ff2d78] tracking-widest mb-4">WANT TO SING?</h2>
                        <p className="text-gray-400 text-2xl font-bold uppercase tracking-widest mb-12">Scan to enter the queue directly from your phone!</p>
                        
                        <div className="inline-block bg-white p-12 rounded-[3rem] shadow-[0_0_50px_rgba(255,45,120,0.3)] border-4 border-white/20">
                            <QRCode value={`${window.location.origin}/?join=${session?.id}`} size={350} />
                        </div>
                        
                        <p className="text-gray-500 text-xl font-bold uppercase tracking-widest mt-12">No App Download Required</p>
                    </div>
                )}
            </div>
        </div>
    )
}