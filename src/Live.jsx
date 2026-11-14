import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'
import KSocialHost from './KSocialHost'
import KSocialUser from './KSocialUser'
import KCrawlManager from './KCrawlManager'

export default function Live({ currentUser, onViewEntity, forceJoinId = null, forceGuest = false }) {
    // --- KSocial State ---
    const [activeSessions, setActiveSessions] = useState([])
    const [joinedSessionId, setJoinedSessionId] = useState(() => {
        if (forceJoinId) return forceJoinId
        const urlJoin = new URLSearchParams(window.location.search).get('join')
        return urlJoin || localStorage.getItem('bhnl_joined_session') || null
    })
    const [roomCodeInput, setRoomCodeInput] = useState('')
    const [joiningByCode, setJoiningByCode] = useState(false)

    // --- Host State ---
    const [hostMode, setHostMode] = useState(() => localStorage.getItem('bhnl_host_mode') || null)
    const [existingSession, setExistingSession] = useState(null)

    useEffect(() => {
        if (forceJoinId) {
            setJoinedSessionId(forceJoinId)
        }
    }, [forceJoinId])

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
            if (!forceGuest) {
                window.history.replaceState({}, '', window.location.pathname + '?tab=KSocial')
            }
        }
    }, [forceGuest])

    useEffect(() => {
        fetchActiveSessions()
        const sub = supabase
            .channel('public-sessions')
            .on('postgres', { event: '*', schema: 'public', table: 'active_sessions' }, fetchActiveSessions)
            .subscribe()
        return () => supabase.removeChannel(sub)
    }, [])

    useEffect(() => {
        if (currentUser && currentUser.account_type !== 'Regular') {
            supabase
                .from('active_sessions')
                .select('*')
                .eq('host_id', currentUser.id)
                .maybeSingle()
                .then(({ data }) => setExistingSession(data))
        }
    }, [currentUser])

    const fetchActiveSessions = async () => {
        const { data } = await supabase.from('active_sessions').select('*')
        const activeList = (data || []).filter(s => s.is_active !== false && s.status !== 'completed')
        setActiveSessions(activeList)

        // If a user's joined session was closed/reset, return them to the default stage list
        setJoinedSessionId(prevId => {
            if (prevId && activeList.length > 0 && !activeList.some(s => String(s.id) === String(prevId))) {
                localStorage.removeItem('bhnl_joined_session')
                return null
            }
            return prevId
        })

        // If a host's existing session was closed/reset by Admin, return them to the default view
        setExistingSession(prevSess => {
            if (prevSess && !activeList.some(s => String(s.id) === String(prevSess.id))) {
                localStorage.removeItem('bhnl_host_mode')
                setHostMode(null)
                return null
            }
            return prevSess
        })
    }

    const handleJoin = (sessionId, stageTitle) => {
        if (window.confirm(`Join "${stageTitle || 'Live Stage'}"?`)) {
            setJoinedSessionId(sessionId)
        }
    }

    const handleJoinByRoomCode = async (e) => {
        e.preventDefault()
        const cleanCode = roomCodeInput.trim().toUpperCase()
        if (!cleanCode) return

        setJoiningByCode(true)
        const localMatch = activeSessions.find(
            s => (s.session_code || '').toUpperCase() === cleanCode
        )
        if (localMatch) {
            setRoomCodeInput('')
            setJoiningByCode(false)
            setJoinedSessionId(localMatch.id)
            toast.success(`Joined ${localMatch.title || localMatch.session_title || 'Stage'}!`)
            return
        }

        const { data: remoteMatch } = await supabase
            .from('active_sessions')
            .select('*')
            .ilike('session_code', cleanCode)
            .maybeSingle()

        setJoiningByCode(false)
        if (remoteMatch && remoteMatch.status !== 'completed') {
            setRoomCodeInput('')
            setJoinedSessionId(remoteMatch.id)
            toast.success(`Joined ${remoteMatch.title || remoteMatch.session_title || 'Stage'}!`)
        } else {
            toast.error(`No active stage found with Room Code "${cleanCode}".`)
        }
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in pb-32 px-4 pt-6">
            <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-wider drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] mb-6">
                KSOCIAL STAGE
            </h2>

            <div className="space-y-6">
                {joinedSessionId ? (
                    <KSocialUser
                        currentUser={currentUser}
                        sessionId={joinedSessionId}
                        onExit={() => {
                            localStorage.removeItem('bhnl_joined_session')
                            setJoinedSessionId(null)
                            if (forceGuest) {
                                window.location.href = '/?tab=KSocial'
                            }
                        }}
                    />
                ) : hostMode === 'crawl' ? (
                    <KCrawlManager
                        session={{ user: currentUser }}
                        onExit={() => setHostMode(null)}
                    />
                ) : hostMode || existingSession ? (
                    <KSocialHost
                        currentUser={currentUser}
                        mode={existingSession ? (existingSession.session_type || existingSession.mode) : hostMode}
                        onExit={() => {
                            setHostMode(null)
                            setExistingSession(null)
                            fetchActiveSessions()
                        }}
                    />
                ) : (
                    <div className="max-w-md mx-auto animate-fade-in space-y-6">
                        <div className="text-center mb-4">
                            <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                Live Stages
                            </h2>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">
                                Enter a Room Code or select an active stage below
                            </p>
                        </div>

                        {/* Room Code Quick-Join Input */}
                        <form
                            onSubmit={handleJoinByRoomCode}
                            className="bg-[#090812] border border-blue-500/30 p-3.5 rounded-2xl flex items-center gap-2.5 shadow-[0_0_20px_rgba(59,130,246,0.12)]"
                        >
                            <input
                                type="text"
                                maxLength={8}
                                value={roomCodeInput}
                                onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                                placeholder="ENTER ROOM CODE (E.G. A8F3K2)"
                                className="flex-1 bg-black border border-gray-800 focus:border-blue-500 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest outline-none placeholder:text-gray-600"
                            />
                            <button
                                type="submit"
                                disabled={joiningByCode || !roomCodeInput.trim()}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex-shrink-0"
                            >
                                {joiningByCode ? '...' : 'Join'}
                            </button>
                        </form>

                        {/* List Active Sessions for Users to Join */}
                        {activeSessions.length === 0 ? (
                            <div className="text-center p-8 bg-black/40 border border-gray-800 rounded-3xl">
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                                    No active stages right now.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {activeSessions.map(session => {
                                    const stageTitle = session.title || session.session_title || 'KSocial LIVE!'
                                    const stageMode = session.session_type || 'Casual'
                                    return (
                                        <button
                                            key={session.id}
                                            onClick={() => handleJoin(session.id, stageTitle)}
                                            className="w-full bg-[#090812] border-2 border-[#00f5ff]/30 p-4 rounded-2xl flex justify-between items-center hover:scale-[1.02] hover:border-[#00f5ff] transition-all shadow-[0_0_15px_rgba(0,245,255,0.1)] group"
                                        >
                                            <div className="text-left min-w-0 pr-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                                        {stageMode}
                                                    </span>
                                                    {session.session_code && (
                                                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                                                            Code: {session.session_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-white font-bold text-lg leading-tight group-hover:text-[#00f5ff] transition-colors truncate">
                                                    {stageTitle}
                                                </h4>
                                                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-1 truncate">
                                                    📍 {session.venue_name || 'Casual Stage'}
                                                    {session.host_name ? ` • Host: ${session.host_name}` : ''}
                                                </p>
                                            </div>
                                            <span className="bg-[#00f5ff]/20 text-[#00f5ff] px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest flex-shrink-0">
                                                Join
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* HOST & ADMIN COMMANDS */}
                        {['Host', 'Admin'].includes(currentUser?.account_type) && (
                            <div className="mt-12 pt-8 border-t border-gray-800">
                                <div className="bg-purple-900/10 border border-purple-500/30 p-6 rounded-3xl text-center">
                                    <h3 className="text-purple-400 text-sm font-bold uppercase tracking-widest mb-4">
                                        Host Commands
                                    </h3>

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

                                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-4">
                                        Select a mode to initialize your stage.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
