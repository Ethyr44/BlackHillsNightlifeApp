import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import KSocialHost from './KSocialHost'
import KSocialUser from './KSocialUser'

export default function Live({ currentUser }) {
    const [activeSessions, setActiveSessions] = useState([])
    const [isScanning, setIsScanning] = useState(false)
    const [scanComplete, setScanComplete] = useState(false)

    // THE FIX: Remember the Audience Room on refresh!
    const [joinedSessionId, setJoinedSessionId] = useState(() => localStorage.getItem('bhnl_joined_session') || null)

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

    // KSocial Hosting State
    const [hostMode, setHostMode] = useState(null) // null, 'casual', or 'league'
    const [showPinPrompt, setShowPinPrompt] = useState(false)
    const [pinCode, setPinCode] = useState('')
    
    // THE FIX: State to track if they already have a running session
    const [existingSession, setExistingSession] = useState(null)

    // THE FIX: Check the database on load to see if they are currently hosting
    useEffect(() => {
        const checkMySession = async () => {
            if (!currentUser) return
            const { data } = await supabase.from('active_sessions')
                .select('*')
                .eq('host_id', currentUser.id)
                .maybeSingle()
            
            setExistingSession(data || null)
        }
        checkMySession()
    }, [currentUser, hostMode]) // Re-runs when they close KSocialHost so the button updates

    const scanForSessions = async () => {
        setIsScanning(true)
        setScanComplete(false)
        
        setTimeout(async () => {
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
            const { data, error } = await supabase.from('active_sessions').select('*').gte('created_at', twelveHoursAgo).order('created_at', { ascending: false })

            if (data) {
                const uniqueSessions = []
                const seenHosts = new Set()
                data.forEach(sess => {
                    if (!seenHosts.has(sess.host_name)) {
                        seenHosts.add(sess.host_name)
                        uniqueSessions.push(sess)
                    }
                })
                setActiveSessions(uniqueSessions)
            }
            setIsScanning(false)
            setScanComplete(true)
        }, 1500)
    }

    const verifyPin = () => {
        if (pinCode === '1992') {
            setShowPinPrompt(false)
            setHostMode('league')
            setPinCode('')
        } else {
            alert('Incorrect Host PIN.')
            setPinCode('')
        }
    }

    // If they activated KSocial, completely hijack this view and show the KSocial UI
    if (hostMode) {
        return <KSocialHost currentUser={currentUser} mode={hostMode} onExit={() => setHostMode(null)} />
    }

    // If they joined a session as a user, hijack the view!
    if (joinedSessionId) {
        return <KSocialUser currentUser={currentUser} sessionId={joinedSessionId} onExit={handleExitAudience} />
    }

    return (
        <div className="p-4 space-y-8 animate-fade-in pb-32">
            
            {/* 1. SEEKER SECTION */}
            <div>
                <div className="flex justify-between items-end border-b border-gray-800 pb-2 mb-6">
                    <h2 className="text-4xl font-['Bebas_Neue'] text-blue-400 tracking-wider">LIVE SESSIONS</h2>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Local Network</span>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 text-center shadow-xl">
                    <div className={`text-6xl mb-4 ${isScanning ? 'animate-spin' : 'animate-pulse'}`}>📡</div>
                    <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-2">Find Local DJs</h3>
                    <p className="text-xs text-gray-400 mb-6">Connect to the venue's Wi-Fi to join the Karaoke queue instantly.</p>
                    
                    <button onClick={scanForSessions} disabled={isScanning} className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all ${isScanning ? 'bg-blue-900/50 text-blue-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]'}`}>
                        {isScanning ? 'Scanning Network...' : 'Scan for Sessions Near Me'}
                    </button>
                </div>

                {scanComplete && activeSessions.length === 0 && (
                    <div className="text-center p-6 border border-dashed border-gray-700 rounded-xl mt-4">
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">No active sessions found.</p>
                    </div>
                )}

                {scanComplete && activeSessions.length > 0 && (
                    <div className="space-y-4 mt-4">
                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Discovered Hosts</h4>
                        {activeSessions.map(sess => (
                            <div key={sess.id} className="bg-blue-900/10 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg hover:border-blue-500/60 transition-colors">
                                <div>
                                    <h4 className="font-bold text-white text-lg">{sess.host_name}</h4>
                                    <p className="text-gray-400 text-xs">📍 {sess.venue_name}</p>
                                </div>
                                <button onClick={() => handleJoin(sess.id, sess.host_name)} className="bg-blue-600 text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]">Join</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. HOSTING SECTION */}
            <div>
                <div className="flex justify-between items-end border-b border-gray-800 pb-2 mb-6 mt-10">
                    <h2 className="text-4xl font-['Bebas_Neue'] text-[#ff2d78] tracking-wider drop-shadow-[0_0_10px_rgba(255,45,120,0.5)]">KSocial HOST</h2>
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Broadcaster</span>
                </div>

                <div className="space-y-4">
                    {/* THE FIX: Show "Return to Session" OR the Launch buttons */}
                    {existingSession ? (
                        <div className="bg-[#ff2d78]/10 border border-[#ff2d78] rounded-2xl p-6 text-center shadow-[0_0_30px_rgba(255,45,120,0.2)] animate-pulse">
                            <h3 className="text-white font-bold tracking-widest uppercase text-sm mb-1">Session Active</h3>
                            <p className="text-gray-400 text-[10px] uppercase tracking-widest mb-4">You are currently broadcasting.</p>
                            <button onClick={() => setHostMode(existingSession.mode)} className="w-full bg-[#ff2d78] hover:bg-[#ff1562] text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-all shadow-[0_0_20px_rgba(255,45,120,0.5)]">
                                ▶ Return to Dashboard
                            </button>
                        </div>
                    ) : (
                        <>
                            <button onClick={() => setHostMode('casual')} className="w-full bg-[#090812] border border-[#ff2d78]/50 text-[#ff2d78] hover:bg-[#ff2d78]/10 py-5 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex flex-col items-center justify-center gap-1">
                                <span className="text-2xl">🎉</span>
                                Launch Casual Session
                            </button>

                            <button onClick={() => setShowPinPrompt(true)} className="w-full bg-[#090812] border border-[#00f5ff]/50 text-[#00f5ff] hover:bg-[#00f5ff]/10 py-5 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all flex flex-col items-center justify-center gap-1">
                                <span className="text-2xl">🏆</span>
                                Launch League Session
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* PIN PROMPT MODAL */}
            {showPinPrompt && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
                    <div className="bg-[#090812] border border-gray-700 rounded-3xl p-8 w-full max-w-sm text-center shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                        <div className="text-4xl mb-4">🔒</div>
                        <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-2 text-[#00f5ff]">League Access</h3>
                        <p className="text-gray-400 text-xs mb-6 uppercase tracking-widest">Enter Host PIN to launch tournament mode.</p>
                        
                        <input 
                            type="password" 
                            value={pinCode} 
                            onChange={e => setPinCode(e.target.value)} 
                            placeholder="****" 
                            className="w-full bg-black border border-gray-700 text-white text-center text-2xl tracking-[1em] rounded-xl p-4 focus:border-[#00f5ff] outline-none mb-6 font-mono"
                            maxLength={4}
                        />

                        <div className="flex gap-3">
                            <button onClick={() => {setShowPinPrompt(false); setPinCode('');}} className="flex-1 border border-gray-700 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white py-3">Cancel</button>
                            <button onClick={verifyPin} className="flex-1 bg-[#00f5ff] text-black rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#00d5dd] shadow-[0_0_15px_rgba(0,245,255,0.4)] py-3">Verify</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}