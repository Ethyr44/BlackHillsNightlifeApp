import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import QRCode from 'react-qr-code' 

export default function KSocialHost({ currentUser, mode, onExit }) {
    const [view, setView] = useState('start_menu')
    const [activeSession, setActiveSession] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    
    const [showQR, setShowQR] = useState(false)
    const [showCrawlQR, setShowCrawlQR] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    
    const [incomingRequest, setIncomingRequest] = useState(null)

    const [sessionTitle, setSessionTitle] = useState('KSocial LIVE!')
    const [hostName, setHostName] = useState(currentUser.username)
    const [bizName, setBizName] = useState('Black Hills Nightlife')
    const [venueName, setVenueName] = useState('')
    const [votingStyle, setVotingStyle] = useState('normal')
    const [votingIcon, setVotingIcon] = useState('star')
    const [supervotes, setSupervotes] = useState(1)

    const [singers, setSingers] = useState([])

    // 🟢 NEW: Timer State for Voting
    const [votingTimeLeft, setVotingTimeLeft] = useState(0)
    const [activeVotingSinger, setActiveVotingSinger] = useState(null)

    useEffect(() => {
        const checkExistingSession = async () => {
            const { data } = await supabase.from('active_sessions').select('*').eq('host_id', currentUser.id).maybeSingle()
            if (data) {
                setActiveSession(data)
                setVotingStyle(data.voting_style || 'normal')
                setVotingIcon(data.voting_icon || 'star')
                setSupervotes(data.supervotes || 1)
                setView('dashboard')
            }
            setIsLoading(false)
        }
        checkExistingSession()
    }, [currentUser])

    const fetchSingers = async (sessionId) => {
        const { data, error } = await supabase.from('session_singers').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
        if (error) {
            console.error("Fetch Error:", error)
            alert(`Failed to load singers: ${error.message}`)
        }
        if (data) setSingers(data)
    }

    // 🟢 THE SILENT 4-SECOND REFRESH LOOP & REALTIME LISTENER
    useEffect(() => {
        if (!activeSession) return;

        fetchSingers(activeSession.id)

        const sub = supabase.channel(`host-realtime-${activeSession.id}`)
            .on('postgres', { event: 'INSERT', schema: 'public', table: 'session_singers', filter: `session_id=eq.${activeSession.id}` }, (payload) => {
                if (payload.new.status === 'pending') {
                    setIncomingRequest(payload.new)
                }
                fetchSingers(activeSession.id)
            })
            .on('postgres', { event: 'UPDATE', schema: 'public', table: 'session_singers', filter: `session_id=eq.${activeSession.id}` }, () => {
                fetchSingers(activeSession.id)
            })
            .on('postgres', { event: 'DELETE', schema: 'public', table: 'session_singers', filter: `session_id=eq.${activeSession.id}` }, () => {
                fetchSingers(activeSession.id)
            })
            .subscribe()

        // 🟢 THE BULLETPROOF POLLING FALLBACK
        const pollInterval = setInterval(() => {
            fetchSingers(activeSession.id)
        }, 4000)

        return () => {
            supabase.removeChannel(sub)
            clearInterval(pollInterval)
        }
    }, [activeSession?.id])

    // 🟢 NEW: 60-Second Voting Countdown Hook
    useEffect(() => {
        if (votingTimeLeft > 0 && activeVotingSinger) {
            const timer = setTimeout(() => setVotingTimeLeft(prev => prev - 1), 1000)
            return () => clearTimeout(timer)
        } else if (votingTimeLeft === 0 && activeVotingSinger) {
            // Timer Hit Zero! Move to Results & Burn the Song
            finalizeVoting(activeVotingSinger)
        }
    }, [votingTimeLeft, activeVotingSinger])

    // 🟢 REPLACED: Progressive Stage Loop
    const handleStageProgression = async (singer) => {
        let nextStatus = 'queued'
        
        if (singer.status === 'queued') {
            nextStatus = 'standby' // Triggers "Up Next" on Projector
        } 
        else if (singer.status === 'standby') {
            nextStatus = 'singing' // Triggers "Live" on Projector
        } 
        else if (singer.status === 'singing') {
            nextStatus = 'voting' // Triggers Voting controls for users
            setActiveVotingSinger(singer)
            setVotingTimeLeft(60) // Start the 60-second clock
        }

        await supabase.from('session_singers').update({ status: nextStatus }).eq('id', singer.id)
        fetchSingers(activeSession.id)
    }

    // 🟢 NEW: Finalize Votes & Burn the Song to the Passport
    const finalizeVoting = async (singer) => {
        setActiveVotingSinger(null)
        
        // 1. Write to the Tournament History (The Passport Burn)
        // We only do this if they are an app user with a BHNL ID and an active tournament is running
        if (activeSession.tournament_id && singer.bhnl_id && singer.song_id) {
            await supabase.from('tournament_history').insert([{
                tournament_id: activeSession.tournament_id,
                bhnl_id: singer.bhnl_id,
                song_id: singer.song_id,
                venue_name: activeSession.venue_name,
                points_earned: singer.total_points
            }])
        }

        // 2. Move singer to "results" status so the UI shows the final score
        await supabase.from('session_singers').update({ status: 'results' }).eq('id', singer.id)
        
        // 3. Update the session's last activity timestamp for the Admin Hub
        await supabase.from('active_sessions').update({ last_stage_time: new Date().toISOString() }).eq('id', activeSession.id)

        fetchSingers(activeSession.id)
    }

    const handleEndSession = async () => {
        if (!window.confirm("End the night? All singer points will be converted to Lifestyle Points (L$).")) return
        
        setIsLoading(true)
        // 1. Pay everyone out
        await supabase.rpc('payout_session_points', { p_session_id: activeSession.id })
        
        // 2. Close the stage
        await supabase.from('active_sessions').delete().eq('id', activeSession.id)
        
        setActiveSession(null)
        setView('start_menu')
        setIsLoading(false)
        alert("Session complete! Points deposited to user wallets.")
    }

    const openProjector = () => {
        if (activeSession) window.open(`/?tab=Projector&session=${activeSession.id}`, '_blank')
    }

    const saveSessionSettings = async () => {
        const payload = { voting_style: votingStyle, voting_icon: votingIcon, supervotes: parseInt(supervotes) }
        const { data, error } = await supabase.from('active_sessions').update(payload).eq('id', activeSession.id).select().single()
        
        if (error) alert(`Failed to update settings: ${error.message}`)
        else {
            setActiveSession(data)
            setShowSettingsModal(false)
            alert("Settings updated successfully! Audience screens will update automatically.")
        }
    }

    const startSession = async () => {
        setIsLoading(true)
        const payload = {
            host_id: currentUser.id,
            host_name: hostName,
            biz_name: bizName,
            venue_name: venueName,
            session_title: sessionTitle,
            mode: 'league', // Hardcoded safely!
            is_active: true,
            voting_style: votingStyle,
            voting_icon: votingIcon,
            supervotes: parseInt(supervotes),
            // 🟢 NEW: Auto-link to the Crawl if one is active
            tournament_id: activeCrawl ? activeCrawl.id : null 
        }
        const { data, error } = await supabase.from('active_sessions').insert([payload]).select().single()
        
        if (error) {
            alert(`Failed to launch session! Error: ${error.message}`)
            setIsLoading(false)
            return
        }

        if (data) {
            setActiveSession(data)
            setView('dashboard')
        }
        setIsLoading(false)
    }

    // 🟢 INSTANT LOCAL REFRESH ADDED
    const handleAddSinger = async (e) => {
        e.preventDefault()
        const fd = new FormData(e.target)
        const sName = fd.get('singer_name')
        if(!sName) return
        
        const { error } = await supabase.from('session_singers').insert([{ 
            session_id: activeSession.id, 
            name: sName, 
            status: 'queued', 
            total_points: 0 
        }])
        
        if (error) {
            alert(`Database Error! Supabase says: ${error.message}`)
        } else {
            e.target.reset()
            fetchSingers(activeSession.id) // INSTANT REFRESH
        }
    }

    const handleDeleteSinger = async (id, name, skipConfirm = false) => {
        if(skipConfirm || window.confirm(`Remove ${name} from the lineup?`)) {
            await supabase.from('session_singers').delete().eq('id', id)
            fetchSingers(activeSession.id) // INSTANT REFRESH
        }
    }

    const handleApproveSinger = async (id) => {
        await supabase.from('session_singers').update({ status: 'queued' }).eq('id', id)
        fetchSingers(activeSession.id) // INSTANT REFRESH
    }

    const handleModalApprove = async () => {
        await handleApproveSinger(incomingRequest.id)
        setIncomingRequest(null)
    }

    const handleModalDeny = async () => {
        await handleDeleteSinger(incomingRequest.id, incomingRequest.name, true) 
        setIncomingRequest(null)
    }

    if (isLoading) return <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>

    if (view === 'start_menu') {
        return (
            <div className="max-w-md mx-auto animate-fade-in p-6 bg-[#090812] border-2 border-purple-500/30 rounded-3xl shadow-2xl mt-4">
                
                <div className="text-center mb-6">
                    <h2 className="text-4xl font-['Bebas_Neue'] text-white tracking-widest">Stage Setup</h2>
                    <p className="text-purple-400 text-[10px] font-bold uppercase tracking-widest bg-purple-900/30 inline-block px-3 py-1 rounded-full mt-2 border border-purple-500/30">
                        Official League Session
                    </p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Session Title</label>
                        <input type="text" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} className="w-full bg-black border border-gray-800 text-white rounded-xl p-4 mt-1 outline-none focus:border-purple-500 transition-colors" />
                    </div>
                    
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Venue Name</label>
                        <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="e.g. The Firehouse" className="w-full bg-black border border-gray-800 text-white rounded-xl p-4 mt-1 outline-none focus:border-purple-500 transition-colors" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Voting Style</label>
                            <select value={votingStyle} onChange={e => setVotingStyle(e.target.value)} className="w-full bg-black border border-gray-800 text-white rounded-xl p-4 mt-1 outline-none focus:border-purple-500">
                                <option value="normal">Standard (1 Pt)</option>
                                <option value="1to5">1 to 5 Stars</option>
                                <option value="multi">Categories</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 ml-1">Supervotes / User</label>
                            <input type="number" min="1" max="5" value={supervotes} onChange={e => setSupervotes(e.target.value)} className="w-full bg-black border border-gray-800 text-white rounded-xl p-4 mt-1 outline-none focus:border-purple-500" />
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex gap-3">
                    <button onClick={onExit} className="flex-1 py-4 rounded-xl border border-gray-700 text-gray-400 font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-colors">Cancel</button>
                    <button 
                        onClick={startSession} 
                        disabled={isLoading || !venueName}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                    >
                        {isLoading ? 'Booting...' : 'Go Live'}
                    </button>
                </div>
            </div>
        )
    }

    if (view === 'dashboard') {
        const liveSinger = singers.find(s => s.status === 'singing')
        const activeQueue = singers.filter(s => s.status !== 'pending').sort((a,b) => b.total_points - a.total_points)
        const pendingQueue = singers.filter(s => s.status === 'pending')

        return (
            <div className="space-y-6 animate-fade-in relative">
                
                {incomingRequest && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-[#1a0f00] border-4 border-yellow-500 p-8 rounded-3xl w-full max-w-sm text-center shadow-[0_0_50px_rgba(234,179,8,0.5)] animate-slide-up-fast">
                            <div className="text-6xl mb-4 animate-bounce">🙋</div>
                            <h3 className="text-4xl font-['Bebas_Neue'] tracking-widest mb-1 text-white">Incoming Request!</h3>
                            <p className="text-yellow-500 font-bold uppercase tracking-widest text-xs mb-6">Wants to hit the stage</p>
                            
                            <div className="bg-black/50 p-6 rounded-2xl border border-yellow-900/50 mb-8">
                                <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Stage Alias</span>
                                <span className="text-3xl font-bold text-white leading-none">{incomingRequest.name}</span>
                            </div>

                            <div className="flex gap-4">
                                <button onClick={handleModalDeny} className="flex-1 bg-red-900/20 text-red-500 border border-red-500/30 rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-red-600 hover:text-white py-4 transition-all">Deny</button>
                                <button onClick={handleModalApprove} className="flex-1 bg-yellow-500 text-black rounded-2xl text-sm font-bold uppercase tracking-widest hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.6)] py-4 transition-all">Approve</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-[#090812] border-2 border-[#ff2d78]/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(255,45,120,0.15)] relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-[#ff2d78]"></div>
                    
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">{activeSession.session_title}</h2>
                            <p className="text-[#ff2d78] text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-[#ff2d78] animate-pulse"></span> LIVE BROADCASTING
                            </p>
                        </div>
                    </div>

                    {/* Add this inside the activeSession dashboard view */}
                    {currentUser.account_type === 'Admin' && (
                        <button 
                            onClick={() => setShowCrawlQR(true)} 
                            className="bg-blue-900/30 text-blue-400 border border-blue-500/50 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors mb-4 w-full"
                        >
                            📱 Display Temp QR Code
                        </button>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <button onClick={() => setShowQR(true)} className="bg-blue-900/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all">
                            <span className="text-xl">📱</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">Show QR Code</span>
                        </button>
                        <button onClick={openProjector} className="bg-purple-900/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/30 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all">
                            <span className="text-xl">📺</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">TV Projector</span>
                        </button>
                        <button onClick={() => fetchSingers(activeSession.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all">
                            <span className="text-xl">🔄</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">Force Sync</span>
                        </button>
                        <button onClick={() => setShowSettingsModal(true)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all sm:col-span-1 col-span-2">
                            <span className="text-xl">⚙️</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">Session Settings</span>
                        </button>
                        <button onClick={handleEndSession} className="bg-red-900/20 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 py-3 rounded-xl flex flex-col items-center justify-center gap-1 transition-all sm:col-span-2 col-span-2">
                            <span className="text-xl">⏹</span>
                            <span className="text-[9px] font-bold uppercase tracking-widest">End Session</span>
                        </button>
                    </div>
                </div>

                {showQR && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white p-8 rounded-3xl w-full max-w-sm text-center animate-slide-up-fast">
                            <h3 className="text-3xl font-['Bebas_Neue'] tracking-widest mb-2 text-black">Scan to Join!</h3>
                            <p className="text-gray-500 text-xs mb-6 uppercase tracking-widest font-bold">Join the crowd & vote live</p>
                            <div className="bg-white p-4 rounded-xl border-4 border-black inline-block mb-6">
                                <QRCode value={`${window.location.origin}/?tab=Live&session=${activeSession.id}`} size={200} />
                            </div>
                            <button onClick={() => setShowQR(false)} className="w-full bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest py-4 hover:bg-gray-800 transition-colors">Close Scanner</button>
                        </div>
                    </div>
                )}

                {showSettingsModal && (
                    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-900 border border-gray-700 p-8 rounded-3xl w-full max-w-sm animate-slide-up-fast">
                            <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-6">Update Settings</h3>
                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Voting Style</label>
                                    <select value={votingStyle} onChange={e => setVotingStyle(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-[#ff2d78] outline-none">
                                        <option value="normal">Tap to Vote (Standard)</option>
                                        <option value="1to5">5-Star Rating (Single)</option>
                                        <option value="multi">Multi-Category (Perf/Wow/Orig)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Button Icon</label>
                                    <select value={votingIcon} onChange={e => setVotingIcon(e.target.value)} className="w-full bg-black border border-gray-700 text-white rounded-lg p-3 text-sm focus:border-[#ff2d78] outline-none">
                                        <option value="star">⭐ Star</option>
                                        <option value="fire">🔥 Fire</option>
                                        <option value="clap">👏 Clap</option>
                                    </select>
                                </div>
                                {activeSession.mode === 'league' && (
                                    <div>
                                        <label className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest">Audience Supervotes</label>
                                        <input type="number" min="0" max="5" value={supervotes} onChange={e => setSupervotes(e.target.value)} className="w-full bg-black border border-yellow-500/50 text-white rounded-lg p-3 text-sm focus:border-yellow-400 outline-none" />
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setShowSettingsModal(false)} className="flex-1 bg-gray-800 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-gray-700">Cancel</button>
                                <button onClick={saveSessionSettings} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-blue-500">Save</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* The QR Modal */}
                {showCrawlQR && (
                    <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white p-8 rounded-3xl text-center relative">
                            <button onClick={() => setShowCrawlQR(false)} className="absolute -top-4 -right-4 bg-red-500 text-white w-10 h-10 rounded-full font-bold shadow-lg">✕</button>
                            <h3 className="text-black font-['Bebas_Neue'] text-3xl mb-2">Scan to Join</h3>
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">Karaoke Crawl Master Hub</p>
                            <QRCode value={`${window.location.origin}/crawl`} size={250} />
                        </div>
                    </div>
                )}

                <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-['Bebas_Neue'] text-blue-400 tracking-widest">Stage Management</h3>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 bg-gray-900 px-2 py-1 rounded">
                            {activeQueue.length} in Queue
                        </span>
                    </div>
                    
                    <form onSubmit={handleAddSinger} className="flex gap-2 mb-6">
                        <input type="text" name="singer_name" placeholder="Quick-Add Singer..." className="flex-1 bg-black border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500" required />
                        <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-gray-700 transition-colors">Add</button>
                    </form>

                    {pendingQueue.length > 0 && !incomingRequest && (
                        <div className="mb-4 space-y-2">
                            {pendingQueue.map(singer => (
                                <div key={singer.id} className="bg-yellow-900/20 border border-yellow-500/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="font-['Bebas_Neue'] text-2xl w-6 text-center text-yellow-500">?</div>
                                        <div>
                                            <h4 className="font-bold text-white text-lg leading-none">{singer.name}</h4>
                                            <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest animate-pulse">Pending Approval</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        <button onClick={() => handleDeleteSinger(singer.id, singer.name)} className="px-4 py-2 bg-gray-800 text-gray-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">Deny</button>
                                        <button onClick={() => handleApproveSinger(singer.id)} className="px-5 py-2 bg-yellow-600 text-black hover:bg-yellow-500 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-colors">Approve</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="space-y-2">
                        {activeQueue.length === 0 ? (
                            <p className="text-center text-gray-600 font-bold uppercase tracking-widest text-[10px] py-4">Lineup is empty</p>
                        ) : (
                            activeQueue.map((singer, index) => {
                                const isActive = singer.status === 'singing'
                                const isBlocked = liveSinger && !isActive
                                
                                return (
                                    <div key={singer.id} className={`bg-black/40 border ${isActive ? 'border-[#ff2d78]' : 'border-gray-800'} rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors`}>
                                        
                                        <div className="flex items-center gap-4">
                                            <div className={`font-['Bebas_Neue'] text-2xl w-6 text-center ${isActive ? 'text-[#ff2d78]' : 'text-gray-600'}`}>{index + 1}</div>
                                            <div>
                                                <h4 className="font-bold text-white text-lg leading-none">{singer.name}</h4>
                                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{singer.total_points} PTS</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-end gap-2">
                                            <button onClick={() => {
                                                const pts = prompt(`Adjust Score for ${singer.name} (Current: ${singer.total_points}):`, singer.total_points)
                                                if (pts !== null && !isNaN(pts)) {
                                                    supabase.from('session_singers').update({ total_points: parseInt(pts) }).eq('id', singer.id).then(() => fetchSingers(activeSession.id))
                                                }
                                            }} className="w-8 h-8 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 flex items-center justify-center text-sm">
                                                ✏️
                                            </button>
                                            <button onClick={() => handleDeleteSinger(singer.id, singer.name)} disabled={isActive} className="w-8 h-8 rounded bg-red-900/20 hover:bg-red-900/40 text-red-500 flex items-center justify-center text-sm disabled:opacity-50">
                                                🗑️
                                            </button>
                                        <button 
                                            onClick={() => handleStageProgression(singer)} 
                                            disabled={isBlocked || singer.status === 'voting'}
                                            className={`w-16 h-10 rounded-lg flex items-center justify-center text-xs font-bold uppercase tracking-widest ml-1 transition-all 
                                                ${singer.status === 'standby' ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.5)]' : 
                                                  singer.status === 'singing' ? 'bg-[#ff2d78] text-white shadow-[0_0_15px_rgba(255,45,120,0.5)]' : 
                                                  singer.status === 'voting' ? 'bg-blue-600 text-white animate-pulse' :
                                                  singer.status === 'results' ? 'bg-gray-700 text-gray-400' :
                                                  isBlocked ? 'bg-gray-800 text-gray-600 cursor-not-allowed' : 
                                                  'bg-green-600/20 text-green-500 border border-green-500/30 hover:bg-green-600 hover:text-white'}`}
                                        >
                                            {singer.status === 'queued' ? 'Ready' : 
                                             singer.status === 'standby' ? 'Play' : 
                                             singer.status === 'singing' ? 'Vote' : 
                                             singer.status === 'voting' ? `${votingTimeLeft}s` : 
                                             singer.status === 'results' ? 'Done' : '▶'}
                                        </button>
                                        </div>

                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

            </div>
        )
    }
}