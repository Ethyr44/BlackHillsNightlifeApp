import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Projector() {
    const [session, setSession] = useState(null)
    const [singers, setSingers] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        // 1. Grab the Session ID from the URL (e.g. /?tab=Projector&session=1234)
        const params = new URLSearchParams(window.location.search)
        const sessionId = params.get('session')

        if (!sessionId) {
            setError("No session ID provided in the URL.")
            setIsLoading(false)
            return
        }

        const fetchAll = async () => {
            const { data: sessData } = await supabase.from('active_sessions').select('*').eq('id', sessionId).single()
            if (sessData) setSession(sessData)

            const { data: singerData } = await supabase.from('session_singers')
                .select('*')
                .eq('session_id', sessionId)
                .order('total_points', { ascending: false })
            if (singerData) setSingers(singerData)

            setIsLoading(false)
        }

        fetchAll()

        // 2. The Real-Time Listener (Watches the Queue)
        const queueSub = supabase.channel('projector-queue')
            .on('postgres', {
                event: '*',
                schema: 'public',
                table: 'session_singers',
                filter: `session_id=eq.${sessionId}`
            }, () => {
                // If anything changes, re-fetch the sorted list
                supabase.from('session_singers')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('total_points', { ascending: false })
                    .then(({ data }) => { if (data) setSingers(data) })
            })
            .subscribe()
            
        // 3. The Real-Time Listener (Watches the Session for title changes/ending)
        const sessionSub = supabase.channel('projector-session')
            .on('postgres', {
                event: '*',
                schema: 'public',
                table: 'active_sessions',
                filter: `id=eq.${sessionId}`
            }, (payload) => {
                if (payload.eventType === 'DELETE') {
                    setError("This session has ended.")
                } else {
                    setSession(payload.new)
                }
            })
            .subscribe()

        // THE FIX: Fallback polling every 20 seconds to guarantee updates
        const pollInterval = setInterval(() => {
            supabase.from('session_singers')
                .select('*')
                .eq('session_id', sessionId)
                .order('total_points', { ascending: false })
                .then(({ data }) => { if (data) setSingers(data) })
        }, 4000)

        return () => {
            supabase.removeChannel(queueSub)
            supabase.removeChannel(sessionSub)
            clearInterval(pollInterval)
        }
    }, [])

    if (error) return <div className="h-screen bg-[#090812] flex items-center justify-center"><h1 className="text-4xl text-red-500 font-['Bebas_Neue'] tracking-widest">{error}</h1></div>
    if (isLoading || !session) return <div className="h-screen bg-[#090812] flex items-center justify-center"><div className="w-20 h-20 border-8 border-[#00f5ff] border-t-transparent rounded-full animate-spin"></div></div>

    // Find if someone is currently singing
    const activeSinger = singers.find(s => s.status === 'singing')

    return (
        <div className="min-h-screen bg-[#090812] text-white p-8 animate-fade-in relative overflow-hidden flex flex-col">
            
            {/* The Background Grid Pattern */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            {/* HEADER */}
            <div className="relative z-10 text-center mb-12 flex-shrink-0">
                <h1 className="text-7xl md:text-9xl font-['Bebas_Neue'] text-[#ff2d78] tracking-widest drop-shadow-[0_0_20px_rgba(255,45,120,0.6)] mb-2 uppercase">
                    {session.session_title}
                </h1>
                <p className="text-2xl md:text-4xl text-[#00f5ff] tracking-[0.2em] uppercase font-bold drop-shadow-[0_0_10px_rgba(0,245,255,0.4)]">
                    {session.venue_name || 'Live Karaoke Leaderboard'}
                </p>
                <p className="text-gray-400 mt-2 text-xl tracking-widest uppercase">Hosted by {session.host_name}</p>
            </div>

            {/* LIVE SINGER SPOTLIGHT */}
            {activeSinger && (
                <div className="relative z-10 bg-[#ff2d78]/10 border-2 border-[#ff2d78] rounded-3xl p-8 mb-12 text-center shadow-[0_0_50px_rgba(255,45,120,0.3)] animate-pulse flex-shrink-0">
                    <div className="inline-block bg-[#ff2d78] text-white px-6 py-2 rounded-full text-xl font-bold uppercase tracking-widest mb-4">
                        ● LIVE ON STAGE
                    </div>
                    <h2 className="text-6xl md:text-8xl font-['Bebas_Neue'] text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">
                        {activeSinger.name}
                    </h2>
                </div>
            )}

            {/* THE LEADERBOARD */}
            <div className="relative z-10 flex-1 overflow-hidden flex flex-col">
                <h3 className="text-4xl font-['Bebas_Neue'] text-yellow-400 tracking-widest mb-6 text-center drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">🏆 CURRENT RANKINGS</h3>
                
                {singers.length === 0 ? (
                    <div className="text-center text-gray-500 text-3xl font-bold tracking-widest uppercase mt-20">Waiting for singers to join...</div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-max overflow-y-auto hide-scrollbar pb-10">
                        {singers.map((singer, index) => {
                            const isLive = singer.status === 'singing'
                            return (
                                <div key={singer.id} className={`bg-gray-900/80 backdrop-blur-sm border-2 ${isLive ? 'border-[#00f5ff] shadow-[0_0_30px_rgba(0,245,255,0.4)]' : 'border-gray-800'} rounded-3xl p-6 flex items-center justify-between transition-all duration-500`}>
                                    
                                    <div className="flex items-center gap-6 overflow-hidden">
                                        <div className={`flex-shrink-0 w-16 h-16 rounded-full border-2 flex items-center justify-center font-['Bebas_Neue'] text-4xl shadow-lg ${index === 0 ? 'bg-yellow-500/20 border-yellow-400 text-yellow-400 shadow-yellow-400/50' : index === 1 ? 'bg-gray-400/20 border-gray-300 text-gray-300 shadow-gray-300/50' : index === 2 ? 'bg-amber-700/20 border-amber-600 text-amber-500 shadow-amber-600/50' : 'bg-white/5 border-gray-600 text-gray-500'}`}>
                                            {index + 1}
                                        </div>
                                        <h4 className="font-bold text-white text-3xl md:text-4xl truncate tracking-wide">
                                            {singer.name}
                                        </h4>
                                    </div>

                                    <div className="text-right pl-4 flex-shrink-0">
                                        <span className={`block font-['Bebas_Neue'] text-5xl md:text-6xl ${isLive ? 'text-[#00f5ff] drop-shadow-[0_0_10px_rgba(0,245,255,0.8)]' : 'text-white'}`}>
                                            {singer.total_points}
                                        </span>
                                        <span className="block text-sm uppercase text-gray-500 font-bold tracking-widest mt-1">Points</span>
                                    </div>

                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}