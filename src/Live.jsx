import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import KSocialHost from './KSocialHost'
import KSocialUser from './KSocialUser'
import Map from './Map'
import Shop from './Shop'

export default function Live({ currentUser, onViewEntity }) {
    const [activeMiniPage, setActiveMiniPage] = useState('KSocial')

    // --- KSocial State ---
    const [activeSessions, setActiveSessions] = useState([])
    const [joinedSessionId, setJoinedSessionId] = useState(() => localStorage.getItem('bhnl_joined_session') || null)
    
    // --- Host State ---
    const [hostMode, setHostMode] = useState(null) 
    const [existingSession, setExistingSession] = useState(null)

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
            localStorage.setItem('bhnl_joined_session', sessionId)
            setJoinedSessionId(sessionId)
        }
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in pb-32">
            <div className="p-4 pt-6 sticky top-[68px] sm:top-[76px] bg-[#030712]/95 backdrop-blur-xl z-40 border-b border-gray-800 shadow-xl">
                <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                    {activeMiniPage === 'KSocial' && 'KSOCIAL STAGE'}
                    {activeMiniPage === 'Map' && 'NIGHTLIFE MAP'}
                    {activeMiniPage === 'Shop' && 'REWARDS SHOP'}
                </h2>
                
                <div className="flex gap-2 mt-4 bg-gray-900 p-1.5 rounded-xl border border-gray-800 shadow-inner">
                    {['KSocial', 'Map', 'Shop'].map(tab => (
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

            <div className="p-4 mt-2">
                {activeMiniPage === 'Map' && <Map currentUser={currentUser} onViewEntity={onViewEntity} />}
                {activeMiniPage === 'Shop' && <Shop currentUser={currentUser} />}
                
                {activeMiniPage === 'KSocial' && (
                    <div className="space-y-6">
                        {joinedSessionId ? (
                            <KSocialUser currentUser={currentUser} sessionId={joinedSessionId} onExit={() => { localStorage.removeItem('bhnl_joined_session'); setJoinedSessionId(null); }} />
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

                                {/* 🟢 THE ADMIN LOCKDOWN: Only Admins can see and launch sessions */}
                                {currentUser?.account_type === 'Admin' && (
                                    <div className="mt-12 pt-8 border-t border-gray-800">
                                        <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-3xl text-center">
                                            <h3 className="text-purple-400 text-sm font-bold uppercase tracking-widest mb-4">Admin Command</h3>
                                            <button 
                                                onClick={() => setHostMode('league')} // Directly launches the KSocialHost component
                                                className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-colors shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                                            >
                                                🎙️ Launch League Stage
                                            </button>
                                            <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-3">Karaoke Crawl Master Hub must be launched from the Admin Console.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}