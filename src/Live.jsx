import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import KSocialHost from './KSocialHost'
import KSocialUser from './KSocialUser'
import Map from './Map'
import Shop from './Shop'

export default function Live({ currentUser, onViewEntity }) {
    const [activeMiniPage, setActiveMiniPage] = useState('KSocial') // 'KSocial', 'Map', 'Shop'

    // --- NEW: UNIVERSAL KSOCIAL AUTH ---
    const [kSocialAuth, setKSocialAuth] = useState(() => localStorage.getItem('bhnl_ksocial_auth') === 'true')
    const [hubPin, setHubPin] = useState('')

    // --- EXISTING KSOCIAL STATE ---
    const [activeSessions, setActiveSessions] = useState([])
    const [isScanning, setIsScanning] = useState(false)
    const [joinedSessionId, setJoinedSessionId] = useState(() => localStorage.getItem('bhnl_joined_session') || null)
    const [hostMode, setHostMode] = useState(null) 
    const [showPinPrompt, setShowPinPrompt] = useState(false)
    const [pinCode, setPinCode] = useState('')
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

    const handleExitAudience = () => {
        localStorage.removeItem('bhnl_joined_session')
        setJoinedSessionId(null)
    }

    const verifyLeaguePin = () => {
        if (pinCode === '1144') {
            setHostMode('league')
            setShowPinPrompt(false)
            setPinCode('')
        } else {
            alert('Incorrect PIN')
            setPinCode('')
        }
    }

    const unlockKSocial = () => {
        if (hubPin === '1117') {
            localStorage.setItem('bhnl_ksocial_auth', 'true')
            setKSocialAuth(true)
        } else {
            alert('Incorrect PIN')
            setHubPin('')
        }
    }

    return (
        <div className="max-w-2xl mx-auto animate-fade-in pb-32">
            {/* THE LIVE HUB HEADER */}
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

            {/* MINI-PAGE RENDERING */}
            <div className="p-4 mt-2">
                {activeMiniPage === 'Map' && <Map currentUser={currentUser} onViewEntity={onViewEntity} />}
                {activeMiniPage === 'Shop' && <Shop currentUser={currentUser} />}
                
                {activeMiniPage === 'KSocial' && (
                    !kSocialAuth ? (
                        <div className="bg-[#090812] border-2 border-blue-900/30 rounded-3xl p-8 shadow-lg text-center mt-8 max-w-sm mx-auto animate-slide-up-fast">
                            <div className="text-5xl mb-4">🔒</div>
                            <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest text-white mb-2">KSocial Access</h3>
                            <p className="text-gray-400 text-xs mb-6 uppercase tracking-widest">Enter the PIN to unlock Casual KSocial.</p>
                            
                            <input 
                                id="ksocial-pin"
                                name="ksocial-pin"
                                autoComplete="off"
                                type="password" 
                                value={hubPin} 
                                onChange={e => setHubPin(e.target.value)} 
                                placeholder="****" 
                                className="w-full bg-black border border-gray-700 text-white text-center text-2xl tracking-[1em] rounded-xl p-4 focus:border-blue-500 outline-none mb-6 font-mono"
                                maxLength={4}
                            />

                            <button 
                                onClick={unlockKSocial}
                                className="w-full bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] py-4 transition-all"
                            >
                                Unlock Access
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {joinedSessionId ? (
                                <KSocialUser currentUser={currentUser} sessionId={joinedSessionId} onExit={handleExitAudience} />
                            ) : hostMode || existingSession ? (
                                <KSocialHost currentUser={currentUser} mode={existingSession ? existingSession.mode : hostMode} onExit={() => {setHostMode(null); setExistingSession(null); fetchActiveSessions()}} />
                            ) : (
                                <>
                                    {/* JOIN A SESSION */}
                                    <div className="bg-[#090812] border-2 border-blue-900/30 rounded-3xl p-6 shadow-lg">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest">Active Stages</h3>
                                            <button onClick={fetchActiveSessions} className="text-blue-400 hover:text-white text-xs font-bold uppercase tracking-widest bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors">🔄 Refresh</button>
                                        </div>
                                        <div className="space-y-3">
                                            {activeSessions.length === 0 ? (
                                                <div className="text-center py-8 bg-black/50 rounded-2xl border border-gray-800">
                                                    <div className="text-3xl mb-2 opacity-50">📭</div>
                                                    <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">No active sessions nearby.</p>
                                                </div>
                                            ) : (
                                                activeSessions.map(session => (
                                                    <div key={session.id} className="bg-black/60 p-4 rounded-2xl border border-gray-800 flex justify-between items-center hover:border-blue-500/50 transition-colors group">
                                                        <div>
                                                            <h4 className="text-white font-bold text-lg mb-1">{session.session_title}</h4>
                                                            <p className="text-xs text-gray-500 uppercase tracking-widest font-bold flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                                Hosted by {session.host_name}
                                                            </p>
                                                        </div>
                                                        <button onClick={() => handleJoin(session.id, session.host_name)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] group-hover:scale-105">
                                                            Join
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* HOST CONTROLS */}
                                    {currentUser?.account_type !== 'Regular' && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <button onClick={() => setHostMode('casual')} className="bg-[#090812] border border-[#b347ff]/30 hover:border-[#b347ff] p-6 rounded-3xl flex flex-col items-center justify-center text-center transition-all group hover:shadow-[0_0_30px_rgba(179,71,255,0.2)]">
                                                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🎤</div>
                                                <h3 className="text-2xl font-['Bebas_Neue'] text-[#b347ff] tracking-widest mb-1">Casual Mode</h3>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Standard Queue & Requests</p>
                                            </button>
                                            <button onClick={() => setShowPinPrompt(true)} className="bg-[#090812] border border-[#00f5ff]/30 hover:border-[#00f5ff] p-6 rounded-3xl flex flex-col items-center justify-center text-center transition-all group hover:shadow-[0_0_30px_rgba(0,245,255,0.2)]">
                                                <div className="text-5xl mb-3 group-hover:scale-110 transition-transform">🏆</div>
                                                <h3 className="text-2xl font-['Bebas_Neue'] text-[#00f5ff] tracking-widest mb-1">League Mode</h3>
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Tournament & Supervotes</p>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )
                )}
            </div>

            {/* LEAGUE PIN MODAL */}
            {showPinPrompt && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 border-2 border-[#00f5ff] p-8 rounded-3xl w-full max-w-sm text-center shadow-[0_0_50px_rgba(0,245,255,0.2)] animate-slide-up-fast">
                        <div className="text-4xl mb-4">🏆</div>
                        <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-2 text-[#00f5ff]">League Access</h3>
                        <p className="text-gray-400 text-xs mb-6 uppercase tracking-widest">Enter Host PIN to launch tournament mode.</p>
                        
                        <input 
                            id="league-pin"
                            name="league-pin"
                            autoComplete="off"
                            type="password" 
                            value={pinCode} 
                            onChange={e => setPinCode(e.target.value)} 
                            placeholder="****" 
                            className="w-full bg-black border border-gray-700 text-white text-center text-2xl tracking-[1em] rounded-xl p-4 focus:border-[#00f5ff] outline-none mb-6 font-mono"
                            maxLength={4}
                        />

                        <div className="flex gap-3">
                            <button onClick={() => {setShowPinPrompt(false); setPinCode('');}} className="flex-1 border border-gray-700 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white py-3">Cancel</button>
                            <button onClick={verifyLeaguePin} className="flex-1 bg-[#00f5ff] text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#00d5dd] shadow-[0_0_15px_rgba(0,245,255,0.4)] py-3">Verify</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}