import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import KSocialHost from './KSocialHost'
import KSocialUser from './KSocialUser'
import KCrawlManager from './KCrawlManager'

export default function Live({ currentUser, onViewEntity }) {
    // --- KSocial State ---
    const [activeSessions, setActiveSessions] = useState([])
    const [joinedSessionId, setJoinedSessionId] = useState(() => localStorage.getItem('bhnl_joined_session') || null)
    
    // --- Host State ---
    const [hostMode, setHostMode] = useState(() => localStorage.getItem('bhnl_host_mode') || null) 
    const [existingSession, setExistingSession] = useState(null)

    useEffect(() => {
        if (joinedSessionId) localStorage.setItem('bhnl_joined_session', joinedSessionId)
        else localStorage.removeItem('bhnl_joined_session')
    }, [joinedSessionId])

    useEffect(() => {
        if (hostMode) localStorage.setItem('bhnl_host_mode', hostMode)
        else localStorage.removeItem('bhnl_host_mode')
    }, [hostMode])

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const joinId = params.get('join')
        if (joinId) {
            setJoinedSessionId(joinId)
            window.history.replaceState({}, '', window.location.pathname + '?tab=Live')
        }
    }, [])

    useEffect(() => {
        fetchActiveSessions()
        const sub = supabase.channel('public-sessions').on('postgres', { event: '*', schema: 'public', table: 'active_sessions' }, fetchActiveSessions).subscribe()
        return () => supabase.removeChannel(sub)
    }, [])

    useEffect(() => {
        if (currentUser && currentUser.account_type !== 'Regular') {
            supabase.from('active_sessions').select('*').eq('host_id', currentUser.id).maybeSingle().then(({ data }) => setExistingSession(data))
        }
    }, [currentUser])

    const fetchActiveSessions = async () => {
        const { data } = await supabase.from('active_sessions').select('*').eq('is_active', true)
        if (data) setActiveSessions(data)
    }

    const handleJoin = (sessionId, hostName) => {
        if (window.confirm(`Join ${hostName}'s Session?`)) {
            setJoinedSessionId(sessionId)
        }
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in pb-32 px-4 pt-6">
            <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-6">
                KSOCIAL STAGE
            </h2>

            <div className="space-y-6">
                {joinedSessionId ? (
                    <KSocialUser currentUser={currentUser} sessionId={joinedSessionId} onExit={() => setJoinedSessionId(null)} />
                ) : hostMode === 'crawl' ? (
                    <KCrawlManager session={{ user: currentUser }} />
                ) : hostMode || existingSession ? (
                    <KSocialHost currentUser={currentUser} mode={existingSession ? existingSession.mode : hostMode} onExit={() => {setHostMode(null); setExistingSession(null); fetchActiveSessions()}} />
                ) : (
                    <div className="max-w-md mx-auto animate-fade-in space-y-6">
                        <div className="text-center mb-8">
                            <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">Live Stages</h2>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2">Join an active session below</p>
                        </div>

                        {/* List Active Sessions for Users to Join */}
                        {activeSessions.length === 0 ? (
                            <div className="text-center p-8 bg-black/40 border border-gray-800 rounded-3xl">
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No active stages right now.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activeSessions.map(session => (
                                    <button 
                                        key={session.id} 
                                        onClick={() => handleJoin(session.id, session.host_name)}
                                        className="w-full bg-[#090812] border-2 border-[#00f5ff]/30 p-4 rounded-2xl flex justify-between items-center hover:scale-[1.02] hover:border-[#00f5ff] transition-all shadow-[0_0_15px_rgba(0,245,255,0.1)] group"
                                    >
                                        <div className="text-left">
                                            <h4 className="text-white font-bold text-lg leading-tight group-hover:text-[#00f5ff] transition-colors">{session.session_title}</h4>
                                            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1">📍 {session.venue_name}</p>
                                        </div>
                                        <span className="bg-[#00f5ff]/20 text-[#00f5ff] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest">Join</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* HOST & ADMIN COMMANDS */}
                        {['Host', 'Admin'].includes(currentUser?.account_type) && (
                            <div className="mt-12 pt-8 border-t border-gray-800">
                                <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-3xl text-center">
                                    <h3 className="text-purple-400 text-sm font-bold uppercase tracking-widest mb-4">Host Commands</h3>
                                    
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <button 
                                            onClick={() => setHostMode('casual')} 
                                            className="w-full bg-gray-900 border border-gray-700 hover:bg-gray-800 text-gray-300 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
                                        >
                                            🍹 Casual Stage
                                        </button>
                                        <button 
                                            onClick={() => setHostMode('league')} 
                                            className="w-full bg-blue-900/30 border border-blue-500/50 hover:bg-blue-600 text-blue-400 hover:text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
                                        >
                                            🏆 League Stage
                                        </button>
                                    </div>

                                    {/* ONLY ADMINS CAN LAUNCH THE CRAWL */}
                                    {currentUser?.account_type === 'Admin' && (
                                        <button 
                                            onClick={() => setHostMode('crawl')} 
                                            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                                        >
                                            🗺️ Karaoke Crawl Hub
                                        </button>
                                    )}
                                    
                                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-4">Select a mode to initialize your stage.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}