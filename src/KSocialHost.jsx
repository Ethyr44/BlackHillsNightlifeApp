import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import QRCode from 'react-qr-code' // We can use this because it's already in your package.json!

export default function KSocialHost({ currentUser, mode, onExit }) {
    const [view, setView] = useState('start_menu')
    const [activeSession, setActiveSession] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    
    const [showQR, setShowQR] = useState(false)

    // Session State
    const [sessionTitle, setSessionTitle] = useState('KSocial LIVE!')
    const [hostName, setHostName] = useState(currentUser.username)
    const [bizName, setBizName] = useState('Black Hills Nightlife')
    const [venueName, setVenueName] = useState('')

    // Queue State
    const [singers, setSingers] = useState([])

    // Session Settings State
    const [votingStyle, setVotingStyle] = useState('normal')
    const [votingIcon, setVotingIcon] = useState('star')
    const [supervotes, setSupervotes] = useState(1)

    // 1. THE PERSISTENCE CHECK
    useEffect(() => {
        const checkExistingSession = async () => {
            const { data } = await supabase.from('active_sessions')
                .select('*')
                .eq('host_id', currentUser.id)
                .single()
            
            if (data) {
                setActiveSession(data)
                fetchSingers(data.id)
                setView('dashboard')
            }
            setIsLoading(false)
        }
        checkExistingSession()
    }, [currentUser.id])

    // 2. REAL-TIME QUEUE LISTENER
    useEffect(() => {
        if (!activeSession) return

        fetchSingers(activeSession.id)

        const singerSub = supabase.channel('realtime-queue')
            .on('postgres', {
                event: '*',
                schema: 'public',
                table: 'session_singers',
                filter: `session_id=eq.${activeSession.id}`
            }, () => {
                fetchSingers(activeSession.id) 
            })
            .subscribe()

        // THE FIX: Fallback polling every 20 seconds to guarantee updates
        const pollInterval = setInterval(() => {
            fetchSingers(activeSession.id)
        }, 20000)

        return () => {
            supabase.removeChannel(singerSub)
            clearInterval(pollInterval)
        }
    }, [activeSession])

    const fetchSingers = async (sessionId) => {
        const { data } = await supabase.from('session_singers')
            .select('*')
            .eq('session_id', sessionId)
            .order('total_points', { ascending: false }) 
        
        if (data) setSingers(data)
    }

    // 3. CREATE A NEW SESSION
    const handleStartSession = async () => {
        const newSession = {
            host_id: currentUser.id,
            host_name: hostName,
            session_title: sessionTitle,
            venue_name: venueName,
            mode: mode,
            // NEW SETTINGS ADDED HERE:
            voting_style: votingStyle,
            voting_icon: votingIcon,
            supervotes: supervotes
        }

        const { data, error } = await supabase.from('active_sessions').insert([newSession]).select().single()
        
        if (error) {
            alert(`Supabase Error: ${error.message}`)
        } else if (data) {
            setActiveSession(data)
            setView('dashboard')
        }
    }

    // 4. END SESSION
    const handleEndSession = async () => {
        if (window.confirm("🛑 Are you sure you want to end this session? If this is a League Session, all points will be distributed now.")) {
            await supabase.rpc('close_ksocial_session', { target_session_id: activeSession.id })
            alert(activeSession.mode === 'league' ? "🏆 League Session Ended! Points have been paid out to the Leaderboards." : "Session Ended.")
            setActiveSession(null)
            setSingers([])
            onExit() 
        }
    }

    // ==========================================
    // NEW HOST CONTROLS
    // ==========================================

    const handleAddSinger = async () => {
        const name = window.prompt("🎤 Enter Singer's Name:")
        if (!name || name.trim() === '') return

        const newSinger = {
            session_id: activeSession.id,
            name: name.trim(),
            total_points: 0,
            status: 'waiting'
        }
        await supabase.from('session_singers').insert([newSinger])
    }

    const handleDeleteSinger = async (singerId, singerName) => {
        if (window.confirm(`🗑️ Remove ${singerName} from the queue?`)) {
            await supabase.from('session_singers').delete().eq('id', singerId)
        }
    }

    const handleEditSinger = async (singer) => {
        const newName = window.prompt("Edit Name:", singer.name)
        if (newName === null) return // Cancelled

        const newPts = window.prompt("Edit Points (Numbers Only):", singer.total_points)
        if (newPts === null) return // Cancelled

        await supabase.from('session_singers').update({ 
            name: newName.trim(), 
            total_points: parseInt(newPts) || 0 
        }).eq('id', singer.id)
    }

    const handleToggleLive = async (singer) => {
        if (singer.status === 'singing') {
            // Pause them
            await supabase.from('session_singers').update({ status: 'waiting' }).eq('id', singer.id)
        } else {
            // Play them (Safety Check: Pause everyone else in the room first!)
            await supabase.from('session_singers')
                .update({ status: 'waiting' })
                .eq('session_id', activeSession.id)
                .eq('status', 'singing')

            // Then set this specific singer to active
            await supabase.from('session_singers')
                .update({ status: 'singing' })
                .eq('id', singer.id)
        }
    }

    // ==========================================
    // RENDER LOGIC
    // ==========================================

    if (isLoading) return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-[#ff2d78] border-t-transparent rounded-full animate-spin"></div></div>

    if (view === 'start_menu') {
        return (
            <div className="max-w-md mx-auto p-8 text-center animate-fade-in pb-32">
                <h1 className="text-7xl font-['Bebas_Neue'] text-[#ff2d78] leading-none mb-2 drop-shadow-[0_0_15px_rgba(255,45,120,0.6)]">KSocial LIVE!</h1>
                <p className="text-gray-400 text-sm tracking-widest uppercase mb-10">Host Control Panel <span className="text-[#00f5ff]">({mode})</span></p>

                <div className="flex flex-col gap-3">
                    <button onClick={() => setView('new_session')} className="bg-[#00f5ff]/10 border border-[#00f5ff] text-[#00f5ff] p-4 rounded-xl text-lg font-bold shadow-[0_0_15px_rgba(0,245,255,0.2)] hover:bg-[#00f5ff]/20 transition-all">
                        🆕 Start New Session
                    </button>
                    <button className="bg-[#ffe94d]/10 border border-[#ffe94d] text-[#ffe94d] p-4 rounded-xl text-lg font-bold shadow-[0_0_15px_rgba(255,233,77,0.2)] hover:bg-[#ffe94d]/20 transition-all">
                        📂 Load Session
                    </button>
                    <button onClick={onExit} className="bg-transparent text-gray-500 p-3 mt-4 text-sm font-bold uppercase tracking-widest hover:text-white transition-all">
                        ← Back to App
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'new_session') {
        return (
            <div className="max-w-md mx-auto p-4 animate-fade-in pb-32">
                <h2 className="text-5xl font-['Bebas_Neue'] text-[#00f5ff] text-center mb-6 drop-shadow-[0_0_10px_rgba(0,245,255,0.6)]">New Session</h2>
                
                <div className="bg-[#090812] border border-gray-800 p-6 rounded-2xl shadow-2xl space-y-4">
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Session Title</label>
                        <input type="text" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Host / DJ Name</label>
                        <input type="text" value={hostName} onChange={e => setHostName(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none" />
                    </div>
                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Venue Name</label>
                        <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none" />
                    </div>

                    <select value={votingStyle} onChange={e => setVotingStyle(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none text-sm">
                        <option value="normal">Normal (1-5)</option>
                        <option value="tap">Tap to Vote (Mash)</option>
                    </select>
                    
                    <select value={votingIcon} onChange={e => setVotingIcon(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none text-sm">
                        <option value="star">⭐ Stars</option>
                        <option value="heart">❤️ Hearts</option>
                        <option value="bolt">⚡ Bolts</option>
                        <option value="thumb">👍 Thumbs</option>
                    </select>

                    <div>
                        <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Supervotes Per User</label>
                        <input type="number" value={supervotes} onChange={e => setSupervotes(parseInt(e.target.value) || 1)} min={1} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 focus:border-[#00f5ff] outline-none" />
                    </div>

                    <button onClick={handleStartSession} className="w-full bg-[#00f5ff] text-black font-bold uppercase tracking-widest py-4 rounded-xl mt-4 hover:bg-[#00d5dd] shadow-[0_0_20px_rgba(0,245,255,0.4)] transition-all">
                        Launch Session!
                    </button>
                    <button onClick={() => setView('start_menu')} className="w-full bg-transparent text-gray-500 font-bold uppercase tracking-widest py-3 rounded-xl mt-2 hover:text-white transition-all">
                        Cancel
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'dashboard' && activeSession) {
        // Check if ANY singer is currently live to disable other play buttons
        const isSomeoneLive = singers.some(s => s.status === 'singing')

        return (
            <div className="max-w-xl mx-auto p-4 animate-fade-in pb-32 mt-4">
                
                {/* 1. DASHBOARD HEADER */}
                <div className="bg-[#090812] border border-[#ff2d78]/50 p-6 rounded-3xl shadow-[0_0_30px_rgba(255,45,120,0.15)] text-center relative overflow-hidden mb-6">
                    <div className="absolute top-4 right-4 bg-[#ff2d78]/20 text-[#ff2d78] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#ff2d78]/50 animate-pulse">
                        Live Room
                    </div>
                    
                    <h2 className="text-5xl font-['Bebas_Neue'] text-white tracking-widest mb-2 mt-4">{activeSession.session_title}</h2>
                    <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-6">Host: {activeSession.host_name} • Mode: <span className={activeSession.mode === 'league' ? 'text-[#00f5ff]' : 'text-gray-300'}>{activeSession.mode}</span></p>
                    
                    <div className="flex gap-4 justify-center">
                        <button onClick={handleAddSinger} className="flex-1 bg-white/5 border border-gray-700 text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">
                            + Add Singer
                        </button>
                        <button onClick={handleEndSession} className="flex-1 bg-red-900/20 border border-red-500 text-red-500 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                            🛑 End Session
                        </button>
                    </div>

                    <div className="flex gap-2 justify-center mt-4">
                        <button onClick={() => setShowQR(true)} className="bg-[#ff2d78]/10 text-[#ff2d78] border border-[#ff2d78]/30 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#ff2d78]/30 transition-colors">
                            📱 Show QR
                        </button>
                        <button onClick={() => window.open(`/?tab=Projector&session=${activeSession.id}`, '_blank')} className="bg-[#00f5ff]/10 text-[#00f5ff] border border-[#00f5ff]/30 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#00f5ff]/30 transition-colors">
                            📺 Projector
                        </button>
                    </div>
                </div>

                {/* THE QR MODAL */}
                {showQR && (
                    <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="bg-[#090812] border border-[#ff2d78] rounded-3xl p-8 text-center max-w-sm w-full">
                            <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Scan to Join</h3>
                            <p className="text-gray-400 text-xs uppercase tracking-widest mb-6">Point your camera here!</p>
                            <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-6">
                                <QRCode value={`${window.location.origin}/?tab=Live&connect=${activeSession.id}`} size={200} />
                            </div>
                            <button onClick={() => setShowQR(false)} className="w-full border border-gray-700 text-gray-400 rounded-xl text-xs font-bold uppercase py-3 hover:text-white">Close</button>
                        </div>
                    </div>
                )}

                {/* 2. THE QUEUE & LEADERBOARD */}
                <div className="space-y-3 mt-8">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2 text-left">Live Queue & Leaderboard</h3>
                    
                    {singers.length === 0 ? (
                        <div className="text-center p-8 border border-dashed border-gray-800 rounded-2xl bg-black/50">
                            <p className="text-gray-500 text-sm font-bold tracking-widest uppercase">No singers added yet.</p>
                            <p className="text-gray-600 text-[10px] mt-2">Add a singer to start accepting votes.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {singers.map((singer, index) => {
                                const isActive = singer.status === 'singing'
                                const isBlocked = isSomeoneLive && !isActive

                                return (
                                    <div key={singer.id} className={`bg-gray-900 border ${isActive ? 'border-[#ff2d78] shadow-[0_0_20px_rgba(255,45,120,0.3)]' : 'border-gray-800'} rounded-xl p-3 flex items-center justify-between transition-all ${isBlocked ? 'opacity-50 grayscale' : ''}`}>
                                        
                                        {/* Rank & Info */}
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`font-['Bebas_Neue'] text-3xl w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                                                {index + 1}
                                            </div>
                                            <div className="truncate">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-white text-lg leading-tight truncate">{singer.name}</h4>
                                                    {isActive && <span className="text-[9px] bg-[#ff2d78] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-widest animate-pulse">● LIVE</span>}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Score: {singer.total_points}</span>
                                                
                                                {/* DISPLAY IMPORTED SETLIST */}
                                                {singer.setlist && singer.setlist.length > 0 && (
                                                    <div className="mt-1.5 flex flex-col gap-0.5">
                                                        {singer.setlist.map((song, idx) => (
                                                            <span key={idx} className="text-[10px] text-gray-400 truncate"><span className="text-[#00f5ff]">🎵</span> {song}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Host Controls */}
                                        <div className="flex items-center gap-1 shrink-0 ml-2">
                                            <button onClick={() => handleEditSinger(singer)} disabled={isActive} className="w-8 h-8 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 flex items-center justify-center text-sm disabled:opacity-50">
                                                ✏️
                                            </button>
                                            <button onClick={() => handleDeleteSinger(singer.id, singer.name)} disabled={isActive} className="w-8 h-8 rounded bg-red-900/20 hover:bg-red-900/40 text-red-500 flex items-center justify-center text-sm disabled:opacity-50">
                                                🗑️
                                            </button>
                                            <button 
                                                onClick={() => handleToggleLive(singer)} 
                                                disabled={isBlocked}
                                                className={`w-12 h-10 rounded-lg flex items-center justify-center text-xl ml-1 transition-all ${isActive ? 'bg-[#ff2d78] text-white shadow-[0_0_15px_rgba(255,45,120,0.5)]' : isBlocked ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 'bg-green-600/20 text-green-500 border border-green-500/30 hover:bg-green-600 hover:text-white'}`}
                                            >
                                                {isActive ? '⏸' : '▶'}
                                            </button>
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
}