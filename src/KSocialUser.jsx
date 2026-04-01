import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function KSocialUser({ currentUser, sessionId, onExit }) {
    const [session, setSession] = useState(null)
    const [singers, setSingers] = useState([])
    const [votedFor, setVotedFor] = useState({}) // Tracks normal votes to prevent double-voting
    const [isLoading, setIsLoading] = useState(true)

    // 1. INITIAL FETCH & REALTIME LISTENER
    useEffect(() => {
        const fetchSessionData = async () => {
            const { data: sessData } = await supabase.from('active_sessions').select('*').eq('id', sessionId).single()
            if (sessData) setSession(sessData)

            fetchSingers()
            setIsLoading(false)
        }

        const fetchSingers = async () => {
            const { data } = await supabase.from('session_singers')
                .select('*')
                .eq('session_id', sessionId)
                .order('total_points', { ascending: false })
            
            if (data) setSingers(data)
        }

        fetchSessionData()

        // Realtime Listener!
        const singerSub = supabase.channel('user-realtime-queue')
            .on('postgres', {
                event: '*',
                schema: 'public',
                table: 'session_singers',
                filter: `session_id=eq.${sessionId}`
            }, () => {
                fetchSingers()
            })
            .subscribe()

        return () => supabase.removeChannel(singerSub)
    }, [sessionId])

    // 2. THE VOTING LOGIC
    const handleVote = async (singerId, points) => {
        if (session.voting_style === 'normal' && votedFor[singerId]) {
            return alert("You have already voted for this singer's current performance!")
        }

        // Send the vote securely to the database
        await supabase.rpc('cast_ksocial_vote', { target_singer_id: singerId, points_to_add: points })

        // If normal mode, lock them out from voting again for this singer
        if (session.voting_style === 'normal') {
            setVotedFor(prev => ({ ...prev, [singerId]: true }))
        }
        
        // Give a little visual feedback
        const btn = document.getElementById(`vote-btn-${points}`)
        if (btn) {
            btn.classList.add('scale-125', 'brightness-150')
            setTimeout(() => btn.classList.remove('scale-125', 'brightness-150'), 200)
        }
    }

    // 3. JOIN THE QUEUE (WITH AUTO-IMPORT)
    const handleJoinQueue = async () => {
        // Check if they are already in the queue
        const existing = singers.find(s => s.bhnl_id === currentUser.id)
        if (existing) return alert("You are already in the queue!")

        // Attempt to fetch the user's saved repertoire from BHNL
        let userSetlist = []
        try {
            const { data: rep } = await supabase.from('repertoire').select('song_title, artist').eq('user_id', currentUser.id)
            if (rep && rep.length > 0) {
                userSetlist = rep.map(r => `${r.song_title} by ${r.artist}`)
            }
        } catch (err) { console.log("No repertoire found, proceeding with empty setlist.") }

        const newSinger = {
            session_id: sessionId,
            bhnl_id: currentUser.id,
            name: currentUser.username,
            total_points: 0,
            status: 'waiting',
            setlist: userSetlist // Attach the auto-imported songs!
        }

        await supabase.from('session_singers').insert([newSinger])
        alert("🎤 You have been added to the queue!" + (userSetlist.length > 0 ? `\n(${userSetlist.length} songs imported)` : ""))
    }

    if (isLoading || !session) return <div className="flex justify-center py-20"><div className="w-12 h-12 border-4 border-[#00f5ff] border-t-transparent rounded-full animate-spin"></div></div>

    // Find who is currently singing
    const activeSinger = singers.find(s => s.status === 'singing')
    
    // Icon mapping
    const icons = { 'star': '⭐', 'heart': '❤️', 'bolt': '⚡', 'thumb': '👍' }
    const displayIcon = icons[session.voting_icon] || '⭐'

    return (
        <div className="max-w-xl mx-auto p-4 animate-fade-in pb-32 mt-4 space-y-6">
            
            {/* HEADER */}
            <div className="flex justify-between items-center bg-[#090812] border border-gray-800 p-4 rounded-2xl shadow-lg">
                <div>
                    <h2 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest">{session.session_title}</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Host: {session.host_name}</p>
                </div>
                <button onClick={onExit} className="bg-red-900/20 text-red-500 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-colors">
                    Leave
                </button>
            </div>

            {/* LIVE STAGE (VOTING AREA) */}
            <div className={`border-2 rounded-3xl p-8 text-center shadow-2xl transition-all duration-500 ${activeSinger ? 'bg-[#090812] border-[#00f5ff] shadow-[0_0_40px_rgba(0,245,255,0.2)]' : 'bg-black/50 border-gray-800'}`}>
                {activeSinger ? (
                    <div className="animate-fade-in">
                        <div className="inline-block bg-[#ff2d78] text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 animate-pulse">
                            ● LIVE ON STAGE
                        </div>
                        <h3 className="text-5xl font-['Bebas_Neue'] text-white tracking-widest mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{activeSinger.name}</h3>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-8">Score: <span className="text-[#00f5ff] text-lg">{activeSinger.total_points}</span></p>

                        {/* VOTING CONTROLS */}
                        {session.voting_style === 'normal' ? (
                            <div className="flex justify-center gap-2 sm:gap-4">
                                {[1, 2, 3, 4, 5].map(pts => (
                                    <button 
                                        key={pts} 
                                        id={`vote-btn-${pts}`}
                                        onClick={() => handleVote(activeSinger.id, pts)}
                                        disabled={votedFor[activeSinger.id]}
                                        className={`w-12 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${votedFor[activeSinger.id] ? 'bg-gray-800 border-gray-700 opacity-50 cursor-not-allowed' : 'bg-[#00f5ff]/10 border-[#00f5ff] hover:bg-[#00f5ff] hover:text-black shadow-[0_0_15px_rgba(0,245,255,0.3)]'}`}
                                    >
                                        <span className="text-xl sm:text-2xl mb-1">{displayIcon}</span>
                                        <span className="text-[10px] sm:text-xs font-bold font-['Bebas_Neue'] text-white">+{pts}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            // TAP TO VOTE (MASH MODE)
                            <button 
                                id="vote-btn-1"
                                onClick={() => handleVote(activeSinger.id, 1)}
                                className="w-32 h-32 rounded-full bg-[#ff2d78] border-4 border-white text-5xl flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(255,45,120,0.6)] hover:scale-95 active:scale-90 transition-transform select-none"
                            >
                                {displayIcon}
                            </button>
                        )}

                        {votedFor[activeSinger.id] && session.voting_style === 'normal' && (
                            <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest mt-6 animate-fade-in">✓ Vote Cast</p>
                        )}
                    </div>
                ) : (
                    <div className="py-8 opacity-50">
                        <div className="text-6xl mb-4">🎤</div>
                        <h3 className="text-2xl font-['Bebas_Neue'] text-white tracking-widest mb-2">Stage is Empty</h3>
                        <p className="text-gray-400 text-xs uppercase tracking-widest font-bold">Waiting for host to start the next singer...</p>
                    </div>
                )}
            </div>

            {/* QUEUE / LEADERBOARD */}
            <div>
                <div className="flex justify-between items-end mb-4 px-2">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Live Leaderboard</h3>
                    <button onClick={handleJoinQueue} className="text-[#00f5ff] text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors">
                        + Request to Sing
                    </button>
                </div>
                
                {singers.length === 0 ? (
                    <div className="text-center p-6 border border-dashed border-gray-800 rounded-xl bg-black/30">
                        <p className="text-gray-500 text-xs font-bold tracking-widest uppercase">No singers in queue.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {singers.map((singer, index) => (
                            <div key={singer.id} className={`bg-gray-900 border ${singer.status === 'singing' ? 'border-[#00f5ff] shadow-[0_0_15px_rgba(0,245,255,0.2)]' : 'border-gray-800'} rounded-xl p-4 flex items-center justify-between`}>
                                <div className="flex items-center gap-4">
                                    <div className={`font-['Bebas_Neue'] text-3xl w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-gray-600'}`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-white text-lg leading-tight">{singer.name} {singer.bhnl_id === currentUser.id && <span className="text-gray-500 text-xs">(You)</span>}</h4>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{singer.status}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`font-['Bebas_Neue'] text-3xl ${singer.status === 'singing' ? 'text-[#00f5ff] drop-shadow-[0_0_5px_rgba(0,245,255,0.8)]' : 'text-gray-400'}`}>{singer.total_points}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}