import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { toast } from './GlobalToast'

export default function KSocialUser({ currentUser, sessionId, onExit }) {
    const [session, setSession] = useState(null)
    const [singers, setSingers] = useState([])
    const [votedFor, setVotedFor] = useState({}) // Locks out users after Vibe Check
    const [isLoading, setIsLoading] = useState(true)

    // 🟢 ARCADE STATES
    const [superVotesRemaining, setSuperVotesRemaining] = useState(0)
    const [superVoteActive, setSuperVoteActive] = useState(false)
    const [multiStars, setMultiStars] = useState({ performance: 0, wow: 0, originality: 0 })
    const [tapCount, setTapCount] = useState(0)

    const [showJoinModal, setShowJoinModal] = useState(false)
    const [singerAlias, setSingerAlias] = useState(currentUser?.username || '')
    const [activeTab, setActiveTab] = useState('Stage') // 'Stage' or 'Scoreboard'

    // 🟢 PASSPORT / SETLIST STATES
    const [userSetlist, setUserSetlist] = useState([])
    const [isFetchingPassport, setIsFetchingPassport] = useState(false)

    useEffect(() => {
        const fetchSingers = async () => {
            const { data } = await supabase.from('session_singers')
                .select('*')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: true })
            if (data) setSingers(data)
            setIsLoading(false)
        }
        
        const fetchSession = async () => {
            const { data } = await supabase.from('active_sessions').select('*').eq('id', sessionId).maybeSingle()
            if (data) {
                setSession(data)
                setSuperVotesRemaining(data.supervotes_allowed || 1)
            }
        }

        fetchSession()
        fetchSingers()

        const sub = supabase.channel(`public-ksocial-${sessionId}`)
            .on('postgres', { event: '*', schema: 'public', table: 'session_singers', filter: `session_id=eq.${sessionId}` }, fetchSingers)
            .subscribe()

        return () => supabase.removeChannel(sub)
    }, [sessionId])

    // 🟢 THE BATCH SYNcer: Prevents DB Crash from Button Mashing
    useEffect(() => {
        const activeSinger = singers.find(s => s.status === 'voting')
        if (tapCount > 0 && activeSinger && session?.voting_style === 'normal') {
            const timer = setTimeout(async () => {
                const pointsToSend = tapCount
                setTapCount(0) 
                
                await supabase.rpc('add_singer_score', { 
                    p_singer_id: activeSinger.id, 
                    p_score: pointsToSend 
                })
            }, 1000) // Flushes points to DB every 1 second
            return () => clearTimeout(timer)
        }
    }, [tapCount, singers, session])

    // 🟢 ARCADE TAP HANDLER
    const handleTapVote = () => {
        const multiplier = superVoteActive ? 2 : 1
        setTapCount(prev => prev + multiplier)
        
        // Haptic Feedback
        if (navigator.vibrate) {
            navigator.vibrate(superVoteActive ? [50, 50, 50] : 50) 
        }
    }

    const toggleSuperVote = () => {
        if (superVotesRemaining <= 0) {
            toast.error("You are out of SuperVotes!")
            return
        }
        setSuperVoteActive(true)
        setSuperVotesRemaining(prev => prev - 1)
        toast.success("SUPERVOTE ACTIVATED! Taps are doubled!")
    }

    const handleFetchPassport = async () => {
        setIsFetchingPassport(true)
        const { data } = await supabase.from('profiles').select('active_setlist').eq('id', currentUser.id).single()
        if (data?.active_setlist && data.active_setlist.length > 0) {
            const { data: songData } = await supabase.from('songs').select('id, title, artist').in('id', data.active_setlist)
            if (songData) {
                // Preserves the order of their setlist array
                const sortedSongs = data.active_setlist.map(id => songData.find(s => s.id === id)).filter(Boolean)
                setUserSetlist(sortedSongs)
            }
        }
        setIsFetchingPassport(false)
    }

    const handleSubmitRequest = async (e) => {
        e.preventDefault()
        if (userSetlist.length === 0) return toast.error("Your Setlist is empty!")
        
        const payload = {
            session_id: sessionId,
            user_id: currentUser.id,
            singer_name: singerAlias,
            song_id: userSetlist[0].id,
            song_title: userSetlist[0].title,
            song_artist: userSetlist[0].artist,
            setlist: userSetlist, 
            status: 'pending' 
        }
        
        // 🟢 FIX: Catch any database rejections so we aren't guessing
        const { error } = await supabase.from('session_singers').insert([payload])
        
        if (error) {
            toast.error(`Submission Error: ${error.message}`)
            console.error("Setlist Insert Error:", error)
        } else {
            setShowJoinModal(false)
            toast.success("Setlist submitted to Host for approval!")
        }
    }

    // 🟢 VIBE CHECK SUBMISSION (Multi-Category)
    const handleMultiVote = (category, val) => {
        setMultiStars(prev => ({ ...prev, [category]: val }))
    }

    const submitVibeCheck = async () => {
        const activeSinger = singers.find(s => s.status === 'voting')
        if (!activeSinger) return

        let multiplier = 1
        if (superVoteActive) {
            if (superVotesRemaining <= 0) return toast.error("No SuperVotes remaining!")
            multiplier = 5
            setSuperVotesRemaining(prev => prev - 1)
        }

        const addedPerf = multiStars.performance * multiplier
        const addedWow = multiStars.wow * multiplier
        const addedOrig = multiStars.originality * multiplier
        const totalAdded = addedPerf + addedWow + addedOrig

        await supabase.from('session_singers').update({
            score_performance: (activeSinger.score_performance || 0) + addedPerf,
            score_wow: (activeSinger.score_wow || 0) + addedWow,
            score_originality: (activeSinger.score_originality || 0) + addedOrig,
            total_points: (activeSinger.total_points || 0) + totalAdded,
            super_votes: (activeSinger.super_votes || 0) + (superVoteActive ? 1 : 0)
        }).eq('id', activeSinger.id)

        setVotedFor({ ...votedFor, [activeSinger.id]: true })
        setMultiStars({ performance: 0, wow: 0, originality: 0 })
        setSuperVoteActive(false)
        toast.success("Votes Locked In!")
    }

    if (isLoading) return <div className="text-white text-center py-20 animate-pulse">Connecting to Stage...</div>
    if (!session) return <div className="text-white text-center py-20">Session ended or not found. <button onClick={onExit} className="text-blue-400 block w-full mt-4">Return Home</button></div>

    const activeSinger = singers.find(s => s.status === 'singing' || s.status === 'voting' || s.status === 'standby' || s.status === 'results')
    const myEntry = singers.find(s => s.user_id === currentUser.id)

    return (
        <div className="animate-fade-in relative min-h-[80vh]">
            
            {/* Header / HUD */}
            <div className="bg-[#090812] border-b border-gray-800 p-4 sticky top-0 z-40 shadow-lg">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="font-['Bebas_Neue'] text-2xl text-white tracking-widest leading-none">{session.title}</h2>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{session.business_name}</span>
                    </div>
                    <button onClick={onExit} className="bg-gray-800 text-gray-400 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:text-white">Leave</button>
                </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-gray-900 border-b border-gray-800 p-2 gap-2 sticky top-[73px] z-30">
                {['Stage', 'Scoreboard'].map(tab => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-800'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* TAB: STAGE */}
            {activeTab === 'Stage' && (
                <div className="max-w-md mx-auto p-4 space-y-6">
                    <div className="bg-[#090812] border-2 border-gray-800 rounded-3xl p-6 text-center relative overflow-hidden shadow-xl">
                        {activeSinger ? (
                            <div className="animate-fade-in relative z-10">
                                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 border ${
                                    activeSinger.status === 'voting' ? 'bg-blue-900/30 text-blue-400 border-blue-500/50 animate-pulse' : 
                                    activeSinger.status === 'standby' ? 'bg-yellow-900/30 text-yellow-500 border-yellow-500/50' :
                                    activeSinger.status === 'results' ? 'bg-gray-800 text-gray-400 border-gray-600' :
                                    'bg-[#ff2d78]/20 text-[#ff2d78] border-[#ff2d78]/50'
                                }`}>
                                    {activeSinger.status === 'voting' ? 'Voting Open!' : activeSinger.status === 'standby' ? 'Up Next' : activeSinger.status === 'results' ? 'Performance Over' : 'On Stage'}
                                </span>
                                
                                <h3 className="text-3xl font-['Bebas_Neue'] text-white tracking-widest mb-1">{activeSinger.singer_name}</h3>
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{activeSinger.song_title}</p>
                                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">by {activeSinger.song_artist}</p>
                            </div>
                        ) : (
                            <div className="py-8 relative z-10">
                                <span className="text-4xl opacity-50 mb-4 block">🎤</span>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Stage is Empty</p>
                            </div>
                        )}
                    </div>

                    {!myEntry && (
                        <button onClick={() => { handleFetchPassport(); setShowJoinModal(true); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold uppercase tracking-widest transition-colors shadow-[0_0_20px_rgba(37,99,235,0.4)]">
                            Request to Sing
                        </button>
                    )}
                    {myEntry && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-2xl p-4 text-center">
                            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Your Stage Status</p>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${myEntry.status === 'pending' ? 'bg-yellow-900/50 text-yellow-500' : 'bg-green-900/50 text-green-400'}`}>
                                {myEntry.status}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: SCOREBOARD */}
            {activeTab === 'Scoreboard' && (
                <div className="max-w-md mx-auto p-4 space-y-3">
                    {singers.filter(s => s.status === 'queued').length === 0 && (
                        <p className="text-center text-gray-500 text-xs font-bold uppercase tracking-widest py-8">Queue is empty</p>
                    )}
                    {singers.filter(s => s.status === 'queued').map((s, i) => (
                        <div key={s.id} className="flex items-center gap-4 bg-black/40 border border-gray-800 p-4 rounded-2xl">
                            <span className="text-gray-600 font-['Bebas_Neue'] text-2xl w-6 text-center">{i + 1}</span>
                            <div>
                                <h4 className="text-white font-bold">{s.singer_name}</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{s.song_title}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 🟢 THE VOTING OVERLAYS */}
            {activeSinger?.status === 'voting' && !votedFor[activeSinger.id] && (
                <>
                    {/* NORMAL: GIANT TAP BUTTON (Restored CSS & Anti-Zoom) */}
                    {session.voting_style === 'normal' && (
                        <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-6 animate-fade-in backdrop-blur-lg">
                            
                            <h2 className="text-6xl font-['Bebas_Neue'] text-[#ff2d78] tracking-widest mb-2 animate-pulse drop-shadow-[0_0_15px_rgba(255,45,120,0.8)]">VOTE NOW!</h2>
                            <p className="text-white text-sm font-bold uppercase tracking-widest mb-12 text-center text-gray-300">Tap the button to cheer for {activeSinger.singer_name}!</p>
                            
                            {/* THE ARCADE BUTTON */}
                            <button 
                                onClick={handleTapVote}
                                className="active:scale-95 active:bg-[#d41c5f]"
                                style={{
                                    width: '240px', height: '240px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #ff2d78, #b347ff)',
                                    border: '6px solid rgba(255,255,255,0.04)',
                                    color: '#fff', fontFamily: '"Bebas Neue", sans-serif', fontSize: '52px', letterSpacing: '4px',
                                    cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none',
                                    touchAction: 'manipulation', // Prevents double-tap zoom
                                    boxShadow: '0 10px 50px rgba(255, 45, 120, 0.5), inset 0 -10px 20px rgba(0,0,0,0.3)',
                                    transition: 'transform 0.05s, box-shadow 0.05s',
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                TAP!
                            </button>

                            <div className="mt-8 text-center bg-black/50 px-8 py-4 rounded-3xl border border-[#ff2d78]/30 min-w-[200px]">
                                <p className="text-[#ff2d78] text-4xl font-['Bebas_Neue'] tracking-widest">{tapCount}</p>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Hits</p>
                            </div>

                            {/* SUPER VOTE BUTTON */}
                            {superVotesRemaining > 0 && !superVoteActive && (
                                <button onClick={toggleSuperVote} className="mt-8 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-bounce">
                                    ⚡ Activate SuperVote ({superVotesRemaining} Left)
                                </button>
                            )}
                            {superVoteActive && (
                                <div className="mt-8 text-yellow-500 text-xs font-bold uppercase tracking-widest animate-pulse border border-yellow-500/50 bg-yellow-900/30 px-6 py-3 rounded-full">
                                    ⚡ 2x Multiplier Active!
                                </div>
                            )}
                        </div>
                    )}

                    {/* VIBE CHECK: MULTI-CATEGORY */}
                    {session.voting_style === 'vibe_check' && (
                        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center p-4 animate-fade-in backdrop-blur-md">
                            <div className="w-full max-w-sm">
                                <h3 className="text-3xl font-['Bebas_Neue'] text-blue-400 tracking-widest text-center mb-6">Vibe Check</h3>
                                <div className="space-y-6 bg-[#090812] border border-gray-800 p-6 rounded-3xl shadow-2xl">
                                    {[
                                        { key: 'performance', label: 'Vocals / Performance', emoji: '🎤' },
                                        { key: 'wow', label: 'Energy / Crowd Vibe', emoji: '🔥' },
                                        { key: 'originality', label: 'Originality / Style', emoji: '✨' }
                                    ].map(cat => (
                                        <div key={cat.key}>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <span>{cat.emoji}</span> {cat.label}
                                            </p>
                                            <div className="flex justify-between gap-1">
                                                {[1, 2, 3, 4, 5].map(val => (
                                                    <button 
                                                        key={val} 
                                                        onClick={() => handleMultiVote(cat.key, val)}
                                                        className={`flex-1 aspect-square rounded-lg flex items-center justify-center text-xl transition-all ${multiStars[cat.key] >= val ? 'bg-blue-600 text-white scale-110 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-gray-800 text-gray-600 hover:bg-gray-700'}`}
                                                    >
                                                        {multiStars[cat.key] >= val ? '⭐' : '☆'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {superVotesRemaining > 0 && !superVoteActive && (
                                    <button onClick={toggleSuperVote} className="w-full mt-4 bg-yellow-900/30 border border-yellow-500/50 text-yellow-500 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-yellow-500 hover:text-black transition-colors">
                                        ⚡ Use SuperVote (5x Multiplier)
                                    </button>
                                )}

                                <button 
                                    onClick={submitVibeCheck} 
                                    disabled={multiStars.performance === 0 || multiStars.wow === 0 || multiStars.originality === 0}
                                    className="w-full mt-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white py-4 rounded-xl font-bold uppercase tracking-widest transition-all shadow-lg"
                                >
                                    Lock In Votes
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* SETLIST SUBMISSION MODAL */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
                    <div className="bg-[#090812] border border-gray-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl">
                        <h3 className="text-2xl font-['Bebas_Neue'] text-blue-400 tracking-widest mb-4">Request to Sing</h3>
                        
                        <form onSubmit={handleSubmitRequest}>
                            <div className="mb-6">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Stage Name</label>
                                <input type="text" value={singerAlias} onChange={e => setSingerAlias(e.target.value)} required className="w-full bg-black border border-gray-700 text-white rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 text-sm" />
                            </div>

                            {isFetchingPassport ? (
                                <p className="text-gray-500 text-xs text-center py-4 animate-pulse uppercase tracking-widest font-bold">Scanning Vault...</p>
                            ) : userSetlist.length === 0 ? (
                                <div className="text-center p-6 bg-red-900/10 border border-red-900/30 rounded-xl mb-6">
                                    <p className="text-red-400 text-xs font-bold uppercase tracking-widest">Your Setlist is empty.</p>
                                    <p className="text-[10px] text-gray-500 mt-2">Go back to your Profile and add songs from your Vault to your Active Setlist before joining the queue!</p>
                                </div>
                            ) : (
                                <div className="mb-6">
                                    <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold mb-2 flex justify-between">
                                        <span>Submitting Setlist:</span>
                                        <span className="text-gray-500">{userSetlist.length} Songs</span>
                                    </p>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 hide-scrollbar border border-gray-800 bg-black/40 rounded-xl p-3">
                                        {userSetlist.map((song, i) => (
                                            <div key={song.id} className="border-b border-gray-800 last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                                                <h4 className="text-white font-bold text-sm truncate">{i + 1}. {song.title}</h4>
                                                <p className="text-[9px] text-gray-500 uppercase font-bold truncate">{song.artist}</p>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-3 font-bold text-center">The host will automatically cycle to your next song after each performance.</p>
                                </div>
                            )}
            
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setShowJoinModal(false)} className="flex-1 border border-gray-700 text-gray-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:text-white py-3">Cancel</button>
                                <button type="submit" disabled={userSetlist.length === 0} className="flex-1 bg-purple-600 disabled:bg-gray-800 disabled:text-gray-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)] py-3 transition-all">Submit Queue</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}